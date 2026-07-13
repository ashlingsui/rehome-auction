
# Global Countdown Timer

## What we're building

A single global "auction closes at" timestamp, set by the admin in the app, displayed as a floating chip in the bottom-right corner of the authenticated screens. When it hits zero, all auction bidding and all free-item claiming are locked — both in the UI and enforced server-side.

## Data model

New table `public.sale_settings` — a single-row settings table for the moving sale.

- Columns: `id` (fixed constant so only one row can exist), `auction_ends_at` (timestamptz), `updated_at`.
- Readable by any authenticated user.
- Only admins can update (via `has_role`).
- Row initialized in the migration with `auction_ends_at = now() + 48 hours` so the timer is live immediately; admin can change it anytime.

Server-side enforcement (so the timer is real, not just cosmetic):

- `place_bid` path and `claim_free_item` RPC updated to raise an error when `now() >= auction_ends_at`. Errors surface as friendly toasts ("The sale has closed.").

## Server functions

In `src/lib/items.functions.ts` (or a new `src/lib/sale.functions.ts`):

- `getSaleSettings` — returns `{ auction_ends_at }`. Used by feed, detail, and admin.
- `updateSaleEndsAt({ endsAt })` — admin-only (checks `has_role`), updates the row.

`placeBid` handler adds a pre-check reading `auction_ends_at`; returns a clear "Sale closed" error if expired. `claim_free_item` gets the same guard inside the SQL function.

## UI

### Floating chip (new component `src/components/CountdownChip.tsx`)

- Fixed `bottom-5 right-5`, small pill: soft off-white background, 1px border, subtle backdrop blur, Fraunces italic for the number, Space Grotesk caption above.
- Two lines: caption `Auction closes in` / value `2d 04h 37m` (drops to `04h 37m 12s` under 1 day, `MM:SS` under an hour).
- Ticks every 1s via `setInterval`; source of truth is `auction_ends_at` fetched once via TanStack Query (5 min stale) so we don't hit the server every second.
- Expired state: chip switches to muted tone reading `Sale closed`.
- Rendered inside `_authenticated` layout so it appears on feed, item detail, and admin — not on `/auth`.
- Hidden on very small screens? No — kept visible, but sized so it never overlaps the fixed bottom action bar on item detail (chip sits above the action bar with safe spacing, or shifts to top-right on the item-detail route where a bottom bar exists). Simpler rule: on `_authenticated/items/$itemId`, render chip top-right; elsewhere, bottom-right.

### Item detail (`_authenticated.items.$itemId.tsx`)

When `now >= auction_ends_at`:

- Auction items: hide the bid input, replace with a disabled button reading `Auction Closed`. Bid-count social proof line stays visible.
- Free items: hide `Claim It!`, show disabled `Sale Closed`.
- Already-claimed items keep their existing "Claimed by X" overlay.

### Feed (`_authenticated.feed.tsx`)

- Add a small `Closed` tag on cards when expired (keeps browsing intact but signals nothing is grabbable).

### Admin (`_authenticated.admin.tsx`)

- New "Sale timer" card at the top: shows current end time, a datetime-local input, and a Save button. Uses `updateSaleEndsAt`. Optimistically updates cached settings.

## Realtime

Enable realtime on `sale_settings` so when admin edits the end time on their phone, everyone else's chip updates without a refresh. Subscribe inside `CountdownChip` and invalidate the settings query on change.

## Files touched

- New migration: create `sale_settings` table + GRANTs + RLS + policies, seed the single row, update `claim_free_item` to check expiry, add expiry check helper.
- New: `src/lib/sale.functions.ts` (`getSaleSettings`, `updateSaleEndsAt`).
- New: `src/components/CountdownChip.tsx`.
- Edit: `src/lib/items.functions.ts` — expiry guard in `placeBid`.
- Edit: `src/routes/_authenticated.tsx` — mount `<CountdownChip />`.
- Edit: `src/routes/_authenticated.items.$itemId.tsx` — closed-state UI.
- Edit: `src/routes/_authenticated.feed.tsx` — closed tag on cards.
- Edit: `src/routes/_authenticated.admin.tsx` — sale-timer card.

## Out of scope

- Notifying users at close (no emails/SMS).
- Auto-picking auction winners — bids stay visible to admin as before; you announce winners manually.
