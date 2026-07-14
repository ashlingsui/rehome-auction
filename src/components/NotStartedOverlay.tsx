import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { saleQuery } from "@/components/CountdownChip";
import { Lock } from "lucide-react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-6 backdrop-blur-md">
      <div className="w-full max-w-md rounded-[2rem] border border-border bg-background p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-butter">
          <Lock className="h-6 w-6 text-butter-foreground" strokeWidth={2.5} />
        </div>
        <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
          The sale opens
        </div>
        <h2 className="mt-2 font-display text-3xl italic leading-tight text-foreground">
          {formatWhen(sale.auction_starts_at)}
        </h2>
        <div className="mt-6 rounded-2xl bg-muted px-5 py-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Opens in
          </div>
          <div className="mt-1 font-display text-4xl italic tabular-nums text-foreground">
            {formatFull(startsAt - now)}
          </div>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Browsing is open. Bids and claims unlock when the timer hits zero.
        </p>
        {adminBypass && (
          <button
            onClick={() => setDismissed(true)}
            className="mt-6 text-xs font-medium uppercase tracking-wider text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Preview as admin →
          </button>
        )}
      </div>
    </div>
  );
}
