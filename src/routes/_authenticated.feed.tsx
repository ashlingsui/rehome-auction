import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listItems, isAdmin, type FeedItem } from "@/lib/items.functions";
import { saleQuery } from "@/components/CountdownChip";
import { OnlinePresence } from "@/components/OnlinePresence";
import { NotStartedOverlay } from "@/components/NotStartedOverlay";
import { CATEGORIES, categoryLabel, categoryToken } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Sparkles, LogOut, Lock, ShoppingBag, ChevronDown, Plus, BarChart3, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ADMIN_PASSWORD = "080808";
const ADMIN_UNLOCK_KEY = "adminUnlocked";



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
  const [adminUnlocked, setAdminUnlocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(ADMIN_UNLOCK_KEY) === "1";
  });
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
      <NotStartedOverlay adminBypass={!!admin?.isAdmin} />
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
            {admin?.isAdmin && !adminUnlocked && (
              <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Host tools →
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <OnlinePresence />
            {admin?.isAdmin && (
              <AdminMenu unlocked={adminUnlocked} setUnlocked={setAdminUnlocked} />
            )}



            <Link
              to="/my"
              aria-label="My stuff"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted"
            >
              <ShoppingBag className="h-4 w-4" />
            </Link>
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
        <div className="mb-5 rounded-3xl border border-border bg-lilac/40 px-5 py-5 text-sm text-foreground">
          <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            A little note 💌
          </div>
          <ul className="space-y-2.5 leading-relaxed">
            <li className="flex gap-2.5">
              <span className="shrink-0">🏠</span>
              <span>Ashling is clearing out her apartment and has too much stuff — she needs your help finding new homes for things.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="shrink-0">🎁</span>
              <span>Items marked <strong>Free</strong> are first come, first served. Grab them before someone else does.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="shrink-0">🤝</span>
              <span>Items marked <strong>Auction</strong> are blind bids: you only get to bid once, no one sees what others bid, and the highest offer wins.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="shrink-0">🍷</span>
              <span>This is a friends & family thing, so please keep bids gentle. Every bid goes into Ashling's wine fund — do not encourage her drinking too much — so bid what feels fair, not what feels competitive.</span>
            </li>
          </ul>
        </div>

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

const ADMIN_PULSE_KEY = "adminPulseShown";

function AdminMenu({
  unlocked,
  setUnlocked,
}: {
  unlocked: boolean;
  setUnlocked: (v: boolean) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (unlocked) return;
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(ADMIN_PULSE_KEY) === "1") return;
    window.sessionStorage.setItem(ADMIN_PULSE_KEY, "1");
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 3000);
    return () => clearTimeout(t);
  }, [unlocked]);

  function submitPw(e: React.FormEvent) {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      window.sessionStorage.setItem(ADMIN_UNLOCK_KEY, "1");
      setUnlocked(true);
      setDialogOpen(false);
      setPw("");
      toast.success("Admin unlocked");
    } else {
      toast.error("Wrong password");
      setPw("");
    }
  }

  function lock() {
    window.sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
    setUnlocked(false);
    toast.success("Admin locked");
  }

  if (!unlocked) {
    return (
      <>
        <button
          onClick={() => setDialogOpen(true)}
          className={cn(
            "relative inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-xs font-semibold text-background shadow-sm hover:opacity-90",
            pulse && "ring-2 ring-foreground/40 ring-offset-2 ring-offset-background animate-pulse",
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
          Admin
          <span className="ml-0.5 inline-flex items-center gap-1 rounded-full bg-background/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wider">
            <Lock className="h-2.5 w-2.5" strokeWidth={3} />
            Unlock
          </span>
        </button>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setPw(""); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Admin access</DialogTitle>
              <DialogDescription>Enter the admin password to unlock.</DialogDescription>
            </DialogHeader>
            <form onSubmit={submitPw} className="space-y-3">
              <Input
                type="password"
                inputMode="numeric"
                autoFocus
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="••••••"
                className="h-11 rounded-2xl"
              />
              <DialogFooter>
                <Button type="submit" className="h-11 w-full rounded-2xl">Unlock</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1 rounded-full bg-foreground px-3.5 text-xs font-medium text-background hover:opacity-90">
        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
        Admin
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link to="/admin" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add item
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/admin/results" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Results
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={lock} className="flex items-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4" />
          Lock admin
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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

function ItemCard({ item, expired }: { item: FeedItem; idx: number; expired: boolean }) {
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

  return (
    <Link
      to="/items/$itemId"
      params={{ itemId: item.id }}
      className="group relative block"
    >
      <div
        className={cn(
          "relative aspect-square overflow-hidden rounded-3xl border border-border bg-card transition",
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

        {!claimed && expired && (
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/45 backdrop-blur-[2px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-foreground">
              <Lock className="h-3 w-3" strokeWidth={2.5} />
              Closed
            </span>
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
