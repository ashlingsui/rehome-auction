Three small, front-end-only changes.

## 1) Admin menu on the feed

In `src/routes/_authenticated.feed.tsx`, replace the single "Add" pill (visible to admins) with a small **Admin** dropdown menu (shadcn `DropdownMenu`) shown only when `admin?.isAdmin`. Items:

- **Add item** → `/admin`
- **Results** → `/admin/results`

The trigger is a compact pill labelled "Admin" with a chevron, matching the existing header style. Non-admins see no change.

## 2) Why the Edit button appeared missing

The item detail page already renders an **Edit** pill (top-right of the sticky header) when `isAdmin()` returns true. The reason it looked missing: the global **CountdownChip** is `position: fixed` at `top-4 right-4` on `/items/*` routes and sits directly on top of the Edit pill, hiding it — especially at phone widths. Fixing #3 below uncovers the Edit button. No logic change is needed for #2.

## 3) Reposition the countdown to the top of the page

Convert the countdown from a floating fixed chip into an inline banner that sits at the very top of the page on every route.

- `src/components/CountdownChip.tsx`: remove all `fixed` / `bottom-*` / `top-*` positioning and `useLocation` branching. Render a full-width, centered strip:
  - Slim bar, `border-b border-border/70 bg-background/90 backdrop-blur`, one line: `Closes in · 2d 04h 12m` (or `Sale · Closed`).
  - Semantic HTML, `aria-live="polite"` preserved.
- `src/routes/__root.tsx` (or wherever `CountdownChip` is currently mounted): keep it mounted once, but place it as the first child of the app shell so it appears above every page's header.
- Adjust the feed header's `sticky top-0` and the item-detail sticky back-bar so they sit *below* the countdown banner (either drop `sticky` from these on small screens or let the banner scroll away — recommend: banner is a normal (non-sticky) top strip so it doesn't compete with the sticky headers). This removes overlap with the Edit pill and the bottom bid bar on mobile.

## Files touched

- `src/routes/_authenticated.feed.tsx` — replace Add pill with Admin dropdown (Add item, Results).
- `src/components/CountdownChip.tsx` — inline top banner instead of fixed chip.
- `src/routes/__root.tsx` — mount `CountdownChip` at the top of the shell (if not already there in a way that supports this).

No database, server-function, or business-logic changes.
