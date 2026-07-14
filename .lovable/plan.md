# Plan: Online presence + sale start time

## 1. Online presence indicator (Google Drive style)

Add a small stack of avatars + count in the Feed header showing everyone currently viewing the sale, using Supabase Realtime **presence** (no DB writes, no new tables).

- New `src/components/OnlinePresence.tsx`:
  - Joins a shared `sale-presence` channel on mount, tracks `{ user_id, name, joined_at }` from the current session + profile name.
  - Listens to `presence` `sync` events, dedupes by `user_id`, renders up to 3 colored initials-circles + a "+N" chip if more, plus a green dot and tooltip listing names.
  - Untracks + removes channel on unmount.
- Mount it in `src/routes/_authenticated.feed.tsx` header, left of the Admin button.
- No schema changes. Presence is ephemeral and free.

Optional: also show it on the item detail page (`_authenticated.items.$itemId.tsx`) using the same channel so people see "3 others looking now". I'll include it on Feed only unless you want it on item pages too.

## 2. Sale start time + "not started yet" gate

### Schema
Migration adds a start timestamp to `sale_settings`:
```
ALTER TABLE public.sale_settings
  ADD COLUMN auction_starts_at timestamptz NOT NULL DEFAULT now();
UPDATE public.sale_settings
  SET auction_starts_at = '2026-07-15 00:00:00+00'   -- tonight midnight, user's local tz applied at write time
  WHERE id = true;
```
I'll write the UPDATE using the user's local midnight (Europe-ish assumption from context — confirm below if you want a specific timezone). Since I don't know your timezone for sure, I'll set it via the Admin UI rather than hardcoding — see below.

### Server enforcement (so it's not just a UI lock)
Update these DB functions to also reject before `auction_starts_at`:
- `claim_free_item` — raise "The sale has not started yet."
- `unclaim_free_item` — same guard.
- Bids: add a `BEFORE INSERT` trigger on `public.bids` (or a check in an RPC) that rejects when `now() < auction_starts_at`. Current bid insert is a direct table insert via RLS, so a trigger is the clean place.

### Server functions
- `getSaleSettings` returns `auction_starts_at` too.
- New `updateSaleStartsAt` admin server fn (mirrors `updateSaleEndsAt`).

### UI
- **Full-page "Not started" overlay** in `_authenticated.feed.tsx` and `_authenticated.items.$itemId.tsx`:
  - Fixed inset overlay with backdrop blur, large countdown to `auction_starts_at`, headline "The sale opens at {date, time}", subtext "Bids and claims unlock when the timer hits zero."
  - Header + browsing still visible faintly behind, but the overlay blocks interaction (pointer-events on).
  - Admins can dismiss with a small "Preview as admin" link (client-side only; server still blocks non-admin writes).
- **CountdownChip** switches modes: before start → "Opens in Xd Yh Zm"; between start and end → "Closes in …"; after end → "Closed".
- **Admin dashboard** (`_authenticated.admin.tsx`) gains a "Start time" datetime-local input next to the existing end-time control, using `updateSaleStartsAt`.

## Technical notes
- Presence uses `supabase.channel('sale-presence', { config: { presence: { key: userId } } })`; single channel shared across the app is fine.
- Overlay computes `hasStarted = now >= auction_starts_at` from the same `saleQuery` used by `CountdownChip`, refreshed each second via a local `useEffect` interval (same pattern already in the codebase).
- All admin writes remain gated by `has_role(auth.uid(),'admin')` server-side.

## Out of scope
- Persisting who visited when (analytics) — presence is live-only.
- Emailing users when the sale opens.
- Timezone picker; you'll set the start time via the admin UI in your own browser's local time.

## Confirm before I build
- Presence on item detail pages too, or Feed only?
- Should I set tonight's midnight in a migration (I'll assume your browser's local tz via a one-off `INSERT`) or leave you to pick it in the new admin field on first load?
