"use client";

import { useEffect, useRef, useState, useTransition, type PointerEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import LinkExtension from "@tiptap/extension-link";
import UnderlineExtension from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  Bold,
  ChevronDown,
  Check,
  ChevronsLeft,
  CircleUserRound,
  Copy,
  CreditCard,
  Database,
  Download,
  Eye,
  Heart,
  Images,
  Info,
  Italic,
  LayoutGrid,
  Link2,
  ListFilter,
  Loader2,
  LogOut,
  Mail,
  MailCheck,
  Megaphone,
  MoreHorizontal,
  Menu,
  Package,
  Palette,
  PanelTop,
  PlusCircle,
  Lock,
  QrCode,
  RefreshCw,
  Save,
  Settings,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Search,
  Send,
  Star,
  Store,
  Trash2,
  Underline,
  Unlink,
  Upload,
  Users,
  FileUp,
  Wrench,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  useCollectionDetail,
  useCollectionActivity,
  useCollectionActivityActions,
  useCollectionImages,
  useCollections,
  useImageActions,
  type CollectionDownloadActivityRecord,
  type CollectionFavoriteActivityRecord,
  type CollectionImageRecord,
  type CollectionRecord,
} from "@/api-hooks/use-collections";
import { useDashboardSettings } from "@/api-hooks/use-dashboard-settings";
import { logOutUser } from "@/actions/auth";
import { checkoutPlan, confirmPlanCheckout, getBillingOverview, recordEmailUsage, type BillingUser } from "@/actions/billing";
import type { AdminPlan } from "@/actions/admin";
import { CoverPreview, coverOptions } from "@/components/dashboard/cover-designs";
import {
  useStorePriceSheet,
  useStorePriceSheets,
  useStoreCustomers,
  useStoreDashboard,
  useStoreOrders,
  useStoreRules,
  useStoreSettings,
  type StoreCouponRecord,
  type StoreCustomerRecord,
  type StoreDashboardRecord,
  type StoreOrderRecord,
  type StoreOrderStatus,
  type StoreProductPayload,
  type StoreProductRecord,
  type StoreProductType,
  type StoreShippingRecord,
  type StoreSettingsRecord,
  type StoreTaxRecord,
} from "@/api-hooks/use-store";
import {
  useDashboardStore,
  type PresetDesignSettings,
  type PresetDownloadSettings,
  type PresetGeneralSettings,
} from "@/lib/dashboard-store";
import { cn } from "@/lib/utils";

export type DashboardSection = "client-gallery" | "store-gallery";
export type DashboardPage =
  | "collections"
  | "collection-new"
  | "library"
  | "favorites"
  | "starred"
  | "homepage"
  | "settings"
  | "marketing"
  | "products"
  | "orders"
  | "customers"
  | "taxes"
  | "shipping"
  | "coupons"
  | "storefront"
  | "storage";
export type MarketingPage = "email-campaigns" | "contacts" | "settings";
export type SettingsPage =
  | "branding"
  | "watermark"
  | "watermark-editor"
  | "presets"
  | "preset-new"
  | "email-templates"
  | "preferences"
  | "integrations";

const switcherItems = [
  {
    key: "client-gallery",
    title: "Client Gallery",
    text: "Better way to share, deliver, proof and sell",
    href: "/dashboard/client-gallery",
    mark: "bg-[#0dc6b5]",
  },
  {
    key: "store-gallery",
    title: "Store Gallery",
    text: "Your online store for prints and downloads",
    href: "/dashboard/store-gallery",
    mark: "bg-[#ff4f5d]",
  },
] as const;

const sidebarItems = {
  "client-gallery": [
    { label: "Collections", icon: Images, page: "collections" },
    { label: "Library", icon: LayoutGrid, page: "library" },
    { label: "Favorite", icon: Heart, page: "favorites" },
    { label: "Starred", icon: Star, page: "starred" },
    { label: "Homepage", icon: PanelTop, page: "homepage" },
    { label: "Settings", icon: Settings, page: "settings" },
  ],
  "store-gallery": [
    { label: "Orders", icon: ShoppingBag, page: "orders" },
    { label: "Customers", icon: Users, page: "customers" },
    { label: "Products", icon: Package, page: "products" },
    { label: "Taxes", icon: ListFilter, page: "taxes" },
    { label: "Shipping", icon: Package, page: "shipping" },
    { label: "Coupons", icon: Copy, page: "coupons" },
    { label: "Settings", icon: Settings, page: "settings" },
  ],
} satisfies Record<
  DashboardSection,
  { label: string; icon: typeof Images; page: DashboardPage }[]
>;

const dashboardCopy = {
  "client-gallery": {
    title: "Client Gallery",
    eyebrow: "Get Started",
    heading: "Create beautiful photo collections in 3 steps",
    cta: "Get Started with Sample Photos",
    hero: "AUTUMN FLORALS",
    bg: "bg-[#dfe9eb]",
    image:
      "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=1200&q=80",
  },
  "store-gallery": {
    title: "Store Gallery",
    eyebrow: "Store Setup",
    heading: "Start selling prints and downloads in 3 steps",
    cta: "Create Store with Sample Products",
    hero: "FINE ART PRINTS",
    bg: "bg-[#ece7df]",
    image:
      "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=1200&q=80",
  },
};

const libraryFilters = [
  {
    title: "Camera Settings",
    items: ["Camera", "Lens", "Focal Length", "Shutter Speed", "Aperture", "ISO", "Flash"],
  },
  {
    title: "Metadata",
    items: ["Filename", "Title", "Caption", "Headline", "Keyword", "Orientation", "Rating", "Color Label", "Color Space"],
  },
  {
    title: "Nikoset",
    items: ["Starred"],
  },
];

const libraryPhotos = [
  {
    src: "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=600&q=80",
    title: "yellow floral detail",
    tags: "Camera Lens Focal Length Aperture Keyword Caption Color Space",
  },
  {
    src: "https://images.unsplash.com/photo-1508808787069-421e7986016e?auto=format&fit=crop&w=600&q=80",
    title: "green mountain texture",
    tags: "Filename Title Orientation Rating Keyword",
  },
  {
    src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80",
    title: "forest wedding frame",
    tags: "Starred Caption Headline Camera Flash",
  },
  {
    src: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80",
    title: "vintage pine landscape",
    tags: "Lens ISO Color Label Orientation",
  },
  {
    src: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=600&q=80",
    title: "desert novel cover",
    tags: "Shutter Speed Aperture Title Keyword",
  },
  {
    src: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80",
    title: "soft studio print",
    tags: "Filename Color Space Rating Camera",
  },
  {
    src: "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=600&q=80",
    title: "portrait print store",
    tags: "Starred Lens Caption ISO",
  },
  {
    src: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80",
    title: "wedding collection",
    tags: "Headline Keyword Camera Orientation",
  },
];

