## Goal
Let users browse items behind the "sale opens in…" overlay before the countdown ends. Bidding/claiming stay locked (already enforced server-side and by the "Closed"/action logic).

## Changes
Single file: `src/components/NotStartedOverlay.tsx`.

1. Drop the full-screen dim + blur backdrop. Replace the `fixed inset-0 … bg-foreground/40 backdrop-blur-md` wrapper with a non-blocking container that only occupies the centered card area:
   - `fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pointer-events-none` (or top-anchored under header if preferred — will use bottom-center so it doesn't cover the sticky header).
   - Inner card keeps `pointer-events-auto` so it stays interactive.
2. Shrink the card slightly (max-w-sm, tighter padding) so more of the grid shows.
3. Add a small close/"Browse anyway" button for **everyone** (not just admins) — reuses existing `dismissed` state. Admin bypass label can be removed since the button is now universal.
4. Keep the countdown ticking; when it reaches 0 the component still returns null.

## Result
- Feed grid renders normally with items visible and scrollable.
- Floating countdown card sits at the bottom center with a dismiss control.
- No functional change to bidding/claiming gating.
