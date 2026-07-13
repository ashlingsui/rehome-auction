import { useEffect, useState } from "react";
import { useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getSaleSettings } from "@/lib/sale.functions";
import { cn } from "@/lib/utils";

export const saleQuery = queryOptions({
  queryKey: ["sale-settings"],
  queryFn: () => getSaleSettings(),
  staleTime: 5 * 60_000,
});

function formatRemaining(ms: number): string {
  if (ms <= 0) return "";
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(mins)}m`;
  if (hours > 0) return `${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;
  return `${pad(mins)}:${pad(secs)}`;
}

export function CountdownChip() {
  const qc = useQueryClient();
  const { data } = useQuery(saleQuery);
  const [now, setNow] = useState(() => Date.now());
  const location = useLocation();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel("sale-settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sale_settings" },
        () => qc.invalidateQueries({ queryKey: ["sale-settings"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  if (!data) return null;

  const endsAt = new Date(data.auction_ends_at).getTime();
  const remaining = endsAt - now;
  const expired = remaining <= 0;

  // Item detail has a fixed bottom action bar — anchor top-right there.
  const isItemDetail = location.pathname.startsWith("/items/");
  const positionClass = isItemDetail
    ? "top-4 right-4"
    : "bottom-5 right-5";

  return (
    <div
      className={cn(
        "fixed z-40 select-none rounded-2xl border border-border/70 bg-background/85 px-4 py-2.5 shadow-sm backdrop-blur-lg",
        positionClass,
      )}
      aria-live="polite"
    >
      <div className="text-[9px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {expired ? "Sale" : "Closes in"}
      </div>
      <div
        className={cn(
          "font-display italic leading-none",
          expired ? "text-lg text-muted-foreground" : "text-xl text-foreground",
        )}
      >
        {expired ? "Closed" : formatRemaining(remaining)}
      </div>
    </div>
  );
}
