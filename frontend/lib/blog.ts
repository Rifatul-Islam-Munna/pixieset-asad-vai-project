import { apiBaseUrl } from "@/lib/api-base-url";

export type BlogPost = {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  thumbnailUrl?: string;
  author?: string;
  keywords?: string[];
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
