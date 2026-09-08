"use client";

import { useMemo, useState } from "react";
import { Edit3, Eye, ImagePlus, Loader2, Plus, Save, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDashboardSettings } from "@/api-hooks/use-dashboard-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GALLERY_LANGUAGES } from "@/lib/gallery-language";
import { clientBlogSlug, type ClientBlogPost } from "@/lib/client-blog";

const BLOG_CATEGORIES = ["Wedding", "Portrait", "Family", "Engagement", "Travel", "Tips", "Behind the Scenes", "News"] as const;

function newPost(): ClientBlogPost {
  return {
    id: `blog-${crypto.randomUUID()}`,
    title: "Untitled story",
    slug: "",
    excerpt: "",
    content: "",
    coverImage: "",
    category: "Wedding",
    language: "English",
    featured: false,
    published: false,
    updatedAt: "Draft",
  };
}

export function ClientBlogManager() {
  const blogSettings = useDashboardSettings<ClientBlogPost>("blog-post");
  const posts = useMemo(() => blogSettings.query.data?.data ?? [], [blogSettings.query.data]);
  const [draft, setDraft] = useState<ClientBlogPost | null>(null);
  const [uploading, setUploading] = useState(false);

  const openSaved = (post: ClientBlogPost) => setDraft({ ...post });
  const create = () => setDraft(newPost());

  const save = async () => {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) return toast.error("Blog title is required");
    const slug = clientBlogSlug(draft.slug || title);
    const duplicate = posts.some((setting) => setting.localId !== draft.id && setting.data.slug === slug);
    if (duplicate) return toast.error("Another blog post already uses this slug");
    const now = new Date().toISOString();
    const next: ClientBlogPost = {
      ...draft,
      title,
      slug,
      publishedAt: draft.published && !draft.publishedAt ? now : draft.publishedAt,
      updatedAt: now,
    };
    try {
      await blogSettings.saveSetting.mutateAsync({ localId: next.id, name: next.title, data: next });
      setDraft(next);
      toast.success(next.published ? "Blog published" : "Blog draft saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Blog could not be saved");
    }
  };

  const remove = async () => {
    if (!draft || !posts.some((item) => item.localId === draft.id)) return;
    if (!window.confirm(`Delete “${draft.title}”?`)) return;
    try {
      await blogSettings.deleteSetting.mutateAsync(draft.id);
      setDraft(null);
      toast.success("Blog post deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Blog could not be deleted");
    }
  };

  const uploadCover = async (file?: File) => {
    if (!file || !draft) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/mobile-gallery/assets", { method: "POST", body: form });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Upload failed");
      const url = String(payload?.data?.url || "");
      if (!url) throw new Error("Upload failed");
      setDraft({ ...draft, coverImage: url });
      toast.success("Blog cover uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (blogSettings.query.isLoading) return <div className="grid min-h-[520px] place-items-center"><Loader2 className="size-7 animate-spin text-[#6337d8]" /></div>;

  return (
    <div className="pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-7">
        <div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#6337d8]">Your website</p><h1 className="mt-2 text-3xl font-semibold">Blog</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#666]">Publish stories, sessions, advice, and updates directly on your photographer homepage in any supported language.</p></div>
        <Button onClick={create} className="rounded-none bg-[#6337d8] text-white"><Plus className="size-4" />New post</Button>
      </div>

      {!draft ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {posts.map((setting) => {
            const post = setting.data;
            return <button key={setting.localId} type="button" onClick={() => openSaved({ ...post, id: post.id || setting.localId })} className="overflow-hidden border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="aspect-[16/9] bg-[#eee]">{post.coverImage ? <img src={assetSrc(post.coverImage)} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[#aaa]"><ImagePlus className="size-8" /></div>}</div>
              <div className="p-5"><div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider"><span className={post.published ? "text-emerald-700" : "text-[#888]"}>{post.published ? "Published" : "Draft"}</span>{post.featured && <span className="text-[#8a6200]">Featured</span>}<span className="text-[#6337d8]">{post.language || "English"}</span></div><h2 className="mt-3 text-xl font-bold">{post.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-[#666]">{post.excerpt || "No excerpt yet."}</p><p className="mt-4 text-xs text-[#999]">{post.category || "Story"}</p></div>
            </button>;
          })}
          {!posts.length && <div className="col-span-full grid min-h-[420px] place-items-center border border-dashed bg-white text-center"><div><Edit3 className="mx-auto size-10 text-[#6337d8]" /><h2 className="mt-4 text-xl font-bold">Create your first blog post</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#666]">Share a session, educate clients, or publish a studio update.</p><Button onClick={create} className="mt-6 rounded-none bg-[#111] text-white"><Plus className="size-4" />New post</Button></div></div>}
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="grid gap-6 border bg-white p-5 sm:p-7">
            <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#777]">Title<Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="h-12 rounded-none text-lg font-semibold normal-case" /></label>
            <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#777]">URL slug<Input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} placeholder="auto-created-from-title" className="h-11 rounded-none normal-case" /></label>
            <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#777]">Excerpt<Textarea value={draft.excerpt} onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })} className="min-h-24 rounded-none normal-case" placeholder="A short introduction shown on your homepage and blog list." /></label>
            <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#777]">Article<Textarea value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} className="min-h-[440px] rounded-none normal-case leading-7" placeholder="Write the full story here…" /></label>
          </section>

          <aside className="grid gap-5 border bg-white p-5 xl:sticky xl:top-6">
            <div><p className="text-xs font-bold uppercase tracking-wider text-[#777]">Cover photo</p><label className="mt-2 grid min-h-40 cursor-pointer place-items-center overflow-hidden border border-dashed bg-[#fafafa] text-center">{draft.coverImage ? <img src={assetSrc(draft.coverImage)} alt="" className="h-full max-h-56 w-full object-cover" /> : <span className="p-6 text-sm text-[#777]"><ImagePlus className="mx-auto mb-2 size-6" />Upload image</span>}<input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(event) => void uploadCover(event.target.files?.[0])} /></label>{uploading && <p className="mt-2 text-xs text-[#777]">Uploading…</p>}</div>
            <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#777]">Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="h-11 border bg-white px-3 text-sm font-normal normal-case">{BLOG_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#777]">Language<select value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value })} className="h-11 border bg-white px-3 text-sm font-normal normal-case">{GALLERY_LANGUAGES.map((language) => <option key={language}>{language}</option>)}</select></label>
            <label className="flex items-center justify-between gap-4 border p-4 text-sm font-bold"><span className="flex items-center gap-2"><Star className="size-4 text-[#8a6200]" />Feature on homepage</span><input type="checkbox" checked={draft.featured} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} className="size-4 accent-[#6337d8]" /></label>
            <label className="flex items-center justify-between gap-4 border p-4 text-sm font-bold"><span className="flex items-center gap-2"><Eye className="size-4" />Published</span><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} className="size-4 accent-[#6337d8]" /></label>
            <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => setDraft(null)} className="rounded-none">Back</Button><Button onClick={() => void save()} disabled={blogSettings.saveSetting.isPending} className="rounded-none bg-[#111] text-white"><Save className="size-4" />Save</Button></div>
            {posts.some((item) => item.localId === draft.id) && <button type="button" onClick={() => void remove()} className="inline-flex items-center justify-center gap-2 py-2 text-xs font-bold text-red-600"><Trash2 className="size-4" />Delete post</button>}
          </aside>
        </div>
      )}
    </div>
  );
}

function assetSrc(value: string) {
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
  return value.startsWith("/") ? `${base}${value}` : value;
}
