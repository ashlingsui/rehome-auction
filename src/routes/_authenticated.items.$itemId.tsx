import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getItem, placeBid, claimItem, isAdmin } from "@/lib/items.functions";
import { deleteItem } from "@/lib/admin.functions";
import { saleQuery } from "@/components/CountdownChip";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Lock, Gift, DollarSign, Pencil, Trash2 } from "lucide-react";
import { categoryLabel } from "@/lib/categories";

const itemQuery = (id: string) =>
  queryOptions({
    queryKey: ["item", id],
    queryFn: () => getItem({ data: { id } }),
    staleTime: 5_000,
  });

export const Route = createFileRoute("/_authenticated/items/$itemId")({
  ssr: false,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(itemQuery(params.itemId)),
  component: ItemDetail,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
});

function ItemDetail() {
  const { itemId } = Route.useParams();
  const { data: item } = useSuspenseQuery(itemQuery(itemId));
  const { data: sale } = useQuery(saleQuery);
  const { data: adminCheck } = useQuery({ queryKey: ["is-admin"], queryFn: () => isAdmin() });
  const qc = useQueryClient();
  const navigate = useNavigate();

  const placeBidFn = useServerFn(placeBid);
  const claimItemFn = useServerFn(claimItem);
  const deleteItemFn = useServerFn(deleteItem);


  const [bidAmount, setBidAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const expired = !!sale && new Date(sale.auction_ends_at).getTime() <= nowMs;

  // Live refresh on updates to this item / bids
  useEffect(() => {
    const ch = supabase
      .channel(`item-${itemId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items", filter: `id=eq.${itemId}` },
        () => qc.invalidateQueries({ queryKey: ["item", itemId] }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bids", filter: `item_id=eq.${itemId}` },
        () => qc.invalidateQueries({ queryKey: ["item", itemId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [itemId, qc]);

  async function onBid(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(bidAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a real number.");
      return;
    }
    if (item.starting_price && amt < item.starting_price) {
      toast.error(`Minimum bid is ¥${item.starting_price}.`);
      return;
    }

    setSubmitting(true);
    try {
      await placeBidFn({ data: { item_id: item.id, amount: amt } });
      toast.success("Bid locked in ✨");
      qc.invalidateQueries({ queryKey: ["item", itemId] });
      qc.invalidateQueries({ queryKey: ["items"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onClaim() {
    setSubmitting(true);
    try {
      await claimItemFn({ data: { item_id: item.id } });
      toast.success("Yours! 🎁");
      qc.invalidateQueries({ queryKey: ["item", itemId] });
      qc.invalidateQueries({ queryKey: ["items"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const claimed = item.status === "claimed";

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Sticky back */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-gradient-to-b from-background via-background/90 to-transparent p-4">
        <button
          onClick={() => navigate({ to: "/feed" })}
          className="inline-flex h-10 items-center gap-1 rounded-full border border-border bg-background/90 px-3 text-sm font-medium text-foreground shadow-sm backdrop-blur hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sale
        </button>
        {adminCheck?.isAdmin && (
          <Link
            to="/admin/items/$itemId/edit"
            params={{ itemId }}
            className="inline-flex h-10 items-center gap-1 rounded-full border border-border bg-background/90 px-3 text-sm font-medium text-foreground shadow-sm backdrop-blur hover:bg-muted"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
        )}
      </div>

      <div className="mx-auto max-w-2xl px-5">
        {/* Photo */}
        <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card">
          {item.photo_signed_url && (
            <img
              src={item.photo_signed_url}
              alt={item.title}
              className="aspect-[4/5] w-full object-cover"
            />
          )}
          {claimed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/70 text-background backdrop-blur-sm">
              <div className="mb-2 text-[10px] uppercase tracking-[0.3em] opacity-80">
                Claimed
              </div>
              <div className="font-display text-4xl italic">
                by {item.claimed_by_name ?? "a friend"}
              </div>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="mt-6 flex items-center gap-2">
          <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {categoryLabel(item.category)}
          </span>
          {item.type === "auction" ? (
            <span className="rounded-full bg-lilac px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-lilac-foreground">
              Silent Auction
            </span>
          ) : (
            <span className="rounded-full bg-matcha px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-matcha-foreground">
              Free to a Friend
            </span>
          )}
        </div>

        <h1 className="mt-3 font-display text-4xl italic leading-tight text-foreground">
          {item.title}
        </h1>
        {item.description && (
          <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-muted-foreground">
            {item.description}
          </p>
        )}

        {item.type === "auction" && item.starting_price && !claimed && (
          <div className="mt-4 text-sm text-muted-foreground">
            Bidding opens at{" "}
            <span className="font-medium text-foreground">¥{item.starting_price}</span>.
          </div>
        )}


        {/* Social proof for auction */}
        {item.type === "auction" && !claimed && (
          <div className="mt-6 rounded-2xl border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-tangerine-foreground" />
              {item.bid_count === 0 ? (
                <span>Be the first to bid.</span>
              ) : (
                <span>
                  <span className="font-medium text-foreground">
                    {item.bid_count} friend{item.bid_count === 1 ? "" : "s"}
                  </span>{" "}
                  {item.bid_count === 1 ? "has" : "have"} placed a bid.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom action */}
      {!claimed && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 px-5 py-4 backdrop-blur-lg">
          <div className="mx-auto max-w-2xl">
            {expired ? (
              <Button
                disabled
                className="h-14 w-full rounded-2xl bg-muted text-base font-medium text-muted-foreground"
              >
                <Lock className="mr-2 h-4 w-4" />
                {item.type === "auction" ? "Auction Closed" : "Sale Closed"}
              </Button>
            ) : item.type === "auction" ? (
              item.user_has_bid ? (
                <Button
                  disabled
                  className="h-14 w-full rounded-2xl bg-muted text-base font-medium text-muted-foreground"
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Bid Locked In
                </Button>
              ) : (
                <form onSubmit={onBid} className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-medium text-muted-foreground">
                      ¥
                    </span>
                    <Input
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      type="number"
                      inputMode="decimal"
                      min={item.starting_price ?? 1}
                      step="1"
                      placeholder="Your blind bid"
                      className="h-14 rounded-2xl border-border bg-background pl-9 text-base"

                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={submitting || !bidAmount}
                    className="h-14 rounded-2xl bg-foreground px-6 text-base font-medium text-background hover:opacity-90"
                  >
                    Bid
                  </Button>
                </form>
              )
            ) : (
              <Button
                onClick={onClaim}
                disabled={submitting}
                className="h-14 w-full rounded-2xl bg-matcha text-base font-semibold text-matcha-foreground hover:opacity-90"
              >
                <Gift className="mr-2 h-5 w-5" />
                Claim It!
              </Button>
            )}
            {!expired && item.type === "auction" && !item.user_has_bid && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                One bid per person · Blind auction · No takebacks
              </p>
            )}
          </div>
        </div>
      )}

      {claimed && item.type === "free" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 px-5 py-4 backdrop-blur-lg">
          <div className="mx-auto max-w-2xl text-center text-sm text-muted-foreground">
            Snapped up by {item.claimed_by_name ?? "someone quick"}.{" "}
            <Link to="/feed" className="font-medium text-foreground underline">
              See what else is left →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
