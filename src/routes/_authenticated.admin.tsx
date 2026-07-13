import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  createItem,
  generateDescription,
  getUploadPath,
} from "@/lib/admin.functions";
import { isAdmin } from "@/lib/items.functions";
import { updateSaleEndsAt, updateMaxBidAmount } from "@/lib/sale.functions";
import { saleQuery } from "@/components/CountdownChip";
import { CATEGORIES } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, ImagePlus, Sparkles, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const adminQuery = queryOptions({
  queryKey: ["is-admin"],
  queryFn: () => isAdmin(),
});

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  component: AdminPage,
});

function AdminPage() {
  const { data: adminCheck, isLoading } = useQuery(adminQuery);
  const navigate = useNavigate();

  const getUploadPathFn = useServerFn(getUploadPath);
  const createItemFn = useServerFn(createItem);
  const generateDescriptionFn = useServerFn(generateDescription);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("living_room");
  const [type, setType] = useState<"auction" | "free">("auction");
  const [description, setDescription] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!adminCheck?.isAdmin) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h2 className="font-display text-3xl italic">Just for the host</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Only the person moving out can add items to the sale.
        </p>
        <Link
          to="/feed"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background"
        >
          Back to the sale
        </Link>
      </div>
    );
  }

  async function onFile(f: File) {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setUploadedPath(null);
    setUploading(true);
    try {
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
      const { path } = await getUploadPathFn({ data: { ext } });
      const { error } = await supabase.storage
        .from("item-photos")
        .upload(path, f, { upsert: false, contentType: f.type });
      if (error) throw error;
      setUploadedPath(path);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
      setFile(null);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (!adminCheck?.isAdmin) return;
    function handlePaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        // let text fields handle their own paste unless it's an image
        const hasImage = Array.from(e.clipboardData?.items ?? []).some((i) =>
          i.type.startsWith("image/"),
        );
        if (!hasImage) return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            const ext = (blob.type.split("/")[1] || "png").toLowerCase();
            const named = new File([blob], `pasted-${Date.now()}.${ext}`, {
              type: blob.type,
            });
            onFile(named);
            toast.success("Photo pasted.");
            return;
          }
        }
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminCheck?.isAdmin]);

  async function onGenerate() {
    if (!uploadedPath) return toast.error("Upload a photo first.");
    if (!title.trim()) return toast.error("Give it a title to get inspired.");
    setGenLoading(true);
    try {
      const { description } = await generateDescriptionFn({
        data: { title: title.trim(), photo_path: uploadedPath },
      });
      setDescription(description);
      toast.success("Words, ready.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI is shy.");
    } finally {
      setGenLoading(false);
    }
  }

  async function onPublish(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadedPath) return toast.error("Upload a photo first.");
    if (!title.trim()) return toast.error("Add a title.");
    setPublishing(true);
    try {
      const sp =
        type === "auction" && startingPrice ? Number(startingPrice) : null;
      await createItemFn({
        data: {
          title: title.trim(),
          photo_path: uploadedPath,
          category: category as never,
          type,
          description: description.trim() || null,
          starting_price: sp && sp > 0 ? sp : null,
        },
      });
      toast.success("Published!");
      navigate({ to: "/feed" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't publish.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="mx-auto max-w-xl px-5 pt-6">
        <Link
          to="/feed"
          className="inline-flex h-10 items-center gap-1 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="mt-8">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            New listing
          </div>
          <h1 className="mt-1 font-display text-4xl italic text-foreground">
            Add to the sale
          </h1>
        </div>

        <SaleTimerCard />



        <form onSubmit={onPublish} className="mt-8 space-y-6">
          {/* Photo */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Photo
            </Label>
            <label
              className={cn(
                "mt-2 flex aspect-[4/5] cursor-pointer items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-border bg-card transition hover:border-foreground/30",
                preview && "border-solid",
              )}
            >
              {preview ? (
                <img src={preview} alt="preview" className="h-full w-full object-cover" />
              ) : (
                <div className="text-center">
                  <ImagePlus className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Tap to add a photo
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    or paste from clipboard (⌘V)
                  </p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </label>
            {uploading && (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Uploading…
              </p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label
              htmlFor="title"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Muji Oak Desk"
              className="h-12 rounded-2xl border-border bg-background text-base"
            />
          </div>

          {/* Category */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Category
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-medium transition",
                    category === c.value
                      ? "bg-foreground text-background"
                      : "border border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Type
            </Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("auction")}
                className={cn(
                  "rounded-2xl border p-4 text-left transition",
                  type === "auction"
                    ? "border-transparent bg-lilac text-lilac-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                <div className="text-xs uppercase tracking-wider opacity-70">Silent</div>
                <div className="font-display text-lg italic">Auction</div>
              </button>
              <button
                type="button"
                onClick={() => setType("free")}
                className={cn(
                  "rounded-2xl border p-4 text-left transition",
                  type === "free"
                    ? "border-transparent bg-matcha text-matcha-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                <div className="text-xs uppercase tracking-wider opacity-70">First come</div>
                <div className="font-display text-lg italic">Free</div>
              </button>
            </div>
          </div>

          {type === "auction" && (
            <div className="space-y-1.5">
              <Label
                htmlFor="price"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Starting bid (optional)
              </Label>
              <Input
                id="price"
                value={startingPrice}
                onChange={(e) => setStartingPrice(e.target.value)}
                type="number"
                inputMode="decimal"
                placeholder="20"
                className="h-12 rounded-2xl border-border bg-background text-base"
              />
            </div>
          )}

          {/* Description w/ AI */}
          <div>
            <div className="flex items-center justify-between">
              <Label
                htmlFor="desc"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Description
              </Label>
              <button
                type="button"
                onClick={onGenerate}
                disabled={genLoading || !uploadedPath || !title.trim()}
                className="inline-flex items-center gap-1.5 rounded-full bg-butter px-3 py-1.5 text-xs font-medium text-butter-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {genLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" strokeWidth={2.5} />
                )}
                Write it for me
              </button>
            </div>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A little something about this piece…"
              rows={4}
              className="mt-2 rounded-2xl border-border bg-background text-base"
            />
          </div>

          <Button
            type="submit"
            disabled={publishing || uploading || !uploadedPath}
            className="h-14 w-full rounded-2xl bg-foreground text-base font-medium text-background hover:opacity-90"
          >
            {publishing ? "Publishing…" : "Publish item ✨"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SaleTimerCard() {
  const { data: sale } = useQuery(saleQuery);
  const qc = useQueryClient();
  const updateFn = useServerFn(updateSaleEndsAt);
  const [value, setValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const current = sale ? toLocalInput(sale.auction_ends_at) : "";
  const editing = value || current;

  async function onSave() {
    if (!value) return;
    setSaving(true);
    try {
      const iso = new Date(value).toISOString();
      await updateFn({ data: { ends_at: iso } });
      await qc.invalidateQueries({ queryKey: ["sale-settings"] });
      setValue("");
      toast.success("Sale timer updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update timer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-3xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Sale timer
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Everything locks automatically when the countdown hits zero.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          type="datetime-local"
          value={editing}
          onChange={(e) => setValue(e.target.value)}
          className="h-12 rounded-2xl border-border bg-background text-base"
        />
        <Button
          type="button"
          onClick={onSave}
          disabled={saving || !value || value === current}
          className="h-12 rounded-2xl bg-foreground px-5 text-sm font-medium text-background hover:opacity-90"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      <Link
        to="/admin/results"
        className="mt-4 inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-foreground hover:opacity-70"
      >
        View results →
      </Link>
    </div>
  );
}

