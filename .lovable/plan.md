## Admin Auction Results Dashboard

A private results view at `/admin/results`, linked from `/admin` (admin-only, gated by the existing `has_role('admin')` check — same pattern as the current admin page). Same off-white editorial aesthetic.

### Data (new server fn in `src/lib/admin.functions.ts`)

`getAuctionResults` — admin-only, returns three lists:

1. **Auction winners** — for every auction item, the highest bid (if any), joined with the bidder's profile:
   `{ item_id, title, photo_signed_url, status: 'active' | 'closed', winning_amount, winner_name, winner_phone, bid_count }`
   - "closed" = `now() >= sale_settings.auction_ends_at`; "active" otherwise (same flag for all items — global timer).
   - Items with zero bids are included with `winning_amount: null` so I can see gaps.
2. **Claimed free items** — every `type='free' AND status='claimed'` row joined with claimer profile:
   `{ item_id, title, photo_signed_url, claimer_name, claimer_phone }`.
3. `sale_closed: boolean` for the header copy.

Implementation reuses `has_role` admin check + signed photo URLs (1h). Bidder/claimer names+phones read directly from `profiles` (admin bypasses via server fn; RLS already lets any authenticated user read profiles).

### UI — `src/routes/_authenticated.admin.results.tsx`

- Back link → `/admin`.
- Header: "Results" title, small subtitle showing "Sale closes in…" or "Sale closed".
- Three pill tabs (matches existing pill styling in admin.tsx category chips): **Active auctions · Closed auctions · Claimed free items**.
  - Before expiry: default to "Active auctions"; "Closed auctions" tab is present but shows an empty state "Results appear when the countdown ends".
  - After expiry: default to "Closed auctions".
- Auction rows (editorial list, not a table): 64px rounded thumbnail · title + bid count caption · winner name + phone · price in Fraunces italic on the right. Rows separated by hairline borders on the off-white card.
- "No bids yet" state for items with zero bids in the active/closed lists.
- Free items rows: thumbnail · title · claimer name · phone (tappable `tel:` link).
- TanStack Query 30s stale for active tab; realtime not needed (auto-refetch on tab focus).

### Admin page link

Add a small "View results →" link in `/admin` near the "Sale timer" card so I can jump in without knowing the URL.

### Security

- Route uses `ssr: false` and the same `isAdmin` client-side check + redirect fallback that `/admin` already uses. The server fn re-checks `has_role('admin')`, so a non-admin who guesses the URL sees the "Just for the host" fallback and can't fetch data.
- No new tables, no migration.

### Files

- New: `src/routes/_authenticated.admin.results.tsx`
- Edit: `src/lib/admin.functions.ts` (add `getAuctionResults`), `src/routes/_authenticated.admin.tsx` (add link)

### Out of scope

- Passcode gate (admin role is already the gate).
- Exporting CSV / marking winners as notified.
- Per-user bid history.
