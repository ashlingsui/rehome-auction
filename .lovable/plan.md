## Goal

Give each signed-in user a personal "My Stuff" view where they can see everything they've claimed (free items) and everything they've bid on (auction items), plus the ability to unclaim a free item so someone else can grab it. Auction bids remain final — no cancel.

## New route

`src/routes/_authenticated.my.tsx` → `/my`

Two sections:
- **Claimed** — free items where `claimed_by = me`. Each row has an "Unclaim" button (with confirm).
- **Bids** — auction items where I have a bid, showing the amount I bid. No cancel button; small note "Bids are final".

Empty state when both are empty: "Nothing yet — head back to the sale."

Header link from `/feed` (a small bag/cart icon next to the admin/sign-out buttons) pointing to `/my`.

## Server functions (`src/lib/items.functions.ts`)

- `listMyStuff` — auth-required. Returns `{ claimed: FeedItem[]; bids: (FeedItem & { my_bid_amount: number })[] }`. Runs two queries scoped to `userId`, joins with `items`, signs photos.
- `unclaimItem` — auth-required. Calls a new SECURITY DEFINER SQL function `unclaim_free_item(_item_id)` that:
  - checks the sale hasn't closed
  - verifies the row is `type='free'`, `status='claimed'`, `claimed_by = auth.uid()`
  - sets `status='available'`, `claimed_by=null`
  - raises if any check fails

Auction bids: no server function to cancel. The UI does not offer it.

## Migration

Add function `public.unclaim_free_item(_item_id uuid)` mirroring the existing `claim_free_item` shape (SECURITY DEFINER, `search_path=public`, respects sale end time, only lets the current claimant release their own item). Existing RLS on `items` already blocks direct client updates, so the SECURITY DEFINER function is the only path.

## UI details

- Card layout matches the feed's square thumbnail style so it feels consistent.
- Each card shows title, thumbnail, category chip, and either "Claimed" badge + Unclaim button, or "You bid ¥X" badge.
- Unclaim triggers a `useMutation`, invalidates `["items"]`, `["item", id]`, and `["my-stuff"]`.
- Live refresh: subscribe to `items` + `bids` changes and invalidate `["my-stuff"]`.
- After the sale ends (countdown expired), hide the Unclaim button — final state is locked.

## Technical notes

- Query key: `["my-stuff"]`. Loader primes with `ensureQueryData`, component uses `useSuspenseQuery`.
- Reuse `signPhotos` helper already in `items.functions.ts`.
- Add `Bag` / `ShoppingBag` lucide icon import on the feed header.
