## 1. Password-gate the Admin menu on the feed

In `src/routes/_authenticated.feed.tsx`, the Admin dropdown currently renders whenever `admin?.isAdmin` is true. Add a second gate: a client-side session flag (`sessionStorage.getItem("adminUnlocked") === "1"`) that must also be true.

- If `isAdmin` is true but not unlocked → show a small "Admin 🔒" pill that opens a shadcn `Dialog` with a password `Input` (masked, `inputMode="numeric"`).
- Correct password `080808` → set `sessionStorage.adminUnlocked = "1"`, close dialog, reveal the real dropdown (Add item / Results / Lock).
- Wrong password → toast error, clear field.
- Add a "Lock admin" item at the bottom of the dropdown that clears the flag.
- Non-admins (server `isAdmin` returns false) see nothing, unchanged.

Note this is a UX gate on top of the existing role check — the server still enforces admin via `has_role` on every mutation, so the password is not a security boundary, just a "don't hand my phone to a friend" guard. The literal `080808` will live in the client bundle; that is acceptable for a friends-and-family sale but I'll flag it in the reply.

**File:** `src/routes/_authenticated.feed.tsx` only.

## 2. Test the admin results page

Once the plan is approved and I'm in build mode, I'll drive the live preview with Playwright as admin (Ashling's session is already injected):

1. Navigate to `/admin/results`.
2. Screenshot the page.
3. Verify: winning bidders per auction item render, free-claim list renders, no console errors, no failed network requests to `listResults` / whichever server fn backs it.
4. Read `src/routes/_authenticated.admin.results.tsx` + the server fn it calls first to know what "correct" looks like before asserting.

I'll report what I see with the screenshot.

## 3. Test claim / unclaim ownership rule

The rule is enforced in the DB function `unclaim_free_item` (`WHERE claimed_by = auth.uid()` + `RAISE EXCEPTION` otherwise) — I'll verify end-to-end:

1. As current user (Ashling), find a free item on `/feed`, open detail, click Claim. Screenshot: status flips to claimed by Ashling.
2. Click Unclaim on the same item. Screenshot: item returns to available. ✅ same user can unclaim.
3. Re-claim it as Ashling, then simulate a second user by signing out and signing in with a different name+phone via `/auth`, navigate to the same item, and confirm the Unclaim button is not offered (or if it is, that clicking it surfaces the "You can only unclaim items you claimed yourself" error and item stays claimed). ✅ other user cannot unclaim.
4. Sign back in as Ashling and unclaim to leave state clean.

If step 3 shows the Unclaim button is even rendered for a non-claimer, that's a UI bug I'll call out (server still blocks it, but the button shouldn't be there) — fix would be a one-line guard in `_authenticated.items.$itemId.tsx`. I won't change it in this turn unless you want me to.

## Deliverables

- One code change: password gate on the Admin dropdown.
- Two test reports with screenshots: admin results page, and claim/unclaim ownership.

## Technical details

- Password check is a plain string compare in the component; stored unlock flag in `sessionStorage` so it clears when the tab closes.
- No DB, no server function, no migration.
- Playwright scripts land under `/tmp/browser/` per the browser-use rules; I'll restore Ashling's Supabase session from the injected env before navigating.
