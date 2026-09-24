import { apiBaseUrl } from "@/lib/api-base-url";

export type BlogCtaButton = {
  id?: string;
  enabled?: boolean;
  label?: string;
  url?: string;
  style?: string;
  newTab?: boolean;
};

export type BlogPost = {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  thumbnailUrl?: string;
  author?: string;
  category?: string;
  language?: string;
  featured?: boolean;
  ctaEnabled?: boolean;
  ctaTitle?: string;
  ctaText?: string;
  ctaButtons?: BlogCtaButton[];
  keywords?: string[];
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  published: boolean;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

async function blogRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Blog request failed");
  const payload = await response.json();
  return payload.data as T;
}

export const getBlogs = () => blogRequest<BlogPost[]>("/blogs");
export const getBlog = (slug: string) => blogRequest<BlogPost>(`/blogs/${encodeURIComponent(slug)}`);
