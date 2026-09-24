import { apiBaseUrl } from "@/lib/api-base-url";

export type DynamicPageColumn = {
  eyebrow?: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  linkLabel?: string;
  linkUrl?: string;
};

export type DynamicPageButton = {
  id?: string;
  enabled?: boolean;
  label?: string;
  url?: string;
  style?: string;
  newTab?: boolean;
};

export type DynamicPageSectionItem = {
  id?: string;
  eyebrow?: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  label?: string;
  value?: string;
  linkLabel?: string;
  linkUrl?: string;
};

export type DynamicPageSectionType = "split" | "rich-text" | "feature-grid" | "gallery" | "stats" | "testimonial" | "cta" | "logo-strip" | "steps";

export type DynamicPageSection = {
  id?: string;
  type: DynamicPageSectionType;
  enabled?: boolean;
  eyebrow?: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  layout?: string;
  tone?: string;
  alignment?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  secondaryButtonLabel?: string;
  secondaryButtonUrl?: string;
  buttons?: DynamicPageButton[];
  columns?: number;
  items?: DynamicPageSectionItem[];
};

export type DynamicPage = {
  _id: string;
  title: string;
  slug: string;
  navLabel?: string;
  navDescription?: string;
  showInNavbar: boolean;
  navOrder: number;
  eyebrow?: string;
  heroTitle?: string;
  heroDescription?: string;
  heroImageUrl?: string;
  heroEnabled?: boolean;
  heroLayout?: string;
  heroTone?: string;
  heroPrimaryLabel?: string;
  heroPrimaryUrl?: string;
  heroSecondaryLabel?: string;
  heroSecondaryUrl?: string;
  heroButtons?: DynamicPageButton[];
  columnCount: number;
  legacyGridEnabled?: boolean;
  columns: DynamicPageColumn[];
  sections?: DynamicPageSection[];
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  published: boolean;
  createdAt?: string;
  updatedAt?: string;
};

async function pageRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Dynamic page request failed");
  const payload = await response.json();
  return payload.data as T;
}

export const getDynamicPages = () => pageRequest<DynamicPage[]>("/dynamic-pages");
export const getDynamicPage = (slug: string) => pageRequest<DynamicPage>(`/dynamic-pages/${encodeURIComponent(slug)}`);

export type DynamicSitemapPage = {
  title: string;
  slug: string;
  heroImageUrl?: string;
  heroEnabled?: boolean;
  columns?: DynamicPageColumn[];
  legacyGridEnabled?: boolean;
  sections?: DynamicPageSection[];
  robotsIndex?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export const getDynamicSitemapPages = () =>
  pageRequest<DynamicSitemapPage[]>("/dynamic-pages/sitemap/all");
