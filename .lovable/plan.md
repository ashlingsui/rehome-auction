## Surface the Admin entry point

### Diagnosis
The feed header already renders an **Admin** link in the top-right (and again in the empty state) whenever the signed-in user has the `admin` role — see `src/routes/_authenticated.feed.tsx` (`{admin?.isAdmin && <Link to="/admin">…}`). Right now the database has:

- **Camille** — admin
- **Ashling** — user (no admin role)

If you're signed in as Ashling, the link is intentionally hidden. Nothing to build UI-side — the entry point exists.

### Fix
Grant Ashling the `admin` role via a one-row insert into `user_roles`. After that, the Admin link will show in the feed header on next load, and `/admin` + `/admin/results` will be reachable.

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('8b926d18-0318-4d14-8db2-7a61c7de342b', 'admin')
ON CONFLICT DO NOTHING;
```

### Out of scope
- No new UI, no new route, no additional nav placement — the existing header link is the intended access point for a private friends-only app.
- If you'd rather this be Camille and not Ashling, say the word and I'll promote the other account instead (or both).
