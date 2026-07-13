import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      navigate({ to: data.session ? "/feed" : "/auth", replace: true });
    });
    return () => {
      mounted = void 0 as unknown as boolean;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="animate-pulse text-sm text-muted-foreground">Opening the sale…</div>
    </div>
  );
}

// Silence unused import warnings for the redirect helper (kept for future SSR use).
void redirect;
