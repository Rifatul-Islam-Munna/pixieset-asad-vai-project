"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isValid, parse, parseISO } from "date-fns";
import LinkExtension from "@tiptap/extension-link";
import UnderlineExtension from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { toast } from "sonner";
import { ReactSortable } from "react-sortablejs";
import hotkeys from "hotkeys-js";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
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
  Monitor,
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
  Smartphone,
  Trash2,
  Underline,
  Unlink,
  Upload,
  Users,
  FileUp,
  Wrench,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DropdownMenuSeparator,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  useCollectionDetail,
  useCollectionActivity,
  useCollectionActivities,
  useCollectionActivityActions,
  useCollectionImages,
  useCollections,
  useImageActions,
  fetchCollectionImagesPage,
  type CollectionDownloadActivityRecord,
  type CollectionFavoriteActivityRecord,
  type CollectionImageRecord,
  type CollectionRecord,
} from "@/api-hooks/use-collections";
import { PostRequestAxios } from "@/api-hooks/api-hooks";
import { useDashboardSettings } from "@/api-hooks/use-dashboard-settings";
import { logOutUser } from "@/actions/auth";
import {
  checkoutPlan,
  confirmPlanCheckout,
  getBillingOverview,
  getPurchaseHistory,
  recordEmailUsage,
  type BillingUser,
  type PlanPurchase,
} from "@/actions/billing";
import type { AdminPlan } from "@/actions/admin";
import {
  CoverPreview,
  coverOptions,
} from "@/components/dashboard/cover-designs";
import {
  useStorePriceSheet,
  useStorePriceSheetDetails,
  useStoreProductDelete,
  useStoreProductUpdate,
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
  type StoreProductOption,
  type StoreProductPayload,
  type StoreProductRecord,
  type StoreProductType,
  type StoreProductVariant,
  type StoreShippingRecord,
  type StoreSettingsRecord,
  type StoreTaxRecord,
} from "@/api-hooks/use-store";
import {
  useDashboardStore,
  type PresetDesignSettings,
  type PresetDownloadSettings,
  type EmailTemplateItem,
  type PresetFavoriteSettings,
  type PresetGeneralSettings,
  type PresetItem,
  type WatermarkItem,
} from "@/lib/dashboard-store";
import type {
  BrandSettings,
  CustomCoverTemplate,
  HomeCmsData,
} from "@/lib/home-cms";
import { cn } from "@/lib/utils";
import { usePlanFeatureAccess } from "@/api-hooks/use-plan-capabilities";
import {
  PlanFeatureLock,
  PlanFeatureNotice,
} from "@/components/dashboard/plan-feature-lock";
import { HomepageSettingsPanel } from "@/components/dashboard/homepage-settings-panel";
import { useHomepageSettings } from "@/api-hooks/use-homepage";
import { publicCollectionUrl } from "@/lib/public-site-url";
import {
  checkUsername,
  useAccount,
  type AccountProfile,
} from "@/api-hooks/use-account";

export type DashboardSection = "client-gallery" | "store-gallery";
export type DashboardPage =
  | "collections"
  | "collection-new"
  | "library"
  | "starred"
  | "homepage"
  | "settings"
  | "marketing"
  | "pricing"
  | "products"
  | "orders"
  | "customers"
  | "taxes"
  | "shipping"
  | "coupons"
  | "get-started"
  | "storefront"
  | "storage"
  | "account";
export type MarketingPage = "email-campaigns" | "contacts" | "settings";
export type SettingsPage =
  | "branding"
  | "watermark"
  | "watermark-editor"
  | "presets"
  | "preset-new"
  | "email-templates"
  | "preferences";

const switcherItems = [
  {
    key: "client-gallery",
    title: "Client Gallery",
    text: "Better way to share, deliver, proof and sell",
    href: "/dashboard/client-gallery",
    mark: "bg-[#0dc6b5]",
    accent: "from-[#0dc6b5] to-[#9de7de]",
  },
  {
    key: "store-gallery",
    title: "Store Gallery",
    text: "Your online store for prints and downloads",
    href: "/dashboard/store-gallery",
    mark: "bg-[#ff4f5d]",
    accent: "from-[#ff4f5d] to-[#ffc7cd]",
  },
  {
    key: "mobile-gallery",
    title: "Mobile Gallery App",
    text: "Create installable mobile-first photo apps",
    href: "/dashboard/mobile-gallery",
    mark: "bg-[#f5c421]",
    accent: "from-[#f5c421] to-[#ffe99a]",
  },
] as const;

