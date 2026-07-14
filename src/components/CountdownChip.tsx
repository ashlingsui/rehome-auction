import { useEffect, useState } from "react";
import { useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
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

  const startsAt = new Date(data.auction_starts_at).getTime();
  const endsAt = new Date(data.auction_ends_at).getTime();
  const notStarted = now < startsAt;
  const expired = now >= endsAt;

  let label = "Closes in";
  let value = formatRemaining(endsAt - now);
  if (notStarted) {
    label = "Opens in";
    value = formatRemaining(startsAt - now);
  } else if (expired) {
    label = "Sale";
    value = "Closed";
  }

  return (
    <div
      className="w-full border-b border-border/70 bg-background/90 backdrop-blur"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-4xl items-center justify-center gap-2 px-5 py-2 text-center">
        <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "font-display italic leading-none text-base",
            expired ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
