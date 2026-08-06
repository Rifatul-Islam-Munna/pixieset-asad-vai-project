"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bold, ExternalLink, ImagePlus, Italic, Link2, List, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createAdminBlog, deleteAdminBlog, type AdminBlog, updateAdminBlog, uploadHomeCmsFile } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminResourceShell } from "./admin-resource-shell";

const blank = { title: "", slug: "", excerpt: "", content: "", thumbnailUrl: "", author: "", keywords: "", published: true };
type Draft = typeof blank & { _id?: string };

export function AdminBlogPage({ initialBlogs }: { initialBlogs: AdminBlog[] }) {
  const [blogs, setBlogs] = useState(initialBlogs);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();
  const editorRef = useRef<HTMLDivElement>(null);

  const openNew = () => setDraft({ ...blank });
  const openEdit = (post: AdminBlog) => setDraft({
    _id: post._id, title: post.title, slug: post.slug, excerpt: post.excerpt ?? "",
    content: post.content ?? "", thumbnailUrl: post.thumbnailUrl ?? "", author: post.author ?? "",
    keywords: (post.keywords ?? []).join(", "), published: post.published,
  });

  const command = (name: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, value);
    setDraft((current) => current ? { ...current, content: editorRef.current?.innerHTML ?? current.content } : current);
  };

  const upload = async (file?: File) => {
    if (!file || !draft) return;
    try {
      const data = new FormData(); data.append("file", file);
      const url = await uploadHomeCmsFile(data);
      setDraft({ ...draft, thumbnailUrl: url });
      toast.success("Thumbnail uploaded");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed"); }
  };

  const save = () => {
    if (!draft?.title.trim()) return toast.error("Blog title is required");
    const payload = {
      ...draft,
      content: editorRef.current?.innerHTML ?? draft.content,
      keywords: draft.keywords.split(",").map((item) => item.trim()).filter(Boolean),
    };
    startTransition(async () => {
      try {
        const saved = draft._id ? await updateAdminBlog(draft._id, payload) : await createAdminBlog(payload);
        setBlogs((items) => draft._id ? items.map((item) => item._id === saved._id ? saved : item) : [saved, ...items]);
        setDraft(null); toast.success(draft._id ? "Blog updated" : "Blog created");
      } catch (error) { toast.error(error instanceof Error ? error.message : "Save failed"); }
    });
  };

  const remove = (post: AdminBlog) => {
    if (!window.confirm(`Delete "${post.title}"?`)) return;
    startTransition(async () => {
      try { await deleteAdminBlog(post._id); setBlogs((items) => items.filter((item) => item._id !== post._id)); toast.success("Blog deleted"); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Delete failed"); }
    });
  };

  return (
    <AdminResourceShell active="blogs" title="Blog posts" subtitle="Create rich blog articles with thumbnails, SEO keywords, drafts, and public detail pages."
      action={<Button onClick={openNew} className="bg-gradient-to-r from-[#5527c9] to-[#7436db] text-white"><Plus className="mr-2 size-4" />Create Blog</Button>}>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {blogs.map((post) => (
          <article key={post._id} className="overflow-hidden rounded-xl border border-[#e6ddff] bg-white shadow-[0_12px_34px_rgba(99,55,216,.07)]">
            <div className="aspect-[16/9] bg-[#eee]">{post.thumbnailUrl ? <img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[#aaa]"><ImagePlus /></div>}</div>
            <div className="p-5"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-[#f0ebff] px-2.5 py-1 text-xs font-bold text-[#6337d8]">{post.published ? "Published" : "Draft"}</span><span className="text-xs text-[#777]">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ""}</span></div>
              <h2 className="mt-4 text-xl font-bold">{post.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-[#666]">{post.excerpt}</p>
              <div className="mt-5 flex gap-2"><Button variant="outline" size="sm" onClick={() => openEdit(post)}><Pencil className="mr-1 size-4" />Edit</Button><Button variant="outline" size="sm" asChild><Link href={`/blog/${post.slug}`} target="_blank"><ExternalLink className="mr-1 size-4" />View</Link></Button><Button variant="outline" size="sm" onClick={() => remove(post)} className="text-red-600"><Trash2 className="size-4" /></Button></div>
            </div>
          </article>
        ))}
      </div>
      {!blogs.length && <div className="rounded-xl border border-dashed bg-white p-14 text-center text-[#777]">No blog posts yet.</div>}

      {draft && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-4 sm:p-8">
          <div className="mx-auto max-w-5xl rounded-xl bg-white p-5 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#6337d8]">Blog editor</p><h2 className="mt-2 text-2xl font-bold">{draft._id ? "Edit blog" : "Create blog"}</h2></div><button onClick={() => setDraft(null)} className="text-2xl text-[#777]">×</button></div>
            <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_310px]">
              <div className="grid gap-5">
                <label className="grid gap-2 text-sm font-bold">Title<Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
                <label className="grid gap-2 text-sm font-bold">Slug<Input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="auto-generated from title" /></label>
                <label className="grid gap-2 text-sm font-bold">Excerpt<Textarea value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} className="min-h-24" /></label>
                <div>
                  <p className="mb-2 text-sm font-bold">Blog content</p>
                  <div className="flex flex-wrap gap-2 border border-b-0 bg-[#fafafa] p-2">
                    <button type="button" onClick={() => command("bold")} className="rounded border bg-white p-2"><Bold className="size-4" /></button>
                    <button type="button" onClick={() => command("italic")} className="rounded border bg-white p-2"><Italic className="size-4" /></button>
                    <button type="button" onClick={() => command("insertUnorderedList")} className="rounded border bg-white p-2"><List className="size-4" /></button>
                    <button type="button" onClick={() => command("formatBlock", "h2")} className="rounded border bg-white px-3 py-2 text-xs font-bold">H2</button>
                    <button type="button" onClick={() => { const url = window.prompt("Link URL"); if (url) command("createLink", url); }} className="rounded border bg-white p-2"><Link2 className="size-4" /></button>
                  </div>
                  <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={() => setDraft({ ...draft, content: editorRef.current?.innerHTML ?? "" })} dangerouslySetInnerHTML={{ __html: draft.content }} className="min-h-[360px] border bg-white p-5 text-base leading-7 outline-none focus:border-[#6337d8]" />
                </div>
              </div>
              <aside className="grid content-start gap-5 rounded-xl bg-[#f8f6ff] p-5">
                <label className="grid gap-2 text-sm font-bold">Thumbnail
                  <input type="file" accept="image/*" onChange={(e) => void upload(e.target.files?.[0])} className="block w-full text-sm" />
                </label>
                {draft.thumbnailUrl && <img src={draft.thumbnailUrl} alt="" className="aspect-[16/9] w-full rounded-lg object-cover" />}
                <label className="grid gap-2 text-sm font-bold">Author<Input value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} /></label>
                <label className="grid gap-2 text-sm font-bold">SEO keywords<Input value={draft.keywords} onChange={(e) => setDraft({ ...draft, keywords: e.target.value })} placeholder="photography, galleries, clients" /></label>
                <label className="flex items-center justify-between rounded-lg border bg-white p-3 text-sm font-bold">Published<input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} /></label>
              </aside>
            </div>
            <div className="mt-7 flex justify-end gap-3"><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button disabled={pending} onClick={save} className="bg-gradient-to-r from-[#5527c9] to-[#7436db] text-white">{pending ? "Saving..." : "Save Blog"}</Button></div>
          </div>
        </div>
      )}
    </AdminResourceShell>
  );
}