const sidebarItems = {
  "client-gallery": [
    { label: "Collections", icon: Images, page: "collections" },
    { label: "Library", icon: LayoutGrid, page: "library" },
    { label: "Starred", icon: Star, page: "starred" },
    { label: "Homepage", icon: PanelTop, page: "homepage" },
    { label: "Settings", icon: Settings, page: "settings" },
  ],
  "store-gallery": [
    { label: "Get Started", icon: Info, page: "get-started" },
    { label: "Dashboard", icon: Store, page: "storefront" },
    { label: "Orders", icon: ShoppingBag, page: "orders" },
    { label: "Customers", icon: Users, page: "customers" },
    { label: "Products", icon: CreditCard, page: "products" },
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

async function sendUniversalEmail(payload: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}) {
  const [data, error] = await PostRequestAxios<{
    data: { sent: boolean; skipped?: boolean; reason?: string };
  }>("/mail/send", payload);
  if (error || !data) throw new Error(error?.message || "Email send failed");
  return data.data;
}

const libraryFilters = [
  {
    title: "Camera Settings",
    items: [
      "Camera",
      "Lens",
      "Focal Length",
      "Shutter Speed",
      "Aperture",
      "ISO",
      "Flash",
    ],
  },
  {
    title: "Metadata",
    items: [
      "Filename",
      "Title",
      "Caption",
      "Headline",
      "Keyword",
      "Orientation",
      "Rating",
      "Color Label",
      "Color Space",
    ],
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
  productId,
  productType,
}: {
  section: DashboardSection;
  page: DashboardPage;
  marketingPage?: MarketingPage;
  settingsPage?: SettingsPage;
  collectionId?: string;
  priceSheetId?: string;
  productId?: string;
  productType?: StoreProductType;
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
    page === "collections" ||
    (section === "store-gallery" && page === "products");
  const isCollectionDetail = page === "collections" && Boolean(collectionId);
  const isPriceSheetDetail =
    (page === "products" && Boolean(priceSheetId)) ||
    (section === "store-gallery" && page === "pricing" && Boolean(productId));
  const dashboardChromeOpen =
    !campaignBuilderOpen && !isCollectionDetail && !isPriceSheetDetail;
  const storeTopNavOpen = dashboardChromeOpen && section === "store-gallery";
  const [logoutPending, startLogoutTransition] = useTransition();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingUser, setBillingUser] = useState<BillingUser | null>(null);
  useEffect(() => {
    let active = true;
    const loadBilling = () =>
      getBillingOverview()
        .then((value) => {
          if (active) setBillingUser(value.user);
        })
        .catch(() => undefined);
    const onStorageChanged = () => {
      void loadBilling();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadBilling();
    };
    void loadBilling();
    window.addEventListener("storage-usage-changed", onStorageChanged);
    window.addEventListener("focus", loadBilling);
    document.addEventListener("visibilitychange", onVisible);
    const refreshTimer = window.setInterval(loadBilling, 30_000);
    return () => {
      active = false;
      window.removeEventListener("storage-usage-changed", onStorageChanged);
      window.removeEventListener("focus", loadBilling);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(refreshTimer);
    };
  }, []);
  const sidebarUsedGb = bytesToGb(billingUser?.storageUsedBytes ?? 0);
  const sidebarLimitGb = Math.max(0, Number(billingUser?.storageLimitGb ?? 0));
  const sidebarStorageLeftGb = Math.max(0, sidebarLimitGb - sidebarUsedGb);
  const sidebarStoragePercent =
    sidebarLimitGb > 0
      ? Math.min(100, (sidebarUsedGb / sidebarLimitGb) * 100)
      : 0;
  const sidebarEmailLimit = Number(billingUser?.monthlyEmailLimit ?? 0);
  const sidebarEmailsUsed = Number(billingUser?.monthlyEmailsUsed ?? 0);
  const sidebarEmailsLeft =
    sidebarEmailLimit > 0
      ? Math.max(0, sidebarEmailLimit - sidebarEmailsUsed)
      : 0;
  const sidebarEmailPercent =
    sidebarEmailLimit > 0
      ? Math.min(100, (sidebarEmailsUsed / sidebarEmailLimit) * 100)
      : 0;
  const logout = () => {
    startLogoutTransition(async () => {
      await logOutUser();
      router.push("/login");
    });
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-[#151515]">
      {dashboardChromeOpen && !storeTopNavOpen && (
        <aside
          className={cn(
            "fixed inset-y-0 left-0 hidden border-r border-[#e6e6e6] bg-white transition-all md:flex md:flex-col",
            collapsed ? "w-[76px]" : "w-[292px]",
          )}
        >
          <div className="flex h-[62px] items-center justify-between border-b border-[#f1f1f1] px-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 text-sm font-bold outline-none">
                  <span
                    className={cn("size-5 rounded-full", activeSwitcher?.mark)}
                  />
                  {!collapsed && active.title}
                  {!collapsed && <ChevronDown className="size-3 text-[#777]" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[calc(100vw-2rem)] max-w-[340px] rounded-none border-0 p-0 shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
                <DropdownMenuGroup className="p-5">
                  {switcherItems.map((item) => (
                    <DropdownMenuItem key={item.key} asChild className="p-0">
                      <Link
                        href={item.href}
                        className="flex gap-4 rounded-none px-2 py-4"
                      >
                        <span
                          className={cn(
                            "mt-1 size-10 shrink-0 rounded-full bg-gradient-to-br",
                            item.accent,
                          )}
                        />
                        <span className="flex flex-col gap-1">
                          <span className="font-bold text-[#151515]">
                            {item.title}
                          </span>
                          <span className="text-xs leading-5 text-[#777]">
                            {item.text}
                          </span>
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <div className="bg-[#f7f7f7] p-5 text-center">
                  <Link
                    href="/dashboard/overview"
                    className="inline-flex items-center gap-2 text-sm text-[#333]"
                  >
                    <LayoutGrid className="size-4 text-[#999]" />
                    View Dashboard
                  </Link>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <div
              className={cn("flex items-center gap-4", collapsed && "hidden")}
            >
              {section === "client-gallery" && <DashboardNotifications />}
              <Link
                href="/dashboard/client-gallery/account"
                aria-label="Account profile"
              >
                <Avatar className="size-7">
                  <AvatarImage src={billingUser?.avatar || ""} />
                  <AvatarFallback className="bg-[#dff3ef] text-[#0b9f91]">
                    {billingUser?.name?.slice(0, 1).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </Link>
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
                  href={
                    item.page === "collections"
                      ? `/dashboard/${section}`
                      : `/dashboard/${section}/${item.page}`
                  }
                  className={cn(
                    "flex items-center gap-4 text-left text-base text-[#222]",
                    activeNav === item.label && "font-semibold text-[#00a997]",
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-5 text-[#333]",
                      activeNav === item.label && "text-[#00a997]",
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
                    page === "marketing" && "font-semibold text-[#00a997]",
                  )}
                >
                  <Megaphone
                    className={cn(
                      "size-5 text-[#333]",
                      page === "marketing" && "text-[#00a997]",
                    )}
                  />
                  {!collapsed && "Marketing"}
                </Link>
                {!collapsed && (
                  <div className="ml-7 flex flex-col border-l border-[#e8e8e8] pl-4">
                    {[
                      {
                        label: "Email Campaigns",
                        slug: "email-campaigns",
                        icon: Mail,
                      },
                      { label: "Contacts", slug: "contacts", icon: Users },
                      { label: "Settings", slug: "settings", icon: MailCheck },
                    ].map((item) => (
                      <Link
                        key={item.slug}
                        href={`/dashboard/${section}/marketing/${item.slug}`}
                        className={cn(
                          "flex h-12 items-center gap-4 px-3 text-base text-[#222]",
                          marketingPage === item.slug &&
                            "bg-[#f3f3f3] font-medium",
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
                    collapsed
                      ? "mx-auto size-12 justify-center p-0"
                      : "w-full p-4",
                  )}
                  title="Storage"
                >
                  <div className="flex size-10 items-center justify-center rounded-full bg-[#dff6ef] text-[#19bba7]">
                    <Database className="size-5" />
                  </div>
                  {!collapsed && (
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-[#00a997]">
                          Storage
                        </p>
                        <PlusCircle className="size-4 text-[#16bda8]" />
                      </div>
                      <p className="mt-1 text-xs text-[#777]">
                        {sidebarUsedGb.toFixed(2)} GB used /{" "}
                        {sidebarStorageLeftGb.toFixed(2)} GB left
                      </p>
                      <Progress
                        value={sidebarStoragePercent}
                        className="mt-2 bg-[#dceee8]"
                      />
                      {sidebarEmailLimit > 0 && (
                        <>
                          <p className="mt-3 text-xs text-[#777]">
                            {sidebarEmailsUsed} emails used /{" "}
                            {sidebarEmailsLeft} left
                          </p>
                          <Progress
                            value={sidebarEmailPercent}
                            className="mt-2 bg-[#dceee8]"
                          />
                        </>
                      )}
                    </div>
                  )}
                </Link>
              )}
              <button
                className={cn(
                  "flex items-center gap-3 text-sm font-semibold text-[#555] hover:text-red-600 disabled:opacity-50",
                  collapsed && "justify-center",
                )}
                onClick={logout}
                disabled={logoutPending}
              >
                <LogOut className="size-5" />
                {!collapsed && "Logout"}
              </button>
              <button
                className={cn(
                  "flex items-center text-[#333]",
                  collapsed && "justify-center",
                )}
                onClick={toggleCollapsed}
                aria-label="Toggle sidebar"
              >
                <ChevronsLeft
                  className={cn("size-6", collapsed && "rotate-180")}
                />
              </button>
            </div>
          </nav>
        </aside>
      )}

      <section
        className={cn(
          "min-h-screen transition-all",
          dashboardChromeOpen && !storeTopNavOpen
            ? collapsed
              ? "md:pl-[76px]"
              : "md:pl-[292px]"
            : "",
        )}
      >
        {storeTopNavOpen && (
          <StoreTopNavigation
            activePage={page}
            logout={logout}
            logoutPending={logoutPending}
          />
        )}
        {dashboardChromeOpen && !storeTopNavOpen && (
          <div className="flex h-14 items-center justify-between border-b border-[#f1f1f1] px-4 md:hidden">
            <button
              className="flex size-10 items-center justify-center bg-[#111] text-white"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open dashboard menu"
            >
              <Menu className="size-5" />
            </button>
            <div className="flex min-w-0 items-center gap-2 text-sm font-bold">
              <span
                className={cn("size-5 rounded-full", activeSwitcher?.mark)}
              />
              <span className="truncate">{active.title}</span>
            </div>
            <div className="flex items-center gap-2">
              {section === "client-gallery" && (
                <DashboardNotifications mobile />
              )}
              <button
                aria-label="Logout"
                onClick={logout}
                disabled={logoutPending}
                className="flex size-10 items-center justify-center bg-[#f4f4f4]"
              >
                <LogOut className="size-5" />
              </button>
            </div>
          </div>
        )}

        {mobileMenuOpen && dashboardChromeOpen && !storeTopNavOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 md:hidden">
            <aside className="h-full w-[88vw] max-w-[330px] overflow-y-auto bg-white px-5 py-5 shadow-[20px_0_60px_rgba(0,0,0,0.25)]">
              <div className="flex items-center justify-between border-b pb-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 text-sm font-bold outline-none">
                      <span
                        className={cn(
                          "size-5 rounded-full",
                          activeSwitcher?.mark,
                        )}
                      />
                      {active.title}
                      <ChevronDown className="size-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[calc(100vw-2rem)] max-w-[300px] rounded-none border-0 p-0 shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
                    <DropdownMenuGroup>
                      {switcherItems.map((item) => (
                        <DropdownMenuItem
                          key={item.key}
                          asChild
                          className="p-0"
                        >
                          <Link
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex gap-4 px-4 py-4"
                          >
                            <span
                              className={cn(
                                "mt-1 size-10 shrink-0 rounded-full bg-gradient-to-br",
                                item.accent,
                              )}
                            />
                            <span className="flex flex-col gap-1">
                              <span className="font-bold text-[#151515]">
                                {item.title}
                              </span>
                              <span className="text-xs leading-5 text-[#777]">
                                {item.text}
                              </span>
                            </span>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                    <div className="bg-[#f7f7f7] p-4 text-center">
                      <Link
                        href="/dashboard/overview"
                        onClick={() => setMobileMenuOpen(false)}
                        className="inline-flex items-center gap-2 text-sm text-[#333]"
                      >
                        <LayoutGrid className="size-4 text-[#999]" />
                        View Dashboard
                      </Link>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  className="flex size-10 items-center justify-center bg-[#f4f4f4]"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close dashboard menu"
                >
                  <X className="size-5" />
                </button>
              </div>

              <nav className="mt-7 grid gap-5">
                {sidebarItems[section].map((item) => (
                  <Link
                    key={item.label}
                    href={
                      item.page === "collections"
                        ? `/dashboard/${section}`
                        : `/dashboard/${section}/${item.page}`
                    }
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-4 text-base text-[#222]",
                      activeNav === item.label &&
                        "font-semibold text-[#00a997]",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-5 text-[#333]",
                        activeNav === item.label && "text-[#00a997]",
                      )}
                    />
                    {item.label}
                  </Link>
                ))}
                {section === "client-gallery" && (
                  <>
                    <p className="mt-4 text-sm font-semibold text-[#777]">
                      Tools
                    </p>
                    <Link
                      href={`/dashboard/${section}/marketing/email-campaigns`}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-4 text-base text-[#222]",
                        page === "marketing" && "font-semibold text-[#00a997]",
                      )}
                    >
                      <Megaphone
                        className={cn(
                          "size-5 text-[#333]",
                          page === "marketing" && "text-[#00a997]",
                        )}
                      />
                      Marketing
                    </Link>
                    <div className="ml-9 grid gap-3">
                      {[
                        [
                          "Email Campaigns",
                          `/dashboard/${section}/marketing/email-campaigns`,
                        ],
                        [
                          "Contacts",
                          `/dashboard/${section}/marketing/contacts`,
                        ],
                        [
                          "Settings",
                          `/dashboard/${section}/marketing/settings`,
                        ],
                      ].map(([label, href]) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="text-sm text-[#555]"
                        >
                          {label}
                        </Link>
                      ))}
                    </div>
                    <Link
                      href={`/dashboard/${section}/storage`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-start gap-4 text-base text-[#222]"
                    >
                      <Database className="mt-0.5 size-5 text-[#333]" />
                      <span>
                        <span className="block">Storage</span>
                        <span className="mt-1 block text-xs text-[#777]">
                          {sidebarUsedGb.toFixed(2)} GB used /{" "}
                          {sidebarStorageLeftGb.toFixed(2)} GB left
                        </span>
                      </span>
                    </Link>
                  </>
                )}
              </nav>

              <button
                className="mt-10 flex items-center gap-3 text-sm font-semibold text-[#555] hover:text-red-600 disabled:opacity-50"
                onClick={logout}
                disabled={logoutPending}
              >
                <LogOut className="size-5" />
                Logout
              </button>
            </aside>
          </div>
        )}

        <div
          className={cn(
            "mx-auto min-h-screen",
            campaignBuilderOpen
              ? ""
              : isCollectionDetail || isPriceSheetDetail
                ? "max-w-none px-0 py-0"
                : storeTopNavOpen
                  ? "max-w-[1220px] px-4 py-10 sm:px-5 md:py-14"
                  : "max-w-[1220px] px-4 py-10 sm:px-5 md:py-20",
          )}
        >
          <PlanFeatureLock
            feature={section === "store-gallery" ? "store" : "marketingEmails"}
            label={section === "store-gallery" ? "Store" : "Marketing email"}
            className={
              section === "store-gallery" ||
              page === "marketing" ||
              campaignBuilderOpen
                ? "min-h-[520px]"
                : "contents"
            }
            bypass={
              section !== "store-gallery" &&
              page !== "marketing" &&
              !campaignBuilderOpen
            }
          >
            {campaignBuilderOpen ? (
              <CampaignBuilder onClose={closeCampaignBuilder} />
            ) : wizardOpen ? (
              <CollectionWizard />
            ) : page === "library" ? (
              <LibraryPanel onNewCollection={startWizard} />
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
            ) : page === "account" ? (
              <AccountPanel />
            ) : page === "marketing" ? (
              <MarketingPanel marketingPage={marketingPage} />
            ) : page === "collection-new" ? (
              <CollectionNewPanel section={section} />
            ) : section === "store-gallery" && page === "get-started" ? (
              <StoreGetStartedPanel />
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
            ) : section === "store-gallery" &&
              page === "pricing" &&
              productId ? (
              <StorePricingRouteEditor
                productId={productId}
                productType={productType}
              />
            ) : section === "store-gallery" && page === "pricing" ? (
              <StorePricingPanel />
            ) : page === "products" && priceSheetId && productId ? (
              <StoreProductRouteEditor
                priceSheetId={priceSheetId}
                productId={productId}
                productType={productType}
              />
            ) : page === "products" && priceSheetId ? (
              <StorePriceSheetDetail priceSheetId={priceSheetId} />
            ) : page === "collections" && collectionId ? (
              <CollectionDetailView
                section={section}
                collectionId={collectionId}
              />
            ) : section === "store-gallery" && page === "products" ? (
              <StoreProductsPanel />
            ) : isCollectionIndex ? (
              <CollectionsPanel section={section} />
            ) : (
              <DashboardPlaceholder page={page} title={activeNav} />
            )}
          </PlanFeatureLock>
        </div>
      </section>
    </main>
  );
}

function AccountPanel() {
  const { query, update } = useAccount();
  const [tab, setTab] = useState<"profile" | "account" | "purchases">(
    "profile",
  );
  const [purchases, setPurchases] = useState<PlanPurchase[]>([]);
  const [form, setForm] = useState<
    Partial<AccountProfile> & { password?: string }
  >({});
  const [usernameState, setUsernameState] = useState<
    "idle" | "checking" | "available" | "unavailable"
  >("idle");
  const [usernameMessage, setUsernameMessage] = useState("");

  useEffect(() => {
    if (query.data?.data) setForm(query.data.data);
  }, [query.data]);

  useEffect(() => {
    getPurchaseHistory()
      .then(setPurchases)
      .catch(() => setPurchases([]));
  }, []);

  useEffect(() => {
    const username = form.username?.trim() || "";
    if (!username || username === query.data?.data?.username) {
      setUsernameState("idle");
      setUsernameMessage("");
      return;
    }
    setUsernameState("checking");
    const timer = window.setTimeout(() => {
      checkUsername(username)
        .then(({ data }) => {
          setUsernameState(data.available ? "available" : "unavailable");
          setUsernameMessage(
            data.available ? "Username available" : data.reason,
          );
        })
        .catch(() => {
          setUsernameState("unavailable");
          setUsernameMessage("Could not check username");
        });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [form.username, query.data?.data?.username]);

  const field = (key: keyof AccountProfile, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const save = () =>
    update.mutate(form, {
      onSuccess: () => toast.success("Account saved"),
      onError: (error) => toast.error(error.message),
    });
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "gallerista.app";

  if (query.isLoading)
    return (
      <div className="mx-auto max-w-[800px]">
        <Skeleton className="h-[520px] w-full" />
      </div>
    );
  if (query.isError)
    return <p className="text-center text-red-600">Could not load account.</p>;

  return (
    <section className="mx-auto max-w-[800px] pb-20">
      <header className="border-b pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00a997]">
          Workspace identity
        </p>
        <h1 className="mt-2 text-3xl font-medium">
          {tab === "profile"
            ? "Profile"
            : tab === "account"
              ? "Account"
              : "Purchases"}
        </h1>
      </header>
      <nav className="mt-6 flex gap-8 border-b" aria-label="Account sections">
        {(["profile", "account", "purchases"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={cn(
              "border-b-2 px-1 pb-3 text-sm capitalize",
              tab === item
                ? "border-[#00b7a5] font-semibold text-[#111]"
                : "border-transparent text-[#777]",
            )}
          >
            {item}
          </button>
        ))}
        <Link
          href="/dashboard/client-gallery/storage"
          className="px-1 pb-3 text-sm text-[#777]"
        >
          Billing
        </Link>
      </nav>

      {tab === "profile" ? (
        <div className="mt-10 grid gap-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#999]">
            Business details
          </p>
          <div className="flex items-center gap-5">
            <Avatar className="size-24 rounded-none bg-[#f1f1f1]">
              <AvatarImage src={form.avatar || ""} className="object-cover" />
              <AvatarFallback className="rounded-none text-2xl">
                {form.businessName?.slice(0, 1) || "+"}
              </AvatarFallback>
            </Avatar>
            <FieldInput
              label="Profile image URL"
              value={form.avatar || ""}
              onChange={(value) => field("avatar", value)}
              help="Square image shown on galleries and account pages."
            />
          </div>
          <FieldInput
            label="Business Name"
            value={form.businessName || ""}
            onChange={(value) => field("businessName", value)}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <FieldInput
              label="First Name"
              value={form.firstName || ""}
              onChange={(value) => field("firstName", value)}
            />
            <FieldInput
              label="Last Name"
              value={form.lastName || ""}
              onChange={(value) => field("lastName", value)}
            />
          </div>
          <FieldInput
            label="Contact Email"
            value={form.email || ""}
            onChange={(value) => field("email", value)}
            type="email"
          />
          <FieldInput
            label="Phone Number"
            value={form.phoneNumber || ""}
            onChange={(value) => field("phoneNumber", value)}
          />
          <FieldInput
            label="Website"
            value={form.website || ""}
            onChange={(value) => field("website", value)}
          />
          <FieldInput
            label="Business Address"
            value={form.businessAddress || ""}
            onChange={(value) => field("businessAddress", value)}
          />
          <label className="grid gap-2">
            <span className="text-sm font-bold">Biography</span>
            <Textarea
              value={form.biography || ""}
              onChange={(event) => field("biography", event.target.value)}
              className="min-h-32 rounded-none"
            />
          </label>
        </div>
      ) : tab === "account" ? (
        <div className="mt-10 grid gap-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#999]">
            Account info
          </p>
          <FieldInput
            label="Username"
            value={form.username || ""}
            onChange={(value) =>
              field("username", value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
            }
            help={`Homepage: https://${form.username || "username"}.${rootDomain}`}
          />
          {usernameState !== "idle" && (
            <p
              className={cn(
                "-mt-5 text-sm font-semibold",
                usernameState === "available"
                  ? "text-emerald-600"
                  : usernameState === "checking"
                    ? "text-[#777]"
                    : "text-red-600",
              )}
            >
              {usernameState === "checking" ? "Checking…" : usernameMessage}
            </p>
          )}
          <FieldInput
            label="Account Email"
            value={form.email || ""}
            onChange={(value) => field("email", value)}
            type="email"
          />
          <FieldInput
            label="New Password"
            value={form.password || ""}
            onChange={(value) =>
              setForm((current) => ({ ...current, password: value }))
            }
            type="password"
            help="Leave blank to keep current password."
          />
        </div>
      ) : (
        <div className="mt-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#999]">
            Plan purchase history
          </p>
          {purchases.length ? (
            <div className="mt-5 divide-y border-y">
              {purchases.map((purchase) => (
                <div
                  key={purchase._id}
                  className="flex items-center justify-between py-5"
                >
                  <div>
                    <b>{purchase.planName}</b>
                    <p className="mt-1 text-xs capitalize text-[#888]">
                      {purchase.source} · {purchase.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <b>${Number(purchase.amount).toFixed(2)}</b>
                    <p className="mt-1 text-xs text-[#888]">
                      {new Date(purchase.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-[#888]">No plan purchases yet.</p>
          )}
        </div>
      )}
      {tab !== "purchases" && (
        <div className="mt-10 border-t pt-6">
          <Button
            type="button"
            onClick={save}
            disabled={
              update.isPending ||
              usernameState === "checking" ||
              usernameState === "unavailable"
            }
            className="h-11 rounded-none bg-[#00ad9c] px-8 font-bold text-white"
          >
            {update.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      )}
    </section>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  help,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  type?: string;
}) {
  return (
    <label className="grid w-full gap-2">
      <span className="text-sm font-bold">{label}</span>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-none border-[#d8d8d8] px-4 shadow-none focus-visible:ring-[#00b7a5]"
      />
      {help && <span className="text-xs leading-5 text-[#888]">{help}</span>}
    </label>
  );
}

function StoreTopNavigation({
  activePage,
  logout,
  logoutPending,
}: {
  activePage: DashboardPage;
  logout: () => void;
  logoutPending: boolean;
}) {
  const items = sidebarItems["store-gallery"];

  return (
    <header className="border-t-[5px] border-[#202020] bg-white text-[#1e1e1e]">
      <div className="bg-[#f7f7f7] px-4 sm:px-8">
        <div className="mx-auto flex h-[50px] max-w-[1220px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex min-w-0 items-center gap-2 text-sm font-semibold outline-none">
                  <span className="flex size-[18px] items-center justify-center rounded-full bg-[#ff4f5d]">
                    <span className="h-[2px] w-3 bg-white" />
                  </span>
                  <span>Store Gallery</span>
                  <ChevronDown className="size-4 text-[#333]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-[calc(100vw-2rem)] max-w-[340px] rounded-none border-0 p-0 shadow-[0_18px_45px_rgba(0,0,0,0.12)]"
              >
                <DropdownMenuGroup className="p-5">
                  {switcherItems.map((item) => (
                    <DropdownMenuItem key={item.key} asChild className="p-0">
                      <Link
                        href={item.href}
                        className="flex gap-4 rounded-none px-2 py-4"
                      >
                        <span
                          className={cn(
                            "mt-1 size-10 shrink-0 rounded-full bg-gradient-to-br",
                            item.accent,
                          )}
                        />
                        <span className="flex flex-col gap-1">
                          <span className="font-bold text-[#151515]">
                            {item.title}
                          </span>
                          <span className="text-xs leading-5 text-[#777]">
                            {item.text}
                          </span>
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <div className="bg-[#f7f7f7] p-5 text-center">
                  <Link
                    href="/dashboard/overview"
                    className="inline-flex items-center gap-2 text-sm text-[#333]"
                  >
                    <LayoutGrid className="size-4 text-[#999]" />
                    View Dashboard
                  </Link>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex shrink-0 items-center gap-3 text-[#666]">
            <DashboardNotifications />
            <button
              className="flex size-8 items-center justify-center rounded-full bg-white text-[#555] transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              onClick={logout}
              disabled={logoutPending}
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
      </div>
      <nav className="overflow-x-auto border-b border-[#ececec] bg-white px-4 sm:px-8">
        <div className="mx-auto max-w-[1220px]">
          <div className="flex min-w-max items-center gap-7">
            {items.map((item) => (
              <Link
                key={item.label}
                href={
                  item.page === "storefront"
                    ? "/dashboard/store-gallery"
                    : `/dashboard/store-gallery/${item.page}`
                }
                className={cn(
                  "flex h-10 items-center border-b-2 border-transparent text-sm text-[#777] transition-colors hover:text-[#111]",
                  activePage === item.page && "border-[#00a997] text-[#111]",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}

function StoreGetStartedPanel() {
  const router = useRouter();
  const steps = [
    {
      title: "1. Review Products",
      text: "Manage your products and adjust pricing.",
      icon: CreditCard,
      href: "/dashboard/store-gallery/products",
    },
    {
      title: "2. Setup Checkout",
      text: "Connect Stripe or Paypal to start accepting online payments.",
      icon: ShoppingCart,
      href: "/dashboard/store-gallery/settings",
    },
  ];

  return (
    <div className="mx-auto max-w-[950px] pb-20 text-[#1f2933]">
      <div className="border-b border-[#e8e8e8] pb-4">
        <h1 className="text-[25px] font-normal tracking-wide">
          Launch your Store in 2 easy steps
        </h1>
      </div>

      <div className="mt-7 grid gap-3 md:grid-cols-2">
        {steps.map((step) => (
          <button
            key={step.title}
            onClick={() => router.push(step.href)}
            className="flex h-40 flex-col items-center justify-center bg-[#f2f2f2] text-center transition-colors hover:bg-[#ebebeb]"
          >
            <step.icon className="size-9 stroke-[1.8] text-[#29313a]" />
            <span className="mt-6 text-base font-semibold text-[#151515]">
              {step.title}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-6 text-sm text-[#6a7280] md:grid-cols-2">
        {steps.map((step) => (
          <p key={step.title}>{step.text}</p>
        ))}
      </div>
    </div>
  );
}

function StoragePlanPanel() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [billingInterval, setBillingInterval] = useState<"month" | "year">(
    "month",
  );
  const [data, setData] = useState<{
    plans: AdminPlan[];
    user: BillingUser;
  } | null>(null);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const load = async (confirmCheckout = false) => {
      if (confirmCheckout && sessionId)
        await confirmPlanCheckout(sessionId).catch(() => null);
      return getBillingOverview();
    };
    const applyBilling = (
      value: Awaited<ReturnType<typeof getBillingOverview>>,
    ) => {
      if (active) setData(value);
    };
    const onStorageChanged = () => {
      void load()
        .then(applyBilling)
        .catch(() => undefined);
    };
    load(true)
      .then((value) => {
        applyBilling(value);
      })
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err.message : "Billing failed");
      });
    window.addEventListener("storage-usage-changed", onStorageChanged);
    return () => {
      active = false;
      window.removeEventListener("storage-usage-changed", onStorageChanged);
    };
  }, []);

  const user = data?.user;
  const usedGb = bytesToGb(user?.storageUsedBytes ?? 0);
  const limitGb = Number(user?.storageLimitGb ?? 0);
  const storagePercent =
    limitGb > 0 ? Math.min(100, (usedGb / limitGb) * 100) : 0;
  const emailLimit = Number(user?.monthlyEmailLimit ?? 0);
  const emailsUsed = Number(user?.monthlyEmailsUsed ?? 0);
  const emailPercent =
    emailLimit > 0 ? Math.min(100, (emailsUsed / emailLimit) * 100) : 0;

  const buyPlan = (planId: string) => {
    startTransition(async () => {
      setError("");
      try {
        const result = await checkoutPlan(planId, billingInterval);
        if (result.checkoutUrl) window.location.href = result.checkoutUrl;
        else if (result.activated) {
          setData(await getBillingOverview());
          setNotice("Free plan activated successfully");
        } else setError("Plan activation failed");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Checkout failed");
      }
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Storage & Plan" />
        <Button
          asChild
          className="h-11 rounded-none bg-[#22bda7] px-6 text-sm font-bold text-white hover:bg-[#19a995]"
        >
          <Link href="/pricing">View Pricing Plans</Link>
        </Button>
      </div>
      {error && (
        <p className="mt-5 border-l-2 border-red-500 pl-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-5 border-l-2 border-[#22bda7] pl-3 text-sm font-semibold text-[#008f80]">
          {notice}
        </p>
      )}
      <div
        className="mt-6 inline-flex border bg-white p-1"
        aria-label="Billing frequency"
      >
        <button
          type="button"
          onClick={() => setBillingInterval("month")}
          className={cn(
            "h-10 px-5 text-sm font-bold",
            billingInterval === "month"
              ? "bg-[#111] text-white"
              : "text-[#555]",
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setBillingInterval("year")}
          className={cn(
            "h-10 px-5 text-sm font-bold",
            billingInterval === "year" ? "bg-[#111] text-white" : "text-[#555]",
          )}
        >
          Yearly
        </button>
      </div>
      <div className="mt-5 border-l-4 border-[#22bda7] bg-[#f1faf8] px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#008f80]">
          Current plan
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <p>
            <b>{user?.planName ?? "Free"}</b>
            {user?.planBillingInterval
              ? ` - ${user.planBillingInterval === "year" ? "Yearly" : "Monthly"}`
              : ""}
          </p>
          <p>
            <span className="text-[#666]">Expires:</span>{" "}
            <b>
              {user?.planExpiresAt
                ? new Intl.DateTimeFormat(undefined, {
                    dateStyle: "long",
                  }).format(new Date(user.planExpiresAt))
                : "No expiry"}
            </b>
          </p>
        </div>
      </div>
      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <UsagePanel
          icon={<Database className="size-5" />}
          title={user?.planName ?? "Free"}
          label="Storage"
          value={`${usedGb.toFixed(2)} GB used`}
          limit={limitGb > 0 ? `${limitGb} GB total` : "Uploads disabled"}
          percent={storagePercent}
        />
        <UsagePanel
          icon={<Mail className="size-5" />}
          title="Monthly emails"
          label="Emails"
          value={`${emailsUsed} sent`}
          limit={
            emailLimit > 0 ? `${emailLimit} emails / month` : "Email disabled"
          }
          percent={emailPercent}
        />
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {(data?.plans ?? []).map((plan) => {
          const yearlyAvailable =
            Boolean(plan.yearlyEnabled) && Number(plan.priceYearly ?? 0) > 0;
          const monthlyEquivalent =
            billingInterval === "year"
              ? yearlyAvailable
                ? Number(plan.priceYearly ?? 0) / 12
                : 0
              : Number(plan.priceMonthly ?? 0);
          return (
            <article key={plan._id} className="border bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{plan.name}</h2>
                  <p className="mt-2 text-sm text-[#666]">
                    Storage allowance + monthly email quota
                  </p>
                </div>
                <CreditCard className="size-5 text-[#00a997]" />
              </div>
              <div className="mt-8 grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span>Storage</span>
                  <b>{plan.storageGb} GB</b>
                </div>
                <div className="flex justify-between">
                  <span>Emails</span>
                  <b>{plan.monthlyEmails}</b>
                </div>
                <div className="flex justify-between">
                  <span>Price</span>
                  <b>
                    ${monthlyEquivalent.toFixed(2)}{" "}
                    {billingInterval === "year" ? "/yearly" : "/month"}
                  </b>
                </div>
                {/* {billingInterval === "year" && (
                  <div className="flex justify-between">
                    <span>Billed</span>
                    <b>
                      {yearlyAvailable
                        ? `$${Number(plan.priceYearly).toFixed(2)} yearly`
                        : "Unavailable"}
                    </b>
                  </div>
                )} */}
              </div>
              <Button
                className="mt-6 h-11 w-full rounded-none bg-[#111] text-white"
                disabled={
                  pending ||
                  (billingInterval === "year"
                    ? !yearlyAvailable
                    : !Number(plan.priceMonthly ?? 0))
                }
                onClick={() => buyPlan(plan._id)}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Buy Plan"
                )}
              </Button>
            </article>
          );
        })}
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
        <span className="flex size-10 items-center justify-center bg-[#e3f6f1] text-[#00a997]">
          {icon}
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777]">
            {label}
          </p>
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

type DashboardNotificationItem = {
  id: string;
  title: string;
  meta: string;
  time?: string;
};

function DashboardNotifications({ mobile = false }: { mobile?: boolean }) {
  const { collectionsQuery } = useCollections();
  const { ordersQuery } = useStoreOrders();
  const collections = collectionsQuery.data?.data ?? [];
  const activities = useCollectionActivities(
    collections.map((collection) => collection._id),
  );
  const [readIds, setReadIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const recentItems = useMemo(() => {
    const collectionMap = new Map(
      collections.map((collection) => [collection._id, collection]),
    );
    const items: Array<DashboardNotificationItem & { timestamp: number }> = [];

    activities.forEach((query, index) => {
      const collection = collections[index];
      const data = query.data?.data;
      if (!collection || !data) return;

      data.downloads.forEach((download) => {
        items.push({
          id: `download-${collection._id}-${download._id}`,
          title: `${collection.name}: download`,
          meta: `${download.email || "Visitor"} downloaded ${download.imageName || "collection files"}`,
          time: download.updatedAt,
          timestamp: new Date(
            download.updatedAt ?? download.createdAt ?? 0,
          ).getTime(),
        });
      });

      data.favoriteLists.forEach((favorite) => {
        items.push({
          id: `favorite-${collection._id}-${favorite.id}`,
          title: `${collection.name}: favorites`,
          meta: `${favorite.email || favorite.name || "Visitor"} saved ${favorite.photos} photo${favorite.photos === 1 ? "" : "s"}`,
          time: favorite.updatedAt,
          timestamp: new Date(
            favorite.updatedAt ?? favorite.createdAt ?? 0,
          ).getTime(),
        });
      });
    });

    collections.forEach((collection) => {
      const requests =
        (collection.settings?.access as CollectionAccessSettings | undefined)
          ?.requests ?? [];
      requests
        .filter((request) => (request.status ?? "pending") === "pending")
        .forEach((request) => {
          items.push({
            id: `access-${collection._id}-${request.id || request.email}`,
            title: `${collection.name}: access request`,
            meta: `${request.email} requested gallery access`,
            time: request.createdAt,
            timestamp: new Date(request.createdAt ?? 0).getTime(),
          });
        });
    });

    (ordersQuery.data?.data ?? []).forEach((order) => {
      const collection = order.collectionId
        ? collectionMap.get(order.collectionId)
        : null;
      items.push({
        id: `order-${order._id}`,
        title: `${collection?.name ?? "Store"}: order`,
        meta: `${order.customer?.name || order.customer?.email || "Customer"} placed ${order.orderNumber}`,
        time: order.createdAt,
        timestamp: new Date(order.createdAt ?? 0).getTime(),
      });
    });

    return items
      .filter((item) => Number.isFinite(item.timestamp) && item.timestamp > 0)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }, [activities, collections, ordersQuery.data?.data]);

  useEffect(() => {
    const saved = window.localStorage.getItem(
      "dashboard-notification-read-ids",
    );
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) setReadIds(parsed);
    } catch {
      window.localStorage.removeItem("dashboard-notification-read-ids");
    }
  }, []);

  const unreadCount = recentItems.filter(
    (item) => !readIds.includes(item.id),
  ).length;
  const markRead = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen || !recentItems.length) return;
    setReadIds((current) => {
      const next = [
        ...new Set([...current, ...recentItems.map((item) => item.id)]),
      ].slice(-80);
      window.localStorage.setItem(
        "dashboard-notification-read-ids",
        JSON.stringify(next),
      );
      return next;
    });
  };

  return (
    <DropdownMenu open={open} onOpenChange={markRead}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Notifications"
          className={cn(
            "relative flex items-center justify-center text-[#555]",
            mobile ? "size-10 bg-[#f4f4f4]" : "size-8",
          )}
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-[#22bda7] px-1 text-[10px] font-bold text-white">
              {Math.min(unreadCount, 9)}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[calc(100vw-1.5rem)] max-w-[380px] rounded-xl p-0 shadow-[0_22px_55px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-start justify-between gap-4 border-b px-4 py-4">
          <div>
            <p className="text-sm font-bold text-[#222]">Notifications</p>
            <p className="mt-1 text-xs text-[#777]">
              Recent collection and store activity
            </p>
          </div>
          <span className="rounded-full bg-[#eef8f6] px-2.5 py-1 text-[11px] font-bold text-[#008f80]">
            {recentItems.length}
          </span>
        </div>
        <ScrollArea className="h-[430px]">
          {recentItems.length ? (
            recentItems.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 border-b px-4 py-3.5 last:border-b-0"
              >
                <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eef8f6] text-[#009b8c]">
                  {item.id.startsWith("download") ? (
                    <Download />
                  ) : item.id.startsWith("favorite") ? (
                    <Heart />
                  ) : (
                    <ShoppingBag />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#222]">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#666]">
                    {item.meta}
                  </p>
                  <p className="mt-2 text-[11px] font-medium uppercase text-[#999]">
                    {formatActivityDate(item.time)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-sm text-[#777]">
              No notifications yet.
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
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
        <PageHeader action="Upload Contacts" title="Contacts" />
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
        <div className="mt-8 max-w-[680px] bg-[#fafafa] p-5 sm:mt-12 sm:p-10">
          <FieldGroup className="gap-8">
            <Field>
              <FieldLabel className="font-bold">Sender Name</FieldLabel>
              <Input
                className="h-12 rounded-none bg-white"
                placeholder="Nikoset Studio"
              />
            </Field>
            <Field>
              <FieldLabel className="font-bold">Reply-to Email</FieldLabel>
              <Input
                className="h-12 rounded-none bg-white"
                placeholder="hello@example.com"
              />
            </Field>
            <Field>
              <FieldLabel className="font-bold">Opt-in Location</FieldLabel>
              <Input
                className="h-12 rounded-none bg-white"
                placeholder="Client Gallery checkout"
              />
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
          <h1 className="text-[28px] font-medium leading-none">
            Email Campaigns
          </h1>
          <div className="flex h-10 w-full items-center gap-3 bg-white sm:w-[280px]">
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
        <h2 className="mt-10 text-lg font-bold">
          Create your first email campaign
        </h2>
        <p className="mt-5 max-w-[430px] text-sm leading-6 text-[#333]">
          Power up your marketing with email campaigns to opted-in contacts.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="hidden grid-cols-[2fr_130px_1.2fr_1.2fr_1.2fr_1.4fr_40px] border-b pb-4 text-[11px] font-bold uppercase tracking-widest text-[#777] md:grid">
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
          className="grid w-full gap-2 border-b py-5 text-left text-sm md:grid-cols-[2fr_130px_1.2fr_1.2fr_1.2fr_1.4fr_40px] md:items-center md:gap-0"
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
              <img
                src={template.image}
                alt=""
                className="h-full w-full object-cover opacity-75"
              />
            ) : (
              <span className="px-3 text-center text-xl font-bold uppercase tracking-wide">
                {template.title}
              </span>
            )}
          </div>
          <p className="mt-4 font-bold">{template.name}</p>
          <p className="mt-2 line-clamp-2 text-sm text-[#666]">
            {template.subject}
          </p>
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
  const recipients = [
    "Avery Woodward",
    "Jessie Ryan",
    "Morgan Wells",
    "Isla Bennett",
  ];
  const collections = [
    "Autumn Florals",
    "Black Friday Clients",
    "Wedding Leads",
  ];
  const sendNow = () => {
    setSendError("");
    startSendTransition(async () => {
      try {
        const emails = selectedRecipients.filter((value) =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        );
        await recordEmailUsage(Math.max(1, selectedRecipients.length));
        if (emails.length) {
          const body = [
            campaignMessage,
            "",
            campaignButtonText && campaignButtonLink
              ? `${campaignButtonText}: ${campaignButtonLink}`
              : "",
            "",
            campaignFooterText,
          ]
            .filter(Boolean)
            .join("\n");
          await sendUniversalEmail({
            to: emails,
            subject: campaignSubject || campaignTemplate,
            text: body || campaignPreviewText || campaignTemplate,
          });
          toast.success("Campaign sent by universal SMTP");
        }
        onClose();
      } catch (error) {
        setSendError(
          error instanceof Error ? error.message : "Email send failed",
        );
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
          <Button
            className="h-12 rounded-none bg-[#22bda7] px-9 text-sm font-bold text-white hover:bg-[#19a995]"
            onClick={sendNow}
            disabled={sendPending}
          >
            {sendPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Send Now"
            )}
          </Button>
        </div>
      </header>
      {sendError && (
        <p className="border-l-2 border-red-500 bg-white px-8 py-3 text-sm font-semibold text-red-600">
          {sendError}
        </p>
      )}

      <div className="grid min-h-[calc(100vh-48px)] lg:grid-cols-[468px_1fr]">
        <aside className="border-r bg-white">
          <Tabs
            value={campaignTab}
            onValueChange={(value) =>
              setCampaignTab(value as "email" | "recipients")
            }
            className="gap-0"
          >
            <TabsList className="grid h-16 w-full grid-cols-2 rounded-none bg-[#fafafa] p-0">
              <TabsTrigger
                value="email"
                className="rounded-none data-active:border-b-2 data-active:border-[#22bda7] data-active:bg-white"
              >
                <Mail data-icon="inline-start" />
                Email
              </TabsTrigger>
              <TabsTrigger
                value="recipients"
                className="rounded-none data-active:border-b-2 data-active:border-[#22bda7] data-active:bg-white"
              >
                <Users data-icon="inline-start" />
                Recipients
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="p-8">
              <h2 className="text-lg font-bold">Design Email</h2>
              <FieldGroup className="mt-8 gap-8">
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">
                    Subject
                  </FieldLabel>
                  <Input
                    className="h-12 rounded-none"
                    value={campaignSubject}
                    onChange={(event) => setCampaignSubject(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">
                    Preview Text
                  </FieldLabel>
                  <Input
                    className="h-12 rounded-none"
                    value={campaignPreviewText}
                    onChange={(event) =>
                      setCampaignPreviewText(event.target.value)
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">
                    Title
                  </FieldLabel>
                  <Input
                    className="h-12 rounded-none"
                    value={campaignTemplate}
                    onChange={(event) =>
                      setCampaignTemplate(event.target.value)
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">
                    Image
                  </FieldLabel>
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
                      <span className="text-xl font-bold uppercase">
                        {campaignTemplate}
                      </span>
                    )}
                  </div>
                </Field>
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">
                    Message
                  </FieldLabel>
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
                  <FieldLabel className="font-bold uppercase text-[#777]">
                    Button Text
                  </FieldLabel>
                  <Input
                    className="h-12 rounded-none"
                    value={campaignButtonText}
                    onChange={(event) =>
                      setCampaignButtonText(event.target.value)
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">
                    Button Link
                  </FieldLabel>
                  <Input
                    className="h-12 rounded-none"
                    value={campaignButtonLink}
                    onChange={(event) =>
                      setCampaignButtonLink(event.target.value)
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">
                    Button Color
                  </FieldLabel>
                  <div className="flex gap-3">
                    <Input
                      type="color"
                      className="h-12 w-16 rounded-none p-1"
                      value={campaignButtonColor}
                      onChange={(event) =>
                        setCampaignButtonColor(event.target.value)
                      }
                    />
                    <Input
                      className="h-12 rounded-none"
                      value={campaignButtonColor}
                      onChange={(event) =>
                        setCampaignButtonColor(event.target.value)
                      }
                    />
                  </div>
                </Field>
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">
                    Footer Text
                  </FieldLabel>
                  <div className="flex h-8 items-center gap-4 border bg-[#f3f3f3] px-3 text-[#777]">
                    <Bold className="size-4" />
                    <Italic className="size-4" />
                    <Underline className="size-4" />
                    <Link2 className="size-4" />
                  </div>
                  <textarea
                    className="min-h-[140px] w-full border px-4 py-4 text-sm leading-6 outline-none"
                    value={campaignFooterText}
                    onChange={(event) =>
                      setCampaignFooterText(event.target.value)
                    }
                  />
                </Field>
              </FieldGroup>
            </TabsContent>

            <TabsContent value="recipients" className="p-8">
              <h2 className="text-lg font-bold">Recipients</h2>
              <div className="mt-8 flex flex-col gap-8">
                <div>
                  <p className="mb-4 text-sm font-bold uppercase text-[#777]">
                    Select individually
                  </p>
                  <div className="grid gap-3">
                    {recipients.map((name) => (
                      <label
                        key={name}
                        className="flex items-center gap-3 border p-4"
                      >
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
                  <p className="mb-4 text-sm font-bold uppercase text-[#777]">
                    Select collection
                  </p>
                  <div className="grid gap-3">
                    {collections.map((name) => (
                      <button
                        key={name}
                        className="border p-4 text-left"
                        onClick={() => toggleRecipient(name)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
                <Field>
                  <FieldLabel className="font-bold uppercase text-[#777]">
                    Upload new collection
                  </FieldLabel>
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
    <section className="flex justify-center overflow-auto p-4 sm:p-10">
      <div className="w-full max-w-[600px] bg-white">
        <div className="bg-[#080c0e] px-5 py-8 text-center text-white sm:px-10 sm:py-10">
          <h1 className="break-words text-3xl font-bold uppercase tracking-wide sm:text-5xl">
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

function PageHeader({ title, action }: { title: string; action?: string }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <h1 className="text-[28px] font-medium leading-none">{title}</h1>
      <div className="flex flex-wrap items-center gap-3 sm:gap-5">
        {action && (
          <Button className="h-10 rounded-none bg-[#22bda7] px-5 text-sm font-bold text-white hover:bg-[#19a995] sm:px-7">
            {action}
          </Button>
        )}
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
  const [photoFavorites, setPhotoFavorites] = useState<FavoriteImageRecord[]>(
    [],
  );
  const [collectionFavorites, setCollectionFavorites] = useState<
    FavoriteCollectionRecord[]
  >([]);
  const [previewImage, setPreviewImage] = useState<FavoriteImageRecord | null>(
    null,
  );
  const [photosLoading, setPhotosLoading] = useState(true);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setPhotosLoading(true);
    fetch("/api/collection-image-favorites", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(payload?.message ?? "Favorite photos failed");
        if (active) setPhotoFavorites(payload?.data ?? []);
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "Favorite photos failed",
          );
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
        if (!response.ok)
          throw new Error(payload?.message ?? "Favorite collections failed");
        if (active) setCollectionFavorites(payload?.data ?? []);
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "Favorite collections failed",
          );
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
      {error ? (
        <p className="mt-8 text-sm font-semibold text-red-600">{error}</p>
      ) : null}
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
            <p className="text-sm font-semibold text-[#777]">
              Loading favorite albums...
            </p>
          ) : collectionFavorites.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {collectionFavorites.map((favorite) => (
                <button
                  key={favorite._id}
                  className="group text-left"
                  onClick={() =>
                    favorite.url &&
                    window.open(favorite.url, "_blank", "noopener,noreferrer")
                  }
                  type="button"
                >
                  <span className="relative block overflow-hidden bg-[#f3f3f3]">
                    {favorite.coverImage ? (
                      <img
                        src={imageSrc(favorite.coverImage)}
                        alt={favorite.name}
                        className="aspect-[1.35] w-full object-cover transition-transform group-hover:scale-105"
                      />
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
                    {favorite.eventDate
                      ? format(parseISO(favorite.eventDate), "MMM d, yyyy")
                      : "Favorite album"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mx-auto flex min-h-[360px] max-w-[420px] flex-col items-center justify-center text-center">
              <Heart className="size-10 text-[#22bda7]" />
              <h2 className="mt-5 text-xl font-semibold">
                No favorite albums yet
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#666]">
                Favorite albums from public collection galleries.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="photos" className="mt-12">
          {photosLoading ? (
            <p className="text-sm font-semibold text-[#777]">
              Loading favorite photos...
            </p>
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
                      <img
                        src={imageSrc(favorite.thumbnailUrl || favorite.url)}
                        alt={favorite.originalName ?? ""}
                        className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                      />
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
              <h2 className="mt-5 text-xl font-semibold">
                No favorite photos yet
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#666]">
                Favorite photos from public collection galleries.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
      <Dialog
        open={Boolean(previewImage)}
        onOpenChange={(open) => !open && setPreviewImage(null)}
      >
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
                    onClick={() =>
                      previewImage.galleryUrl &&
                      window.open(
                        previewImage.galleryUrl,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
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
    (collection) => collection.settings?.starred,
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
  const router = useRouter();

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
          : (image.originalName ?? image.metadata?.filename ?? "Image");
        const subtitle = isCollection
          ? `${collection.imageCount ?? 0} images`
          : `${image.collectionName ?? "Collection"} / ${image.setName ?? "Highlights"}`;

        return (
          <button
            key={`${kind}-${item._id}`}
            className="group text-left"
            onClick={() =>
              isCollection
                ? router.push(
                    `/dashboard/client-gallery/collections/${collection._id}`,
                  )
                : router.push(
                    `/dashboard/client-gallery/collections/${image.collectionId}`,
                  )
            }
          >
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
                <span
                  className={cn(
                    "flex items-center justify-center bg-[#f3f3f3]",
                    isCollection ? "aspect-[1.35]" : "aspect-square",
                  )}
                >
                  <Images className="size-8 text-[#bbb]" />
                </span>
              )}
              <Star className="absolute right-3 top-3 size-5 fill-white text-white drop-shadow" />
            </span>
            <span className="mt-3 block truncate text-sm font-semibold text-[#222]">
              {title}
            </span>
            <span className="mt-1 block text-xs text-[#777]">{subtitle}</span>
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
  const [previewImage, setPreviewImage] =
    useState<CollectionImageRecord | null>(null);
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

    return (
      matchesCollection && (!normalizedQuery || text.includes(normalizedQuery))
    );
  });
  const libraryPageSize = 48;
  const totalLibraryPages = Math.max(
    1,
    Math.ceil(visiblePhotos.length / libraryPageSize),
  );
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
            <div key={photo._id} className="group text-left">
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
                    <Star
                      className={cn(
                        "size-4",
                        photo.metadata?.starred === true &&
                          "fill-[#00a997] text-[#00a997]",
                      )}
                    />
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
                    onClick={() =>
                      router.push(
                        `/dashboard/client-gallery/collections/${photo.collectionId}`,
                      )
                    }
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
            onClick={() =>
              setLibraryPage((page) => Math.min(totalLibraryPages, page + 1))
            }
          >
            Next
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      )}

      <Dialog
        open={Boolean(previewImage)}
        onOpenChange={(open) => !open && setPreviewImage(null)}
      >
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
                <span className="truncate">
                  {previewImage.originalName ?? "Image"}
                </span>
                <span>
                  {formatMetaValue(previewImage.metadata?.width)} x{" "}
                  {formatMetaValue(previewImage.metadata?.height)}
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
                "underline decoration-[#22bda7] decoration-2 underline-offset-[10px]",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mt-9">
        {settingsPage === "watermark" ? (
          <WatermarkList section={section} />
        ) : settingsPage === "branding" ? (
          <BrandingSettings />
        ) : settingsPage === "watermark-editor" ? (
          <WatermarkSettings section={section} />
        ) : settingsPage === "presets" ? (
          <PresetList section={section} />
        ) : settingsPage === "preset-new" ? (
          <PresetEditor section={section} />
        ) : settingsPage === "email-templates" ? (
          <EmailTemplatesPanel />
        ) : settingsPage === "preferences" ? (
          <PreferencesPanel />
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

function PreferencesPanel() {
  return (
    <div className="max-w-[560px] space-y-12">
      <FieldGroup>
        <Field>
          <FieldLabel className="font-bold">
            Default Collection Language
          </FieldLabel>
          <select className="h-12 rounded-none border bg-white px-4 text-sm">
            <option>English</option>
          </select>
          <p className="text-sm leading-6 text-[#666]">
            Select default language for newly created collections.
          </p>
        </Field>
        <Field>
          <FieldLabel className="font-bold">Filename Display</FieldLabel>
          <select className="h-12 rounded-none border bg-white px-4 text-sm">
            <option>Show</option>
            <option>Hide</option>
          </select>
          <p className="text-sm leading-6 text-[#666]">
            Choose whether filenames show on collection photos.
          </p>
        </Field>
        <Field>
          <FieldLabel className="font-bold">
            Search Engine Visibility
          </FieldLabel>
          <select className="h-12 rounded-none border bg-white px-4 text-sm">
            <option>Homepage Only</option>
            <option>All Public Pages</option>
            <option>Hidden</option>
          </select>
          <p className="text-sm leading-6 text-[#666]">
            Choose whether collections can be searchable on search engines.
          </p>
        </Field>
        <Field>
          <FieldLabel className="font-bold">Sharpening Level</FieldLabel>
          <select className="h-12 rounded-none border bg-white px-4 text-sm">
            <option>Optimal</option>
            <option>Low</option>
            <option>High</option>
          </select>
          <p className="text-sm leading-6 text-[#666]">
            Applies to web display copies only. Originals stay unchanged.
          </p>
        </Field>
      </FieldGroup>

      <FieldGroup>
        <Field>
          <FieldLabel className="font-bold">Terms of Service</FieldLabel>
          <textarea
            className="min-h-36 rounded-none border bg-white p-4 text-sm"
            placeholder="Terms shown on collection pages"
          />
        </Field>
      </FieldGroup>
    </div>
  );
}

const defaultBrandSettings: BrandSettings = {
  logoUrl: "",
  brandText: "Studio Brand",
  brandImageUrl: "",
  accentColor: "#22bda7",
};

function BrandingSettings() {
  const { query, saveSetting } =
    useDashboardSettings<BrandSettings>("branding");
  const saved =
    (query.data?.data?.[0]?.data as BrandSettings | undefined) ??
    defaultBrandSettings;
  const [form, setForm] = useState<BrandSettings>(saved);

  useEffect(() => {
    setForm(saved);
  }, [saved.logoUrl, saved.brandText, saved.brandImageUrl, saved.accentColor]);

  const readImage = (
    file: File | undefined,
    key: keyof Pick<BrandSettings, "logoUrl" | "brandImageUrl">,
  ) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setForm((current) => ({
        ...current,
        [key]: String(reader.result ?? ""),
      }));
    reader.readAsDataURL(file);
  };

  const save = () => {
    saveSetting.mutate(
      {
        localId: "branding",
        name: "Branding",
        data: form,
      },
      {
        onSuccess: () => toast.success("Branding saved"),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="bg-white">
        <h2 className="text-2xl font-medium">Branding</h2>
        <p className="mt-3 text-sm leading-6 text-[#666]">
          Brand logo, text, color, and image can appear on custom admin cover
          templates.
        </p>
        <FieldGroup className="mt-8 gap-7">
          <Field>
            <FieldLabel className="font-bold">Brand Text</FieldLabel>
            <Input
              value={form.brandText}
              onChange={(event) =>
                setForm({ ...form, brandText: event.target.value })
              }
              className="h-12 rounded-none bg-white"
            />
          </Field>
          <Field>
            <FieldLabel className="font-bold">Accent Color</FieldLabel>
            <div className="flex gap-3">
              <Input
                type="color"
                value={form.accentColor}
                onChange={(event) =>
                  setForm({ ...form, accentColor: event.target.value })
                }
                className="size-12 rounded-none p-1"
              />
              <Input
                value={form.accentColor}
                onChange={(event) =>
                  setForm({ ...form, accentColor: event.target.value })
                }
                className="h-12 rounded-none bg-white"
              />
            </div>
          </Field>
          <Field>
            <FieldLabel className="font-bold">Brand Logo</FieldLabel>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) =>
                readImage(event.target.files?.[0], "logoUrl")
              }
              className="h-12 rounded-none bg-white"
            />
          </Field>
          <Field>
            <FieldLabel className="font-bold">Brand Image</FieldLabel>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) =>
                readImage(event.target.files?.[0], "brandImageUrl")
              }
              className="h-12 rounded-none bg-white"
            />
          </Field>
        </FieldGroup>
        <Button
          className="mt-8 h-11 rounded-none bg-[#22bda7] px-8 text-white"
          disabled={saveSetting.isPending}
          onClick={save}
        >
          {saveSetting.isPending ? "Saving..." : "Save Branding"}
        </Button>
      </div>

      <div className="flex min-h-[480px] items-center justify-center bg-[#f4f4f4] p-8">
        <div className="relative aspect-[1.45] w-full max-w-[760px] overflow-hidden bg-[#151515] text-white shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          {form.brandImageUrl ? (
            <img
              src={form.brandImageUrl}
              alt=""
              className="h-full w-full object-cover opacity-70"
            />
          ) : (
            <div className="h-full w-full bg-[#202326]" />
          )}
          <div className="absolute inset-0 bg-black/25" />
          <div className="absolute left-8 top-8 flex items-center gap-4">
            {form.logoUrl && (
              <img
                src={form.logoUrl}
                alt=""
                className="size-16 object-contain"
              />
            )}
            <p
              className="text-xl font-semibold uppercase tracking-[0.22em]"
              style={{ color: form.accentColor }}
            >
              {form.brandText}
            </p>
          </div>
          <div className="absolute bottom-10 left-10 max-w-[70%]">
            <p className="text-sm uppercase tracking-[0.28em]">
              Client Gallery
            </p>
            <h3 className="mt-4 text-5xl font-semibold uppercase tracking-[0.12em]">
              Brand Preview
            </h3>
          </div>
        </div>
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
  const { saveSetting, deleteSetting } = useDashboardSettings("email-template");
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
            <h2 className="text-[28px] font-medium leading-none">
              Email Templates
            </h2>
            <div className="flex h-10 w-full items-center gap-3 bg-white sm:w-[280px]">
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
            <h3 className="mt-10 text-lg font-bold">
              Create your first email template
            </h3>
            <p className="mt-5 max-w-[430px] text-sm leading-6 text-[#333]">
              Saved templates from your account will appear here and can be used
              in Marketing email campaigns.
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
            <div className="min-w-[760px] md:min-w-[860px]">
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
                  <span className="font-bold">
                    {template.name || "Untitled Template"}
                  </span>
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
          <button
            onClick={() => setEditorOpen(false)}
            aria-label="Back to templates"
          >
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
            className="h-10 min-w-0 flex-1 rounded-none border-0 px-0 text-lg font-semibold focus-visible:ring-0 sm:w-[260px] sm:flex-none"
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
        <section className="border-r p-4 sm:p-7">
          <FieldGroup className="gap-7">
            <Field>
              <FieldLabel className="font-bold uppercase text-[#777]">
                Subject
              </FieldLabel>
              <Input
                className="h-12 rounded-none"
                value={activeTemplate.subject}
                onChange={(event) =>
                  updateEmailTemplate({ subject: event.target.value })
                }
              />
            </Field>
            <Field>
              <FieldLabel className="font-bold uppercase text-[#777]">
                Preview Text
              </FieldLabel>
              <Input
                className="h-12 rounded-none"
                value={activeTemplate.previewText}
                onChange={(event) =>
                  updateEmailTemplate({ previewText: event.target.value })
                }
              />
            </Field>
            <Field>
              <FieldLabel className="font-bold uppercase text-[#777]">
                Email Title
              </FieldLabel>
              <Input
                className="h-12 rounded-none"
                value={activeTemplate.title}
                onChange={(event) =>
                  updateEmailTemplate({ title: event.target.value })
                }
              />
            </Field>
            <Field>
              <FieldLabel className="font-bold uppercase text-[#777]">
                Hero Image
              </FieldLabel>
              <Input
                type="file"
                accept="image/*"
                className="h-12 rounded-none"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file)
                    updateEmailTemplate({ image: URL.createObjectURL(file) });
                }}
              />
            </Field>
            <Field>
              <FieldLabel className="font-bold uppercase text-[#777]">
                Message
              </FieldLabel>
              <Textarea
                className="min-h-[210px] resize-none rounded-none leading-6"
                value={activeTemplate.message}
                onChange={(event) =>
                  updateEmailTemplate({ message: event.target.value })
                }
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel className="font-bold uppercase text-[#777]">
                  Button Text
                </FieldLabel>
                <Input
                  className="h-12 rounded-none"
                  value={activeTemplate.buttonText}
                  onChange={(event) =>
                    updateEmailTemplate({ buttonText: event.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel className="font-bold uppercase text-[#777]">
                  Button Link
                </FieldLabel>
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
              <FieldLabel className="font-bold uppercase text-[#777]">
                Button Color
              </FieldLabel>
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
              <FieldLabel className="font-bold uppercase text-[#777]">
                Footer Text
              </FieldLabel>
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
          <h2 className="text-[28px] font-medium leading-none">
            Collection Presets
          </h2>
          <p className="mt-4 max-w-[560px] text-sm leading-6 text-[#666]">
            Presets save collection defaults by user and can be applied when
            creating a collection.
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
          <div className="min-w-[740px] md:min-w-[820px]">
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
                <span className="font-bold">
                  {preset.name || "Untitled Preset"}
                </span>
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
  const [presetDesignPanel, setPresetDesignPanel] = useState<
    "cover" | "typography" | "color" | "grid"
  >("cover");
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
      <div className="flex min-h-[72px] flex-col gap-3 border-b border-[#eee] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-4">
          <Link href={`/dashboard/${section}/settings/presets`}>
            <ArrowLeft className="size-5 text-[#777]" />
          </Link>
          <Input
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            className="h-10 min-w-[180px] flex-1 rounded-none border-0 px-0 text-lg font-semibold focus-visible:ring-0 sm:w-[260px] sm:flex-none"
          />
          <Input
            value={presetCollectionId}
            onChange={(event) => setPresetCollectionId(event.target.value)}
            placeholder="Collection ID (optional)"
            className="h-10 min-w-[180px] flex-1 rounded-none border-0 px-0 text-sm focus-visible:ring-0 sm:w-[230px] sm:flex-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
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
                  : "border-transparent text-[#777]",
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
          <div className="grid gap-8 lg:grid-cols-[160px_minmax(0,1fr)]">
            <div className="flex flex-col gap-1 border-r pr-4">
              {(
                [
                  ["cover", PanelTop, "Cover"],
                  ["typography", Bold, "Typography"],
                  ["color", Palette, "Color"],
                  ["grid", LayoutGrid, "Grid"],
                ] as const
              ).map(([panel, Icon, label]) => (
                <button
                  key={panel}
                  className={cn(
                    "flex h-12 items-center gap-3 px-3 text-left text-sm",
                    presetDesignPanel === panel &&
                      "bg-[#f5f5f5] font-bold text-[#00a997]",
                  )}
                  onClick={() => setPresetDesignPanel(panel)}
                  type="button"
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>
            <PresetDesignPanel
              design={presetDesign}
              activePanel={presetDesignPanel}
              onChange={setPresetDesign}
            />
          </div>
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
        {!["general", "design", "download", "favorite", "store"].includes(
          presetEditorPanel,
        ) && (
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
            onChange={(event) =>
              onChange({ collectionTags: event.target.value })
            }
            placeholder="Optional"
            className="h-12 rounded-none bg-white px-5"
          />
          <p className="text-sm leading-6 text-[#666]">
            Add tags to categorize different collections e.g. wedding, outdoor,
            summer.
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
            Separate photo sets by comma. e.g. Highlights, Reception, Getting
            Ready
          </p>
        </Field>
        <Field>
          <FieldLabel className="font-bold">Default Watermark</FieldLabel>
          <select
            value={general.defaultWatermark}
            onChange={(event) =>
              onChange({ defaultWatermark: event.target.value })
            }
            className="h-12 rounded-none border bg-white px-5"
          >
            <option>No watermark</option>
            {watermarkItems.map((watermark) => (
              <option key={watermark.id} value={watermark.id}>
                {watermark.name}
              </option>
            ))}
          </select>
          <p className="text-sm leading-6 text-[#666]">
            Set default watermark. Manage watermarks in{" "}
            <Link
              href={`/dashboard/${section}/settings/watermark`}
              className="text-[#00a997]"
            >
              App Settings
            </Link>
            .
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
              <p className="text-sm leading-6 text-[#666]">{text}</p>
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
  hidePager = false,
  onBack,
  onChange,
  onNext,
}: {
  favorite: {
    favoritePhotos: boolean;
    favoriteNotes: boolean;
    maxFavorites: string;
    description: string;
  };
  hidePager?: boolean;
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
            Allow visitors to favorite photos. You can review these afterwards
            in Favorite Activity.
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
            Allow clients to add notes to photos they have favorited.
          </p>
        </Field>
        <Field>
          <FieldLabel className="font-bold">Max Favorites</FieldLabel>
          <Input
            type="number"
            min="0"
            value={favorite.maxFavorites}
            onChange={(event) => onChange({ maxFavorites: event.target.value })}
            placeholder="Unlimited"
            className="h-12 rounded-none bg-white"
          />
          <p className="text-sm leading-6 text-[#666]">Empty means no max.</p>
        </Field>
        <Field>
          <FieldLabel className="font-bold">Favorite Description</FieldLabel>
          <Textarea
            value={favorite.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="Tell clients how to use this favorite list."
            className="min-h-28 rounded-none bg-white"
          />
        </Field>
      </FieldGroup>
      {!hidePager && <PresetPager onBack={onBack} onNext={onNext} />}
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
    <PlanFeatureLock feature="store" label="Store">
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
              Set which products are for sale in collections. Manage price
              sheets in <span className="text-[#00a997]">Store</span>
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
              generation Store system. Create a new Price Sheet to gain full
              access or select existing price sheet that matches requirements.
            </p>
          </Field>
        </FieldGroup>

        <div className="mt-14">
          <button
            className="inline-flex items-center gap-2 font-semibold"
            onClick={onBack}
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
        </div>
      </div>
    </PlanFeatureLock>
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
      <button
        className="inline-flex items-center gap-2 font-semibold"
        onClick={onBack}
      >
        <ArrowLeft className="size-4" />
        Back
      </button>
      <button
        className="inline-flex items-center gap-2 font-semibold"
        onClick={onNext}
      >
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

const collectionPreviewThemeMap = {
  Light: ["#ffffff", "#111111", "#555555"],
  White: ["#ffffff", "#111111", "#555555"],
  Gold: ["#fffdf8", "#2a241b", "#a99167"],
  Rose: ["#fbf7f6", "#2d2020", "#a9807c"],
  Terracotta: ["#fbf8f5", "#352018", "#aa7b60"],
  Sand: ["#f5f3f1", "#2f2924", "#9f8f82"],
  Olive: ["#f3f4f0", "#24261b", "#96977a"],
} as const;

const collectionPreviewTypeMap = {
  Sans: "Arial, sans-serif",
  Serif: "Georgia, serif",
  Modern: "Helvetica, sans-serif",
  Timeless: "Times New Roman, serif",
  Bold: "Arial Black, sans-serif",
  Subtle: "Helvetica, sans-serif",
  Classic: "Georgia, serif",
} as const;

function PresetDesignPanel({
  design,
  activePanel,
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
    customFontName?: string;
    customFontDataUrl?: string;
    color: string;
    gridStyle: "Vertical" | "Horizontal";
    thumbnailSize: "Regular" | "Large";
    gridSpacing: "Regular" | "Large";
    navigationStyle: "Icon Only" | "Icon & Text";
  };
  activePanel: "cover" | "typography" | "color" | "grid";
  onChange: (value: Partial<typeof design>) => void;
}) {
  type UploadedFont = { name: string; url: string; fileName: string };
  const [adminCoverTemplates, setAdminCoverTemplates] = useState<
    CustomCoverTemplate[]
  >([]);
  const [fontUploading, setFontUploading] = useState(false);
  const fontLibrary = useDashboardSettings<UploadedFont>("branding");
  const uploadedFonts = (fontLibrary.query.data?.data ?? []).filter((item) =>
    item.localId.startsWith("font:"),
  );
  const customCoverAccess = usePlanFeatureAccess("customCover");
  const uploadFonts = async (files: FileList | null) => {
    const valid = Array.from(files ?? []).filter((file) =>
      /\.(woff2?|ttf|otf)$/i.test(file.name),
    );
    if (!valid.length)
      return toast.error("Choose WOFF, WOFF2, TTF, or OTF fonts");
    setFontUploading(true);
    try {
      for (const file of valid) {
        const url = await uploadDashboardAsset(file);
        const name = file.name.replace(/\.[^.]+$/, "");
        await fontLibrary.saveSetting.mutateAsync({
          localId: `font:${crypto.randomUUID()}`,
          name,
          data: { name, url, fileName: file.name },
        });
      }
      toast.success(
        `${valid.length} font${valid.length === 1 ? "" : "s"} uploaded`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Font upload failed",
      );
    } finally {
      setFontUploading(false);
    }
  };

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
    fetch(`${base}/home-cms`)
      .then((response) => response.json())
      .then((payload: { data?: HomeCmsData }) =>
        setAdminCoverTemplates(payload.data?.coverTemplates ?? []),
      )
      .catch(() => setAdminCoverTemplates([]));
  }, []);

  return (
    <div className="min-w-0 border bg-white p-7">
      {activePanel === "cover" && (
        <>
          <h2 className="text-2xl font-medium">Cover</h2>
          <OptionSection title="Cover Text">
            <FieldGroup className="gap-5">
              {(
                [
                  ["Small Title", "coverSmallTitle", "showCoverSmallTitle"],
                  ["Title", "coverTitle", "showCoverTitle"],
                  ["Date", "coverDate", "showCoverDate"],
                  ["Button", "coverButtonText", "showCoverButton"],
                ] as const
              ).map(([label, key, toggle]) => {
                const selectedCoverDate =
                  key === "coverDate"
                    ? parseDisplayDate(design.coverDate)
                    : undefined;

                return (
                  <Field key={key}>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={design[toggle]}
                        onCheckedChange={(value) =>
                          onChange({ [toggle]: Boolean(value) } as Partial<
                            typeof design
                          >)
                        }
                      />
                      <FieldLabel className="font-bold">{label}</FieldLabel>
                    </div>
                    {key === "coverDate" ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "mt-2 h-11 w-full justify-between rounded-none bg-white px-3 text-left font-normal",
                              !design.coverDate && "text-[#777]",
                            )}
                          >
                            {design.coverDate || "Select date"}
                            <CalendarIcon data-icon="inline-end" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto rounded-none p-0"
                          align="start"
                        >
                          <Calendar
                            mode="single"
                            selected={selectedCoverDate}
                            onSelect={(date) =>
                              onChange({
                                coverDate: date ? format(date, "PPP") : "",
                              })
                            }
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <Input
                        value={design[key]}
                        onChange={(event) =>
                          onChange({ [key]: event.target.value } as Partial<
                            typeof design
                          >)
                        }
                        className="mt-2 h-11 rounded-none bg-white"
                      />
                    )}
                  </Field>
                );
              })}
            </FieldGroup>
          </OptionSection>
          <p className="mt-10 text-sm font-bold">Cover</p>
          <PlanFeatureNotice
            feature="customCover"
            label="Custom cover templates"
          />
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8">
            {adminCoverTemplates.map((template) => (
              <button
                key={template.id}
                className={cn(
                  "relative text-center",
                  customCoverAccess.locked && "cursor-not-allowed opacity-45",
                )}
                disabled={customCoverAccess.locked}
                onClick={() =>
                  onChange({
                    cover: `custom:${template.id}`,
                    customCoverTemplate: template,
                  } as Partial<typeof design>)
                }
                type="button"
              >
                <span
                  className={cn(
                    "block border p-1",
                    design.cover === `custom:${template.id}` &&
                      "border-[#22bda7] ring-1 ring-[#22bda7]",
                  )}
                >
                  <span className="relative block aspect-[1.45] overflow-hidden bg-white">
                    <CoverPreview
                      design={{
                        ...design,
                        cover: `custom:${template.id}`,
                        customCoverTemplate: template,
                      }}
                      compact
                      className="min-h-0"
                    />
                  </span>
                </span>
                <span className="mt-3 block text-sm">{template.name}</span>
              </button>
            ))}
            {coverOptions.map(([name]) => (
              <button
                key={name}
                className="text-center"
                onClick={() => onChange({ cover: name })}
                type="button"
              >
                <span
                  className={cn(
                    "block border p-1",
                    design.cover === name &&
                      "border-[#22bda7] ring-1 ring-[#22bda7]",
                  )}
                >
                  <span className="relative block aspect-[1.45] overflow-hidden bg-white">
                    <CoverPreview
                      design={{ ...design, cover: name }}
                      compact
                      className="min-h-0"
                    />
                  </span>
                </span>
                <span className="mt-3 block text-sm">{name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {activePanel === "typography" && (
        <PlanFeatureLock feature="advancedDesign" label="Advanced design">
          <h2 className="text-2xl font-medium">Typography</h2>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {uploadedFonts.map((font) => (
              <button
                key={font.localId}
                className="text-center"
                onClick={() =>
                  onChange({
                    typography: "Custom",
                    customFontName: font.data.name,
                    customFontDataUrl: font.data.url,
                  } as Partial<typeof design>)
                }
                type="button"
              >
                <span
                  className={cn(
                    "block border p-8 text-left",
                    design.customFontDataUrl === font.data.url &&
                      "border-[#22bda7] ring-1 ring-[#22bda7]",
                  )}
                >
                  <style>{`@font-face{font-family:"${font.data.name.replace(/"/g, "")}";src:url("${font.data.url}");font-display:swap;}`}</style>
                  <span
                    className="block truncate text-xl"
                    style={{
                      fontFamily: `"${font.data.name.replace(/"/g, "")}", serif`,
                    }}
                  >
                    Aa {font.data.name}
                  </span>
                  <span className="mt-3 block text-xs text-[#555]">
                    Saved font
                  </span>
                </span>
                <span className="mt-3 block truncate text-sm">
                  {font.data.name}
                </span>
              </button>
            ))}
            {typographyOptions.map(([name, sample, desc]) => (
              <button
                key={name}
                className="text-center"
                onClick={() =>
                  onChange({
                    typography: name,
                    customFontName: "",
                    customFontDataUrl: "",
                  } as Partial<typeof design>)
                }
                type="button"
              >
                <span
                  className={cn(
                    "block border p-8 text-left",
                    design.typography === name &&
                      "border-[#22bda7] ring-1 ring-[#22bda7]",
                  )}
                >
                  <span className="block text-xl tracking-widest">
                    {sample}
                  </span>
                  <span className="mt-3 block text-sm text-[#555]">{desc}</span>
                </span>
                <span className="mt-3 block text-sm">{name}</span>
              </button>
            ))}
          </div>
          <div className="mt-8 border bg-[#fafafa] p-5">
            <p className="font-bold">Your Font Library</p>
            <p className="mt-2 text-sm text-[#666]">
              Upload many once. Choose any saved font later.
            </p>
            <label className="mt-4 inline-flex h-10 cursor-pointer items-center gap-2 bg-[#111] px-4 text-sm font-bold text-white">
              {fontUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {fontUploading ? "Uploading..." : "Upload Fonts"}
              <input
                type="file"
                multiple
                accept=".woff,.woff2,.ttf,.otf,font/*"
                className="hidden"
                disabled={fontUploading}
                onChange={(event) => {
                  void uploadFonts(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            {design.customFontDataUrl && (
              <button
                className="ml-3 h-10 border bg-white px-4 text-sm font-bold"
                onClick={() =>
                  onChange({
                    typography: "Classic",
                    customFontName: "",
                    customFontDataUrl: "",
                  } as Partial<typeof design>)
                }
                type="button"
              >
                Remove
              </button>
            )}
          </div>
        </PlanFeatureLock>
      )}

      {activePanel === "color" && (
        <PlanFeatureLock feature="advancedDesign" label="Advanced design">
          <h2 className="text-2xl font-medium">Color</h2>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {colorOptions.map(([name, colors]) => (
              <button
                key={name}
                className="text-center"
                onClick={() => onChange({ color: name })}
                type="button"
              >
                <span
                  className={cn(
                    "flex h-[118px] items-center justify-center gap-2 border",
                    design.color === name &&
                      "border-[#22bda7] ring-1 ring-[#22bda7]",
                  )}
                >
                  {colors.map((color) => (
                    <span
                      key={color}
                      className="size-10 rounded-full border"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>
                <span className="mt-3 block text-sm">{name}</span>
              </button>
            ))}
          </div>
        </PlanFeatureLock>
      )}

      {activePanel === "grid" && (
        <PlanFeatureLock feature="layouts" label="Layouts">
          <h2 className="text-2xl font-medium">Grid</h2>
          <OptionSection title="Thumbnail Size">
            <TwoOption
              value={design.thumbnailSize}
              a="Regular"
              b="Large"
              onPick={(value) =>
                onChange({ thumbnailSize: value as "Regular" | "Large" })
              }
            />
          </OptionSection>
          <OptionSection title="Grid Spacing">
            <TwoOption
              value={design.gridSpacing}
              a="Regular"
              b="Large"
              onPick={(value) =>
                onChange({ gridSpacing: value as "Regular" | "Large" })
              }
            />
          </OptionSection>
          <OptionSection title="Navigation Style">
            <TwoOption
              value={design.navigationStyle}
              a="Icon Only"
              b="Icon & Text"
              onPick={(value) =>
                onChange({
                  navigationStyle: value as "Icon Only" | "Icon & Text",
                })
              }
            />
          </OptionSection>
        </PlanFeatureLock>
      )}
    </div>
  );
}

function CollectionDesignLivePreview({
  design,
  collectionName,
  eventDate,
  coverImage,
  images,
  sets,
  favoriteEnabled,
  storeEnabled,
  branding,
}: {
  design: PresetDesignSettings;
  collectionName: string;
  eventDate: string;
  coverImage?: string;
  images: CollectionImageRecord[];
  sets: { id: string; name: string }[];
  favoriteEnabled: boolean;
  storeEnabled: boolean;
  branding?: Partial<BrandSettings>;
}) {
  const previewImages = images.length ? images.slice(0, 6) : [];
  const firstSets = sets.slice(0, 5);
  const masonryGapPx = design.gridSpacing === "Large" ? 8 : 3;
  const masonryColumns =
    design.thumbnailSize === "Large" ? "columns-2" : "columns-3";
  const [bg, fg, accent] =
    collectionPreviewThemeMap[
      design.color as keyof typeof collectionPreviewThemeMap
    ] ?? collectionPreviewThemeMap.Rose;
  const fallbackFontFamily =
    collectionPreviewTypeMap[
      design.typography as keyof typeof collectionPreviewTypeMap
    ] ?? collectionPreviewTypeMap.Classic;
  const customFontName = design.customFontName?.trim();
  const fontFamily = customFontName
    ? `"${customFontName.replace(/"/g, "")}", ${fallbackFontFamily}`
    : fallbackFontFamily;
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const isMobilePreview = previewDevice === "mobile";

  return (
    <aside className="sticky top-0 hidden h-[calc(100dvh-2rem)] self-start overflow-hidden bg-[#f4f4f4] px-8 py-6 xl:block">
      <div className="mb-4 flex items-center justify-center gap-4 text-[#777]">
        <button
          className={cn(
            "flex size-9 items-center justify-center",
            !isMobilePreview && "bg-white text-[#111] shadow-sm",
          )}
          onClick={() => setPreviewDevice("desktop")}
          aria-label="Desktop preview"
          type="button"
        >
          <Monitor className="size-5" />
        </button>
        <button
          className={cn(
            "flex size-9 items-center justify-center",
            isMobilePreview && "bg-white text-[#111] shadow-sm",
          )}
          onClick={() => setPreviewDevice("mobile")}
          aria-label="Mobile preview"
          type="button"
        >
          <Smartphone className="size-5" />
        </button>
      </div>
      <div
        className={cn(
          "mx-auto w-full transition-all duration-300",
          isMobilePreview ? "max-w-[320px]" : "max-w-[650px]",
        )}
      >
        {customFontName && design.customFontDataUrl && (
          <style>{`@font-face{font-family:"${customFontName.replace(/"/g, "")}";src:url("${design.customFontDataUrl}");font-display:swap;}`}</style>
        )}
        <div
          className={cn(
            "shadow-[0_28px_80px_rgba(0,0,0,0.18)]",
            isMobilePreview && "rounded-[28px] border-[10px] border-[#1d1d1d]",
          )}
          style={{ backgroundColor: bg, color: fg, fontFamily }}
        >
          <div
            className="overflow-hidden border border-white"
            style={{ backgroundColor: bg }}
          >
            <div
              className={cn(
                "overflow-hidden",
                isMobilePreview ? "h-[210px]" : "h-[260px]",
              )}
            >
              <CoverPreview
                design={{
                  ...design,
                  coverTitle: design.coverTitle || collectionName,
                  coverDate: design.coverDate || eventDate,
                  branding,
                }}
                image={coverImage ? imageSrc(coverImage) : undefined}
                className="min-h-full"
              />
            </div>
            <div className="flex items-center justify-between border-b border-black/10 px-3 py-2">
              <div className="min-w-0">
                <p
                  className="text-[7px] uppercase tracking-[0.24em]"
                  style={{ color: accent }}
                >
                  Masonry Gallery
                </p>
                <p className="mt-1 truncate text-[14px] font-semibold">
                  {collectionName}
                </p>
                <p
                  className="mt-1 text-[7px] uppercase tracking-[0.18em]"
                  style={{ color: accent }}
                >
                  {design.coverSmallTitle || "Studio"}
                </p>
              </div>
              <div
                className="flex items-center gap-2"
                style={{ color: accent }}
              >
                {favoriteEnabled && <Heart className="size-3" />}
                <Download className="size-3" />
                <Share2 className="size-3" />
                {storeEnabled && <ShoppingBag className="size-3" />}
              </div>
            </div>
            <div
              className="flex items-center gap-5 overflow-hidden px-3 py-2 text-[7px]"
              style={{ color: accent }}
            >
              {firstSets.length ? (
                firstSets.map((set) => (
                  <span key={set.id} className="shrink-0">
                    {set.name}
                  </span>
                ))
              ) : (
                <span>Highlights</span>
              )}
            </div>
            <div
              className={isMobilePreview ? "columns-2" : masonryColumns}
              style={{ columnGap: `${masonryGapPx}px` }}
            >
              {previewImages.length
                ? previewImages.map((image, index) => (
                    <div
                      key={image._id}
                      className="break-inside-avoid overflow-hidden bg-[#ececec]"
                      style={{ marginBottom: `${masonryGapPx}px` }}
                    >
                      <img
                        src={imageSrc(image.thumbnailUrl || image.url)}
                        alt=""
                        className={cn(
                          "block w-full object-cover",
                          index % 3 === 0
                            ? "aspect-[0.82]"
                            : index % 3 === 1
                              ? "aspect-[1.3]"
                              : "aspect-square",
                        )}
                      />
                    </div>
                  ))
                : Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        "break-inside-avoid bg-[#e8e8e8]",
                        index % 2 ? "aspect-[1.25]" : "aspect-square",
                      )}
                      style={{ marginBottom: `${masonryGapPx}px` }}
                    />
                  ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function OptionSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
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
          <span
            className={cn(
              "flex h-[108px] items-center justify-center border",
              value === item && "border-[#22bda7] ring-1 ring-[#22bda7]",
            )}
          >
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
  const pinAccess = usePlanFeatureAccess("pinSet");
  const limitAccess = usePlanFeatureAccess("downloadLimit");
  return (
    <div className="max-w-[620px]">
      <FieldGroup className="gap-12">
        <Field>
          <FieldLabel className="font-bold">Photo Download</FieldLabel>
          <div className="flex items-center gap-3">
            <Switch
              checked={download.photoDownload}
              onCheckedChange={(value) => onChange({ photoDownload: value })}
            />
            <span>{download.photoDownload ? "On" : "Off"}</span>
          </div>
          <button className="inline-flex items-center gap-2 text-sm font-semibold text-[#00a997]">
            Additional options <ChevronDown className="size-4" />
          </button>
        </Field>

        <Field>
          <FieldLabel className="font-bold">
            Photo Downloadable Sizes
          </FieldLabel>
          <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={download.highResolution}
                onCheckedChange={(value) =>
                  onChange({ highResolution: Boolean(value) })
                }
              />
              High Resolution
            </label>
            {(["Original", "3600px"] as const).map((size) => (
              <label key={size} className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={download.highResolutionSize === size}
                  onChange={() => onChange({ highResolutionSize: size })}
                />
                {size === "Original"
                  ? "Original - Upgrade required. Upgrade"
                  : size}
              </label>
            ))}
            <label className="flex items-center gap-2">
              <Checkbox
                checked={download.webSize}
                onCheckedChange={(value) =>
                  onChange({ webSize: Boolean(value) })
                }
              />
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
            Allow photos to be downloaded in select sizes.
          </p>
        </Field>

        <PlanFeatureNotice feature="pinSet" label="Download PIN" />
        {[
          [
            "Video Download",
            "videoDownload",
            "Control video download availability.",
          ],
          [
            "Download PIN",
            "downloadPin",
            "If enabled, all collections created from this preset will have a download PIN set automatically.",
          ],
        ].map(([label, key, text]) => (
          <Field
            key={key}
            className={cn(
              key === "downloadPin" &&
                pinAccess.locked &&
                "pointer-events-none opacity-45",
            )}
          >
            <FieldLabel className="font-bold">{label}</FieldLabel>
            <div className="flex items-center gap-3">
              <Switch
                disabled={key === "downloadPin" && pinAccess.locked}
                checked={download[key as "videoDownload" | "downloadPin"]}
                onCheckedChange={(value) =>
                  onChange({ [key]: value } as Partial<typeof download>)
                }
              />
              <span>
                {download[key as "videoDownload" | "downloadPin"]
                  ? "On"
                  : "Off"}
              </span>
            </div>
            <p className="text-sm leading-6 text-[#666]">{text}</p>
            {key === "downloadPin" && download.downloadPin && (
              <Input
                value={download.downloadPinCode}
                onChange={(event) =>
                  onChange({ downloadPinCode: event.target.value })
                }
                placeholder="Set download PIN"
                className="mt-3 h-12 rounded-none bg-white px-5"
              />
            )}
          </Field>
        ))}

        <div>
          <PlanFeatureNotice feature="downloadLimit" label="Download limits" />
          <p className="mb-8 text-[11px] font-bold uppercase tracking-widest text-[#777]">
            Advanced Settings
          </p>
          <FieldGroup className="gap-12">
            {[
              [
                "Restrict Downloads to Collection Contacts",
                "restrictDownloads",
                "Allow only assigned Collection Contacts to download photos.",
              ],
              [
                "Limit Photo Downloads",
                "limitDownloads",
                "Set number of photos that can be downloaded in these collections.",
              ],
            ].map(([label, key, text]) => (
              <Field
                key={key}
                className={cn(
                  limitAccess.locked && "pointer-events-none opacity-45",
                )}
              >
                <FieldLabel className="font-bold">{label}</FieldLabel>
                <div className="flex items-center gap-3">
                  <Switch
                    disabled={limitAccess.locked}
                    checked={
                      download[key as "restrictDownloads" | "limitDownloads"]
                    }
                    onCheckedChange={(value) =>
                      onChange({ [key]: value } as Partial<typeof download>)
                    }
                  />
                  <span>
                    {download[key as "restrictDownloads" | "limitDownloads"]
                      ? "On"
                      : "Off"}
                  </span>
                </div>
                <p className="text-sm leading-6 text-[#666]">{text}</p>
                {key === "limitDownloads" && download.limitDownloads && (
                  <Input
                    value={download.limitPinUsage}
                    onChange={(event) =>
                      onChange({ limitPinUsage: event.target.value })
                    }
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
  const { addWatermarkDraft, selectWatermark, watermarkItems } =
    useDashboardStore();

  return (
    <div className="max-w-[760px]">
      <div className="flex items-center justify-between gap-6">
        <div>
          <p className="text-sm font-bold">Watermarks</p>
          <p className="mt-3 max-w-[560px] text-sm leading-6 text-[#666]">
            Create multiple watermarks, then pick one as default inside
            collection presets.
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

async function uploadDashboardAsset(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/mobile-gallery/assets", {
    method: "POST",
    body: form,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || "Upload failed");
  const url = String(payload?.data?.url || "");
  if (!url) throw new Error("Upload failed");
  return url;
}

function WatermarkSettings({ section }: { section: DashboardSection }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [watermarkImageUploading, setWatermarkImageUploading] = useState(false);
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
        ? Math.min(
            45,
            Math.max(
              5,
              ((watermarkText || "Watermark").length *
                Math.max(14, watermarkScale / 2)) /
                12,
            ),
          )
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
  const startDrag = (event: PointerEvent<HTMLElement>) => {
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
  const uploadWatermarkFile = async (file?: File) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setWatermarkType("image");
    setWatermarkImage(previewUrl);
    setWatermarkImageUploading(true);
    try {
      const url = await uploadDashboardAsset(file);
      setWatermarkImage(url);
      toast.success("Watermark image uploaded");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Watermark upload failed",
      );
    } finally {
      setWatermarkImageUploading(false);
      URL.revokeObjectURL(previewUrl);
    }
  };
  const saveWatermarkToDb = () => {
    if (watermarkImageUploading) {
      toast.error("Wait until watermark image upload finishes");
      return;
    }
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
        </div>

        <div>
          <p className="mb-3 text-sm font-bold">Watermark Type</p>
          <div className="grid grid-cols-2 border bg-[#fafafa] p-1">
            {(["text", "image"] as const).map((type) => (
              <button
                key={type}
                className={cn(
                  "h-10 text-xs font-bold uppercase tracking-widest",
                  watermarkType === type && "bg-white shadow-sm",
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
                      watermarkColor === color &&
                        "ring-2 ring-[#22bda7] ring-offset-2",
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
                void uploadWatermarkFile(file);
                event.currentTarget.value = "";
              }}
            />
            {watermarkImageUploading && (
              <p className="mt-2 text-xs font-semibold text-[#00a997]">
                Uploading watermark image...
              </p>
            )}
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
                      "bg-[#22bda7]",
                  )}
                  onClick={() => setWatermarkPosition({ x, y })}
                  aria-label={`Set watermark ${x} ${y}`}
                />
              )),
            )}
          </div>
          <p className="mt-3 text-sm text-[#666]">
            Drag watermark on preview, or pick a position.
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
            disabled={watermarkImageUploading}
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
          style={{ containerType: "inline-size" }}
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
                fontSize: `max(18px, ${watermarkScale * 0.2}cqw)`,
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
              className="absolute cursor-grab select-none object-contain active:cursor-grabbing"
              style={{
                left: `${watermarkPosition.x}%`,
                top: `${watermarkPosition.y}%`,
                width: `max(40px, ${watermarkScale * 0.28}cqw)`,
                opacity: watermarkOpacity / 100,
                transform: "translate(-50%, -50%)",
              }}
              onPointerDown={startDrag}
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">
              Upload watermark image
            </div>
          )}
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
  return <HomepageSettingsPanel />;
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
      <PopoverContent
        className="w-[calc(100vw-2rem)] max-w-[480px] rounded-none border-0 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.12)] sm:p-6"
        align="start"
      >
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
            Need help searching? Use keywords, gallery names, or file info.
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
            <p className="text-xs font-bold uppercase tracking-wide text-[#777]">
              {label}
            </p>
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
              <div
                key={status}
                className="flex items-center justify-between text-sm"
              >
                <span className="capitalize text-[#555]">{status}</span>
                <span className="font-bold">
                  {data?.statusCounts?.[status] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </StorePageShell>
  );
}

function storeOrderImageSrc(url?: string) {
  if (!url) return "";
  if (
    url.startsWith("data:") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  )
    return url;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
  return url.startsWith("/") ? `${base}${url}` : url;
}

async function downloadStoreOrderImage(
  item: StoreOrderRecord["items"][number],
  filename: string,
) {
  const source = storeOrderImageSrc(item.imageUrl);
  if (!source) return;

  if (!item.crop) {
    const link = document.createElement("a");
    link.href = source;
    link.download = `${filename}.jpg`;
    link.click();
    return;
  }

  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = source;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image could not be loaded"));
    });

    const [ratioW, ratioH] = String(item.crop.aspectRatio || "4:3")
      .split(":")
      .map(Number);
    const width = 1600;
    const height =
      ratioW > 0 && ratioH > 0 ? Math.round(width * (ratioH / ratioW)) : 1200;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");

    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.translate(
      width / 2 + (width * Number(item.crop.x ?? 0)) / 100,
      height / 2 + (height * Number(item.crop.y ?? 0)) / 100,
    );
    context.rotate((Number(item.crop.rotation ?? 0) * Math.PI) / 180);
    const baseScale =
      item.crop.fit === "contain"
        ? Math.min(width / image.width, height / image.height)
        : Math.max(width / image.width, height / image.height);
    const scale = baseScale * Number(item.crop.zoom ?? 1);
    context.drawImage(
      image,
      (-image.width * scale) / 2,
      (-image.height * scale) / 2,
      image.width * scale,
      image.height * scale,
    );

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${filename}-modified.png`;
    link.click();
  } catch {
    toast.error("Unable to download the modified image.");
  }
}

function storeCropRatio(value?: string) {
  const [width, height] = String(value || "4:3")
    .split(":")
    .map(Number);
  return width > 0 && height > 0 ? width / height : 4 / 3;
}

async function downloadStoreOrderImages(order: StoreOrderRecord) {
  for (const [index, item] of order.items.entries()) {
    if (item.imageUrl) {
      await downloadStoreOrderImage(item, `${order.orderNumber}-${index + 1}`);
      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }
  }
}

function StoreOrdersPanel() {
  const { ordersQuery, createOrder, updateOrder, deleteOrder } =
    useStoreOrders();
  const { rulesQuery: shippingQuery } =
    useStoreRules<StoreShippingRecord>("shipping");
  const settingsQuery = useStoreSettings().settingsQuery;
  const currency = settingsQuery.data?.data?.currency ?? "EUR";
  const orders = ordersQuery.data?.data ?? [];
  const shippingMethods = shippingQuery.data?.data ?? [];
  const [open, setOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState<StoreOrderRecord | null>(null);
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
          shippingMethods.find((method) => method._id === form.shippingMethodId)
            ?.name ?? "",
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
          columns={[
            "Order",
            "Customer",
            "Items",
            "Shipping",
            "Tracking",
            "Status",
            "Payment",
            "Total",
            "Actions",
          ]}
          rows={orders.map((order) => [
            order.orderNumber,
            <div key="customer">
              <p className="font-medium">{order.customer?.name}</p>
              <p className="text-xs text-[#777]">{order.customer?.email}</p>
            </div>,
            `${order.items?.length ?? 0} item`,
            <div key="shipping">
              <p>{money(order.shipping ?? 0, currency)}</p>
              <p className="text-xs text-[#777]">
                {order.shippingMethodName || order.shippingNote || "-"}
              </p>
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
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>,
            <StatusBadge key="payment" value={order.paymentStatus} />,
            money(order.total, currency),
            <div key="actions" className="flex items-center gap-3">
              <button
                className="text-[#555] hover:text-black"
                onClick={() => setViewOrder(order)}
                aria-label="View order"
              >
                <Eye className="size-4" />
              </button>
              <button
                className="text-red-600"
                onClick={() => deleteOrder.mutate(order._id)}
                aria-label="Delete order"
              >
                <Trash2 className="size-4" />
              </button>
            </div>,
          ])}
          empty="No orders yet"
        />
      </div>
      <Dialog
        open={Boolean(viewOrder)}
        onOpenChange={(next) => !next && setViewOrder(null)}
      >
        <DialogContent className="rounded-none sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>
              {viewOrder?.orderNumber ?? "Order details"}
            </DialogTitle>
            <DialogDescription>
              {viewOrder?.customer?.name}{" "}
              {viewOrder?.customer?.email
                ? `- ${viewOrder.customer.email}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {viewOrder && (
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              {viewOrder.items.some((item) => item.imageUrl) && (
                <button
                  className="mb-4 inline-flex h-10 items-center gap-2 border px-4 text-sm font-semibold"
                  onClick={() => void downloadStoreOrderImages(viewOrder)}
                  type="button"
                >
                  <Download className="size-4" />
                  Download all images
                </button>
              )}
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div className="border p-3">
                  <p className="text-xs text-[#777]">Status</p>
                  <StatusBadge value={viewOrder.status} />
                </div>
                <div className="border p-3">
                  <p className="text-xs text-[#777]">Payment</p>
                  <StatusBadge value={viewOrder.paymentStatus} />
                </div>
                <div className="border p-3">
                  <p className="text-xs text-[#777]">Total</p>
                  <p className="mt-1 font-semibold">
                    {money(viewOrder.total, currency)}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-4">
                {viewOrder.items.map((item, index) => (
                  <article
                    key={`${item.productId ?? item.name}-${index}`}
                    className="grid gap-4 border p-4 md:grid-cols-[180px_1fr]"
                  >
                    <div
                      className="relative overflow-hidden bg-[#f1f1ef]"
                      style={{
                        aspectRatio: storeCropRatio(item.crop?.aspectRatio),
                      }}
                    >
                      {item.imageUrl ? (
                        <img
                          src={storeOrderImageSrc(item.imageUrl)}
                          alt={item.name}
                          className="absolute left-1/2 top-1/2 h-full w-full max-w-none"
                          style={{
                            objectFit:
                              item.crop?.fit === "contain"
                                ? "contain"
                                : "cover",
                            transform: item.crop
                              ? `translate(calc(-50% + ${item.crop.x}%), calc(-50% + ${item.crop.y}%)) scale(${item.crop.zoom}) rotate(${item.crop.rotation}deg)`
                              : "translate(-50%, -50%)",
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-[#888]">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{item.name}</h3>
                          <p className="mt-1 text-xs text-[#777]">
                            {item.variantLabel || item.type}
                          </p>
                        </div>
                        <p className="font-semibold">
                          {money(item.total, currency)}
                        </p>
                      </div>
                      <div className="mt-4 grid gap-2 text-sm text-[#555] sm:grid-cols-3">
                        <p>Qty: {item.quantity}</p>
                        <p>Unit: {money(item.unitPrice, currency)}</p>
                        <p>Image: {item.imageId || "-"}</p>
                      </div>
                      {item.crop && (
                        <p className="mt-3 text-xs text-[#777]">
                          Crop: {item.crop.aspectRatio || "custom"} / zoom{" "}
                          {Number(item.crop.zoom ?? 1).toFixed(2)}
                        </p>
                      )}
                      {item.imageUrl && (
                        <button
                          className="mt-4 inline-flex h-10 items-center gap-2 border px-4 text-sm font-semibold"
                          onClick={() =>
                            void downloadStoreOrderImage(
                              item,
                              `${viewOrder.orderNumber}-${index + 1}`,
                            )
                          }
                          type="button"
                        >
                          <Download className="size-4" />
                          {item.crop
                            ? "Download modified image"
                            : "Download image"}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Add Order</DialogTitle>
            <DialogDescription>
              Manual order entry with customer and tracking.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StoreInput
                label="Customer Name"
                value={form.name}
                onChange={(name) => setForm((v) => ({ ...v, name }))}
              />
              <StoreInput
                label="Email"
                value={form.email}
                onChange={(email) => setForm((v) => ({ ...v, email }))}
              />
              <StoreInput
                label="Phone"
                value={form.phone}
                onChange={(phone) => setForm((v) => ({ ...v, phone }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <StoreInput
                label="Item"
                value={form.itemName}
                onChange={(itemName) => setForm((v) => ({ ...v, itemName }))}
              />
              <StoreInput
                label="Qty"
                value={form.quantity}
                onChange={(quantity) => setForm((v) => ({ ...v, quantity }))}
              />
              <StoreInput
                label="Unit Price"
                value={form.unitPrice}
                onChange={(unitPrice) => setForm((v) => ({ ...v, unitPrice }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <StoreInput
                label="Tax"
                value={form.tax}
                onChange={(tax) => setForm((v) => ({ ...v, tax }))}
              />
              <StoreInput
                label="Discount"
                value={form.discount}
                onChange={(discount) => setForm((v) => ({ ...v, discount }))}
              />
              <StoreInput
                label="Tracking"
                value={form.trackingNumber}
                onChange={(trackingNumber) =>
                  setForm((v) => ({ ...v, trackingNumber }))
                }
              />
              <StoreInput
                label="Shipping Note"
                value={form.shippingNote}
                onChange={(shippingNote) =>
                  setForm((v) => ({ ...v, shippingNote }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel className="font-bold">Shipping Method</FieldLabel>
                <select
                  value={form.shippingMethodId}
                  onChange={(event) => {
                    const method = shippingMethods.find(
                      (item) => item._id === event.target.value,
                    );
                    setForm((value) => ({
                      ...value,
                      shippingMethodId: event.target.value,
                      shipping: method
                        ? String(method.price ?? 0)
                        : value.shipping,
                      shippingNote: method
                        ? (method.region ?? "")
                        : value.shippingNote,
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
              <StoreInput
                label="Shipping Charge"
                value={form.shipping}
                onChange={(shipping) => setForm((v) => ({ ...v, shipping }))}
              />
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-none bg-[#22bda7] text-white"
              disabled={!form.email.trim()}
              onClick={addOrder}
            >
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
            <DialogDescription>
              Customer records merge by email.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <StoreInput
              label="Name"
              value={form.name}
              onChange={(name) => setForm((v) => ({ ...v, name }))}
            />
            <StoreInput
              label="Email"
              value={form.email}
              onChange={(email) => setForm((v) => ({ ...v, email }))}
            />
            <StoreInput
              label="Phone"
              value={form.phone}
              onChange={(phone) => setForm((v) => ({ ...v, phone }))}
            />
          </FieldGroup>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-none bg-[#22bda7] text-white"
              disabled={!form.email.trim()}
              onClick={addCustomer}
            >
              Save Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StorePageShell>
  );
}

function StoreCouponsPanel() {
  const { rulesQuery, saveRule, deleteRule } =
    useStoreRules<StoreCouponRecord>("coupons");
  const settingsQuery = useStoreSettings().settingsQuery;
  const currency = settingsQuery.data?.data?.currency ?? "EUR";
  const coupons = rulesQuery.data?.data ?? [];
  const [form, setForm] = useState({
    code: "",
    name: "",
    discountType: "percent",
    amount: "",
  });
  return (
    <StorePageShell title="Coupons" subtitle="Discount codes for checkout.">
      <StoreRuleForm
        fields={[
          ["Code", form.code, (code) => setForm((v) => ({ ...v, code }))],
          ["Name", form.name, (name) => setForm((v) => ({ ...v, name }))],
          [
            "Amount",
            form.amount,
            (amount) => setForm((v) => ({ ...v, amount })),
          ],
        ]}
        extra={
          <select
            value={form.discountType}
            onChange={(event) =>
              setForm((v) => ({ ...v, discountType: event.target.value }))
            }
            className="h-11 border bg-white px-3 text-sm outline-none"
          >
            <option value="percent">Percent</option>
            <option value="fixed">Fixed</option>
          </select>
        }
        onSave={() =>
          saveRule.mutate({
            ...form,
            amount: Number(form.amount),
          } as Partial<StoreCouponRecord>)
        }
      />
      <StoreTable
        columns={["Code", "Name", "Type", "Amount", "Used", "Status", ""]}
        rows={coupons.map((coupon) => [
          coupon.code,
          coupon.name,
          coupon.discountType,
          coupon.discountType === "percent"
            ? `${coupon.amount}%`
            : money(coupon.amount, currency),
          String(coupon.usageCount ?? 0),
          <StatusBadge key="active" value={coupon.active ? "active" : "off"} />,
          <button
            key="delete"
            className="text-red-600"
            onClick={() => deleteRule.mutate(coupon._id)}
          >
            Delete
          </button>,
        ])}
        empty="No coupons yet"
      />
    </StorePageShell>
  );
}

function StoreTaxesPanel() {
  const { rulesQuery, saveRule, deleteRule } =
    useStoreRules<StoreTaxRecord>("taxes");
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
            <TabsTrigger
              value="rates"
              className="h-14 rounded-none border border-b-0 px-5 data-[state=active]:bg-white"
            >
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
                ]
                  .filter(Boolean)
                  .join(", ") || "-",
                <StatusBadge
                  key="active"
                  value={tax.active ? "active" : "off"}
                />,
                <div
                  key="actions"
                  className="flex justify-end gap-4 text-[#00a997]"
                >
                  <button
                    aria-label="Edit tax rate"
                    onClick={() => {
                      setForm({
                        _id: tax._id,
                        region: tax.region || "United States",
                        rate: String(tax.rate ?? 0),
                        applyShipping: tax.applyShipping ?? true,
                        applyDigitalDownloads:
                          tax.applyDigitalDownloads ?? true,
                      });
                      setOpen(true);
                    }}
                  >
                    <Settings className="size-4" />
                  </button>
                  <button
                    aria-label="Delete tax rate"
                    onClick={() => deleteRule.mutate(tax._id)}
                  >
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
            <DialogTitle className="text-base tracking-[0.18em]">
              ADD TAX RATE
            </DialogTitle>
            <DialogDescription className="sr-only">
              Create or edit tax rate.
            </DialogDescription>
          </DialogHeader>
          <div className="px-12 py-10">
            <FieldGroup className="gap-7">
              <Field>
                <FieldLabel className="font-bold">Country</FieldLabel>
                <select
                  value={form.region}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      region: event.target.value,
                    }))
                  }
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
                  Add the country you would like to collect taxes from, then
                  enter a country-wide sales tax rate.
                </p>
              </Field>
              <Field>
                <FieldLabel className="font-bold">Tax Rate (%)</FieldLabel>
                <Input
                  value={form.rate}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, rate: event.target.value }))
                  }
                  className="h-12 rounded-none text-base"
                  inputMode="decimal"
                />
              </Field>
              <label className="flex items-center gap-3 text-sm font-bold">
                <Checkbox
                  checked={form.applyShipping}
                  onCheckedChange={(checked) =>
                    setForm((value) => ({
                      ...value,
                      applyShipping: Boolean(checked),
                    }))
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
            <Button
              variant="outline"
              className="rounded-none border-0"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-none bg-[#22bda7] px-8 text-white"
              onClick={saveTax}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StorePageShell>
  );
}

function StoreShippingPanel() {
  const { rulesQuery, saveRule, deleteRule } =
    useStoreRules<StoreShippingRecord>("shipping");
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
            <TabsTrigger
              value="self"
              className="h-14 rounded-none border border-b-0 px-5 data-[state=active]:bg-white"
            >
              Self Fulfillment
            </TabsTrigger>
            <TabsTrigger
              value="auto"
              className="h-14 rounded-none px-5 text-[#00a997]"
            >
              Automatic Fulfillment
            </TabsTrigger>
          </TabsList>
          <TabsContent value="self" className="mt-8">
            <p className="max-w-[850px] text-sm leading-6 text-[#7a828c]">
              Create shipping methods that will apply to all your Self
              fulfillment price sheets. You will need to create at least one
              shipping method for the country you'd like to sell to.
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
                  {rates.length ? (
                    rates.map((rate) => (
                      <tr key={rate._id} className="border-b">
                        <td className="px-2 py-5">{rate.name}</td>
                        <td className="px-2 py-5">
                          {money(rate.price, currency)}
                        </td>
                        <td className="px-2 py-5">
                          {rate.shipInternational
                            ? "International"
                            : rate.region || "United States"}
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
                                  shipInternational: Boolean(
                                    rate.shipInternational,
                                  ),
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
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-2 py-12 text-center text-[#777]"
                      >
                        No shipping methods yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
          <TabsContent
            value="auto"
            className="mt-8 border bg-[#fafafa] p-8 text-sm leading-6 text-[#667085]"
          >
            Automatic fulfillment can be connected later when vendor integration
            is ready.
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none p-0 sm:max-w-[700px]">
          <DialogHeader className="bg-[#f7f7f7] px-9 py-8">
            <DialogTitle className="text-base tracking-[0.18em]">
              ADD SHIPPING METHOD
            </DialogTitle>
            <DialogDescription className="sr-only">
              Create or edit self fulfillment shipping method.
            </DialogDescription>
          </DialogHeader>
          <div className="px-12 py-10">
            <FieldGroup className="gap-7">
              <Field>
                <FieldLabel className="font-bold">
                  Name this Shipping method
                </FieldLabel>
                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, name: event.target.value }))
                  }
                  placeholder="e.g. USPS Priority Mail Express, Fedex 2Days"
                  className="h-12 rounded-none text-base"
                />
                <p className="text-sm leading-6 text-[#7a828c]">
                  You can add multiple shipping methods for each country. Each
                  order is charged a flat fee.
                </p>
              </Field>
              <Field>
                <FieldLabel className="font-bold">
                  Flat fee per order
                </FieldLabel>
                <Input
                  value={form.price}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      price: event.target.value,
                    }))
                  }
                  placeholder="0.00"
                  className="h-12 rounded-none text-base"
                  inputMode="decimal"
                />
              </Field>
              <Field>
                <FieldLabel className="font-bold">Country</FieldLabel>
                <select
                  value={form.region}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      region: event.target.value,
                    }))
                  }
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
                    setForm((value) => ({
                      ...value,
                      shipInternational: Boolean(checked),
                    }))
                  }
                />
                Ship to international
              </label>
            </FieldGroup>
          </div>
          <DialogFooter className="px-12 pb-10">
            <Button
              variant="outline"
              className="rounded-none border-0"
              onClick={() => setOpen(false)}
            >
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
    stripe: {
      enabled: false,
      accountLink: "",
      publishableKey: "",
      secretKey: "",
    },
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

  const updateLink = (
    index: number,
    value: Partial<{ label: string; url: string }>,
  ) => {
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
          <p className="mt-3 text-xs text-[#777]">
            Turn store checkout on/off globally.
          </p>
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
                  onChange={(event) =>
                    setStripe({ secretKey: event.target.value })
                  }
                  placeholder="Write secret key only when changing"
                  className="h-11 rounded-none bg-white"
                />
                <p className="text-xs text-[#777]">
                  Write-only. Saved key is never shown again.
                </p>
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
                setForm((current) => ({
                  ...current,
                  currency: event.target.value,
                }))
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
                setForm((current) => ({
                  ...current,
                  orderDelay: event.target.value,
                }))
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
              <span className="text-sm">
                {form.maintainMarkup ? "On" : "Off"}
              </span>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold">Round prices up to</p>
            <select
              value={form.roundPricesUpTo}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  roundPricesUpTo: event.target.value,
                }))
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
              <div
                key={index}
                className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <Input
                  value={link.label}
                  onChange={(event) =>
                    updateLink(index, { label: event.target.value })
                  }
                  placeholder="Label"
                  className="h-11 rounded-none"
                />
                <Input
                  value={link.url}
                  onChange={(event) =>
                    updateLink(index, { url: event.target.value })
                  }
                  placeholder="https://..."
                  className="h-11 rounded-none"
                />
                <Button
                  variant="outline"
                  className="h-11 rounded-none"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      links: current.links.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
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
            <FieldLabel className="font-bold">
              Gift Card Sharing Email
            </FieldLabel>
            <Input
              value={form.giftCardSharingEmail}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  giftCardSharingEmail: event.target.value,
                }))
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
          <p className="mt-3 max-w-[680px] text-sm leading-6 text-[#666]">
            {subtitle}
          </p>
        </div>
        {action && (
          <Button
            className="h-10 w-fit rounded-none bg-[#22bda7] px-6 text-sm font-bold text-white"
            onClick={onAction}
          >
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
              <th key={column} className="border-b px-5 py-4 font-bold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={index} className="border-b last:border-b-0">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="px-5 py-4 align-middle text-[#333]"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className="px-5 py-12 text-center text-[#777]"
              >
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
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-none"
      />
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
          <StoreInput
            key={label}
            label={label}
            value={value}
            onChange={onChange}
          />
        ))}
        {extra && (
          <Field>
            <FieldLabel className="font-bold">Type</FieldLabel>
            {extra}
          </Field>
        )}
      </div>
      <Button
        className="mt-4 h-10 rounded-none bg-[#22bda7] px-6 text-white"
        onClick={onSave}
      >
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

function getPricingProductCount(
  sheet?: (StorePriceSheetRecord & { products?: StoreProductRecord[] }) | null,
) {
  return (sheet?.products ?? []).length;
}

function pickPrimaryPricingSheet(
  sheets: StorePriceSheetRecord[],
  detailedSheets: Array<
    (StorePriceSheetRecord & { products?: StoreProductRecord[] }) | null
  >,
) {
  if (!detailedSheets.length) return null;

  return detailedSheets.reduce<
    (StorePriceSheetRecord & { products?: StoreProductRecord[] }) | null
  >((best, current) => {
    if (!current) return best;
    if (!best) return current;

    const currentCount = getPricingProductCount(current);
    const bestCount = getPricingProductCount(best);

    if (currentCount > bestCount) return current;
    if (currentCount < bestCount) return best;

    if (current.isDefault && !best.isDefault) return current;
    if (!current.isDefault && best.isDefault) return best;

    const currentIndex = sheets.findIndex((sheet) => sheet._id === current._id);
    const bestIndex = sheets.findIndex((sheet) => sheet._id === best._id);
    return currentIndex !== -1 && (bestIndex === -1 || currentIndex < bestIndex)
      ? current
      : best;
  }, null);
}

function StorePricingPanel() {
  const router = useRouter();
  const { priceSheetsQuery, createPriceSheet } = useStorePriceSheets();
  const deleteProduct = useStoreProductDelete();
  const settingsQuery = useStoreSettings().settingsQuery;
  const currency = settingsQuery.data?.data?.currency ?? "EUR";
  const sheets = priceSheetsQuery.data?.data ?? [];
  const priceSheetDetails = useStorePriceSheetDetails(
    sheets.map((sheet) => sheet._id),
  );
  const detailedSheets = priceSheetDetails
    .map((query) => query.data?.data ?? null)
    .filter(
      (
        sheet,
      ): sheet is StorePriceSheetRecord & { products: StoreProductRecord[] } =>
        Boolean(sheet),
    );
  const pricingSheet = pickPrimaryPricingSheet(sheets, detailedSheets);
  const products = detailedSheets.flatMap((sheet) => sheet.products ?? []);
  const creatingDefault = useRef(false);
  const pricingLoading = priceSheetDetails.some((query) => query.isLoading);
  const [deleteTarget, setDeleteTarget] = useState<StoreProductRecord | null>(
    null,
  );

  useEffect(() => {
    if (
      priceSheetsQuery.isLoading ||
      sheets.length ||
      createPriceSheet.isPending ||
      creatingDefault.current
    ) {
      return;
    }
    creatingDefault.current = true;
    createPriceSheet.mutate(
      {
        name: "Default Print Store Pricing",
        isDefault: true,
        minimumOrderAmount: 0,
      },
      {
        onSettled: () => {
          creatingDefault.current = false;
        },
      },
    );
  }, [createPriceSheet, priceSheetsQuery.isLoading, sheets.length]);

  const groupedProducts = products.reduce<Record<string, StoreProductRecord[]>>(
    (groups, product) => {
      const key =
        product.type === "digital-download"
          ? "Digital Downloads"
          : product.category || "Prints";
      groups[key] = [...(groups[key] ?? []), product];
      return groups;
    },
    {},
  );
  const orderedGroups = [
    ...["Prints", "Wall Art", "Digital Downloads"].filter(
      (category) => groupedProducts[category]?.length,
    ),
    ...Object.keys(groupedProducts).filter(
      (category) =>
        !["Prints", "Wall Art", "Digital Downloads"].includes(category),
    ),
  ];

  const goAdd = (type: StoreProductType) => {
    if (!pricingSheet?._id) return;
    router.push(`/dashboard/store-gallery/pricing/new?type=${type}`);
  };

  if (
    priceSheetsQuery.isLoading ||
    createPriceSheet.isPending ||
    pricingLoading
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[#666]">
        Loading pricing...
      </div>
    );
  }

  if (!sheets.length) {
    return (
      <div className="mx-auto flex max-w-[855px] min-h-[420px] flex-col items-center justify-center border bg-[#fafafa] p-8 text-center">
        <CreditCard className="size-10 text-[#999]" />
        <p className="mt-5 font-bold">Default pricing not ready</p>
        <Button
          className="mt-6 h-10 rounded-none bg-[#22bda7] px-7 text-sm font-bold text-white"
          onClick={() =>
            createPriceSheet.mutate({
              name: "Default Print Store Pricing",
              isDefault: true,
              minimumOrderAmount: 0,
            })
          }
        >
          Create Default Pricing
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[950px] px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-5 border-b pb-5">
        <div>
          <h1 className="text-[28px] font-medium leading-none">
            Pricing Sheet
          </h1>
          <p className="mt-3 text-sm text-[#666]">
            Update digital downloads, print items, and fulfillment products used
            by public galleries.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-10 rounded-none bg-[#22bda7] px-6 text-sm font-bold text-white">
              <PlusCircle data-icon="inline-start" />
              Add Product
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[calc(100vw-2rem)] max-w-[300px] rounded-none border-[#dedede] p-5 shadow-[0_18px_35px_rgba(0,0,0,0.18)]"
            align="end"
          >
            <DropdownMenuGroup className="flex flex-col gap-4">
              <DropdownMenuItem
                className="cursor-pointer items-start gap-4 rounded-none p-2"
                onClick={() => goAdd("self-fulfilled")}
              >
                <Images className="mt-1 size-5 text-[#8a949e]" />
                <span>
                  <span className="block font-bold text-[#222]">
                    Print / Wall Art Item
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-[#7a828c]">
                    Add a product with image, prices, variants, and hide
                    controls.
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer items-start gap-4 rounded-none p-2"
                onClick={() => goAdd("digital-download")}
              >
                <Download className="mt-1 size-5 text-[#8a949e]" />
                <span>
                  <span className="block font-bold text-[#222]">
                    Digital Download
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-[#7a828c]">
                    Sell downloadable files from the public gallery.
                  </span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {products.length ? (
        <div className="mt-9 flex flex-col gap-12">
          {orderedGroups.map((category) => (
            <section key={category}>
              <h2 className="text-lg font-medium">{category}</h2>
              <div className="mt-5 grid gap-8 border-t pt-5 sm:grid-cols-2 md:grid-cols-4">
                {groupedProducts[category].map((product) => (
                  <ProductTile
                    key={product._id}
                    product={product}
                    currency={currency}
                    onEdit={() =>
                      router.push(
                        `/dashboard/store-gallery/pricing/${product._id}`,
                      )
                    }
                    onDelete={() => setDeleteTarget(product)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-9 flex min-h-[260px] flex-col items-center justify-center border bg-[#fafafa] p-8 text-center">
          <Package className="size-10 text-[#aaa]" />
          <p className="mt-5 font-bold">No pricing products yet</p>
          <p className="mt-2 text-sm text-[#666]">
            Add digital downloads or fulfillment products.
          </p>
        </div>
      )}
      <DeleteConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete product"
        description={
          deleteTarget
            ? `Delete "${deleteTarget.name}" from this pricing sheet?`
            : ""
        }
        pending={deleteProduct.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget?.priceSheetId) return;
          deleteProduct.mutate(
            {
              priceSheetId: deleteTarget.priceSheetId,
              productId: deleteTarget._id,
            },
            { onSuccess: () => setDeleteTarget(null) },
          );
        }}
      />
    </div>
  );
}

function StorePricingRouteEditor({
  productId,
  productType,
}: {
  productId: string;
  productType?: StoreProductType;
}) {
  const router = useRouter();
  const { priceSheetsQuery, createPriceSheet } = useStorePriceSheets();
  const sheets = priceSheetsQuery.data?.data ?? [];
  const priceSheetDetails = useStorePriceSheetDetails(
    sheets.map((sheet) => sheet._id),
  );
  const detailedSheets = priceSheetDetails
    .map((query) => query.data?.data ?? null)
    .filter(
      (
        sheet,
      ): sheet is StorePriceSheetRecord & { products: StoreProductRecord[] } =>
        Boolean(sheet),
    );
  const pricingSheet = pickPrimaryPricingSheet(sheets, detailedSheets);
  const ownerSheet =
    productId === "new"
      ? pricingSheet
      : (detailedSheets.find((sheet) =>
          (sheet.products ?? []).some((item) => item._id === productId),
        ) ?? null);
  const editingProduct =
    productId === "new"
      ? null
      : (ownerSheet?.products?.find((item) => item._id === productId) ?? null);
  const type = editingProduct?.type ?? productType ?? "self-fulfilled";
  const { createProduct, updateProduct, deleteProduct } = useStorePriceSheet(
    ownerSheet?._id,
  );
  const creatingDefault = useRef(false);
  const pricingLoading = priceSheetDetails.some((query) => query.isLoading);

  useEffect(() => {
    if (
      priceSheetsQuery.isLoading ||
      sheets.length ||
      createPriceSheet.isPending ||
      creatingDefault.current
    ) {
      return;
    }
    creatingDefault.current = true;
    createPriceSheet.mutate(
      {
        name: "Default Print Store Pricing",
        isDefault: true,
        minimumOrderAmount: 0,
      },
      {
        onSettled: () => {
          creatingDefault.current = false;
        },
      },
    );
  }, [createPriceSheet, priceSheetsQuery.isLoading, sheets.length]);

  useEffect(() => {
    if (
      productId !== "new" &&
      !priceSheetsQuery.isLoading &&
      !pricingLoading &&
      !editingProduct
    ) {
      router.push("/dashboard/store-gallery/pricing");
    }
  }, [
    editingProduct,
    priceSheetsQuery.isLoading,
    pricingLoading,
    productId,
    router,
  ]);

  if (
    priceSheetsQuery.isLoading ||
    createPriceSheet.isPending ||
    pricingLoading ||
    !ownerSheet?._id
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[#666]">
        Loading pricing product...
      </div>
    );
  }

  return (
    <ProductEditorDialog
      open={true}
      type={type}
      product={editingProduct}
      pending={createProduct.isPending || updateProduct.isPending}
      onOpenChange={(open) => {
        if (!open) router.push("/dashboard/store-gallery/pricing");
      }}
      onSave={(payload) =>
        editingProduct
          ? updateProduct.mutate(
              { productId: editingProduct._id, payload },
              {
                onSuccess: () =>
                  router.push("/dashboard/store-gallery/pricing"),
              },
            )
          : createProduct.mutate(payload, {
              onSuccess: () => router.push("/dashboard/store-gallery/pricing"),
            })
      }
      onHide={
        editingProduct
          ? () => {
              deleteProduct.mutate(editingProduct._id, {
                onSuccess: () =>
                  router.push("/dashboard/store-gallery/pricing"),
              });
            }
          : undefined
      }
      hidePending={deleteProduct.isPending}
    />
  );
}

function StoreProductsPanel() {
  const router = useRouter();
  const { priceSheetsQuery, createPriceSheet, deletePriceSheet } =
    useStorePriceSheets();
  const sheets = priceSheetsQuery.data?.data ?? [];
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheetName, setSheetName] = useState("My Price Sheet");
  const [minimumOrderAmount, setMinimumOrderAmount] = useState("0");
  const [fulfillment, setFulfillment] = useState<"self-fulfilled" | "auto">(
    "self-fulfilled",
  );
  const [deleteSheet, setDeleteSheet] = useState<StorePriceSheetRecord | null>(
    null,
  );

  const addSheet = () => {
    createPriceSheet.mutate(
      {
        name: sheetName.trim() || "My Price Sheet",
        isDefault: !sheets.length,
        minimumOrderAmount: Number(minimumOrderAmount) || 0,
        fulfillment,
      },
      {
        onSuccess: (response) => {
          setSettingsOpen(false);
          const id = response?.data?._id;
          if (!id) return;
          router.push(`/dashboard/store-gallery/products/${id}`);
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-[950px]">
      <div className="flex items-center justify-between gap-5 border-b pb-4">
        <div>
          <h1 className="text-[26px] font-medium leading-none">Price Sheets</h1>
          <p className="mt-3 text-sm text-[#777]">
            Manage store price sheets outside collection pages.
          </p>
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
            <article key={sheet._id} className="group relative text-left">
              <button
                className="block w-full text-left"
                onClick={() =>
                  router.push(`/dashboard/store-gallery/products/${sheet._id}`)
                }
                type="button"
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
                  {sheet.productCount ?? 0} Products &nbsp;{" "}
                  {sheet.collectionCount ?? 0} Collection
                </span>
              </button>
              <button
                className="absolute right-3 top-3 flex size-9 items-center justify-center bg-white text-red-600 opacity-0 shadow-sm transition group-hover:opacity-100"
                onClick={() => setDeleteSheet(sheet)}
                type="button"
                aria-label="Delete price sheet"
              >
                <Trash2 className="size-4" />
              </button>
            </article>
          ))}
        </div>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="rounded-none sm:max-w-[630px]">
          <DialogHeader>
            <DialogTitle className="tracking-[0.18em]">
              PRICE SHEET SETTINGS
            </DialogTitle>
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
                  <FieldLabel className="font-bold">
                    Price Sheet Name
                  </FieldLabel>
                  <Input
                    value={sheetName}
                    onChange={(event) => setSheetName(event.target.value)}
                    className="h-12 rounded-none bg-white"
                  />
                </Field>
                <Field>
                  <FieldLabel className="font-bold">Fulfillment</FieldLabel>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        [
                          "self-fulfilled",
                          "Self fulfillment",
                          "Empty sheet. You add products manually.",
                        ],
                        [
                          "auto",
                          "Auto defaults",
                          "Create sheet with default Print and Wall Art products.",
                        ],
                      ] as const
                    ).map(([value, label, text]) => (
                      <button
                        key={value}
                        type="button"
                        className={cn(
                          "border px-4 py-4 text-left",
                          fulfillment === value &&
                            "border-[#22bda7] bg-[#f2fbf9]",
                        )}
                        onClick={() => setFulfillment(value)}
                      >
                        <span className="block text-sm font-bold">{label}</span>
                        <span className="mt-1 block text-xs leading-5 text-[#777]">
                          {text}
                        </span>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field>
                  <FieldLabel className="font-bold">
                    Minimum Order Amount
                  </FieldLabel>
                  <Input
                    value={minimumOrderAmount}
                    onChange={(event) =>
                      setMinimumOrderAmount(event.target.value)
                    }
                    className="h-12 rounded-none bg-white"
                    inputMode="decimal"
                  />
                </Field>
              </FieldGroup>
            </TabsContent>
            <TabsContent
              value="advanced"
              className="mt-7 text-sm leading-6 text-[#666]"
            >
              Collections use the Store Gallery Pricing defaults unless changed
              by store settings.
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => setSettingsOpen(false)}
            >
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
      <DeleteConfirmDialog
        open={Boolean(deleteSheet)}
        title="Delete price sheet"
        description={
          deleteSheet
            ? `Delete "${deleteSheet.name}" and all products inside it?`
            : ""
        }
        pending={deletePriceSheet.isPending}
        onCancel={() => setDeleteSheet(null)}
        onConfirm={() => {
          if (!deleteSheet) return;
          deletePriceSheet.mutate(deleteSheet._id, {
            onSuccess: () => setDeleteSheet(null),
          });
        }}
      />
    </div>
  );
}

function StorePriceSheetDetail({ priceSheetId }: { priceSheetId: string }) {
  const router = useRouter();
  const { priceSheetQuery, updatePriceSheet, deleteProduct } =
    useStorePriceSheet(priceSheetId);
  const settingsQuery = useStoreSettings().settingsQuery;
  const currency = settingsQuery.data?.data?.currency ?? "EUR";
  const sheet = priceSheetQuery.data?.data;
  const products = sheet?.products ?? [];
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    minimumOrderAmount: "0",
  });
  const [deleteTarget, setDeleteTarget] = useState<StoreProductRecord | null>(
    null,
  );

  useEffect(() => {
    if (!sheet) return;
    setSettingsForm({
      name: sheet.name,
      minimumOrderAmount: String(sheet.minimumOrderAmount ?? 0),
    });
  }, [sheet]);

  const groupedProducts = products.reduce<Record<string, StoreProductRecord[]>>(
    (groups, product) => {
      const key =
        product.type === "digital-download"
          ? "Digital Downloads"
          : product.category || "Prints";
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
            <DropdownMenuContent
              className="w-[calc(100vw-2rem)] max-w-[300px] rounded-none border-[#dedede] p-5 shadow-[0_18px_35px_rgba(0,0,0,0.18)]"
              align="end"
            >
              <DropdownMenuGroup className="flex flex-col gap-4">
                {(
                  [
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
                  ] as const
                ).map((item) => (
                  <DropdownMenuItem
                    key={item.type}
                    className="cursor-pointer items-start gap-4 rounded-none p-2"
                    onClick={() =>
                      router.push(
                        `/dashboard/store-gallery/products/${priceSheetId}/new?type=${item.type}`,
                      )
                    }
                  >
                    <item.icon className="mt-1 size-5 text-[#8a949e]" />
                    <span>
                      <span className="block font-bold text-[#222]">
                        {item.title}
                      </span>
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
        <p className="mb-5 text-xs font-bold uppercase tracking-wide">
          Price Sheet Details
        </p>
        <div className="grid gap-7 text-sm sm:grid-cols-3">
          <DetailStat label="Name" value={sheet.name} />
          <DetailStat
            label="Assigned To"
            value={`${sheet.collectionCount ?? 0} Collection`}
          />
          <DetailStat label="Fulfillment" value="Self Fulfillment" />
          <DetailStat
            label="Minimum Order Value"
            value={money(sheet.minimumOrderAmount ?? 0, currency)}
          />
          <DetailStat
            label="Available Products"
            value={`${products.length} Items`}
          />
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
                    onEdit={() =>
                      router.push(
                        `/dashboard/store-gallery/products/${priceSheetId}/${product._id}`,
                      )
                    }
                    onDelete={() => setDeleteTarget(product)}
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
          <p className="mt-2 text-sm text-[#666]">
            Add digital downloads or self fulfilled items.
          </p>
        </div>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="rounded-none sm:max-w-[630px]">
          <DialogHeader>
            <DialogTitle className="tracking-[0.18em]">
              PRICE SHEET SETTINGS
            </DialogTitle>
            <DialogDescription>
              General settings for this sheet.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-7">
            <Field>
              <FieldLabel className="font-bold">Price Sheet Name</FieldLabel>
              <Input
                value={settingsForm.name}
                onChange={(event) =>
                  setSettingsForm((value) => ({
                    ...value,
                    name: event.target.value,
                  }))
                }
                className="h-12 rounded-none"
              />
            </Field>
            <Field>
              <FieldLabel className="font-bold">Fulfillment</FieldLabel>
              <p className="text-sm">Self Fulfillment</p>
            </Field>
            <Field>
              <FieldLabel className="font-bold">
                Minimum Order Amount
              </FieldLabel>
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
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => setSettingsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-none bg-[#22bda7] text-white"
              onClick={saveSettings}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete product"
        description={
          deleteTarget
            ? `Delete "${deleteTarget.name}" from this pricing sheet?`
            : ""
        }
        pending={deleteProduct.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteProduct.mutate(deleteTarget._id, {
            onSuccess: () => setDeleteTarget(null),
          });
        }}
      />
    </div>
  );
}

function StoreProductRouteEditor({
  priceSheetId,
  productId,
  productType,
}: {
  priceSheetId: string;
  productId: string;
  productType?: StoreProductType;
}) {
  const router = useRouter();
  const { priceSheetQuery, createProduct, updateProduct, deleteProduct } =
    useStorePriceSheet(priceSheetId);
  const sheet = priceSheetQuery.data?.data;
  const editingProduct =
    productId === "new"
      ? null
      : ((sheet?.products ?? []).find((item) => item._id === productId) ??
        null);
  const type = editingProduct?.type ?? productType ?? "self-fulfilled";
  const listPath = `/dashboard/store-gallery/products/${priceSheetId}`;

  useEffect(() => {
    if (productId !== "new" && !priceSheetQuery.isLoading && !editingProduct) {
      router.push(listPath);
    }
  }, [editingProduct, listPath, priceSheetQuery.isLoading, productId, router]);

  if (priceSheetQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[#666]">
        Loading product...
      </div>
    );
  }

  return (
    <ProductEditorDialog
      open={true}
      type={type}
      product={editingProduct}
      pending={createProduct.isPending || updateProduct.isPending}
      onOpenChange={(open) => {
        if (!open) router.push(listPath);
      }}
      onSave={(payload) =>
        editingProduct
          ? updateProduct.mutate(
              { productId: editingProduct._id, payload },
              {
                onSuccess: () => router.push(listPath),
              },
            )
          : createProduct.mutate(payload, {
              onSuccess: () => router.push(listPath),
            })
      }
      onHide={
        editingProduct
          ? () => {
              deleteProduct.mutate(editingProduct._id, {
                onSuccess: () => router.push(listPath),
              });
            }
          : undefined
      }
      hidePending={deleteProduct.isPending}
    />
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

function DeleteConfirmDialog({
  open,
  title,
  description,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent className="rounded-none sm:max-w-[430px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-none"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            className="rounded-none bg-red-600 text-white hover:bg-red-700"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductTile({
  product,
  currency,
  onEdit,
  onDelete,
}: {
  product: StoreProductRecord;
  currency: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group">
      <div className="relative flex aspect-square items-center justify-center bg-[#f3f3f3]">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt=""
            className="h-full w-full object-cover"
          />
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
      <button
        className="mt-3 flex w-full items-start justify-between gap-3 text-left"
        onClick={onEdit}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{product.name}</p>
          <p className="mt-1 text-sm text-[#777]">
            From {money(productDisplayPrice(product), currency)}
          </p>
          <p className="mt-1 text-xs text-[#999]">
            {productTypeLabels[product.type]}
            {product.active === false ? " â€¢ Hidden" : ""}
          </p>
        </div>
        <MoreHorizontal className="size-5 shrink-0 text-[#00a997]" />
      </button>
    </div>
  );
}

function productDisplayPrice(product: StoreProductRecord) {
  const visiblePrices = (product.variants ?? [])
    .filter((variant) => !variant.hidden)
    .map((variant) => Number(variant.price))
    .filter((price) => Number.isFinite(price));
  return visiblePrices.length
    ? Math.min(...visiblePrices)
    : Number(product.price || 0);
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
    if (current !== next)
      editor.commands.setContent(next, { emitUpdate: false });
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
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: href.trim() })
      .run();
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

const defaultSelfFulfilledOptions: StoreProductOption[] = [
  {
    name: "Size",
    values: [
      "4 x 6",
      "5 x 7",
      "8 x 10",
      "8 x 12",
      "11 x 14",
      "12 x 18",
      "16 x 20",
    ],
  },
  { name: "Paper", values: ["Glossy", "Matte"] },
];

function optionValueList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionValuesText(values: string[]) {
  return values.join(", ");
}

function variantId(options: Record<string, string>) {
  return Object.entries(options)
    .map(([name, value]) => `${name}:${value}`)
    .join("|");
}

function buildProductVariants(
  options: StoreProductOption[],
  existing: StoreProductVariant[],
  basePrice: number,
) {
  const activeOptions = options
    .map((option) => ({
      name: option.name.trim(),
      values: option.values.map((value) => value.trim()).filter(Boolean),
    }))
    .filter((option) => option.name && option.values.length);
  if (!activeOptions.length) return [];

  const combinations = activeOptions.reduce<Record<string, string>[]>(
    (rows, option) =>
      rows.flatMap((row) =>
        option.values.map((value) => ({ ...row, [option.name]: value })),
      ),
    [{}],
  );

  return combinations.map((combo) => {
    const id = variantId(combo);
    const previous = existing.find((variant) => variant.id === id);
    return {
      id,
      label: Object.values(combo).join(", "),
      options: combo,
      price: previous?.price ?? basePrice,
      hidden: previous?.hidden ?? false,
    };
  });
}

function ProductEditorDialog({
  open,
  type,
  product,
  pending,
  onOpenChange,
  onSave,
  onHide,
  hidePending = false,
}: {
  open: boolean;
  type: StoreProductType;
  product?: StoreProductRecord | null;
  pending: boolean;
  onOpenChange: (value: boolean) => void;
  onSave: (payload: StoreProductPayload) => void;
  onHide?: () => void;
  hidePending?: boolean;
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
    options: [] as StoreProductOption[],
    variants: [] as StoreProductVariant[],
  });

  useEffect(() => {
    if (!open) return;
    if (product) {
      setForm({
        name: product.name ?? "",
        description: product.description ?? "",
        price: String(product.price ?? 0),
        extraShipping: String(product.extraShipping ?? 0),
        category:
          product.category ??
          (type === "digital-download" ? "Digital Downloads" : "Prints"),
        images: product.images ?? [],
        downloadType: product.downloadType ?? "single-photo",
        downloadSize:
          product.downloadSize ?? "High Resolution Original (Full res)",
        noImageRequired: Boolean(product.noImageRequired),
        exemptFromSalesTax: Boolean(product.exemptFromSalesTax),
        limitOnePerCheckout: Boolean(product.limitOnePerCheckout),
        allowBulkPurchase: Boolean(product.allowBulkPurchase),
        options:
          product.options ??
          (type === "self-fulfilled" ? defaultSelfFulfilledOptions : []),
        variants: product.variants ?? [],
      });
      return;
    }
    const defaultOptions =
      type === "self-fulfilled" ? defaultSelfFulfilledOptions : [];
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
      options: defaultOptions,
      variants:
        type === "self-fulfilled"
          ? buildProductVariants(defaultOptions, [], 0)
          : [],
    });
  }, [open, product, type]);

  useEffect(() => {
    if (!open || type !== "self-fulfilled") return;
    setForm((current) => ({
      ...current,
      variants: buildProductVariants(
        current.options,
        current.variants,
        Number(current.price) || 0,
      ),
    }));
  }, [form.options, form.price, open, type]);

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
      options: type === "self-fulfilled" ? form.options : [],
      variants: type === "self-fulfilled" ? form.variants : [],
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
    setForm((current) => ({
      ...current,
      images: [...current.images, ...images],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-none sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>
            {product
              ? "Edit Product"
              : type === "digital-download"
                ? "Add Digital Download"
                : "Add Product"}
          </DialogTitle>
          <DialogDescription>{productTypeLabels[type]}</DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-7">
          {type === "digital-download" && (
            <Field>
              <FieldLabel className="font-bold">Download Type</FieldLabel>
              <div className="flex gap-4">
                {(
                  [
                    ["single-photo", Images, "Single Photo"],
                    ["all-photos", LayoutGrid, "All Photos"],
                  ] as const
                ).map(([value, Icon, label]) => (
                  <button
                    key={value}
                    className={cn(
                      "flex size-24 flex-col items-center justify-center border text-xs",
                      form.downloadType === value && "border-[#22bda7]",
                    )}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        downloadType: value,
                      }))
                    }
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
                  setForm((current) => ({
                    ...current,
                    downloadSize: event.target.value,
                  }))
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
              <span className="mt-3 text-sm font-bold">
                Upload product photo
              </span>
              <span className="mt-1 text-xs text-[#777]">
                Shown in store product cards.
              </span>
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
                  <div
                    key={`${image.slice(0, 24)}-${index}`}
                    className="group relative aspect-square bg-[#f3f3f3]"
                  >
                    <img
                      src={image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1 hidden size-7 items-center justify-center bg-white text-red-600 shadow-sm group-hover:flex"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          images: current.images.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
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
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
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
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    price: event.target.value,
                  }))
                }
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
                    setForm((current) => ({
                      ...current,
                      extraShipping: event.target.value,
                    }))
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
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                className="h-12 w-full border bg-white px-3 text-sm outline-none"
              >
                <option>Prints</option>
                <option>Packages</option>
                <option>Digital</option>
                <option>Wall Art</option>
                <option>Cards</option>
                <option>Albums & Books</option>
                <option>Gifts</option>
                <option>Other</option>
              </select>
            </Field>
          )}

          {type === "self-fulfilled" && (
            <div className="grid gap-5">
              <div>
                <p className="text-base font-bold">Product Options</p>
                <div className="mt-3 grid gap-2">
                  {form.options.map((option, index) => (
                    <div
                      key={`${option.name}-${index}`}
                      className="grid gap-3 bg-[#f7f7f7] p-4 md:grid-cols-[170px_1fr_auto]"
                    >
                      <Input
                        value={option.name}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            options: current.options.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, name: event.target.value }
                                : item,
                            ),
                          }))
                        }
                        className="h-11 rounded-none bg-white"
                        placeholder="Option name"
                      />
                      <Input
                        value={optionValuesText(option.values)}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            options: current.options.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    values: optionValueList(event.target.value),
                                  }
                                : item,
                            ),
                          }))
                        }
                        className="h-11 rounded-none bg-white"
                        placeholder="Comma separated values"
                      />
                      <button
                        type="button"
                        className="flex h-11 items-center justify-center px-3 text-red-600"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            options: current.options.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          }))
                        }
                        aria-label="Remove option"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-3 text-sm font-bold text-[#00a997]"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      options: [
                        ...current.options,
                        { name: "Option", values: ["Value"] },
                      ],
                    }))
                  }
                >
                  + Add product option
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-base font-bold">Pricing</p>
                  <p className="text-xs font-semibold text-[#777]">
                    Hide variants clients should not order.
                  </p>
                </div>
                <div className="mt-3 max-h-[360px] overflow-y-auto border bg-white">
                  <div className="grid grid-cols-[1fr_120px_64px] border-b bg-[#fafafa] px-4 py-3 text-xs font-bold uppercase text-[#777]">
                    <span>Variation</span>
                    <span>Price</span>
                    <span className="text-center">Hide</span>
                  </div>
                  {form.variants.map((variant) => (
                    <div
                      key={variant.id}
                      className="grid grid-cols-[1fr_120px_64px] items-center gap-3 border-b px-4 py-2 last:border-b-0"
                    >
                      <span
                        className={cn(
                          "text-sm",
                          variant.hidden && "text-[#aaa] line-through",
                        )}
                      >
                        {variant.label}
                      </span>
                      <Input
                        value={String(variant.price)}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            variants: current.variants.map((item) =>
                              item.id === variant.id
                                ? {
                                    ...item,
                                    price: Number(event.target.value) || 0,
                                  }
                                : item,
                            ),
                          }))
                        }
                        className="h-9 rounded-none bg-white text-right"
                      />
                      <button
                        type="button"
                        className="flex h-9 items-center justify-center text-[#777]"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            variants: current.variants.map((item) =>
                              item.id === variant.id
                                ? { ...item, hidden: !item.hidden }
                                : item,
                            ),
                          }))
                        }
                        aria-label={
                          variant.hidden ? "Show variation" : "Hide variation"
                        }
                      >
                        <Eye
                          className={cn(
                            "size-4",
                            variant.hidden && "opacity-35",
                          )}
                        />
                      </button>
                    </div>
                  ))}
                  {!form.variants.length && (
                    <p className="px-4 py-6 text-sm text-[#777]">
                      Add options to create variations.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {type === "self-fulfilled" && (
            <div className="grid gap-5">
              {(
                [
                  ["noImageRequired", "No Image Required"],
                  ["exemptFromSalesTax", "Exempt From Sales Tax"],
                  ["limitOnePerCheckout", "Limit One Per Checkout"],
                  ["allowBulkPurchase", "Allow Bulk Purchase"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-5 text-sm font-bold"
                >
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
          {product && onHide && (
            <Button
              variant="outline"
              className="rounded-none text-red-600"
              disabled={hidePending}
              onClick={onHide}
            >
              {hidePending ? "Deleting..." : "Delete"}
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-none"
            onClick={() => onOpenChange(false)}
          >
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
  const {
    collectionsQuery,
    updateCollection,
    deleteCollection,
    duplicateCollection,
  } = useCollections();
  const homepage = useHomepageSettings().query;
  const router = useRouter();
  const collections = collectionsQuery.data?.data ?? [];
  const [quickEdit, setQuickEdit] = useState<CollectionRecord | null>(null);
  const [quickForm, setQuickForm] = useState({
    name: "",
    eventDate: "",
    status: "draft" as "draft" | "published",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [eventDateFilter, setEventDateFilter] = useState("all");
  const [expiryDateFilter, setExpiryDateFilter] = useState("all");
  const [starredFilter, setStarredFilter] = useState("all");
  const [sortFilter, setSortFilter] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const statuses = useMemo(
    () =>
      [
        ...new Set(
          collections
            .map((item) => item.status)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [collections],
  );
  const tags = useMemo(
    () => [...new Set(collections.flatMap((item) => item.tags ?? []))].sort(),
    [collections],
  );

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearchTerm(searchTerm),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [searchTerm]);
  useEffect(() => {
    if (!quickEdit) return;
    setQuickForm({
      name: quickEdit.name,
      eventDate: quickEdit.eventDate ? quickEdit.eventDate.slice(0, 10) : "",
      status: quickEdit.status === "published" ? "published" : "draft",
    });
  }, [quickEdit]);

  const filteredCollections = useMemo(() => {
    const query = debouncedSearchTerm.trim().toLowerCase();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const matches = collections.filter((collection) => {
      const searchable = [
        collection.name,
        collection.status,
        ...(collection.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (query && !searchable.includes(query)) return false;
      if (statusFilter !== "all" && collection.status !== statusFilter)
        return false;
      if (tagFilter !== "all" && !(collection.tags ?? []).includes(tagFilter))
        return false;

      const event = collection.eventDate
        ? new Date(collection.eventDate)
        : null;
      if (eventDateFilter === "upcoming" && (!event || event < today))
        return false;
      if (eventDateFilter === "past" && (!event || event >= today))
        return false;
      if (eventDateFilter === "none" && event) return false;

      const expiry = collection.expiresAt
        ? new Date(collection.expiresAt)
        : null;
      if (expiryDateFilter === "active" && (!expiry || expiry < now))
        return false;
      if (expiryDateFilter === "expired" && (!expiry || expiry >= now))
        return false;
      if (expiryDateFilter === "none" && expiry) return false;

      const isStarred = collection.settings?.starred === true;
      if (starredFilter === "yes" && !isStarred) return false;
      if (starredFilter === "no" && isStarred) return false;
      return true;
    });

    return [...matches].sort((left, right) => {
      if (sortFilter === "name-asc") return left.name.localeCompare(right.name);
      if (sortFilter === "name-desc")
        return right.name.localeCompare(left.name);
      const leftTime = new Date(
        left.createdAt ?? left.eventDate ?? 0,
      ).getTime();
      const rightTime = new Date(
        right.createdAt ?? right.eventDate ?? 0,
      ).getTime();
      return sortFilter === "oldest"
        ? leftTime - rightTime
        : rightTime - leftTime;
    });
  }, [
    collections,
    debouncedSearchTerm,
    eventDateFilter,
    expiryDateFilter,
    sortFilter,
    starredFilter,
    statusFilter,
    tagFilter,
  ]);
  const filtersActive = Boolean(
    searchTerm ||
    statusFilter !== "all" ||
    tagFilter !== "all" ||
    eventDateFilter !== "all" ||
    expiryDateFilter !== "all" ||
    starredFilter !== "all" ||
    sortFilter !== "newest",
  );
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setTagFilter("all");
    setEventDateFilter("all");
    setExpiryDateFilter("all");
    setStarredFilter("all");
    setSortFilter("newest");
  };
  const openCollectionPreview = (collection: CollectionRecord) => {
    const siteSlug = homepage.data?.data?.slug;
    if (!siteSlug)
      return toast.error(
        "Homepage address is still loading. Try Preview again.",
      );
    const url = publicCollectionUrl(
      siteSlug,
      collection.slug ?? collection._id,
      window.location.origin,
    );
    if (collection.status === "published") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (
      !window.confirm("This collection is Draft. Publish it and open Preview?")
    )
      return;
    const previewTab = window.open("about:blank", "_blank");
    updateCollection.mutate(
      { collectionId: collection._id, payload: { status: "published" } },
      {
        onSuccess: () => {
          if (previewTab) previewTab.location.href = url;
          else window.location.assign(url);
        },
        onError: (error) => {
          previewTab?.close();
          toast.error(error.message);
        },
      },
    );
  };
  const shareCollection = async (collection: CollectionRecord) => {
    if (collection.status !== "published") {
      toast.error("Publish this collection before sharing it.");
      return;
    }
    const siteSlug = homepage.data?.data?.slug;
    if (!siteSlug) return toast.error("Homepage address is still loading.");
    const url = publicCollectionUrl(
      siteSlug,
      collection.slug ?? collection._id,
      window.location.origin,
    );
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Collection link copied");
    } catch {
      toast.error(url);
    }
  };
  const duplicate = (collection: CollectionRecord) => {
    duplicateCollection.mutate(collection._id, {
      onSuccess: () => toast.success("Collection duplicated"),
      onError: (error) => toast.error(error.message),
    });
  };
  const saveQuickEdit = () => {
    if (!quickEdit) return;
    updateCollection.mutate(
      {
        collectionId: quickEdit._id,
        payload: {
          name: quickForm.name.trim(),
          eventDate: quickForm.eventDate || undefined,
          status: quickForm.status,
        },
      },
      {
        onSuccess: () => {
          toast.success("Collection updated");
          setQuickEdit(null);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };
  const toggleCollectionStar = (collection: CollectionRecord) => {
    const isStarred = collection.settings?.starred === true;
    updateCollection.mutate({
      collectionId: collection._id,
      payload: {
        settings: {
          ...(collection.settings ?? {}),
          starred: !isStarred,
        },
      },
    });
  };
  const removeCollection = (collection: CollectionRecord) => {
    if (!window.confirm(`Delete "${collection.name}"? This cannot be undone.`))
      return;
    deleteCollection.mutate(collection._id, {
      onSuccess: () => toast.success("Collection deleted"),
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <div className="min-h-full bg-white">
      <Dialog
        open={Boolean(quickEdit)}
        onOpenChange={(open) => !open && setQuickEdit(null)}
      >
        <DialogContent className="rounded-none sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Quick edit</DialogTitle>
            <DialogDescription>
              Rename the collection and choose Draft or Published.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="quick-collection-name">
                Collection Name
              </FieldLabel>
              <Input
                id="quick-collection-name"
                value={quickForm.name}
                onChange={(event) =>
                  setQuickForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="rounded-none"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="quick-event-date">Event Date</FieldLabel>
              <Input
                id="quick-event-date"
                type="date"
                value={quickForm.eventDate}
                onChange={(event) =>
                  setQuickForm((current) => ({
                    ...current,
                    eventDate: event.target.value,
                  }))
                }
                className="rounded-none"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="quick-status">Collection Status</FieldLabel>
              <select
                id="quick-status"
                value={quickForm.status}
                onChange={(event) =>
                  setQuickForm((current) => ({
                    ...current,
                    status: event.target.value as "draft" | "published",
                  }))
                }
                className="h-11 w-full border bg-white px-3 text-sm outline-none"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
              <p className="text-xs leading-5 text-[#777]">
                Only Published collections appear on your public homepage.
              </p>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => setQuickEdit(null)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-none bg-[#22bda7] text-white hover:bg-[#19a995]"
              disabled={updateCollection.isPending || !quickForm.name.trim()}
              onClick={saveQuickEdit}
            >
              {updateCollection.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-8">
          <h1 className="text-[28px] font-medium leading-none tracking-normal">
            {section === "client-gallery" ? "Collections" : "Products"}
          </h1>
          <label className="flex h-10 w-full min-w-0 items-center gap-3 text-[#8a8f98] sm:min-w-[240px] sm:w-auto">
            <Search className="size-5" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search"
              className="h-10 rounded-none border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
            />
          </label>
          <p className="hidden">
            Manage your collections â€” create, view, and organize your photos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <button
            className="text-sm font-semibold text-[#333]"
            onClick={() =>
              router.push(`/dashboard/${section}/settings/presets`)
            }
            type="button"
          >
            View Presets
          </button>
          <Button
            className="h-10 rounded-none bg-[#22bda7] px-7 text-sm font-bold text-white hover:bg-[#19a995]"
            onClick={() => router.push(`/dashboard/${section}/collection-new`)}
          >
            New Collection
            <ChevronDown className="ml-3 size-4 border-l border-white/30 pl-3" />
          </Button>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <CollectionFilterSelect
            value={statusFilter}
            onValueChange={setStatusFilter}
            placeholder="Status: All"
          >
            <SelectItem value="all">Status: All</SelectItem>
            {statuses.map((value) => (
              <SelectItem key={value} value={value}>
                Status: {titleCase(value)}
              </SelectItem>
            ))}
          </CollectionFilterSelect>
          <CollectionFilterSelect
            value={tagFilter}
            onValueChange={setTagFilter}
            placeholder="Category Tag: All"
          >
            <SelectItem value="all">Category Tag: All</SelectItem>
            {tags.map((value) => (
              <SelectItem key={value} value={value}>
                Category Tag: {value}
              </SelectItem>
            ))}
          </CollectionFilterSelect>
          <CollectionFilterSelect
            value={eventDateFilter}
            onValueChange={setEventDateFilter}
            placeholder="Event Date: All"
          >
            <SelectItem value="all">Event Date: All</SelectItem>
            <SelectItem value="upcoming">Event Date: Upcoming</SelectItem>
            <SelectItem value="past">Event Date: Past</SelectItem>
            <SelectItem value="none">Event Date: None</SelectItem>
          </CollectionFilterSelect>
          <CollectionFilterSelect
            value={expiryDateFilter}
            onValueChange={setExpiryDateFilter}
            placeholder="Expiry Date: All"
          >
            <SelectItem value="all">Expiry Date: All</SelectItem>
            <SelectItem value="active">Expiry Date: Not expired</SelectItem>
            <SelectItem value="expired">Expiry Date: Expired</SelectItem>
            <SelectItem value="none">Expiry Date: None</SelectItem>
          </CollectionFilterSelect>
          <CollectionFilterSelect
            value={starredFilter}
            onValueChange={setStarredFilter}
            placeholder="Starred: All"
          >
            <SelectItem value="all">Starred: All</SelectItem>
            <SelectItem value="yes">Starred: Yes</SelectItem>
            <SelectItem value="no">Starred: No</SelectItem>
          </CollectionFilterSelect>
          <CollectionFilterSelect
            value={sortFilter}
            onValueChange={setSortFilter}
            placeholder="Sort: Newest"
          >
            <SelectItem value="newest">Sort: Newest</SelectItem>
            <SelectItem value="oldest">Sort: Oldest</SelectItem>
            <SelectItem value="name-asc">Sort: Name A-Z</SelectItem>
            <SelectItem value="name-desc">Sort: Name Z-A</SelectItem>
          </CollectionFilterSelect>
          {filtersActive && (
            <button
              className="h-9 px-3 text-xs font-semibold text-[#00a997]"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 text-[#777]">
          <button
            className={cn(
              "flex size-9 items-center justify-center border",
              viewMode === "grid" && "border-[#222] bg-[#222] text-white",
            )}
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
            type="button"
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            className={cn(
              "flex size-9 items-center justify-center border",
              viewMode === "list" && "border-[#222] bg-[#222] text-white",
            )}
            onClick={() => setViewMode("list")}
            aria-label="List view"
            type="button"
          >
            <Menu className="size-4" />
          </button>
        </div>
      </div>
      <p className="mt-6 text-xs text-[#777]">
        Showing {filteredCollections.length} of {collections.length} collections
      </p>

      {collectionsQuery.isLoading ? (
        <p className="mt-10 py-8 text-sm text-[#666]">Loading collections...</p>
      ) : !filteredCollections.length ? (
        <div className="mt-10 flex min-h-[360px] flex-col items-center justify-center border bg-[#fafafa] p-8 text-center">
          <Images className="size-10 text-[#999]" />
          <p className="mt-5 font-bold">
            {collections.length
              ? "No matching collections"
              : "No collections yet"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#666]">
            {collections.length
              ? "Try another search or filter."
              : "Create your first collection to get started."}
          </p>
          <Button
            className="mt-6 h-10 rounded-none bg-[#22bda7] px-7 text-sm font-bold text-white hover:bg-[#19a995]"
            onClick={() => router.push(`/dashboard/${section}/collection-new`)}
          >
            Create Collection
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="mt-10 grid gap-x-10 gap-y-12 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredCollections.map((collection) => (
            <article key={collection._id} className="group relative text-left">
              <button
                className="absolute left-3 top-3 z-10 flex size-10 items-center justify-center rounded-full bg-white/92 text-[#666] shadow-sm transition hover:text-[#00a997]"
                onClick={() => toggleCollectionStar(collection)}
                type="button"
                aria-label="Star collection"
              >
                <Star
                  className={cn(
                    "size-4",
                    collection.settings?.starred === true &&
                      "fill-[#00a997] text-[#00a997]",
                  )}
                />
              </button>
              <CollectionActionMenu
                collection={collection}
                className="absolute right-3 top-3 z-10"
                onQuickEdit={setQuickEdit}
                onPreview={openCollectionPreview}
                onShare={shareCollection}
                onDuplicate={duplicate}
                onDelete={removeCollection}
                pending={
                  duplicateCollection.isPending || deleteCollection.isPending
                }
              />
              <button
                className="block w-full overflow-hidden bg-[#f2f2f2] text-left"
                onClick={() =>
                  router.push(
                    `/dashboard/${section}/collections/${collection._id}`,
                  )
                }
                type="button"
              >
                {collection.coverImage ? (
                  <img
                    src={imageSrc(collection.coverImage)}
                    alt=""
                    className="aspect-[1.33] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <span className="flex aspect-[1.33] w-full items-center justify-center">
                    <Images className="size-10 text-[#ccc]" />
                  </span>
                )}
              </button>
              <div className="pt-3">
                <div className="flex items-start justify-between gap-3">
                  <button
                    className="min-w-0 flex-1 truncate text-left text-lg font-semibold leading-tight text-[#333]"
                    onClick={() =>
                      router.push(
                        `/dashboard/${section}/collections/${collection._id}`,
                      )
                    }
                    type="button"
                  >
                    {collection.name}
                  </button>
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-[#777]">
                  <span className="size-2 rounded-full bg-[#22bda7]" />
                  <span>{collection.imageCount ?? 0} items</span>
                  {collection.status && (
                    <>
                      <span className="text-[#bbb]">&bull;</span>
                      <span>{titleCase(collection.status)}</span>
                    </>
                  )}
                  {collection.eventDate && (
                    <>
                      <span className="text-[#bbb]">&bull;</span>
                      <span>{formatDate(collection.eventDate)}</span>
                    </>
                  )}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-10 divide-y border">
          {filteredCollections.map((collection) => (
            <article
              key={collection._id}
              className="grid items-center gap-5 p-5 lg:grid-cols-[220px_1fr_auto]"
            >
              <button
                className="overflow-hidden bg-[#f2f2f2] text-left"
                onClick={() =>
                  router.push(
                    `/dashboard/${section}/collections/${collection._id}`,
                  )
                }
                type="button"
              >
                {collection.coverImage ? (
                  <img
                    src={imageSrc(collection.coverImage)}
                    alt=""
                    className="aspect-[1.35] w-full object-cover"
                  />
                ) : (
                  <span className="flex aspect-[1.35] items-center justify-center">
                    <Images className="size-10 text-[#ccc]" />
                  </span>
                )}
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <button
                    className="flex size-9 items-center justify-center rounded-full bg-[#f5f5f5] text-[#666] hover:text-[#00a997]"
                    onClick={() => toggleCollectionStar(collection)}
                    type="button"
                    aria-label="Star collection"
                  >
                    <Star
                      className={cn(
                        "size-4",
                        collection.settings?.starred === true &&
                          "fill-[#00a997] text-[#00a997]",
                      )}
                    />
                  </button>
                  <button
                    className="truncate text-left text-xl font-semibold"
                    onClick={() =>
                      router.push(
                        `/dashboard/${section}/collections/${collection._id}`,
                      )
                    }
                    type="button"
                  >
                    {collection.name}
                  </button>
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#777]">
                  <span>{collection.imageCount ?? 0} items</span>
                  {collection.status && (
                    <>
                      <span>&bull;</span>
                      <span>{titleCase(collection.status)}</span>
                    </>
                  )}
                  {collection.eventDate && (
                    <>
                      <span>&bull;</span>
                      <span>{formatDate(collection.eventDate)}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  className="text-sm font-bold text-[#00a997]"
                  onClick={() => openCollectionPreview(collection)}
                  type="button"
                >
                  Preview
                </button>
                <CollectionActionMenu
                  collection={collection}
                  onQuickEdit={setQuickEdit}
                  onPreview={openCollectionPreview}
                  onShare={shareCollection}
                  onDuplicate={duplicate}
                  onDelete={removeCollection}
                  pending={
                    duplicateCollection.isPending || deleteCollection.isPending
                  }
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionActionMenu({
  collection,
  className,
  onQuickEdit,
  onPreview,
  onShare,
  onDuplicate,
  onDelete,
  pending,
}: {
  collection: CollectionRecord;
  className?: string;
  onQuickEdit: (collection: CollectionRecord) => void;
  onPreview: (collection: CollectionRecord) => void;
  onShare: (collection: CollectionRecord) => void;
  onDuplicate: (collection: CollectionRecord) => void;
  onDelete: (collection: CollectionRecord) => void;
  pending?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex size-10 items-center justify-center rounded-full bg-white/95 text-[#555] shadow-sm transition hover:text-[#00a997]",
            className,
          )}
          aria-label="Collection actions"
        >
          <MoreHorizontal className="size-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-xl p-1">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => onQuickEdit(collection)}>
            <Wrench />
            Quick edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onPreview(collection)}>
            <Eye />
            Preview
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void onShare(collection)}>
            <Share2 />
            Share
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={pending}
            onSelect={() => onDuplicate(collection)}
          >
            <Copy />
            Duplicate
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onSelect={() => onDelete(collection)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CollectionFilterSelect({
  value,
  onValueChange,
  placeholder,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  children: ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9 rounded-full border-0 bg-[#f5f5f5] px-4 text-xs font-medium text-[#222]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent align="start">{children}</SelectContent>
    </Select>
  );
}

function CollectionNewPanel({ section }: { section: DashboardSection }) {
  const router = useRouter();
  const presetSettings = useDashboardSettings("preset").query;
  const { hydrateDashboardSettings, presetItems } = useDashboardStore();
  const { createCollection } = useCollections();
  const [form, setForm] = useState({
    name: "",
    eventDate: "",
    presetId: "",
    status: "draft" as "draft" | "published",
  });

  useEffect(() => {
    const settings = presetSettings.data?.data ?? [];
    if (settings.length) hydrateDashboardSettings(settings);
  }, [hydrateDashboardSettings, presetSettings.data]);

  const handleCreate = () => {
    const name = form.name.trim();
    if (!name) return;
    const preset = presetItems.find((item) => item.id === form.presetId);
    const eventLabel = form.eventDate
      ? format(parseISO(form.eventDate), "PPP")
      : "";
    const design = {
      ...(preset?.design ?? collectionDefaultDesign),
      coverSmallTitle: coverTextOrDefault(
        preset?.design.coverSmallTitle,
        preset?.name || "Your Studio",
      ),
      coverTitle: coverTextOrDefault(preset?.design.coverTitle, name),
      coverDate: coverTextOrDefault(preset?.design.coverDate, eventLabel),
      coverButtonText: coverTextOrDefault(
        preset?.design.coverButtonText,
        "View Gallery",
      ),
    };

    createCollection.mutate(
      {
        name,
        eventDate: form.eventDate || undefined,
        presetId: form.presetId || undefined,
        status: form.status,
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
              onChange={(event) =>
                setForm((value) => ({ ...value, name: event.target.value }))
              }
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
                setForm((value) => ({
                  ...value,
                  eventDate: event.target.value,
                }))
              }
              className="mt-2 h-12 rounded-none bg-white px-5"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-status" className="font-bold">
              Collection Status
            </FieldLabel>
            <select
              id="new-status"
              value={form.status}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  status: event.target.value as "draft" | "published",
                }))
              }
              className="mt-2 h-12 w-full border bg-white px-3 text-sm outline-none"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <p className="mt-2 text-xs leading-5 text-[#777]">
              Published collections are listed on your unique homepage URL.
            </p>
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
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-[#777]">
                {presetItems.length
                  ? `${presetItems.length} preset${presetItems.length === 1 ? "" : "s"} available`
                  : "No presets created yet."}
              </span>
              <Link
                href={`/dashboard/${section}/settings/presets`}
                className="font-bold text-[#00a997]"
              >
                {presetItems.length ? "Manage presets" : "Create a preset"}
              </Link>
            </div>
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
  const coverImageAccess = usePlanFeatureAccess("coverImage");
  const presetSettings = useDashboardSettings("preset").query;
  const watermarkSettings = useDashboardSettings("watermark").query;
  const brandingSettings =
    useDashboardSettings<BrandSettings>("branding").query;
  const emailTemplateSettings = useDashboardSettings("email-template").query;
  const storeEmailTemplates = useDashboardStore(
    (state) => state.emailTemplates,
  );
  const storePresetItems = useDashboardStore((state) => state.presetItems);
  const startCampaignBuilder = useDashboardStore(
    (state) => state.startCampaignBuilder,
  );
  const storeWatermarkItems = useDashboardStore(
    (state) => state.watermarkItems,
  );
  const { starImage } = useImageActions();
  const { collectionsQuery } = useCollections();
  const homepageQuery = useHomepageSettings().query;
  const { ordersQuery } = useStoreOrders();
  const {
    collectionQuery,
    updateCollection,
    addSet,
    uploadImages,
    deleteImage,
    reorderImages,
  } = useCollectionDetail(collectionId);
  const activityQuery = useCollectionActivity(collectionId);
  const activityActions = useCollectionActivityActions(collectionId);
  const collections = collectionsQuery.data?.data ?? [];
  const collection =
    collectionQuery.data?.data ??
    collections.find((item) => item._id === collectionId);
  const detail = collectionQuery.data?.data;
  const imagesLoading = collectionQuery.isLoading && !detail;
  const [loadedImages, setLoadedImages] = useState<CollectionImageRecord[]>([]);
  const [imagesHasMore, setImagesHasMore] = useState(false);
  const [imagesLoadingMore, setImagesLoadingMore] = useState(false);
  const imagesLoaderRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setLoadedImages(detail?.images ?? []);
    setImagesHasMore(Boolean(detail?.imagesPage?.hasMore));
  }, [detail?.images, detail?.imagesPage?.hasMore]);
  const images = useMemo(() => loadedImages, [loadedImages]);
  const sets = useMemo(
    () =>
      detail?.sets?.length
        ? detail.sets
        : [{ id: "highlights", name: "Highlights" }],
    [detail?.sets],
  );
  const [activeImageId, setActiveImageId] = useState("");
  const [activeTab, setActiveTab] = useState<
    "photos" | "design" | "settings" | "download"
  >("photos");
  const [activeDesignPanel, setActiveDesignPanel] = useState<
    "cover" | "typography" | "color" | "grid"
  >("cover");
  const [activityPage, setActivityPage] = useState<
    "download" | "favorite" | "orders" | "email"
  >("favorite");
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
  const [uploadProgress, setUploadProgress] = useState({
    active: false,
    total: 0,
    uploaded: 0,
    currentName: "",
    currentPercent: 0,
  });
  const [draggingUpload, setDraggingUpload] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [orderedImageIds, setOrderedImageIds] = useState<string[]>([]);
  const [form, setForm] = useState(() => collectionForm(collection));
  const [collectionStatus, setCollectionStatus] = useState<
    "draft" | "published"
  >(collection?.status === "published" ? "published" : "draft");
  const syncedCollectionFormKeyRef = useRef(collectionFormKey(form));
  const emailTemplates = useMemo(
    () =>
      emailTemplateSettings.data?.data?.map(
        (setting) => setting.data as EmailTemplateItem,
      ) ?? storeEmailTemplates,
    [emailTemplateSettings.data?.data, storeEmailTemplates],
  );
  const presetItems = useMemo(
    () =>
      presetSettings.data?.data?.map((setting) => setting.data as PresetItem) ??
      storePresetItems,
    [presetSettings.data?.data, storePresetItems],
  );
  const watermarkItems = useMemo(
    () =>
      watermarkSettings.data?.data?.map(
        (setting) => setting.data as WatermarkItem,
      ) ?? storeWatermarkItems,
    [storeWatermarkItems, watermarkSettings.data?.data],
  );
  const branding =
    (brandingSettings.data?.data?.[0]?.data as BrandSettings | undefined) ??
    defaultBrandSettings;
  const activeImage =
    images.find((image) => image._id === activeImageId) ??
    images.find((image) => (image.setId || "highlights") === activeSetId) ??
    images[0];
  const orderedImages = useMemo(() => {
    if (!orderedImageIds.length) return images;
    const rank = new Map(orderedImageIds.map((id, index) => [id, index]));
    return [...images].sort(
      (a, b) =>
        (rank.get(a._id) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b._id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [images, orderedImageIds]);
  const collectionOrders = useMemo(
    () =>
      (ordersQuery.data?.data ?? []).filter(
        (order) => order.collectionId === collectionId,
      ),
    [collectionId, ordersQuery.data?.data],
  );
  const activeSetImages = useMemo(
    () =>
      orderedImages.filter(
        (image) => (image.setId || "highlights") === activeSetId,
      ),
    [activeSetId, orderedImages],
  );
  const imagePageSize = 24;
  const totalImagePages = Math.max(
    1,
    Math.ceil(activeSetImages.length / imagePageSize),
  );
  const visibleSetImages = activeSetImages.slice(
    (imagePage - 1) * imagePageSize,
    imagePage * imagePageSize,
  );
  const activeSet =
    form.sets.find((set) => set.id === activeSetId) ?? form.sets[0];
  const filteredShareTemplates = emailTemplates.filter((template) =>
    [template.name, template.subject, template.previewText]
      .join(" ")
      .toLowerCase()
      .includes(shareTemplateSearch.toLowerCase()),
  );
  const selectedShareTemplate =
    emailTemplates.find(
      (template) => template.id === selectedShareTemplateId,
    ) ?? emailTemplates[0];
  const uploadWatermarkId =
    activeSet?.watermarkId ||
    (form.general.defaultWatermark === "No watermark"
      ? undefined
      : form.general.defaultWatermark);
  const activeWatermark = watermarkItems.find(
    (watermark) =>
      watermark.id === uploadWatermarkId ||
      watermark.name === uploadWatermarkId,
  );
  const collectionSlug = collection?.slug ?? collectionId;
  const homepageSlug = homepageQuery.data?.data?.slug;
  const publicLink = homepageSlug
    ? publicCollectionUrl(homepageSlug, collectionSlug, pageOrigin)
    : `${pageOrigin}/collection/${encodeURIComponent(collection?.name ?? collectionId)}/${encodeURIComponent(collectionSlug)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(publicLink)}`;
  const loadMoreCollectionImages = async () => {
    if (!collectionId || imagesLoadingMore || !imagesHasMore) return;
    setImagesLoadingMore(true);
    try {
      const page = (
        await fetchCollectionImagesPage(collectionId, loadedImages.length, 60)
      ).data;
      setLoadedImages((current) => {
        const seen = new Set(current.map((image) => image._id));
        return [
          ...current,
          ...page.items.filter((image) => !seen.has(image._id)),
        ];
      });
      setImagesHasMore(page.hasMore);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load images",
      );
    } finally {
      setImagesLoadingMore(false);
    }
  };
  useEffect(() => {
    if (!imagesHasMore) return;
    const target = imagesLoaderRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          void loadMoreCollectionImages();
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [imagesHasMore, imagesLoadingMore, loadedImages.length]);
  useEffect(() => {
    setPageOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!collection || updateCollection.isPending) return;
    const nextForm = collectionForm(collection);
    const nextFormKey = collectionFormKey(nextForm);
    if (syncedCollectionFormKeyRef.current === nextFormKey) return;
    syncedCollectionFormKeyRef.current = nextFormKey;
    setForm(nextForm);
    setCollectionStatus(
      collection.status === "published" ? "published" : "draft",
    );
  }, [collection, updateCollection.isPending]);

  useEffect(() => {
    if (imagePage > totalImagePages) setImagePage(totalImagePages);
  }, [imagePage, totalImagePages]);

  useEffect(() => {
    setOrderedImageIds((current) => {
      const imageIds = images.map((image) => image._id);
      if (
        current.length === imageIds.length &&
        current.every((id, index) => id === imageIds[index])
      )
        return current;
      return imageIds;
    });
  }, [images]);

  const presetName = (id?: string) =>
    presetItems.find((preset) => preset.id === id)?.name ?? "No preset";
  const saveCollection = () => {
    const selectedPreset = presetItems.find(
      (preset) => preset.id === form.presetId,
    );
    const payload = {
      name: form.name.trim() || collection?.name,
      presetId: form.presetId || undefined,
      coverImage: form.coverImage || undefined,
      sets: syncSetsFromPhotoSets(form.sets, form.general.photoSets),
      tags: form.general.collectionTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      watermarkId:
        form.general.defaultWatermark === "No watermark"
          ? undefined
          : form.general.defaultWatermark,
      expiresAt: form.expiresAt || undefined,
      status: collectionStatus,
      design: form.design,
      settings: {
        general: form.general,
        download: form.download,
        favorite: form.favorite,
        store: selectedPreset?.store ?? collection?.settings?.store,
        access: collection?.settings?.access,
      },
    };
    updateCollection.mutate(payload, {
      onSuccess: (response) => {
        if (response?.data) {
          const nextForm = collectionForm(response.data);
          syncedCollectionFormKeyRef.current = collectionFormKey(nextForm);
          setForm(nextForm);
        }
        toast.success("Collection settings saved");
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Collection save failed",
        );
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
              photoSets: [
                ...value.sets.map((set) => set.name),
                nextSet.name,
              ].join(", "),
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
  const isFileDrag = (event: DragEvent<HTMLElement>) =>
    Array.from(event.dataTransfer.types).includes("Files");
  const droppedImageFiles = (files: FileList) =>
    Array.from(files).filter((file) => file.type.startsWith("image/"));
  const handleImageUpload = async (files: FileList | File[] | null) => {
    if (!files?.length || uploadImages.isPending || uploadProgress.active)
      return;
    const selectedFiles = Array.from(files);
    setUploadProgress({
      active: true,
      total: selectedFiles.length,
      uploaded: 0,
      currentName: selectedFiles[0]?.name ?? "",
      currentPercent: 0,
    });
    try {
      for (const [index, file] of selectedFiles.entries()) {
        setUploadProgress((current) => ({
          ...current,
          currentName: file.name,
          currentPercent: 0,
        }));
        const response = await uploadImages.mutateAsync({
          files: [file],
          setId: activeSetId,
          watermarkId: uploadWatermarkId,
          onProgress: (percent) =>
            setUploadProgress((current) => ({
              ...current,
              currentPercent: percent,
            })),
        });
        const uploadedImages = Array.isArray(response?.data)
          ? response.data
          : [];
        if (uploadedImages.length) {
          setLoadedImages((current) => {
            const seen = new Set(current.map((image) => image._id));
            return [
              ...current,
              ...uploadedImages.filter((image) => !seen.has(image._id)),
            ];
          });
        }
        setUploadProgress((current) => ({
          ...current,
          uploaded: index + 1,
          currentPercent: 100,
        }));
      }
      toast.success(
        `Upload finished: ${selectedFiles.length} image${selectedFiles.length === 1 ? "" : "s"}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadProgress({
        active: false,
        total: 0,
        uploaded: 0,
        currentName: "",
        currentPercent: 0,
      });
    }
  };
  const handleUploadDragOver = (event: DragEvent<HTMLElement>) => {
    if (!isFileDrag(event) || uploading) return;
    event.preventDefault();
    setDraggingUpload(true);
  };
  const handleUploadDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null))
      setDraggingUpload(false);
  };
  const handleUploadDrop = (event: DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    setDraggingUpload(false);
    const imageFiles = droppedImageFiles(event.dataTransfer.files);
    if (!imageFiles.length) {
      toast.error("Drop image files only");
      return;
    }
    void handleImageUpload(imageFiles);
  };
  const uploading = uploadProgress.active || uploadImages.isPending;
  const uploadsLeft = Math.max(
    0,
    uploadProgress.total - uploadProgress.uploaded,
  );
  const uploadPercent = uploadProgress.total
    ? Math.round(
        ((uploadProgress.uploaded + uploadProgress.currentPercent / 100) /
          uploadProgress.total) *
          100,
      )
    : 0;
  const deletingImages = deleteImage.isPending || bulkDeleting;
  const toggleImageSelection = (imageId: string) => {
    if (deletingImages) return;
    setSelectedImageIds((ids) =>
      ids.includes(imageId)
        ? ids.filter((id) => id !== imageId)
        : [...ids, imageId],
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
      onSuccess: () =>
        setSelectedImageIds((ids) => ids.filter((id) => id !== image._id)),
    });
  };
  const deleteSelectedImages = async () => {
    if (!selectedImageIds.length || deletingImages) return;
    setBulkDeleting(true);
    try {
      const selectedImages = images.filter((image) =>
        selectedImageIds.includes(image._id),
      );
      if (selectedImages.some((image) => image.url === form.coverImage)) {
        setForm((value) => ({ ...value, coverImage: "" }));
      }
      setLoadedImages((current) =>
        current.filter((image) => !selectedImageIds.includes(image._id)),
      );
      const results = await Promise.allSettled(
        selectedImages.map((image) => deleteImage.mutateAsync(image._id)),
      );
      const failed = results.filter(
        (result) => result.status === "rejected",
      ).length;
      if (failed)
        toast.error(
          `${failed} image${failed === 1 ? "" : "s"} could not be deleted`,
        );
      setSelectedImageIds([]);
      await collectionQuery.refetch();
    } finally {
      setBulkDeleting(false);
    }
  };
  useEffect(() => {
    if (activeTab !== "photos") return;
    const selectAll = (event: KeyboardEvent) => {
      event.preventDefault();
      setSelectedImageIds(activeSetImages.map((image) => image._id));
      toast.success(`${activeSetImages.length} images selected`);
    };
    const removeSelected = (event: KeyboardEvent) => {
      if (!selectedImageIds.length || deletingImages) return;
      event.preventDefault();
      if (
        window.confirm(
          `Delete ${selectedImageIds.length} selected image${selectedImageIds.length === 1 ? "" : "s"}?`,
        )
      )
        void deleteSelectedImages();
    };
    const clearSelected = (event: KeyboardEvent) => {
      event.preventDefault();
      clearSelection();
    };
    hotkeys("ctrl+a,command+a", selectAll);
    hotkeys("delete,backspace", removeSelected);
    hotkeys("esc", clearSelected);
    return () => {
      hotkeys.unbind("ctrl+a,command+a", selectAll);
      hotkeys.unbind("delete,backspace", removeSelected);
      hotkeys.unbind("esc", clearSelected);
    };
  }, [activeSetImages, activeTab, deletingImages, selectedImageIds]);
  const reorderSetImages = (nextSetImages: CollectionImageRecord[]) => {
    const nextSetIds = nextSetImages.map((image) => image._id);
    if (
      nextSetIds.length === activeSetImages.length &&
      nextSetIds.every((id, index) => id === activeSetImages[index]?._id)
    ) {
      return;
    }
    const activeSetIdSet = new Set(activeSetImages.map((image) => image._id));
    const nextAllIds = orderedImages.map((image) =>
      activeSetIdSet.has(image._id)
        ? (nextSetIds.shift() ?? image._id)
        : image._id,
    );
    setOrderedImageIds(nextAllIds);
    reorderImages.mutate(nextAllIds, {
      onError: (error) =>
        toast.error(
          error instanceof Error ? error.message : "Image reorder failed",
        ),
    });
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
            {formatDate(collection.eventDate)} &middot;{" "}
            {presetName(collection.presetId)} &middot; {images.length} images
          </p>
          <div className="mt-2 flex max-w-[720px] flex-wrap items-center gap-2">
            <p className="break-all text-xs text-[#00a997]">{publicLink}</p>
            <Button
              variant="outline"
              className="h-8 rounded-none px-3 text-xs"
              onClick={copyPublicLink}
            >
              <Copy data-icon="inline-start" />
              {linkCopied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="h-10 rounded-none bg-[#22bda7] px-6 text-sm font-bold text-white hover:bg-[#19a995]"
            disabled={updateCollection.isPending}
            onClick={saveCollection}
          >
            <Save data-icon="inline-start" />
            {updateCollection.isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-none"
            onClick={() =>
              router.push(
                `/dashboard/store-gallery/collections/${collectionId}/store`,
              )
            }
          >
            <Store data-icon="inline-start" />
            Store
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-none"
            onClick={() =>
              window.open(publicPath, "_blank", "noopener,noreferrer")
            }
          >
            <Eye data-icon="inline-start" />
            Preview
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-none"
            onClick={() => setShareOpen(true)}
          >
            <Share2 data-icon="inline-start" />
            Share
          </Button>
          <label
            className={cn(
              "inline-flex h-10 w-fit cursor-pointer items-center gap-2 bg-[#22bda7] px-6 text-sm font-bold text-white",
              uploading && "pointer-events-none opacity-70",
            )}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {uploading ? `${uploadProgress.currentPercent}%` : "Add Media"}
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
                <p className="mt-4 text-sm font-semibold text-[#777]">
                  Loading templates...
                </p>
              ) : emailTemplates.length ? (
                <>
                  <div className="mt-4 flex h-10 items-center gap-2 border px-3">
                    <Search className="size-4 text-[#777]" />
                    <Input
                      value={shareTemplateSearch}
                      onChange={(event) =>
                        setShareTemplateSearch(event.target.value)
                      }
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
                          selectedShareTemplate?.id === template.id &&
                            "bg-[#e3f6f1]",
                        )}
                        onClick={() => setSelectedShareTemplateId(template.id)}
                      >
                        <span className="block truncate font-bold">
                          {template.name || "Untitled Template"}
                        </span>
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
                    onClick={() =>
                      selectedShareTemplate &&
                      shareByEmail(selectedShareTemplate.id)
                    }
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
                <p className="mt-4 break-all bg-white p-3 text-sm leading-6 text-[#666]">
                  {publicLink}
                </p>
                <Button
                  variant="outline"
                  className="mt-4 h-10 w-full rounded-none bg-white"
                  onClick={copyPublicLink}
                >
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
                  <img
                    src={qrCodeUrl}
                    alt={`QR code for ${collection.name}`}
                    className="size-[220px]"
                  />
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
              Image{" "}
              {Math.min(uploadProgress.uploaded + 1, uploadProgress.total || 1)}{" "}
              of {uploadProgress.total || "selected"} /{" "}
              {uploadProgress.currentPercent}% uploaded. {uploadsLeft} left.
            </p>
            <p className="mt-1 truncate text-xs font-semibold text-[#3f8179]">
              {uploadProgress.currentName || "Processing files and watermark"}
            </p>
            <div className="mt-3 h-2 overflow-hidden bg-[#d3f2ee]">
              <div
                className="h-full bg-[#22bda7] transition-all duration-300"
                style={{ width: `${uploadPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}
      {uploadImages.error && (
        <p className="mt-4 text-sm font-semibold text-red-600">
          {uploadImages.error.message}
        </p>
      )}

      <div
        className={cn(
          "mt-6 grid h-[calc(100vh-220px)] min-h-[520px] overflow-hidden border transition-[grid-template-columns] duration-300 ease-out",
          detailCollapsed
            ? "md:grid-cols-[76px_minmax(0,1fr)]"
            : "md:grid-cols-[250px_minmax(0,1fr)]",
        )}
      >
        <aside className="flex min-h-0 flex-col overflow-hidden border-r bg-[#fafafa] transition-colors duration-300">
          {!detailCollapsed && (
            <div className="h-32 shrink-0 bg-[#e8e8e8]">
              {form.coverImage || images[0]?.url ? (
                <img
                  src={imageSrc(form.coverImage || images[0]?.url || "")}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs font-bold uppercase tracking-wide text-[#888]">
                  Cover Image
                </div>
              )}
            </div>
          )}
          <div
            className={cn(
              "grid shrink-0 border-b bg-white",
              detailCollapsed ? "grid-cols-1" : "grid-cols-4",
            )}
          >
            {(
              [
                ["photos", Images],
                ["design", Palette],
                ["settings", Settings],
                ["download", Download],
              ] as const
            ).map(([tab, Icon]) => (
              <button
                key={String(tab)}
                className={cn(
                  "flex h-14 items-center justify-center border-b-2 border-transparent",
                  activeTab === tab && "border-[#22bda7] text-[#00a997]",
                )}
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
                <button
                  className="inline-flex items-center gap-1 text-sm font-bold text-[#00a997]"
                  onClick={() => setAddSetOpen(true)}
                >
                  <PlusCircle className="size-4" />
                  Add Set
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {form.sets.map((set) => {
                  const count = images.filter(
                    (image) => (image.setId || "highlights") === set.id,
                  ).length;
                  return (
                    <div
                      key={set.id}
                      className={cn(
                        "group flex h-12 items-center justify-between gap-2 px-3 text-left text-sm",
                        activeSetId === set.id && "bg-white font-bold",
                      )}
                    >
                      {editingSetId === set.id ? (
                        <Input
                          value={editingSetName}
                          onChange={(event) =>
                            setEditingSetName(event.target.value)
                          }
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
                          onClick={() => {
                            setActiveSetId(set.id);
                            setImagePage(1);
                          }}
                          onDoubleClick={() => {
                            setEditingSetId(set.id);
                            setEditingSetName(set.name);
                          }}
                        >
                          {set.name}
                        </button>
                      )}
                      <span className="ml-auto text-xs text-[#777]">
                        {count}
                      </span>
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
                    <Button
                      variant="outline"
                      className="rounded-none"
                      onClick={() => setAddSetOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="rounded-none bg-[#22bda7] text-white"
                      disabled={!newSetName.trim()}
                      onClick={createSet}
                    >
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
          {activeTab === "design" && !detailCollapsed && (
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#fafafa]">
              <p className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#777]">
                Design
              </p>
              {(
                [
                  ["cover", PanelTop, "Cover"],
                  ["typography", Bold, "Typography"],
                  ["color", Palette, "Color"],
                  ["grid", LayoutGrid, "Grid"],
                ] as const
              ).map(([panel, Icon, label]) => (
                <button
                  key={panel}
                  className={cn(
                    "flex h-12 w-full items-center gap-4 px-5 text-left",
                    activeDesignPanel === panel && "bg-white font-semibold",
                  )}
                  onClick={() => setActiveDesignPanel(panel)}
                  type="button"
                >
                  <Icon className="size-5" />
                  {label}
                </button>
              ))}
            </div>
          )}
          {activeTab === "download" && !detailCollapsed && (
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#fafafa] py-4">
              <p className="px-5 pb-4 pt-1 text-xs font-bold uppercase tracking-wide text-[#777]">
                Activities
              </p>
              <button
                className={cn(
                  "flex h-14 w-full items-center gap-3 px-5 text-left",
                  activityPage === "download" && "bg-white font-bold",
                )}
                onClick={() => setActivityPage("download")}
                type="button"
              >
                <Download className="size-4" />
                Download Activity
              </button>
              <button
                className={cn(
                  "flex h-14 w-full items-center gap-3 px-5 text-left",
                  activityPage === "favorite" && "bg-white font-bold",
                )}
                onClick={() => setActivityPage("favorite")}
                type="button"
              >
                <Heart className="size-4" />
                Favorite Activity
              </button>
              <button
                className={cn(
                  "flex h-14 w-full items-center gap-3 px-5 text-left",
                  activityPage === "orders" && "bg-white font-bold",
                )}
                onClick={() => setActivityPage("orders")}
                type="button"
              >
                <ShoppingCart className="size-4" />
                Store Orders
              </button>
              <button
                className={cn(
                  "flex h-14 w-full items-center gap-3 px-5 text-left",
                  activityPage === "email" && "bg-white font-bold",
                )}
                onClick={() => setActivityPage("email")}
                type="button"
              >
                <Mail className="size-4" />
                Email Access
              </button>
            </div>
          )}
          <button
            className="mt-auto flex h-12 shrink-0 items-center justify-center border-t text-[#333]"
            onClick={() => setDetailCollapsed((value) => !value)}
            aria-label="Toggle collection sidebar"
          >
            <ChevronsLeft
              className={cn("size-5", detailCollapsed && "rotate-180")}
            />
          </button>
        </aside>

        <div className="min-w-0 overflow-y-auto p-5 md:p-6">
          {activeTab === "photos" &&
            (imagesLoading ? (
              <CollectionImagesSkeleton />
            ) : !activeSetImages.length && !imagesHasMore ? (
              <label
                className={cn(
                  "flex min-h-[420px] cursor-pointer flex-col items-center justify-center border border-dashed bg-white p-8 text-center transition",
                  draggingUpload && "border-[#22bda7] bg-[#f2fffd]",
                  uploading && "pointer-events-none opacity-75",
                )}
                onDragOver={handleUploadDragOver}
                onDragEnter={handleUploadDragOver}
                onDragLeave={handleUploadDragLeave}
                onDrop={handleUploadDrop}
              >
                {uploading ? (
                  <Loader2 className="size-10 animate-spin text-[#22bda7]" />
                ) : (
                  <Upload className="size-10 text-[#bbb]" />
                )}
                <p className="mt-5 font-bold">
                  {uploading
                    ? `Image ${Math.min(uploadProgress.uploaded + 1, uploadProgress.total || 1)} of ${uploadProgress.total || "selected"} / ${uploadProgress.currentPercent}%`
                    : "Drag photos and videos here to upload"}
                </p>
                <p className="mt-3 text-sm text-[#00a997]">
                  {uploading ? `${uploadsLeft} left` : "or Browse files"}
                </p>
                {uploading && (
                  <div className="mt-5 h-2 w-full max-w-sm overflow-hidden bg-[#d3f2ee]">
                    <div
                      className="h-full bg-[#22bda7] transition-all duration-300"
                      style={{ width: `${uploadPercent}%` }}
                    />
                  </div>
                )}
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
              <div
                className={cn(
                  "relative min-h-[420px] transition",
                  draggingUpload &&
                    "outline outline-2 outline-[#22bda7] outline-offset-4",
                )}
                onDragOver={handleUploadDragOver}
                onDragEnter={handleUploadDragOver}
                onDragLeave={handleUploadDragLeave}
                onDrop={handleUploadDrop}
              >
                {draggingUpload && (
                  <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border border-dashed border-[#22bda7] bg-white/80 text-sm font-bold text-[#00a997]">
                    Drop images to upload
                  </div>
                )}
                <div className="mb-4 flex items-center justify-between gap-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#777]">
                    {collection.name} / {activeSet?.name ?? "Set"} / Images
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {selectedImageIds.length > 0 && (
                      <>
                        <span className="text-xs font-bold text-[#777]">
                          {selectedImageIds.length} selected
                        </span>
                        <Button
                          variant="outline"
                          className="h-9 rounded-none"
                          disabled={deletingImages}
                          onClick={clearSelection}
                        >
                          Clear
                        </Button>
                        <Button
                          className="h-9 rounded-none bg-red-600 text-white hover:bg-red-700"
                          disabled={deletingImages}
                          onClick={() => void deleteSelectedImages()}
                        >
                          {deletingImages ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                          Delete Selected
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      className="h-9 rounded-none"
                      disabled={deletingImages}
                      onClick={() => setMetadataOpen(true)}
                    >
                      Show Metadata
                    </Button>
                  </div>
                </div>
                <p className="mb-3 text-xs text-[#999]">
                  ⌘/Ctrl + A selects all · Delete removes selected · Esc clears
                </p>
                {deletingImages && (
                  <div className="mb-4 flex items-center gap-3 border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    <Loader2 className="size-4 animate-spin" />
                    Deleting images...
                  </div>
                )}
                {uploading && (
                  <div className="mb-2 grid grid-cols-3 gap-2 md:grid-cols-5 xl:grid-cols-6">
                    {Array.from({ length: Math.min(uploadsLeft || 1, 6) }).map(
                      (_, index) => (
                        <div
                          key={`uploading-${index}`}
                          className="relative flex aspect-square animate-in fade-in zoom-in-95 items-center justify-center overflow-hidden bg-[#eef9f7] duration-300"
                        >
                          <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-[#d3f2ee]">
                            <div className="h-full w-1/2 animate-pulse bg-[#22bda7]" />
                          </div>
                          <Loader2 className="size-6 animate-spin text-[#22bda7]" />
                        </div>
                      ),
                    )}
                  </div>
                )}
                <ReactSortable
                  list={activeSetImages.map((image) => ({
                    ...image,
                    id: image._id,
                  }))}
                  setList={(nextImages) =>
                    reorderSetImages(nextImages as CollectionImageRecord[])
                  }
                  animation={180}
                  delayOnTouchOnly
                  ghostClass="sortable-image-ghost"
                  chosenClass="sortable-image-chosen"
                  dragClass="sortable-image-drag"
                  className={cn(
                    "grid gap-2",
                    form.design.gridStyle === "Horizontal"
                      ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
                      : "grid-cols-3 md:grid-cols-5 xl:grid-cols-6",
                    form.design.thumbnailSize === "Large" &&
                      "md:grid-cols-4 xl:grid-cols-5",
                  )}
                >
                  {activeSetImages.map((image) => (
                    <div
                      key={image._id}
                      className={cn(
                        "group relative animate-in fade-in zoom-in-95 text-left transition-all duration-300 ease-out",
                        activeImage?._id === image._id &&
                          "outline outline-2 outline-[#22bda7]",
                        selectedImageIds.includes(image._id) &&
                          "outline outline-2 outline-red-500",
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
                            form.design.gridStyle === "Horizontal"
                              ? "aspect-[1.45]"
                              : "aspect-square",
                          )}
                        />
                        {!image.watermarked && activeWatermark && (
                          <WatermarkOverlay watermark={activeWatermark} />
                        )}
                      </button>
                      <button
                        className={cn(
                          "absolute left-2 top-2 flex size-8 items-center justify-center border bg-white/95 shadow-sm transition-all duration-200 hover:scale-105",
                          selectedImageIds.includes(image._id)
                            ? "border-red-500 text-red-600"
                            : "border-white text-[#777]",
                        )}
                        disabled={deletingImages}
                        onClick={() => toggleImageSelection(image._id)}
                        aria-label="Select image"
                      >
                        <Check
                          className={cn(
                            "size-4",
                            !selectedImageIds.includes(image._id) &&
                              "opacity-0",
                          )}
                        />
                      </button>
                      <button
                        className="absolute right-2 top-2 hidden size-9 items-center justify-center bg-white/90 text-[#333] shadow-sm transition-all duration-200 hover:scale-105 hover:text-red-600 group-hover:flex"
                        disabled={deletingImages}
                        onClick={() => deleteSingleImage(image)}
                        aria-label="Delete image"
                      >
                        {deletingImages ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
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
                        <Star
                          className={cn(
                            "size-4",
                            image.metadata?.starred === true &&
                              "fill-[#00a997] text-[#00a997]",
                          )}
                        />
                      </button>
                      <button
                        className={cn(
                          "absolute bottom-2 left-2 hidden bg-white/90 px-3 py-2 text-xs font-bold text-[#333] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:text-[#00a997] group-hover:block",
                          coverImageAccess.locked &&
                            "cursor-not-allowed opacity-60",
                        )}
                        disabled={deletingImages || coverImageAccess.locked}
                        title={
                          coverImageAccess.locked
                            ? "Cover image is not included in your current plan"
                            : "Make collection cover"
                        }
                        onClick={() => {
                          setForm((value) => ({
                            ...value,
                            coverImage: image.url,
                          }));
                          updateCollection.mutate(
                            { coverImage: image.url },
                            {
                              onSuccess: () =>
                                toast.success("Cover photo updated"),
                              onError: (error) =>
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Cover update failed",
                                ),
                            },
                          );
                        }}
                      >
                        Make Cover
                      </button>
                    </div>
                  ))}
                </ReactSortable>
                {imagesHasMore && (
                  <div
                    ref={imagesLoaderRef}
                    className="flex h-20 items-center justify-center text-sm text-[#777]"
                  >
                    {imagesLoadingMore && (
                      <Loader2 className="size-5 animate-spin" />
                    )}
                  </div>
                )}
                {false && totalImagePages > 1 && (
                  <div className="mt-5 flex items-center justify-end gap-3 text-sm">
                    <Button
                      variant="outline"
                      className="h-9 rounded-none"
                      disabled={imagePage <= 1}
                      onClick={() =>
                        setImagePage((page) => Math.max(1, page - 1))
                      }
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
                      onClick={() =>
                        setImagePage((page) =>
                          Math.min(totalImagePages, page + 1),
                        )
                      }
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
                        View stored camera and file metadata for the selected
                        image.
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
                          <span className="truncate">
                            {activeImage.originalName ?? "Image"}
                          </span>
                          <span>
                            {formatMetaValue(activeImage.metadata?.width)} x{" "}
                            {formatMetaValue(activeImage.metadata?.height)}
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
            ))}

          {activeTab === "design" && (
            <div className="grid min-h-full gap-8 xl:grid-cols-[minmax(440px,700px)_minmax(520px,1fr)]">
              <div className="min-w-0">
                <div className="mb-8 flex items-center gap-3">
                  <select
                    value={form.presetId}
                    onChange={(event) => {
                      const preset = presetItems.find(
                        (item) => item.id === event.target.value,
                      );
                      const eventLabel = collection?.eventDate
                        ? formatDate(collection.eventDate)
                        : "";
                      setForm((value) => ({
                        ...value,
                        presetId: event.target.value,
                        design: preset
                          ? {
                              ...preset.design,
                              coverSmallTitle: coverTextOrDefault(
                                preset.design.coverSmallTitle,
                                preset.name,
                              ),
                              coverTitle: coverTextOrDefault(
                                preset.design.coverTitle,
                                value.name || collection?.name || "",
                              ),
                              coverDate: coverTextOrDefault(
                                preset.design.coverDate,
                                eventLabel,
                              ),
                              coverButtonText: coverTextOrDefault(
                                preset.design.coverButtonText,
                                "View Gallery",
                              ),
                            }
                          : value.design,
                        general: preset?.general ?? value.general,
                        download: preset?.download ?? value.download,
                        favorite: preset?.favorite ?? value.favorite,
                      }));
                    }}
                    className="h-11 w-full border bg-white px-3 text-sm outline-none"
                  >
                    <option value="">Custom design</option>
                    {presetItems.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                </div>
                <PresetDesignPanel
                  design={form.design}
                  activePanel={activeDesignPanel}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      presetId: "",
                      design: { ...current.design, ...value },
                    }))
                  }
                />
              </div>
              <CollectionDesignLivePreview
                design={form.design}
                collectionName={form.name || collection.name}
                eventDate={
                  collection.eventDate
                    ? formatDate(collection.eventDate)
                    : form.design.coverDate
                }
                coverImage={form.coverImage || images[0]?.url}
                images={images}
                sets={form.sets}
                favoriteEnabled={form.favorite.favoritePhotos !== false}
                storeEnabled={Boolean(
                  form.presetId
                    ? presetItems.find((preset) => preset.id === form.presetId)
                        ?.store?.storeStatus
                    : collection.settings?.store?.storeStatus,
                )}
                branding={branding}
              />
            </div>
          )}

          {activeTab === "settings" && (
            <div className="max-w-[760px]">
              <h2 className="text-2xl font-medium">General Settings</h2>
              <FieldGroup className="mt-8 gap-7">
                <Field>
                  <FieldLabel className="font-bold">Collection Name</FieldLabel>
                  <Input
                    value={form.name}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        name: event.target.value,
                      }))
                    }
                    className="h-12 rounded-none bg-white"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="collection-status" className="font-bold">
                    Collection Status
                  </FieldLabel>
                  <select
                    id="collection-status"
                    value={collectionStatus}
                    onChange={(event) =>
                      setCollectionStatus(
                        event.target.value as "draft" | "published",
                      )
                    }
                    className="h-12 w-full border bg-white px-3 text-sm outline-none"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                  <p className="text-xs leading-5 text-[#777]">
                    Only Published collections are visible on your public
                    homepage and public gallery URL.
                  </p>
                </Field>
                <Field>
                  <FieldLabel className="font-bold">Expire Date</FieldLabel>
                  <Input
                    type="date"
                    value={form.expiresAt}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        expiresAt: event.target.value,
                      }))
                    }
                    className="h-12 rounded-none bg-white"
                  />
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
                            ? syncSetsFromPhotoSets(
                                value.sets,
                                nextGeneral.photoSets,
                              )
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
                  onChange={(download) =>
                    setForm((value) => ({
                      ...value,
                      download: { ...value.download, ...download },
                    }))
                  }
                />
              </div>
              <div className="mt-14 border-t pt-12">
                <PresetFavoritePanel
                  favorite={form.favorite}
                  hidePager
                  onBack={() => undefined}
                  onNext={() => undefined}
                  onChange={(favorite) =>
                    setForm((value) => ({
                      ...value,
                      favorite: { ...value.favorite, ...favorite },
                    }))
                  }
                />
              </div>
              <Button
                className="mt-8 h-11 rounded-none bg-[#22bda7] px-8 text-white"
                disabled={updateCollection.isPending}
                onClick={saveCollection}
              >
                {updateCollection.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          )}

          {activeTab === "download" && (
            <CollectionActivityPanel
              loading={activityQuery.isLoading}
              favoriteLists={activityQuery.data?.data.favoriteLists ?? []}
              downloads={activityQuery.data?.data.downloads ?? []}
              orders={collectionOrders}
              collectionName={collection.name}
              collectionImages={images}
              publicLink={publicLink}
              activityPage={activityPage}
              emailTemplates={emailTemplates}
              favoriteSettings={form.favorite}
              accessSettings={
                (collection.settings?.access as
                  | CollectionAccessSettings
                  | undefined) ?? {}
              }
              saveFavoriteSettings={async (favorite) => {
                const nextFavorite = { ...form.favorite, ...favorite };
                setForm((value) => ({ ...value, favorite: nextFavorite }));
                await updateCollection.mutateAsync({
                  settings: {
                    ...(collection.settings ?? {}),
                    general: form.general,
                    download: form.download,
                    favorite: nextFavorite,
                  },
                });
              }}
              saveAccessSettings={async (access) => {
                await updateCollection.mutateAsync({
                  settings: {
                    ...(collection.settings ?? {}),
                    general: form.general,
                    download: form.download,
                    favorite: form.favorite,
                    access,
                  },
                });
                await collectionQuery.refetch();
              }}
              deleteFavoriteInfo={
                activityActions.deleteFavoriteInfo.mutateAsync
              }
              deleteFavoriteImageInfo={
                activityActions.deleteFavoriteImageInfo.mutateAsync
              }
              copyFavoriteListToSet={(payload) => {
                if (!activityActions.copyFavoriteListToSet)
                  throw new Error("Copy to set is not available");
                return activityActions.copyFavoriteListToSet.mutateAsync(
                  payload,
                );
              }}
              copyFavoriteListToCollection={(payload) => {
                if (!activityActions.copyFavoriteListToCollection)
                  throw new Error("Copy to collection is not available");
                return activityActions.copyFavoriteListToCollection.mutateAsync(
                  payload,
                );
              }}
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
              <Skeleton
                key={index}
                className="aspect-square rounded-none bg-[#eeeeec]"
              />
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
  orders,
  collectionName,
  collectionImages,
  publicLink,
  activityPage,
  emailTemplates,
  favoriteSettings,
  accessSettings,
  saveFavoriteSettings,
  saveAccessSettings,
  deleteFavoriteInfo,
  deleteFavoriteImageInfo,
  copyFavoriteListToSet,
  copyFavoriteListToCollection,
}: {
  loading: boolean;
  favoriteLists: CollectionFavoriteActivityRecord[];
  downloads: CollectionDownloadActivityRecord[];
  orders: StoreOrderRecord[];
  collectionName: string;
  collectionImages: CollectionImageRecord[];
  publicLink: string;
  activityPage: "download" | "favorite" | "orders" | "email";
  emailTemplates: EmailTemplateItem[];
  favoriteSettings: PresetFavoriteSettings;
  accessSettings: CollectionAccessSettings;
  saveFavoriteSettings: (
    favorite: Partial<PresetFavoriteSettings>,
  ) => Promise<void>;
  saveAccessSettings: (access: CollectionAccessSettings) => Promise<void>;
  deleteFavoriteInfo: (favoriteUserId: string) => Promise<unknown>;
  deleteFavoriteImageInfo: (payload: {
    favoriteUserId: string;
    imageId: string;
  }) => Promise<unknown>;
  copyFavoriteListToSet: (payload: {
    favoriteUserId: string;
    name?: string;
  }) => Promise<unknown>;
  copyFavoriteListToCollection: (payload: {
    favoriteUserId: string;
    name?: string;
  }) => Promise<unknown>;
}) {
  const [editingList, setEditingList] =
    useState<CollectionFavoriteActivityRecord | null>(null);
  const [mailList, setMailList] =
    useState<CollectionFavoriteActivityRecord | null>(null);
  const [selectedMailTemplateId, setSelectedMailTemplateId] = useState("");
  const [exportJob, setExportJob] = useState<{
    title: string;
    percent: number;
    list?: CollectionFavoriteActivityRecord;
  } | null>(null);
  const [copyingListId, setCopyingListId] = useState("");
  const [favoriteLimitDraft, setFavoriteLimitDraft] = useState(
    favoriteSettings.maxFavorites,
  );
  const [favoriteDescriptionDraft, setFavoriteDescriptionDraft] = useState(
    favoriteSettings.description,
  );
  const [allowedEmailDraft, setAllowedEmailDraft] = useState(
    (accessSettings.allowedEmails ?? []).join("\n"),
  );
  const [emailEntryDraft, setEmailEntryDraft] = useState("");
  const [accessFilter, setAccessFilter] = useState<
    "all" | "allowed" | "requests"
  >("all");
  const accessRequests = accessSettings.requests ?? [];
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
  const exportFavoriteList = (list?: CollectionFavoriteActivityRecord) => {
    const title = list ? `${list.name} export` : "Favorite export";
    setExportJob({ title, percent: 8, list });
    let percent = 8;
    const timer = window.setInterval(() => {
      percent = Math.min(100, percent + 14);
      setExportJob((job) => (job ? { ...job, percent } : null));
      if (percent >= 100) {
        window.clearInterval(timer);
        window.setTimeout(() => {
          downloadFavoritesCsv(list);
          setExportJob(null);
        }, 450);
      }
    }, 180);
  };
  const openDownloadPage = () => {
    const images = collectionImages
      .filter((image) => image.url)
      .map((image, index) => ({
        url: image.url,
        name: image.originalName || `photo-${index + 1}`,
      }));
    if (!images.length) {
      toast.error("No collection images to download");
      return;
    }
    window.sessionStorage.setItem(
      "nikoset-favorite-download",
      JSON.stringify({
        collectionName,
        listName: "All photos",
        email: "",
        images,
      }),
    );
    window.location.href = `${window.location.pathname}/download`;
  };
  const copyFilenames = async (list: CollectionFavoriteActivityRecord) => {
    const lines = (
      list.images?.length
        ? list.images
        : list.filenames.map((name) => ({ name, imageId: "", url: "" }))
    ).map((image) => `${collectionName} - ${image.name || image.imageId}`);
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Filenames copied");
  };
  const openMailSender = (list: CollectionFavoriteActivityRecord) => {
    setMailList(list);
    setSelectedMailTemplateId(
      (current) => current || emailTemplates[0]?.id || "",
    );
  };
  const sendAsDownload = async () => {
    if (!mailList) return;
    const template =
      emailTemplates.find((item) => item.id === selectedMailTemplateId) ??
      emailTemplates[0];
    if (!template) return;
    const body = [
      template.message,
      "",
      `${template.buttonText || "Open Gallery"}: ${publicLink}`,
      "",
      template.footerText,
    ]
      .filter(Boolean)
      .join("\n");
    const html = [
      `<h1>${template.title || collectionName}</h1>`,
      `<p>${template.message || ""}</p>`,
      `<p><a href="${publicLink}">${template.buttonText || "Open Gallery"}</a></p>`,
      `<p>${template.footerText || ""}</p>`,
    ].join("");
    await recordEmailUsage(1);
    const result = await sendUniversalEmail({
      to: mailList.email,
      subject: template.subject || collectionName,
      text: body,
      html,
    }).catch(() => null);
    if (result?.sent) toast.success("Email sent by universal SMTP");
    window.sessionStorage.setItem(
      "nikoset-mail-preview",
      JSON.stringify({
        to: mailList.email,
        collectionName,
        publicLink,
        template: { ...template, buttonLink: publicLink },
      }),
    );
    window.location.href = `${window.location.pathname}/mail-preview`;
    setMailList(null);
  };
  useEffect(() => {
    setFavoriteLimitDraft(favoriteSettings.maxFavorites);
    setFavoriteDescriptionDraft(favoriteSettings.description);
  }, [favoriteSettings.description, favoriteSettings.maxFavorites]);
  useEffect(() => {
    setAllowedEmailDraft((accessSettings.allowedEmails ?? []).join("\n"));
  }, [accessSettings.allowedEmails]);
  const parseAccessEmails = (value: string) => [
    ...new Set(
      value
        .split(/[\s,;]+/)
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.includes("@")),
    ),
  ];
  const saveAllowedEmails = async (
    emails = parseAccessEmails(allowedEmailDraft),
  ) => {
    await saveAccessSettings({
      ...accessSettings,
      allowedEmails: emails,
      requests: accessRequests,
    });
    setAllowedEmailDraft(emails.join("\n"));
    toast.success("Email access saved");
  };
  const addAllowedEmails = async () => {
    const added = parseAccessEmails(emailEntryDraft);
    if (!added.length) {
      toast.error("Enter at least one valid email");
      return;
    }
    await saveAllowedEmails([
      ...new Set([...parseAccessEmails(allowedEmailDraft), ...added]),
    ]);
    setEmailEntryDraft("");
  };
  const importAccessFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const emails = [
      ...new Set([
        ...parseAccessEmails(allowedEmailDraft),
        ...parseAccessEmails(text),
      ]),
    ];
    await saveAllowedEmails(emails);
  };
  const updateAccessRequest = async (
    request: CollectionAccessRequest,
    status: "approved" | "declined",
  ) => {
    const email = request.email.trim().toLowerCase();
    const allowed =
      status === "approved"
        ? [...new Set([...parseAccessEmails(allowedEmailDraft), email])]
        : parseAccessEmails(allowedEmailDraft).filter((item) => item !== email);
    const requests = accessRequests.map((item) =>
      item.email === request.email
        ? { ...item, status, updatedAt: new Date().toISOString() }
        : item,
    );
    await saveAccessSettings({
      ...accessSettings,
      allowedEmails: allowed,
      requests,
    });
    setAllowedEmailDraft(allowed.join("\n"));
    toast.success(
      status === "approved" ? "Access approved" : "Access declined",
    );
  };
  const removeAllowedEmail = async (email: string) => {
    await saveAllowedEmails(
      parseAccessEmails(allowedEmailDraft).filter((item) => item !== email),
    );
  };
  const accessRows = useMemo(() => {
    const rows = new Map<
      string,
      { email: string; request?: CollectionAccessRequest }
    >();
    parseAccessEmails(allowedEmailDraft).forEach((email) =>
      rows.set(email, { email }),
    );
    accessRequests.forEach((request) => {
      const email = request.email.trim().toLowerCase();
      rows.set(email, { email, request });
    });
    return [...rows.values()].filter((row) => {
      if (accessFilter === "allowed")
        return parseAccessEmails(allowedEmailDraft).includes(row.email);
      if (accessFilter === "requests") return Boolean(row.request);
      return true;
    });
  }, [accessFilter, accessRequests, allowedEmailDraft]);
  const saveFavoriteListRules = async () => {
    try {
      await saveFavoriteSettings({
        maxFavorites: favoriteLimitDraft,
        description: favoriteDescriptionDraft,
      });
      toast.success("Favorite settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    }
  };
  const copyToSet = async (list: CollectionFavoriteActivityRecord) => {
    const name =
      window.prompt("New set name", `${list.name} - ${list.email}`) || "";
    if (!name.trim()) return;
    setCopyingListId(list.id);
    try {
      await copyFavoriteListToSet({ favoriteUserId: list.id, name });
      toast.success("Copied to new set");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Copy failed");
    } finally {
      setCopyingListId("");
    }
  };
  const copyToCollection = async (list: CollectionFavoriteActivityRecord) => {
    const name =
      window.prompt(
        "New collection name",
        `${collectionName} - ${list.name}`,
      ) || "";
    if (!name.trim()) return;
    setCopyingListId(list.id);
    try {
      await copyFavoriteListToCollection({ favoriteUserId: list.id, name });
      toast.success("Copied to new collection");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Copy failed");
    } finally {
      setCopyingListId("");
    }
  };
  const deleteFavoriteList = async (list: CollectionFavoriteActivityRecord) => {
    await deleteFavoriteInfo(list.id);
    setEditingList(null);
    toast.success("Favorite info deleted");
  };
  const deleteFavoriteImage = async (
    list: CollectionFavoriteActivityRecord,
    imageId: string,
  ) => {
    await deleteFavoriteImageInfo({ favoriteUserId: list.id, imageId });
    setEditingList((current) =>
      current
        ? {
            ...current,
            images: current.images?.filter(
              (image) => image.imageId !== imageId,
            ),
            filenames: current.filenames.filter(
              (_, index) => current.images?.[index]?.imageId !== imageId,
            ),
            photos: Math.max(0, current.photos - 1),
          }
        : current,
    );
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

  if (exportJob) {
    return (
      <section className="flex min-h-[70dvh] items-center justify-center bg-[#f7fbfa] p-6">
        <div className="w-full max-w-[620px] border bg-white p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#00a997]">
            Preparing export
          </p>
          <h2 className="mt-4 text-3xl font-medium">{collectionName}</h2>
          <p className="mt-2 text-sm text-[#666]">{exportJob.title}</p>
          <div className="mx-auto mt-10 flex size-40 items-center justify-center rounded-full border border-[#d9f4ef] bg-[#eefdfa]">
            <div className="flex size-28 animate-pulse items-center justify-center rounded-full bg-[#22bda7] text-3xl font-bold text-white">
              {exportJob.percent}%
            </div>
          </div>
          <div className="mt-10 h-3 overflow-hidden bg-[#e4f4f1]">
            <div
              className="h-full bg-[#22bda7] transition-all duration-300"
              style={{ width: `${exportJob.percent}%` }}
            />
          </div>
          <p className="mt-4 text-sm font-semibold text-[#667]">
            CSV will download when ready.
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="min-w-0">
        {activityPage === "email" ? (
          <div className="max-h-[calc(100dvh-220px)] min-h-[560px] overflow-y-auto pr-1">
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-white/95 py-3 backdrop-blur">
              <div>
                <h2 className="text-2xl font-medium">Email Access</h2>
                <p className="mt-2 text-sm text-[#666]">
                  Only listed or approved emails can open this collection when
                  Email Registration is on.
                </p>
              </div>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 border bg-white px-3 text-sm font-bold">
                <FileUp className="size-4" />
                Upload CSV/TXT
                <input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(event) => {
                    void importAccessFile(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            <section className="mt-5 border bg-white">
              <div className="border-b p-5">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="access-emails">Add emails</FieldLabel>
                    <Textarea
                      id="access-emails"
                      value={emailEntryDraft}
                      onChange={(event) =>
                        setEmailEntryDraft(event.target.value)
                      }
                      className="min-h-24 rounded-none"
                      placeholder="client@example.com, family@example.com"
                    />
                  </Field>
                </FieldGroup>
                <div className="mt-3 flex justify-end">
                  <Button
                    className="h-10 rounded-none bg-[#22bda7] text-white"
                    onClick={() => void addAllowedEmails()}
                  >
                    Add emails
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
                <p className="text-sm font-bold">{accessRows.length} emails</p>
                <div className="flex gap-1" aria-label="Filter email access">
                  {(["all", "allowed", "requests"] as const).map((filter) => (
                    <Button
                      key={filter}
                      type="button"
                      size="sm"
                      variant={accessFilter === filter ? "default" : "ghost"}
                      className="rounded-none capitalize"
                      onClick={() => setAccessFilter(filter)}
                    >
                      {filter === "requests" ? "Access requests" : filter}
                    </Button>
                  ))}
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-5">Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Request note</TableHead>
                    <TableHead className="px-5 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessRows.map(({ email, request }) => {
                    const isAllowed =
                      parseAccessEmails(allowedEmailDraft).includes(email);
                    return (
                      <TableRow key={email}>
                        <TableCell className="px-5 font-semibold">
                          {email}
                        </TableCell>
                        <TableCell className="capitalize">
                          {request?.status ||
                            (isAllowed ? "allowed" : "pending")}
                        </TableCell>
                        <TableCell className="max-w-80 whitespace-normal text-[#666]">
                          {request?.reason || "â€”"}
                        </TableCell>
                        <TableCell className="px-5">
                          <div className="flex justify-end gap-2">
                            {request && request.status !== "approved" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-none"
                                onClick={() =>
                                  void updateAccessRequest(request, "approved")
                                }
                              >
                                Approve
                              </Button>
                            )}
                            {request && request.status !== "declined" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-none text-red-600"
                                onClick={() =>
                                  void updateAccessRequest(request, "declined")
                                }
                              >
                                Decline
                              </Button>
                            )}
                            {isAllowed && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-none text-red-600"
                                onClick={() => void removeAllowedEmail(email)}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!accessRows.length && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-28 text-center text-[#777]"
                      >
                        No emails in this view.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </section>
          </div>
        ) : activityPage === "download" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-medium">Download Activity</h2>
              <Button
                variant="outline"
                className="h-9 rounded-none"
                disabled={!downloads.length}
                onClick={downloadActivityCsv}
              >
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
                      <td className="px-1 py-5">
                        {item.imageName ||
                          item.imageId ||
                          "Collection download"}
                      </td>
                      <td className="px-1 py-5 capitalize">
                        {item.downloadType}
                      </td>
                      <td className="px-1 py-5">{item.count}</td>
                      <td className="px-1 py-5">
                        {formatActivityDate(item.updatedAt)}
                      </td>
                    </tr>
                  ))}
                  {!downloads.length && (
                    <tr>
                      <td
                        className="px-1 py-10 text-center text-[#777]"
                        colSpan={5}
                      >
                        No downloads yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : activityPage === "orders" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-medium">Store Orders</h2>
              <p className="text-sm text-[#666]">
                {orders.length} order{orders.length === 1 ? "" : "s"} for this
                collection
              </p>
            </div>
            <div className="mt-7 overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b text-xs font-bold uppercase text-[#777]">
                  <tr>
                    <th className="px-1 py-3">Order</th>
                    <th className="px-1 py-3">Customer</th>
                    <th className="px-1 py-3">Items</th>
                    <th className="px-1 py-3">Total</th>
                    <th className="px-1 py-3">Status</th>
                    <th className="px-1 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order._id} className="border-b">
                      <td className="px-1 py-5 font-semibold">
                        {order.orderNumber}
                      </td>
                      <td className="px-1 py-5">
                        {order.customer?.name || order.customer?.email || "-"}
                      </td>
                      <td className="px-1 py-5">{order.items?.length ?? 0}</td>
                      <td className="px-1 py-5">{money(order.total, "EUR")}</td>
                      <td className="px-1 py-5 capitalize">{order.status}</td>
                      <td className="px-1 py-5">
                        {formatActivityDate(order.createdAt)}
                      </td>
                    </tr>
                  ))}
                  {!orders.length && (
                    <tr>
                      <td
                        className="px-1 py-10 text-center text-[#777]"
                        colSpan={6}
                      >
                        No store orders yet.
                      </td>
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
              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  className="inline-flex h-9 items-center gap-2 border bg-white px-3 text-sm font-bold text-[#111] disabled:opacity-50"
                  type="button"
                  onClick={() => openDownloadPage()}
                  disabled={!collectionImages.length}
                >
                  <Download className="size-4" />
                  Download all
                </button>
                <button
                  className="inline-flex h-9 items-center gap-2 border bg-white px-3 text-sm font-bold text-[#00a997] disabled:opacity-50"
                  type="button"
                  onClick={() => exportFavoriteList()}
                  disabled={!favoriteLists.length}
                >
                  <FileUp className="size-4" />
                  Export CSV
                </button>
                <button
                  className="inline-flex h-9 items-center gap-2 text-sm font-bold text-[#777]"
                  type="button"
                >
                  <ListFilter className="size-4" />
                  Sort by email
                </button>
                <span className="h-5 w-px bg-[#ddd]" />
                <button
                  className="inline-flex items-center gap-2 text-sm font-bold text-[#00a997]"
                  type="button"
                >
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
                      <td className="px-1 py-5">
                        {formatActivityDate(item.createdAt)}
                      </td>
                      <td className="px-1 py-5">
                        {formatActivityDate(item.updatedAt)}
                      </td>
                      <td className="px-1 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            className="h-8 rounded-none px-2 text-xs"
                            onClick={() => setEditingList(item)}
                          >
                            Edit List
                          </Button>
                          <Button
                            variant="outline"
                            className="h-8 rounded-none px-2 text-xs"
                            onClick={() => openDownloadPage()}
                          >
                            Download all
                          </Button>
                          <Button
                            variant="outline"
                            className="h-8 rounded-none px-2 text-xs"
                            onClick={() => openMailSender(item)}
                          >
                            Send
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className="h-8 rounded-none px-2"
                                aria-label="Favorite list actions"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-60 rounded-none p-3 shadow-[0_18px_35px_rgba(0,0,0,0.12)]"
                            >
                              <DropdownMenuGroup>
                                <DropdownMenuItem
                                  onClick={() => void copyFilenames(item)}
                                >
                                  <Copy className="size-4" /> Copy filenames
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => void copyToSet(item)}
                                  disabled={copyingListId === item.id}
                                >
                                  <Images className="size-4" /> Copy to new set
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => void copyToCollection(item)}
                                  disabled={copyingListId === item.id}
                                >
                                  <Package className="size-4" /> Copy to new
                                  collection
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setEditingList(item)}
                                >
                                  <Wrench className="size-4" /> Edit List
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    window.open(
                                      publicLink,
                                      "_blank",
                                      "noopener,noreferrer",
                                    )
                                  }
                                >
                                  <Eye className="size-4" /> View in Gallery
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openDownloadPage()}
                                >
                                  <Download className="size-4" /> Download all
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => exportFavoriteList(item)}
                                >
                                  <FileUp className="size-4" /> Export CSV
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openMailSender(item)}
                                >
                                  <Mail className="size-4" /> Send as download
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => void deleteFavoriteList(item)}
                                >
                                  <Trash2 className="size-4" /> Delete info
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!favoriteLists.length && (
                    <tr>
                      <td
                        className="px-1 py-10 text-center text-[#777]"
                        colSpan={6}
                      >
                        No favorites yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      <Dialog
        open={Boolean(editingList)}
        onOpenChange={(open) => !open && setEditingList(null)}
      >
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
                <span className="text-[#777]">
                  {editingList.photos} photos in {editingList.name}
                </span>
              </div>
              <div className="grid gap-4 border bg-[#fafafa] p-4">
                <Field>
                  <FieldLabel>Max Favorites</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    value={favoriteLimitDraft}
                    onChange={(event) =>
                      setFavoriteLimitDraft(event.target.value)
                    }
                    placeholder="Unlimited"
                    className="h-11 rounded-none bg-white"
                  />
                </Field>
                <Field>
                  <FieldLabel>Description</FieldLabel>
                  <Textarea
                    value={favoriteDescriptionDraft}
                    onChange={(event) =>
                      setFavoriteDescriptionDraft(event.target.value)
                    }
                    className="min-h-24 rounded-none bg-white"
                    placeholder="Shown on public gallery favorite area."
                  />
                </Field>
                <Button
                  className="h-10 w-fit rounded-none bg-[#22bda7] text-white"
                  onClick={() => void saveFavoriteListRules()}
                >
                  Save Favorite Rules
                </Button>
              </div>
              <div className="max-h-[320px] overflow-y-auto border">
                {(editingList.images?.length
                  ? editingList.images
                  : editingList.filenames.map((name) => ({
                      imageId: name,
                      name,
                      url: "",
                    }))
                ).map((image) => (
                  <div
                    key={image.imageId || image.name}
                    className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"
                  >
                    <span className="min-w-0 truncate text-sm">
                      {collectionName} - {image.name}
                    </span>
                    {image.imageId.match(/^[a-f\d]{24}$/i) && (
                      <Button
                        variant="outline"
                        className="h-8 rounded-none px-3 text-xs"
                        onClick={() =>
                          void deleteFavoriteImage(editingList, image.imageId)
                        }
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                ))}
                {!editingList.filenames.length && (
                  <p className="px-4 py-8 text-center text-sm text-[#777]">
                    No favorite files.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  className="rounded-none"
                  onClick={() => setEditingList(null)}
                >
                  Close
                </Button>
                <Button
                  className="rounded-none bg-red-600 text-white hover:bg-red-700"
                  onClick={() => void deleteFavoriteList(editingList)}
                >
                  Delete info
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(mailList)}
        onOpenChange={(open) => !open && setMailList(null)}
      >
        <DialogContent className="rounded-none sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>Send as download</DialogTitle>
            <DialogDescription>
              Choose a saved template. Button URL becomes this collection link.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>To</FieldLabel>
              <Input
                value={mailList?.email ?? ""}
                readOnly
                className="h-11 rounded-none bg-white"
              />
            </Field>
            <Field>
              <FieldLabel>Email Template</FieldLabel>
              <select
                value={selectedMailTemplateId}
                onChange={(event) =>
                  setSelectedMailTemplateId(event.target.value)
                }
                className="h-11 rounded-none border bg-white px-3 text-sm"
              >
                {emailTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name || template.subject || "Untitled Template"}
                  </option>
                ))}
                {!emailTemplates.length && (
                  <option value="">No templates</option>
                )}
              </select>
            </Field>
            <Field>
              <FieldLabel>Button URL</FieldLabel>
              <Input
                value={publicLink}
                readOnly
                className="h-11 rounded-none bg-white"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => setMailList(null)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-none bg-[#22bda7] text-white"
              disabled={!emailTemplates.length}
              onClick={() => void sendAsDownload()}
            >
              Use Template
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
          <Skeleton
            key={index}
            className="aspect-square rounded-none bg-[#eeeeec]"
          />
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
      {!placeholder && !loaded && (
        <Skeleton className="absolute inset-0 h-full w-full rounded-none bg-[#eeeeec]" />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          className,
          "transition-[opacity,transform] duration-500 ease-out",
          loaded ? "scale-100 opacity-100" : "scale-[1.015] opacity-0",
        )}
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
  customFontName: "",
  customFontDataUrl: "",
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

const collectionDefaultFavorite: PresetFavoriteSettings = {
  favoritePhotos: true,
  favoriteNotes: true,
  maxFavorites: "",
  description: "",
};

type CollectionAccessRequest = {
  id?: string;
  email: string;
  reason?: string;
  status?: "pending" | "approved" | "declined";
  createdAt?: string;
  updatedAt?: string;
};

type CollectionAccessSettings = {
  allowedEmails?: string[];
  requests?: CollectionAccessRequest[];
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
  favorite: PresetFavoriteSettings;
};

function coverTextOrDefault(value: string | undefined, fallback: string) {
  return value &&
    ![
      "Avery Studio",
      "Sarah & Daniel",
      "June 14, 2026",
      "View Gallery",
    ].includes(value)
    ? value
    : fallback;
}

function collectionForm(collection?: CollectionRecord): CollectionFormState {
  const savedDesign = (collection?.design ??
    {}) as Partial<PresetDesignSettings>;
  const eventLabel = collection?.eventDate
    ? formatDate(collection.eventDate)
    : "";
  const design = {
    ...collectionDefaultDesign,
    ...savedDesign,
    coverTitle: coverTextOrDefault(
      savedDesign.coverTitle,
      collection?.name ?? collectionDefaultDesign.coverTitle,
    ),
    coverDate: coverTextOrDefault(
      savedDesign.coverDate,
      eventLabel || collectionDefaultDesign.coverDate,
    ),
    coverButtonText: coverTextOrDefault(
      savedDesign.coverButtonText,
      "View Gallery",
    ),
  } as PresetDesignSettings;

  return {
    name: collection?.name ?? "",
    presetId: collection?.presetId ?? "",
    coverImage: collection?.coverImage ?? "",
    expiresAt: collection?.expiresAt ? collection.expiresAt.slice(0, 10) : "",
    sets: collection?.sets?.length
      ? collection.sets
      : [{ id: "highlights", name: "Highlights" }],
    design,
    general: {
      ...collectionDefaultGeneral,
      collectionTags:
        collection?.tags?.join(", ") ?? collectionDefaultGeneral.collectionTags,
      defaultWatermark:
        collection?.watermarkId ?? collectionDefaultGeneral.defaultWatermark,
      ...((collection?.settings?.general as
        | Partial<PresetGeneralSettings>
        | undefined) ?? {}),
    },
    download: {
      ...collectionDefaultDownload,
      ...((collection?.settings?.download as
        | Partial<PresetDownloadSettings>
        | undefined) ?? {}),
    },
    favorite: {
      ...collectionDefaultFavorite,
      ...((collection?.settings?.favorite as
        | Partial<PresetFavoriteSettings>
        | undefined) ?? {}),
    },
  };
}

function collectionFormKey(form: CollectionFormState) {
  return JSON.stringify(form);
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
      currentSets.find(
        (set) => set.name.toLowerCase() === name.toLowerCase(),
      ) ?? currentSets[index];

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
                    value
                      ? "bg-[#f1f5f4] text-[#333]"
                      : "bg-[#f5f5f5] text-[#777]",
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

function titleCase(value: string) {
  return value
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string) {
  if (!value) return "No date";
  try {
    return format(parseISO(value), "PPP");
  } catch {
    return value;
  }
}

function parseDisplayDate(value?: string) {
  if (!value) return undefined;
  const formats = [
    "PPP",
    "MMMM do, yyyy",
    "MMMM d, yyyy",
    "MMM d, yyyy",
    "yyyy-MM-dd",
  ];
  for (const pattern of formats) {
    const date =
      pattern === "yyyy-MM-dd"
        ? parseISO(value)
        : parse(value, pattern, new Date());
    if (isValid(date)) return date;
  }
  return undefined;
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

function publicCollectionPath(collection: CollectionRecord) {
  return `/collection/${encodeURIComponent(collection.name)}/${encodeURIComponent(collection.slug ?? collection._id)}`;
}

function safeCsvName(value: string) {
  return (
    value
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "collection"
  );
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const headers = rows[0] ? Object.keys(rows[0]) : ["email"];
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvCell(row[header])).join(","),
    ),
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

      <div
        className={cn(
          "mt-8 w-full max-w-[686px] p-4 sm:p-8 md:mt-8 md:p-12",
          active.bg,
        )}
      >
        <GalleryPreview active={active} />
      </div>
    </div>
  );
}

function GalleryPreview({
  active,
}: {
  active: (typeof dashboardCopy)[DashboardSection];
}) {
  return (
    <div className="relative mx-auto aspect-[1.18] max-w-[555px]">
      <div className="absolute left-0 top-10 h-[78%] w-[82%] bg-white/45 shadow-sm" />
      <div className="absolute left-3 top-6 h-[86%] w-[90%] bg-white/65 shadow-sm sm:left-5" />
      <div className="absolute inset-x-3 top-0 overflow-hidden bg-white shadow-[0_8px_18px_rgba(0,0,0,0.08)] sm:inset-x-10">
        <div className="flex h-3 items-center gap-1 bg-[#f5f5f5] px-3">
          <span className="size-1 rounded-full bg-[#d8d8d8]" />
          <span className="size-1 rounded-full bg-[#d8d8d8]" />
          <span className="size-1 rounded-full bg-[#d8d8d8]" />
        </div>
        <div className="relative h-[190px] sm:h-[270px] md:h-[280px]">
          <img
            src={active.image}
            alt={active.hero}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 text-white">
            <p className="text-xl font-bold tracking-wide">{active.hero}</p>
            <span className="mt-3 h-7 w-24 border border-white/85" />
          </div>
        </div>
        <div className="p-3 text-left">
          <p className="text-[9px] font-bold">{active.hero}</p>
          <p className="text-[7px] tracking-wide text-[#777]">
            AVERY WOODWARD PHOTOGRAPHY
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[
              "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=300&q=80",
              "https://images.unsplash.com/photo-1508808787069-421e7986016e?auto=format&fit=crop&w=300&q=80",
              "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=300&q=80",
              active.image,
            ].map((src) => (
              <img
                key={src}
                src={src}
                alt=""
                className="aspect-square w-full object-cover"
              />
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
        <div className="mt-8 bg-[#fafafa] p-5 sm:p-8 md:p-12">
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
                      !eventDate && "text-[#777]",
                    )}
                  >
                    {selectedEventDate
                      ? format(selectedEventDate, "PPP")
                      : "Select a date (optional)"}
                    <CalendarIcon data-icon="inline-end" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto rounded-none p-0"
                  align="start"
                >
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
        <div className="mt-8 bg-[#fafafa] p-5 sm:p-8 md:p-12">
          <button
            className="flex min-h-[250px] w-full flex-col items-center justify-center border border-dashed border-[#cfcfcf] bg-white text-center"
            onClick={addSamplePhotos}
          >
            <Upload className="size-9 text-[#22bda7]" />
            <span className="mt-5 text-base font-semibold">
              Upload sample photos
            </span>
            <span className="mt-2 text-sm text-[#777]">
              Click to add photos for now
            </span>
          </button>
          {photos.length > 0 && (
            <div className="mt-6 grid grid-cols-3 gap-3">
              {photos.map((photo) => (
                <img
                  key={photo}
                  src={photo}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
              ))}
            </div>
          )}
        </div>
        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            className="h-10 rounded-none px-8"
            onClick={() => setWizardStep(1)}
          >
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
  const coverImage =
    designs.find((design) => design.name === coverDesign)?.image ??
    designs[0].image;

  return (
    <div className="mx-auto max-w-[686px]">
      <p className="text-sm text-[#777]">Step 3 of 3</p>
      <h1 className="mt-4 text-[28px] font-medium">
        Choose a cover photo design
      </h1>
      <div className="mt-8 bg-[#fafafa] p-5 sm:p-8">
        <div className="relative h-[240px] bg-[#ddd] sm:h-[322px]">
          <CoverPreview
            design={{
              ...collectionDefaultDesign,
              cover: coverDesign,
              coverTitle: collectionName || "My Sample Collection",
              coverDate: eventDate
                ? format(parseISO(eventDate), "PPP")
                : "June 14, 2026",
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
              <span
                className={cn(
                  "relative block border p-1",
                  coverDesign === design.name &&
                    "border-[#22bda7] ring-2 ring-[#22bda7]",
                )}
              >
                <img
                  src={design.image}
                  alt={design.name}
                  className="aspect-[1.6] w-full object-cover"
                />
                {coverDesign === design.name && (
                  <Check className="absolute right-2 top-2 size-4 bg-[#22bda7] text-white" />
                )}
              </span>
              <span className="mt-3 block text-sm text-[#555]">
                {design.name}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <Button
          variant="outline"
          className="h-10 rounded-none px-8"
          onClick={() => setWizardStep(2)}
        >
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