export function ClientDashboard({
  section,
  page,
  marketingPage = "email-campaigns",
  settingsPage = "watermark",
  collectionId,
  priceSheetId,
}: {
  section: DashboardSection;
  page: DashboardPage;
  marketingPage?: MarketingPage;
  settingsPage?: SettingsPage;
  collectionId?: string;
  priceSheetId?: string;
}) {
  const router = useRouter();
  const active = dashboardCopy[section];
  const activeSwitcher = switcherItems.find((item) => item.key === section);
  const {
    collapsed,
    campaignBuilderOpen,
    wizardOpen,
    closeCampaignBuilder,
    startWizard,
    setActiveNav,
    toggleCollapsed,
  } = useDashboardStore();
  const activeNav =
    sidebarItems[section].find((item) => item.page === page)?.label ??
    (page === "marketing" ? "Marketing" : "Storage");
  const isCollectionIndex =
    page === "collections" || (section === "store-gallery" && page === "products");
  const isCollectionDetail = page === "collections" && Boolean(collectionId);
  const isPriceSheetDetail = page === "products" && Boolean(priceSheetId);
  const [logoutPending, startLogoutTransition] = useTransition();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const logout = () => {
    startLogoutTransition(async () => {
      await logOutUser();
      router.push("/login");
    });
  };

  return (
    <main className="min-h-screen bg-white text-[#151515]">
      {!campaignBuilderOpen && !isCollectionDetail && !isPriceSheetDetail && <aside
        className={cn(
          "fixed inset-y-0 left-0 hidden border-r border-[#e6e6e6] bg-white transition-all md:flex md:flex-col",
          collapsed ? "w-[76px]" : "w-[292px]"
        )}
      >
        <div className="flex h-[62px] items-center justify-between border-b border-[#f1f1f1] px-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 text-sm font-bold outline-none">
                <span className={cn("size-5 rounded-full", activeSwitcher?.mark)} />
                {!collapsed && active.title}
                {!collapsed && <ChevronDown className="size-3 text-[#777]" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[310px] rounded-none border-0 p-0 shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
              <DropdownMenuGroup className="p-5">
                {switcherItems.map((item) => (
                  <DropdownMenuItem key={item.key} asChild className="p-0">
                    <Link href={item.href} className="flex gap-4 py-3">
                      <span className={cn("mt-1 size-8 shrink-0 rounded-full", item.mark)} />
                      <span className="flex flex-col gap-1">
                        <span className="font-bold text-[#151515]">{item.title}</span>
                        <span className="text-xs leading-5 text-[#777]">{item.text}</span>
                      </span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <div className="bg-[#f7f7f7] p-5 text-center">
                <Link href={`/dashboard/${section}`} className="inline-flex items-center gap-2 text-sm text-[#333]">
                  <LayoutGrid className="size-4 text-[#999]" />
                  View Dashboard
                </Link>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className={cn("flex items-center gap-4", collapsed && "hidden")}>
            <Avatar className="size-7">
              <AvatarFallback className="bg-[#dff3ef] text-[#0b9f91]">R</AvatarFallback>
            </Avatar>
            <button
              aria-label="Logout"
              className="text-[#555] hover:text-red-600 disabled:opacity-50"
              disabled={logoutPending}
              onClick={logout}
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </div>

        <nav className="flex flex-1 flex-col px-4 py-7">
          <div className="flex flex-col gap-8">
            {sidebarItems[section].map((item) => (
              <Link
                key={item.label}
                href={item.page === "collections" ? `/dashboard/${section}` : `/dashboard/${section}/${item.page}`}
                className={cn(
                  "flex items-center gap-4 text-left text-base text-[#222]",
                  activeNav === item.label && "font-semibold text-[#00a997]"
                )}
              >
                <item.icon
                  className={cn(
                    "size-5 text-[#333]",
                    activeNav === item.label && "text-[#00a997]"
                  )}
                />
                {!collapsed && item.label}
              </Link>
            ))}
          </div>

          {section === "client-gallery" && (
            <div className="mt-11 flex flex-col gap-8">
              {!collapsed && <p className="text-base text-[#777]">Tools</p>}
              <Link
                href={`/dashboard/${section}/marketing/email-campaigns`}
                className={cn(
                  "flex items-center gap-4 text-left text-base text-[#222]",
                  page === "marketing" && "font-semibold text-[#00a997]"
                )}
              >
                <Megaphone
                  className={cn(
                    "size-5 text-[#333]",
                    page === "marketing" && "text-[#00a997]"
                  )}
                />
                {!collapsed && "Marketing"}
              </Link>
              {!collapsed && page === "marketing" && (
                <div className="ml-7 flex flex-col border-l border-[#e8e8e8] pl-4">
                  {[
                    { label: "Email Campaigns", slug: "email-campaigns", icon: Mail },
                    { label: "Contacts", slug: "contacts", icon: Users },
                    { label: "Settings", slug: "settings", icon: MailCheck },
                  ].map((item) => (
                    <Link
                      key={item.slug}
                      href={`/dashboard/${section}/marketing/${item.slug}`}
                      className={cn(
                        "flex h-12 items-center gap-4 px-3 text-base text-[#222]",
                        marketingPage === item.slug && "bg-[#f3f3f3] font-medium"
                      )}
                    >
                      <item.icon className="size-5" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-auto grid gap-4 pt-8">
            {section === "client-gallery" && (
              <Link
                href={`/dashboard/${section}/storage`}
                className={cn(
                  "flex items-center gap-3 bg-[#f3faf6] text-left",
                  collapsed ? "mx-auto size-12 justify-center p-0" : "w-full p-4"
                )}
                title="Storage"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-[#dff6ef] text-[#19bba7]">
                  <Database className="size-5" />
                </div>
                {!collapsed && <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[#00a997]">Storage</p>
                    <PlusCircle className="size-4 text-[#16bda8]" />
                  </div>
                  <p className="mt-1 text-xs text-[#777]">0 GB of 3 GB used</p>
                  <Progress value={0} className="mt-2 bg-[#dceee8]" />
                </div>}
              </Link>
            )}
            <button
              className={cn(
                "flex items-center gap-3 text-sm font-semibold text-[#555] hover:text-red-600 disabled:opacity-50",
                collapsed && "justify-center"
              )}
              onClick={logout}
              disabled={logoutPending}
            >
              <LogOut className="size-5" />
              {!collapsed && "Logout"}
            </button>
            <button
              className={cn("flex items-center text-[#333]", collapsed && "justify-center")}
              onClick={toggleCollapsed}
              aria-label="Toggle sidebar"
            >
              <ChevronsLeft className={cn("size-6", collapsed && "rotate-180")} />
            </button>
          </div>
        </nav>
      </aside>}

      <section className={cn("min-h-screen transition-all", campaignBuilderOpen || isCollectionDetail || isPriceSheetDetail ? "" : collapsed ? "md:pl-[76px]" : "md:pl-[292px]")}>
        {!campaignBuilderOpen && !isCollectionDetail && !isPriceSheetDetail && <div className="flex h-14 items-center justify-between border-b border-[#f1f1f1] px-4 md:hidden">
          <button className="flex size-10 items-center justify-center bg-[#111] text-white" onClick={() => setMobileMenuOpen(true)} aria-label="Open dashboard menu">
            <Menu className="size-5" />
          </button>
          <div className="flex min-w-0 items-center gap-2 text-sm font-bold">
            <span className={cn("size-5 rounded-full", activeSwitcher?.mark)} />
            <span className="truncate">{active.title}</span>
          </div>
          <button aria-label="Logout" onClick={logout} disabled={logoutPending} className="flex size-10 items-center justify-center bg-[#f4f4f4]">
            <LogOut className="size-5" />
          </button>
        </div>}

        {mobileMenuOpen && !campaignBuilderOpen && !isCollectionDetail && !isPriceSheetDetail && (
          <div className="fixed inset-0 z-50 bg-black/50 md:hidden">
            <aside className="h-full w-[84vw] max-w-[330px] overflow-y-auto bg-white px-5 py-5 shadow-[20px_0_60px_rgba(0,0,0,0.25)]">
              <div className="flex items-center justify-between border-b pb-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 text-sm font-bold outline-none">
                      <span className={cn("size-5 rounded-full", activeSwitcher?.mark)} />
                      {active.title}
                      <ChevronDown className="size-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[270px] rounded-none">
                    <DropdownMenuGroup>
                      {switcherItems.map((item) => (
                        <DropdownMenuItem key={item.key} asChild>
                          <Link href={item.href} onClick={() => setMobileMenuOpen(false)}>{item.title}</Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button className="flex size-10 items-center justify-center bg-[#f4f4f4]" onClick={() => setMobileMenuOpen(false)} aria-label="Close dashboard menu">
                  <X className="size-5" />
                </button>
              </div>

              <nav className="mt-7 grid gap-5">
                {sidebarItems[section].map((item) => (
                  <Link
                    key={item.label}
                    href={item.page === "collections" ? `/dashboard/${section}` : `/dashboard/${section}/${item.page}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn("flex items-center gap-4 text-base text-[#222]", activeNav === item.label && "font-semibold text-[#00a997]")}
                  >
                    <item.icon className={cn("size-5 text-[#333]", activeNav === item.label && "text-[#00a997]")} />
                    {item.label}
                  </Link>
                ))}
                {section === "client-gallery" && (
                  <>
                    <p className="mt-4 text-sm font-semibold text-[#777]">Tools</p>
                    <Link
                      href={`/dashboard/${section}/marketing/email-campaigns`}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn("flex items-center gap-4 text-base text-[#222]", page === "marketing" && "font-semibold text-[#00a997]")}
                    >
                      <Megaphone className={cn("size-5 text-[#333]", page === "marketing" && "text-[#00a997]")} />
                      Marketing
                    </Link>
                    <Link
                      href={`/dashboard/${section}/storage`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-4 text-base text-[#222]"
                    >
                      <Database className="size-5 text-[#333]" />
                      Storage
                    </Link>
                  </>
                )}
              </nav>

              <button className="mt-10 flex items-center gap-3 text-sm font-semibold text-[#555] hover:text-red-600 disabled:opacity-50" onClick={logout} disabled={logoutPending}>
                <LogOut className="size-5" />
                Logout
              </button>
            </aside>
          </div>
        )}

        <div className={cn("mx-auto min-h-screen", campaignBuilderOpen ? "" : isCollectionDetail || isPriceSheetDetail ? "max-w-none px-0 py-0" : "max-w-[1220px] px-4 py-10 sm:px-5 md:py-20")}>
          {campaignBuilderOpen ? (
            <CampaignBuilder onClose={closeCampaignBuilder} />
          ) : wizardOpen ? (
            <CollectionWizard />
          ) : page === "library" ? (
            <LibraryPanel onNewCollection={startWizard} />
          ) : page === "favorites" ? (
            <FavoriteCollectionsPanel />
          ) : page === "starred" ? (
            <StarredPanel />
          ) : section === "store-gallery" && page === "settings" ? (
            <StoreSettingsPanel />
          ) : page === "settings" ? (
            <SettingsPanel section={section} settingsPage={settingsPage} />
          ) : page === "homepage" ? (
            <HomepageSettings />
          ) : page === "storage" ? (
            <StoragePlanPanel />
          ) : page === "marketing" ? (
            <MarketingPanel marketingPage={marketingPage} />
          ) : page === "collection-new" ? (
            <CollectionNewPanel section={section} />
          ) : section === "store-gallery" && page === "storefront" ? (
            <StoreDashboardPanel />
          ) : section === "store-gallery" && page === "orders" ? (
            <StoreOrdersPanel />
          ) : section === "store-gallery" && page === "customers" ? (
            <StoreCustomersPanel />
          ) : section === "store-gallery" && page === "coupons" ? (
            <StoreCouponsPanel />
          ) : section === "store-gallery" && page === "taxes" ? (
            <StoreTaxesPanel />
          ) : section === "store-gallery" && page === "shipping" ? (
            <StoreShippingPanel />
          ) : page === "products" && priceSheetId ? (
            <StorePriceSheetDetail priceSheetId={priceSheetId} />
          ) : page === "collections" && collectionId ? (
            <CollectionDetailView section={section} collectionId={collectionId} />
          ) : section === "store-gallery" && page === "products" ? (
            <StoreProductsPanel />
          ) : isCollectionIndex ? (
            <CollectionsPanel section={section} />
          ) : (
            <DashboardPlaceholder page={page} title={activeNav} />
          )}
        </div>
      </section>

    </main>
  );
}

function StoragePlanPanel() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [data, setData] = useState<{ plans: AdminPlan[]; user: BillingUser } | null>(null);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const load = async () => {
      if (sessionId) await confirmPlanCheckout(sessionId).catch(() => null);
      return getBillingOverview();
    };
    load()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Billing failed");
      });
    return () => {
      active = false;
    };
  }, []);

  const user = data?.user;
  const usedGb = bytesToGb(user?.storageUsedBytes ?? 0);
  const limitGb = Number(user?.storageLimitGb ?? 0);
  const storagePercent = limitGb > 0 ? Math.min(100, (usedGb / limitGb) * 100) : 0;
  const emailLimit = Number(user?.monthlyEmailLimit ?? 0);
  const emailsUsed = Number(user?.monthlyEmailsUsed ?? 0);
  const emailPercent = emailLimit > 0 ? Math.min(100, (emailsUsed / emailLimit) * 100) : 0;

  const buyPlan = (planId: string) => {
    startTransition(async () => {
      setError("");
      try {
        const result = await checkoutPlan(planId);
        if (result.checkoutUrl) window.location.href = result.checkoutUrl;
        else setError("Stripe checkout URL missing");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Checkout failed");
      }
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Storage & Plan" action="Monthly Plan" />
        <Button asChild className="h-11 rounded-none bg-[#22bda7] px-6 text-sm font-bold text-white hover:bg-[#19a995]">
          <Link href="/pricing">View Pricing Plans</Link>
        </Button>
      </div>
      {error && <p className="mt-5 border-l-2 border-red-500 pl-3 text-sm font-semibold text-red-600">{error}</p>}
      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <UsagePanel
          icon={<Database className="size-5" />}
          title={user?.planName ?? "Free"}
          label="Storage"
          value={`${usedGb.toFixed(2)} GB used`}
          limit={limitGb > 0 ? `${limitGb} GB / month` : "No plan limit"}
          percent={storagePercent}
        />
        <UsagePanel
          icon={<Mail className="size-5" />}
          title="Monthly emails"
          label="Emails"
          value={`${emailsUsed} sent`}
          limit={emailLimit > 0 ? `${emailLimit} emails / month` : "No plan limit"}
          percent={emailPercent}
        />
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {(data?.plans ?? []).map((plan) => (
          <article key={plan._id} className="border bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{plan.name}</h2>
                <p className="mt-2 text-sm text-[#666]">Monthly allowance</p>
              </div>
              <CreditCard className="size-5 text-[#00a997]" />
            </div>
            <div className="mt-8 grid gap-3 text-sm">
              <div className="flex justify-between"><span>Storage</span><b>{plan.storageGb} GB</b></div>
              <div className="flex justify-between"><span>Emails</span><b>{plan.monthlyEmails}</b></div>
              <div className="flex justify-between"><span>Price</span><b>${Number(plan.priceMonthly ?? 0)}/month</b></div>
            </div>
            <Button
              className="mt-6 h-11 w-full rounded-none bg-[#111] text-white"
              disabled={pending || !Number(plan.priceMonthly ?? 0)}
              onClick={() => buyPlan(plan._id)}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Buy Plan"}
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}

function UsagePanel({
  icon,
  title,
  label,
  value,
  limit,
  percent,
}: {
  icon: ReactNode;
  title: string;
  label: string;
  value: string;
  limit: string;
  percent: number;
}) {
  return (
    <div className="border bg-white p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center bg-[#e3f6f1] text-[#00a997]">{icon}</span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777]">{label}</p>
          <h2 className="mt-1 text-lg font-semibold">{title}</h2>
        </div>
      </div>
      <div className="mt-6 flex justify-between text-sm">
        <span>{value}</span>
        <span className="font-semibold">{limit}</span>
      </div>
      <Progress value={percent} className="mt-4 h-2 bg-[#e8e8e8]" />
    </div>
  );
}

function bytesToGb(value: number) {
  return Number(value ?? 0) / 1024 / 1024 / 1024;
}

function MarketingPanel({ marketingPage }: { marketingPage: MarketingPage }) {
  const {
    campaignSearch,
    hydrateDashboardSettings,
    setCampaignSearch,
    setShowCampaignTemplates,
    showCampaignTemplates,
    startCampaignBuilder,
  } = useDashboardStore();
  const emailTemplateSettings = useDashboardSettings("email-template").query;

  useEffect(() => {
    const settings = emailTemplateSettings.data?.data ?? [];

    if (settings.length) {
      hydrateDashboardSettings(settings);
    }
  }, [emailTemplateSettings.data, hydrateDashboardSettings]);

  if (marketingPage === "contacts") {
    return (
      <div>
        <PageHeader
          action="Upload Contacts"
          title="Contacts"
        />
        <div className="mt-12 grid gap-5 md:grid-cols-[360px_1fr]">
          <div className="border bg-[#fafafa] p-8">
            <FileUp className="size-9 text-[#22bda7]" />
            <h2 className="mt-5 text-lg font-bold">Upload contact list</h2>
            <p className="mt-3 text-sm leading-6 text-[#555]">
              Import a CSV list to start sending campaigns.
            </p>
            <Input type="file" className="mt-6 h-12 rounded-none bg-white" />
          </div>
          <ContactGrid />
        </div>
      </div>
    );
  }

  if (marketingPage === "settings") {
    return (
      <div>
        <PageHeader action="Save Settings" title="Marketing Settings" />
        <div className="mt-12 max-w-[680px] bg-[#fafafa] p-10">
          <FieldGroup className="gap-8">
            <Field>
              <FieldLabel className="font-bold">Sender Name</FieldLabel>
              <Input className="h-12 rounded-none bg-white" placeholder="Nikoset Studio" />
            </Field>
            <Field>
              <FieldLabel className="font-bold">Reply-to Email</FieldLabel>
              <Input className="h-12 rounded-none bg-white" placeholder="hello@example.com" />
            </Field>
            <Field>
              <FieldLabel className="font-bold">Opt-in Location</FieldLabel>
              <Input className="h-12 rounded-none bg-white" placeholder="Client Gallery checkout" />
            </Field>
          </FieldGroup>
        </div>
      </div>
    );
  }

  return (
    <div>
      <CampaignListHeader
        query={campaignSearch}
        onNew={() => setShowCampaignTemplates(true)}
        onQueryChange={setCampaignSearch}
      />
      {showCampaignTemplates ? (
        <TemplateGrid
          isLoading={emailTemplateSettings.isLoading}
          onSelect={startCampaignBuilder}
        />
      ) : (
        <CampaignTable
          query={campaignSearch}
          onEdit={(name) => startCampaignBuilder(name)}
        />
      )}
    </div>
  );
}

function CampaignListHeader({
  query,
  onNew,
  onQueryChange,
}: {
  query: string;
  onNew: () => void;
  onQueryChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <h1 className="text-[28px] font-medium leading-none">Email Campaigns</h1>
          <div className="flex h-10 w-[280px] items-center gap-3 bg-white">
            <Search className="size-5 text-[#333]" />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search"
              className="h-10 rounded-none border-0 px-0 focus-visible:ring-0"
            />
          </div>
        </div>
        <Button
          className="h-10 rounded-none bg-[#22bda7] px-7 text-sm font-bold text-white hover:bg-[#19a995]"
          onClick={onNew}
        >
          New Campaign
        </Button>
      </div>
      <div className="mt-7 flex items-center justify-between">
        <button className="rounded-full bg-[#f7f7f7] px-4 py-2 text-sm font-semibold">
          Status <ChevronDown className="ml-1 inline size-3" />
        </button>
        <div className="flex items-center gap-5">
          <Button className="h-7 rounded-full bg-[#e3f6f1] px-4 text-[11px] font-bold uppercase tracking-widest text-[#00a997] hover:bg-[#d6f2eb]">
            Upgrade to Send
          </Button>
          <ListFilter className="size-5 text-[#777]" />
        </div>
      </div>
    </div>
  );
}

function CampaignTable({
  query,
  onEdit,
}: {
  query: string;
  onEdit: (name: string) => void;
}) {
  const campaigns = [
    {
      name: "Travel Dates",
      status: "Draft",
      sendDate: "-",
      recipients: "0",
      openRate: "-",
      created: "Jun 14, 2026",
    },
  ].filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));

  if (!campaigns.length) {
    return (
      <div className="mt-12 flex min-h-[520px] flex-col items-center justify-center text-center">
        <div className="relative">
          <div className="size-28 rounded-full bg-[#e5f0ef]" />
          <Mail className="absolute -left-3 top-3 size-10 text-[#444]" />
          <MailCheck className="absolute left-12 top-14 size-9 text-[#444]" />
        </div>
        <h2 className="mt-10 text-lg font-bold">Create your first email campaign</h2>
        <p className="mt-5 max-w-[430px] text-sm leading-6 text-[#333]">
          Power up your marketing with email campaigns to opted-in contacts.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="grid grid-cols-[2fr_130px_1.2fr_1.2fr_1.2fr_1.4fr_40px] border-b pb-4 text-[11px] font-bold uppercase tracking-widest text-[#777]">
        <span>Name</span>
        <span />
        <span>Send Date</span>
        <span># of Recipients</span>
        <span>Open Rate</span>
        <span>Date Created</span>
        <span />
      </div>
      {campaigns.map((campaign) => (
        <button
          key={campaign.name}
          className="grid w-full grid-cols-[2fr_130px_1.2fr_1.2fr_1.2fr_1.4fr_40px] items-center border-b py-5 text-left text-sm"
          onClick={() => onEdit(campaign.name)}
        >
          <span className="font-bold">{campaign.name}</span>
          <span>
            <span className="rounded-full bg-[#f4f4f4] px-6 py-2 text-xs font-bold uppercase text-[#777]">
              {campaign.status}
            </span>
          </span>
          <span>{campaign.sendDate}</span>
          <span>{campaign.recipients}</span>
          <span>{campaign.openRate}</span>
          <span>{campaign.created}</span>
          <MoreHorizontal className="size-5 text-[#777]" />
        </button>
      ))}
    </div>
  );
}

function TemplateGrid({
  isLoading,
  onSelect,
}: {
  isLoading: boolean;
  onSelect: (template?: string) => void;
}) {
  const { emailTemplates } = useDashboardStore();

  if (isLoading && !emailTemplates.length) {
    return (
      <div className="mt-12 flex min-h-[280px] items-center justify-center text-sm font-semibold text-[#777]">
        Loading templates...
      </div>
    );
  }

  if (!emailTemplates.length) {
    return (
      <div className="mt-12 flex min-h-[280px] flex-col items-center justify-center text-center">
        <Mail className="size-10 text-[#999]" />
        <h2 className="mt-5 text-lg font-bold">No email templates yet</h2>
        <p className="mt-3 max-w-[420px] text-sm leading-6 text-[#666]">
          Create templates in Settings, then use them for new campaigns.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {emailTemplates.map((template) => (
        <button
          key={template.id}
          className="border bg-white p-4 text-left hover:border-[#22bda7]"
          onClick={() => onSelect(template.id)}
        >
          <div className="flex h-28 items-center justify-center bg-[#090d0f] text-white">
            {template.image ? (
              <img src={template.image} alt="" className="h-full w-full object-cover opacity-75" />
            ) : (
              <span className="px-3 text-center text-xl font-bold uppercase tracking-wide">
                {template.title}
              </span>
            )}
          </div>
          <p className="mt-4 font-bold">{template.name}</p>
          <p className="mt-2 line-clamp-2 text-sm text-[#666]">{template.subject}</p>
        </button>
      ))}
    </div>
  );
}

function CampaignBuilder({ onClose }: { onClose: () => void }) {
  const {
    campaignButtonColor,
    campaignButtonLink,
    campaignButtonText,
    campaignFooterText,
    campaignTab,
    campaignImage,
    campaignMessage,
    campaignPreviewText,
    campaignSubject,
    campaignTemplate,
    selectedRecipients,
    setCampaignTab,
    setCampaignButtonColor,
    setCampaignButtonLink,
    setCampaignButtonText,
    setCampaignFooterText,
    setCampaignImage,
    setCampaignMessage,
    setCampaignPreviewText,
    setCampaignSubject,
    setCampaignTemplate,
    toggleRecipient,
  } = useDashboardStore();
  const [sendPending, startSendTransition] = useTransition();
  const [sendError, setSendError] = useState("");
  const recipients = ["Avery Woodward", "Jessie Ryan", "Morgan Wells", "Isla Bennett"];
  const collections = ["Autumn Florals", "Black Friday Clients", "Wedding Leads"];
  const sendNow = () => {
    setSendError("");
    startSendTransition(async () => {
      try {
        await recordEmailUsage(Math.max(1, selectedRecipients.length));
        onClose();
      } catch (error) {
        setSendError(error instanceof Error ? error.message : "Email send failed");
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#f3f3f3]">
      <header className="flex h-12 items-center justify-between border-b bg-white">
        <div className="flex items-center gap-4 px-8">
          <button onClick={onClose} aria-label="Back">
            <ArrowLeft className="size-5 text-[#777]" />
          </button>
          <h1 className="text-lg font-bold">{campaignTemplate}</h1>
          <span className="rounded-full bg-[#f3f3f3] px-5 py-2 text-xs font-bold text-[#777]">
            DRAFT
          </span>
        </div>
        <div className="flex items-center gap-8">
          <button className="text-sm font-semibold">Send Test</button>
          <Button className="h-12 rounded-none bg-[#22bda7] px-9 text-sm font-bold text-white hover:bg-[#19a995]" onClick={sendNow} disabled={sendPending}>
            {sendPending ? <Loader2 className="size-4 animate-spin" /> : "Send Now"}
          </Button>
        </div>
      </header>
      {sendError && <p className="border-l-2 border-red-500 bg-white px-8 py-3 text-sm font-semibold text-red-600">{sendError}</p>}

      <div className="grid min-h-[calc(100vh-48px)] lg:grid-cols-[468px_1fr]">
        <aside className="border-r bg-white">
          <Tabs value={campaignTab} onValueChange={(value) => setCampaignTab(value as "email" | "recipients")} className="gap-0">
            <TabsList className="grid h-16 w-full grid-cols-2 rounded-none bg-[#fafafa] p-0">
              <TabsTrigger value="email" className="rounded-none data-active:border-b-2 data-active:border-[#22bda7] data-active:bg-white">
                <Mail data-icon="inline-start" />
                Email
              </TabsTrigger>
              <TabsTrigger value="recipients" className="rounded-none data-active:border-b-2 data-active:border-[#22bda7] data-active:bg-white">
                <Users data-icon="inline-start" />
                Recipients
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="p-8">
              <h2 className="text-lg font-bold">Design Email</h2>
              <FieldGroup className="mt-8 gap-8">
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">Subject</FieldLabel>
                  <Input
                    className="h-12 rounded-none"
                    value={campaignSubject}
                    onChange={(event) => setCampaignSubject(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">Preview Text</FieldLabel>
                  <Input
                    className="h-12 rounded-none"
                    value={campaignPreviewText}
                    onChange={(event) => setCampaignPreviewText(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">Title</FieldLabel>
                  <Input
                    className="h-12 rounded-none"
                    value={campaignTemplate}
                    onChange={(event) => setCampaignTemplate(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">Image</FieldLabel>
                  <Input
                    type="file"
                    accept="image/*"
                    className="h-12 rounded-none"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) setCampaignImage(URL.createObjectURL(file));
                    }}
                  />
                  <div className="mt-3 flex h-28 items-center justify-center overflow-hidden bg-[#090d0f] text-white">
                    {campaignImage ? (
                      <img
                        src={campaignImage}
                        alt="Campaign preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-bold uppercase">{campaignTemplate}</span>
                    )}
                  </div>
                </Field>
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">Message</FieldLabel>
                  <div className="flex h-8 items-center gap-4 border bg-[#f3f3f3] px-3 text-[#777]">
                    <Bold className="size-4" />
                    <Italic className="size-4" />
                    <Underline className="size-4" />
                    <Link2 className="size-4" />
                    <Unlink className="size-4" />
                  </div>
                  <textarea
                    className="min-h-[180px] w-full border px-4 py-4 text-sm leading-6 outline-none"
                    value={campaignMessage}
                    onChange={(event) => setCampaignMessage(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">Button Text</FieldLabel>
                  <Input
                    className="h-12 rounded-none"
                    value={campaignButtonText}
                    onChange={(event) => setCampaignButtonText(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">Button Link</FieldLabel>
                  <Input
                    className="h-12 rounded-none"
                    value={campaignButtonLink}
                    onChange={(event) => setCampaignButtonLink(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">Button Color</FieldLabel>
                  <div className="flex gap-3">
                    <Input
                      type="color"
                      className="h-12 w-16 rounded-none p-1"
                      value={campaignButtonColor}
                      onChange={(event) => setCampaignButtonColor(event.target.value)}
                    />
                    <Input
                      className="h-12 rounded-none"
                      value={campaignButtonColor}
                      onChange={(event) => setCampaignButtonColor(event.target.value)}
                    />
                  </div>
                </Field>
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">Footer Text</FieldLabel>
                  <div className="flex h-8 items-center gap-4 border bg-[#f3f3f3] px-3 text-[#777]">
                    <Bold className="size-4" />
                    <Italic className="size-4" />
                    <Underline className="size-4" />
                    <Link2 className="size-4" />
                  </div>
                  <textarea
                    className="min-h-[140px] w-full border px-4 py-4 text-sm leading-6 outline-none"
                    value={campaignFooterText}
                    onChange={(event) => setCampaignFooterText(event.target.value)}
                  />
                </Field>
              </FieldGroup>
            </TabsContent>

            <TabsContent value="recipients" className="p-8">
              <h2 className="text-lg font-bold">Recipients</h2>
              <div className="mt-8 flex flex-col gap-8">
                <div>
                  <p className="mb-4 text-sm font-bold uppercase text-[#777]">Select individually</p>
                  <div className="grid gap-3">
                    {recipients.map((name) => (
                      <label key={name} className="flex items-center gap-3 border p-4">
                        <Checkbox
                          checked={selectedRecipients.includes(name)}
                          onCheckedChange={() => toggleRecipient(name)}
                        />
                        <span>{name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-4 text-sm font-bold uppercase text-[#777]">Select collection</p>
                  <div className="grid gap-3">
                    {collections.map((name) => (
                      <button key={name} className="border p-4 text-left" onClick={() => toggleRecipient(name)}>
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">Upload new collection</FieldLabel>
                  <Input type="file" className="h-12 rounded-none" />
                </Field>
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        <CampaignPreview
          buttonColor={campaignButtonColor}
          buttonLink={campaignButtonLink}
          buttonText={campaignButtonText}
          footerText={campaignFooterText}
          image={campaignImage}
          message={campaignMessage}
          previewText={campaignPreviewText}
          subject={campaignSubject}
          template={campaignTemplate}
        />
      </div>
    </div>
  );
}

function CampaignPreview({
  buttonColor,
  buttonLink,
  buttonText,
  footerText,
  image,
  message,
  previewText,
  subject,
  template,
}: {
  buttonColor: string;
  buttonLink: string;
  buttonText: string;
  footerText: string;
  image: string;
  message: string;
  previewText: string;
  subject: string;
  template: string;
}) {
  return (
    <section className="flex justify-center overflow-auto p-10">
      <div className="w-[600px] bg-white">
        <div className="bg-[#080c0e] px-10 py-10 text-center text-white">
          <h1 className="text-5xl font-bold uppercase tracking-wide">
            {template}
          </h1>
        </div>
        <div className="h-[240px] overflow-hidden bg-[#080c0e]">
          {image ? (
            <img
              src={image}
              alt={template}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl font-bold uppercase tracking-wide text-white/10">
              {template}
            </div>
          )}
        </div>
        <div className="px-16 py-9 text-base leading-7">
          <p className="text-sm font-bold uppercase tracking-wide text-[#777]">
            {subject}
          </p>
          <p className="mt-2 text-sm text-[#777]">{previewText}</p>
          <div className="mt-6 whitespace-pre-line">{message}</div>
          <div className="mt-9 text-center">
            <a
              href={buttonLink === "Collection URL" ? "#" : buttonLink}
              className="inline-flex h-11 items-center justify-center px-8 font-bold uppercase tracking-wide text-white"
              style={{ backgroundColor: buttonColor }}
            >
              {buttonText}
            </a>
          </div>
          <p className="mt-10 whitespace-pre-line text-center text-xs text-[#555]">
            {footerText}
          </p>
        </div>
      </div>
    </section>
  );
}

function PageHeader({ title, action }: { title: string; action: string }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <h1 className="text-[28px] font-medium leading-none">{title}</h1>
      <div className="flex items-center gap-5">
        <Button className="h-10 rounded-none bg-[#22bda7] px-7 text-sm font-bold text-white hover:bg-[#19a995]">
          {action}
        </Button>
        <Button className="h-7 rounded-full bg-[#e3f6f1] px-4 text-[11px] font-bold uppercase tracking-widest text-[#00a997] hover:bg-[#d6f2eb]">
          Upgrade to Send
        </Button>
      </div>
    </div>
  );
}

function ContactGrid() {
  const contacts = [
    ["Avery Woodward", "avery@example.com"],
    ["Jessie Ryan", "jessie@example.com"],
    ["Morgan Wells", "morgan@example.com"],
    ["Isla Bennett", "isla@example.com"],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {contacts.map(([name, email]) => (
        <div key={email} className="border bg-white p-5">
          <p className="font-bold">{name}</p>
          <p className="mt-2 text-sm text-[#666]">{email}</p>
          <p className="mt-4 text-xs uppercase tracking-wide text-[#00a997]">
            Opted in
          </p>
        </div>
      ))}
    </div>
  );
}

type FavoriteImageRecord = {
  _id: string;
  imageId: string;
  collectionId: string;
  url: string;
  thumbnailUrl?: string;
  originalName?: string;
  collectionName?: string;
  galleryUrl?: string;
};

type FavoriteCollectionRecord = {
  _id: string;
  collectionId: string;
  name: string;
  slug?: string;
  coverImage?: string;
  eventDate?: string;
  url?: string;
};

function FavoriteCollectionsPanel() {
  const [photoFavorites, setPhotoFavorites] = useState<FavoriteImageRecord[]>([]);
  const [collectionFavorites, setCollectionFavorites] = useState<FavoriteCollectionRecord[]>([]);
  const [previewImage, setPreviewImage] = useState<FavoriteImageRecord | null>(null);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setPhotosLoading(true);
    fetch("/api/collection-image-favorites", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message ?? "Favorite photos failed");
        if (active) setPhotoFavorites(payload?.data ?? []);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Favorite photos failed");
      })
      .finally(() => {
        if (active) setPhotosLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setCollectionsLoading(true);
    fetch("/api/collection-favorites", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message ?? "Favorite collections failed");
        if (active) setCollectionFavorites(payload?.data ?? []);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Favorite collections failed");
      })
      .finally(() => {
        if (active) setCollectionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <h1 className="text-[28px] font-medium leading-none">Favorites</h1>
      {error ? <p className="mt-8 text-sm font-semibold text-red-600">{error}</p> : null}
      <Tabs defaultValue="albums" className="mt-8 gap-0">
        <TabsList className="h-auto gap-8 bg-transparent p-0">
          <TabsTrigger
            value="albums"
            className="h-auto rounded-none px-0 pb-2 text-sm font-semibold data-active:bg-transparent data-active:text-[#111] data-active:shadow-none data-active:underline data-active:decoration-[#22bda7] data-active:decoration-2 data-active:underline-offset-[10px]"
          >
            Albums
          </TabsTrigger>
          <TabsTrigger
            value="photos"
            className="h-auto rounded-none px-0 pb-2 text-sm font-semibold data-active:bg-transparent data-active:text-[#111] data-active:shadow-none data-active:underline data-active:decoration-[#22bda7] data-active:decoration-2 data-active:underline-offset-[10px]"
          >
            Photos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="albums" className="mt-12">
          {collectionsLoading ? (
            <p className="text-sm font-semibold text-[#777]">Loading favorite albums...</p>
          ) : collectionFavorites.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {collectionFavorites.map((favorite) => (
                <button
                  key={favorite._id}
                  className="group text-left"
                  onClick={() => favorite.url && window.open(favorite.url, "_blank", "noopener,noreferrer")}
                  type="button"
                >
                  <span className="relative block overflow-hidden bg-[#f3f3f3]">
                    {favorite.coverImage ? (
                      <img src={imageSrc(favorite.coverImage)} alt={favorite.name} className="aspect-[1.35] w-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <span className="flex aspect-[1.35] items-center justify-center bg-[#f3f3f3]">
                        <Images className="size-8 text-[#bbb]" />
                      </span>
                    )}
                    <Heart className="absolute right-3 top-3 size-5 fill-red-500 text-red-500 drop-shadow" />
                  </span>
                  <span className="mt-3 block truncate text-sm font-semibold text-[#222]">
                    {favorite.name}
                  </span>
                  <span className="mt-1 block truncate text-xs text-[#777]">
                    {favorite.eventDate ? format(parseISO(favorite.eventDate), "MMM d, yyyy") : "Favorite album"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mx-auto flex min-h-[360px] max-w-[420px] flex-col items-center justify-center text-center">
              <Heart className="size-10 text-[#22bda7]" />
              <h2 className="mt-5 text-xl font-semibold">No favorite albums yet</h2>
              <p className="mt-3 text-sm leading-6 text-[#666]">Favorite albums from public collection galleries.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="photos" className="mt-12">
          {photosLoading ? (
            <p className="text-sm font-semibold text-[#777]">Loading favorite photos...</p>
          ) : photoFavorites.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {photoFavorites.map((favorite) => (
                <button
                  key={favorite._id}
                  className="group text-left"
                  onClick={() => setPreviewImage(favorite)}
                  type="button"
                >
                  <span className="relative block overflow-hidden bg-[#f3f3f3]">
                    {favorite.url ? (
                      <img src={imageSrc(favorite.thumbnailUrl || favorite.url)} alt={favorite.originalName ?? ""} className="aspect-square w-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <span className="flex aspect-square items-center justify-center">
                        <Heart className="size-9 text-[#bbb]" />
                      </span>
                    )}
                    <Heart className="absolute right-3 top-3 size-5 fill-red-500 text-red-500 drop-shadow" />
                  </span>
                  <span className="mt-3 block truncate text-sm font-semibold text-[#222]">
                    {favorite.originalName ?? "Favorite photo"}
                  </span>
                  <span className="mt-1 block truncate text-xs text-[#777]">
                    {favorite.collectionName ?? "Collection"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mx-auto flex min-h-[360px] max-w-[420px] flex-col items-center justify-center text-center">
              <Heart className="size-10 text-[#22bda7]" />
              <h2 className="mt-5 text-xl font-semibold">No favorite photos yet</h2>
              <p className="mt-3 text-sm leading-6 text-[#666]">Favorite photos from public collection galleries.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
      <Dialog open={Boolean(previewImage)} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-h-[94dvh] overflow-y-auto rounded-none border-0 p-0 sm:max-w-[92vw]">
          {previewImage && (
            <div className="grid bg-white lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="flex min-h-[62dvh] items-center justify-center bg-[#111] p-4 lg:min-h-[86dvh]">
                <img
                  src={imageSrc(previewImage.url)}
                  alt={previewImage.originalName ?? ""}
                  className="max-h-[84dvh] max-w-full object-contain"
                />
              </div>
              <div className="flex flex-col justify-between gap-8 p-6">
                <div>
                  <DialogHeader className="text-left">
                    <DialogTitle className="truncate text-2xl">
                      {previewImage.originalName ?? "Favorite photo"}
                    </DialogTitle>
                    <DialogDescription>
                      {previewImage.collectionName ?? "Collection"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-8 rounded-none border border-[#e7e7e2] bg-[#fafafa] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#777]">
                      Source
                    </p>
                    <p className="mt-2 truncate text-sm font-semibold text-[#222]">
                      {previewImage.collectionName ?? "Collection"}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3">
                  <Button
                    className="h-11 rounded-none bg-[#22bda7] text-sm font-bold text-white hover:bg-[#19a995]"
                    onClick={() => previewImage.galleryUrl && window.open(previewImage.galleryUrl, "_blank", "noopener,noreferrer")}
                    disabled={!previewImage.galleryUrl}
                  >
                    <Images data-icon="inline-start" />
                    Open Collection
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 rounded-none"
                    onClick={() => setPreviewImage(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StarredPanel() {
  const { collectionsQuery } = useCollections();
  const imagesQuery = useCollectionImages();
  const starredCollections = (collectionsQuery.data?.data ?? []).filter(
    (collection) => collection.status === "starred" || collection.settings?.starred,
  );
  const starredPhotos = (imagesQuery.data?.data ?? []).filter(
    (image) => image.metadata?.starred === true,
  );

  return (
    <div>
      <h1 className="text-[28px] font-medium leading-none">Starred</h1>
      <Tabs defaultValue="collections" className="mt-8 gap-0">
        <TabsList className="h-auto gap-8 bg-transparent p-0">
          <TabsTrigger
            value="collections"
            className="h-auto rounded-none px-0 pb-2 text-sm font-semibold data-active:bg-transparent data-active:text-[#111] data-active:shadow-none data-active:underline data-active:decoration-[#22bda7] data-active:decoration-2 data-active:underline-offset-[10px]"
          >
            Collections
          </TabsTrigger>
          <TabsTrigger
            value="photos"
            className="h-auto rounded-none px-0 pb-2 text-sm font-semibold data-active:bg-transparent data-active:text-[#111] data-active:shadow-none data-active:underline data-active:decoration-[#22bda7] data-active:decoration-2 data-active:underline-offset-[10px]"
          >
            Photos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="mt-20">
          <StarredGrid
            emptyText="You have no starred collections yet"
            emptySubtext="Track your favorite collections with stars."
            items={starredCollections}
            kind="collection"
          />
        </TabsContent>
        <TabsContent value="photos" className="mt-20">
          <StarredGrid
            emptyText="You have no starred photos yet"
            emptySubtext="Track your favorite photos with stars."
            items={starredPhotos}
            kind="photo"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StarredGrid({
  items,
  kind,
  emptyText,
  emptySubtext,
}: {
  items: (CollectionRecord | CollectionImageRecord)[];
  kind: "collection" | "photo";
  emptyText: string;
  emptySubtext: string;
}) {
  if (!items.length) {
    return (
      <div className="mx-auto flex min-h-[430px] max-w-[420px] flex-col items-center justify-center text-center">
        <div className="relative">
          <div className="size-28 rounded-full bg-[#edf3ef]" />
          <Star className="absolute left-0 top-6 size-7 fill-white text-[#444]" />
          <Images className="absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 text-[#444]" />
        </div>
        <p className="mt-8 text-lg font-bold">{emptyText}</p>
        <p className="mt-4 text-sm text-[#444]">{emptySubtext}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => {
        const isCollection = kind === "collection";
        const collection = item as CollectionRecord;
        const image = item as CollectionImageRecord;
        const src = isCollection ? collection.coverImage : image.url;
        const title = isCollection
          ? collection.name
          : image.originalName ?? image.metadata?.filename ?? "Image";
        const subtitle = isCollection
          ? `${collection.imageCount ?? 0} images`
          : `${image.collectionName ?? "Collection"} / ${image.setName ?? "Highlights"}`;

        return (
        <button key={`${kind}-${item._id}`} className="group text-left">
          <span className="relative block overflow-hidden bg-[#f3f3f3]">
            {src ? (
              <img
                src={imageSrc(src)}
                alt={title}
                className={cn(
                  "w-full object-cover transition-transform group-hover:scale-105",
                  isCollection ? "aspect-[1.35]" : "aspect-square",
                )}
              />
            ) : (
              <span className={cn("flex items-center justify-center bg-[#f3f3f3]", isCollection ? "aspect-[1.35]" : "aspect-square")}>
                <Images className="size-8 text-[#bbb]" />
              </span>
            )}
            <Star className="absolute right-3 top-3 size-5 fill-white text-white drop-shadow" />
          </span>
          <span className="mt-3 block truncate text-sm font-semibold text-[#222]">
            {title}
          </span>
          <span className="mt-1 block text-xs text-[#777]">
            {subtitle}
          </span>
        </button>
        );
      })}
    </div>
  );
}

function LibraryPanel({ onNewCollection }: { onNewCollection: () => void }) {
  const { libraryQuery, setLibraryQuery } = useDashboardStore();
  const router = useRouter();
  const imagesQuery = useCollectionImages();
  const { starImage } = useImageActions();
  const images = imagesQuery.data?.data ?? [];
  const [debouncedQuery, setDebouncedQuery] = useState(libraryQuery);
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [previewImage, setPreviewImage] = useState<CollectionImageRecord | null>(null);
  const [libraryPage, setLibraryPage] = useState(1);
  const collections = Array.from(
    new Map(
      images.map((image) => [
        image.collectionId,
        image.collectionName ?? "Collection",
      ]),
    ),
  );
  const normalizedQuery = debouncedQuery.trim().toLowerCase();
  const visiblePhotos = images.filter((image) => {
    const matchesCollection =
      collectionFilter === "all" || image.collectionId === collectionFilter;
    const text = [
      image.originalName,
      image.collectionName,
      image.setName,
      image.metadata?.filename,
      image.metadata?.title,
      image.metadata?.caption,
      image.metadata?.keyword,
      image.metadata?.camera,
      image.metadata?.lens,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return matchesCollection && (!normalizedQuery || text.includes(normalizedQuery));
  });
  const libraryPageSize = 48;
  const totalLibraryPages = Math.max(1, Math.ceil(visiblePhotos.length / libraryPageSize));
  const paginatedPhotos = visiblePhotos.slice(
    (libraryPage - 1) * libraryPageSize,
    libraryPage * libraryPageSize,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(libraryQuery), 300);
    return () => window.clearTimeout(timer);
  }, [libraryQuery]);

  useEffect(() => {
    setLibraryPage(1);
  }, [debouncedQuery, collectionFilter]);

  useEffect(() => {
    if (libraryPage > totalLibraryPages) setLibraryPage(totalLibraryPages);
  }, [libraryPage, totalLibraryPages]);

  return (
    <div className="mx-auto max-w-[1220px]">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(160px,max-content)_minmax(340px,480px)_240px_1fr]">
        <h1 className="whitespace-nowrap text-[28px] font-medium leading-none tracking-normal">
          Photo Library
        </h1>
        <div className="flex h-10 items-center bg-[#fafafa]">
          <Search className="ml-4 size-5 text-[#333]" />
          <Input
            value={libraryQuery}
            onChange={(event) => setLibraryQuery(event.target.value)}
            placeholder="Search images"
            className="h-10 rounded-none border-0 bg-transparent focus-visible:ring-0"
          />
        </div>
        <select
          value={collectionFilter}
          onChange={(event) => setCollectionFilter(event.target.value)}
          className="h-10 border bg-white px-3 text-sm outline-none"
        >
          <option value="all">All collections</option>
          {collections.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <div className="hidden justify-end lg:flex">
          <Button
            className="h-10 rounded-none bg-[#22bda7] px-6 text-sm font-bold text-white hover:bg-[#19a995]"
            onClick={onNewCollection}
          >
            New Collection
          </Button>
        </div>
      </div>

      {imagesQuery.isLoading ? (
        <p className="mt-10 text-sm text-[#666]">Loading images...</p>
      ) : (
      <div className="mt-10 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
        {paginatedPhotos.map((photo) => (
          <div
            key={photo._id}
            className="group text-left"
          >
            <span className="relative block bg-[#f3f3f3]">
              <span className="block overflow-hidden">
              <img
                src={imageSrc(photo.url)}
                alt={photo.originalName ?? ""}
                className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
              />
              </span>
              <span className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                <button
                  className="flex size-8 items-center justify-center bg-white/90 text-[#333] shadow-sm hover:text-[#00a997]"
                  onClick={() =>
                    starImage.mutate({
                      collectionId: photo.collectionId,
                      imageId: photo._id,
                      starred: photo.metadata?.starred !== true,
                    })
                  }
                  aria-label="Star image"
                >
                  <Star className={cn("size-4", photo.metadata?.starred === true && "fill-[#00a997] text-[#00a997]")} />
                </button>
                <button
                  className="flex size-8 items-center justify-center bg-white/90 text-[#333] shadow-sm hover:text-[#00a997]"
                  onClick={() => setPreviewImage(photo)}
                  aria-label="View image"
                >
                  <Eye className="size-4" />
                </button>
                <a
                  className="flex size-8 items-center justify-center bg-white/90 text-[#333] shadow-sm hover:text-[#00a997]"
                  href={imageSrc(photo.url)}
                  download={photo.originalName ?? "image"}
                  aria-label="Download image"
                >
                  <Download className="size-4" />
                </a>
                <button
                  className="flex size-8 items-center justify-center bg-white/90 text-[#333] shadow-sm hover:text-[#00a997]"
                  onClick={() => router.push(`/dashboard/client-gallery/collections/${photo.collectionId}`)}
                  aria-label="View in collection"
                >
                  <Images className="size-4" />
                </button>
              </span>
            </span>
          </div>
        ))}
      </div>
      )}

      {!imagesQuery.isLoading && visiblePhotos.length > libraryPageSize && (
        <div className="mt-6 flex items-center justify-end gap-3 text-sm">
          <Button
            variant="outline"
            className="h-9 rounded-none"
            disabled={libraryPage <= 1}
            onClick={() => setLibraryPage((page) => Math.max(1, page - 1))}
          >
            <ArrowLeft data-icon="inline-start" />
            Prev
          </Button>
          <span className="text-[#666]">
            {libraryPage} / {totalLibraryPages}
          </span>
          <Button
            variant="outline"
            className="h-9 rounded-none"
            disabled={libraryPage >= totalLibraryPages}
            onClick={() => setLibraryPage((page) => Math.min(totalLibraryPages, page + 1))}
          >
            Next
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      )}

      <Dialog open={Boolean(previewImage)} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-none sm:max-w-[92vw]">
          <DialogHeader>
            <DialogTitle>View Image</DialogTitle>
            <DialogDescription>
              Preview the selected library image.
            </DialogDescription>
          </DialogHeader>
          {previewImage && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4 text-sm text-[#666]">
                <span className="truncate">{previewImage.originalName ?? "Image"}</span>
                <span>
                  {formatMetaValue(previewImage.metadata?.width)} x {formatMetaValue(previewImage.metadata?.height)}
                </span>
              </div>
              <div className="flex max-h-[76dvh] items-center justify-center bg-[#f3f3f3]">
                <img
                  src={imageSrc(previewImage.url)}
                  alt={previewImage.originalName ?? ""}
                  className="max-h-[76dvh] max-w-full object-contain"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {!imagesQuery.isLoading && !visiblePhotos.length && (
        <div className="mx-auto mt-24 max-w-[360px] text-center">
          <p className="text-lg font-bold">No matching photos</p>
          <p className="mt-4 text-sm leading-6 text-[#555]">
            Try filename, collection, set, camera, lens, keyword, or title.
          </p>
          <Button
            className="mt-6 h-10 rounded-none bg-[#22bda7] px-8 text-sm font-bold text-white hover:bg-[#19a995]"
            onClick={() => {
              setLibraryQuery("");
              setCollectionFilter("all");
            }}
          >
            Show All Photos
          </Button>
        </div>
      )}
    </div>
  );
}

const settingsTabs = [
  { label: "Branding", page: "branding" },
  { label: "Watermark", page: "watermark" },
  { label: "Presets", page: "presets" },
  { label: "Email Templates", page: "email-templates" },
  { label: "Preferences", page: "preferences" },
  { label: "Integrations", page: "integrations" },
] as const;

const watermarkFonts = [
  "Times New Roman",
  "Georgia",
  "Playfair Display",
  "Helvetica",
  "Arial",
  "Courier New",
];

function SettingsPanel({
  section,
  settingsPage,
}: {
  section: DashboardSection;
  settingsPage: SettingsPage;
}) {
  const hydrateDashboardSettings = useDashboardStore(
    (state) => state.hydrateDashboardSettings,
  );
  const watermarkSettings = useDashboardSettings("watermark").query;
  const presetSettings = useDashboardSettings("preset").query;
  const emailTemplateSettings = useDashboardSettings("email-template").query;
  const activeTab =
    settingsPage === "preset-new"
      ? "presets"
      : settingsPage === "watermark-editor"
        ? "watermark"
        : settingsPage;

  useEffect(() => {
    const settings = [
      ...(watermarkSettings.data?.data ?? []),
      ...(presetSettings.data?.data ?? []),
      ...(emailTemplateSettings.data?.data ?? []),
    ];

    if (settings.length) {
      hydrateDashboardSettings(settings);
    }
  }, [
    emailTemplateSettings.data,
    hydrateDashboardSettings,
    presetSettings.data,
    watermarkSettings.data,
  ]);

  return (
    <div>
      <h1 className="text-[28px] font-medium leading-none">Settings</h1>
      <div className="mt-9 flex flex-wrap gap-8">
        {settingsTabs.map((tab) => (
          <Link
            key={tab.page}
            href={`/dashboard/${section}/settings/${tab.page}`}
            className={cn(
              "pb-2 text-sm font-semibold",
              activeTab === tab.page &&
                "underline decoration-[#22bda7] decoration-2 underline-offset-[10px]"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mt-9">
        {settingsPage === "watermark" ? (
          <WatermarkList section={section} />
        ) : settingsPage === "watermark-editor" ? (
          <WatermarkSettings section={section} />
        ) : settingsPage === "presets" ? (
          <PresetList section={section} />
        ) : settingsPage === "preset-new" ? (
          <PresetEditor section={section} />
        ) : settingsPage === "email-templates" ? (
          <EmailTemplatesPanel />
        ) : (
          <div className="max-w-[560px] bg-[#fafafa] p-8">
            <p className="font-bold">
              {settingsTabs.find((tab) => tab.page === settingsPage)?.label}
            </p>
            <p className="mt-3 text-sm leading-6 text-[#666]">
              Settings page ready.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function EmailTemplatesPanel() {
  const [editorOpen, setEditorOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const {
    addEmailTemplateDraft,
    activeEmailTemplateId,
    deleteEmailTemplate,
    emailTemplateSaved,
    emailTemplates,
    saveEmailTemplate,
    selectEmailTemplate,
    startCampaignBuilder,
    updateEmailTemplate,
  } = useDashboardStore();
  const { saveSetting, deleteSetting } =
    useDashboardSettings("email-template");
  const activeTemplate =
    emailTemplates.find((template) => template.id === activeEmailTemplateId) ??
    emailTemplates[0];
  const visibleTemplates = emailTemplates.filter((template) =>
    [template.name, template.subject, template.previewText]
      .join(" ")
      .toLowerCase()
      .includes(templateSearch.toLowerCase()),
  );
  const saveActiveTemplate = () => {
    if (!activeTemplate) return;
    const updatedAt = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    saveEmailTemplate();
    saveSetting.mutate({
      localId: activeTemplate.id,
      name: activeTemplate.name,
      data: { ...activeTemplate, updatedAt },
    });
  };
  const deleteActiveTemplate = () => {
    if (!activeTemplate) return;
    deleteEmailTemplate(activeTemplate.id);
    deleteSetting.mutate(activeTemplate.id);
    setEditorOpen(false);
  };
  const createTemplate = () => {
    addEmailTemplateDraft();
    setEditorOpen(true);
  };
  const editTemplate = (id: string) => {
    selectEmailTemplate(id);
    setEditorOpen(true);
  };

  if (!editorOpen) {
    return (
      <div>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <h2 className="text-[28px] font-medium leading-none">Email Templates</h2>
            <div className="flex h-10 w-[280px] items-center gap-3 bg-white">
              <Search className="size-5 text-[#333]" />
              <Input
                value={templateSearch}
                onChange={(event) => setTemplateSearch(event.target.value)}
                placeholder="Search"
                className="h-10 rounded-none border-0 px-0 focus-visible:ring-0"
              />
            </div>
          </div>
          <Button
            className="h-10 rounded-none bg-[#22bda7] px-7 text-sm font-bold text-white hover:bg-[#19a995]"
            onClick={createTemplate}
          >
            New Template
          </Button>
        </div>

        {!emailTemplates.length ? (
          <div className="mt-12 flex min-h-[520px] flex-col items-center justify-center text-center">
            <div className="relative">
              <div className="size-28 rounded-full bg-[#e5f0ef]" />
              <Mail className="absolute -left-3 top-3 size-10 text-[#444]" />
              <MailCheck className="absolute left-12 top-14 size-9 text-[#444]" />
            </div>
            <h3 className="mt-10 text-lg font-bold">Create your first email template</h3>
            <p className="mt-5 max-w-[430px] text-sm leading-6 text-[#333]">
              Saved templates from your account will appear here and can be used in Marketing email campaigns.
            </p>
            <Button
              className="mt-7 h-10 rounded-none bg-[#22bda7] px-7 text-sm font-bold text-white hover:bg-[#19a995]"
              onClick={createTemplate}
            >
              New Template
            </Button>
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[2fr_2fr_1.2fr_1.2fr_40px] border-b pb-4 text-[11px] font-bold uppercase tracking-widest text-[#777]">
                <span>Name</span>
                <span>Subject</span>
                <span>Status</span>
                <span>Last Updated</span>
                <span />
              </div>
              {visibleTemplates.map((template) => (
                <button
                  key={template.id}
                  className="grid w-full grid-cols-[2fr_2fr_1.2fr_1.2fr_40px] items-center border-b py-5 text-left text-sm hover:bg-[#fafafa]"
                  onClick={() => editTemplate(template.id)}
                >
                  <span className="font-bold">{template.name || "Untitled Template"}</span>
                  <span className="truncate pr-8 text-[#555]">
                    {template.subject || "-"}
                  </span>
                  <span>
                    <span className="rounded-full bg-[#f4f4f4] px-6 py-2 text-xs font-bold uppercase text-[#777]">
                      Draft
                    </span>
                  </span>
                  <span>{template.updatedAt || "-"}</span>
                  <MoreHorizontal className="size-5 text-[#777]" />
                </button>
              ))}
              {!visibleTemplates.length && (
                <div className="border-b py-12 text-center text-sm font-semibold text-[#777]">
                  No templates match your search.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!activeTemplate) return null;

  return (
    <div className="-mx-5 -mt-9">
      <div className="flex min-h-[72px] items-center justify-between gap-4 border-b border-[#eee] bg-white px-5">
        <div className="flex min-w-0 items-center gap-4">
          <button onClick={() => setEditorOpen(false)} aria-label="Back to templates">
            <ArrowLeft className="size-5 text-[#777]" />
          </button>
          <Input
            value={activeTemplate.name}
            onChange={(event) =>
              updateEmailTemplate({
                name: event.target.value,
                title: event.target.value,
              })
            }
            className="h-10 w-[260px] rounded-none border-0 px-0 text-lg font-semibold focus-visible:ring-0"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {emailTemplateSaved && (
            <span className="text-sm font-semibold text-[#00a997]">Saved</span>
          )}
          <Button
            variant="outline"
            className="h-10 rounded-none px-5 text-sm font-bold"
            onClick={() => startCampaignBuilder(activeTemplate.id)}
          >
            <Send className="size-4" />
            Use in Campaign
          </Button>
          <Button
            className="h-10 rounded-none bg-[#22bda7] px-7 text-sm font-bold text-white hover:bg-[#19a995]"
            onClick={saveActiveTemplate}
          >
            <Save className="size-4" />
            Save Template
          </Button>
          {emailTemplates.length > 1 && (
            <button
              className="flex items-center gap-2 text-sm font-bold text-red-600"
              onClick={deleteActiveTemplate}
            >
              <Trash2 className="size-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid min-h-[720px] lg:grid-cols-[minmax(420px,0.85fr)_minmax(460px,1fr)]">
        <section className="border-r p-7">
          <FieldGroup className="gap-7">
            <Field>
              <FieldLabel className="font-bold uppercase text-[#777]">Subject</FieldLabel>
              <Input
                className="h-12 rounded-none"
                value={activeTemplate.subject}
                onChange={(event) => updateEmailTemplate({ subject: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel className="font-bold uppercase text-[#777]">Preview Text</FieldLabel>
              <Input
                className="h-12 rounded-none"
                value={activeTemplate.previewText}
                onChange={(event) =>
                  updateEmailTemplate({ previewText: event.target.value })
                }
              />
            </Field>
            <Field>
              <FieldLabel className="font-bold uppercase text-[#777]">Email Title</FieldLabel>
              <Input
                className="h-12 rounded-none"
                value={activeTemplate.title}
                onChange={(event) => updateEmailTemplate({ title: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel className="font-bold uppercase text-[#777]">Hero Image</FieldLabel>
              <Input
                type="file"
                accept="image/*"
                className="h-12 rounded-none"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) updateEmailTemplate({ image: URL.createObjectURL(file) });
                }}
              />
            </Field>
            <Field>
              <FieldLabel className="font-bold uppercase text-[#777]">Message</FieldLabel>
              <Textarea
                className="min-h-[210px] resize-none rounded-none leading-6"
                value={activeTemplate.message}
                onChange={(event) => updateEmailTemplate({ message: event.target.value })}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel className="font-bold uppercase text-[#777]">Button Text</FieldLabel>
                <Input
                  className="h-12 rounded-none"
                  value={activeTemplate.buttonText}
                  onChange={(event) =>
                    updateEmailTemplate({ buttonText: event.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel className="font-bold uppercase text-[#777]">Button Link</FieldLabel>
                <Input
                  className="h-12 rounded-none"
                  value={activeTemplate.buttonLink}
                  onChange={(event) =>
                    updateEmailTemplate({ buttonLink: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field>
              <FieldLabel className="font-bold uppercase text-[#777]">Button Color</FieldLabel>
              <div className="flex gap-3">
                <Input
                  type="color"
                  className="h-12 w-16 rounded-none p-1"
                  value={activeTemplate.buttonColor}
                  onChange={(event) =>
                    updateEmailTemplate({ buttonColor: event.target.value })
                  }
                />
                <Input
                  className="h-12 rounded-none"
                  value={activeTemplate.buttonColor}
                  onChange={(event) =>
                    updateEmailTemplate({ buttonColor: event.target.value })
                  }
                />
              </div>
            </Field>
            <Field>
              <FieldLabel className="font-bold uppercase text-[#777]">Footer Text</FieldLabel>
              <Textarea
                className="min-h-[120px] resize-none rounded-none leading-6"
                value={activeTemplate.footerText}
                onChange={(event) =>
                  updateEmailTemplate({ footerText: event.target.value })
                }
              />
            </Field>
          </FieldGroup>
        </section>

        <div className="bg-[#f3f3f3]">
          <CampaignPreview
            buttonColor={activeTemplate.buttonColor}
            buttonLink={activeTemplate.buttonLink}
            buttonText={activeTemplate.buttonText}
            footerText={activeTemplate.footerText}
            image={activeTemplate.image}
            message={activeTemplate.message}
            previewText={activeTemplate.previewText}
            subject={activeTemplate.subject}
            template={activeTemplate.title}
          />
        </div>
      </div>
    </div>
  );
}

function PresetList({ section }: { section: DashboardSection }) {
  const { addPresetDraft, presetItems, selectPreset } = useDashboardStore();

  return (
    <div>
      <div className="flex items-center justify-between gap-6">
        <div>
          <h2 className="text-[28px] font-medium leading-none">Collection Presets</h2>
          <p className="mt-4 max-w-[560px] text-sm leading-6 text-[#666]">
            Presets save collection defaults by user and can be applied when creating a collection.
          </p>
        </div>
        <Link
          href={`/dashboard/${section}/settings/presets/new`}
          className="inline-flex h-10 items-center gap-2 rounded-none bg-[#22bda7] px-7 text-sm font-bold text-white"
          onClick={addPresetDraft}
        >
          <PlusCircle className="size-4" />
          Add Preset
        </Link>
      </div>

      {!presetItems.length ? (
        <div className="mt-12 flex min-h-[420px] flex-col items-center justify-center border bg-[#fafafa] text-center">
          <Wrench className="size-10 text-[#999]" />
          <p className="mt-5 font-bold">No presets yet</p>
          <p className="mt-2 max-w-[360px] text-sm leading-6 text-[#666]">
            Saved presets from your account will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[1.6fr_1.2fr_1.2fr_1.3fr_1.1fr_40px] border-b pb-4 text-[11px] font-bold uppercase tracking-widest text-[#777]">
              <span>Name</span>
              <span>Collection ID</span>
              <span>Photo Sets</span>
              <span>Default Watermark</span>
              <span>Last Updated</span>
              <span />
            </div>
            {presetItems.map((preset) => (
              <Link
                key={preset.id}
                href={`/dashboard/${section}/settings/presets/new`}
                className="grid grid-cols-[1.6fr_1.2fr_1.2fr_1.3fr_1.1fr_40px] items-center border-b py-5 text-left text-sm hover:bg-[#fafafa]"
                onClick={() => selectPreset(preset.id)}
              >
                <span className="font-bold">{preset.name || "Untitled Preset"}</span>
                <span className="truncate pr-6 text-[#555]">
                  {preset.collectionId || "-"}
                </span>
                <span className="truncate pr-6 text-[#555]">
                  {preset.general.photoSets || "-"}
                </span>
                <span className="truncate pr-6 text-[#555]">
                  {preset.general.defaultWatermark || "No watermark"}
                </span>
                <span>{preset.updatedAt || "-"}</span>
                <MoreHorizontal className="size-5 text-[#777]" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PresetEditor({ section }: { section: DashboardSection }) {
  const {
    activePresetId,
    addPresetDraft,
    deletePreset,
    presetCollectionId,
    presetFavorite,
    presetGeneral,
    presetDesign,
    presetDownload,
    presetEditorPanel,
    presetName,
    presetSaved,
    savePresetSettings,
    setPresetFavorite,
    setPresetGeneral,
    setPresetDesign,
    setPresetDownload,
    setPresetEditorPanel,
    setPresetCollectionId,
    setPresetName,
    presetStore,
    setPresetStore,
  } = useDashboardStore();
  const { saveSetting, deleteSetting } = useDashboardSettings("preset");
  useEffect(() => {
    if (!activePresetId) addPresetDraft();
  }, [activePresetId, addPresetDraft]);
  const sideItems = [
    { label: "General", panel: "general", icon: Wrench },
    { label: "Design", panel: "design", icon: Palette },
    { label: "Privacy", panel: "privacy", icon: Lock },
    { label: "Download", panel: "download", icon: Download },
    { label: "Favorite", panel: "favorite", icon: Heart },
    { label: "Store", panel: "store", icon: ShoppingCart },
  ] as const;
  const savePresetToDb = () => {
    const id = activePresetId || `preset-${Date.now()}`;
    const updatedAt = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    savePresetSettings();
    saveSetting.mutate({
      localId: id,
      name: presetName || "Collection Preset",
      collectionId: presetCollectionId || undefined,
      data: {
        id,
        name: presetName || "Collection Preset",
        collectionId: presetCollectionId || undefined,
        general: presetGeneral,
        design: presetDesign,
        download: presetDownload,
        favorite: presetFavorite,
        store: presetStore,
        updatedAt,
      },
    });
  };
  const deleteActivePreset = () => {
    if (!activePresetId) return;
    deletePreset(activePresetId);
    deleteSetting.mutate(activePresetId);
  };

  return (
    <div className="-mx-5 -mt-9 md:-mx-5">
      <div className="flex min-h-[72px] items-center justify-between border-b border-[#eee] bg-white px-5">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/${section}/settings/presets`}>
            <ArrowLeft className="size-5 text-[#777]" />
          </Link>
          <Input
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            className="h-10 w-[260px] rounded-none border-0 px-0 text-lg font-semibold focus-visible:ring-0"
          />
          <Input
            value={presetCollectionId}
            onChange={(event) => setPresetCollectionId(event.target.value)}
            placeholder="Collection ID (optional)"
            className="h-10 w-[230px] rounded-none border-0 px-0 text-sm focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center gap-4">
          {presetSaved && (
            <span className="text-sm font-semibold text-[#00a997]">Saved</span>
          )}
          <Link
            href={`/collection/${encodeURIComponent(presetName || "preset")}/sample-gallery`}
            className="text-sm font-semibold text-[#00a997]"
          >
            Preview Gallery
          </Link>
          <Button
            className="h-10 rounded-none bg-[#22bda7] px-8 text-sm font-bold text-white hover:bg-[#19a995]"
            onClick={savePresetToDb}
          >
          Save
          </Button>
          {activePresetId && (
            <button
              className="text-sm font-bold text-red-600"
              onClick={deleteActivePreset}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto grid max-w-[1000px] gap-16 px-5 py-10 md:grid-cols-[220px_1fr]">
        <div className="flex flex-col gap-7">
          {sideItems.map((item) => (
            <button
              key={item.label}
              className={cn(
                "flex items-center gap-6 border-l-2 py-1 pl-6 text-left text-base",
                presetEditorPanel === item.panel
                  ? "border-[#22bda7] font-semibold text-[#111]"
                  : "border-transparent text-[#777]"
              )}
              onClick={() => setPresetEditorPanel(item.panel)}
            >
              <item.icon className="size-5" />
              {item.label}
            </button>
          ))}
        </div>

        {presetEditorPanel === "general" && (
          <PresetGeneralPanel
            general={presetGeneral}
            onChange={setPresetGeneral}
            section={section}
          />
        )}
        {presetEditorPanel === "design" && (
          <PresetDesignPanel
            design={presetDesign}
            onChange={setPresetDesign}
          />
        )}
        {presetEditorPanel === "download" && (
          <PresetDownloadPanel
            download={presetDownload}
            onChange={setPresetDownload}
          />
        )}
        {presetEditorPanel === "favorite" && (
          <PresetFavoritePanel
            favorite={presetFavorite}
            onChange={setPresetFavorite}
            onBack={() => setPresetEditorPanel("download")}
            onNext={() => setPresetEditorPanel("store")}
          />
        )}
        {presetEditorPanel === "store" && (
          <PresetStorePanel
            store={presetStore}
            onBack={() => setPresetEditorPanel("favorite")}
            onChange={setPresetStore}
          />
        )}
        {!["general", "design", "download", "favorite", "store"].includes(presetEditorPanel) && (
          <div className="max-w-[560px]">
            <h2 className="text-2xl font-medium capitalize">
              {presetEditorPanel}
            </h2>
            <p className="mt-6 text-sm text-[#666]">
              {presetEditorPanel} settings ready.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PresetGeneralPanel({
  general,
  onChange,
  section,
}: {
  general: {
    collectionTags: string;
    photoSets: string;
    defaultWatermark: string;
    emailRegistration: boolean;
    galleryAssist: boolean;
    slideshow: boolean;
    socialSharing: boolean;
    language: string;
  };
  onChange: (value: Partial<typeof general>) => void;
  section: DashboardSection;
}) {
  const { watermarkItems } = useDashboardStore();
  return (
    <div className="max-w-[560px]">
      <h2 className="text-2xl font-medium">General</h2>
      <FieldGroup className="mt-8 gap-12">
        <Field>
          <FieldLabel className="font-bold">Collection Tags</FieldLabel>
          <Input
            value={general.collectionTags}
            onChange={(event) => onChange({ collectionTags: event.target.value })}
            placeholder="Optional"
            className="h-12 rounded-none bg-white px-5"
          />
          <p className="text-sm leading-6 text-[#666]">
            Add tags to categorize different collections e.g. wedding, outdoor,
            summer. <span className="text-[#00a997]">Learn more</span>
          </p>
        </Field>
        <Field>
          <FieldLabel className="font-bold">Photo Sets</FieldLabel>
          <Input
            value={general.photoSets}
            onChange={(event) => onChange({ photoSets: event.target.value })}
            placeholder="Highlights, Reception, Getting Ready"
            className="h-12 rounded-none bg-white px-5"
          />
          <p className="text-sm leading-6 text-[#666]">
            Separate photo sets by comma. e.g. Highlights, Reception, Getting Ready
          </p>
        </Field>
        <Field>
          <FieldLabel className="font-bold">Default Watermark</FieldLabel>
          <select
            value={general.defaultWatermark}
            onChange={(event) => onChange({ defaultWatermark: event.target.value })}
            className="h-12 rounded-none border bg-white px-5"
          >
            <option>No watermark</option>
            {watermarkItems.map((watermark) => (
              <option key={watermark.id} value={watermark.id}>{watermark.name}</option>
            ))}
          </select>
          <p className="text-sm leading-6 text-[#666]">
            Set default watermark. Manage watermarks in{" "}
            <Link href={`/dashboard/${section}/settings/watermark`} className="text-[#00a997]">
              App Settings
            </Link>.
          </p>
        </Field>

        <Field>
          <FieldLabel className="font-bold">
            Auto Expiry Reminder Email
          </FieldLabel>
          <div className="bg-[#eef7f9] p-5">
            <p className="font-bold">Upgrade for Premium Features</p>
            <p className="mt-2 text-sm leading-6 text-[#333]">
              Sending reminder emails to activity lists is only available for
              upgraded accounts. Default settings for activity lists will not
              apply until you have upgraded.
            </p>
            <button className="mt-3 text-sm font-semibold text-[#00a997]">
              Upgrade
            </button>
          </div>
          <button className="inline-flex items-center gap-2 text-sm font-semibold text-[#00a997]">
            <PlusCircle className="size-4" />
            Add expiry reminder email
          </button>
          <p className="text-sm leading-6 text-[#666]">
            Setup reminder emails that will send when you create a collection and
            add an Auto Expiry date.
          </p>
        </Field>

        {[
          [
            "Email Registration",
            "emailRegistration",
            "Track email addresses accessing this collection.",
          ],
          [
            "Gallery Assist",
            "galleryAssist",
            "Add walk-through cards to help visitors use the collection.",
          ],
          [
            "Slideshow",
            "slideshow",
            "Allow visitors to view the images in their collection as a slideshow.",
          ],
          [
            "Social Sharing",
            "socialSharing",
            "Allow collection visitors to share your work to social media.",
          ],
        ].map(([label, key, text]) => {
          const typedKey = key as
            | "emailRegistration"
            | "galleryAssist"
            | "slideshow"
            | "socialSharing";
          return (
            <Field key={key}>
              <FieldLabel className="font-bold">{label}</FieldLabel>
              <div className="flex items-center gap-3">
                <Switch
                  checked={general[typedKey]}
                  onCheckedChange={(value) =>
                    onChange({ [typedKey]: value } as Partial<typeof general>)
                  }
                />
                <span>{general[typedKey] ? "On" : "Off"}</span>
              </div>
              <p className="text-sm leading-6 text-[#666]">
                {text} <span className="text-[#00a997]">Learn more</span>
              </p>
              {key === "slideshow" && (
                <button className="inline-flex items-center gap-2 text-sm font-semibold text-[#00a997]">
                  Additional options <ChevronDown className="size-4" />
                </button>
              )}
            </Field>
          );
        })}

        <Field>
          <FieldLabel className="font-bold">Language</FieldLabel>
          <select
            value={general.language}
            onChange={(event) => onChange({ language: event.target.value })}
            className="h-12 rounded-none border bg-white px-5"
          >
            <option>English</option>
            <option>Bangla</option>
            <option>Spanish</option>
            <option>French</option>
          </select>
          <p className="text-sm leading-6 text-[#666]">
            Choose the language to display these collections in.
          </p>
        </Field>
      </FieldGroup>
    </div>
  );
}

function PresetFavoritePanel({
  favorite,
  onBack,
  onChange,
  onNext,
}: {
  favorite: {
    favoritePhotos: boolean;
    favoriteNotes: boolean;
  };
  onBack: () => void;
  onChange: (value: Partial<typeof favorite>) => void;
  onNext: () => void;
}) {
  return (
    <div className="max-w-[560px]">
      <h2 className="text-2xl font-medium">Favorite</h2>
      <FieldGroup className="mt-8 gap-12">
        <Field>
          <FieldLabel className="font-bold">Favorite Photos</FieldLabel>
          <div className="flex items-center gap-3">
            <Switch
              checked={favorite.favoritePhotos}
              onCheckedChange={(value) => onChange({ favoritePhotos: value })}
            />
            <span>{favorite.favoritePhotos ? "On" : "Off"}</span>
          </div>
          <p className="text-sm leading-6 text-[#666]">
            Allow visitors to favorite photos. You can review these afterwards in
            Favorite Activity.
          </p>
        </Field>
        <Field>
          <FieldLabel className="font-bold">Favorite Notes</FieldLabel>
          <div className="flex items-center gap-3">
            <Switch
              checked={favorite.favoriteNotes}
              onCheckedChange={(value) => onChange({ favoriteNotes: value })}
            />
            <span>{favorite.favoriteNotes ? "On" : "Off"}</span>
          </div>
          <p className="text-sm leading-6 text-[#666]">
            Allow clients to add notes to photos they have favorited.{" "}
            <span className="text-[#00a997]">Learn more</span>
          </p>
        </Field>
      </FieldGroup>
      <PresetPager onBack={onBack} onNext={onNext} />
    </div>
  );
}

function PresetStorePanel({
  onBack,
  onChange,
  store,
}: {
  onBack: () => void;
  onChange: (value: Partial<typeof store>) => void;
  store: {
    storeStatus: boolean;
    priceSheet: string;
    productPreview: boolean;
  };
}) {
  return (
    <div className="max-w-[560px]">
      <h2 className="text-2xl font-medium">Store</h2>
      <div className="mt-8 bg-[#eef7f9] p-6">
        <p className="font-bold">Activate Store</p>
        <p className="mt-4 text-sm leading-7 text-[#222]">
          Setup Nikoset Store to start selling prints, digital downloads, and
          more directly from your collections.
        </p>
        <button className="mt-3 text-sm font-semibold text-[#00a997]">
          Get Started
        </button>
      </div>

      <FieldGroup className="mt-12 gap-12">
        <Field>
          <FieldLabel className="font-bold">Store Status</FieldLabel>
          <div className="flex items-center gap-3">
            <Switch
              checked={store.storeStatus}
              onCheckedChange={(value) => onChange({ storeStatus: value })}
            />
            <span>{store.storeStatus ? "On" : "Off"}</span>
          </div>
          <p className="text-sm leading-6 text-[#666]">
            Allow visitors to purchase products from collections.
          </p>
        </Field>

        <Field>
          <FieldLabel className="font-bold">Price Sheet</FieldLabel>
          <select
            value={store.priceSheet}
            onChange={(event) => onChange({ priceSheet: event.target.value })}
            className="h-12 rounded-none border bg-white px-5"
          >
            <option>My Price Sheet</option>
            <option>Wedding Price Sheet</option>
            <option>Portrait Price Sheet</option>
          </select>
          <p className="text-sm leading-6 text-[#666]">
            Set which products are for sale in collections. Manage price sheets
            in <span className="text-[#00a997]">Store</span>
          </p>
        </Field>

        <Field>
          <FieldLabel className="font-bold">
            Personalized Product Preview
          </FieldLabel>
          <div className="flex items-center gap-3">
            <Switch
              checked={store.productPreview}
              onCheckedChange={(value) => onChange({ productPreview: value })}
            />
            <span>{store.productPreview ? "On" : "Off"}</span>
          </div>
          <p className="text-sm leading-6 text-[#666]">
            This feature is only available with a lab price sheet on our next
            generation Store system. Create a new Price Sheet to gain full access
            or select existing price sheet that matches requirements.
          </p>
        </Field>
      </FieldGroup>

      <div className="mt-14">
        <button className="inline-flex items-center gap-2 font-semibold" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </button>
      </div>
    </div>
  );
}

function PresetPager({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-14 flex justify-between">
      <button className="inline-flex items-center gap-2 font-semibold" onClick={onBack}>
        <ArrowLeft className="size-4" />
        Back
      </button>
      <button className="inline-flex items-center gap-2 font-semibold" onClick={onNext}>
        Next <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

const typographyOptions = [
  ["Sans", "SANS", "A neutral font"],
  ["Serif", "Serif", "A classic font"],
  ["Modern", "Modern", "A sophisticated font"],
  ["Timeless", "Timeless", "A light and airy font"],
  ["Bold", "BOLD", "A punchy font"],
  ["Subtle", "SUBTLE", "A minimal font"],
] as const;

const colorOptions = [
  ["Light", ["#ffffff", "#f7f7f7", "#303030"]],
  ["Gold", ["#fffdf8", "#f6efe6", "#a99167"]],
  ["Rose", ["#fbf7f6", "#f3eeee", "#a9807c"]],
  ["Terracotta", ["#fbf8f5", "#eee7e1", "#aa7b60"]],
  ["Sand", ["#f5f3f1", "#e8e3df", "#9f8f82"]],
  ["Olive", ["#f3f4f0", "#e9e9e3", "#96977a"]],
] as const;

function PresetDesignPanel({
  design,
  onChange,
}: {
  design: {
    cover: string;
    coverSmallTitle: string;
    coverTitle: string;
    coverDate: string;
    coverButtonText: string;
    showCoverSmallTitle: boolean;
    showCoverTitle: boolean;
    showCoverDate: boolean;
    showCoverButton: boolean;
    typography: string;
    color: string;
    gridStyle: "Vertical" | "Horizontal";
    thumbnailSize: "Regular" | "Large";
    gridSpacing: "Regular" | "Large";
    navigationStyle: "Icon Only" | "Icon & Text";
  };
  onChange: (value: Partial<typeof design>) => void;
}) {
  return (
    <div className="max-w-[700px]">
      <h2 className="text-2xl font-medium">Design</h2>
      <div className="mt-8 overflow-hidden border bg-[#f7f7f7] p-3">
        <CoverPreview design={design} className="min-h-[360px]" />
      </div>
      <OptionSection title="Cover Text">
        <FieldGroup className="gap-5">
          {([
            ["Small Title", "coverSmallTitle", "showCoverSmallTitle"],
            ["Title", "coverTitle", "showCoverTitle"],
            ["Date", "coverDate", "showCoverDate"],
            ["Button", "coverButtonText", "showCoverButton"],
          ] as const).map(([label, key, toggle]) => (
            <Field key={key}>
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={design[toggle]}
                  onCheckedChange={(value) => onChange({ [toggle]: Boolean(value) } as Partial<typeof design>)}
                />
                <FieldLabel className="font-bold">{label}</FieldLabel>
              </div>
              <Input
                value={design[key]}
                onChange={(event) => onChange({ [key]: event.target.value } as Partial<typeof design>)}
                className="mt-2 h-11 rounded-none bg-white"
              />
            </Field>
          ))}
        </FieldGroup>
      </OptionSection>
      <p className="mt-10 text-sm font-bold">Cover</p>
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">
        {coverOptions.map(([name]) => (
          <button key={name} className="text-center" onClick={() => onChange({ cover: name })}>
            <span className={cn("block border p-1", design.cover === name && "border-[#22bda7] ring-1 ring-[#22bda7]")}>
              <span className="relative block aspect-[1.45] overflow-hidden bg-white">
                <CoverPreview design={{ ...design, cover: name }} compact className="min-h-0" />
              </span>
            </span>
            <span className="mt-3 block text-sm">{name}</span>
          </button>
        ))}
      </div>

      <OptionSection title="Typography">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {typographyOptions.map(([name, sample, desc]) => (
            <button key={name} className="text-center" onClick={() => onChange({ typography: name })}>
              <span className={cn("block border p-8 text-left", design.typography === name && "border-[#22bda7] ring-1 ring-[#22bda7]")}>
                <span className="block text-xl tracking-widest">{sample}</span>
                <span className="mt-3 block text-sm text-[#555]">{desc}</span>
              </span>
              <span className="mt-3 block text-sm">{name}</span>
            </button>
          ))}
        </div>
      </OptionSection>

      <OptionSection title="Color">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {colorOptions.map(([name, colors]) => (
            <button key={name} className="text-center" onClick={() => onChange({ color: name })}>
              <span className={cn("flex h-[118px] items-center justify-center gap-2 border", design.color === name && "border-[#22bda7] ring-1 ring-[#22bda7]")}>
                {colors.map((color) => (
                  <span key={color} className="size-10 rounded-full border" style={{ backgroundColor: color }} />
                ))}
              </span>
              <span className="mt-3 block text-sm">{name}</span>
            </button>
          ))}
        </div>
      </OptionSection>

      <OptionSection title="Grid Style">
        <TwoOption value={design.gridStyle} a="Vertical" b="Horizontal" onPick={(value) => onChange({ gridStyle: value as "Vertical" | "Horizontal" })} />
      </OptionSection>
      <OptionSection title="Thumbnail Size">
        <TwoOption value={design.thumbnailSize} a="Regular" b="Large" onPick={(value) => onChange({ thumbnailSize: value as "Regular" | "Large" })} />
      </OptionSection>
      <OptionSection title="Grid Spacing">
        <TwoOption value={design.gridSpacing} a="Regular" b="Large" onPick={(value) => onChange({ gridSpacing: value as "Regular" | "Large" })} />
      </OptionSection>
      <OptionSection title="Navigation Style">
        <TwoOption value={design.navigationStyle} a="Icon Only" b="Icon & Text" onPick={(value) => onChange({ navigationStyle: value as "Icon Only" | "Icon & Text" })} />
      </OptionSection>
    </div>
  );
}

function OptionSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-14">
      <p className="mb-5 text-sm font-bold">{title}</p>
      {children}
    </section>
  );
}

function TwoOption({
  value,
  a,
  b,
  onPick,
}: {
  value: string;
  a: string;
  b: string;
  onPick: (value: string) => void;
}) {
  return (
    <div className="grid max-w-[340px] grid-cols-2 gap-2">
      {[a, b].map((item) => (
        <button key={item} className="text-center" onClick={() => onPick(item)}>
          <span className={cn("flex h-[108px] items-center justify-center border", value === item && "border-[#22bda7] ring-1 ring-[#22bda7]")}>
            <LayoutGrid className="size-7" />
          </span>
          <span className="mt-3 block text-sm">{item}</span>
        </button>
      ))}
    </div>
  );
}

function PresetDownloadPanel({
  download,
  onChange,
}: {
  download: {
    photoDownload: boolean;
    highResolution: boolean;
    highResolutionSize: "Original" | "3600px";
    webSize: boolean;
    webSizePx: "2048px" | "1024px" | "640px";
    videoDownload: boolean;
    downloadPin: boolean;
    downloadPinCode: string;
    restrictDownloads: boolean;
    limitDownloads: boolean;
    limitPinUsage: string;
  };
  onChange: (value: Partial<typeof download>) => void;
}) {
  return (
    <div className="max-w-[620px]">
      <FieldGroup className="gap-12">
        <Field>
          <FieldLabel className="font-bold">Photo Download</FieldLabel>
          <div className="flex items-center gap-3">
            <Switch checked={download.photoDownload} onCheckedChange={(value) => onChange({ photoDownload: value })} />
            <span>{download.photoDownload ? "On" : "Off"}</span>
          </div>
          <button className="inline-flex items-center gap-2 text-sm font-semibold text-[#00a997]">
            Additional options <ChevronDown className="size-4" />
          </button>
        </Field>

        <Field>
          <FieldLabel className="font-bold">Photo Downloadable Sizes</FieldLabel>
          <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox checked={download.highResolution} onCheckedChange={(value) => onChange({ highResolution: Boolean(value) })} />
              High Resolution
            </label>
            {(["Original", "3600px"] as const).map((size) => (
              <label key={size} className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={download.highResolutionSize === size}
                  onChange={() => onChange({ highResolutionSize: size })}
                />
                {size === "Original" ? "Original - Upgrade required. Upgrade" : size}
              </label>
            ))}
            <label className="flex items-center gap-2">
              <Checkbox checked={download.webSize} onCheckedChange={(value) => onChange({ webSize: Boolean(value) })} />
              Web Size
            </label>
            {(["2048px", "1024px", "640px"] as const).map((size) => (
              <label key={size} className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={download.webSizePx === size}
                  onChange={() => onChange({ webSizePx: size })}
                />
                {size}
              </label>
            ))}
          </div>
          <p className="text-sm leading-6 text-[#666]">
            Allow photos to be downloaded in select sizes.{" "}
            <span className="text-[#00a997]">Learn more</span>
          </p>
        </Field>

        {[
          ["Video Download", "videoDownload", "Allow videos to be downloaded for offline viewing."],
          ["Download PIN", "downloadPin", "If enabled, all collections created from this preset will have a download PIN set automatically."],
        ].map(([label, key, text]) => (
          <Field key={key}>
            <FieldLabel className="font-bold">{label}</FieldLabel>
            <div className="flex items-center gap-3">
              <Switch
                checked={download[key as "videoDownload" | "downloadPin"]}
                onCheckedChange={(value) =>
                  onChange({ [key]: value } as Partial<typeof download>)
                }
              />
              <span>{download[key as "videoDownload" | "downloadPin"] ? "On" : "Off"}</span>
            </div>
            <p className="text-sm leading-6 text-[#666]">
              {text} <span className="text-[#00a997]">Learn more</span>
            </p>
            {key === "downloadPin" && download.downloadPin && (
              <Input
                value={download.downloadPinCode}
                onChange={(event) => onChange({ downloadPinCode: event.target.value })}
                placeholder="Set download PIN"
                className="mt-3 h-12 rounded-none bg-white px-5"
              />
            )}
          </Field>
        ))}

        <div>
          <p className="mb-8 text-[11px] font-bold uppercase tracking-widest text-[#777]">
            Advanced Settings
          </p>
          <FieldGroup className="gap-12">
            {[
              ["Restrict Downloads to Collection Contacts", "restrictDownloads", "Allow only assigned Collection Contacts to download photos."],
              ["Limit Photo Downloads", "limitDownloads", "Set number of photos that can be downloaded in these collections."],
            ].map(([label, key, text]) => (
              <Field key={key}>
                <FieldLabel className="font-bold">{label}</FieldLabel>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={download[key as "restrictDownloads" | "limitDownloads"]}
                  onCheckedChange={(value) =>
                    onChange({ [key]: value } as Partial<typeof download>)
                  }
                  />
                  <span>{download[key as "restrictDownloads" | "limitDownloads"] ? "On" : "Off"}</span>
                </div>
                <p className="text-sm leading-6 text-[#666]">{text}</p>
                {key === "limitDownloads" && download.limitDownloads && (
                  <Input
                    value={download.limitPinUsage}
                    onChange={(event) => onChange({ limitPinUsage: event.target.value })}
                    placeholder="Number of downloads e.g. 5"
                    className="mt-3 h-12 rounded-none bg-white px-5"
                  />
                )}
              </Field>
            ))}
          </FieldGroup>
        </div>
      </FieldGroup>
    </div>
  );
}

function WatermarkList({ section }: { section: DashboardSection }) {
  const {
    addWatermarkDraft,
    selectWatermark,
    watermarkItems,
  } = useDashboardStore();

  return (
    <div className="max-w-[760px]">
      <div className="flex items-center justify-between gap-6">
        <div>
          <p className="text-sm font-bold">Watermarks</p>
          <p className="mt-3 max-w-[560px] text-sm leading-6 text-[#666]">
            Create multiple watermarks, then pick one as default inside collection
            presets.
          </p>
        </div>
        <Link
          href={`/dashboard/${section}/settings/watermark/new`}
          className="inline-flex h-10 items-center rounded-none bg-[#22bda7] px-6 text-sm font-bold text-white"
          onClick={addWatermarkDraft}
        >
          Add Watermark
        </Link>
      </div>

      {watermarkItems.length ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {watermarkItems.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/${section}/settings/watermark/${item.id}`}
              className="border bg-white p-5"
              onClick={() => selectWatermark(item.id)}
            >
              <div className="flex aspect-[1.5] items-center justify-center bg-[#f3f3f3]">
                {item.type === "text" ? (
                  <span
                    style={{
                      color: item.color,
                      fontFamily: item.font,
                      fontSize: `${Math.max(22, item.scale)}px`,
                      opacity: item.opacity / 100,
                    }}
                  >
                    {item.text || "Watermark"}
                  </span>
                ) : item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="max-h-[120px] max-w-[180px] object-contain"
                    style={{ opacity: item.opacity / 100 }}
                  />
                ) : (
                  <Images className="size-9 text-[#999]" />
                )}
              </div>
              <p className="mt-4 font-semibold">{item.name}</p>
              <p className="mt-1 text-sm text-[#777] capitalize">{item.type}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-10 flex min-h-[260px] flex-col items-center justify-center border bg-[#fafafa] text-center">
          <Images className="size-10 text-[#999]" />
          <p className="mt-5 font-bold">No watermarks yet</p>
          <p className="mt-2 max-w-[340px] text-sm leading-6 text-[#666]">
            Saved watermarks from your account will appear here.
          </p>
        </div>
      )}
    </div>
  );
}

function WatermarkSettings({ section }: { section: DashboardSection }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const {
    activeWatermarkId,
    watermarkApplyDownloads,
    watermarkColor,
    watermarkFont,
    watermarkImage,
    watermarkOpacity,
    watermarkPosition,
    watermarkSaved,
    watermarkScale,
    watermarkText,
    watermarkType,
    saveWatermarkSettings,
    setWatermarkApplyDownloads,
    setWatermarkColor,
    setWatermarkFont,
    setWatermarkImage,
    setWatermarkOpacity,
    setWatermarkPosition,
    setWatermarkScale,
    setWatermarkText,
    setWatermarkType,
  } = useDashboardStore();
  const { saveSetting } = useDashboardSettings("watermark");

  const clamp = (value: number, min = 5, max = 95) =>
    Math.max(min, Math.min(max, value));
  const safePosition = () => {
    const textPad =
      watermarkType === "text"
        ? Math.min(45, Math.max(5, ((watermarkText || "Watermark").length * Math.max(14, watermarkScale / 2)) / 12))
        : Math.min(45, Math.max(5, watermarkScale / 6));
    const yPad = Math.min(45, Math.max(5, watermarkScale / 10));

    return {
      x: clamp(watermarkPosition.x, textPad, 100 - textPad),
      y: clamp(watermarkPosition.y, yPad, 100 - yPad),
    };
  };
  const moveWatermark = (clientX: number, clientY: number) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    setWatermarkPosition({
      x: clamp(((clientX - rect.left) / rect.width) * 100),
      y: clamp(((clientY - rect.top) / rect.height) * 100),
    });
  };
  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (watermarkType !== "text") return;
    event.preventDefault();
    moveWatermark(event.clientX, event.clientY);
    const onMove = (moveEvent: globalThis.PointerEvent) =>
      moveWatermark(moveEvent.clientX, moveEvent.clientY);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const saveWatermarkToDb = () => {
    const position = safePosition();
    const watermark = {
      id: activeWatermarkId,
      name:
        watermarkType === "text"
          ? `${watermarkText || "Untitled"} text watermark`
          : "Image watermark",
      type: watermarkType,
      text: watermarkText,
      font: watermarkFont,
      color: watermarkColor,
      scale: watermarkScale,
      opacity: watermarkOpacity,
      position,
      image: watermarkImage,
      applyDownloads: watermarkApplyDownloads,
    };

    setWatermarkPosition(position);
    saveWatermarkSettings();
    saveSetting.mutate({
      localId: activeWatermarkId,
      name: watermark.name,
      data: watermark,
    });
  };

  return (
    <div className="grid gap-10 xl:grid-cols-[360px_1fr]">
      <div className="flex flex-col gap-8">
        <div>
          <Link
            href={`/dashboard/${section}/settings/watermark`}
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold"
          >
            <ArrowLeft className="size-4" />
            Back to Watermarks
          </Link>
          <p className="mb-4 text-sm font-bold">Watermark</p>
          <label className="flex size-[148px] cursor-pointer items-center justify-center bg-[#e9e9e9] text-2xl text-[#888]">
            +
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  setWatermarkImage(URL.createObjectURL(file));
                  setWatermarkType("image");
                }
              }}
            />
          </label>
          <p className="mt-4 max-w-[560px] text-sm leading-6 text-[#666]">
            Protect your photos with custom watermarks. Saved setting can apply
            to all future images.
          </p>
        </div>

        <div>
          <p className="mb-3 text-sm font-bold">Watermark Type</p>
          <div className="grid grid-cols-2 border bg-[#fafafa] p-1">
            {(["text", "image"] as const).map((type) => (
              <button
                key={type}
                className={cn(
                  "h-10 text-xs font-bold uppercase tracking-widest",
                  watermarkType === type && "bg-white shadow-sm"
                )}
                onClick={() => setWatermarkType(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {watermarkType === "text" ? (
          <FieldGroup className="gap-8">
            <Field>
              <FieldLabel className="font-bold">Watermark Text</FieldLabel>
              <Input
                value={watermarkText}
                onChange={(event) => setWatermarkText(event.target.value)}
                className="h-12 rounded-none bg-white px-5"
              />
            </Field>
            <Field>
              <FieldLabel className="font-bold">Font Style</FieldLabel>
              <select
                value={watermarkFont}
                onChange={(event) => setWatermarkFont(event.target.value)}
                className="h-12 rounded-none border bg-white px-5"
              >
                {watermarkFonts.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel className="font-bold">Font Color</FieldLabel>
              <div className="flex gap-3">
                {["#ffffff", "#000000", "#22bda7"].map((color) => (
                  <button
                    key={color}
                    className={cn(
                      "size-10 rounded-full border",
                      watermarkColor === color && "ring-2 ring-[#22bda7] ring-offset-2"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setWatermarkColor(color)}
                    aria-label={`Use ${color}`}
                  />
                ))}
                <Input
                  type="color"
                  value={watermarkColor}
                  onChange={(event) => setWatermarkColor(event.target.value)}
                  className="size-10 rounded-full p-1"
                />
              </div>
            </Field>
          </FieldGroup>
        ) : (
          <Field>
            <FieldLabel className="font-bold">Watermark Image</FieldLabel>
            <Input
              type="file"
              accept="image/*"
              className="h-12 rounded-none bg-white"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setWatermarkImage(URL.createObjectURL(file));
              }}
            />
          </Field>
        )}

        <FieldGroup className="gap-8">
          <Field>
            <FieldLabel className="flex items-center justify-between font-bold">
              Scale <span>{watermarkScale}%</span>
            </FieldLabel>
            <Slider
              value={[watermarkScale]}
              min={10}
              max={120}
              step={1}
              onValueChange={(value) => setWatermarkScale(value[0] ?? 70)}
            />
          </Field>
          <Field>
            <FieldLabel className="flex items-center justify-between font-bold">
              Opacity <span>{watermarkOpacity}%</span>
            </FieldLabel>
            <Slider
              value={[watermarkOpacity]}
              min={5}
              max={100}
              step={1}
              onValueChange={(value) => setWatermarkOpacity(value[0] ?? 90)}
            />
          </Field>
        </FieldGroup>

        <div>
          <p className="mb-3 text-sm font-bold">Position</p>
          <div className="grid w-36 grid-cols-3 gap-2 bg-[#fafafa] p-4">
            {[15, 50, 85].flatMap((y) =>
              [15, 50, 85].map((x) => (
                <button
                  key={`${x}-${y}`}
                  className={cn(
                    "size-4 rounded-full bg-[#d8d8d8]",
                    Math.abs(watermarkPosition.x - x) < 16 &&
                      Math.abs(watermarkPosition.y - y) < 16 &&
                      "bg-[#22bda7]"
                  )}
                  onClick={() => setWatermarkPosition({ x, y })}
                  aria-label={`Set watermark ${x} ${y}`}
                />
              ))
            )}
          </div>
          <p className="mt-3 text-sm text-[#666]">
            Text watermark drag works on preview.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={watermarkApplyDownloads}
            onCheckedChange={setWatermarkApplyDownloads}
          />
          <span className="text-sm font-medium">
            Apply watermark to web size downloads
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Button
            className="h-10 rounded-none bg-[#22bda7] px-8 text-sm font-bold text-white hover:bg-[#19a995]"
            onClick={saveWatermarkToDb}
          >
            Save Settings
          </Button>
          <Link
            href={`/dashboard/${section}/settings/watermark`}
            className="text-sm font-semibold text-[#00a997]"
          >
            Watermark List
          </Link>
          {watermarkSaved && (
            <span className="text-sm font-semibold text-[#00a997]">Saved</span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-8">
        <div
          ref={previewRef}
          className="relative aspect-[1.5] w-full max-w-[860px] overflow-hidden bg-[#f3f3f3]"
        >
          <img
            src="https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1400&q=80"
            alt="Watermark preview"
            className="h-full w-full object-cover"
          />
          {watermarkType === "text" ? (
            <button
              className="absolute cursor-grab select-none leading-none active:cursor-grabbing"
              style={{
                left: `${watermarkPosition.x}%`,
                top: `${watermarkPosition.y}%`,
                transform: "translate(-50%, -50%)",
                color: watermarkColor,
                fontFamily: watermarkFont,
                fontSize: `${Math.max(28, watermarkScale * 1.7)}px`,
                opacity: watermarkOpacity / 100,
              }}
              onPointerDown={startDrag}
            >
              {watermarkText || "Watermark"}
            </button>
          ) : watermarkImage ? (
            <img
              src={watermarkImage}
              alt="Uploaded watermark"
              className="absolute left-1/2 top-1/2 object-contain"
              style={{
                width: `${watermarkScale * 2.4}px`,
                opacity: watermarkOpacity / 100,
                transform: "translate(-50%, -50%)",
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">
              Upload watermark image
            </div>
          )}
        </div>
        <div className="flex gap-5 text-[#777]">
          <button className="rounded bg-[#eee] px-2 py-1">Desktop</button>
          <button className="px-2 py-1">Mobile</button>
        </div>
      </div>
    </div>
  );
}

function DashboardPlaceholder({
  page,
  title,
}: {
  page: DashboardPage;
  title: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-6">
        <div>
          <p className="text-sm text-[#777]">Dashboard</p>
          <h1 className="mt-2 text-[28px] font-medium">{title}</h1>
        </div>
        <Button className="h-10 rounded-none bg-[#22bda7] px-6 text-sm font-bold text-white hover:bg-[#19a995]">
          New {title}
        </Button>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {["Overview", "Recent Activity", "Quick Actions"].map((item) => (
          <div key={item} className="border bg-white p-6">
            <p className="text-sm font-bold text-[#222]">{item}</p>
            <p className="mt-3 text-sm leading-6 text-[#666]">
              {title} page ready at `/dashboard/[section]/{page}`.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HomepageSettings() {
  const [enabled, setEnabled] = useState(true);
  const [bio, setBio] = useState("");
  const [include, setInclude] = useState({
    biography: true,
    social: true,
    website: false,
    email: true,
    phone: true,
    address: true,
  });

  const toggleInclude = (key: keyof typeof include) =>
    setInclude((value) => ({ ...value, [key]: !value[key] }));

  return (
    <div>
      <h1 className="text-2xl font-semibold md:text-[28px]">Homepage</h1>

      <div className="mt-6 grid items-start gap-8 md:mt-8 lg:grid-cols-[minmax(320px,620px)_minmax(320px,1fr)] lg:gap-12">
        <div className="max-w-[620px] min-w-0">
          <section>
            <p className="text-sm font-bold">Homepage Status</p>
            <div className="mt-4 flex items-center gap-3">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <span className="text-sm font-medium">{enabled ? "On" : "Off"}</span>
            </div>
            <p className="mt-4 max-w-[560px] text-sm leading-6 text-[#667085]">
              Your Homepage is a public page where your collections are listed. You can also select
              which collections appear here under each collection's setting.{" "}
              <button className="font-semibold text-[#00a997]">Learn more</button>
            </p>
          </section>

          <section className="mt-12">
            <p className="text-sm font-bold">Homepage URL</p>
            <div className="mt-4 flex min-h-14 flex-wrap items-center justify-between gap-3 bg-[#f6f6f6] px-4 py-3 sm:px-5">
              <span className="truncate text-sm font-medium">https://rifat39.nikoset.com</span>
              <button className="flex items-center gap-2 text-sm font-bold text-[#00a997]">
                <Copy className="size-4" />
                Copy
              </button>
            </div>
          </section>

          <section className="mt-12">
            <p className="text-sm font-bold">Homepage Password</p>
            <div className="mt-4 flex min-h-14 flex-wrap items-center justify-between gap-3 border px-4 py-3 sm:px-5">
              <input
                type="password"
                placeholder="Add a password"
                className="h-10 min-w-[180px] flex-1 bg-transparent text-sm outline-none"
              />
              <button className="flex items-center gap-2 text-sm font-bold text-[#00a997]">
                <RefreshCw className="size-4" />
                Generate
              </button>
            </div>
            <p className="mt-3 text-sm text-[#667085]">Protect your Homepage with a password</p>
          </section>

          <section className="mt-12">
            <p className="text-sm font-bold">Biography</p>
            <div className="mt-4 border bg-white">
              <Textarea
                value={bio}
                onChange={(event) => setBio(event.target.value.slice(0, 500))}
                maxLength={500}
                className="min-h-44 resize-none rounded-none border-0 focus-visible:ring-0"
              />
              <p className="px-5 pb-3 text-xs font-semibold text-[#667085]">{bio.length} / 500</p>
            </div>
          </section>

          <section className="mt-12">
            <p className="text-sm font-bold">Homepage Info</p>
            <div className="mt-4 grid gap-3">
              {[
                ["biography", "Biography"],
                ["social", "Social Links"],
                ["website", "Website"],
                ["email", "Contact Email"],
                ["phone", "Phone Number"],
                ["address", "Business Address"],
              ].map(([key, label]) => (
                <label key={key} className="flex w-fit items-center gap-3 text-sm font-medium">
                  <Checkbox
                    checked={include[key as keyof typeof include]}
                    onCheckedChange={() => toggleInclude(key as keyof typeof include)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-4 max-w-[560px] text-sm leading-6 text-[#667085]">
              To update details, go to your <button className="font-semibold text-[#00a997]">profile</button>.
              Blank information will not appear on your homepage.
            </p>
          </section>

          <section className="mt-12">
            <p className="text-sm font-bold">Collection Sort Order</p>
            <select className="mt-4 h-14 w-full min-w-0 border bg-white px-4 text-sm font-bold outline-none sm:px-5">
              <option>Date created: New to Old</option>
              <option>Date created: Old to New</option>
              <option>Collection name: A to Z</option>
            </select>
            <p className="mt-3 text-sm text-[#667085]">
              Select order you wish collections to appear
            </p>
          </section>
        </div>

        <div className="sticky top-10 hidden min-h-[520px] items-center justify-center bg-[#f5f5f5] p-12 lg:flex">
          <div className="w-full max-w-[390px] bg-white p-7 shadow-[0_28px_60px_rgba(0,0,0,0.12)]">
            <div className="flex gap-2 text-[#b8b8b8]">
              {[0, 1, 2, 3].map((item) => (
                <span key={item} className="size-1.5 rounded-full bg-current" />
              ))}
            </div>
            <div className="mt-6 text-center">
              <p className="text-sm font-bold tracking-wide">RIFAT</p>
              <p className="mt-3 text-[10px] font-semibold">email@nikoset.com</p>
              <p className="mt-1 text-[10px] font-semibold">101 Main Street</p>
              <p className="mt-1 text-[10px] font-semibold">123-456-7890</p>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, item) => (
                <div key={item}>
                  <div className="aspect-[1.45] bg-[#d8d8d8]" />
                  <div className="mx-auto mt-3 h-1 w-12 bg-[#d8d8d8]" />
                  <div className="mx-auto mt-1.5 h-1 w-9 bg-[#d8d8d8]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchBox({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
}) {
  return (
    <Popover>
      <div className="flex h-10 items-center bg-[#fafafa]">
        <Search className="ml-4 size-5 text-[#333]" />
        <PopoverTrigger asChild>
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={"Search 'detail shots of rings'"}
            className="h-10 rounded-none border-0 bg-transparent focus-visible:ring-0"
          />
        </PopoverTrigger>
        <span className="mx-3 rounded border px-1 text-sm text-[#777]">/</span>
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex h-10 w-12 items-center justify-center border-l">
              <CalendarIcon className="size-4 text-[#777]" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto rounded-none p-0" align="end">
            <Calendar mode="single" />
          </PopoverContent>
        </Popover>
      </div>
      <PopoverContent className="w-[480px] rounded-none border-0 p-6 shadow-[0_18px_45px_rgba(0,0,0,0.12)]" align="start">
        <div className="flex flex-col gap-6">
          {libraryFilters.map((group) => (
            <div key={group.title}>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#777]">
                {group.title}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <button
                    key={item}
                    className="rounded-full bg-[#f3f3f3] px-3 py-2 text-sm text-[#444]"
                    onClick={() => onQueryChange(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="flex items-center gap-2 text-sm text-[#777]">
            <Info className="size-4" />
            Need help searching?{" "}
            <button className="text-[#00a997]" onClick={() => onQueryChange("Keyword")}>
              Learn more
            </button>
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const productTypeLabels: Record<StoreProductType, string> = {
  "digital-download": "Digital Download",
  "self-fulfilled": "Self Fulfilled Item",
};

const orderStatuses: StoreOrderStatus[] = [
  "pending",
  "processing",
  "fulfilled",
  "shipped",
  "delivered",
  "cancelled",
];

function StoreDashboardPanel() {
  const dashboardQuery = useStoreDashboard();
  const settingsQuery = useStoreSettings().settingsQuery;
  const currency = settingsQuery.data?.data?.currency ?? "EUR";
  const data = dashboardQuery.data?.data;
  const stats = [
    ["Revenue", money(data?.revenue ?? 0, currency)],
    ["Orders", String(data?.orderCount ?? 0)],
    ["Customers", String(data?.customerCount ?? 0)],
    ["Pending", String(data?.pending ?? 0)],
    ["Avg Order", money(data?.averageOrderValue ?? 0, currency)],
    ["Products", String(data?.productCount ?? 0)],
  ];

  return (
    <StorePageShell
      title="Store Dashboard"
      subtitle="Revenue, orders, customers, and fulfillment status."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="border bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-[#777]">{label}</p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="border bg-white">
          <StoreTableHeader title="Recent Orders" />
          <StoreTable
            columns={["Order", "Customer", "Status", "Total"]}
            rows={(data?.recentOrders ?? []).map((order) => [
              order.orderNumber,
              order.customer?.name ?? "Customer",
              <StatusBadge key="status" value={order.status} />,
              money(order.total, currency),
            ])}
            empty="No orders yet"
          />
        </div>
        <div className="border bg-white p-5">
          <p className="text-sm font-bold">Status Breakdown</p>
          <div className="mt-5 flex flex-col gap-3">
            {orderStatuses.map((status) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <span className="capitalize text-[#555]">{status}</span>
                <span className="font-bold">{data?.statusCounts?.[status] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </StorePageShell>
  );
}

function StoreOrdersPanel() {
  const { ordersQuery, createOrder, updateOrder, deleteOrder } = useStoreOrders();
  const { rulesQuery: shippingQuery } = useStoreRules<StoreShippingRecord>("shipping");
  const settingsQuery = useStoreSettings().settingsQuery;
  const currency = settingsQuery.data?.data?.currency ?? "EUR";
  const orders = ordersQuery.data?.data ?? [];
  const shippingMethods = shippingQuery.data?.data ?? [];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    itemName: "",
    quantity: "1",
    unitPrice: "0",
    tax: "0",
    shipping: "0",
    shippingMethodId: "",
    shippingNote: "",
    discount: "0",
    status: "pending" as StoreOrderStatus,
    trackingNumber: "",
  });

  const addOrder = () => {
    createOrder.mutate(
      {
        customer: { name: form.name, email: form.email, phone: form.phone },
        items: [
          {
            name: form.itemName || "Manual Product",
            type: "self-fulfilled",
            quantity: Number(form.quantity) || 1,
            unitPrice: Number(form.unitPrice) || 0,
          },
        ],
        tax: Number(form.tax) || 0,
        shipping: Number(form.shipping) || 0,
        shippingMethodId: form.shippingMethodId || undefined,
        shippingMethodName:
          shippingMethods.find((method) => method._id === form.shippingMethodId)?.name ?? "",
        shippingNote: form.shippingNote,
        discount: Number(form.discount) || 0,
        status: form.status,
        paymentStatus: "paid",
        trackingNumber: form.trackingNumber,
      } as any,
      {
        onSuccess: () => {
          setOpen(false);
          setForm({
            name: "",
            email: "",
            phone: "",
            itemName: "",
            quantity: "1",
            unitPrice: "0",
            tax: "0",
            shipping: "0",
            shippingMethodId: "",
            shippingNote: "",
            discount: "0",
            status: "pending",
            trackingNumber: "",
          });
        },
      },
    );
  };

  return (
    <StorePageShell
      title="Orders"
      subtitle="Track customer orders, fulfillment, shipping, and payment."
      action="Add Order"
      onAction={() => setOpen(true)}
    >
      <div className="border bg-white">
        <StoreTableHeader title={`${orders.length} Orders`} />
        <StoreTable
          columns={["Order", "Customer", "Items", "Shipping", "Tracking", "Status", "Payment", "Total", "Actions"]}
          rows={orders.map((order) => [
            order.orderNumber,
            <div key="customer">
              <p className="font-medium">{order.customer?.name}</p>
              <p className="text-xs text-[#777]">{order.customer?.email}</p>
            </div>,
            `${order.items?.length ?? 0} item`,
            <div key="shipping">
              <p>{money(order.shipping ?? 0, currency)}</p>
              <p className="text-xs text-[#777]">{order.shippingMethodName || order.shippingNote || "-"}</p>
            </div>,
            order.trackingNumber || "-",
            <select
              key="status"
              value={order.status}
              onChange={(event) =>
                updateOrder.mutate({
                  orderId: order._id,
                  payload: { status: event.target.value as StoreOrderStatus },
                })
              }
              className="h-8 border bg-white px-2 text-xs outline-none"
            >
              {orderStatuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>,
            <StatusBadge key="payment" value={order.paymentStatus} />,
            money(order.total, currency),
            <button
              key="delete"
              className="text-red-600"
              onClick={() => deleteOrder.mutate(order._id)}
              aria-label="Delete order"
            >
              <Trash2 className="size-4" />
            </button>,
          ])}
          empty="No orders yet"
        />
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Add Order</DialogTitle>
            <DialogDescription>Manual order entry with customer and tracking.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StoreInput label="Customer Name" value={form.name} onChange={(name) => setForm((v) => ({ ...v, name }))} />
              <StoreInput label="Email" value={form.email} onChange={(email) => setForm((v) => ({ ...v, email }))} />
              <StoreInput label="Phone" value={form.phone} onChange={(phone) => setForm((v) => ({ ...v, phone }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <StoreInput label="Item" value={form.itemName} onChange={(itemName) => setForm((v) => ({ ...v, itemName }))} />
              <StoreInput label="Qty" value={form.quantity} onChange={(quantity) => setForm((v) => ({ ...v, quantity }))} />
              <StoreInput label="Unit Price" value={form.unitPrice} onChange={(unitPrice) => setForm((v) => ({ ...v, unitPrice }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <StoreInput label="Tax" value={form.tax} onChange={(tax) => setForm((v) => ({ ...v, tax }))} />
              <StoreInput label="Discount" value={form.discount} onChange={(discount) => setForm((v) => ({ ...v, discount }))} />
              <StoreInput label="Tracking" value={form.trackingNumber} onChange={(trackingNumber) => setForm((v) => ({ ...v, trackingNumber }))} />
              <StoreInput label="Shipping Note" value={form.shippingNote} onChange={(shippingNote) => setForm((v) => ({ ...v, shippingNote }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel className="font-bold">Shipping Method</FieldLabel>
                <select
                  value={form.shippingMethodId}
                  onChange={(event) => {
                    const method = shippingMethods.find((item) => item._id === event.target.value);
                    setForm((value) => ({
                      ...value,
                      shippingMethodId: event.target.value,
                      shipping: method ? String(method.price ?? 0) : value.shipping,
                      shippingNote: method ? method.region ?? "" : value.shippingNote,
                    }));
                  }}
                  className="h-11 border bg-white px-3 text-sm outline-none"
                >
                  <option value="">Manual shipping</option>
                  {shippingMethods.map((method) => (
                    <option key={method._id} value={method._id}>
                      {method.name} - {money(method.price, currency)}
                    </option>
                  ))}
                </select>
              </Field>
              <StoreInput label="Shipping Charge" value={form.shipping} onChange={(shipping) => setForm((v) => ({ ...v, shipping }))} />
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="rounded-none bg-[#22bda7] text-white" disabled={!form.email.trim()} onClick={addOrder}>
              Save Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StorePageShell>
  );
}

function StoreCustomersPanel() {
  const { customersQuery, createCustomer } = useStoreCustomers();
  const settingsQuery = useStoreSettings().settingsQuery;
  const currency = settingsQuery.data?.data?.currency ?? "EUR";
  const customers = customersQuery.data?.data ?? [];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  const addCustomer = () => {
    createCustomer.mutate(form, {
      onSuccess: () => {
        setOpen(false);
        setForm({ name: "", email: "", phone: "" });
      },
    });
  };

  return (
    <StorePageShell
      title="Customers"
      subtitle="People who ordered. Repeat buyers are grouped by email."
      action="Add Customer"
      onAction={() => setOpen(true)}
    >
      <div className="border bg-white">
        <StoreTableHeader title={`${customers.length} Customers`} />
        <StoreTable
          columns={["Customer", "Phone", "Orders", "Total Spent", "Last Order"]}
          rows={customers.map((customer) => [
            <div key="name">
              <p className="font-medium">{customer.name}</p>
              <p className="text-xs text-[#777]">{customer.email}</p>
            </div>,
            customer.phone || "-",
            String(customer.orderCount ?? 0),
            money(customer.totalSpent ?? 0, currency),
            customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "-",
          ])}
          empty="No customers yet"
        />
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
            <DialogDescription>Customer records merge by email.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <StoreInput label="Name" value={form.name} onChange={(name) => setForm((v) => ({ ...v, name }))} />
            <StoreInput label="Email" value={form.email} onChange={(email) => setForm((v) => ({ ...v, email }))} />
            <StoreInput label="Phone" value={form.phone} onChange={(phone) => setForm((v) => ({ ...v, phone }))} />
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="rounded-none bg-[#22bda7] text-white" disabled={!form.email.trim()} onClick={addCustomer}>
              Save Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StorePageShell>
  );
}

function StoreCouponsPanel() {
  const { rulesQuery, saveRule, deleteRule } = useStoreRules<StoreCouponRecord>("coupons");
  const settingsQuery = useStoreSettings().settingsQuery;
  const currency = settingsQuery.data?.data?.currency ?? "EUR";
  const coupons = rulesQuery.data?.data ?? [];
  const [form, setForm] = useState({ code: "", name: "", discountType: "percent", amount: "" });
  return (
    <StorePageShell title="Coupons" subtitle="Discount codes for checkout.">
      <StoreRuleForm
        fields={[
          ["Code", form.code, (code) => setForm((v) => ({ ...v, code }))],
          ["Name", form.name, (name) => setForm((v) => ({ ...v, name }))],
          ["Amount", form.amount, (amount) => setForm((v) => ({ ...v, amount }))],
        ]}
        extra={
          <select
            value={form.discountType}
            onChange={(event) => setForm((v) => ({ ...v, discountType: event.target.value }))}
            className="h-11 border bg-white px-3 text-sm outline-none"
          >
            <option value="percent">Percent</option>
            <option value="fixed">Fixed</option>
          </select>
        }
        onSave={() => saveRule.mutate({ ...form, amount: Number(form.amount) } as Partial<StoreCouponRecord>)}
      />
      <StoreTable
        columns={["Code", "Name", "Type", "Amount", "Used", "Status", ""]}
        rows={coupons.map((coupon) => [
          coupon.code,
          coupon.name,
          coupon.discountType,
          coupon.discountType === "percent" ? `${coupon.amount}%` : money(coupon.amount, currency),
          String(coupon.usageCount ?? 0),
          <StatusBadge key="active" value={coupon.active ? "active" : "off"} />,
          <button key="delete" className="text-red-600" onClick={() => deleteRule.mutate(coupon._id)}>Delete</button>,
        ])}
        empty="No coupons yet"
      />
    </StorePageShell>
  );
}

function StoreTaxesPanel() {
  const { rulesQuery, saveRule, deleteRule } = useStoreRules<StoreTaxRecord>("taxes");
  const taxes = rulesQuery.data?.data ?? [];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    _id: "",
    region: "United States",
    rate: "0",
    applyShipping: true,
    applyDigitalDownloads: true,
  });

  const resetTaxForm = () => {
    setForm({
      _id: "",
      region: "United States",
      rate: "0",
      applyShipping: true,
      applyDigitalDownloads: true,
    });
  };

  const saveTax = () => {
    saveRule.mutate(
      {
        _id: form._id || undefined,
        name: `${form.region} Tax`,
        region: form.region,
        rate: Number(form.rate) || 0,
        applyShipping: form.applyShipping,
        applyDigitalDownloads: form.applyDigitalDownloads,
        active: true,
      } as Partial<StoreTaxRecord>,
      {
        onSuccess: () => {
          setOpen(false);
          resetTaxForm();
        },
      },
    );
  };

  return (
    <StorePageShell
      title="Taxes"
      subtitle="Country-wide sales tax rates for checkout."
      action="Add Tax Rate"
      onAction={() => {
        resetTaxForm();
        setOpen(true);
      }}
    >
      <div className="max-w-[920px]">
        <Tabs defaultValue="rates">
          <TabsList className="rounded-none border-b bg-transparent p-0">
            <TabsTrigger value="rates" className="h-14 rounded-none border border-b-0 px-5 data-[state=active]:bg-white">
              Tax Rates
            </TabsTrigger>
          </TabsList>
          <TabsContent value="rates" className="mt-8">
            <StoreTable
              columns={["Country", "Tax Rate", "Apply To", "Status", ""]}
              rows={taxes.map((tax) => [
                tax.region || "United States",
                `${tax.rate}%`,
                [
                  tax.applyShipping ? "Shipping" : "",
                  tax.applyDigitalDownloads ? "Digital Downloads" : "",
                ].filter(Boolean).join(", ") || "-",
                <StatusBadge key="active" value={tax.active ? "active" : "off"} />,
                <div key="actions" className="flex justify-end gap-4 text-[#00a997]">
                  <button
                    aria-label="Edit tax rate"
                    onClick={() => {
                      setForm({
                        _id: tax._id,
                        region: tax.region || "United States",
                        rate: String(tax.rate ?? 0),
                        applyShipping: tax.applyShipping ?? true,
                        applyDigitalDownloads: tax.applyDigitalDownloads ?? true,
                      });
                      setOpen(true);
                    }}
                  >
                    <Settings className="size-4" />
                  </button>
                  <button aria-label="Delete tax rate" onClick={() => deleteRule.mutate(tax._id)}>
                    <Trash2 className="size-4" />
                  </button>
                </div>,
              ])}
              empty="No tax rates yet"
            />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none p-0 sm:max-w-[700px]">
          <DialogHeader className="bg-[#f7f7f7] px-9 py-8">
            <DialogTitle className="text-base tracking-[0.18em]">ADD TAX RATE</DialogTitle>
            <DialogDescription className="sr-only">Create or edit tax rate.</DialogDescription>
          </DialogHeader>
          <div className="px-12 py-10">
            <FieldGroup className="gap-7">
              <Field>
                <FieldLabel className="font-bold">Country</FieldLabel>
                <select
                  value={form.region}
                  onChange={(event) => setForm((value) => ({ ...value, region: event.target.value }))}
                  className="h-12 w-full border bg-white px-4 text-base outline-none"
                >
                  <option>United States</option>
                  <option>Canada</option>
                  <option>United Kingdom</option>
                  <option>Bangladesh</option>
                  <option>Australia</option>
                  <option>Germany</option>
                </select>
                <p className="text-sm leading-6 text-[#7a828c]">
                  Add the country you would like to collect taxes from, then enter a country-wide sales tax rate.
                </p>
              </Field>
              <Field>
                <FieldLabel className="font-bold">Tax Rate (%)</FieldLabel>
                <Input
                  value={form.rate}
                  onChange={(event) => setForm((value) => ({ ...value, rate: event.target.value }))}
                  className="h-12 rounded-none text-base"
                  inputMode="decimal"
                />
              </Field>
              <label className="flex items-center gap-3 text-sm font-bold">
                <Checkbox
                  checked={form.applyShipping}
                  onCheckedChange={(checked) =>
                    setForm((value) => ({ ...value, applyShipping: Boolean(checked) }))
                  }
                />
                Apply Tax on Shipping
              </label>
              <label className="flex items-center gap-3 text-sm font-bold">
                <Checkbox
                  checked={form.applyDigitalDownloads}
                  onCheckedChange={(checked) =>
                    setForm((value) => ({
                      ...value,
                      applyDigitalDownloads: Boolean(checked),
                    }))
                  }
                />
                Apply Tax on Digital Downloads
              </label>
            </FieldGroup>
          </div>
          <DialogFooter className="px-12 pb-10">
            <Button variant="outline" className="rounded-none border-0" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-none bg-[#22bda7] px-8 text-white" onClick={saveTax}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StorePageShell>
  );
}

function StoreShippingPanel() {
  const { rulesQuery, saveRule, deleteRule } = useStoreRules<StoreShippingRecord>("shipping");
  const settingsQuery = useStoreSettings().settingsQuery;
  const currency = settingsQuery.data?.data?.currency ?? "EUR";
  const rates = rulesQuery.data?.data ?? [];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    _id: "",
    name: "",
    region: "United States",
    price: "",
    shipInternational: false,
  });

  const resetShippingForm = () => {
    setForm({
      _id: "",
      name: "",
      region: "United States",
      price: "",
      shipInternational: false,
    });
  };

  const saveShipping = () => {
    saveRule.mutate(
      {
        _id: form._id || undefined,
        name: form.name,
        region: form.shipInternational ? "International" : form.region,
        shipInternational: form.shipInternational,
        price: Number(form.price) || 0,
        active: true,
      } as Partial<StoreShippingRecord>,
      {
        onSuccess: () => {
          setOpen(false);
          resetShippingForm();
        },
      },
    );
  };

  return (
    <StorePageShell
      title="Shipping"
      subtitle="Create shipping methods for self fulfilled price sheets."
      action="Add Shipping Method"
      onAction={() => {
        resetShippingForm();
        setOpen(true);
      }}
    >
      <div className="max-w-[920px]">
        <Tabs defaultValue="self">
          <TabsList className="rounded-none border-b bg-transparent p-0">
            <TabsTrigger value="self" className="h-14 rounded-none border border-b-0 px-5 data-[state=active]:bg-white">
              Self Fulfillment
            </TabsTrigger>
            <TabsTrigger value="auto" className="h-14 rounded-none px-5 text-[#00a997]">
              Automatic Fulfillment
            </TabsTrigger>
          </TabsList>
          <TabsContent value="self" className="mt-8">
            <p className="max-w-[850px] text-sm leading-6 text-[#7a828c]">
              Create shipping methods that will apply to all your Self fulfillment price sheets.
              You will need to create at least one shipping method for the country you'd like to sell to.
            </p>
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-4 font-bold">Shipping method</th>
                    <th className="px-2 py-4 font-bold">Fee per order</th>
                    <th className="px-2 py-4 font-bold">Ships to</th>
                    <th className="px-2 py-4 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.length ? rates.map((rate) => (
                    <tr key={rate._id} className="border-b">
                      <td className="px-2 py-5">{rate.name}</td>
                      <td className="px-2 py-5">{money(rate.price, currency)}</td>
                      <td className="px-2 py-5">
                        {rate.shipInternational ? "International" : rate.region || "United States"}
                      </td>
                      <td className="px-2 py-5">
                        <div className="flex justify-end gap-4 text-[#00a997]">
                          <button
                            aria-label="Edit shipping method"
                            onClick={() => {
                              setForm({
                                _id: rate._id,
                                name: rate.name,
                                region: rate.region || "United States",
                                price: String(rate.price ?? 0),
                                shipInternational: Boolean(rate.shipInternational),
                              });
                              setOpen(true);
                            }}
                          >
                            <Settings className="size-4" />
                          </button>
                          <button
                            aria-label="Delete shipping method"
                            onClick={() => deleteRule.mutate(rate._id)}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-2 py-12 text-center text-[#777]">
                        No shipping methods yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
          <TabsContent value="auto" className="mt-8 border bg-[#fafafa] p-8 text-sm leading-6 text-[#667085]">
            Automatic fulfillment can be connected later when vendor integration is ready.
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none p-0 sm:max-w-[700px]">
          <DialogHeader className="bg-[#f7f7f7] px-9 py-8">
            <DialogTitle className="text-base tracking-[0.18em]">ADD SHIPPING METHOD</DialogTitle>
            <DialogDescription className="sr-only">Create or edit self fulfillment shipping method.</DialogDescription>
          </DialogHeader>
          <div className="px-12 py-10">
            <FieldGroup className="gap-7">
              <Field>
                <FieldLabel className="font-bold">Name this Shipping method</FieldLabel>
                <Input
                  value={form.name}
                  onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
                  placeholder="e.g. USPS Priority Mail Express, Fedex 2Days"
                  className="h-12 rounded-none text-base"
                />
                <p className="text-sm leading-6 text-[#7a828c]">
                  You can add multiple shipping methods for each country. Each order is charged a flat fee.
                </p>
              </Field>
              <Field>
                <FieldLabel className="font-bold">Flat fee per order</FieldLabel>
                <Input
                  value={form.price}
                  onChange={(event) => setForm((value) => ({ ...value, price: event.target.value }))}
                  placeholder="0.00"
                  className="h-12 rounded-none text-base"
                  inputMode="decimal"
                />
              </Field>
              <Field>
                <FieldLabel className="font-bold">Country</FieldLabel>
                <select
                  value={form.region}
                  onChange={(event) => setForm((value) => ({ ...value, region: event.target.value }))}
                  className="h-12 w-full border bg-white px-4 text-base outline-none"
                  disabled={form.shipInternational}
                >
                  <option>United States</option>
                  <option>Canada</option>
                  <option>United Kingdom</option>
                  <option>Bangladesh</option>
                  <option>Australia</option>
                  <option>Germany</option>
                </select>
                <p className="text-sm leading-6 text-[#7a828c]">
                  Specify which country this shipping method is assigned to.
                </p>
              </Field>
              <label className="flex items-center gap-3 text-sm font-bold">
                <Checkbox
                  checked={form.shipInternational}
                  onCheckedChange={(checked) =>
                    setForm((value) => ({ ...value, shipInternational: Boolean(checked) }))
                  }
                />
                Ship to international
              </label>
            </FieldGroup>
          </div>
          <DialogFooter className="px-12 pb-10">
            <Button variant="outline" className="rounded-none border-0" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-none bg-[#22bda7] px-8 text-white"
              disabled={!form.name.trim()}
              onClick={saveShipping}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StorePageShell>
  );
}

const defaultStoreSettings: StoreSettingsRecord = {
  globalStatus: false,
  currency: "EUR",
  orderDelay: "6 Hours",
  maintainMarkup: true,
  roundPricesUpTo: ".00",
  paymentMethods: {
    stripe: { enabled: false, accountLink: "", publishableKey: "", secretKey: "" },
  },
  links: [],
  domain: { hostname: "", dnsTarget: "store.nikoset.local", verified: false },
  giftCardSharingEmail: "",
  termsOfSale: "",
  digitalImageLicense: "",
};

function StoreSettingsPanel() {
  const { settingsQuery, saveSettings } = useStoreSettings();
  const [form, setForm] = useState<StoreSettingsRecord>(defaultStoreSettings);

  useEffect(() => {
    if (settingsQuery.data?.data) {
      setForm({
        ...defaultStoreSettings,
        ...settingsQuery.data.data,
        paymentMethods: {
          ...defaultStoreSettings.paymentMethods,
          ...(settingsQuery.data.data.paymentMethods ?? {}),
        },
        domain: {
          ...defaultStoreSettings.domain,
          ...(settingsQuery.data.data.domain ?? {}),
        },
        links: settingsQuery.data.data.links ?? [],
      });
    }
  }, [settingsQuery.data]);

  const setStripe = (value: Record<string, unknown>) => {
    setForm((current) => ({
      ...current,
      paymentMethods: {
        ...current.paymentMethods,
        stripe: { ...(current.paymentMethods.stripe ?? {}), ...value },
      },
    }));
  };

  const updateLink = (index: number, value: Partial<{ label: string; url: string }>) => {
    setForm((current) => ({
      ...current,
      links: current.links.map((link, itemIndex) =>
        itemIndex === index ? { ...link, ...value } : link,
      ),
    }));
  };

  return (
    <StorePageShell
      title="Store Settings"
      subtitle="Checkout, payment methods, domain/DNS, terms, and digital license."
      action={saveSettings.isPending ? "Saving..." : "Save Settings"}
      onAction={() => saveSettings.mutate(form)}
    >
      <div className="max-w-[760px]">
        <section className="border bg-white p-6">
          <p className="text-sm font-bold">Store Global Status</p>
          <div className="mt-4 flex items-center gap-3">
            <Switch
              checked={form.globalStatus}
              onCheckedChange={(globalStatus) =>
                setForm((current) => ({ ...current, globalStatus }))
              }
            />
            <span className="text-sm">{form.globalStatus ? "On" : "Off"}</span>
          </div>
          <p className="mt-3 text-xs text-[#777]">Turn store checkout on/off globally.</p>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-bold">Payment Methods</h2>
          <div className="mt-4 bg-[#f6f6f6] p-5">
            <div className="flex items-center justify-between gap-5">
              <div>
                <p className="text-lg font-bold">stripe</p>
                <p className="mt-2 text-sm text-[#667085]">
                  Client pays directly to this store owner's Stripe account.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={Boolean(form.paymentMethods.stripe?.enabled)}
                  onCheckedChange={(enabled) => setStripe({ enabled })}
                />
                <span className="text-xs">
                  {form.paymentMethods.stripe?.enabled ? "On" : "Off"}
                </span>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <StoreInput
                label="Publishable Key"
                value={form.paymentMethods.stripe?.publishableKey ?? ""}
                onChange={(publishableKey) => setStripe({ publishableKey })}
              />
              <Field>
                <FieldLabel className="font-bold">Secret Key</FieldLabel>
                <Input
                  type="password"
                  value={form.paymentMethods.stripe?.secretKey ?? ""}
                  onChange={(event) => setStripe({ secretKey: event.target.value })}
                  placeholder="Write secret key only when changing"
                  className="h-11 rounded-none bg-white"
                />
                <p className="text-xs text-[#777]">Write-only. Saved key is never shown again.</p>
              </Field>
              <StoreInput
                label="Stripe Account / Dashboard Link"
                value={form.paymentMethods.stripe?.accountLink ?? ""}
                onChange={(accountLink) => setStripe({ accountLink })}
              />
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6">
          <div>
            <p className="text-sm font-bold">Store Currency</p>
            <select
              value={form.currency}
              onChange={(event) =>
                setForm((current) => ({ ...current, currency: event.target.value }))
              }
              className="mt-3 h-11 w-full border bg-white px-3 text-sm outline-none"
            >
              <option value="EUR">Euro (EUR)</option>
              <option value="USD">United States (USD)</option>
              <option value="BDT">Bangladesh (BDT)</option>
              <option value="GBP">British Pound (GBP)</option>
            </select>
          </div>
          <div>
            <p className="text-sm font-bold">Order Delay</p>
            <select
              value={form.orderDelay}
              onChange={(event) =>
                setForm((current) => ({ ...current, orderDelay: event.target.value }))
              }
              className="mt-3 h-11 w-full border bg-white px-3 text-sm outline-none"
            >
              <option>None</option>
              <option>6 Hours</option>
              <option>12 Hours</option>
              <option>24 Hours</option>
            </select>
          </div>
          <div>
            <p className="text-sm font-bold">Maintain Markup Percentage</p>
            <div className="mt-3 flex items-center gap-3">
              <Switch
                checked={form.maintainMarkup}
                onCheckedChange={(maintainMarkup) =>
                  setForm((current) => ({ ...current, maintainMarkup }))
                }
              />
              <span className="text-sm">{form.maintainMarkup ? "On" : "Off"}</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold">Round prices up to</p>
            <select
              value={form.roundPricesUpTo}
              onChange={(event) =>
                setForm((current) => ({ ...current, roundPricesUpTo: event.target.value }))
              }
              className="mt-3 h-11 w-full border bg-white px-3 text-sm outline-none"
            >
              <option>.00</option>
              <option>.50</option>
              <option>.99</option>
            </select>
          </div>
        </section>

        <section className="mt-10 border bg-white p-6">
          <h2 className="text-sm font-bold">Domain / DNS Server</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <StoreInput
              label="Store Domain"
              value={form.domain.hostname ?? ""}
              onChange={(hostname) =>
                setForm((current) => ({
                  ...current,
                  domain: { ...current.domain, hostname },
                }))
              }
            />
            <StoreInput
              label="DNS Target"
              value={form.domain.dnsTarget ?? ""}
              onChange={(dnsTarget) =>
                setForm((current) => ({
                  ...current,
                  domain: { ...current.domain, dnsTarget },
                }))
              }
            />
          </div>
        </section>

        <section className="mt-10 border bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-bold">Checkout Links</h2>
            <button
              className="text-sm font-bold text-[#00a997]"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  links: [...current.links, { label: "", url: "" }],
                }))
              }
            >
              + Add link
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {form.links.map((link, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  value={link.label}
                  onChange={(event) => updateLink(index, { label: event.target.value })}
                  placeholder="Label"
                  className="h-11 rounded-none"
                />
                <Input
                  value={link.url}
                  onChange={(event) => updateLink(index, { url: event.target.value })}
                  placeholder="https://..."
                  className="h-11 rounded-none"
                />
                <Button
                  variant="outline"
                  className="h-11 rounded-none"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      links: current.links.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <Field>
            <FieldLabel className="font-bold">Gift Card Sharing Email</FieldLabel>
            <Input
              value={form.giftCardSharingEmail}
              onChange={(event) =>
                setForm((current) => ({ ...current, giftCardSharingEmail: event.target.value }))
              }
              className="mt-3 h-11 rounded-none"
              placeholder="Gift Card Sharing"
            />
          </Field>
        </section>

        <section className="mt-10">
          <Field>
            <FieldLabel className="font-bold">Terms of Sale</FieldLabel>
            <RichTextEditor
              value={form.termsOfSale}
              onChange={(termsOfSale) =>
                setForm((current) => ({ ...current, termsOfSale }))
              }
            />
          </Field>
        </section>

        <section className="mt-10">
          <Field>
            <FieldLabel className="font-bold">Digital Image License</FieldLabel>
            <RichTextEditor
              value={form.digitalImageLicense}
              onChange={(digitalImageLicense) =>
                setForm((current) => ({ ...current, digitalImageLicense }))
              }
            />
          </Field>
        </section>
      </div>
    </StorePageShell>
  );
}

function PaymentMethodRow({
  title,
  text,
  enabled,
  link,
  placeholder,
  onEnabled,
  onLink,
}: {
  title: string;
  text: string;
  enabled: boolean;
  link: string;
  placeholder: string;
  onEnabled: (value: boolean) => void;
  onLink: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 bg-[#f6f6f6] p-5 md:grid-cols-[120px_1fr_110px] md:items-center">
      <p className="font-bold">{title}</p>
      <div>
        <p className="text-sm font-semibold">{text}</p>
        <Input
          value={link}
          onChange={(event) => onLink(event.target.value)}
          placeholder={placeholder}
          className="mt-3 h-10 rounded-none bg-white"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={onEnabled} />
        <span className="text-xs">{enabled ? "On" : "Off"}</span>
      </div>
    </div>
  );
}

function StorePageShell({
  title,
  subtitle,
  action,
  onAction,
  children,
}: {
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[28px] font-medium leading-none">{title}</h1>
          <p className="mt-3 max-w-[680px] text-sm leading-6 text-[#666]">{subtitle}</p>
        </div>
        {action && (
          <Button className="h-10 w-fit rounded-none bg-[#22bda7] px-6 text-sm font-bold text-white" onClick={onAction}>
            <PlusCircle data-icon="inline-start" />
            {action}
          </Button>
        )}
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function StoreTableHeader({ title }: { title: string }) {
  return (
    <div className="flex h-14 items-center justify-between border-b px-5">
      <p className="text-sm font-bold">{title}</p>
    </div>
  );
}

function StoreTable({
  columns,
  rows,
  empty,
}: {
  columns: string[];
  rows: ReactNode[][];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto border bg-white">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="bg-[#fafafa] text-xs uppercase tracking-wide text-[#777]">
          <tr>
            {columns.map((column) => (
              <th key={column} className="border-b px-5 py-4 font-bold">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={index} className="border-b last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-5 py-4 align-middle text-[#333]">{cell}</td>
              ))}
            </tr>
          )) : (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center text-[#777]">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StoreInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel className="font-bold">{label}</FieldLabel>
      <Input value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-none" />
    </Field>
  );
}

function StoreRuleForm({
  fields,
  extra,
  onSave,
}: {
  fields: [string, string, (value: string) => void][];
  extra?: ReactNode;
  onSave: () => void;
}) {
  return (
    <div className="mb-6 border bg-[#fafafa] p-5">
      <div className="grid gap-4 md:grid-cols-4">
        {fields.map(([label, value, onChange]) => (
          <StoreInput key={label} label={label} value={value} onChange={onChange} />
        ))}
        {extra && <Field><FieldLabel className="font-bold">Type</FieldLabel>{extra}</Field>}
      </div>
      <Button className="mt-4 h-10 rounded-none bg-[#22bda7] px-6 text-white" onClick={onSave}>
        Save
      </Button>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const positive = ["paid", "delivered", "fulfilled", "active"].includes(value);
  const danger = ["cancelled", "refunded", "off"].includes(value);
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center px-3 text-xs font-bold capitalize",
        positive && "bg-[#e3f7f2] text-[#008b7d]",
        danger && "bg-[#fff0f0] text-red-600",
        !positive && !danger && "bg-[#f1f1f1] text-[#555]",
      )}
    >
      {value}
    </span>
  );
}

function money(value: number, currency = "EUR") {
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

function StoreProductsPanel() {
  const router = useRouter();
  const [collectionId, setCollectionId] = useState<string | undefined>();
  const { priceSheetsQuery, createPriceSheet } = useStorePriceSheets(collectionId);
  const sheets = priceSheetsQuery.data?.data ?? [];
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheetName, setSheetName] = useState("My Price Sheet");
  const [minimumOrderAmount, setMinimumOrderAmount] = useState("0");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCollectionId(params.get("collectionId") ?? undefined);
  }, []);

  const addSheet = () => {
    createPriceSheet.mutate(
      {
        name: sheetName.trim() || "My Price Sheet",
        isDefault: !sheets.length,
        collectionIds: collectionId ? [collectionId] : [],
        minimumOrderAmount: Number(minimumOrderAmount) || 0,
      },
      {
        onSuccess: (response) => {
          const id = response?.data?._id;
          if (id) router.push(`/dashboard/store-gallery/products/${id}`);
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-[950px]">
      <div className="flex items-center justify-between gap-5 border-b pb-4">
        <div>
          <h1 className="text-[26px] font-medium leading-none">Price Sheets</h1>
          {collectionId && (
            <p className="mt-3 text-sm text-[#777]">Showing sheets connected to this collection.</p>
          )}
        </div>
        <Button
          className="h-10 rounded-none bg-[#22bda7] px-6 text-sm font-bold text-white"
          onClick={() => setSettingsOpen(true)}
        >
          <PlusCircle data-icon="inline-start" />
          Add Price Sheet
        </Button>
      </div>

      {priceSheetsQuery.isLoading ? (
        <p className="mt-10 text-sm text-[#666]">Loading price sheets...</p>
      ) : !sheets.length ? (
        <div className="mt-8 flex min-h-[300px] flex-col items-center justify-center border bg-[#fafafa] p-8 text-center">
          <ShoppingCart className="size-10 text-[#999]" />
          <p className="mt-5 font-bold">No price sheets yet</p>
          <p className="mt-2 max-w-[420px] text-sm leading-6 text-[#666]">
            Create one sheet for digital downloads and self fulfilled products.
          </p>
          <Button
            className="mt-6 h-10 rounded-none bg-[#22bda7] px-7 text-sm font-bold text-white"
            onClick={() => setSettingsOpen(true)}
          >
            Add Price Sheet
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-7 sm:grid-cols-2">
          {sheets.map((sheet) => (
            <button
              key={sheet._id}
              className="group text-left"
              onClick={() => router.push(`/dashboard/store-gallery/products/${sheet._id}`)}
            >
              <span className="relative flex aspect-[1.8] items-center justify-center bg-[#f4f4f4]">
                {sheet.isDefault && (
                  <span className="absolute left-3 top-3 bg-[#e7e7e7] px-2 py-1 text-[10px] font-bold uppercase">
                    Default
                  </span>
                )}
                <CircleUserRound className="size-10 text-[#2f3438]" />
              </span>
              <span className="mt-4 flex items-center justify-between gap-4">
                <span className="font-bold uppercase">{sheet.name}</span>
                <MoreHorizontal className="size-5 text-[#00a997]" />
              </span>
              <span className="mt-2 block text-sm text-[#777]">
                {sheet.productCount ?? 0} Products &nbsp; {sheet.collectionCount ?? 0} Collection
              </span>
            </button>
          ))}
        </div>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="rounded-none sm:max-w-[630px]">
          <DialogHeader>
            <DialogTitle className="tracking-[0.18em]">PRICE SHEET SETTINGS</DialogTitle>
            <DialogDescription>
              Name, minimum order, and collection connection.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="general">
            <TabsList className="rounded-none">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="mt-7">
              <FieldGroup className="gap-7">
                <Field>
                  <FieldLabel className="font-bold">Price Sheet Name</FieldLabel>
                  <Input
                    value={sheetName}
                    onChange={(event) => setSheetName(event.target.value)}
                    className="h-12 rounded-none bg-white"
                  />
                </Field>
                <Field>
                  <FieldLabel className="font-bold">Fulfillment</FieldLabel>
                  <p className="text-sm">Self Fulfillment</p>
                </Field>
                <Field>
                  <FieldLabel className="font-bold">Minimum Order Amount</FieldLabel>
                  <Input
                    value={minimumOrderAmount}
                    onChange={(event) => setMinimumOrderAmount(event.target.value)}
                    className="h-12 rounded-none bg-white"
                    inputMode="decimal"
                  />
                </Field>
              </FieldGroup>
            </TabsContent>
            <TabsContent value="advanced" className="mt-7 text-sm leading-6 text-[#666]">
              Connected collections: {collectionId ? "1 selected" : "All collections can be assigned later"}
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-none bg-[#22bda7] text-white"
              disabled={createPriceSheet.isPending}
              onClick={addSheet}
            >
              {createPriceSheet.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StorePriceSheetDetail({ priceSheetId }: { priceSheetId: string }) {
  const router = useRouter();
  const { priceSheetQuery, updatePriceSheet, createProduct, deleteProduct } =
    useStorePriceSheet(priceSheetId);
  const settingsQuery = useStoreSettings().settingsQuery;
  const currency = settingsQuery.data?.data?.currency ?? "EUR";
  const sheet = priceSheetQuery.data?.data;
  const products = sheet?.products ?? [];
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [productType, setProductType] = useState<StoreProductType>("self-fulfilled");
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    minimumOrderAmount: "0",
  });

  useEffect(() => {
    if (!sheet) return;
    setSettingsForm({
      name: sheet.name,
      minimumOrderAmount: String(sheet.minimumOrderAmount ?? 0),
    });
  }, [sheet]);

  const groupedProducts = products.reduce<Record<string, StoreProductRecord[]>>(
    (groups, product) => {
      const key = product.type === "digital-download" ? "Digital Downloads" : product.category || "Prints";
      groups[key] = [...(groups[key] ?? []), product];
      return groups;
    },
    {},
  );

  const saveSettings = () => {
    updatePriceSheet.mutate(
      {
        name: settingsForm.name.trim() || sheet?.name,
        minimumOrderAmount: Number(settingsForm.minimumOrderAmount) || 0,
      },
      { onSuccess: () => setSettingsOpen(false) },
    );
  };

  if (!sheet) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[#666]">
        Loading price sheet...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[855px] px-5 py-8">
      <button
        className="inline-flex items-center gap-2 text-sm text-[#777]"
        onClick={() => router.push("/dashboard/store-gallery")}
      >
        <ArrowLeft className="size-4" />
        Price Sheets
      </button>

      <div className="mt-7 flex items-center justify-between gap-5 border-b pb-5">
        <div className="flex items-center gap-4">
          <h1 className="text-[26px] font-medium">{sheet.name}</h1>
          {sheet.isDefault && (
            <span className="bg-[#e7e7e7] px-2 py-1 text-[10px] font-bold uppercase">
              Default
            </span>
          )}
        </div>
        <div className="flex items-center gap-5">
          <button className="text-[#333]" aria-label="More">
            <MoreHorizontal className="size-5" />
          </button>
          <button
            className="inline-flex items-center gap-2 text-sm text-[#333]"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="size-4" />
            Settings
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-10 rounded-none bg-[#22bda7] px-6 text-sm font-bold text-white">
                <PlusCircle data-icon="inline-start" />
                Add Product
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[300px] rounded-none border-[#dedede] p-5 shadow-[0_18px_35px_rgba(0,0,0,0.18)]" align="end">
              <DropdownMenuGroup className="flex flex-col gap-4">
                {([
                  {
                    type: "self-fulfilled",
                    icon: Images,
                    title: "Self Fulfilled Item",
                    text: "Items to be fulfilled manually by yourself at your preferred vendor.",
                  },
                  {
                    type: "digital-download",
                    icon: Download,
                    title: "Digital Download",
                    text: "Digital files are automatically delivered via a secure link.",
                  },
                ] as const).map((item) => (
                  <DropdownMenuItem
                    key={item.type}
                    className="cursor-pointer items-start gap-4 rounded-none p-2"
                    onClick={() => {
                      setProductType(item.type);
                      setProductOpen(true);
                    }}
                  >
                    <item.icon className="mt-1 size-5 text-[#8a949e]" />
                    <span>
                      <span className="block font-bold text-[#222]">{item.title}</span>
                      <span className="mt-1 block text-sm leading-5 text-[#7a828c]">
                        {item.text}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-7 bg-[#f7f7f7] p-7">
        <p className="mb-5 text-xs font-bold uppercase tracking-wide">Price Sheet Details</p>
        <div className="grid gap-7 text-sm sm:grid-cols-3">
          <DetailStat label="Name" value={sheet.name} />
          <DetailStat label="Assigned To" value={`${sheet.collectionCount ?? 0} Collection`} />
          <DetailStat label="Fulfillment" value="Self Fulfillment" />
          <DetailStat label="Minimum Order Value" value={money(sheet.minimumOrderAmount ?? 0, currency)} />
          <DetailStat label="Available Products" value={`${products.length} Items`} />
        </div>
      </div>

      {products.length ? (
        <div className="mt-9 flex flex-col gap-12">
          {Object.entries(groupedProducts).map(([category, items]) => (
            <section key={category}>
              <h2 className="text-lg font-medium">{category}</h2>
              <div className="mt-5 grid gap-8 border-t pt-5 sm:grid-cols-2 md:grid-cols-4">
                {items.map((product) => (
                  <ProductTile
                    key={product._id}
                    product={product}
                    currency={currency}
                    onDelete={() => deleteProduct.mutate(product._id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-9 flex min-h-[260px] flex-col items-center justify-center border bg-[#fafafa] p-8 text-center">
          <Package className="size-10 text-[#aaa]" />
          <p className="mt-5 font-bold">No products yet</p>
          <p className="mt-2 text-sm text-[#666]">Add digital downloads or self fulfilled items.</p>
        </div>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="rounded-none sm:max-w-[630px]">
          <DialogHeader>
            <DialogTitle className="tracking-[0.18em]">PRICE SHEET SETTINGS</DialogTitle>
            <DialogDescription>General settings for this sheet.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-7">
            <Field>
              <FieldLabel className="font-bold">Price Sheet Name</FieldLabel>
              <Input
                value={settingsForm.name}
                onChange={(event) =>
                  setSettingsForm((value) => ({ ...value, name: event.target.value }))
                }
                className="h-12 rounded-none"
              />
            </Field>
            <Field>
              <FieldLabel className="font-bold">Fulfillment</FieldLabel>
              <p className="text-sm">Self Fulfillment</p>
            </Field>
            <Field>
              <FieldLabel className="font-bold">Minimum Order Amount</FieldLabel>
              <Input
                value={settingsForm.minimumOrderAmount}
                onChange={(event) =>
                  setSettingsForm((value) => ({
                    ...value,
                    minimumOrderAmount: event.target.value,
                  }))
                }
                className="h-12 rounded-none"
              />
              <p className="text-sm text-[#777]">
                Your clients must meet this order amount in order to checkout.
              </p>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-none bg-[#22bda7] text-white" onClick={saveSettings}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductEditorDialog
        open={productOpen}
        type={productType}
        pending={createProduct.isPending}
        onOpenChange={setProductOpen}
        onSave={(payload) =>
          createProduct.mutate(payload, { onSuccess: () => setProductOpen(false) })
        }
      />
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase">{label}</p>
      <p className="mt-3">{value}</p>
    </div>
  );
}

function ProductTile({
  product,
  currency,
  onDelete,
}: {
  product: StoreProductRecord;
  currency: string;
  onDelete: () => void;
}) {
  return (
    <div className="group">
      <div className="relative flex aspect-square items-center justify-center bg-[#f3f3f3]">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt="" className="h-full w-full object-cover" />
        ) : product.type === "digital-download" ? (
          <Download className="size-9 text-[#999]" />
        ) : (
          <Package className="size-9 text-[#999]" />
        )}
        <button
          className="absolute right-2 top-2 hidden size-8 items-center justify-center bg-white text-red-600 shadow-sm group-hover:flex"
          onClick={onDelete}
          aria-label="Delete product"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{product.name}</p>
          <p className="mt-1 text-sm text-[#777]">From {money(product.price || 0, currency)}</p>
          <p className="mt-1 text-xs text-[#999]">{productTypeLabels[product.type]}</p>
        </div>
        <MoreHorizontal className="size-5 shrink-0 text-[#00a997]" />
      </div>
    </div>
  );
}

function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      UnderlineExtension,
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-36 px-4 py-3 text-sm leading-6 outline-none [&_a]:text-[#00a997] [&_a]:underline [&_p]:mb-2",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (current !== next) editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  const setLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("URL", previous ?? "https://");
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  };

  const tools = [
    {
      label: "Bold",
      icon: Bold,
      active: editor?.isActive("bold") ?? false,
      action: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: Italic,
      active: editor?.isActive("italic") ?? false,
      action: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: "Underline",
      icon: Underline,
      active: editor?.isActive("underline") ?? false,
      action: () => editor?.chain().focus().toggleUnderline().run(),
    },
    {
      label: "Link",
      icon: Link2,
      active: editor?.isActive("link") ?? false,
      action: setLink,
    },
    {
      label: "Unlink",
      icon: Unlink,
      active: false,
      action: () => editor?.chain().focus().unsetLink().run(),
    },
  ];

  return (
    <div className="border bg-white">
      <div className="flex h-9 items-center border-b">
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            className={cn(
              "flex h-9 w-10 items-center justify-center border-r text-[#1f2937]",
              tool.active && "bg-[#e8f7f4] text-[#00a997]",
            )}
            onClick={tool.action}
            aria-label={tool.label}
          >
            <tool.icon className="size-4" />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ProductEditorDialog({
  open,
  type,
  pending,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  type: StoreProductType;
  pending: boolean;
  onOpenChange: (value: boolean) => void;
  onSave: (payload: StoreProductPayload) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    extraShipping: "0",
    category: "Prints",
    images: [] as string[],
    downloadType: "single-photo" as "single-photo" | "all-photos",
    downloadSize: "High Resolution Original (Full res)",
    noImageRequired: false,
    exemptFromSalesTax: false,
    limitOnePerCheckout: false,
    allowBulkPurchase: false,
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      name:
        type === "digital-download"
          ? "Single Photo Download (High Resolution)"
          : "",
      description: "",
      price: "",
      extraShipping: "0",
      category: type === "digital-download" ? "Digital Downloads" : "Prints",
      images: [],
      downloadType: "single-photo",
      downloadSize: "High Resolution Original (Full res)",
      noImageRequired: false,
      exemptFromSalesTax: false,
      limitOnePerCheckout: false,
      allowBulkPurchase: false,
    });
  }, [open, type]);

  const save = () => {
    const name = form.name.trim();
    if (!name) return;
    onSave({
      type,
      name,
      description: form.description,
      price: Number(form.price) || 0,
      extraShipping: Number(form.extraShipping) || 0,
      category: form.category,
      images: form.images,
      downloadType: type === "digital-download" ? form.downloadType : undefined,
      downloadSize: type === "digital-download" ? form.downloadSize : undefined,
      noImageRequired: form.noImageRequired,
      exemptFromSalesTax: form.exemptFromSalesTax,
      limitOnePerCheckout: form.limitOnePerCheckout,
      allowBulkPurchase: form.allowBulkPurchase,
    });
  };
  const pickImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const images = await Promise.all(
      Array.from(files).map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    );
    setForm((current) => ({ ...current, images: [...current.images, ...images] }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-none sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>
            {type === "digital-download" ? "Add Digital Download" : "Add Product"}
          </DialogTitle>
          <DialogDescription>{productTypeLabels[type]}</DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-7">
          {type === "digital-download" && (
            <Field>
              <FieldLabel className="font-bold">Download Type</FieldLabel>
              <div className="flex gap-4">
                {([
                  ["single-photo", Images, "Single Photo"],
                  ["all-photos", LayoutGrid, "All Photos"],
                ] as const).map(([value, Icon, label]) => (
                  <button
                    key={value}
                    className={cn(
                      "flex size-24 flex-col items-center justify-center border text-xs",
                      form.downloadType === value && "border-[#22bda7]",
                    )}
                    onClick={() => setForm((current) => ({ ...current, downloadType: value }))}
                  >
                    <Icon className="mb-3 size-6" />
                    {label}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {type === "digital-download" && (
            <Field>
              <FieldLabel className="font-bold">Download Size</FieldLabel>
              <select
                value={form.downloadSize}
                onChange={(event) =>
                  setForm((current) => ({ ...current, downloadSize: event.target.value }))
                }
                className="h-12 w-full border bg-white px-3 text-sm outline-none"
              >
                <option>High Resolution Original (Full res)</option>
                <option>High Resolution 3600px</option>
                <option>Web Size 2048px</option>
              </select>
            </Field>
          )}

          <Field>
            <FieldLabel className="font-bold">Product Images</FieldLabel>
            <label className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center border border-dashed bg-white text-center">
              <FileUp className="size-8 text-[#22bda7]" />
              <span className="mt-3 text-sm font-bold">Upload product photo</span>
              <span className="mt-1 text-xs text-[#777]">Shown in store product cards.</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  pickImages(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            {form.images.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-3">
                {form.images.map((image, index) => (
                  <div key={`${image.slice(0, 24)}-${index}`} className="group relative aspect-square bg-[#f3f3f3]">
                    <img src={image} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 hidden size-7 items-center justify-center bg-white text-red-600 shadow-sm group-hover:flex"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          images: current.images.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                      aria-label="Remove product image"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Field>

          <Field>
            <FieldLabel className="font-bold">Name</FieldLabel>
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder='e.g. 4x6" Print, 8x10" Print Metallic, 16x20" Canvas'
              className="h-12 rounded-none"
            />
          </Field>

          <Field>
            <FieldLabel className="font-bold">Description</FieldLabel>
            <RichTextEditor
              value={form.description}
              onChange={(description) =>
                setForm((current) => ({ ...current, description }))
              }
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel className="font-bold">Price</FieldLabel>
              <Input
                value={form.price}
                onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                placeholder="e.g. 0.00"
                className="h-12 rounded-none"
              />
            </Field>
            {type === "self-fulfilled" && (
              <Field>
                <FieldLabel className="font-bold">Extra shipping</FieldLabel>
                <Input
                  value={form.extraShipping}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, extraShipping: event.target.value }))
                  }
                  className="h-12 rounded-none"
                />
              </Field>
            )}
          </div>

          {type === "self-fulfilled" && (
            <Field>
              <FieldLabel className="font-bold">Category</FieldLabel>
              <select
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                className="h-12 w-full border bg-white px-3 text-sm outline-none"
              >
                <option>Prints</option>
                <option>Wall Art</option>
                <option>Albums</option>
                <option>Cards</option>
              </select>
            </Field>
          )}

          {type === "self-fulfilled" && (
            <div className="grid gap-5">
              {([
                ["noImageRequired", "No Image Required"],
                ["exemptFromSalesTax", "Exempt From Sales Tax"],
                ["limitOnePerCheckout", "Limit One Per Checkout"],
                ["allowBulkPurchase", "Allow Bulk Purchase"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-5 text-sm font-bold">
                  {label}
                  <Switch
                    checked={form[key]}
                    onCheckedChange={(value) =>
                      setForm((current) => ({ ...current, [key]: value }))
                    }
                  />
                </label>
              ))}
            </div>
          )}
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" className="rounded-none" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="rounded-none bg-[#22bda7] text-white"
            disabled={pending || !form.name.trim()}
            onClick={save}
          >
            {pending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CollectionsPanel({ section }: { section: DashboardSection }) {
  const { collectionsQuery, createCollection } = useCollections();
  const router = useRouter();
  const collections = collectionsQuery.data?.data ?? [];

  return (
    <div>
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-[28px] font-medium leading-none tracking-normal">
            {section === "client-gallery" ? "Collections" : "Products"}
          </h1>
          <p className="mt-3 max-w-[600px] text-sm leading-6 text-[#666]">
            Manage your collections — create, view, and organize your photos.
          </p>
        </div>
        <Button
          className="h-10 w-fit rounded-none bg-[#22bda7] px-6 text-sm font-bold text-white hover:bg-[#19a995]"
          onClick={() => router.push(`/dashboard/${section}/collection-new`)}
        >
          <PlusCircle className="mr-2 size-4" />
          Create Collection
        </Button>
      </div>

      {collectionsQuery.isLoading ? (
        <p className="mt-10 py-8 text-sm text-[#666]">Loading collections...</p>
      ) : !collections.length ? (
        <div className="mt-10 flex min-h-[360px] flex-col items-center justify-center border bg-[#fafafa] p-8 text-center">
          <Images className="size-10 text-[#999]" />
          <p className="mt-5 font-bold">No collections yet</p>
          <p className="mt-2 text-sm leading-6 text-[#666]">
            Create your first collection to get started.
          </p>
          <Button
            className="mt-6 h-10 rounded-none bg-[#22bda7] px-7 text-sm font-bold text-white hover:bg-[#19a995]"
            onClick={() => router.push(`/dashboard/${section}/collection-new`)}
          >
            Create Collection
          </Button>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {collections.map((collection) => (
            <button
              key={collection._id}
              className="group overflow-hidden border border-[#e6e6e6] bg-white text-left transition-shadow hover:shadow-lg"
              onClick={() => router.push(`/dashboard/${section}/collections/${collection._id}`)}
            >
              <span className="block aspect-[4/3] overflow-hidden bg-[#f2f2f2]">
                {collection.coverImage ? (
                  <img
                    src={imageSrc(collection.coverImage)}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center">
                    <Images className="size-10 text-[#ccc]" />
                  </span>
                )}
              </span>
              <span className="block border-t border-[#e6e6e6] p-4">
                <span className="block truncate text-base font-bold text-[#222]">
                  {collection.name}
                </span>
                <span className="mt-1 block text-sm text-[#666]">
                  {collection.imageCount ?? 0} images
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionNewPanel({ section }: { section: DashboardSection }) {
  const router = useRouter();
  const presetSettings = useDashboardSettings("preset").query;
  const { hydrateDashboardSettings, presetItems } = useDashboardStore();
  const { createCollection } = useCollections();
  const [form, setForm] = useState({ name: "", eventDate: "", presetId: "" });

  useEffect(() => {
    const settings = presetSettings.data?.data ?? [];
    if (settings.length) hydrateDashboardSettings(settings);
  }, [hydrateDashboardSettings, presetSettings.data]);

  const handleCreate = () => {
    const name = form.name.trim();
    if (!name) return;
    const preset = presetItems.find((item) => item.id === form.presetId);
    const eventLabel = form.eventDate ? format(parseISO(form.eventDate), "PPP") : "";
    const design = {
      ...(preset?.design ?? collectionDefaultDesign),
      coverSmallTitle: coverTextOrDefault(preset?.design.coverSmallTitle, preset?.name || "Your Studio"),
      coverTitle: coverTextOrDefault(preset?.design.coverTitle, name),
      coverDate: coverTextOrDefault(preset?.design.coverDate, eventLabel),
      coverButtonText: coverTextOrDefault(preset?.design.coverButtonText, "View Gallery"),
    };

    createCollection.mutate(
      {
        name,
        eventDate: form.eventDate || undefined,
        presetId: form.presetId || undefined,
        design,
        settings: {
          general: preset?.general ?? collectionDefaultGeneral,
          download: preset?.download ?? collectionDefaultDownload,
          favorite: preset?.favorite,
          store: preset?.store,
        },
      },
      {
        onSuccess: () => {
          router.push(`/dashboard/${section}`);
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-[686px]">
      <button
        className="mb-8 inline-flex items-center gap-2 text-sm text-[#666] hover:text-[#222]"
        onClick={() => router.push(`/dashboard/${section}`)}
      >
        <ArrowLeft className="size-4" />
        Back to Collections
      </button>
      <h1 className="text-[28px] font-medium leading-none tracking-normal">
        Create Collection
      </h1>
      <p className="mt-3 text-sm leading-6 text-[#666]">
        Set up a new collection with a name, date, and optional preset.
      </p>
      <div className="mt-8 bg-[#fafafa] p-8">
        <FieldGroup className="gap-8">
          <Field>
            <FieldLabel htmlFor="new-collection-name" className="font-bold">
              Collection Name
            </FieldLabel>
            <Input
              id="new-collection-name"
              value={form.name}
              onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
              placeholder="e.g. Jessie & Ryan"
              className="mt-2 h-12 rounded-none bg-white px-5"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-event-date" className="font-bold">
              Event Date
            </FieldLabel>
            <Input
              id="new-event-date"
              type="date"
              value={form.eventDate}
              onChange={(event) =>
                setForm((value) => ({ ...value, eventDate: event.target.value }))
              }
              className="mt-2 h-12 rounded-none bg-white px-5"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-preset" className="font-bold">
              Preset
            </FieldLabel>
            <select
              id="new-preset"
              value={form.presetId}
              onChange={(event) =>
                setForm((value) => ({ ...value, presetId: event.target.value }))
              }
              className="mt-2 h-12 w-full border bg-white px-3 text-sm outline-none"
            >
              <option value="">No preset</option>
              {presetItems.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </Field>
        </FieldGroup>
      </div>
      <div className="mt-6 flex gap-3">
        <Button
          variant="outline"
          className="h-12 rounded-none px-8"
          onClick={() => router.push(`/dashboard/${section}`)}
        >
          Cancel
        </Button>
        <Button
          className="h-12 rounded-none bg-[#22bda7] px-8 text-sm font-bold text-white hover:bg-[#19a995]"
          disabled={createCollection.isPending || !form.name.trim()}
          onClick={handleCreate}
        >
          {createCollection.isPending ? "Creating..." : "Create Collection"}
        </Button>
      </div>
    </div>
  );
}

function CollectionDetailView({
  section,
  collectionId,
}: {
  section: DashboardSection;
  collectionId: string;
}) {
  const router = useRouter();
  const presetSettings = useDashboardSettings("preset").query;
  const watermarkSettings = useDashboardSettings("watermark").query;
  const emailTemplateSettings = useDashboardSettings("email-template").query;
  const {
    emailTemplates,
    hydrateDashboardSettings,
    presetItems,
    startCampaignBuilder,
    watermarkItems,
  } = useDashboardStore();
  const { starImage } = useImageActions();
  const { collectionsQuery } = useCollections();
  const { collectionQuery, updateCollection, addSet, uploadImages, deleteImage } = useCollectionDetail(collectionId);
  const activityQuery = useCollectionActivity(collectionId);
  const activityActions = useCollectionActivityActions(collectionId);
  const collections = collectionsQuery.data?.data ?? [];
  const collection = collectionQuery.data?.data ?? collections.find((item) => item._id === collectionId);
  const detail = collectionQuery.data?.data;
  const imagesLoading = collectionQuery.isLoading && !detail;
  const images = detail?.images ?? [];
  const sets = detail?.sets?.length ? detail.sets : [{ id: "highlights", name: "Highlights" }];
  const [activeImageId, setActiveImageId] = useState("");
  const [activeTab, setActiveTab] = useState<"photos" | "design" | "settings" | "download">("photos");
  const [activeSetId, setActiveSetId] = useState("highlights");
  const [detailCollapsed, setDetailCollapsed] = useState(false);
  const [addSetOpen, setAddSetOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTemplateSearch, setShareTemplateSearch] = useState("");
  const [selectedShareTemplateId, setSelectedShareTemplateId] = useState("");
  const [imagePage, setImagePage] = useState(1);
  const [newSetName, setNewSetName] = useState("");
  const [editingSetId, setEditingSetId] = useState("");
  const [editingSetName, setEditingSetName] = useState("");
  const [pageOrigin, setPageOrigin] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ active: false, total: 0, uploaded: 0, currentName: "" });
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [form, setForm] = useState(() => collectionForm(collection));
  const activeImage =
    images.find((image) => image._id === activeImageId) ?? images.find((image) => (image.setId || "highlights") === activeSetId) ?? images[0];
  const activeSetImages = images.filter((image) => (image.setId || "highlights") === activeSetId);
  const imagePageSize = 24;
  const totalImagePages = Math.max(1, Math.ceil(activeSetImages.length / imagePageSize));
  const visibleSetImages = activeSetImages.slice(
    (imagePage - 1) * imagePageSize,
    imagePage * imagePageSize,
  );
  const activeSet = form.sets.find((set) => set.id === activeSetId) ?? form.sets[0];
  const filteredShareTemplates = emailTemplates.filter((template) =>
    [template.name, template.subject, template.previewText]
      .join(" ")
      .toLowerCase()
      .includes(shareTemplateSearch.toLowerCase()),
  );
  const selectedShareTemplate =
    emailTemplates.find((template) => template.id === selectedShareTemplateId) ??
    emailTemplates[0];
  const uploadWatermarkId =
    activeSet?.watermarkId ||
    (form.general.defaultWatermark === "No watermark" ? undefined : form.general.defaultWatermark);
  const activeWatermark = watermarkItems.find(
    (watermark) =>
      watermark.id === uploadWatermarkId ||
      watermark.name === uploadWatermarkId,
  );
  const publicPath = `/collection/${encodeURIComponent(collection?.name ?? collectionId)}/${encodeURIComponent(collection?.slug ?? collectionId)}`;
  const publicLink = `${pageOrigin}${publicPath}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(publicLink)}`;

  useEffect(() => {
    setPageOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const settings = [
      ...(presetSettings.data?.data ?? []),
      ...(watermarkSettings.data?.data ?? []),
      ...(emailTemplateSettings.data?.data ?? []),
    ];
    if (settings.length) hydrateDashboardSettings(settings);
  }, [emailTemplateSettings.data, hydrateDashboardSettings, presetSettings.data, watermarkSettings.data]);

  useEffect(() => {
    if (!collection || updateCollection.isPending) return;
    setForm(collectionForm(collection));
  }, [collection, updateCollection.isPending]);

  useEffect(() => {
    if (!selectedShareTemplateId && emailTemplates[0]) {
      setSelectedShareTemplateId(emailTemplates[0].id);
    }
  }, [emailTemplates, selectedShareTemplateId]);

  useEffect(() => {
    if (!sets.some((set) => set.id === activeSetId)) {
      setActiveSetId(sets[0]?.id ?? "highlights");
    }
  }, [activeSetId, sets]);

  useEffect(() => {
    if (!activeSetImages.length) {
      setActiveImageId("");
      return;
    }
    if (!activeImageId || !activeSetImages.some((image) => image._id === activeImageId)) {
      setActiveImageId(activeSetImages[0]._id);
    }
  }, [activeImageId, activeSetImages]);

  useEffect(() => {
    setImagePage(1);
  }, [activeSetId]);

  useEffect(() => {
    if (imagePage > totalImagePages) setImagePage(totalImagePages);
  }, [imagePage, totalImagePages]);

  useEffect(() => {
    setSelectedImageIds((ids) => ids.filter((id) => images.some((image) => image._id === id)));
  }, [images]);

  const presetName = (id?: string) =>
    presetItems.find((preset) => preset.id === id)?.name ?? "No preset";
  const saveCollection = () => {
    const selectedPreset = presetItems.find((preset) => preset.id === form.presetId);
    const payload = {
      name: form.name.trim() || collection?.name,
      presetId: form.presetId || undefined,
      coverImage: form.coverImage || undefined,
      sets: syncSetsFromPhotoSets(form.sets, form.general.photoSets),
      tags: form.general.collectionTags.split(",").map((tag) => tag.trim()).filter(Boolean),
      watermarkId: form.general.defaultWatermark === "No watermark" ? undefined : form.general.defaultWatermark,
      expiresAt: form.expiresAt || undefined,
      design: form.design,
      settings: {
        general: form.general,
        download: form.download,
        favorite: selectedPreset?.favorite ?? collection?.settings?.favorite,
        store: selectedPreset?.store ?? collection?.settings?.store,
      },
    };
    updateCollection.mutate(payload, {
      onSuccess: (response) => {
        if (response?.data) setForm(collectionForm(response.data));
        toast.success("Collection settings saved");
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Collection save failed");
      },
    });
  };
  const createSet = () => {
    const name = newSetName.trim();
    if (!name) return;
    addSet.mutate(name, {
      onSuccess: (response) => {
        const nextSet = response?.data;
        if (nextSet) {
          setForm((value) => ({
            ...value,
            sets: [...value.sets, nextSet],
            general: {
              ...value.general,
              photoSets: [...value.sets.map((set) => set.name), nextSet.name].join(", "),
            },
          }));
          setActiveSetId(nextSet.id);
        }
        setNewSetName("");
        setAddSetOpen(false);
      },
    });
  };
  const deleteSet = (setId: string) => {
    if (form.sets.length <= 1) return;
    const nextSets = form.sets.filter((set) => set.id !== setId);
    setForm((value) => ({
      ...value,
      sets: nextSets,
      general: {
        ...value.general,
        photoSets: nextSets.map((set) => set.name).join(", "),
      },
    }));
    if (activeSetId === setId) setActiveSetId(nextSets[0]?.id ?? "highlights");
    updateCollection.mutate({ sets: nextSets });
  };
  const renameSet = () => {
    const name = editingSetName.trim();
    if (!editingSetId || !name) return;
    const nextSets = form.sets.map((set) =>
      set.id === editingSetId ? { ...set, name } : set,
    );
    setForm((value) => ({
      ...value,
      sets: nextSets,
      general: {
        ...value.general,
        photoSets: nextSets.map((set) => set.name).join(", "),
      },
    }));
    updateCollection.mutate({ sets: nextSets });
    setEditingSetId("");
    setEditingSetName("");
  };
  const copyPublicLink = async () => {
    await navigator.clipboard.writeText(publicLink);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1600);
  };
  const shareByEmail = (templateId: string) => {
    startCampaignBuilder(templateId, publicLink);
    setShareOpen(false);
  };
  const handleImageUpload = async (files: FileList | null) => {
    if (!files?.length || uploadImages.isPending || uploadProgress.active) return;
    const selectedFiles = Array.from(files);
    setUploadProgress({ active: true, total: selectedFiles.length, uploaded: 0, currentName: selectedFiles[0]?.name ?? "" });
    try {
      for (const [index, file] of selectedFiles.entries()) {
        setUploadProgress((current) => ({ ...current, currentName: file.name }));
        await uploadImages.mutateAsync({
          files: [file],
          setId: activeSetId,
          watermarkId: uploadWatermarkId,
        });
        setUploadProgress((current) => ({ ...current, uploaded: index + 1 }));
      }
      await collectionQuery.refetch();
      toast.success(`Upload finished: ${selectedFiles.length} image${selectedFiles.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadProgress({ active: false, total: 0, uploaded: 0, currentName: "" });
    }
  };
  const uploading = uploadProgress.active || uploadImages.isPending;
  const uploadsLeft = Math.max(0, uploadProgress.total - uploadProgress.uploaded);
  const uploadPercent = uploadProgress.total ? Math.round((uploadProgress.uploaded / uploadProgress.total) * 100) : 0;
  const deletingImages = deleteImage.isPending || bulkDeleting;
  const toggleImageSelection = (imageId: string) => {
    if (deletingImages) return;
    setSelectedImageIds((ids) =>
      ids.includes(imageId) ? ids.filter((id) => id !== imageId) : [...ids, imageId],
    );
  };
  const clearSelection = () => {
    if (!deletingImages) setSelectedImageIds([]);
  };
  const deleteSingleImage = (image: CollectionImageRecord) => {
    if (deletingImages) return;
    if (form.coverImage === image.url) {
      setForm((value) => ({ ...value, coverImage: "" }));
    }
    deleteImage.mutate(image._id, {
      onSuccess: () => setSelectedImageIds((ids) => ids.filter((id) => id !== image._id)),
    });
  };
  const deleteSelectedImages = async () => {
    if (!selectedImageIds.length || deletingImages) return;
    setBulkDeleting(true);
    try {
      const selectedImages = images.filter((image) => selectedImageIds.includes(image._id));
      if (selectedImages.some((image) => image.url === form.coverImage)) {
        setForm((value) => ({ ...value, coverImage: "" }));
      }
      for (const image of selectedImages) {
        await deleteImage.mutateAsync(image._id);
      }
      setSelectedImageIds([]);
      await collectionQuery.refetch();
    } finally {
      setBulkDeleting(false);
    }
  };
  if (!collection) {
    return <CollectionDetailSkeleton />;
  }

  return (
    <div className="flex h-[100dvh] min-w-0 flex-col overflow-hidden px-4 py-5 transition-colors duration-300 md:px-6">
      <button
        className="mb-4 inline-flex w-fit items-center gap-2 text-sm text-[#666] hover:text-[#222]"
        onClick={() => router.push(`/dashboard/${section}`)}
      >
        <ArrowLeft className="size-4" />
        Back to Collections
      </button>

      <div className="flex flex-col gap-4 border-b pb-5 transition-all duration-300 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[28px] font-medium leading-none tracking-normal">
            {collection.name}
          </h1>
          <p className="mt-2 text-sm text-[#666]">
            {formatDate(collection.eventDate)} &middot; {presetName(collection.presetId)} &middot; {images.length} images
          </p>
          <div className="mt-2 flex max-w-[720px] flex-wrap items-center gap-2">
            <p className="break-all text-xs text-[#00a997]">{publicLink}</p>
            <Button variant="outline" className="h-8 rounded-none px-3 text-xs" onClick={copyPublicLink}>
              <Copy data-icon="inline-start" />
              {linkCopied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="h-10 rounded-none"
            onClick={() =>
              router.push(`/dashboard/store-gallery/products?collectionId=${collectionId}`)
            }
          >
            <Store data-icon="inline-start" />
            Store
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-none"
            onClick={() => setShareOpen(true)}
          >
            <Share2 data-icon="inline-start" />
            Share
          </Button>
          <label className={cn("inline-flex h-10 w-fit cursor-pointer items-center gap-2 bg-[#22bda7] px-6 text-sm font-bold text-white", uploading && "pointer-events-none opacity-70")}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading ? `${uploadProgress.uploaded}/${uploadProgress.total || "..."}` : "Add Media"}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              className="hidden"
              onChange={(event) => {
                void handleImageUpload(event.target.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-h-[88vh] overflow-hidden rounded-none sm:max-w-[980px]">
          <DialogHeader>
            <DialogTitle>Share Collection</DialogTitle>
            <DialogDescription>
              Send gallery by email, copy direct link, or share QR code.
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 gap-5 md:grid-cols-[minmax(0,1.35fr)_360px]">
            <section className="min-h-0 border bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex size-10 items-center justify-center bg-[#e3f6f1] text-[#00a997]">
                    <Mail className="size-5" />
                  </div>
                  <h3 className="mt-4 font-bold">Send by Email</h3>
                </div>
                <span className="bg-[#f4f4f4] px-2 py-1 text-xs font-bold text-[#666]">
                  {emailTemplates.length} templates
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#666]">
                Search, select, then send. Button URL becomes gallery link.
              </p>
              {emailTemplateSettings.isLoading ? (
                <p className="mt-4 text-sm font-semibold text-[#777]">Loading templates...</p>
              ) : emailTemplates.length ? (
                <>
                  <div className="mt-4 flex h-10 items-center gap-2 border px-3">
                    <Search className="size-4 text-[#777]" />
                    <Input
                      value={shareTemplateSearch}
                      onChange={(event) => setShareTemplateSearch(event.target.value)}
                      placeholder="Find template"
                      className="h-9 rounded-none border-0 px-0 text-sm focus-visible:ring-0"
                    />
                  </div>
                  <div className="mt-3 max-h-[360px] overflow-y-auto border">
                    {filteredShareTemplates.map((template) => (
                      <button
                        key={template.id}
                        className={cn(
                          "block w-full border-b px-4 py-3 text-left text-sm last:border-b-0 hover:bg-[#f7fbfa]",
                          selectedShareTemplate?.id === template.id && "bg-[#e3f6f1]",
                        )}
                        onClick={() => setSelectedShareTemplateId(template.id)}
                      >
                        <span className="block truncate font-bold">{template.name || "Untitled Template"}</span>
                        <span className="mt-1 block truncate text-xs text-[#666]">
                          {template.subject || "No subject"}
                        </span>
                      </button>
                    ))}
                    {!filteredShareTemplates.length && (
                      <p className="px-3 py-6 text-center text-sm font-semibold text-[#777]">
                        No match.
                      </p>
                    )}
                  </div>
                  <Button
                    className="mt-4 h-10 w-full rounded-none bg-[#22bda7] text-sm font-bold text-white hover:bg-[#19a995]"
                    disabled={!selectedShareTemplate}
                    onClick={() => selectedShareTemplate && shareByEmail(selectedShareTemplate.id)}
                  >
                    <Send className="size-4" />
                    Use Selected Template
                  </Button>
                </>
              ) : (
                  <p className="text-sm leading-6 text-[#666]">
                    No templates yet. Create one in Settings.
                  </p>
              )}
            </section>

            <aside className="grid gap-4">
              <section className="border bg-[#fafafa] p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center bg-white text-[#333]">
                    <Link2 className="size-5" />
                  </span>
                  <h3 className="font-bold">Direct Link</h3>
                </div>
                <p className="mt-4 break-all bg-white p-3 text-sm leading-6 text-[#666]">{publicLink}</p>
                <Button variant="outline" className="mt-4 h-10 w-full rounded-none bg-white" onClick={copyPublicLink}>
                  <Copy data-icon="inline-start" />
                  {linkCopied ? "Copied" : "Copy Link"}
                </Button>
              </section>

              <section className="border bg-[#111] p-5 text-white">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center bg-white text-[#111]">
                    <QrCode className="size-5" />
                  </span>
                  <h3 className="font-bold">QR Code</h3>
                </div>
                <div className="mt-4 flex justify-center bg-white p-5">
                  <img src={qrCodeUrl} alt={`QR code for ${collection.name}`} className="size-[220px]" />
                </div>
                <a
                  href={qrCodeUrl}
                  download={`${collection.slug || collection._id}-qr-code.png`}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 border border-white/25 px-4 text-sm font-bold text-white"
                >
                  <Download className="size-4" />
                  Download QR
                </a>
              </section>
            </aside>
          </div>
        </DialogContent>
      </Dialog>

      {uploading && (
        <div className="mt-4 flex items-center gap-4 border border-[#bdeee8] bg-[#f2fffd] px-4 py-3 text-sm text-[#096f64]">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#d9fbf6]">
            <Loader2 className="size-5 animate-spin" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">
              Uploaded {uploadProgress.uploaded} of {uploadProgress.total || "selected"} images. {uploadsLeft} left.
            </p>
            <p className="mt-1 truncate text-xs font-semibold text-[#3f8179]">
              {uploadProgress.currentName || "Processing files and watermark"}
            </p>
            <div className="mt-3 h-2 overflow-hidden bg-[#d3f2ee]">
              <div className="h-full bg-[#22bda7] transition-all duration-300" style={{ width: `${uploadPercent}%` }} />
            </div>
          </div>
        </div>
      )}
      {uploadImages.error && (
        <p className="mt-4 text-sm font-semibold text-red-600">
          {uploadImages.error.message}
        </p>
      )}

      <div className={cn("mt-6 grid min-h-0 flex-1 overflow-hidden border transition-[grid-template-columns] duration-300 ease-out", detailCollapsed ? "md:grid-cols-[76px_minmax(0,1fr)]" : "md:grid-cols-[250px_minmax(0,1fr)]")}>
        <aside className="flex flex-col border-r bg-[#fafafa] transition-colors duration-300">
          {!detailCollapsed && <div className="aspect-[1.45] bg-[#e8e8e8]">
            {form.coverImage ? (
              <DashboardImageWithSkeleton
                src={imageSrc(form.coverImage)}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Images className="size-9 text-[#bbb]" />
              </div>
            )}
          </div>}
          <div className={cn("grid border-b bg-white", detailCollapsed ? "grid-cols-1" : "grid-cols-4")}>
            {([
              ["photos", Images],
              ["design", Palette],
              ["settings", Settings],
              ["download", Download],
            ] as const).map(([tab, Icon]) => (
              <button
                key={String(tab)}
                className={cn("flex h-14 items-center justify-center border-b-2 border-transparent", activeTab === tab && "border-[#22bda7] text-[#00a997]")}
                onClick={() => setActiveTab(tab as typeof activeTab)}
                aria-label={String(tab)}
              >
                <Icon className="size-5" />
              </button>
            ))}
          </div>
          {activeTab === "photos" && !detailCollapsed && (
            <div className="min-h-0 overflow-y-auto p-4">
              <div className="mb-4 flex items-center justify-end">
                <button className="inline-flex items-center gap-1 text-sm font-bold text-[#00a997]" onClick={() => setAddSetOpen(true)}>
                  <PlusCircle className="size-4" />
                  Add Set
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {form.sets.map((set) => {
                  const count = images.filter((image) => (image.setId || "highlights") === set.id).length;
                  return (
                    <div
                      key={set.id}
                      className={cn("group flex h-12 items-center justify-between gap-2 px-3 text-left text-sm", activeSetId === set.id && "bg-white font-bold")}
                    >
                      {editingSetId === set.id ? (
                        <Input
                          value={editingSetName}
                          onChange={(event) => setEditingSetName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") renameSet();
                            if (event.key === "Escape") setEditingSetId("");
                          }}
                          onBlur={renameSet}
                          className="h-8 rounded-none bg-white"
                          autoFocus
                        />
                      ) : (
                        <button
                          className="min-w-0 flex-1 truncate text-left"
                          onClick={() => setActiveSetId(set.id)}
                          onDoubleClick={() => {
                            setEditingSetId(set.id);
                            setEditingSetName(set.name);
                          }}
                        >
                          {set.name}
                        </button>
                      )}
                      <span className="ml-auto text-xs text-[#777]">{count}</span>
                      <button
                        className="hidden text-[#888] hover:text-red-600 group-hover:inline-flex disabled:text-[#ccc]"
                        disabled={form.sets.length <= 1}
                        onClick={() => deleteSet(set.id)}
                        aria-label="Delete set"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <Dialog open={addSetOpen} onOpenChange={setAddSetOpen}>
                <DialogContent className="rounded-none sm:max-w-[420px]">
                  <DialogHeader>
                    <DialogTitle>Add Set</DialogTitle>
                    <DialogDescription>
                      Create a named set inside this collection.
                    </DialogDescription>
                  </DialogHeader>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Set Name</FieldLabel>
                      <Input
                        value={newSetName}
                        onChange={(event) => setNewSetName(event.target.value)}
                        placeholder="e.g. Reception"
                        className="h-11 rounded-none"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") createSet();
                        }}
                      />
                    </Field>
                  </FieldGroup>
                  <DialogFooter>
                    <Button variant="outline" className="rounded-none" onClick={() => setAddSetOpen(false)}>
                      Cancel
                    </Button>
                    <Button className="rounded-none bg-[#22bda7] text-white" disabled={!newSetName.trim()} onClick={createSet}>
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
          <button
            className="mt-auto flex h-12 items-center justify-center border-t text-[#333]"
            onClick={() => setDetailCollapsed((value) => !value)}
            aria-label="Toggle collection sidebar"
          >
            <ChevronsLeft className={cn("size-5", detailCollapsed && "rotate-180")} />
          </button>
        </aside>

        <div className="min-w-0 overflow-y-auto p-5 md:p-6">
          {activeTab === "photos" && (
            imagesLoading ? (
              <CollectionImagesSkeleton />
            ) : !activeSetImages.length ? (
              <label className={cn("flex min-h-[420px] cursor-pointer flex-col items-center justify-center border border-dashed bg-white p-8 text-center", uploading && "pointer-events-none opacity-75")}>
                {uploading ? <Loader2 className="size-10 animate-spin text-[#22bda7]" /> : <Upload className="size-10 text-[#bbb]" />}
                <p className="mt-5 font-bold">{uploading ? `Uploaded ${uploadProgress.uploaded} of ${uploadProgress.total || "selected"} images` : "Drag photos and videos here to upload"}</p>
                <p className="mt-3 text-sm text-[#00a997]">{uploading ? `${uploadsLeft} left` : "or Browse files"}</p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploading}
                  className="hidden"
                  onChange={(event) => {
                    void handleImageUpload(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            ) : (
              <div>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#777]">
                    {collection.name} / {activeSet?.name ?? "Set"} / Images
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {selectedImageIds.length > 0 && (
                      <>
                        <span className="text-xs font-bold text-[#777]">{selectedImageIds.length} selected</span>
                        <Button variant="outline" className="h-9 rounded-none" disabled={deletingImages} onClick={clearSelection}>
                          Clear
                        </Button>
                        <Button className="h-9 rounded-none bg-red-600 text-white hover:bg-red-700" disabled={deletingImages} onClick={() => void deleteSelectedImages()}>
                          {deletingImages ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                          Delete Selected
                        </Button>
                      </>
                    )}
                    <Button variant="outline" className="h-9 rounded-none" disabled={deletingImages} onClick={() => setMetadataOpen(true)}>
                      Show Metadata
                    </Button>
                  </div>
                </div>
                {deletingImages && (
                  <div className="mb-4 flex items-center gap-3 border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    <Loader2 className="size-4 animate-spin" />
                    Deleting images...
                  </div>
                )}
                <div className={cn("grid gap-2", form.design.gridStyle === "Horizontal" ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-4" : "grid-cols-3 md:grid-cols-5 xl:grid-cols-6", form.design.thumbnailSize === "Large" && "md:grid-cols-4 xl:grid-cols-5")}>
                  {uploading && Array.from({ length: Math.min(uploadsLeft || 1, 6) }).map((_, index) => (
                    <div key={`uploading-${index}`} className="relative flex aspect-square animate-in fade-in zoom-in-95 items-center justify-center overflow-hidden bg-[#eef9f7] duration-300">
                      <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-[#d3f2ee]">
                        <div className="h-full w-1/2 animate-pulse bg-[#22bda7]" />
                      </div>
                      <Loader2 className="size-6 animate-spin text-[#22bda7]" />
                    </div>
                  ))}
                  {visibleSetImages.map((image) => (
                    <div
                      key={image._id}
                      className={cn(
                        "group relative animate-in fade-in zoom-in-95 text-left transition-all duration-300 ease-out",
                        activeImage?._id === image._id && "outline outline-2 outline-[#22bda7]",
                        selectedImageIds.includes(image._id) && "outline outline-2 outline-red-500",
                        deletingImages && "pointer-events-none opacity-55",
                      )}
                    >
                      <button
                        className="relative block w-full overflow-hidden bg-[#f2f2f2]"
                        disabled={deletingImages}
                        onClick={() => setActiveImageId(image._id)}
                      >
                        <DashboardImageWithSkeleton
                          src={imageSrc(image.thumbnailUrl || image.url)}
                          alt={image.originalName ?? ""}
                          placeholder={image.blurDataUrl}
                          className={cn(
                            "w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105",
                            form.design.gridStyle === "Horizontal" ? "aspect-[1.45]" : "aspect-square",
                          )}
                        />
                        {!image.watermarked && activeWatermark && (
                          <WatermarkOverlay watermark={activeWatermark} />
                        )}
                      </button>
                      <button
                        className={cn(
                          "absolute left-2 top-2 flex size-8 items-center justify-center border bg-white/95 shadow-sm transition-all duration-200 hover:scale-105",
                          selectedImageIds.includes(image._id) ? "border-red-500 text-red-600" : "border-white text-[#777]",
                        )}
                        disabled={deletingImages}
                        onClick={() => toggleImageSelection(image._id)}
                        aria-label="Select image"
                      >
                        <Check className={cn("size-4", !selectedImageIds.includes(image._id) && "opacity-0")} />
                      </button>
                      <button
                        className="absolute right-2 top-2 hidden size-9 items-center justify-center bg-white/90 text-[#333] shadow-sm transition-all duration-200 hover:scale-105 hover:text-red-600 group-hover:flex"
                        disabled={deletingImages}
                        onClick={() => deleteSingleImage(image)}
                        aria-label="Delete image"
                      >
                        {deletingImages ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </button>
                      <button
                        className="absolute right-12 top-2 hidden size-9 items-center justify-center bg-white/90 text-[#333] shadow-sm transition-all duration-200 hover:scale-105 hover:text-[#00a997] group-hover:flex"
                        disabled={deletingImages}
                        onClick={() => {
                          setActiveImageId(image._id);
                          setPreviewOpen(true);
                        }}
                        aria-label="View image"
                      >
                        <Eye className="size-4" />
                      </button>
                      <button
                        className="absolute right-[5.5rem] top-2 hidden size-9 items-center justify-center bg-white/90 text-[#333] shadow-sm transition-all duration-200 hover:scale-105 hover:text-[#00a997] group-hover:flex"
                        disabled={deletingImages}
                        onClick={() =>
                          starImage.mutate({
                            collectionId: image.collectionId,
                            imageId: image._id,
                            starred: image.metadata?.starred !== true,
                          })
                        }
                        aria-label="Star image"
                      >
                        <Star className={cn("size-4", image.metadata?.starred === true && "fill-[#00a997] text-[#00a997]")} />
                      </button>
                      <button
                        className="absolute bottom-2 left-2 hidden bg-white/90 px-3 py-2 text-xs font-bold text-[#333] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:text-[#00a997] group-hover:block"
                        disabled={deletingImages}
                        onClick={() => setForm((value) => ({ ...value, coverImage: image.url }))}
                      >
                        Make Cover
                      </button>
                    </div>
                  ))}
                </div>
                {totalImagePages > 1 && (
                  <div className="mt-5 flex items-center justify-end gap-3 text-sm">
                    <Button
                      variant="outline"
                      className="h-9 rounded-none"
                      disabled={imagePage <= 1}
                      onClick={() => setImagePage((page) => Math.max(1, page - 1))}
                    >
                      <ArrowLeft data-icon="inline-start" />
                      Prev
                    </Button>
                    <span className="text-[#666]">
                      {imagePage} / {totalImagePages}
                    </span>
                    <Button
                      variant="outline"
                      className="h-9 rounded-none"
                      disabled={imagePage >= totalImagePages}
                      onClick={() => setImagePage((page) => Math.min(totalImagePages, page + 1))}
                    >
                      Next
                      <ArrowRight data-icon="inline-end" />
                    </Button>
                  </div>
                )}
                <Dialog open={metadataOpen} onOpenChange={setMetadataOpen}>
                  <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-none sm:max-w-[760px]">
                    <DialogHeader>
                      <DialogTitle>Image Metadata</DialogTitle>
                      <DialogDescription>
                        View stored camera and file metadata for the selected image.
                      </DialogDescription>
                    </DialogHeader>
                    <MetadataPanel image={activeImage} />
                  </DialogContent>
                </Dialog>
                <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                  <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-none sm:max-w-[92vw]">
                    <DialogHeader>
                      <DialogTitle>View Image</DialogTitle>
                      <DialogDescription>
                        Preview the selected image and its pixel size.
                      </DialogDescription>
                    </DialogHeader>
                    {activeImage && (
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-4 text-sm text-[#666]">
                          <span className="truncate">{activeImage.originalName ?? "Image"}</span>
                          <span>
                            {formatMetaValue(activeImage.metadata?.width)} x {formatMetaValue(activeImage.metadata?.height)}
                          </span>
                        </div>
                        <div className="flex max-h-[76dvh] items-center justify-center bg-[#f3f3f3]">
                          <img
                            src={imageSrc(activeImage.url)}
                            alt={activeImage.originalName ?? ""}
                            className="max-h-[76dvh] max-w-full object-contain"
                          />
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            )
          )}

          {activeTab === "design" && (
            <div className="max-w-[700px]">
                <div className="mb-8 flex items-center gap-3">
                  <select
                    value={form.presetId}
                    onChange={(event) => {
                      const preset = presetItems.find((item) => item.id === event.target.value);
                      const eventLabel = collection?.eventDate ? formatDate(collection.eventDate) : "";
                      setForm((value) => ({
                        ...value,
                        presetId: event.target.value,
                        design: preset
                          ? {
                              ...preset.design,
                              coverSmallTitle: coverTextOrDefault(preset.design.coverSmallTitle, preset.name),
                              coverTitle: coverTextOrDefault(preset.design.coverTitle, value.name || collection?.name || ""),
                              coverDate: coverTextOrDefault(preset.design.coverDate, eventLabel),
                              coverButtonText: coverTextOrDefault(preset.design.coverButtonText, "View Gallery"),
                            }
                          : value.design,
                        general: preset?.general ?? value.general,
                        download: preset?.download ?? value.download,
                      }));
                    }}
                    className="h-11 w-full border bg-white px-3 text-sm outline-none"
                  >
                    <option value="">Custom design</option>
                    {presetItems.map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                  </select>
                  <Button className="h-11 rounded-none bg-[#22bda7] px-6 text-white" onClick={saveCollection}>
                    Save
                  </Button>
                </div>
                <PresetDesignPanel
                  design={form.design}
                  onChange={(value) => setForm((current) => ({ ...current, presetId: "", design: { ...current.design, ...value } }))}
                />
            </div>
          )}

          {activeTab === "settings" && (
            <div className="max-w-[760px]">
              <h2 className="text-2xl font-medium">General Settings</h2>
              <FieldGroup className="mt-8 gap-7">
                <Field>
                  <FieldLabel className="font-bold">Collection Name</FieldLabel>
                  <Input value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} className="h-12 rounded-none bg-white" />
                </Field>
                <Field>
                  <FieldLabel className="font-bold">Expire Date</FieldLabel>
                  <Input type="date" value={form.expiresAt} onChange={(event) => setForm((value) => ({ ...value, expiresAt: event.target.value }))} className="h-12 rounded-none bg-white" />
                </Field>
              </FieldGroup>
              <div className="mt-12">
                <PresetGeneralPanel
                  general={form.general}
                  section={section}
                  onChange={(general) =>
                    setForm((value) => {
                      const nextGeneral = { ...value.general, ...general };
                      return {
                        ...value,
                        general: nextGeneral,
                        sets:
                          general.photoSets !== undefined
                            ? syncSetsFromPhotoSets(value.sets, nextGeneral.photoSets)
                            : value.sets,
                      };
                    })
                  }
                />
              </div>
              <div className="mt-14 border-t pt-12">
                <h2 className="mb-8 text-2xl font-medium">Download</h2>
                <PresetDownloadPanel
                  download={form.download}
                  onChange={(download) => setForm((value) => ({ ...value, download: { ...value.download, ...download } }))}
                />
              </div>
              <Button className="mt-8 h-11 rounded-none bg-[#22bda7] px-8 text-white" disabled={updateCollection.isPending} onClick={saveCollection}>
                {updateCollection.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          )}

          {activeTab === "download" && (
            <CollectionActivityPanel
              loading={activityQuery.isLoading}
              favoriteLists={activityQuery.data?.data.favoriteLists ?? []}
              downloads={activityQuery.data?.data.downloads ?? []}
              collectionName={collection.name}
              publicLink={publicLink}
              deleteFavoriteInfo={activityActions.deleteFavoriteInfo.mutateAsync}
              deleteFavoriteImageInfo={activityActions.deleteFavoriteImageInfo.mutateAsync}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CollectionDetailSkeleton() {
  return (
    <div className="flex h-[100dvh] min-w-0 flex-col overflow-hidden px-4 py-5 md:px-6">
      <Skeleton className="mb-4 h-5 w-40 rounded-none" />
      <div className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-center md:justify-between">
        <div className="w-full max-w-[520px]">
          <Skeleton className="h-8 w-64 rounded-none" />
          <Skeleton className="mt-3 h-4 w-80 rounded-none" />
          <Skeleton className="mt-3 h-4 w-full rounded-none" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-24 rounded-none" />
          <Skeleton className="h-10 w-24 rounded-none" />
          <Skeleton className="h-10 w-32 rounded-none" />
        </div>
      </div>
      <div className="mt-6 grid min-h-0 flex-1 overflow-hidden border md:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="border-r bg-[#fafafa]">
          <Skeleton className="aspect-[1.45] w-full rounded-none" />
          <div className="grid grid-cols-3 border-b bg-white">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="m-4 h-6 rounded-none" />
            ))}
          </div>
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 rounded-none" />
            ))}
          </div>
        </aside>
        <section className="overflow-hidden p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-4 w-56 rounded-none" />
            <Skeleton className="h-9 w-32 rounded-none" />
          </div>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 24 }).map((_, index) => (
              <Skeleton key={index} className="aspect-square rounded-none bg-[#eeeeec]" />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function CollectionActivityPanel({
  loading,
  favoriteLists,
  downloads,
  collectionName,
  publicLink,
  deleteFavoriteInfo,
  deleteFavoriteImageInfo,
}: {
  loading: boolean;
  favoriteLists: CollectionFavoriteActivityRecord[];
  downloads: CollectionDownloadActivityRecord[];
  collectionName: string;
  publicLink: string;
  deleteFavoriteInfo: (favoriteUserId: string) => Promise<unknown>;
  deleteFavoriteImageInfo: (payload: { favoriteUserId: string; imageId: string }) => Promise<unknown>;
}) {
  const [activityPage, setActivityPage] = useState<"download" | "favorite">("favorite");
  const [editingList, setEditingList] = useState<CollectionFavoriteActivityRecord | null>(null);
  const [mailList, setMailList] = useState<CollectionFavoriteActivityRecord | null>(null);
  const [mailSubject, setMailSubject] = useState("");
  const [mailMessage, setMailMessage] = useState("");
  const downloadFavoritesCsv = (list?: CollectionFavoriteActivityRecord) => {
    const rows = (list ? [list] : favoriteLists).map((item) => ({
      email: item.email,
      favoriteList: item.name,
      photos: item.photos,
      filenames: item.filenames.join("; "),
      dateCreated: formatActivityDate(item.createdAt),
      dateUpdated: formatActivityDate(item.updatedAt),
    }));
    downloadCsv(`${safeCsvName(collectionName)}-favorite-activity.csv`, rows);
  };
  const downloadActivityCsv = () => {
    downloadCsv(
      `${safeCsvName(collectionName)}-download-activity.csv`,
      downloads.map((item) => ({
        email: item.email,
        filename: item.imageName || item.imageId || "Collection download",
        downloadType: item.downloadType,
        count: item.count,
        dateCreated: formatActivityDate(item.createdAt),
        dateUpdated: formatActivityDate(item.updatedAt),
      })),
    );
  };
  const copyFilenames = async (list: CollectionFavoriteActivityRecord) => {
    const lines = (list.images?.length ? list.images : list.filenames.map((name) => ({ name, imageId: "", url: "" })))
      .map((image) => `${collectionName} - ${image.name || image.imageId}`);
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Filenames copied");
  };
  const openMailSender = (list: CollectionFavoriteActivityRecord) => {
    setMailList(list);
    setMailSubject(`${collectionName} download`);
    setMailMessage(
      [
        `Hi,`,
        ``,
        `Here are your selected files from ${collectionName}:`,
        ...(list.filenames.length ? list.filenames.map((name) => `- ${name}`) : ["- No filenames"]),
        ``,
        publicLink,
      ].join("\n"),
    );
  };
  const sendAsDownload = async () => {
    if (!mailList) return;
    await recordEmailUsage(1).catch(() => null);
    window.location.href = `mailto:${encodeURIComponent(mailList.email)}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailMessage)}`;
  };
  const deleteFavoriteList = async (list: CollectionFavoriteActivityRecord) => {
    await deleteFavoriteInfo(list.id);
    setEditingList(null);
    toast.success("Favorite info deleted");
  };
  const deleteFavoriteImage = async (list: CollectionFavoriteActivityRecord, imageId: string) => {
    await deleteFavoriteImageInfo({ favoriteUserId: list.id, imageId });
    setEditingList((current) => current ? {
      ...current,
      images: current.images?.filter((image) => image.imageId !== imageId),
      filenames: current.filenames.filter((_, index) => current.images?.[index]?.imageId !== imageId),
      photos: Math.max(0, current.photos - 1),
    } : current);
    toast.success("Photo removed");
  };

  if (loading) {
    return (
      <div className="grid gap-8">
        <Skeleton className="h-8 w-56 rounded-none" />
        <Skeleton className="h-40 rounded-none" />
        <Skeleton className="h-40 rounded-none" />
      </div>
    );
  }

  return (
    <>
    <div className="grid min-h-[620px] gap-0 md:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="border-r bg-[#fafafa]">
        <p className="px-5 py-5 text-xs font-bold uppercase tracking-wide text-[#777]">Activities</p>
        <button
          className={cn("flex h-14 w-full items-center gap-3 px-5 text-left", activityPage === "download" && "bg-white font-bold")}
          onClick={() => setActivityPage("download")}
          type="button"
        >
          <Download className="size-4" />
          Download Activity
        </button>
        <button
          className={cn("flex h-14 w-full items-center gap-3 px-5 text-left", activityPage === "favorite" && "bg-white font-bold")}
          onClick={() => setActivityPage("favorite")}
          type="button"
        >
          <Heart className="size-4" />
          Favorite Activity
        </button>
      </aside>

      <section className="min-w-0 px-7 py-6">
        {activityPage === "download" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-medium">Download Activity</h2>
              <Button variant="outline" className="h-9 rounded-none" disabled={!downloads.length} onClick={downloadActivityCsv}>
                <Download data-icon="inline-start" />
                Download all CSV
              </Button>
            </div>
            <div className="mt-7 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b text-xs font-bold uppercase text-[#777]">
                  <tr>
                    <th className="px-1 py-3">Email</th>
                    <th className="px-1 py-3">File</th>
                    <th className="px-1 py-3">Type</th>
                    <th className="px-1 py-3">Count</th>
                    <th className="px-1 py-3">Date Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {downloads.map((item) => (
                    <tr key={item._id} className="border-b">
                      <td className="px-1 py-5 font-semibold">{item.email}</td>
                      <td className="px-1 py-5">{item.imageName || item.imageId || "Collection download"}</td>
                      <td className="px-1 py-5 capitalize">{item.downloadType}</td>
                      <td className="px-1 py-5">{item.count}</td>
                      <td className="px-1 py-5">{formatActivityDate(item.updatedAt)}</td>
                    </tr>
                  ))}
                  {!downloads.length && (
                    <tr>
                      <td className="px-1 py-10 text-center text-[#777]" colSpan={5}>No downloads yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-medium">Favorite Activity</h2>
              <div className="flex items-center gap-4">
                <button className="inline-flex items-center gap-2 text-sm font-bold text-[#777]" type="button">
                  <ListFilter className="size-4" />
                  Sort by email
                </button>
                <span className="h-5 w-px bg-[#ddd]" />
                <button className="inline-flex items-center gap-2 text-sm font-bold text-[#00a997]" type="button">
                  <PlusCircle className="size-4" />
                  New Favorite List
                </button>
              </div>
            </div>
            <div className="mt-7 overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b text-xs font-bold uppercase text-[#777]">
                  <tr>
                    <th className="px-1 py-3">Email</th>
                    <th className="px-1 py-3">Favorite List</th>
                    <th className="px-1 py-3">Photos</th>
                    <th className="px-1 py-3">Date Created</th>
                    <th className="px-1 py-3">Date Updated</th>
                    <th className="px-1 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {favoriteLists.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="px-1 py-5 font-semibold">{item.email}</td>
                      <td className="px-1 py-5">
                        <span className="inline-flex items-center gap-3">
                          <span className="flex size-12 items-center justify-center bg-[#f3f3f3] text-[#888]">
                            <Images className="size-4" />
                          </span>
                          <span className="font-bold">{item.name}</span>
                        </span>
                      </td>
                      <td className="px-1 py-5">{item.photos}</td>
                      <td className="px-1 py-5">{formatActivityDate(item.createdAt)}</td>
                      <td className="px-1 py-5">{formatActivityDate(item.updatedAt)}</td>
                      <td className="px-1 py-5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 rounded-none px-2" aria-label="Favorite list actions">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-60 rounded-none p-3 shadow-[0_18px_35px_rgba(0,0,0,0.12)]">
                            <DropdownMenuGroup>
                              <DropdownMenuItem onClick={() => void copyFilenames(item)}>
                                <Copy className="size-4" /> Copy filenames
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditingList(item)}>
                                <Wrench className="size-4" /> Edit List
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.open(publicLink, "_blank", "noopener,noreferrer")}>
                                <Eye className="size-4" /> View in Gallery
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadFavoritesCsv(item)}>
                                <Download className="size-4" /> Download all
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openMailSender(item)}>
                                <Mail className="size-4" /> Send as download
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void deleteFavoriteList(item)}>
                                <Trash2 className="size-4" /> Delete info
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                  {!favoriteLists.length && (
                    <tr>
                      <td className="px-1 py-10 text-center text-[#777]" colSpan={6}>No favorites yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
    <Dialog open={Boolean(editingList)} onOpenChange={(open) => !open && setEditingList(null)}>
      <DialogContent className="rounded-none sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Edit Favorite List</DialogTitle>
          <DialogDescription>
            Remove favorite files or delete this visitor info.
          </DialogDescription>
        </DialogHeader>
        {editingList && (
          <div className="grid gap-5">
            <div className="grid gap-1 text-sm">
              <span className="font-bold">{editingList.email}</span>
              <span className="text-[#777]">{editingList.photos} photos in {editingList.name}</span>
            </div>
            <div className="max-h-[320px] overflow-y-auto border">
              {(editingList.images?.length ? editingList.images : editingList.filenames.map((name) => ({ imageId: name, name, url: "" }))).map((image) => (
                <div key={image.imageId || image.name} className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0">
                  <span className="min-w-0 truncate text-sm">{collectionName} - {image.name}</span>
                  {image.imageId.match(/^[a-f\d]{24}$/i) && (
                    <Button variant="outline" className="h-8 rounded-none px-3 text-xs" onClick={() => void deleteFavoriteImage(editingList, image.imageId)}>
                      Delete
                    </Button>
                  )}
                </div>
              ))}
              {!editingList.filenames.length && (
                <p className="px-4 py-8 text-center text-sm text-[#777]">No favorite files.</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-none" onClick={() => setEditingList(null)}>
                Close
              </Button>
              <Button className="rounded-none bg-red-600 text-white hover:bg-red-700" onClick={() => void deleteFavoriteList(editingList)}>
                Delete info
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(mailList)} onOpenChange={(open) => !open && setMailList(null)}>
      <DialogContent className="rounded-none sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Send as download</DialogTitle>
          <DialogDescription>
            Opens your mail app with this download message.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>To</FieldLabel>
            <Input value={mailList?.email ?? ""} readOnly className="h-11 rounded-none bg-white" />
          </Field>
          <Field>
            <FieldLabel>Subject</FieldLabel>
            <Input value={mailSubject} onChange={(event) => setMailSubject(event.target.value)} className="h-11 rounded-none bg-white" />
          </Field>
          <Field>
            <FieldLabel>Message</FieldLabel>
            <Textarea value={mailMessage} onChange={(event) => setMailMessage(event.target.value)} className="min-h-44 rounded-none bg-white" />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" className="rounded-none" onClick={() => setMailList(null)}>
            Cancel
          </Button>
          <Button className="rounded-none bg-[#22bda7] text-white" onClick={() => void sendAsDownload()}>
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function CollectionImagesSkeleton() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-64 rounded-none" />
        <Skeleton className="h-9 w-32 rounded-none" />
      </div>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 24 }).map((_, index) => (
          <Skeleton key={index} className="aspect-square rounded-none bg-[#eeeeec]" />
        ))}
      </div>
    </div>
  );
}

function DashboardImageWithSkeleton({
  src,
  alt,
  className,
  placeholder,
}: {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <span className="relative block h-full w-full overflow-hidden bg-[#f3f3f1]">
      {placeholder && !loaded && (
        <img
          src={placeholder}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
        />
      )}
      {!placeholder && !loaded && <Skeleton className="absolute inset-0 h-full w-full rounded-none bg-[#eeeeec]" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(className, "transition-[opacity,transform] duration-500 ease-out", loaded ? "scale-100 opacity-100" : "scale-[1.015] opacity-0")}
      />
    </span>
  );
}

const collectionDefaultDesign: PresetDesignSettings = {
  cover: "Center",
  coverSmallTitle: "Avery Studio",
  coverTitle: "Sarah & Daniel",
  coverDate: "June 14, 2026",
  coverButtonText: "View Gallery",
  showCoverSmallTitle: true,
  showCoverTitle: true,
  showCoverDate: true,
  showCoverButton: true,
  typography: "Classic",
  color: "White",
  gridStyle: "Vertical",
  thumbnailSize: "Regular",
  gridSpacing: "Regular",
  navigationStyle: "Icon Only",
};

const collectionDefaultGeneral: PresetGeneralSettings = {
  collectionTags: "",
  photoSets: "Highlights",
  defaultWatermark: "No watermark",
  emailRegistration: false,
  galleryAssist: false,
  slideshow: true,
  socialSharing: true,
  language: "English",
};

const collectionDefaultDownload: PresetDownloadSettings = {
  photoDownload: true,
  highResolution: true,
  highResolutionSize: "3600px",
  webSize: true,
  webSizePx: "1024px",
  videoDownload: false,
  downloadPin: false,
  downloadPinCode: "1234",
  restrictDownloads: false,
  limitDownloads: false,
  limitPinUsage: "",
};

type CollectionFormState = {
  name: string;
  presetId: string;
  coverImage: string;
  expiresAt: string;
  sets: NonNullable<CollectionRecord["sets"]>;
  design: PresetDesignSettings;
  general: PresetGeneralSettings;
  download: PresetDownloadSettings;
};

function coverTextOrDefault(value: string | undefined, fallback: string) {
  return value && !["Avery Studio", "Sarah & Daniel", "June 14, 2026", "View Gallery"].includes(value)
    ? value
    : fallback;
}

function collectionForm(collection?: CollectionRecord): CollectionFormState {
  const savedDesign = (collection?.design ?? {}) as Partial<PresetDesignSettings>;
  const eventLabel = collection?.eventDate ? formatDate(collection.eventDate) : "";
  const design = {
    ...collectionDefaultDesign,
    ...savedDesign,
    coverTitle: coverTextOrDefault(savedDesign.coverTitle, collection?.name ?? collectionDefaultDesign.coverTitle),
    coverDate: coverTextOrDefault(savedDesign.coverDate, eventLabel || collectionDefaultDesign.coverDate),
    coverButtonText: coverTextOrDefault(savedDesign.coverButtonText, "View Gallery"),
  } as PresetDesignSettings;

  return {
    name: collection?.name ?? "",
    presetId: collection?.presetId ?? "",
    coverImage: collection?.coverImage ?? "",
    expiresAt: collection?.expiresAt ? collection.expiresAt.slice(0, 10) : "",
    sets: collection?.sets?.length ? collection.sets : [{ id: "highlights", name: "Highlights" }],
    design,
    general: {
      ...collectionDefaultGeneral,
      collectionTags: collection?.tags?.join(", ") ?? collectionDefaultGeneral.collectionTags,
      defaultWatermark: collection?.watermarkId ?? collectionDefaultGeneral.defaultWatermark,
      ...((collection?.settings?.general as Partial<PresetGeneralSettings> | undefined) ?? {}),
    },
    download: {
      ...collectionDefaultDownload,
      ...((collection?.settings?.download as Partial<PresetDownloadSettings> | undefined) ?? {}),
    },
  };
}

function syncSetsFromPhotoSets(
  currentSets: NonNullable<CollectionRecord["sets"]>,
  photoSets: string,
) {
  const names = photoSets
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const safeNames = names.length ? names : ["Highlights"];

  return safeNames.map((name, index) => {
    const existing =
      currentSets.find((set) => set.name.toLowerCase() === name.toLowerCase()) ??
      currentSets[index];

    return {
      id: existing?.id ?? `set-${Date.now()}-${index}`,
      name,
      watermarkId: existing?.watermarkId,
      createdAt: existing?.createdAt,
    };
  });
}

function WatermarkOverlay({
  watermark,
}: {
  watermark: {
    type: "text" | "image";
    text?: string;
    font?: string;
    color?: string;
    scale?: number;
    opacity?: number;
    position?: { x: number; y: number };
    image?: string;
  };
}) {
  const position = watermark.position ?? { x: 15, y: 85 };
  const opacity = (watermark.opacity ?? 90) / 100;

  if (watermark.type === "image" && watermark.image) {
    return (
      <img
        src={watermark.image}
        alt=""
        className="pointer-events-none absolute max-w-[34%] -translate-x-1/2 -translate-y-1/2 object-contain"
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          opacity,
          width: `${Math.max(12, watermark.scale ?? 42)}%`,
        }}
      />
    );
  }

  return (
    <span
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-bold"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        color: watermark.color ?? "#ffffff",
        fontFamily: watermark.font ?? "Times New Roman",
        fontSize: `${Math.max(14, (watermark.scale ?? 42) / 2)}px`,
        opacity,
      }}
    >
      {watermark.text || "Watermark"}
    </span>
  );
}

const metadataGroups = [
  {
    title: "Camera Settings",
    items: [
      ["camera", "Camera"],
      ["make", "Make"],
      ["model", "Model"],
      ["lens", "Lens"],
      ["focalLength", "Focal Length"],
      ["focalLength35mm", "35mm Focal Length"],
      ["shutterSpeed", "Shutter Speed"],
      ["aperture", "Aperture"],
      ["iso", "ISO"],
      ["flash", "Flash"],
      ["meteringMode", "Metering Mode"],
      ["exposureMode", "Exposure Mode"],
      ["whiteBalance", "White Balance"],
    ],
  },
  {
    title: "Metadata",
    items: [
      ["filename", "Filename"],
      ["dateTaken", "Date Taken"],
      ["title", "Title"],
      ["caption", "Caption"],
      ["headline", "Headline"],
      ["keyword", "Keyword"],
      ["artist", "Artist"],
      ["copyright", "Copyright"],
      ["software", "Software"],
      ["gps", "GPS"],
      ["orientation", "Orientation"],
      ["rating", "Rating"],
      ["colorLabel", "Color Label"],
      ["colorSpace", "Color Space"],
    ],
  },
  {
    title: "Nikoset",
    items: [["starred", "Starred"]],
  },
] as const;

function MetadataPanel({ image }: { image?: CollectionImageRecord }) {
  const metadata = image?.metadata ?? {};

  return (
    <aside className="border bg-white p-5">
      <p className="text-sm font-bold">Image Metadata</p>
      {metadataGroups.map((group) => (
        <div key={group.title} className="mt-7">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#777]">
            {group.title}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.items.map(([key, label]) => {
              const value = formatMetaValue(metadata[key]);
              return (
                <span
                  key={key}
                  className={cn(
                    "rounded-full px-3 py-2 text-sm",
                    value ? "bg-[#f1f5f4] text-[#333]" : "bg-[#f5f5f5] text-[#777]",
                  )}
                  title={value || label}
                >
                  {value ? `${label}: ${value}` : label}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}

function formatMetaValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatDate(value?: string) {
  if (!value) return "No date";
  try {
    return format(parseISO(value), "MMM d, yyyy");
  } catch {
    return value;
  }
}

function formatActivityDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function safeCsvName(value: string) {
  return value
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "collection";
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const headers = rows[0] ? Object.keys(rows[0]) : ["email"];
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function imageSrc(url?: string) {
  if (!url) return "";
  if (url.startsWith("/uploads/")) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
    return `${baseUrl}${url}`;
  }
  return url;
}

function GetStartedPanel({
  active,
  onStart,
}: {
  active: (typeof dashboardCopy)[DashboardSection];
  onStart: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-sm text-[#777]">{active.eyebrow}</p>
      <h1 className="mt-4 max-w-[760px] text-3xl font-medium leading-tight tracking-normal md:text-[28px]">
        {active.heading}
      </h1>
      <Button
        className="mt-6 h-10 rounded-none bg-[#22bda7] px-7 text-sm font-bold text-white hover:bg-[#19a995]"
        onClick={onStart}
      >
        {active.cta}
      </Button>

      <div className={cn("mt-8 w-full max-w-[686px] p-8 md:mt-8 md:p-12", active.bg)}>
        <GalleryPreview active={active} />
      </div>
    </div>
  );
}

function GalleryPreview({ active }: { active: (typeof dashboardCopy)[DashboardSection] }) {
  return (
    <div className="relative mx-auto aspect-[1.18] max-w-[555px]">
      <div className="absolute left-0 top-10 h-[78%] w-[82%] bg-white/45 shadow-sm" />
      <div className="absolute left-5 top-6 h-[86%] w-[90%] bg-white/65 shadow-sm" />
      <div className="absolute inset-x-10 top-0 overflow-hidden bg-white shadow-[0_8px_18px_rgba(0,0,0,0.08)]">
        <div className="flex h-3 items-center gap-1 bg-[#f5f5f5] px-3">
          <span className="size-1 rounded-full bg-[#d8d8d8]" />
          <span className="size-1 rounded-full bg-[#d8d8d8]" />
          <span className="size-1 rounded-full bg-[#d8d8d8]" />
        </div>
        <div className="relative h-[270px] md:h-[280px]">
          <img src={active.image} alt={active.hero} className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 text-white">
            <p className="text-xl font-bold tracking-wide">{active.hero}</p>
            <span className="mt-3 h-7 w-24 border border-white/85" />
          </div>
        </div>
        <div className="p-3 text-left">
          <p className="text-[9px] font-bold">{active.hero}</p>
          <p className="text-[7px] tracking-wide text-[#777]">AVERY WOODWARD PHOTOGRAPHY</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[
              "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=300&q=80",
              "https://images.unsplash.com/photo-1508808787069-421e7986016e?auto=format&fit=crop&w=300&q=80",
              "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=300&q=80",
              active.image,
            ].map((src) => (
              <img key={src} src={src} alt="" className="aspect-square w-full object-cover" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CollectionWizard() {
  const {
    wizardStep,
    collectionName,
    eventDate,
    photos,
    coverDesign,
    setWizardStep,
    setCollectionName,
    setEventDate,
    addSamplePhotos,
    setCoverDesign,
    resetWizard,
  } = useDashboardStore();
  const selectedEventDate = eventDate ? parseISO(eventDate) : undefined;

  if (wizardStep === 1) {
    return (
      <div className="mx-auto max-w-[686px]">
        <p className="text-sm text-[#777]">Step 1 of 3</p>
        <h1 className="mt-4 text-[28px] font-medium">Pick a name and date</h1>
        <div className="mt-8 bg-[#fafafa] p-12">
          <FieldGroup className="gap-12">
            <Field>
              <FieldLabel htmlFor="collection-name" className="font-bold">
                Collection Name
              </FieldLabel>
              <Input
                id="collection-name"
                value={collectionName}
                onChange={(event) => setCollectionName(event.target.value)}
                placeholder="e.g. Jessie & Ryan"
                className="h-12 rounded-none bg-white px-5"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="event-date" className="font-bold">
                Event Date
              </FieldLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="event-date"
                    variant="outline"
                    className={cn(
                      "h-12 justify-between rounded-none bg-white px-5 text-left font-normal",
                      !eventDate && "text-[#777]"
                    )}
                  >
                    {selectedEventDate
                      ? format(selectedEventDate, "PPP")
                      : "Select a date (optional)"}
                    <CalendarIcon data-icon="inline-end" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto rounded-none p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedEventDate}
                    onSelect={(date) =>
                      setEventDate(date ? format(date, "yyyy-MM-dd") : "")
                    }
                  />
                </PopoverContent>
              </Popover>
            </Field>
          </FieldGroup>
        </div>
        <Button
          className="mt-6 h-10 rounded-none bg-[#22bda7] px-8 text-sm font-bold text-white hover:bg-[#19a995]"
          onClick={() => setWizardStep(2)}
        >
          Next
        </Button>
      </div>
    );
  }

  if (wizardStep === 2) {
    return (
      <div className="mx-auto max-w-[686px]">
        <p className="text-sm text-[#777]">Step 2 of 3</p>
        <h1 className="mt-4 text-[28px] font-medium">Add your photos</h1>
        <div className="mt-8 bg-[#fafafa] p-12">
          <button
            className="flex min-h-[250px] w-full flex-col items-center justify-center border border-dashed border-[#cfcfcf] bg-white text-center"
            onClick={addSamplePhotos}
          >
            <Upload className="size-9 text-[#22bda7]" />
            <span className="mt-5 text-base font-semibold">Upload sample photos</span>
            <span className="mt-2 text-sm text-[#777]">Click to add photos for now</span>
          </button>
          {photos.length > 0 && (
            <div className="mt-6 grid grid-cols-3 gap-3">
              {photos.map((photo) => (
                <img key={photo} src={photo} alt="" className="aspect-square w-full object-cover" />
              ))}
            </div>
          )}
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="h-10 rounded-none px-8" onClick={() => setWizardStep(1)}>
            Back
          </Button>
          <Button
            className="h-10 rounded-none bg-[#22bda7] px-8 text-sm font-bold text-white hover:bg-[#19a995]"
            onClick={() => {
              if (!photos.length) addSamplePhotos();
              setWizardStep(3);
            }}
          >
            Next
          </Button>
        </div>
      </div>
    );
  }

  const designs = coverOptions.map(([name, image]) => ({ name, image }));
  const coverImage = designs.find((design) => design.name === coverDesign)?.image ?? designs[0].image;

  return (
    <div className="mx-auto max-w-[686px]">
      <p className="text-sm text-[#777]">Step 3 of 3</p>
      <h1 className="mt-4 text-[28px] font-medium">Choose a cover photo design</h1>
      <div className="mt-8 bg-[#fafafa] p-8">
        <div className="relative h-[322px] bg-[#ddd]">
          <CoverPreview
            design={{
              ...collectionDefaultDesign,
              cover: coverDesign,
              coverTitle: collectionName || "My Sample Collection",
              coverDate: eventDate ? format(parseISO(eventDate), "PPP") : "June 14, 2026",
            }}
            image={coverImage}
            className="min-h-0"
          />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-6">
          {designs.map((design) => (
            <button
              key={design.name}
              className="text-center"
              onClick={() => setCoverDesign(design.name)}
            >
              <span className={cn("relative block border p-1", coverDesign === design.name && "border-[#22bda7] ring-2 ring-[#22bda7]")}>
                <img src={design.image} alt={design.name} className="aspect-[1.6] w-full object-cover" />
                {coverDesign === design.name && (
                  <Check className="absolute right-2 top-2 size-4 bg-[#22bda7] text-white" />
                )}
              </span>
              <span className="mt-3 block text-sm text-[#555]">{design.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" className="h-10 rounded-none px-8" onClick={() => setWizardStep(2)}>
          Back
        </Button>
        <Button
          className="h-10 rounded-none bg-[#22bda7] px-8 text-sm font-bold text-white hover:bg-[#19a995]"
          onClick={resetWizard}
        >
          Create Collection
        </Button>
      </div>
    </div>
  );
}
