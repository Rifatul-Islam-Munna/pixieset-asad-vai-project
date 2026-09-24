"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bold, ExternalLink, ImagePlus, Italic, Link2, List, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createAdminBlog, deleteAdminBlog, type AdminBlog, type AdminBlogCtaButton, updateAdminBlog, uploadHomeCmsFile } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GALLERY_LANGUAGES } from "@/lib/gallery-language";
import { autoDescription, autoKeywords, collectSeoText } from "@/lib/seo";
import { AdminResourceShell } from "./admin-resource-shell";

const BLOG_CATEGORIES = ["Guides", "Business", "Client Experience", "Marketing", "Inspiration", "Product Updates"] as const;
const CTA_LINK_PRESETS: Array<[string, string]> = [
  ["", "Choose quick destination"],
  ["/", "Home"],
  ["/register", "Sign up / Register"],
  ["/login", "Login"],
  ["/pricing", "Pricing"],
  ["/plans", "Plans"],
  ["/blog", "Blog"],
  ["/dashboard/client-gallery", "App / Dashboard"],
];
const makeCtaId = () => typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID()
  : "cta-" + Date.now() + "-" + Math.random().toString(36).slice(2);
const emptyCtaButton = (): AdminBlogCtaButton => ({
  id: makeCtaId(), enabled: true, label: "", url: "", style: "primary", newTab: false,
});
const blank = {
  title: "", slug: "", excerpt: "", content: "", thumbnailUrl: "", author: "", category: "Guides", language: "English",
  featured: false, ctaEnabled: false, ctaTitle: "", ctaText: "", ctaButtons: [] as AdminBlogCtaButton[],
  keywords: "", seoTitle: "", seoDescription: "", canonicalUrl: "", ogTitle: "", ogDescription: "",
  ogImageUrl: "", robotsIndex: true, robotsFollow: true, published: true,
};
type Draft = typeof blank & { _id?: string };

