## Grant admin role to "Ashling"

Find the profile whose name matches `Ashling` (case-insensitive) and insert an `admin` row into `public.user_roles` for that user's id, if not already present.

### Steps
1. Look up the user: `SELECT id, name FROM profiles WHERE lower(name) = 'ashling'` to confirm exactly one match. If none, stop and report back so you can share the exact name/spelling used at sign-up. If multiple, list them so you can pick.
2. Insert the admin role:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   SELECT id, 'admin'::app_role FROM public.profiles WHERE lower(name) = 'ashling'
   ON CONFLICT (user_id, role) DO NOTHING;
   ```
3. Verify: re-query `user_roles` joined with `profiles` to confirm Ashling now has `admin`.

### Notes
- No code or schema changes. Data-only change via the insert tool.
- After this, Ashling will see the Admin button on `/feed` and can unlock with passcode `080808`.
