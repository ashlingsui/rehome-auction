import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listItems, isAdmin, type FeedItem } from "@/lib/items.functions";
import { saleQuery } from "@/components/CountdownChip";
import { CATEGORIES, categoryLabel, categoryToken } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Sparkles, Plus, LogOut, Lock } from "lucide-react";

const itemsQuery = queryOptions({
  queryKey: ["items"],
  queryFn: () => listItems(),
  staleTime: 10_000,
});
const adminQuery = queryOptions({
  queryKey: ["is-admin"],
  queryFn: () => isAdmin(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/_authenticated/feed")({
  ssr: false,
  loader: ({ context }) => context.queryClient.ensureQueryData(itemsQuery),
  component: FeedPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
});

function FeedPage() {
  const { data: items } = useSuspenseQuery(itemsQuery);
  const { data: admin } = useQuery(adminQuery);
  const { data: sale } = useQuery(saleQuery);
  const [cat, setCat] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "auction" | "free">("all");
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const expired = !!sale && new Date(sale.auction_ends_at).getTime() <= nowMs;
  const navigate = useNavigate();

  // Live: refetch on item/bid changes
  useEffect(() => {
    const ch = supabase
      .channel("feed-items")
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, () => {
        window.dispatchEvent(new Event("items-changed"));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bids" }, () => {
        window.dispatchEvent(new Event("items-changed"));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);
  useEffect(() => {
    const handler = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__tsq?.invalidate?.();
    };
    window.addEventListener("items-changed", handler);
    return () => window.removeEventListener("items-changed", handler);
  }, []);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (cat && i.category !== cat) return false;
      if (typeFilter !== "all" && i.type !== typeFilter) return false;
      return true;
    });
  }, [items, cat, typeFilter]);

  const auctionCount = items.filter((i) => i.type === "auction").length;
  const freeCount = items.filter((i) => i.type === "free").length;

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Moving Sale · 2026
            </div>
            <h1 className="font-display text-2xl italic leading-none text-foreground">
              The Sale
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {admin?.isAdmin && (
              <Link
                to="/admin"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-xs font-medium text-background hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Add
              </Link>
            )}
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Type toggle */}
        <div className="mx-auto flex max-w-4xl gap-2 px-5 pb-3">
          <TypeChip
            active={typeFilter === "all"}
            onClick={() => setTypeFilter("all")}
            label={`Everything · ${items.length}`}
          />
          <TypeChip
            active={typeFilter === "auction"}
            onClick={() => setTypeFilter("auction")}
            label={`Auction · ${auctionCount}`}
          />
          <TypeChip
            active={typeFilter === "free"}
            onClick={() => setTypeFilter("free")}
            label={`Free · ${freeCount}`}
          />
        </div>

        {/* Category pills */}
        <div className="mx-auto max-w-4xl overflow-x-auto px-5 pb-3">
          <div className="flex gap-2">
            <CatPill active={cat === null} onClick={() => setCat(null)} token="matcha">
              All
            </CatPill>
            {CATEGORIES.map((c) => (
              <CatPill
                key={c.value}
                active={cat === c.value}
                onClick={() => setCat(c.value)}
                token={c.token}
              >
                {c.label}
              </CatPill>
            ))}
          </div>
        </div>
      </header>

      {/* Grid */}
      <main className="mx-auto max-w-4xl px-5 pt-6">
        {filtered.length === 0 ? (
          <EmptyState admin={!!admin?.isAdmin} />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {filtered.map((item, i) => (
              <ItemCard key={item.id} item={item} idx={i} expired={expired} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function TypeChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-xs font-medium transition",
        active
          ? "bg-foreground text-background"
          : "border border-border bg-background text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

function CatPill({
  active,
  onClick,
  children,
  token,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  token: string;
}) {
  const tokenBg: Record<string, string> = {
    matcha: "bg-matcha text-matcha-foreground",
    tangerine: "bg-tangerine text-tangerine-foreground",
    lilac: "bg-lilac text-lilac-foreground",
    butter: "bg-butter text-butter-foreground",
    blush: "bg-blush text-blush-foreground",
    sky: "bg-sky text-sky-foreground",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition",
        active
          ? tokenBg[token] ?? "bg-matcha text-matcha-foreground"
          : "border border-border bg-background text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function ItemCard({ item, idx }: { item: FeedItem; idx: number }) {
  const token = categoryToken(item.category);
  const chipTone: Record<string, string> = {
    matcha: "bg-matcha/80 text-matcha-foreground",
    tangerine: "bg-tangerine/80 text-tangerine-foreground",
    lilac: "bg-lilac/80 text-lilac-foreground",
    butter: "bg-butter/80 text-butter-foreground",
    blush: "bg-blush/80 text-blush-foreground",
    sky: "bg-sky/80 text-sky-foreground",
  };
  const claimed = item.status === "claimed";

  // Vary card heights slightly for a magazine feel
  const heights = ["h-56", "h-72", "h-64", "h-80"];
  const h = heights[idx % heights.length];

  return (
    <Link
      to="/items/$itemId"
      params={{ itemId: item.id }}
      className="group relative block"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-border bg-card transition",
          h,
          claimed && "opacity-70",
        )}
      >
        {item.photo_signed_url ? (
          <img
            src={item.photo_signed_url}
            alt={item.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
            no photo
          </div>
        )}

        {/* Category chip */}
        <div className="absolute left-3 top-3">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider backdrop-blur-md",
              chipTone[token] ?? chipTone.matcha,
            )}
          >
            {categoryLabel(item.category)}
          </span>
        </div>

        {/* Type badge */}
        <div className="absolute right-3 top-3">
          {item.type === "auction" ? (
            <span className="rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-foreground backdrop-blur">
              Auction
            </span>
          ) : (
            <span className="rounded-full bg-foreground px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-background">
              Free
            </span>
          )}
        </div>

        {claimed && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/90 to-transparent p-4 text-background">
            <div className="text-[10px] uppercase tracking-widest opacity-80">Claimed</div>
            <div className="text-sm font-medium">
              by {item.claimed_by_name ?? "a friend"}
            </div>
          </div>
        )}

        {!claimed && item.type === "auction" && item.bid_count > 0 && (
          <div className="absolute bottom-3 left-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-medium text-foreground backdrop-blur">
              <Sparkles className="h-3 w-3" strokeWidth={2.5} />
              {item.bid_count} {item.bid_count === 1 ? "bid" : "bids"}
            </span>
          </div>
        )}
      </div>
      <div className="mt-2 px-1">
        <h3 className="line-clamp-1 text-sm font-medium text-foreground">{item.title}</h3>
        {item.type === "auction" && item.user_has_bid && (
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-matcha-foreground">
            Your bid is in
          </p>
        )}
      </div>
    </Link>
  );
}

function EmptyState({ admin }: { admin: boolean }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-butter">
        <Sparkles className="h-6 w-6 text-butter-foreground" />
      </div>
      <h3 className="font-display text-xl italic text-foreground">Nothing here yet</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {admin
          ? "Upload your first piece and get the sale started."
          : "Check back in a moment — the sale is being set up."}
      </p>
      {admin && (
        <Link
          to="/admin"
          className="mt-4 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90"
        >
          Upload an item
        </Link>
      )}
    </div>
  );
}
