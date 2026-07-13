import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getItem, isAdmin } from "@/lib/items.functions";
import { updateItem, deleteItem, getUploadPath } from "@/lib/admin.functions";
import { CATEGORIES } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const adminQuery = queryOptions({ queryKey: ["is-admin"], queryFn: () => isAdmin() });
const itemQuery = (id: string) =>
  queryOptions({ queryKey: ["item", id], queryFn: () => getItem({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/admin/items/$itemId/edit")({
  ssr: false,
  component: EditPage,
});

function EditPage() {
  const { itemId } = Route.useParams();
  const { data: adminCheck, isLoading: adminLoading } = useQuery(adminQuery);
  const { data: item } = useSuspenseQuery(itemQuery(itemId));
  const qc = useQueryClient();
  const navigate = useNavigate();

  const getUploadPathFn = useServerFn(getUploadPath);
  const updateItemFn = useServerFn(updateItem);
  const deleteItemFn = useServerFn(deleteItem);

  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState(item.category);
  const [type, setType] = useState<"auction" | "free">(item.type);
  const [description, setDescription] = useState(item.description ?? "");
  const [preview, setPreview] = useState<string | null>(item.photo_signed_url || null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => () => qc.invalidateQueries({ queryKey: ["item", itemId] }), [itemId, qc]);

  if (adminLoading) {
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
        <Link to="/feed" className="mt-6 inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background">
          Back to the sale
        </Link>
      </div>
    );
  }

  async function onFile(f: File) {
    setPreview(URL.createObjectURL(f));
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
    } finally {
      setUploading(false);
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Add a title.");
    setSaving(true);
    try {
      await updateItemFn({
        data: {
          id: itemId,
          title: title.trim(),
          category: category as never,
          type,
          description: description.trim() || null,
          photo_path: uploadedPath ?? undefined,
        },
      });
      toast.success("Saved.");
      await qc.invalidateQueries({ queryKey: ["items"] });
      await qc.invalidateQueries({ queryKey: ["item", itemId] });
      navigate({ to: "/items/$itemId", params: { itemId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!confirm("Delete this item? This can't be undone.")) return;
    setDeleting(true);
    try {
      await deleteItemFn({ data: { id: itemId } });
      toast.success("Deleted.");
      await qc.invalidateQueries({ queryKey: ["items"] });
      navigate({ to: "/feed" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="mx-auto max-w-xl px-5 pt-6">
        <Link
          to="/items/$itemId"
          params={{ itemId }}
          className="inline-flex h-10 items-center gap-1 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="mt-8">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Edit listing
          </div>
          <h1 className="mt-1 font-display text-4xl italic text-foreground">Update item</h1>
        </div>

        <form onSubmit={onSave} className="mt-8 space-y-6">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Photo</Label>
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
                  <p className="mt-2 text-sm text-muted-foreground">Tap to replace photo</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </label>
            {uploading && (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs uppercase tracking-wider text-muted-foreground">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-12 rounded-2xl border-border bg-background text-base"
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
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

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
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

          <div>
            <Label htmlFor="desc" className="text-xs uppercase tracking-wider text-muted-foreground">
              Description
            </Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-2 rounded-2xl border-border bg-background text-base"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={saving || uploading}
              className="h-14 flex-1 rounded-2xl bg-foreground text-base font-medium text-background hover:opacity-90"
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              variant="outline"
              className="h-14 rounded-2xl border-destructive/40 px-5 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
