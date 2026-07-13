import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGateway } from "@/lib/ai-gateway.server";

const CATEGORY = z.enum([
  "bedroom",
  "kitchen",
  "living_room",
  "bathroom",
  "decor",
  "wardrobe",
  "other",
]);

export const createItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        title: z.string().min(1).max(120),
        photo_path: z.string().min(1),
        category: CATEGORY,
        type: z.enum(["auction", "free"]),
        description: z.string().max(1000).optional().nullable(),
        starting_price: z.number().positive().max(100000).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admins only.");

    const { data: item, error } = await supabase
      .from("items")
      .insert({
        title: data.title,
        photo_url: data.photo_path,
        category: data.category,
        type: data.type,
        description: data.description ?? null,
        starting_price: data.type === "auction" ? (data.starting_price ?? null) : null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { id: item.id };
  });

export const deleteItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admins only.");
    const { error } = await supabase.from("items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const generateDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        title: z.string().min(1).max(120),
        photo_path: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admins only.");

    const { data: signed, error: signErr } = await supabase.storage
      .from("item-photos")
      .createSignedUrl(data.photo_path, 60 * 5);
    if (signErr || !signed?.signedUrl) throw new Error("Couldn't read the photo.");

    const gateway = createLovableAiGateway();
    const model = gateway("google/gemini-2.5-flash");

    const result = await generateText({
      model,
      system:
        "You are a chic interior design copywriter. Write in a light, aesthetic, playful tone — like a magazine caption. Always exactly 2 sentences. Never use quote marks or emojis.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Item title: "${data.title}". Look at the photo and write a short, punchy 2-sentence description to help sell it to friends at a moving sale.`,
            },
            { type: "image", image: new URL(signed.signedUrl) },
          ],
        },
      ],
    });

    return { description: result.text.trim() };
  });

export const listItemBids = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ item_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admins only.");

    const { data: bids, error } = await supabase
      .from("bids")
      .select("id, amount, created_at, user_id")
      .eq("item_id", data.item_id)
      .order("amount", { ascending: false });
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((bids ?? []).map((b) => b.user_id)));
    const nameMap = new Map<string, { name: string; phone: string }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, phone")
        .in("id", userIds);
      for (const p of profiles ?? [])
        nameMap.set(p.id, { name: p.name, phone: p.phone });
    }
    return (bids ?? []).map((b) => ({
      id: b.id,
      amount: Number(b.amount),
      created_at: b.created_at,
      name: nameMap.get(b.user_id)?.name ?? "—",
      phone: nameMap.get(b.user_id)?.phone ?? "",
    }));
  });

export const getUploadPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ ext: z.string().max(6) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    // Photos live at `${userId}/${uuid}.${ext}` so admin can only overwrite own.
    const path = `${userId}/${crypto.randomUUID()}.${data.ext.replace(/^\./, "")}`;
    return { path };
  });

export type AuctionResult = {
  item_id: string;
  title: string;
  photo_signed_url: string;
  bid_count: number;
  winning_amount: number | null;
  winner_name: string | null;
  winner_phone: string | null;
};

export type FreeClaim = {
  item_id: string;
  title: string;
  photo_signed_url: string;
  claimer_name: string;
  claimer_phone: string;
};

export const getAuctionResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdminRow } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdminRow) throw new Error("Admins only.");

    const [{ data: items, error: itemsErr }, { data: settings }] =
      await Promise.all([
        supabase.from("items").select("*").order("created_at", { ascending: false }),
        supabase.from("sale_settings").select("auction_ends_at").eq("id", true).maybeSingle(),
      ]);
    if (itemsErr) throw new Error(itemsErr.message);
    const allItems = items ?? [];

    const sale_closed = settings
      ? new Date(settings.auction_ends_at).getTime() <= Date.now()
      : false;

    // Sign all photos in a single call
    const paths = allItems.map((i) => i.photo_url).filter(Boolean);
    const signedMap: Record<string, string> = {};
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage
        .from("item-photos")
        .createSignedUrls(paths, 60 * 60);
      for (const row of signed ?? []) {
        if (row.path && row.signedUrl) signedMap[row.path] = row.signedUrl;
      }
    }

    // All bids for auction items
    const auctionItems = allItems.filter((i) => i.type === "auction");
    const auctionIds = auctionItems.map((i) => i.id);

    const bidsByItem = new Map<
      string,
      { amount: number; user_id: string; created_at: string }
    >();
    const bidCounts = new Map<string, number>();

    if (auctionIds.length > 0) {
      const { data: bids } = await supabase
        .from("bids")
        .select("item_id, amount, user_id, created_at")
        .in("item_id", auctionIds);
      for (const b of bids ?? []) {
        const amt = Number(b.amount);
        bidCounts.set(b.item_id, (bidCounts.get(b.item_id) ?? 0) + 1);
        const cur = bidsByItem.get(b.item_id);
        if (!cur || amt > cur.amount) {
          bidsByItem.set(b.item_id, {
            amount: amt,
            user_id: b.user_id,
            created_at: b.created_at,
          });
        }
      }
    }

    // Profiles for winners + claimers
    const claimerIds = allItems
      .filter((i) => i.type === "free" && i.claimed_by)
      .map((i) => i.claimed_by as string);
    const winnerIds = Array.from(bidsByItem.values()).map((b) => b.user_id);
    const profileIds = Array.from(new Set([...claimerIds, ...winnerIds]));

    const profileMap = new Map<string, { name: string; phone: string }>();
    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, phone")
        .in("id", profileIds);
      for (const p of profiles ?? [])
        profileMap.set(p.id, { name: p.name, phone: p.phone });
    }

    const auctions: AuctionResult[] = auctionItems.map((i) => {
      const top = bidsByItem.get(i.id);
      const winner = top ? profileMap.get(top.user_id) : null;
      return {
        item_id: i.id,
        title: i.title,
        photo_signed_url: signedMap[i.photo_url] ?? "",
        bid_count: bidCounts.get(i.id) ?? 0,
        winning_amount: top ? top.amount : null,
        winner_name: winner?.name ?? null,
        winner_phone: winner?.phone ?? null,
      };
    });

    const free_claims: FreeClaim[] = allItems
      .filter((i) => i.type === "free" && i.status === "claimed" && i.claimed_by)
      .map((i) => {
        const p = profileMap.get(i.claimed_by as string);
        return {
          item_id: i.id,
          title: i.title,
          photo_signed_url: signedMap[i.photo_url] ?? "",
          claimer_name: p?.name ?? "—",
          claimer_phone: p?.phone ?? "",
        };
      });

    return { auctions, free_claims, sale_closed };
  });
