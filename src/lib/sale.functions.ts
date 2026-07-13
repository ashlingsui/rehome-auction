import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SaleSettings = { auction_ends_at: string };

export const getSaleSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SaleSettings> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("sale_settings")
      .select("auction_ends_at")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Sale not configured");
    return { auction_ends_at: data.auction_ends_at };
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
