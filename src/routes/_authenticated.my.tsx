import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  useQuery,
  useSuspenseQuery,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listMyStuff, unclaimItem, type MyStuff } from "@/lib/items.functions";
import { saleQuery } from "@/components/CountdownChip";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, ShoppingBag, Gift, Sparkles, Lock } from "lucide-react";
import { categoryLabel } from "@/lib/categories";

const myStuffQuery = queryOptions({
  queryKey: ["my-stuff"],
  queryFn: () => listMyStuff(),
  staleTime: 10_000,
});

export const Route = createFileRoute("/_authenticated/my")({
  ssr: false,
  loader: ({ context }) => context.queryClient.ensureQueryData(myStuffQuery),
  component: MyStuffPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
});

function MyStuffPage() {
  const { data } = useSuspenseQuery(myStuffQuery);
  const { data: sale } = useQuery(saleQuery);
  const qc = useQueryClient();
  const unclaimFn = useServerFn(unclaimItem);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const expired = !!sale && new Date(sale.auction_ends_at).getTime() <= nowMs;

  useEffect(() => {
    const ch = supabase
      .channel("my-stuff")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items" },
        () => qc.invalidateQueries({ queryKey: ["my-stuff"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bids" },
        () => qc.invalidateQueries({ queryKey: ["my-stuff"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  async function onUnclaim(itemId: string) {
    if (!window.confirm("Release this item so someone else can claim it?")) return;
    setBusyId(itemId);
    try {
      await unclaimFn({ data: { item_id: itemId } });
      toast.success("Released. It's back in the sale.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-stuff"] }),
        qc.invalidateQueries({ queryKey: ["items"] }),
        qc.invalidateQueries({ queryKey: ["item", itemId] }),
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't unclaim.");
    } finally {
      setBusyId(null);
    }
  }

  const empty = data.claimed.length === 0 && data.bids.length === 0;

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="mx-auto max-w-2xl px-5 pt-6">
        <Link
          to="/feed"
          className="inline-flex h-10 items-center gap-1 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="mt-8">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <ShoppingBag className="h-3.5 w-3.5" />
            Your bag
          </div>
          <h1 className="mt-1 font-display text-4xl italic text-foreground">
            My Stuff
          </h1>
        </div>

        {empty ? (
          <EmptyBag />
        ) : (
          <>
            {data.claimed.length > 0 && (
              <Section
                title="Claimed"
                subtitle="Yours to keep — unless you release it."
                icon={<Gift className="h-4 w-4 text-matcha-foreground" />}
              >
                {data.claimed.map((item) => (
                  <MyCard key={item.id} item={item}>
                    {!expired && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === item.id}
                        onClick={() => onUnclaim(item.id)}
                        className="h-9 rounded-full border-border bg-background px-4 text-xs font-medium hover:bg-muted"
                      >
                        {busyId === item.id ? "Releasing…" : "Unclaim"}
                      </Button>
                    )}
                    {expired && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                        <Lock className="h-3 w-3" strokeWidth={2.5} />
                        Locked in
                      </span>
                    )}
                  </MyCard>
                ))}
              </Section>
            )}

            {data.bids.length > 0 && (
              <Section
                title="Bids"
                subtitle="Blind bids are final — no takebacks."
                icon={<Sparkles className="h-4 w-4 text-tangerine-foreground" />}
              >
                {data.bids.map((item) => (
                  <MyCard
                    key={item.id}
                    item={item}
                    badge={
                      <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1 text-[11px] font-medium text-background">
                        You bid ¥{item.my_bid_amount}
                      </span>
                    }
                  >
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                      <Lock className="h-3 w-3" strokeWidth={2.5} />
                      Final
                    </span>
                  </MyCard>
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-display text-2xl italic text-foreground">{title}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function MyCard({
  item,
  badge,
  children,
}: {
  item: { id: string; title: string; photo_signed_url: string; category: string };
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-border bg-card p-3">
      <Link
        to="/items/$itemId"
        params={{ itemId: item.id }}
        className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-muted"
      >
        {item.photo_signed_url ? (
          <img
            src={item.photo_signed_url}
            alt={item.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to="/items/$itemId"
          params={{ itemId: item.id }}
          className="block truncate font-display text-lg italic text-foreground hover:opacity-80"
        >
          {item.title}
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
            {categoryLabel(item.category)}
          </span>
          {badge}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function EmptyBag() {
  return (
    <div className="mt-12 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-butter">
        <ShoppingBag className="h-6 w-6 text-butter-foreground" />
      </div>
      <h2 className="font-display text-2xl italic text-foreground">Nothing yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Claim something free or place a bid — it'll show up here.
      </p>
      <Link
        to="/feed"
        className="mt-4 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90"
      >
        Back to the sale
      </Link>
    </div>
  );
}

export type { MyStuff };
