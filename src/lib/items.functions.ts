import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type FeedItem = {
  id: string;
  title: string;
  photo_url: string;
  photo_signed_url: string;
  category: string;
  type: "auction" | "free";
  description: string | null;
  starting_price: number | null;
  status: "available" | "claimed";
  claimed_by: string | null;
  claimed_by_name: string | null;
  bid_count: number;
  user_has_bid: boolean;
  created_at: string;
};

async function signPhotos(
  supabase: ReturnType<typeof mockClient>,
  paths: string[],
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  if (paths.length === 0) return map;
  const { data } = await supabase.storage
    .from("item-photos")
    .createSignedUrls(paths, 60 * 60);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
  }
  return map;
}
// Type helper only; not called at runtime.
function mockClient() {
  return null as unknown as {
    storage: {
      from: (bucket: string) => {
        createSignedUrls: (
          paths: string[],
          expires: number,
        ) => Promise<{ data: { path: string | null; signedUrl: string }[] | null }>;
      };
    };
  };
}

export const listItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FeedItem[]> => {
    const { supabase, userId } = context;

    const [{ data: items, error }, { data: bidCounts }, { data: myBids }] =
      await Promise.all([
        supabase.from("items").select("*").order("created_at", { ascending: false }),
        supabase.rpc("get_all_bid_counts"),
        supabase.from("bids").select("item_id").eq("user_id", userId),
      ]);

    if (error) throw new Error(error.message);
    if (!items) return [];

    const countMap = new Map<string, number>();
    for (const row of (bidCounts ?? []) as Array<{ item_id: string; bid_count: number }>) {
      countMap.set(row.item_id, row.bid_count);
    }
    const myBidSet = new Set<string>((myBids ?? []).map((b) => b.item_id));

    // Sign photos
    const paths = items.map((i) => i.photo_url).filter(Boolean);
    const signed = await signPhotos(supabase as unknown as ReturnType<typeof mockClient>, paths);

    // Fetch names of claimants
    const claimantIds = Array.from(
      new Set(items.map((i) => i.claimed_by).filter((v): v is string => !!v)),
    );
    let claimantMap = new Map<string, string>();
    if (claimantIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", claimantIds);
      for (const p of profiles ?? []) claimantMap.set(p.id, p.name);
    }

    return items.map((i) => ({
      id: i.id,
      title: i.title,
      photo_url: i.photo_url,
      photo_signed_url: signed[i.photo_url] ?? "",
      category: i.category,
      type: i.type,
      description: i.description,
      starting_price: i.starting_price !== null ? Number(i.starting_price) : null,
      status: i.status,
      claimed_by: i.claimed_by,
      claimed_by_name: i.claimed_by ? (claimantMap.get(i.claimed_by) ?? null) : null,
      bid_count: countMap.get(i.id) ?? 0,
      user_has_bid: myBidSet.has(i.id),
      created_at: i.created_at,
    }));
  });

export const getItem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<FeedItem> => {
    const { supabase, userId } = context;
    const { data: item, error } = await supabase
      .from("items")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!item) throw new Error("Item not found");

    const [{ data: countData }, { data: myBid }] = await Promise.all([
      supabase.rpc("get_bid_count", { _item_id: item.id }),
      supabase.from("bids").select("id").eq("item_id", item.id).eq("user_id", userId).maybeSingle(),
    ]);

    const { data: signed } = await supabase.storage
      .from("item-photos")
      .createSignedUrl(item.photo_url, 60 * 60);

    let claimant_name: string | null = null;
    if (item.claimed_by) {
      const { data: p } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", item.claimed_by)
        .maybeSingle();
      claimant_name = p?.name ?? null;
    }

    return {
      id: item.id,
      title: item.title,
      photo_url: item.photo_url,
      photo_signed_url: signed?.signedUrl ?? "",
      category: item.category,
      type: item.type,
      description: item.description,
      starting_price: item.starting_price !== null ? Number(item.starting_price) : null,
      status: item.status,
      claimed_by: item.claimed_by,
      claimed_by_name: claimant_name,
      bid_count: (countData as number | null) ?? 0,
      user_has_bid: !!myBid,
      created_at: item.created_at,
    };
  });

export const placeBid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ item_id: z.string().uuid(), amount: z.number().positive().max(100000) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("bids")
      .insert({ item_id: data.item_id, user_id: userId, amount: data.amount });
    if (error) {
      if (error.code === "23505") {
        throw new Error("You already placed your bid on this piece.");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const claimItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ item_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("claim_free_item", { _item_id: data.item_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });
