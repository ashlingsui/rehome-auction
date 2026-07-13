## Goal

Right now the "Admin" pill on the Feed header (top-right, next to the shopping bag and sign-out icons) is a small, muted button with a lock icon — easy to miss. Only users whose account has the admin role in the database ever see it. This plan makes it more obvious for those admins, without exposing it to regular guests.

## What changes

On `/feed`, for users who are admins (i.e. `isAdmin` returns true):

1. **Bigger, higher-contrast pill.** Swap the current bordered/muted style for the app's primary "foreground on background" pill (same treatment as the unlocked Admin dropdown) so it stands out against the muted header icons.
2. **Clearer label + icon.** Use a shield icon and the label "Admin · Unlock" when locked, and keep "Admin" with the shield when unlocked. The lock icon becomes a small badge only.
3. **Move it to the far right, before the icons**, and give it a subtle attention treatment on first mount for that session (a one-time soft pulse ring) so admins notice it after signing in. The pulse fades after ~3s and never runs again in the same tab.
4. **A tiny helper caption** ("Host tools") under the header title when the user is an admin and hasn't unlocked yet, pointing to the button. Hidden once unlocked or once the session's already been unlocked before.

Non-admins see no change — they never render this button at all.

## Out of scope

- No change to the password (`080808`) or the unlock storage mechanism.
- No change to who counts as admin (still driven by `user_roles` + the auto-admin trigger for the first user).
- No change to the admin dropdown contents once unlocked.

## Technical notes

- File touched: `src/routes/_authenticated.feed.tsx` only.
- `AdminMenu` gets a new "locked" visual variant (primary pill + shield + "Admin · Unlock" text) and reuses the existing dialog + `submitPw` logic untouched.
- The one-time pulse uses a `useEffect` + `sessionStorage` flag (e.g. `adminPulseShown`) so it only animates once per tab, and only when locked.
- The "Host tools" caption renders inside the existing header title block, gated on `admin?.isAdmin && !unlocked`. To read `unlocked` from the parent we'll either hoist the unlocked state into `FeedPage` or expose it via a tiny context — hoisting is simpler and keeps the component tree flat.
- No new deps, no DB or server-function changes, no route changes.
