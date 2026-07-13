import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PASSCODE = z.string().min(4).max(64);
const NAME = z.string().min(1).max(80);

// Normalize a display name into a compact handle we can turn into a stable
// synthetic email. Lowercase, alphanumerics only.
function nameToHandle(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
}

function syntheticEmail(handle: string) {
  return `user_${handle}@movingsale.local`;
}

// Public: create a brand-new account OR claim an existing legacy account by
// setting a user-chosen passcode for the first time. Never accepts a passcode
// for an account that already has one — those must sign in normally.
export const claimAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ name: NAME, passcode: PASSCODE }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const handle = nameToHandle(data.name);
    if (!handle) throw new Error("Please use a name with letters or numbers.");
    const email = syntheticEmail(handle);

    // Look up an existing profile by the normalized name handle stored in phone.
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, passcode_set")
      .eq("phone", handle)
      .maybeSingle();

    if (existingProfile) {
      if (existingProfile.passcode_set) {
        // Passcode already chosen — refuse to overwrite it.
        return { status: "exists" as const };
      }
      // Legacy account: rotate the password to the user-chosen passcode.
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
        existingProfile.id,
        { password: data.passcode },
      );
      if (updErr) throw new Error(updErr.message);
      await supabaseAdmin
        .from("profiles")
        .update({ name: data.name, passcode_set: true })
        .eq("id", existingProfile.id);
      return { status: "claimed" as const };
    }

    // Brand-new account.
    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.passcode,
      email_confirm: true,
      user_metadata: { name: data.name, phone: handle },
    });
    if (createErr) {
      if (createErr.message?.toLowerCase().includes("already")) {
        return { status: "exists" as const };
      }
      throw new Error(createErr.message);
    }
    // handle_new_user trigger created the profile; mark passcode as set.
    await supabaseAdmin
      .from("profiles")
      .update({ passcode_set: true, name: data.name })
      .eq("phone", handle);
    return { status: "created" as const };
  });

// Admin-only: invalidate every legacy phone-derived password for users who
// haven't claimed a personal passcode yet.
export const rotateLegacyPasswords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admins only.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: legacy, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("passcode_set", false);
    if (error) throw new Error(error.message);

    let rotated = 0;
    for (const row of legacy ?? []) {
      const random = crypto.randomUUID() + "-" + crypto.randomUUID();
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
        row.id,
        { password: random },
      );
      if (!updErr) rotated += 1;
    }
    return { rotated, total: legacy?.length ?? 0 };
  });

// Admin-only: reset one user's passcode so they can re-claim it.
export const adminResetPasscode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admins only.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const random = crypto.randomUUID() + "-" + crypto.randomUUID();
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
      data.user_id,
      { password: random },
    );
    if (updErr) throw new Error(updErr.message);
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({ passcode_set: false })
      .eq("id", data.user_id);
    if (profErr) throw new Error(profErr.message);
    return { ok: true };
  });

// Helper exported for the client to build the synthetic email for sign-in.
export function nameToSyntheticEmail(name: string) {
  return syntheticEmail(nameToHandle(name));
}
