import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isValidPhone,
  normalizePhone,
  phoneToPassword,
  phoneToSyntheticEmail,
} from "@/lib/phone";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/feed", replace: true });
    });
  }, [navigate]);

  async function handleEnter(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Tell me your name!");
    if (!isValidPhone(phone)) return toast.error("That phone number looks off.");
    setLoading(true);
    const email = phoneToSyntheticEmail(phone);
    const password = phoneToPassword(phone);

    // Try sign-in first (returning friend); fall back to sign-up.
    const signIn = await supabase.auth.signInWithPassword({ email, password });
    if (signIn.data.session) {
      // Update name in case they changed it.
      await supabase
        .from("profiles")
        .update({ name: name.trim() })
        .eq("id", signIn.data.session.user.id);
      setLoading(false);
      navigate({ to: "/feed", replace: true });
      return;
    }

    const signUp = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: name.trim(), phone: normalizePhone(phone) },
      },
    });
    setLoading(false);
    if (signUp.error) {
      toast.error(signUp.error.message);
      return;
    }
    if (signUp.data.session) {
      navigate({ to: "/feed", replace: true });
    } else {
      // Should not happen with auto_confirm on, but sign in anyway.
      const retry = await supabase.auth.signInWithPassword({ email, password });
      if (retry.data.session) navigate({ to: "/feed", replace: true });
      else toast.error("Couldn't sign you in — try again.");
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Floating pastel blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-matcha opacity-60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-lilac opacity-60 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 right-1/4 h-40 w-40 rounded-full bg-tangerine opacity-40 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-10 text-center">
          <div className="mb-3 inline-block rounded-full bg-butter px-3 py-1 text-xs font-medium tracking-wide text-butter-foreground uppercase">
            Friends only · By invite
          </div>
          <h1 className="font-display text-5xl italic leading-[1.05] text-foreground">
            The Moving
            <br />
            Sale
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            A silent auction &amp; free-grab pile for my apartment.
            <br />
            Come in — tell me who you are.
          </p>
        </div>

        <form
          onSubmit={handleEnter}
          className="rounded-3xl border border-border bg-card p-6 space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs uppercase tracking-wider text-muted-foreground">
              Your name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Camille"
              autoComplete="given-name"
              className="h-12 rounded-2xl border-border bg-background text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs uppercase tracking-wider text-muted-foreground">
              Phone number
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123 4567"
              inputMode="tel"
              autoComplete="tel"
              className="h-12 rounded-2xl border-border bg-background text-base"
            />
            <p className="text-xs text-muted-foreground">
              So I can text you if you win — no verification, no spam.
            </p>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-2xl bg-foreground text-base font-medium text-background hover:opacity-90"
          >
            {loading ? "Opening the door…" : "Enter the sale →"}
          </Button>
        </form>
      </div>
    </div>
  );
}