export function AdminBlogPage({ initialBlogs }: { initialBlogs: AdminBlog[] }) {
  const [blogs, setBlogs] = useState(initialBlogs);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();
  const editorRef = useRef<HTMLDivElement>(null);
  const autoSeoText = draft ? collectSeoText({
    title: draft.title,
    excerpt: draft.excerpt,
    content: draft.content,
    category: draft.category,
    author: draft.author,
    language: draft.language,
    ctaTitle: draft.ctaEnabled ? draft.ctaTitle : "",
    ctaText: draft.ctaEnabled ? draft.ctaText : "",
    ctaButtons: draft.ctaEnabled ? draft.ctaButtons.filter((button) => button.enabled !== false).map((button) => button.label) : [],
  }) : "";
  const autoSeoDescription = draft
    ? (draft.excerpt.trim() || autoDescription(draft.content || autoSeoText, ""))
    : "";
  const autoSeoKeywords = draft ? autoKeywords(autoSeoText).join(", ") : "";

  const openNew = () => setDraft({ ...blank });
  const openEdit = (post: AdminBlog) => setDraft({
    _id: post._id, title: post.title, slug: post.slug, excerpt: post.excerpt ?? "",
    content: post.content ?? "", thumbnailUrl: post.thumbnailUrl ?? "", author: post.author ?? "",
    category: post.category || "Guides", language: post.language || "English", featured: Boolean(post.featured),
    ctaEnabled: Boolean(post.ctaEnabled), ctaTitle: post.ctaTitle ?? "", ctaText: post.ctaText ?? "",
    ctaButtons: (post.ctaButtons ?? []).map((button) => ({ ...button, id: button.id || makeCtaId(), enabled: button.enabled ?? true })),
    keywords: (post.keywords ?? []).join(", "), seoTitle: post.seoTitle ?? "", seoDescription: post.seoDescription ?? "",
    canonicalUrl: post.canonicalUrl ?? "", ogTitle: post.ogTitle ?? "", ogDescription: post.ogDescription ?? "",
    ogImageUrl: post.ogImageUrl ?? "", robotsIndex: post.robotsIndex ?? true, robotsFollow: post.robotsFollow ?? true,
    published: post.published,
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
            <div className="p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-1.5"><span className="rounded-full bg-[#f0ebff] px-2.5 py-1 text-xs font-bold text-[#6337d8]">{post.published ? "Published" : "Draft"}</span><span className="rounded-full bg-[#f5f5f5] px-2.5 py-1 text-xs font-bold text-[#666]">{post.category || "Guides"}</span>{post.featured && <span className="rounded-full bg-[#fff3cd] px-2.5 py-1 text-xs font-bold text-[#7a5b00]">Featured</span>}</div><span className="text-xs text-[#777]">{post.language || "English"}</span></div>
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

                <div className="grid gap-4 rounded-xl border border-[#ded4f8] bg-[#faf9ff] p-5">
                  <label className="flex items-center justify-between gap-4 text-sm font-bold">
                    <span>Enable article CTA / app linking block</span>
                    <input type="checkbox" checked={draft.ctaEnabled} onChange={(e) => setDraft({ ...draft, ctaEnabled: e.target.checked })} />
                  </label>
                  <p className="text-xs leading-5 text-[#777]">Use this under the article to send readers to Sign up, Login, Pricing, the app, another dynamic page, another blog post, or any external URL.</p>
                  <label className="grid gap-2 text-sm font-bold">CTA title<Input value={draft.ctaTitle} onChange={(e) => setDraft({ ...draft, ctaTitle: e.target.value })} placeholder="Ready to create your gallery?" /></label>
                  <label className="grid gap-2 text-sm font-bold">CTA text<Textarea value={draft.ctaText} onChange={(e) => setDraft({ ...draft, ctaText: e.target.value })} /></label>
                  <BlogCtaButtonsEditor buttons={draft.ctaButtons} onChange={(ctaButtons) => setDraft({ ...draft, ctaButtons })} />
                </div>
              </div>
              <aside className="grid content-start gap-5 rounded-xl bg-[#f8f6ff] p-5">
                <label className="grid gap-2 text-sm font-bold">Thumbnail
                  <input type="file" accept="image/*" onChange={(e) => void upload(e.target.files?.[0])} className="block w-full text-sm" />
                </label>
                {draft.thumbnailUrl && <img src={draft.thumbnailUrl} alt="" className="aspect-[16/9] w-full rounded-lg object-cover" />}
                <label className="grid gap-2 text-sm font-bold">Author<Input value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} /></label>
                <label className="grid gap-2 text-sm font-bold">Category<select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="h-10 rounded-md border bg-white px-3 font-normal">{BLOG_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
                <label className="grid gap-2 text-sm font-bold">Language<select value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value })} className="h-10 rounded-md border bg-white px-3 font-normal">{GALLERY_LANGUAGES.map((language) => <option key={language}>{language}</option>)}</select></label>
                <div className="grid gap-3 rounded-lg border border-[#d9cff5] bg-white p-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.16em] text-[#6337d8]">Automatic SEO is active</p>
                    <p className="mt-1 text-xs leading-5 text-[#777]">Title, description, keywords, canonical URL, Open Graph, Twitter metadata, BlogPosting schema, breadcrumbs and sitemap data are generated from the article automatically. Use the fields below only when you want to override the generated value.</p>
                  </div>
                  <div className="rounded-md bg-[#f8f6ff] p-3">
                    <p className="text-xs font-bold text-[#333]">{draft.seoTitle.trim() || draft.title || "Article title will appear here"}</p>
                    <p className="mt-1 line-clamp-3 text-xs leading-5 text-[#666]">{draft.seoDescription.trim() || autoSeoDescription || "Description will be generated from the excerpt and article body."}</p>
                    <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-[#786f88]">{draft.keywords.trim() || autoSeoKeywords || "Keywords will be extracted from the full article."}</p>
                  </div>
                  <label className="grid gap-2 text-sm font-bold">Keyword override (optional)<Input value={draft.keywords} onChange={(e) => setDraft({ ...draft, keywords: e.target.value })} placeholder="Leave blank for automatic keywords" /></label>
                  <label className="grid gap-2 text-sm font-bold">SEO title override (optional)<Input value={draft.seoTitle} onChange={(e) => setDraft({ ...draft, seoTitle: e.target.value })} placeholder="Leave blank to use the article title" /></label>
                  <label className="grid gap-2 text-sm font-bold">Meta description override (optional)<Textarea value={draft.seoDescription} onChange={(e) => setDraft({ ...draft, seoDescription: e.target.value })} placeholder="Leave blank to use excerpt/full article text" /></label>
                  <label className="grid gap-2 text-sm font-bold">Canonical URL override (optional)<Input value={draft.canonicalUrl} onChange={(e) => setDraft({ ...draft, canonicalUrl: e.target.value })} placeholder="Leave blank for /blog/slug" /></label>
                  <label className="grid gap-2 text-sm font-bold">Social/OG title override (optional)<Input value={draft.ogTitle} onChange={(e) => setDraft({ ...draft, ogTitle: e.target.value })} /></label>
                  <label className="grid gap-2 text-sm font-bold">Social/OG description override (optional)<Textarea value={draft.ogDescription} onChange={(e) => setDraft({ ...draft, ogDescription: e.target.value })} /></label>
                  <label className="grid gap-2 text-sm font-bold">Social/OG image URL override (optional)<Input value={draft.ogImageUrl} onChange={(e) => setDraft({ ...draft, ogImageUrl: e.target.value })} placeholder="Leave blank to use the thumbnail/global image" /></label>
                  <label className="flex items-center justify-between text-sm font-bold">Allow search indexing<input type="checkbox" checked={draft.robotsIndex} onChange={(e) => setDraft({ ...draft, robotsIndex: e.target.checked })} /></label>
                  <label className="flex items-center justify-between text-sm font-bold">Allow crawlers to follow links<input type="checkbox" checked={draft.robotsFollow} onChange={(e) => setDraft({ ...draft, robotsFollow: e.target.checked })} /></label>
                </div>
                <label className="flex items-center justify-between rounded-lg border bg-white p-3 text-sm font-bold">Featured on Blog<input type="checkbox" checked={draft.featured} onChange={(e) => setDraft({ ...draft, featured: e.target.checked })} /></label>
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

function BlogCtaButtonsEditor({
  buttons,
  onChange,
}: {
  buttons: AdminBlogCtaButton[];
  onChange: (buttons: AdminBlogCtaButton[]) => void;
}) {
  const patch = (index: number, next: Partial<AdminBlogCtaButton>) =>
    onChange(buttons.map((button, i) => (i === index ? { ...button, ...next } : button)));
  const remove = (index: number) => onChange(buttons.filter((_, i) => i !== index));

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold">CTA buttons</p>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...buttons, emptyCtaButton()])}>
          <Plus className="mr-1 size-4" />Add button
        </Button>
      </div>
      {!buttons.length && <p className="rounded-lg border border-dashed bg-white p-3 text-xs text-[#777]">No CTA buttons yet.</p>}
      {buttons.map((button, index) => (
        <div key={button.id || index} className="grid gap-3 rounded-lg border bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs font-bold">
              <input type="checkbox" checked={button.enabled ?? true} onChange={(e) => patch(index, { enabled: e.target.checked })} />
              {button.enabled === false ? "Disabled" : "Button " + (index + 1)}
            </label>
            <Button type="button" size="icon" variant="ghost" onClick={() => remove(index)}><Trash2 className="size-4" /></Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-xs font-bold">Label<Input value={button.label ?? ""} onChange={(e) => patch(index, { label: e.target.value })} /></label>
            <label className="grid gap-2 text-xs font-bold">Quick destination
              <select
                value={CTA_LINK_PRESETS.some(([value]) => value === button.url) ? button.url : ""}
                onChange={(e) => e.target.value && patch(index, { url: e.target.value })}
                className="h-10 rounded-md border bg-white px-3 font-normal"
              >
                {CTA_LINK_PRESETS.map(([value, label]) => <option key={value || "custom"} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <label className="grid gap-2 text-xs font-bold">URL / route<Input value={button.url ?? ""} onChange={(e) => patch(index, { url: e.target.value })} placeholder="/register, /info/page, /blog/post, https://..." /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-xs font-bold">Style
              <select value={button.style || "primary"} onChange={(e) => patch(index, { style: e.target.value })} className="h-10 rounded-md border bg-white px-3 font-normal">
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="text">Text link</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pt-6 text-xs font-bold">
              <input type="checkbox" checked={button.newTab ?? false} onChange={(e) => patch(index, { newTab: e.target.checked })} />
              Open in new tab
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}
