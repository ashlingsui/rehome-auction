import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PHONE = z
  .string()
  .min(7)
  .max(20)
  .transform((s) => s.replace(/\D/g, ""))
  .refine((s) => s.length >= 7 && s.length <= 15, "Invalid phone");

const PASSCODE = z.string().min(4).max(64);
const NAME = z.string().min(1).max(80);

function syntheticEmail(digits: string) {
  return `user${digits}@movingsale.local`;
}

// Public: create a brand-new account OR claim an existing legacy account by
// setting a user-chosen passcode for the first time. Never accepts a passcode
// for an account that already has one — those must sign in normally.
export const claimAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ name: NAME, phone: PHONE, passcode: PASSCODE }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = syntheticEmail(data.phone);

    // Look up existing profile by phone (phone is the stable identity here).
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, passcode_set")
      .eq("phone", data.phone)
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
      user_metadata: { name: data.name, phone: data.phone },
    });
    if (createErr) {
      // Possible race: user was created concurrently. Surface as "exists".
      if (createErr.message?.toLowerCase().includes("already")) {
        return { status: "exists" as const };
      }
      throw new Error(createErr.message);
    }
    // handle_new_user trigger created the profile; mark passcode as set.
    await supabaseAdmin
      .from("profiles")
      .update({ passcode_set: true, name: data.name })
      .eq("phone", data.phone);
    return { status: "created" as const };
  });

// Admin-only: invalidate every legacy phone-derived password for users who
// haven't claimed a personal passcode yet. Rotates them to a long random
// value so the old derivation is dead. Users re-enter with a new passcode
// via claimAccount.
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
      const random =
        crypto.randomUUID() + "-" + crypto.randomUUID();
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
        row.id,
        { password: random },
      );
      if (!updErr) rotated += 1;
    }
    return { rotated, total: legacy?.length ?? 0 };
  });

// Admin-only: reset one user's passcode-set flag so they can re-claim with a
// new passcode (e.g. a friend forgot theirs).
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
