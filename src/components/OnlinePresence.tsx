import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type PresenceUser = { user_id: string; name: string };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(id: string): string {
  const palette = [
    "bg-matcha text-matcha-foreground",
    "bg-tangerine text-tangerine-foreground",
    "bg-lilac text-lilac-foreground",
    "bg-butter text-butter-foreground",
    "bg-blush text-blush-foreground",
    "bg-sky text-sky-foreground",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

export function OnlinePresence() {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user;
      if (!me || cancelled) return;
      const name =
        (me.user_metadata?.name as string | undefined) ||
        (me.email as string | undefined) ||
        "Friend";

      channel = supabase.channel("sale-presence", {
        config: { presence: { key: me.id } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<PresenceUser>();
          const seen = new Map<string, PresenceUser>();
          for (const key of Object.keys(state)) {
            const metas = state[key];
            const first = metas[0];
            if (first) seen.set(first.user_id, first);
          }
          setUsers(Array.from(seen.values()));
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel!.track({ user_id: me.id, name });
          }
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  if (users.length === 0) return null;

  const shown = users.slice(0, 3);
  const extra = users.length - shown.length;

  return (
    <div
      className="flex items-center gap-1.5"
      title={`Online now: ${users.map((u) => u.name).join(", ")}`}
      aria-label={`${users.length} online now`}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-matcha opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-matcha" />
      </span>
      <div className="flex -space-x-2">
        {shown.map((u) => (
          <span
            key={u.user_id}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold",
              colorFor(u.user_id),
            )}
          >
            {initials(u.name)}
          </span>
        ))}
        {extra > 0 && (
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-background bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
            +{extra}
          </span>
        )}
      </div>
    </div>
  );
}
