## Test plan: bidding + admin results

**Current state**
- Sale window: opens today 16:00 UTC, closes 2026-07-17 16:00 UTC. Right now (≈06:40 UTC) the sale has NOT started, so `placeBid`/`claim_free_item` will throw "The sale has not started yet."
- One existing bid on "St. Louis Champagne Glass"; all other auction items have 0 bids.
- Admin Results page (`/admin/results`) already supports live peeking pre-close ("Active auctions" tab), so no code changes needed to see bids before the sale ends.

**Approach**

1. Temporarily move `sale_settings.auction_starts_at` to 1 minute ago so the bid window is open (leave `auction_ends_at` untouched). Record the original value.
2. Drive the live preview with Playwright as the currently signed-in preview user:
   - Go to `/feed`, open an auction item that has no existing bid from this user.
   - Submit a bid via the bottom bar, screenshot the "Bid Locked In" state.
   - Verify via SQL that a new row landed in `bids` with the right amount + user_id.
3. Navigate to `/admin/results` (requires admin role on the preview user):
   - Confirm "Active auctions" tab shows the item with winning amount, bidder name/phone, and bid count.
   - Screenshot for evidence.
4. Restore `auction_starts_at` to the original timestamp.
5. Report: screenshots + observed bid row + admin row.

**One thing I need from you**

The preview user must be an admin for step 3. If you're already signed in as the admin on the preview (looks like you are on `/feed`), I'll use that session. If not, tell me and I'll stop after step 2.

Also confirm: OK to (a) briefly open the sale window as described, and (b) leave one real test bid in the DB — or would you rather I delete the test bid at the end?