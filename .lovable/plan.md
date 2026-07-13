
# Moving Sale & Silent Auction — Build Plan

A mobile-first, chic web app for rehoming your stuff: silent auctions + first-come-first-grab free items, with an AI-assisted admin upload flow.

## 1. Design system

- Off-white background (`#FAF8F5`), deep ink text.
- Pastel accents: matcha green, soft tangerine, lilac, butter yellow — used for category pills and CTAs.
- Typography: modern geometric sans (e.g. Space Grotesk for display, Inter for body) loaded via `<link>` in `__root.tsx`.
- Large rounded image cards (2xl radius), generous whitespace, no heavy shadows — subtle 1px borders + soft blur only.
- All colors/gradients as semantic tokens in `src/styles.css` (`@theme` + `:root`). No hardcoded hex in components.

## 2. Backend (Lovable Cloud)

Enable Lovable Cloud. Schema:

- `profiles` — `id (uuid, = auth.users.id)`, `name`, `phone`, `created_at`.
- `items` — `id`, `title`, `photo_url`, `category` (enum: bedroom, kitchen, living_room, bathroom, decor, wardrobe, other), `type` (enum: auction, free), `description`, `starting_price` (nullable, auction only), `status` (available/claimed), `claimed_by` (uuid nullable), `created_at`.
- `bids` — `id`, `item_id`, `user_id`, `amount`, `created_at`. **Unique(item_id, user_id)** to enforce one bid per user per item.
- `user_roles` + `app_role` enum (`admin`, `user`) + `has_role()` security-definer function (per user-roles convention). You get seeded as admin via a migration referencing your phone/email.

Storage: `item-photos` public bucket for uploaded images.

RLS:
- `profiles`: user reads/updates own; everyone authenticated can read name (needed for "Claimed by X" overlay).
- `items`: authenticated read all; only admins insert/update/delete. Claim performed via server function (atomic).
- `bids`: authenticated insert own; **no SELECT for regular users** (keeps auction blind). Admin selects all. A `bid_counts` view or RPC returns only `item_id → count` for social proof.
- `user_roles`: read own; admin manages.

GRANTs added for every public table per Supabase Data API rules.

## 3. Auth

Simple sign-up: Name + Phone Number. Uses Supabase phone-less flow — since Supabase auth requires an identifier, we'll use **email OTP-style with phone as the login handle** by synthesizing `${phone}@moving.local` as the auth email plus a random-generated password stored client-side… actually cleaner: use **Supabase phone auth with OTP** (SMS) if you want real verification, OR a lightweight custom flow where phone is the unique key and we sign in via magic-link-less password derived from phone (not secure enough).

**Recommendation:** ask you to confirm — see clarifying question below. Default plan assumes **phone OTP via Supabase** since it fits the "just name + phone" UX.

Routes:
- `/auth` — public sign-in / sign-up (name + phone → OTP).
- `/_authenticated/*` — protected subtree (feed, item detail, admin).

## 4. Routes & screens

- `/` (public landing → redirects to `/feed` if signed in, else `/auth`).
- `/auth` — chic single-screen form.
- `/_authenticated/feed` — home feed. Masonry grid of items. Sticky top bar with category pills + Auction/Free toggle.
- `/_authenticated/items/$itemId` — detail view; branches by `type`:
  - Auction: image, description, "🔥 X friends have placed a bid" indicator, bid input + Submit. After submit → "Bid Locked In" disabled state.
  - Free: image, description, giant "Claim It!" button. Once claimed → "Claimed by [Name]" overlay.
- `/_authenticated/admin` — admin-only (via `has_role`). Upload form: photo, title, category, type, optional starting price, description w/ ✨ AI generate button, Publish.
- `/_authenticated/admin/items` — list of your items, mark sold, view bids per item (admin-only reveal of bids after the sale).

## 5. Core interactions

**Auction bid** (`placeBid` server fn, `requireSupabaseAuth`):
- Insert into `bids`. Unique constraint prevents second bid → surface friendly error.
- Return only success/failure; never return other bids.

**Bid count** (`getBidCount` server fn, or public RPC): returns `{count}` per item. Called on detail view.

**Claim free item** (`claimItem` server fn):
- Atomic `UPDATE items SET status='claimed', claimed_by=auth.uid() WHERE id=? AND status='available'` returning row.
- If no row updated → item already claimed; show state.
- Realtime channel on `items` table so feed updates live.

**Realtime**: Supabase realtime on `items` (status changes) + `bids` (count increments) so the feed and detail views feel alive.

## 6. AI admin assistant

Server fn `generateItemDescription({ title, photoUrl })`:
- Calls Lovable AI Gateway via AI SDK, model `google/gemini-3-flash-preview` (vision-capable, fast, cheap).
- Multimodal message: text prompt + `image_url` block pointing at uploaded photo (signed URL from storage).
- System prompt: "You are a chic interior design copywriter…" per your spec. Returns 2 sentences.
- Client shows loading state on ✨ button, populates description textarea, remains editable.

## 7. Tech details

- Stack: TanStack Start (existing), Tailwind v4, shadcn components, Supabase via Lovable Cloud.
- Server functions in `src/lib/*.functions.ts` with `requireSupabaseAuth`. Admin-only functions check `has_role(userId, 'admin')` inside handler.
- Image upload: client → Supabase Storage → public URL → saved in `items.photo_url`.
- Bid privacy is enforced at the RLS layer (regular users cannot SELECT bids), not just in the UI.

## 8. Phasing

1. Enable Cloud, migrations, auth screen, seed admin role.
2. Feed + item detail + bidding + claiming with realtime.
3. Admin upload form.
4. AI description generation.
5. Polish: empty states, toast feedback, animations on card hover/press.

---

## One clarification before I build

**Auth method for phone-only sign-up:** Supabase requires *something* verifiable. Two options:

- **A. Phone OTP (SMS):** real verification, needs a Twilio (or similar) SMS provider configured in Supabase. Most legit, but adds a setup step.
- **B. Name + phone, no verification:** treat phone as a unique handle, auto-create an account with a synthetic email (`{phone}@moving.local`) and a random password stored in a cookie so they stay signed in on that device. Frictionless for friends, but anyone with a phone number could impersonate.

I'll ask this as a follow-up question after you approve the plan. Default I'd build: **B** (frictionless, matches the "sign up with just name and phone" vibe for a private friends-only event).
