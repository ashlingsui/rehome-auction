import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAuctionResults, adminUnclaimFreeItem, listItemBids } from "@/lib/admin.functions";
import { isAdmin } from "@/lib/items.functions";
import { formatPhoneDisplay } from "@/lib/phone";
import { ArrowLeft, ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Phone, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const adminQuery = queryOptions({
  queryKey: ["is-admin"],
  queryFn: () => isAdmin(),
});

const resultsQuery = queryOptions({
  queryKey: ["auction-results"],
  queryFn: () => getAuctionResults(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/_authenticated/admin/results")({
  ssr: false,
  component: ResultsPage,
});

type Tab = "active" | "closed" | "free";

function ResultsPage() {
  const { data: adminCheck, isLoading: adminLoading } = useQuery(adminQuery);
  const { data, isLoading } = useQuery(resultsQuery);
  const [tab, setTab] = useState<Tab | null>(null);
  const [hidePrices, setHidePrices] = useState(false);

  const saleClosed = data?.sale_closed ?? false;
  const activeTab: Tab = tab ?? (saleClosed ? "closed" : "active");

  if (adminLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }


  if (!adminCheck?.isAdmin) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h2 className="font-display text-3xl italic">Just for the host</h2>
        <Link
          to="/feed"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background"
        >
          Back to the sale
        </Link>
      </div>
    );
  }

  const auctions = data?.auctions ?? [];
  const withBids = auctions.filter((a) => a.winning_amount !== null);
  const freeClaims = data?.free_claims ?? [];

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "active", label: "Active auctions", count: withBids.length },
    { id: "closed", label: "Closed auctions", count: withBids.length },
    { id: "free", label: "Claimed free", count: freeClaims.length },
  ];

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="mx-auto max-w-xl px-5 pt-6">
        <Link
          to="/admin"
          className="inline-flex h-10 items-center gap-1 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="mt-8">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Private
          </div>
          <h1 className="mt-1 font-display text-4xl italic text-foreground">
            Results
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {saleClosed
              ? "The sale has closed — here are your winners."
              : "Peek at where things stand. Winners lock in when the countdown hits zero."}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-medium transition",
                activeTab === t.id
                  ? "bg-foreground text-background"
                  : "border border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {t.label}
              <span className="ml-1.5 opacity-60">{t.count}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setHidePrices((v) => !v)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
            title={hidePrices ? "Show prices" : "Hide prices"}
          >
            {hidePrices ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {hidePrices ? "Prices hidden" : "Hide prices"}
          </button>
        </div>

        <div className="mt-6">
          {activeTab === "active" &&
            (saleClosed ? (
              <EmptyState text="The sale has ended — check the Closed auctions tab." />
            ) : (
              <AuctionList rows={auctions} showZero hidePrices={hidePrices} />
            ))}

          {activeTab === "closed" &&
            (!saleClosed ? (
              <EmptyState text="Results appear here when the countdown ends." />
            ) : (
              <AuctionList rows={auctions} showZero hidePrices={hidePrices} />
            ))}

          {activeTab === "free" &&
            (freeClaims.length === 0 ? (
              <EmptyState text="Nothing's been claimed yet." />
            ) : (
              <FreeList rows={freeClaims} />
            ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function AuctionList({
  rows,
  showZero,
  hidePrices,
}: {
  rows: {
    item_id: string;
    title: string;
    photo_signed_url: string;
    bid_count: number;
    winning_amount: number | null;
    winner_name: string | null;
    winner_phone: string | null;
  }[];
  showZero: boolean;
  hidePrices: boolean;
}) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
      {rows.map((r) => (
        <AuctionRow key={r.item_id} row={r} showZero={showZero} hidePrices={hidePrices} />
      ))}
    </div>
  );
}

function AuctionRow({
  row: r,
  showZero,
  hidePrices,
}: {
  row: {
    item_id: string;
    title: string;
    photo_signed_url: string;
    bid_count: number;
    winning_amount: number | null;
    winner_name: string | null;
    winner_phone: string | null;
  };
  showZero: boolean;
  hidePrices: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listBids = useServerFn(listItemBids);
  const hasBids = r.winning_amount !== null;
  const { data: bids, isLoading } = useQuery({
    queryKey: ["item-bids", r.item_id],
    queryFn: () => listBids({ data: { item_id: r.item_id } }),
    enabled: open && hasBids,
    staleTime: 15_000,
  });

  return (
    <div className="p-4">
      <div className="flex items-center gap-4">
        <img
          src={r.photo_signed_url}
          alt={r.title}
          className="h-16 w-16 flex-shrink-0 rounded-2xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{r.title}</div>
          {hasBids ? (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {r.winner_name}
              {r.winner_phone && (
                <a
                  href={`tel:${r.winner_phone}`}
                  className="ml-2 inline-flex items-center gap-1 text-foreground/70 hover:text-foreground"
                >
                  <Phone className="h-3 w-3" />
                  {formatPhoneDisplay(r.winner_phone)}
                </a>
              )}
            </div>
          ) : (
            showZero && (
              <div className="mt-0.5 text-xs italic text-muted-foreground">No bids yet</div>
            )
          )}
          {hasBids ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              {r.bid_count} {r.bid_count === 1 ? "bid" : "bids"}
              {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          ) : (
            <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {r.bid_count} {r.bid_count === 1 ? "bid" : "bids"}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          {hasBids ? (
            <div className="font-display text-2xl italic text-foreground">
              ¥{r.winning_amount}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">—</div>
          )}
        </div>
      </div>
      {open && hasBids && (
        <div className="mt-3 rounded-2xl bg-muted/40 p-3">
          {isLoading ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : bids && bids.length > 0 ? (
            <ul className="divide-y divide-border/60">
              {bids.map((b, i) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">
                      {i === 0 && <span className="mr-1">👑</span>}
                      {b.name}
                    </div>
                    {b.phone && (
                      <a
                        href={`tel:${b.phone}`}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Phone className="h-3 w-3" />
                        {formatPhoneDisplay(b.phone)}
                      </a>
                    )}
                  </div>
                  <div className="font-display text-base italic text-foreground">¥{b.amount}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center text-xs text-muted-foreground">No bids.</div>
          )}
        </div>
      )}
    </div>
  );
}

function FreeList({
  rows,
}: {
  rows: {
    item_id: string;
    title: string;
    photo_signed_url: string;
    claimer_name: string;
    claimer_phone: string;
  }[];
}) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
      {rows.map((r) => (
        <FreeRow key={r.item_id} row={r} />
      ))}
    </div>
  );
}

function FreeRow({
  row: r,
}: {
  row: {
    item_id: string;
    title: string;
    photo_signed_url: string;
    claimer_name: string;
    claimer_phone: string;
  };
}) {
  const qc = useQueryClient();
  const unclaimFn = useServerFn(adminUnclaimFreeItem);
  const [busy, setBusy] = useState(false);

  async function onUnclaim() {
    if (!confirm(`Release "${r.title}" back to available?`)) return;
    setBusy(true);
    try {
      await unclaimFn({ data: { id: r.item_id } });
      await qc.invalidateQueries({ queryKey: ["auction-results"] });
      toast.success("Released.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't release.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4 p-4">
      <img
        src={r.photo_signed_url}
        alt={r.title}
        className="h-16 w-16 flex-shrink-0 rounded-2xl object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {r.title}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {r.claimer_name}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {r.claimer_phone && (
          <a
            href={`tel:${r.claimer_phone}`}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Phone className="h-3 w-3" />
            {formatPhoneDisplay(r.claimer_phone)}
          </a>
        )}
        <button
          type="button"
          onClick={onUnclaim}
          disabled={busy}
          title="Release back to available"
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
          Release
        </button>
      </div>
    </div>
  );
}

