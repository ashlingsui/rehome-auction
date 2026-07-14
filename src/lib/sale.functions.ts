import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SaleSettings = {
  auction_starts_at: string;
  auction_ends_at: string;
  max_bid_amount: number;
};

export const getSaleSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SaleSettings> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("sale_settings")
      .select("auction_starts_at, auction_ends_at, max_bid_amount")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Sale not configured");
    const row = data as {
      auction_starts_at: string;
      auction_ends_at: string;
      max_bid_amount: number | string;
    };
    return {
      auction_starts_at: row.auction_starts_at,
      auction_ends_at: row.auction_ends_at,
      max_bid_amount: Number(row.max_bid_amount ?? 200),
    };
  });

export const updateSaleEndsAt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ ends_at: z.string().datetime() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only admins can change the sale timer.");
    const { error } = await supabase
      .from("sale_settings")
      .update({ auction_ends_at: data.ends_at, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSaleStartsAt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ starts_at: z.string().datetime() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only admins can change the sale timer.");
    const { error } = await supabase
      .from("sale_settings")
      .update({
        auction_starts_at: data.starts_at,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMaxBidAmount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ max_bid_amount: z.number().positive().max(100000) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only admins can change the bid limit.");
    const { error } = await supabase
      .from("sale_settings")
      .update({ max_bid_amount: data.max_bid_amount, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
