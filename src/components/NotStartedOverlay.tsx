import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { saleQuery } from "@/components/CountdownChip";
import { Lock, X } from "lucide-react";

function formatFull(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;
  return `${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NotStartedOverlay({ adminBypass = false }: { adminBypass?: boolean }) {
  void adminBypass;
  const { data: sale } = useQuery(saleQuery);
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!sale) return null;
  const startsAt = new Date(sale.auction_starts_at).getTime();
  if (now >= startsAt) return null;
  if (dismissed) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="pointer-events-auto relative w-full max-w-sm rounded-3xl border border-border bg-background/95 p-5 text-center shadow-2xl backdrop-blur-sm">
        <button
          onClick={() => setDismissed(true)}
          aria-label="Browse anyway"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-butter">
          <Lock className="h-4 w-4 text-butter-foreground" strokeWidth={2.5} />
        </div>
        <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
          The sale opens
        </div>
        <h2 className="mt-1 font-display text-xl italic leading-tight text-foreground">
          {formatWhen(sale.auction_starts_at)}
        </h2>
        <div className="mt-3 rounded-2xl bg-muted px-4 py-2.5">
          <div className="text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Opens in
          </div>
          <div className="mt-0.5 font-display text-2xl italic tabular-nums text-foreground">
            {formatFull(startsAt - now)}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Browse now — bids and claims unlock at zero.
        </p>
        <button
          onClick={() => setDismissed(true)}
          className="mt-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Browse anyway →
        </button>
      </div>
    </div>
  );
}
