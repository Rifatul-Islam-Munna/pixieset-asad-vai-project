"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ComponentType, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart3, Check, Clock3, Copy, Edit3, Euro, ExternalLink, FileImage, FileText, GripVertical, HardDrive, Images, Loader2, LogOut, Mail, Menu, MessageCircle, Newspaper, Package, PlusCircle, Search, Send, ShieldCheck, ShoppingBag, Trash2, Users, X } from "lucide-react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import {
  createAdminLoginAccess,
  createAdminPlan,
  createAdminUser,
  deleteAdminCollection,
  deleteAdminPlan,
  deleteAdminUser,
  getAdminUserDetails,
  impersonateAdminUser,
  reorderAdminPlans,
  sendAdminLoginAccessEmail,
  updateAdminCollection,
  updateAdminPlan,
  updateAdminFreePlanSettings,
  updateAdminStripeSettings,
  updateAdminUser,
  updateHomeCms,
  uploadHomeCmsFile,
  type AdminCollection,
  type AdminDashboardData,
  type AdminFreePlanSetting,
  type AdminLoginAccess,
  type AdminPlan,
  type AdminStripeSetting,
  type AdminUser,
} from "@/actions/admin";
import { logOutUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { mergeHomeCms, type BrandLogo, type FeatureCard, type FooterLink, type GalleryTab, type HomeCmsData, type HomeContent, type HomeLanguage, type HomeMarqueeItem, type SeoMetaTag, type Testimonial } from "@/lib/home-cms";
import { cn } from "@/lib/utils";
import { SupportChat } from "@/components/dashboard/support-chat";

type UserForm = {
  id?: string;
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: AdminUser["role"];
  gender: string;
  planId: string;
};

type PlanForm = {
  id?: string;
  name: string;
  storageGb: string;
  galleryLimit: string;
  monthlyEmails: string;
  videoMinutes: string;
  videoQuality: "hd" | "4k";
  priceMonthly: string;
  yearlyEnabled: boolean;
  priceYearly: string;
  features: Record<string, boolean>;
  recommended: boolean;
  active: boolean;
};

type AdminTab = "overview" | "users" | "collections" | "plans" | "free-plan" | "stripe" | "vip-support" | "cms" | "seo" | "terms" | "privacy";

const emptyForm: UserForm = {
  name: "",
  email: "",
  phoneNumber: "",
  password: "",
  role: "user",
  gender: "",
  planId: "",
};

const emptyPlanForm: PlanForm = {
  name: "",
  storageGb: "",
  galleryLimit: "",
  monthlyEmails: "",
  videoMinutes: "",
  videoQuality: "hd",
  priceMonthly: "",
  yearlyEnabled: false,
  priceYearly: "",
  features: {},
  recommended: false,
  active: true,
};

type LoginValidityUnit = "hours" | "days";
const defaultLoginEmailSubject = "Your secure login access";
const defaultLoginEmailMessage = "Hello {{name}},\n\nUse this one-time PIN to sign in: {{pin}}\n\nOr open this direct login link:\n{{link}}\n\nThis access is valid until {{expiresAt}} and can only be used once. After signing in, you can change your password from your account settings.\n\nIf you did not expect this message, you can ignore it.";

const planFeatures = [
  ["aiFaceSearch", "AI Face Search"],
  ["downloads", "Downloads"],
  ["mobileGallery", "Mobile Gallery"],
  ["beautifulGalleries", "Beautiful Galleries"],
  ["passwordProtection", "Password Protection"],
  ["multipleGalleryStores", "Multiple Gallery Stores"],
  ["advancedFaceSearch", "Advanced Face Search"],
  ["basicAnalytics", "Basic Gallery & Sales Analytics"],
  ["advancedBranding", "Advanced Branding"],
  ["pinSet", "PIN set"],
  ["downloadLimit", "Download limit"],
  ["store", "Store"],
  ["marketingEmails", "Marketing email"],
  ["vipSupport", "VIP Support"],
] as const;

export function AdminDashboard({ initialData, initialTab }: { initialData: AdminDashboardData; initialTab?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const validInitialTab = (["overview", "users", "collections", "plans", "free-plan", "stripe", "vip-support", "cms", "seo", "terms", "privacy"] as AdminTab[]).includes(initialTab as AdminTab)
    ? (initialTab as AdminTab)
    : "overview";
  const [tab, setTab] = useState<AdminTab>(validInitialTab);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userDetails, setUserDetails] = useState<AdminUser | null>(null);
  const [userDetailsOpen, setUserDetailsOpen] = useState(false);
  const [collectionEdit, setCollectionEdit] = useState<AdminCollection | null>(null);
  const [collectionDraft, setCollectionDraft] = useState({ name: "", slug: "", status: "draft" });
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [stripeForm, setStripeForm] = useState<AdminStripeSetting>(
    initialData.stripe ?? { enabled: false, publishableKey: "" },
  );
  const [freePlanForm, setFreePlanForm] = useState<AdminFreePlanSetting>(
    initialData.freePlan ?? { storageGb: 3, monthlyEmails: 1000 },
  );
  const [loginAccessUser, setLoginAccessUser] = useState<AdminUser | null>(null);
  const [loginAccess, setLoginAccess] = useState<AdminLoginAccess | null>(null);
  const [loginValidityValue, setLoginValidityValue] = useState("10");
  const [loginValidityUnit, setLoginValidityUnit] = useState<LoginValidityUnit>("hours");
  const [loginEmailSubject, setLoginEmailSubject] = useState(defaultLoginEmailSubject);
  const [loginEmailMessage, setLoginEmailMessage] = useState(defaultLoginEmailMessage);
  const [loginSendStatus, setLoginSendStatus] = useState<{ sent: boolean; reason?: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const openConfirm = (message: string, action: () => void) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };
  const [homeCms, setHomeCms] = useState<HomeCmsData>(mergeHomeCms(initialData.homeCms));
  const [homeCmsLang, setHomeCmsLang] = useState<HomeLanguage>(() => mergeHomeCms(initialData.homeCms).defaultLanguage);
  const [cmsSaveState, setCmsSaveState] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const lastSavedCms = useRef(JSON.stringify(mergeHomeCms(initialData.homeCms)));
  const currentCms = useRef(homeCms);
  currentCms.current = homeCms;

  const users = initialData.users;
  const collections = initialData.collections;
  const plans = initialData.plans ?? [];
  const pageTitle = tab === "cms" ? "Homepage Editor" : tab === "terms" ? "Terms of Service" : tab === "privacy" ? "Privacy Policy" : tab === "overview" ? "Admin Dashboard" : tab.replace("-", " ").replace(/^./, (letter) => letter.toUpperCase());

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      [user.name, user.email, user.phoneNumber, user.role].some((value) => value?.toLowerCase().includes(term)),
    );
  }, [query, users]);

  const filteredCollections = useMemo(() => {
    const term = query.trim().toLowerCase();
    return collections.filter((collection) => {
      const owner = collection.user?.name ?? collection.user?.email ?? collection.user?.phoneNumber ?? "";
      const matchesUser = !selectedUserId || collection.userId === selectedUserId;
      const matchesTerm = !term || [collection.name, owner, collection.status].some((value) => value?.toLowerCase().includes(term));
      return matchesUser && matchesTerm;
    });
  }, [collections, query, selectedUserId]);

  const filteredPlans = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return plans;
    return plans.filter((plan) =>
      [plan.name, String(plan.storageGb), String(plan.monthlyEmails)].some((value) => value.toLowerCase().includes(term)),
    );
  }, [plans, query]);

  const submitUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        if (form.id) {
          const { id, password, ...rest } = form;
          await updateAdminUser(id, {
            ...rest,
            ...(password.trim() ? { password } : {}),
          });
          toast.success("User updated");
        } else {
          await createAdminUser(form);
          toast.success("User created");
        }
        setForm(emptyForm);
        setUserModalOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Action failed");
      }
    });
  };

  const submitPlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      name: planForm.name,
      storageGb: Number(planForm.storageGb || 0),
      galleryLimit: Number(planForm.galleryLimit || 0),
      monthlyEmails: Number(planForm.monthlyEmails || 0),
      videoMinutes: Number(planForm.videoMinutes || 0),
      videoQuality: planForm.videoQuality,
      priceMonthly: Number(planForm.priceMonthly || 0),
      yearlyEnabled: planForm.yearlyEnabled,
      priceYearly: planForm.yearlyEnabled ? Number(planForm.priceYearly || 0) : 0,
      features: planForm.features,
      recommended: planForm.recommended,
      active: planForm.active,
    };
    startTransition(async () => {
      try {
        if (planForm.id) {
          await updateAdminPlan(planForm.id, payload);
          toast.success("Plan updated");
        } else {
          await createAdminPlan(payload);
          toast.success("Plan created");
        }
        setPlanForm(emptyPlanForm);
        setPlanModalOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Action failed");
      }
    });
  };

  const viewUser = (user: AdminUser) => {
    startTransition(async () => {
      try {
        const details = await getAdminUserDetails(user._id);
        setUserDetails(details);
        setUserDetailsOpen(true);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load user details");
      }
    });
  };

  const signInAsUser = (user: AdminUser) => {
    openConfirm(`Sign in as ${user.name}? Your admin session will be saved for 2 hours.`, () => {
      startTransition(async () => {
        try {
          await impersonateAdminUser(user._id);
          window.location.href = "/dashboard";
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not sign in as user");
        }
      });
    });
  };

  const editUser = (user: AdminUser) => {
    setTab("users");
    setUserModalOpen(true);
    setForm({
      id: user._id,
      name: user.name ?? "",
      email: user.email ?? "",
      phoneNumber: user.phoneNumber ?? "",
      password: "",
      role: user.role ?? "user",
      gender: user.gender ?? "",
      planId: user.planId ?? "",
    });
  };

  const openLoginAccess = (user: AdminUser) => {
    setLoginAccessUser(user);
    setLoginAccess(null);
    setLoginValidityValue("10");
    setLoginValidityUnit("hours");
    setLoginEmailSubject(defaultLoginEmailSubject);
    setLoginEmailMessage(defaultLoginEmailMessage);
    setLoginSendStatus(null);
  };

  const generateLoginAccess = () => {
    if (!loginAccessUser) return;
    const amount = Math.max(1, Number.parseInt(loginValidityValue, 10) || 1);
    const expiresInHours = loginValidityUnit === "days" ? amount * 24 : amount;
    startTransition(async () => {
      try {
        const data = await createAdminLoginAccess(loginAccessUser._id, expiresInHours);
        setLoginAccess(data);
        setLoginSendStatus(null);
        toast.success(`Login access created for ${data.validity}. Email has not been sent yet.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not create login access");
      }
    });
  };

  const sendLoginAccessEmail = () => {
    if (!loginAccessUser || !loginAccess) return;
    startTransition(async () => {
      try {
        const result = await sendAdminLoginAccessEmail(loginAccessUser._id, {
          pin: loginAccess.pin,
          link: loginAccess.link,
          subject: loginEmailSubject,
          message: loginEmailMessage,
        });
        setLoginSendStatus({ sent: result.sent, reason: result.reason });
        toast.success(result.sent ? `Login email sent to ${result.email}` : "SMTP did not send the email");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not send login email");
      }
    });
  };

  const copyLoginValue = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const removeUser = (id: string) => {
    openConfirm("Delete this user and all collections?", () => {
      startTransition(async () => {
        try {
          await deleteAdminUser(id);
          toast.success("User deleted");
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Delete failed");
        }
      });
    });
  };

  const removeCollection = (id: string) => {
    openConfirm("Delete this collection?", () => {
      startTransition(async () => {
        try {
          await deleteAdminCollection(id);
          toast.success("Collection deleted");
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Delete failed");
        }
      });
    });
  };

  const editCollection = (collection: AdminCollection) => {
    setCollectionEdit(collection);
    setCollectionDraft({ name: collection.name ?? "", slug: collection.slug ?? "", status: collection.status ?? "draft" });
  };

  const saveCollection = () => {
    if (!collectionEdit) return;
    startTransition(async () => {
      try {
        await updateAdminCollection(collectionEdit._id, collectionDraft);
        toast.success("Collection updated");
        setCollectionEdit(null);
        router.refresh();
        if (userDetailsOpen && userDetails?._id) setUserDetails(await getAdminUserDetails(userDetails._id));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update collection");
      }
    });
  };

  const editPlan = (plan: AdminPlan) => {
    router.push(`/admin/plans/${plan._id}`);
  };

  const updatePlanOrder = (id: string, sortOrder: number) => {
    startTransition(async () => {
      try {
        await updateAdminPlan(id, { sortOrder });
        toast.success("Plan order updated");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update plan order");
      }
    });
  };

  const reorderPlans = (planIds: string[]) => {
    startTransition(async () => {
      try {
        await reorderAdminPlans(planIds);
        toast.success("Plan order saved");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not reorder plans");
      }
    });
  };

  const removePlan = (id: string) => {
    openConfirm("Delete this plan?", () => {
      startTransition(async () => {
        try {
          await deleteAdminPlan(id);
          toast.success("Plan deleted");
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Delete failed");
        }
      });
    });
  };

  const saveStripe = () => {
    startTransition(async () => {
      try {
        const data = await updateAdminStripeSettings(stripeForm);
        setStripeForm(data);
        toast.success("Stripe settings saved");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Stripe save failed");
      }
    });
  };

  const saveFreePlan = () => {
    startTransition(async () => {
      try {
        const data = await updateAdminFreePlanSettings(freePlanForm);
        setFreePlanForm(data);
        toast.success("Free plan limits saved");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Free plan save failed");
      }
    });
  };

  const saveHomeCms = (quiet = false) => {
    const snapshot = { ...homeCms, auth: { ...homeCms.auth, brand: homeCms.brand.brandText } };
    console.log("[Home CMS] OUTGOING PATCH", JSON.stringify({
      defaultLanguage: snapshot.defaultLanguage,
      editingLanguage: homeCmsLang,
      enHero: snapshot.content.en.hero,
      grHero: snapshot.content.gr.hero,
      fullPayload: snapshot,
    }, null, 2));
    setCmsSaveState("saving");
    startTransition(async () => {
      try {
        const data = await updateHomeCms(snapshot);
        console.log("[Home CMS] SAVED RESPONSE", JSON.stringify({
          defaultLanguage: data.defaultLanguage,
          enHero: data.content.en.hero,
          grHero: data.content.gr.hero,
          fullResponse: data,
        }, null, 2));
        lastSavedCms.current = JSON.stringify(data);
        setHomeCms((current) => JSON.stringify(current) === JSON.stringify(snapshot) ? data : current);
        setCmsSaveState(JSON.stringify(currentCms.current) === JSON.stringify(snapshot) ? "saved" : "unsaved");
        if (!quiet) toast.success("Home CMS saved and live");
        router.refresh();
      } catch (error) {
        console.error("[Home CMS] save failed", error);
        setCmsSaveState("error");
        toast.error(error instanceof Error ? error.message : "CMS save failed");
      }
    });
  };

  useEffect(() => {
    const serialized = JSON.stringify(homeCms);
    if (serialized === lastSavedCms.current) return;
    setCmsSaveState("unsaved");
    const timer = window.setTimeout(() => saveHomeCms(true), 900);
    return () => window.clearTimeout(timer);
  }, [homeCms]);

  const uploadCmsFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadHomeCmsFile(formData);
  };

  const uploadCmsMedia = (file: File) => {
    startTransition(async () => {
      try {
        const url = await uploadCmsFile(file);
        setHomeCms({
          ...homeCms,
          media: {
            heroMediaType: file.type.startsWith("video/") ? "video" : "image",
            heroMediaUrl: url,
          },
        });
        toast.success("Hero media uploaded");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Upload failed");
      }
    });
  };

  const logout = () => {
    startTransition(async () => {
      await logOutUser();
      router.push("/login");
    });
  };

  const openAddModal = () => {
    setForm(emptyForm);
    setUserModalOpen(true);
  };
  const closeUserModal = () => {
    setUserModalOpen(false);
    setForm(emptyForm);
  };
  const openPlanModal = () => {
    setPlanForm(emptyPlanForm);
    setPlanModalOpen(true);
  };
  const closePlanModal = () => {
    setPlanModalOpen(false);
    setPlanForm(emptyPlanForm);
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f6f6f3] text-[#151515]">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r bg-white px-5 py-6 lg:block">
          <Link href="/" className="inline-flex min-h-10 items-center" aria-label="Open website">
            {homeCms.brand.logoUrl ? (
              <img src={homeCms.brand.logoUrl} alt={homeCms.brand.brandText || "Brand logo"} className="max-h-9 w-auto max-w-[170px] object-contain" />
            ) : (
              <span className="text-base font-bold text-[#6337d8]">{homeCms.brand.brandText || "Nikoset"}</span>
            )}
          </Link>
          <AdminNav tab={tab} setTab={setTab} />
          <Button onClick={logout} variant="outline" className="mt-10 h-10 w-full rounded-none" disabled={pending}>
            <LogOut className="size-4" />
            Logout
          </Button>
        </aside>

        <section className="min-w-0 px-3 py-4 sm:px-4 md:px-8 md:py-6">
          <div className="mb-5 flex items-center justify-between gap-3 bg-white px-3 py-3 sm:px-4 lg:hidden">
            <Link href="/" className="inline-flex min-h-9 items-center" aria-label="Open website">
              {homeCms.brand.logoUrl ? (
                <img src={homeCms.brand.logoUrl} alt={homeCms.brand.brandText || "Brand logo"} className="max-h-8 w-auto max-w-[150px] object-contain" />
              ) : (
                <span className="font-bold text-[#6337d8]">{homeCms.brand.brandText || "Nikoset"}</span>
              )}
            </Link>
            <button className="flex size-10 items-center justify-center bg-[#6337d8] text-white" onClick={() => setAdminMenuOpen(true)} aria-label="Open admin menu">
              <Menu />
            </button>
          </div>

          {adminMenuOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 lg:hidden">
              <aside className="h-full w-[88vw] max-w-[320px] overflow-y-auto bg-white px-5 py-6 shadow-[20px_0_60px_rgba(0,0,0,0.25)]">
                <div className="flex items-center justify-between">
                  <Link href="/" className="inline-flex min-h-9 items-center" aria-label="Open website">
                    {homeCms.brand.logoUrl ? (
                      <img src={homeCms.brand.logoUrl} alt={homeCms.brand.brandText || "Brand logo"} className="max-h-8 w-auto max-w-[150px] object-contain" />
                    ) : (
                      <span className="font-bold text-[#6337d8]">{homeCms.brand.brandText || "Nikoset"}</span>
                    )}
                  </Link>
                  <button className="flex size-10 items-center justify-center bg-[#f3f3f3]" onClick={() => setAdminMenuOpen(false)} aria-label="Close admin menu">
                    <X className="size-5" />
                  </button>
                </div>
                <AdminNav tab={tab} setTab={(next) => { setTab(next); setAdminMenuOpen(false); }} />
                <Button onClick={logout} variant="outline" className="mt-10 h-10 w-full rounded-none" disabled={pending}>
                  <LogOut className="size-4" />
                  Logout
                </Button>
              </aside>
            </div>
          )}

          <header className="flex flex-wrap items-start justify-between gap-5 border-b border-[#ddd] pb-6">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#777]">
                <ShieldCheck className="size-4 text-[#6337d8]" />
                Control Panel
              </p>
              <h1 className="mt-3 text-2xl font-medium md:text-3xl">{pageTitle}</h1>
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-3 lg:w-auto">
              <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto lg:gap-3">
                <Stat label="Users" value={initialData.stats.users} />
                <Stat label="Collections" value={initialData.stats.collections} />
                <Stat label="Images" value={initialData.stats.images} />
                <Stat label="Revenue" value={Number(initialData.stats.revenue ?? 0)} money />
              </div>
              <Button onClick={logout} variant="outline" className="hidden h-11 rounded-none bg-white lg:flex" disabled={pending}>
                <LogOut className="size-4" />
                Logout
              </Button>
            </div>
          </header>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex h-11 min-w-0 flex-1 basis-full items-center border bg-white px-3 md:basis-auto">
              <Search className="mr-2 size-4 text-[#777]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tab === "overview" ? "Dashboard overview" : tab === "users" ? "Search users" : tab === "plans" ? "Search plans" : tab === "free-plan" ? "Free plan limits" : tab === "stripe" ? "Stripe settings" : tab === "cms" ? "Homepage editor" : tab === "terms" ? "Terms editor" : tab === "privacy" ? "Privacy editor" : "Search collections"}
                className="h-10 rounded-none border-0 px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            {tab === "collections" && (
              <select
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                className="h-11 w-full min-w-0 border bg-white px-3 text-sm outline-none sm:w-auto"
              >
                <option value="">All users</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>{user.name}</option>
                ))}
              </select>
            )}
            {tab === "stripe" && (
              <Button onClick={saveStripe} className="h-11 rounded-none bg-[#6337d8] text-white hover:bg-[#5430bd]" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : "Save Stripe"}
              </Button>
            )}
            {tab === "users" && (
              <Button onClick={openAddModal} className="h-11 rounded-none bg-[#6337d8] text-white hover:bg-[#5430bd]">
                <PlusCircle className="size-4" />
                Add user
              </Button>
            )}
            {tab === "plans" && (
              <Button asChild className="h-11 rounded-none bg-[#6337d8] text-white hover:bg-[#5430bd]">
                <Link href="/admin/plans/new">
                  <PlusCircle className="size-4" />
                  Add plan
                </Link>
              </Button>
            )}
          </div>

          {tab === "overview" ? (
            <AdminOverview data={initialData} />
          ) : tab === "users" ? (
            <div className="mt-6">
              <UserTable users={filteredUsers} onView={viewUser} onEdit={editUser} onImpersonate={signInAsUser} onSendLogin={openLoginAccess} onDelete={removeUser} busy={pending} />
            </div>
          ) : tab === "plans" ? (
            <PlanTable plans={filteredPlans} onEdit={editPlan} onDelete={removePlan} onOrderChange={updatePlanOrder} onReorder={reorderPlans} busy={pending} />
          ) : tab === "free-plan" ? (
            <FreePlanSettingsPanel form={freePlanForm} setForm={setFreePlanForm} onSave={saveFreePlan} busy={pending} />
          ) : tab === "stripe" ? (
            <StripeSettingsPanel form={stripeForm} setForm={setStripeForm} />
          ) : tab === "vip-support" ? (
            <SupportChat admin />
          ) : tab === "seo" ? (
            <SeoCmsPanel
              form={homeCms}
              setForm={setHomeCms}
              onUpload={uploadCmsFile}
              onSave={() => saveHomeCms(false)}
              saveState={cmsSaveState}
              busy={pending}
            />
          ) : tab === "cms" ? (
            <HomeCmsPanel
              form={homeCms}
              lang={homeCmsLang}
              setForm={setHomeCms}
              setLang={setHomeCmsLang}
              onUpload={uploadCmsFile}
              onHeroUpload={uploadCmsMedia}
              onSave={() => saveHomeCms(false)}
              saveState={cmsSaveState}
              busy={pending}
            />
          ) : tab === "terms" || tab === "privacy" ? (
            <LegalCmsPanel
              type={tab}
              form={homeCms}
              lang={homeCmsLang}
              setForm={setHomeCms}
              setLang={setHomeCmsLang}
              onSave={() => saveHomeCms(false)}
              saveState={cmsSaveState}
              busy={pending}
            />
          ) : (
            <CollectionTable collections={filteredCollections} onEdit={editCollection} onDelete={removeCollection} busy={pending} />
          )}
        </section>
      </div>

      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-3 sm:p-4">
          <form onSubmit={submitUser} className="max-h-[calc(100dvh-1.5rem)] w-full max-w-[460px] overflow-y-auto bg-white p-5 shadow-[0_28px_80px_rgba(0,0,0,0.18)] sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4 border-b pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777]">User Control</p>
                <h2 className="mt-2 text-xl font-semibold">{form.id ? "Edit user" : "Add user"}</h2>
              </div>
              <button type="button" onClick={closeUserModal} aria-label="Close user modal" className="p-2 hover:bg-[#f3f3f3]">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid gap-3">
              <InputField label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
              <InputField label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
              <InputField label="Phone / Login" value={form.phoneNumber} onChange={(value) => setForm({ ...form, phoneNumber: value })} required />
              <InputField label={form.id ? "New password" : "Password"} value={form.password} onChange={(value) => setForm({ ...form, password: value })} required={!form.id} type="password" />
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#777]">Role</span>
                <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AdminUser["role"] })} className="h-11 border px-3 text-sm outline-none">
                  <option value="user">User</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#777]">Plan</span>
                <select value={form.planId} onChange={(event) => setForm({ ...form, planId: event.target.value })} className="h-11 border px-3 text-sm outline-none">
                  <option value="">Free / No plan</option>
                  {plans.map((plan) => (
                    <option key={plan._id} value={plan._id}>{plan.name}</option>
                  ))}
                </select>
              </label>
              <InputField label="Gender" value={form.gender} onChange={(value) => setForm({ ...form, gender: value })} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-11 rounded-none" onClick={closeUserModal}>
                Cancel
              </Button>
              <Button className="h-11 rounded-none bg-[#111] px-6 text-white" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : form.id ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {userDetailsOpen && userDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-3 sm:p-4">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-[980px] overflow-y-auto bg-white p-5 shadow-[0_28px_80px_rgba(0,0,0,0.2)] sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-[#6337d8]">User details</p>
                <h2 className="mt-2 text-2xl font-semibold">{userDetails.name}</h2>
                <p className="mt-1 text-sm text-[#777]">{userDetails.email || userDetails.phoneNumber}</p>
              </div>
              <button className="p-2 hover:bg-[#f3f3f3]" onClick={() => setUserDetailsOpen(false)} aria-label="Close user details"><X className="size-5" /></button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard icon={Images} label="Collections" value={userDetails.collectionCount ?? 0} />
              <MetricCard icon={FileImage} label="Images" value={userDetails.imageCount ?? 0} />
              <MetricCard icon={ShoppingBag} label="Orders" value={userDetails.orderCount ?? 0} />
              <MetricCard icon={HardDrive} label="Storage used" value={`${(Number(userDetails.storageUsedBytes ?? 0) / 1024 / 1024).toFixed(1)} MB`} />
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="border border-[#ece8f5] p-4 text-sm">
                <p className="mb-3 font-bold text-[#6337d8]">Account</p>
                <div className="grid gap-2 text-[#555]"><p><b className="text-[#111]">Phone:</b> {userDetails.phoneNumber}</p><p><b className="text-[#111]">Role:</b> {userDetails.role}</p><p><b className="text-[#111]">Plan:</b> {userDetails.planName ?? "Free"}</p><p><b className="text-[#111]">Gallery limit:</b> {userDetails.galleryLimit ?? 0}</p><p><b className="text-[#111]">Email usage:</b> {userDetails.monthlyEmailsUsed ?? 0} / {userDetails.monthlyEmailLimit ?? 0}</p><p><b className="text-[#111]">Storage limit:</b> {userDetails.storageLimitGb ?? 0} GB</p></div>
              </div>
              <div className="border border-[#ece8f5] p-4 text-sm">
                <p className="mb-3 font-bold text-[#6337d8]">Business profile</p>
                <div className="grid gap-2 text-[#555]"><p><b className="text-[#111]">Business:</b> {userDetails.businessName || "—"}</p><p><b className="text-[#111]">Username:</b> {userDetails.username || "—"}</p><p><b className="text-[#111]">Website:</b> {userDetails.website || "—"}</p><p><b className="text-[#111]">Address:</b> {userDetails.businessAddress || "—"}</p><p><b className="text-[#111]">Joined:</b> {userDetails.createdAt ? new Date(userDetails.createdAt).toLocaleDateString() : "—"}</p></div>
              </div>
            </div>
            <div className="mt-5 border border-[#ece8f5]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-[#faf8ff] px-4 py-3"><p className="font-bold">Collections</p><span className="text-xs text-[#777]">Admin can edit each collection</span></div>
              <div className="divide-y">
                {(userDetails.collections ?? []).map((collection) => <div key={collection._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="font-semibold">{collection.name}</p><p className="text-xs text-[#777]">{collection.imageCount ?? 0} images · {collection.status ?? "draft"}</p></div><Button type="button" variant="outline" className="rounded-none" onClick={() => editCollection(collection)}><Edit3 className="size-4" /> Edit</Button></div>)}
                {!(userDetails.collections ?? []).length && <p className="px-4 py-6 text-sm text-[#777]">No collections yet.</p>}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-none" onClick={() => { setUserDetailsOpen(false); editUser(userDetails); }}><Edit3 className="size-4" /> Edit user</Button>
              {userDetails.role !== "admin" && <Button type="button" className="rounded-none bg-[#6337d8] text-white hover:bg-[#5430bd]" onClick={() => signInAsUser(userDetails)}><ExternalLink className="size-4" /> Sign in as user</Button>}
            </div>
          </div>
        </div>
      )}

      {collectionEdit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-[500px] bg-white p-6 shadow-[0_28px_80px_rgba(0,0,0,.2)]">
            <div className="flex items-center justify-between border-b pb-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#6337d8]">Collection control</p><h2 className="mt-1 text-xl font-semibold">Edit collection</h2></div><button className="p-2 hover:bg-[#f3f3f3]" onClick={() => setCollectionEdit(null)}><X className="size-5" /></button></div>
            <div className="mt-5 grid gap-4"><InputField label="Collection name" value={collectionDraft.name} onChange={(name) => setCollectionDraft({ ...collectionDraft, name })} /><InputField label="Slug" value={collectionDraft.slug} onChange={(slug) => setCollectionDraft({ ...collectionDraft, slug })} /><label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Status</span><select value={collectionDraft.status} onChange={(event) => setCollectionDraft({ ...collectionDraft, status: event.target.value })} className="h-11 border px-3 text-sm outline-none focus:border-[#6337d8]"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label></div>
            <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" className="rounded-none" onClick={() => setCollectionEdit(null)}>Cancel</Button><Button type="button" className="rounded-none bg-[#6337d8] text-white hover:bg-[#5430bd]" onClick={saveCollection} disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : "Save collection"}</Button></div>
          </div>
        </div>
      )}

      {planModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-3 sm:p-4">
          <form onSubmit={submitPlan} className="max-h-[calc(100dvh-1.5rem)] w-full max-w-[460px] overflow-y-auto bg-white p-5 shadow-[0_28px_80px_rgba(0,0,0,0.18)] sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4 border-b pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777]">Billing Plan</p>
                <h2 className="mt-2 text-xl font-semibold">{planForm.id ? "Edit plan" : "Add plan"}</h2>
              </div>
              <button type="button" onClick={closePlanModal} aria-label="Close plan modal" className="p-2 hover:bg-[#f3f3f3]">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid gap-3">
              <InputField label="Plan name" value={planForm.name} onChange={(value) => setPlanForm({ ...planForm, name: value })} required />
              <InputField label="Storage limit GB" value={planForm.storageGb} onChange={(value) => setPlanForm({ ...planForm, storageGb: value })} required type="number" />
              <InputField label="Gallery limit (0 = unlimited)" value={planForm.galleryLimit} onChange={(value) => setPlanForm({ ...planForm, galleryLimit: value })} required type="number" />
              <InputField label="Emails / month" value={planForm.monthlyEmails} onChange={(value) => setPlanForm({ ...planForm, monthlyEmails: value })} required type="number" />
              <InputField label="Total video minutes" value={planForm.videoMinutes} onChange={(value) => setPlanForm({ ...planForm, videoMinutes: value })} required type="number" />
              <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-[#777]">
                Video quality
                <select value={planForm.videoQuality} onChange={(event) => setPlanForm({ ...planForm, videoQuality: event.target.value as "hd" | "4k" })} className="h-11 border px-3 text-sm font-normal normal-case tracking-normal text-[#111] outline-none">
                  <option value="hd">HD only</option>
                  <option value="4k">HD + 4K</option>
                </select>
              </label>
              <InputField label="Monthly price EUR" value={planForm.priceMonthly} onChange={(value) => setPlanForm({ ...planForm, priceMonthly: value })} required type="number" />
              <label className="flex h-11 items-center justify-between border px-3 text-sm">
                <span className="font-semibold">Enable yearly billing</span>
                <input
                  type="checkbox"
                  checked={planForm.yearlyEnabled}
                  onChange={(event) => setPlanForm({ ...planForm, yearlyEnabled: event.target.checked })}
                />
              </label>
              {planForm.yearlyEnabled && (
                <InputField label="Yearly price EUR (total billed yearly)" value={planForm.priceYearly} onChange={(value) => setPlanForm({ ...planForm, priceYearly: value })} required type="number" />
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {planFeatures.map(([key, label]) => (
                  <label key={key} className="flex h-10 items-center justify-between border px-3 text-sm">
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(planForm.features[key])}
                      onChange={(event) => setPlanForm({
                        ...planForm,
                        features: { ...planForm.features, [key]: event.target.checked },
                      })}
                    />
                  </label>
                ))}
              </div>
              <label className="flex h-11 items-center justify-between border border-[#cbbcf5] bg-[#f7f3ff] px-3 text-sm">
                <span className="font-semibold text-[#6337d8]">Recommended plan</span>
                <input
                  type="checkbox"
                  checked={planForm.recommended}
                  onChange={(event) => setPlanForm({ ...planForm, recommended: event.target.checked })}
                />
              </label>
              <label className="flex h-11 items-center justify-between border px-3 text-sm">
                <span className="font-semibold">Active</span>
                <input
                  type="checkbox"
                  checked={planForm.active}
                  onChange={(event) => setPlanForm({ ...planForm, active: event.target.checked })}
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-11 rounded-none" onClick={closePlanModal}>
                Cancel
              </Button>
              <Button className="h-11 rounded-none bg-[#111] px-6 text-white" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : planForm.id ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </div>
      )}
      {loginAccessUser && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/55 p-3 sm:p-4">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-[760px] overflow-y-auto bg-white p-5 shadow-[0_30px_90px_rgba(0,0,0,.25)] sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b pb-5">
              <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#6337d8]">Secure login access</p><h2 className="mt-2 text-2xl font-semibold">{loginAccessUser.email}</h2><p className="mt-1 text-sm text-[#777]">Create access first, review the email, then send it manually.</p></div>
              <button type="button" onClick={() => { setLoginAccessUser(null); setLoginAccess(null); }} className="p-2 hover:bg-[#f3f3f3]" aria-label="Close login access"><X className="size-5" /></button>
            </div>

            <section className="mt-5 border border-[#e7e2ef] bg-[#faf9fc] p-4 sm:p-5">
              <div className="flex items-center gap-2"><Clock3 className="size-4 text-[#6337d8]" /><p className="font-bold">Choose how long this login stays valid</p></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                <Input type="number" min={1} max={loginValidityUnit === "days" ? 365 : 8760} value={loginValidityValue} onChange={(event) => setLoginValidityValue(event.target.value)} className="h-11 rounded-none bg-white" />
                <select value={loginValidityUnit} onChange={(event) => setLoginValidityUnit(event.target.value as LoginValidityUnit)} className="h-11 border bg-white px-3 text-sm"><option value="hours">Hours</option><option value="days">Days</option></select>
                <Button type="button" onClick={generateLoginAccess} disabled={pending} className="h-11 rounded-none bg-[#111] px-5 text-white hover:bg-[#222]">{pending ? <Loader2 className="size-4 animate-spin" /> : loginAccess ? "Regenerate access" : "Generate access"}</Button>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#777]">Examples: 19 hours, 1 day, 20 days. Maximum 365 days. Generating access does <b>not</b> send an email.</p>
            </section>

            {loginAccess && (
              <section className="mt-5 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => copyLoginValue("PIN", loginAccess.pin)} className="group border border-[#ddd5f2] bg-[#faf8ff] p-4 text-left transition hover:border-[#6337d8]">
                  <span className="flex items-center justify-between text-xs font-bold uppercase tracking-[.15em] text-[#777]">One-time PIN <Copy className="size-4 text-[#6337d8]" /></span><span className="mt-2 block text-3xl font-bold tracking-[.25em]">{loginAccess.pin}</span><span className="mt-2 block text-xs text-[#6337d8]">Click to copy</span>
                </button>
                <button type="button" onClick={() => copyLoginValue("Login link", loginAccess.link)} className="group min-w-0 border border-[#e1e1e1] bg-[#fafafa] p-4 text-left transition hover:border-[#6337d8]">
                  <span className="flex items-center justify-between text-xs font-bold uppercase tracking-[.15em] text-[#777]">Direct login link <Copy className="size-4 text-[#6337d8]" /></span><span className="mt-3 block truncate text-xs text-[#444]">{loginAccess.link}</span><span className="mt-2 block text-xs text-[#6337d8]">Click to copy full link</span>
                </button>
                <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 border px-4 py-3 text-sm"><span><b>Valid for {loginAccess.validity}</b> · expires {new Date(loginAccess.expiresAt).toLocaleString()}</span><Button type="button" variant="outline" className="h-9 rounded-none" onClick={() => copyLoginValue("All login details", `Email: ${loginAccess.email}\nPIN: ${loginAccess.pin}\nLogin link: ${loginAccess.link}\nExpires: ${new Date(loginAccess.expiresAt).toLocaleString()}`)}><Copy className="size-4" /> Copy all</Button></div>
              </section>
            )}

            <section className="mt-5 border-t pt-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">Login email</p><p className="mt-1 text-xs text-[#777]">Edit the subject and message before sending. Nothing is sent automatically.</p></div><Button type="button" variant="outline" className="h-9 rounded-none" onClick={() => { setLoginEmailSubject(defaultLoginEmailSubject); setLoginEmailMessage(defaultLoginEmailMessage); }}>Reset email</Button></div>
              <div className="mt-4 grid gap-4">
                <InputField label="Email subject" value={loginEmailSubject} onChange={setLoginEmailSubject} />
                <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Email message</span><Textarea value={loginEmailMessage} onChange={(event) => setLoginEmailMessage(event.target.value)} className="min-h-[220px] rounded-none border-[#ddd] bg-white text-sm leading-6" /></label>
                <p className="text-xs leading-5 text-[#777]">Available placeholders: <code>{"{{name}}"}</code>, <code>{"{{email}}"}</code>, <code>{"{{pin}}"}</code>, <code>{"{{link}}"}</code>, <code>{"{{expiresAt}}"}</code>.</p>
              </div>
              {loginSendStatus && <p className={cn("mt-4 text-sm font-semibold", loginSendStatus.sent ? "text-emerald-700" : "text-amber-700")}>{loginSendStatus.sent ? "Email sent successfully." : `SMTP did not send the email${loginSendStatus.reason ? `: ${loginSendStatus.reason}` : "."}`}</p>}
              <div className="mt-5 flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" className="rounded-none" onClick={() => { setLoginAccessUser(null); setLoginAccess(null); }}>Close</Button><Button type="button" onClick={sendLoginAccessEmail} disabled={pending || !loginAccess || !loginEmailSubject.trim() || !loginEmailMessage.trim()} className="rounded-none bg-[#6337d8] px-6 text-white hover:bg-[#5430bd]">{pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send email</Button></div>
            </section>
          </div>
        </div>
      )}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>{confirmMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmAction?.()}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function navClass(active: boolean) {
  return cn(
    "flex h-11 items-center gap-3 px-3 text-left text-sm font-bold",
    active ? "bg-[#6337d8] text-white" : "text-[#555] hover:bg-[#f3efff] hover:text-[#6337d8]",
  );
}

function AdminNav({ tab, setTab }: { tab: AdminTab; setTab: (tab: AdminTab) => void }) {
  const items: { id: AdminTab; label: string; icon: ComponentType<{ className?: string }> }[] = [
    { id: "overview", label: "Dashboard", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users },
    { id: "collections", label: "Collections", icon: Images },
    { id: "plans", label: "Plans", icon: Package },
    { id: "free-plan", label: "Free Plan", icon: HardDrive },
    { id: "stripe", label: "Stripe", icon: ShieldCheck },
    { id: "vip-support", label: "VIP Support", icon: MessageCircle },
    { id: "cms", label: "Homepage Editor", icon: FileImage },
    { id: "seo", label: "SEO", icon: Search },
    { id: "terms", label: "Terms of Service", icon: FileText },
    { id: "privacy", label: "Privacy Policy", icon: ShieldCheck },
  ];

  return (
    <nav className="mt-10 grid gap-2">
      {items.map((item) => (
        <button key={item.id} className={navClass(tab === item.id)} onClick={() => setTab(item.id)}>
          <item.icon className="size-4" />
          {item.label}
        </button>
      ))}
      <div className="my-2 border-t" />
      <Link href="/admin/cover-templates" className={navClass(false)}><FileImage className="size-4" />Cover Templates</Link>
      <Link href="/admin/default-products" className={navClass(false)}><ShoppingBag className="size-4" />Default Products</Link>
      <Link href="/admin/blogs" className={navClass(false)}><Newspaper className="size-4" />Blog Posts</Link>
    </nav>
  );
}

function Stat({ label, value, money }: { label: string; value: number; money?: boolean }) {
  return (
    <div className="min-w-0 bg-white px-3 py-3 text-right md:min-w-24 md:px-4">
      <p className="truncate text-lg font-semibold md:text-xl">{money ? `$${value.toLocaleString()}` : value.toLocaleString()}</p>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#777]">{label}</p>
    </div>
  );
}

function InputField({ label, value, onChange, required, type = "text" }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#777]">{label}</span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        className="h-11 rounded-none border-[#ddd] shadow-none focus-visible:ring-[#6337d8]"
      />
    </label>
  );
}

function UserTable({ users, onView, onEdit, onImpersonate, onSendLogin, onDelete, busy }: {
  users: AdminUser[];
  onView: (user: AdminUser) => void;
  onEdit: (user: AdminUser) => void;
  onImpersonate: (user: AdminUser) => void;
  onSendLogin: (user: AdminUser) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  return (
    <div className="overflow-x-auto bg-white">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="border-b text-left text-xs uppercase tracking-[0.14em] text-[#777]">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Login</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Collections</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user._id} className="border-b last:border-0">
              <td className="px-4 py-4">
                <p className="font-bold">{user.name}</p>
                <p className="mt-1 text-xs text-[#777]">{user.email || "No email"}</p>
              </td>
              <td className="px-4 py-4">{user.phoneNumber}</td>
              <td className="px-4 py-4 capitalize">{user.role}</td>
              <td className="px-4 py-4">{user.planName ?? "Free"}</td>
              <td className="px-4 py-4">{user.collectionCount ?? 0}</td>
              <td className="px-4 py-4">
                <div className="flex justify-end gap-2">
                  <button className="p-2 text-[#6337d8] hover:bg-[#f3efff]" onClick={() => onView(user)} disabled={busy} aria-label="View user details" title="View details">
                    <Users className="size-4" />
                  </button>
                  {user.role !== "admin" && (
                    <button className="p-2 text-[#6337d8] hover:bg-[#f3efff]" onClick={() => onImpersonate(user)} disabled={busy} aria-label="Sign in as user" title="Sign in as user">
                      <ExternalLink className="size-4" />
                    </button>
                  )}
                  {user.role !== "admin" && user.email && (
                    <button className="p-2 text-[#6337d8] hover:bg-[#f3efff]" onClick={() => onSendLogin(user)} disabled={busy} aria-label="Create secure login access" title="Create PIN + login link">
                      <Mail className="size-4" />
                    </button>
                  )}
                  <button className="p-2 hover:bg-[#f3f3f3]" onClick={() => onEdit(user)} disabled={busy} aria-label="Edit user">
                    <Edit3 className="size-4" />
                  </button>
                  <button className="p-2 text-red-600 hover:bg-red-50" onClick={() => onDelete(user._id)} disabled={busy} aria-label="Delete user">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminOverview({ data }: { data: AdminDashboardData }) {
  const stats = data.stats;
  const monthly = stats.monthly ?? [];
  const planMix = stats.planMix?.length ? stats.planMix : [{ name: "No plans", value: 1 }];
  const recentUsers = stats.recentUsers ?? data.users.slice(0, 6);
  const chartColors = ["#6337d8", "#111111", "#9ca3af", "#d6b86a", "#ec6f58", "#6b8afd"];

  return (
    <div className="mt-6 grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={Users} label="Total users" value={stats.users} />
        <MetricCard icon={Images} label="Collections" value={stats.collections} />
        <MetricCard icon={FileImage} label="Images" value={stats.images} />
        <MetricCard icon={ShoppingBag} label="Orders" value={stats.orders ?? 0} />
        <MetricCard icon={Euro} label="Revenue" value={`€${Number(stats.revenue ?? 0).toLocaleString()}`} strong />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="bg-white p-6">
          <div className="mb-5 flex items-end justify-between gap-4 border-b pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0a9c8b]">Revenue</p>
              <h2 className="mt-2 text-xl font-semibold">Orders and revenue</h2>
            </div>
            <p className="text-sm font-semibold text-[#777]">Last 6 months</p>
          </div>
          <div className="h-[320px] min-h-[320px] min-w-0">
            <ResponsiveContainer width="100%" height={320} minWidth={280}>
              <ComposedChart data={monthly}>
                <CartesianGrid stroke="#eee" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={(value, name) => name === "revenue" ? [`€${Number(value).toLocaleString()}`, "Revenue"] : [value, "Orders"]} />
                <Bar dataKey="revenue" fill="#6337d8" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="orders" stroke="#111" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6">
          <div className="mb-5 border-b pb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0a9c8b]">Plans</p>
            <h2 className="mt-2 text-xl font-semibold">User plan mix</h2>
          </div>
          <div className="h-[270px] min-h-[270px] min-w-0">
            <ResponsiveContainer width="100%" height={270} minWidth={240}>
              <PieChart>
                <Pie data={planMix} dataKey="value" nameKey="name" innerRadius={58} outerRadius={100} paddingAngle={3}>
                  {planMix.map((item, index) => (
                    <Cell key={item.name} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-2">
            {planMix.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><span className="size-2" style={{ backgroundColor: chartColors[index % chartColors.length] }} />{item.name}</span>
                <b>{item.value}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="bg-white p-6">
          <div className="mb-5 border-b pb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0a9c8b]">Growth</p>
            <h2 className="mt-2 text-xl font-semibold">New users</h2>
          </div>
          <div className="h-[260px] min-h-[260px] min-w-0">
            <ResponsiveContainer width="100%" height={260} minWidth={240}>
              <LineChart data={monthly}>
                <CartesianGrid stroke="#eee" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="users" stroke="#6337d8" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="overflow-x-auto bg-white p-6">
          <div className="mb-5 border-b pb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0a9c8b]">Latest</p>
            <h2 className="mt-2 text-xl font-semibold">Recent users</h2>
          </div>
          <table className="w-full min-w-[620px] text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.14em] text-[#777]">
              <tr>
                <th className="py-3">User</th>
                <th className="py-3">Role</th>
                <th className="py-3">Plan</th>
                <th className="py-3 text-right">Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((user) => (
                <tr key={user._id} className="border-t">
                  <td className="py-4">
                    <p className="font-bold">{user.name || "Unnamed"}</p>
                    <p className="mt-1 text-xs text-[#777]">{user.email || user.phoneNumber}</p>
                  </td>
                  <td className="py-4 capitalize">{user.role}</td>
                  <td className="py-4">{user.planName ?? "Free"}</td>
                  <td className="py-4 text-right">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, strong }: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  strong?: boolean;
}) {
  return (
    <div className={cn("bg-white p-5", strong && "bg-[#141715] text-white")}>
      <div className="flex items-center justify-between gap-4">
        <p className={cn("text-xs font-bold uppercase tracking-[0.16em]", strong ? "text-white/60" : "text-[#777]")}>{label}</p>
        <Icon className={cn("size-5", strong ? "text-[#6337d8]" : "text-[#0a9c8b]")} />
      </div>
      <p className="mt-5 text-3xl font-semibold">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}

function CollectionTable({ collections, onEdit, onDelete, busy }: {
  collections: AdminCollection[];
  onEdit: (collection: AdminCollection) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  return (
    <div className="mt-6 overflow-x-auto bg-white">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b text-left text-xs uppercase tracking-[0.14em] text-[#777]">
          <tr>
            <th className="px-4 py-3">Collection</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Images</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {collections.map((collection) => (
            <tr key={collection._id} className="border-b last:border-0">
              <td className="px-4 py-4">
                <p className="font-bold">{collection.name}</p>
                <p className="mt-1 text-xs text-[#777]">{collection.slug || collection._id}</p>
              </td>
              <td className="px-4 py-4">
                <p>{collection.user?.name ?? "Unknown"}</p>
                <p className="mt-1 text-xs text-[#777]">{collection.user?.email || collection.user?.phoneNumber}</p>
              </td>
              <td className="px-4 py-4">{collection.imageCount ?? 0}</td>
              <td className="px-4 py-4 capitalize">{collection.status ?? "draft"}</td>
              <td className="px-4 py-4 text-right">
                <div className="flex justify-end gap-2">
                  <button className="p-2 text-[#6337d8] hover:bg-[#f3efff]" onClick={() => onEdit(collection)} disabled={busy} aria-label="Edit collection" title="Edit collection">
                    <Edit3 className="size-4" />
                  </button>
                  <button className="p-2 text-red-600 hover:bg-red-50" onClick={() => onDelete(collection._id)} disabled={busy} aria-label="Delete collection">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FreePlanSettingsPanel({ form, setForm, onSave, busy }: {
  form: AdminFreePlanSetting;
  setForm: (value: AdminFreePlanSetting) => void;
  onSave: () => void;
  busy: boolean;
}) {
  return (
    <Card className="mt-6 max-w-[760px]">
      <CardHeader className="border-b">
        <CardTitle className="text-xl">Free user allowance</CardTitle>
        <CardDescription>
          One global limit for every free account. Saving also updates existing free users.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="grid gap-4 md:grid-cols-2">
          <Field className="border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <HardDrive className="size-5 text-primary" />
              <FieldLabel htmlFor="free-storage">Storage per user</FieldLabel>
            </div>
            <Input
              id="free-storage"
              type="number"
              min={0}
              max={1000000}
              step="0.01"
              value={form.storageGb}
              onChange={(event) => setForm({ ...form, storageGb: Math.max(0, Number(event.target.value)) })}
            />
            <FieldDescription>GB available to each free user. Use 0 to disable uploads.</FieldDescription>
          </Field>
          <Field className="border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <Mail className="size-5 text-primary" />
              <FieldLabel htmlFor="free-emails">Monthly emails per user</FieldLabel>
            </div>
            <Input
              id="free-emails"
              type="number"
              min={0}
              max={1000000000}
              step="1"
              value={form.monthlyEmails}
              onChange={(event) => setForm({ ...form, monthlyEmails: Math.max(0, Math.floor(Number(event.target.value))) })}
            />
            <FieldDescription>Email quota resets monthly. Use 0 to disable marketing email.</FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-between gap-4">
        <p className="text-sm text-muted-foreground">Paid plan limits stay unchanged.</p>
        <Button onClick={onSave} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          Save free plan
        </Button>
      </CardFooter>
    </Card>
  );
}

function StripeSettingsPanel({ form, setForm }: {
  form: AdminStripeSetting;
  setForm: (value: AdminStripeSetting) => void;
}) {
  return (
    <div className="mt-6 max-w-[760px] bg-white p-5 sm:p-6">
      <div className="border-b pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777]">Stripe</p>
        <h2 className="mt-2 text-xl font-semibold">Plan checkout settings</h2>
        <p className="mt-2 text-sm text-[#666]">
          Webhook endpoint: `/billing/stripe/webhook`
        </p>
      </div>
      <div className="mt-5 grid gap-4">
        <label className="flex h-11 items-center justify-between border px-3 text-sm">
          <span className="font-semibold">Enable Stripe</span>
          <input
            type="checkbox"
            checked={Boolean(form.enabled)}
            onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
          />
        </label>
        <InputField label="Publishable key" value={form.publishableKey ?? ""} onChange={(publishableKey) => setForm({ ...form, publishableKey })} />
        <InputField
          label={form.hasSecretKey ? "Secret key saved - enter new key to replace" : "Secret key"}
          value={form.secretKey && form.secretKey !== "********" ? form.secretKey : ""}
          onChange={(secretKey) => setForm({ ...form, secretKey })}
          type="password"
        />
        <InputField
          label={form.hasWebhookSecret ? "Webhook secret saved - optional, enter new secret to replace" : "Webhook secret (optional)"}
          value={form.webhookSecret && form.webhookSecret !== "********" ? form.webhookSecret : ""}
          onChange={(webhookSecret) => setForm({ ...form, webhookSecret })}
          type="password"
        />
      </div>
    </div>
  );
}

function LegalCmsPanel({ type, form, lang, setForm, setLang, onSave, saveState, busy }: {
  type: "terms" | "privacy";
  form: HomeCmsData;
  lang: HomeLanguage;
  setForm: (value: HomeCmsData) => void;
  setLang: (value: HomeLanguage) => void;
  onSave: () => void;
  saveState: "saved" | "unsaved" | "saving" | "error";
  busy: boolean;
}) {
  const page = form.legal[lang][type];
  const update = (value: Partial<typeof page>) => setForm({ ...form, legal: { ...form.legal, [lang]: { ...form.legal[lang], [type]: { ...page, ...value } } } });
  const previewHref = `${type === "terms" ? "/terms-of-service" : "/privacy-policy"}?lang=${lang}`;
  return <div className="mt-6 overflow-hidden border border-[#dfe5e2] bg-white shadow-[0_18px_55px_rgba(18,38,32,.07)]"><header className="border-b bg-[#f7faf8] px-5 py-6 md:px-8"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#079c8a]">Public legal page</p><h2 className="mt-2 text-3xl font-semibold">{type === "terms" ? "Terms of Service" : "Privacy Policy"}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#68726e]">Edit title and fully formatted page content.</p></div><div className="flex gap-2"><a href={previewHref} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 border bg-white px-4 text-sm font-bold">Preview <ExternalLink className="size-4" /></a><Button onClick={onSave} disabled={busy} className="h-10 rounded-none bg-[#111] px-5 text-white">Save now</Button></div></div></header><div className="grid md:grid-cols-[210px_1fr]"><aside className="border-b bg-[#fbfbfa] p-5 md:border-b-0 md:border-r"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#888]">Language</p><div className="mt-4 grid gap-2">{(["en", "gr"] as HomeLanguage[]).map((value) => <button key={value} onClick={() => setLang(value)} className={cn("flex h-11 items-center justify-between px-4 text-left text-sm font-bold", lang === value ? "bg-[#6337d8] text-white hover:bg-[#5430bd]" : "border bg-white text-[#555]")}>{value === "en" ? "English" : "Greek"}<span>{value.toUpperCase()}</span></button>)}</div><div className={cn("mt-6 px-3 py-3 text-xs font-bold", saveState === "error" ? "bg-red-50 text-red-700" : saveState === "saved" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800")}>{saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved changes" : saveState === "error" ? "Save failed" : "Saved · Live"}</div></aside><section className="p-5 md:p-8"><label className="grid gap-2"><span className="text-sm font-bold">Page title</span><Input value={page.title} onChange={(event) => update({ title: event.target.value })} className="h-13 rounded-none border-[#ccd5d1] px-4 text-lg shadow-none" /></label><div className="mt-7 grid gap-2"><span className="text-sm font-bold">Page content</span><RichTextEditor key={`${type}-${lang}`} value={page.content} onChange={(content) => update({ content })} /></div></section></div></div>;
}

function RichTextEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initialHtml = /<\/?[a-z][\s\S]*>/i.test(value) ? value : value.split(/\n{2,}/).map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`).join("");
  const command = (name: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? "");
  };
  return <div className="border border-[#ccd5d1] bg-white"><div className="flex flex-wrap gap-1 border-b bg-[#f7f7f4] p-2">{[["bold", "Bold"], ["italic", "Italic"], ["underline", "Underline"], ["insertUnorderedList", "Bullets"], ["insertOrderedList", "Numbers"], ["formatBlock", "Heading", "h2"], ["formatBlock", "Paragraph", "p"]].map(([name, label, commandValue]) => <button key={`${name}-${label}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command(name, commandValue)} className="border bg-white px-3 py-2 text-xs font-bold hover:bg-[#e9efec]">{label}</button>)}<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { const url = window.prompt("Link URL"); if (url) command("createLink", url); }} className="border bg-white px-3 py-2 text-xs font-bold hover:bg-[#e9efec]">Link</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("removeFormat")} className="border bg-white px-3 py-2 text-xs font-bold hover:bg-[#e9efec]">Clear format</button></div><div ref={editorRef} contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: initialHtml }} onInput={(event) => onChange(event.currentTarget.innerHTML)} className="min-h-[520px] p-5 text-base leading-8 outline-none [&_a]:text-[#087f70] [&_a]:underline [&_h2]:mb-4 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_li]:ml-6 [&_ol]:list-decimal [&_p]:my-4 [&_ul]:list-disc" /></div>;
}

function SeoCmsPanel({
  form,
  setForm,
  onUpload,
  onSave,
  saveState,
  busy,
}: {
  form: HomeCmsData;
  setForm: (value: HomeCmsData) => void;
  onUpload: (file: File) => Promise<string>;
  onSave: () => void;
  saveState: "saved" | "saving" | "unsaved" | "error";
  busy: boolean;
}) {
  const seo = form.seo;
  const patchSeo = (value: Partial<HomeCmsData["seo"]>) =>
    setForm({ ...form, seo: { ...seo, ...value } });
  const addMeta = () => patchSeo({ extraMetaTags: [...seo.extraMetaTags, { type: "name", key: "", value: "" }] });
  const updateMeta = (index: number, value: Partial<SeoMetaTag>) => {
    const tags = [...seo.extraMetaTags];
    tags[index] = { ...tags[index], ...value };
    patchSeo({ extraMetaTags: tags });
  };
  const removeMeta = (index: number) => patchSeo({ extraMetaTags: seo.extraMetaTags.filter((_, i) => i !== index) });

  return (
    <div className="mt-6 grid gap-5">
      <div className="sticky top-0 z-20 border border-[#dfe5e2] bg-[#12201c] p-5 text-white shadow-[0_14px_35px_rgba(0,0,0,.12)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-white/60">Search & Social</p><h2 className="mt-1 text-2xl font-semibold">Homepage SEO</h2></div>
          <div className="flex items-center gap-3"><span className="text-xs text-white/65">{saveState === "saving" ? "Saving" : saveState === "unsaved" ? "Unsaved changes" : saveState === "error" ? "Save failed" : "Saved"}</span><Button type="button" onClick={onSave} disabled={busy} className="h-10 rounded-none bg-[#6337d8] px-6 text-white hover:bg-[#19a995]">Save SEO</Button></div>
        </div>
      </div>

      <CmsSection eyebrow="SEO 1" title="Homepage search result" defaultOpen>
        <div className="grid gap-5 lg:grid-cols-2">
          <CmsRepeater title="Main metadata">
            <CmsInput label="Homepage title" value={seo.siteTitle} onChange={(siteTitle) => patchSeo({ siteTitle })} />
            <CmsTextarea label="Meta description" value={seo.siteDescription} onChange={(siteDescription) => patchSeo({ siteDescription })} />
            <CmsTextarea label="Keywords — separate with commas" value={seo.siteKeywords} onChange={(siteKeywords) => patchSeo({ siteKeywords })} />
            <CmsInput label="Canonical homepage URL" value={seo.siteCanonicalUrl} onChange={(siteCanonicalUrl) => patchSeo({ siteCanonicalUrl })} />
            <CmsInput label="Robots directive" value={seo.robots} onChange={(robots) => patchSeo({ robots })} />
          </CmsRepeater>
          <CmsRepeater title="Search preview">
            <div className="rounded-lg border bg-white p-5"><p className="text-sm text-[#237804]">{seo.siteCanonicalUrl || "https://gallerista.app"}</p><h3 className="mt-1 text-xl text-[#1a0dab]">{seo.siteTitle || "Homepage title"}</h3><p className="mt-2 text-sm leading-6 text-[#4d5156]">{seo.siteDescription || "Your homepage description will appear here."}</p></div>
          </CmsRepeater>
        </div>
      </CmsSection>

      <CmsSection eyebrow="SEO 2" title="Social media sharing">
        <div className="grid gap-5 lg:grid-cols-2">
          <CmsRepeater title="Open Graph and social image">
            <CmsImageInput label="Social share image — recommended 1200 × 630 px" value={seo.siteImageUrl} onChange={(siteImageUrl) => patchSeo({ siteImageUrl })} onUpload={onUpload} busy={busy} />
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Twitter card type</span><select value={seo.twitterCard} onChange={(event) => patchSeo({ twitterCard: event.target.value })} className="h-11 border px-3 text-sm"><option value="summary_large_image">Large image</option><option value="summary">Summary</option></select></label>
            <p className="text-xs leading-5 text-[#777]">The homepage title, description and social image are used for Facebook, LinkedIn, X/Twitter, WhatsApp and other link previews.</p>
          </CmsRepeater>
          <CmsRepeater title="Website icon">
            <CmsImageInput label="Custom favicon — recommended square PNG/SVG, 512 × 512 px" value={seo.faviconUrl} onChange={(faviconUrl) => patchSeo({ faviconUrl })} onUpload={onUpload} busy={busy} />
            <p className="text-xs leading-5 text-[#777]">When this field is empty, the brand logo uploaded in the Homepage Editor is automatically used as the website icon, browser tab icon and app icon.</p>
          </CmsRepeater>
        </div>
      </CmsSection>

      <CmsSection eyebrow="SEO 3" title="Analytics and structured data">
        <div className="grid gap-5 lg:grid-cols-2">
          <CmsRepeater title="Tracking">
            <CmsInput label="Google Tag Manager ID" value={seo.googleTagManagerId} onChange={(googleTagManagerId) => patchSeo({ googleTagManagerId })} />
            <CmsTextarea label="JSON-LD structured data" value={seo.jsonLd} onChange={(jsonLd) => patchSeo({ jsonLd })} />
          </CmsRepeater>
          <CmsRepeater title="Login and registration SEO">
            <CmsInput label="Login page title" value={seo.loginTitle} onChange={(loginTitle) => patchSeo({ loginTitle })} />
            <CmsTextarea label="Login description" value={seo.loginDescription} onChange={(loginDescription) => patchSeo({ loginDescription })} />
            <CmsInput label="Login keywords" value={seo.loginKeywords} onChange={(loginKeywords) => patchSeo({ loginKeywords })} />
            <CmsInput label="Registration page title" value={seo.registerTitle} onChange={(registerTitle) => patchSeo({ registerTitle })} />
            <CmsTextarea label="Registration description" value={seo.registerDescription} onChange={(registerDescription) => patchSeo({ registerDescription })} />
            <CmsInput label="Registration keywords" value={seo.registerKeywords} onChange={(registerKeywords) => patchSeo({ registerKeywords })} />
          </CmsRepeater>
        </div>
      </CmsSection>

      <CmsSection eyebrow="SEO 4" title="Custom meta tags">
        <CmsRepeater title="Advanced tags">
          {seo.extraMetaTags.map((tag, index) => <div key={index} className="grid gap-3 border p-4 lg:grid-cols-[150px_1fr_1fr_auto]"><select value={tag.type} onChange={(event) => updateMeta(index, { type: event.target.value as SeoMetaTag["type"] })} className="h-11 border px-3 text-sm"><option value="name">name</option><option value="property">property</option><option value="httpEquiv">httpEquiv</option></select><CmsInput label="Meta key" value={tag.key} onChange={(key) => updateMeta(index, { key })} /><CmsInput label="Meta value" value={tag.value} onChange={(value) => updateMeta(index, { value })} /><Button type="button" variant="outline" className="mt-6 h-11 rounded-none" onClick={() => removeMeta(index)}><Trash2 className="size-4" /></Button></div>)}
          <Button type="button" className="w-fit rounded-none bg-[#6337d8] text-white hover:bg-[#5430bd]" onClick={addMeta}><PlusCircle className="size-4" /> Add meta tag</Button>
        </CmsRepeater>
      </CmsSection>
    </div>
  );
}

function HomeCmsPanel({ form, lang, setForm, setLang, onUpload, onHeroUpload, onSave, saveState, busy }: {
  form: HomeCmsData;
  lang: HomeLanguage;
  setForm: (value: HomeCmsData) => void;
  setLang: (value: HomeLanguage) => void;
  onUpload: (file: File) => Promise<string>;
  onHeroUpload: (file: File) => void;
  onSave: () => void;
  saveState: "saved" | "unsaved" | "saving" | "error";
  busy: boolean;
}) {
  const safeForm = mergeHomeCms(form);
  const content = safeForm.content[lang] ?? safeForm.content.en;

  const setContent = (next: HomeContent) => setForm({ ...safeForm, content: { ...safeForm.content, [lang]: next } });
  const patch = <K extends keyof HomeContent>(key: K, value: HomeContent[K]) => setContent({ ...content, [key]: value });
  const patchObject = <K extends keyof HomeContent>(key: K, value: Partial<HomeContent[K]>) => patch(key, { ...(content[key] as object), ...value } as HomeContent[K]);
  const patchFeature = (index: number, value: Partial<FeatureCard>) => {
    const items = [...content.featureCards];
    items[index] = { ...items[index], ...value };
    patch("featureCards", items);
  };
  const patchGalleryImage = (index: number, value: Partial<GalleryTab>) => {
    const tabs = [...content.gallery.tabs];
    tabs[index] = { ...tabs[index], ...value };
    patchObject("gallery", { tabs });
  };
  const patchWorkflowImage = (index: number, value: Partial<GalleryTab>) => {
    const tabs = [...content.workflow.tabs];
    tabs[index] = { ...tabs[index], ...value };
    patchObject("workflow", { tabs });
  };
  const patchClientGalleryTab = (index: number, value: Partial<GalleryTab>) => {
    const tabs = [...content.clientGallery.tabs];
    tabs[index] = { ...tabs[index], ...value };
    patchObject("clientGallery", { tabs });
  };
  const patchPhotographerTypeTab = (index: number, value: Partial<GalleryTab>) => {
    const tabs = [...content.photographerTypes.tabs];
    tabs[index] = { ...tabs[index], ...value };
    patchObject("photographerTypes", { tabs });
  };
  const patchBrandLogo = (index: number, value: Partial<BrandLogo>) => {
    const logos = [...content.brandLogos];
    logos[index] = { ...logos[index], ...value };
    patch("brandLogos", logos);
  };
  const patchMarqueeItem = (index: number, value: Partial<HomeMarqueeItem>) => {
    const items = [...content.marquee.items];
    items[index] = { ...items[index], ...value };
    patchObject("marquee", { items });
  };
  const patchFooterColumn = (index: number, value: Partial<HomeContent["footer"]["columns"][number]>) => {
    const columns = [...content.footer.columns];
    columns[index] = { ...columns[index], ...value };
    patchObject("footer", { columns });
  };
  const patchFooterLink = (columnIndex: number, linkIndex: number, value: Partial<{ label: string; url: string }>) => {
    const column = content.footer.columns[columnIndex];
    const links = column.links.map((link) => typeof link === "string" ? { label: link, url: "" } : link);
    links[linkIndex] = { ...links[linkIndex], ...value };
    patchFooterColumn(columnIndex, { links });
  };

  return (
    <div className="mt-6 grid gap-5">
      <div className="sticky top-0 z-20 border border-[#dfe5e2] bg-[#12201c] p-5 text-white shadow-[0_14px_35px_rgba(18,38,32,.18)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#5ce0cd]">Homepage CMS</p>
            <h2 className="mt-1 text-2xl font-semibold">Eight homepage sections</h2>
            <p className="mt-1 text-sm text-white/65">Edit the fields below and press Save now. These values are used directly on the public homepage.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-white/10 p-1">
              {(["en", "gr"] as HomeLanguage[]).map((value) => <Button key={value} type="button" onClick={() => { setLang(value); if (safeForm.defaultLanguage !== value) setForm({ ...safeForm, defaultLanguage: value }); }} className={cn("h-9 rounded-none px-4 shadow-none", lang === value ? "bg-white text-[#111] hover:bg-white" : "bg-transparent text-white hover:bg-white/10")}>{value.toUpperCase()}</Button>)}
            </div>
            <span className={cn("inline-flex h-10 items-center gap-2 px-3 text-xs font-bold", saveState === "error" ? "bg-red-50 text-red-700" : saveState === "saved" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800")}>
              {saveState === "saving" && <Loader2 className="size-3.5 animate-spin" />}
              {saveState === "saved" && <Check className="size-3.5" />}
              {saveState === "saving" ? "Saving" : saveState === "unsaved" ? "Unsaved changes" : saveState === "error" ? "Save failed" : "Saved"}
            </span>
            <Button type="button" onClick={onSave} disabled={busy} className="h-10 rounded-none bg-[#6337d8] px-6 text-white hover:bg-[#19a995]">Save now</Button>
          </div>
        </div>
      </div>

      <CmsSection eyebrow="Section 1" title="Header, brand, login and registration" defaultOpen>
        <div className="grid gap-5 lg:grid-cols-2">
          <CmsRepeater title="Brand and navbar">
            <CmsInput label="Brand text (used only when no logo is uploaded)" value={safeForm.brand.brandText} onChange={(brandText) => setForm({ ...safeForm, brand: { ...safeForm.brand, brandText, logoUrl: brandText.trim() ? "" : safeForm.brand.logoUrl }, auth: { ...safeForm.auth, brand: brandText } })} />
            <CmsImageInput label="Brand logo — recommended 440 × 88 px, transparent PNG/SVG" value={safeForm.brand.logoUrl} onChange={(logoUrl) => setForm({ ...safeForm, brand: { ...safeForm.brand, logoUrl, brandText: logoUrl.trim() ? "" : safeForm.brand.brandText }, auth: { ...safeForm.auth, brand: logoUrl.trim() ? "" : safeForm.auth.brand } })} onUpload={onUpload} busy={busy} />
            <CmsInput label="Products label" value={content.nav.products} onChange={(products) => patchObject("nav", { products })} />
            <CmsInput label="Pricing label" value={content.nav.pricing} onChange={(pricing) => patchObject("nav", { pricing })} />
            <CmsInput label="Login label" value={content.nav.login} onChange={(login) => patchObject("nav", { login })} />
            <CmsInput label="Top button label" value={content.nav.cta} onChange={(cta) => patchObject("nav", { cta })} />
          </CmsRepeater>
          <CmsRepeater title="Login and registration">
            <CmsInput label="Login heading" value={safeForm.auth.loginTitle} onChange={(loginTitle) => setForm({ ...safeForm, auth: { ...safeForm.auth, loginTitle } })} />
            <CmsTextarea label="Login description" value={safeForm.auth.loginSubtitle} onChange={(loginSubtitle) => setForm({ ...safeForm, auth: { ...safeForm.auth, loginSubtitle } })} />
            <CmsImageInput label="Login image" value={safeForm.auth.loginImageUrl} onChange={(loginImageUrl) => setForm({ ...safeForm, auth: { ...safeForm.auth, loginImageUrl } })} onUpload={onUpload} busy={busy} />
            <CmsInput label="Registration heading" value={safeForm.auth.registerTitle} onChange={(registerTitle) => setForm({ ...safeForm, auth: { ...safeForm.auth, registerTitle } })} />
            <CmsTextarea label="Registration description" value={safeForm.auth.registerSubtitle} onChange={(registerSubtitle) => setForm({ ...safeForm, auth: { ...safeForm.auth, registerSubtitle } })} />
            <CmsImageInput label="Registration image" value={safeForm.auth.registerImageUrl} onChange={(registerImageUrl) => setForm({ ...safeForm, auth: { ...safeForm.auth, registerImageUrl } })} onUpload={onUpload} busy={busy} />
          </CmsRepeater>
        </div>
      </CmsSection>

      <CmsSection eyebrow="Section 2" title="Hero section" defaultOpen>
        <div className="grid gap-5 lg:grid-cols-2">
          <CmsRepeater title="Hero text">
            <CmsInput label="Top badge" value={content.hero.eyebrow} onChange={(eyebrow) => patchObject("hero", { eyebrow })} />
            <CmsHeroHeadingEditor label="Hero heading" value={content.hero.title} onChange={(title) => patchObject("hero", { title })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <CmsNumberInput
                label={`Hero title size (px) — ${lang.toUpperCase()}`}
                value={content.hero.titleFontSizePx ?? 46}
                min={24}
                max={96}
                onCommit={(value) => patchObject("hero", { titleFontSizePx: value })}
              />
              <CmsNumberInput
                label={`Description size (px) — ${lang.toUpperCase()}`}
                value={content.hero.subtitleFontSizePx ?? 16}
                min={12}
                max={40}
                onCommit={(value) => patchObject("hero", { subtitleFontSizePx: value })}
              />
            </div>
            <CmsTextarea label="Description (normal paragraph text)" value={content.hero.subtitle} onChange={(subtitle) => patchObject("hero", { subtitle })} />
            <CmsInput label="Primary button" value={content.hero.cta} onChange={(cta) => patchObject("hero", { cta })} />
            <CmsInput label="Secondary button" value={content.hero.secondaryCta} onChange={(secondaryCta) => patchObject("hero", { secondaryCta })} />
            <CmsInput label="Video URL (YouTube, Vimeo, or direct MP4/WebM)" value={content.hero.videoUrl} onChange={(videoUrl) => patchObject("hero", { videoUrl })} />
            <CmsInput label="Review text" value={content.hero.ratingText} onChange={(ratingText) => patchObject("hero", { ratingText })} />
          </CmsRepeater>
          <CmsRepeater title="Hero media">
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Media type</span><select value={safeForm.media.heroMediaType} onChange={(event) => setForm({ ...safeForm, media: { ...safeForm.media, heroMediaType: event.target.value as "image" | "video" } })} className="h-11 border bg-[#fbfbfa] px-3 text-sm"><option value="image">Image</option><option value="video">Video</option></select></label>
            <CmsInput label="Image or video URL" value={safeForm.media.heroMediaUrl} onChange={(heroMediaUrl) => setForm({ ...safeForm, media: { ...safeForm.media, heroMediaUrl } })} />
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Upload hero media</span><Input type="file" accept="image/*,video/*" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) onHeroUpload(file); }} className="h-11 rounded-none border-[#ddd] bg-[#fbfbfa] pt-2" /></label>
            <div className="mt-2 grid gap-3">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Reviewer avatars</p>
              {(content.hero.avatarImages ?? []).map((avatar, index) => (
                <CmsImageInput key={index} label={`Avatar ${index + 1}`} value={avatar} onChange={(value) => { const avatarImages = [...(content.hero.avatarImages ?? [])]; avatarImages[index] = value; patchObject("hero", { avatarImages }); }} onUpload={onUpload} busy={busy} />
              ))}
              <Button type="button" className="w-fit rounded-none bg-[#6337d8] text-white hover:bg-[#5430bd]" onClick={() => patchObject("hero", { avatarImages: [...(content.hero.avatarImages ?? []), ""] })}><PlusCircle className="size-4" /> Add avatar</Button>
            </div>
          </CmsRepeater>
        </div>
      </CmsSection>

      <CmsSection eyebrow="Hero add-on" title="Single-line marquee under hero" defaultOpen>
        <CmsRepeater title="Marquee content — text, images/GIFs, logos and videos can be mixed">
          <label className="flex items-center justify-between border bg-white px-4 py-3 text-sm font-semibold"><span>Show marquee</span><input type="checkbox" checked={content.marquee.enabled} onChange={(event) => patchObject("marquee", { enabled: event.target.checked })} /></label>
          <CmsNumberInput label="Scroll duration (seconds)" value={content.marquee.durationSeconds} min={8} max={120} onCommit={(durationSeconds) => patchObject("marquee", { durationSeconds })} />
          {content.marquee.items.map((item, index) => (
            <div key={item.id || index} className="grid gap-3 border bg-[#fafaf8] p-4 md:grid-cols-[150px_1fr_auto]">
              <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Item type</span><select value={item.type} onChange={(event) => patchMarqueeItem(index, { type: event.target.value as HomeMarqueeItem["type"] })} className="h-11 border bg-white px-3 text-sm"><option value="text">Text</option><option value="image">Image / GIF</option><option value="video">Video</option><option value="logo">Logo</option></select></label>
              {item.type === "text" ? <CmsInput label={`Text ${index + 1}`} value={item.text} onChange={(value) => patchMarqueeItem(index, { text: value })} /> : <CmsImageInput label={`${item.type === "video" ? "Video" : item.type === "logo" ? "Logo" : "Image / GIF"} ${index + 1}`} value={item.image} onChange={(image) => patchMarqueeItem(index, { image })} onUpload={onUpload} busy={busy} accept={item.type === "video" ? "video/mp4,video/webm,video/ogg,video/quicktime" : "image/*,.gif"} mediaType={item.type === "video" ? "video" : "image"} />}
              <Button type="button" variant="outline" className="self-end rounded-none" onClick={() => patchObject("marquee", { items: content.marquee.items.filter((_, i) => i !== index) })}><Trash2 className="size-4" /> Remove</Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2"><Button type="button" className="rounded-none bg-[#6337d8] text-white hover:bg-[#5430bd]" onClick={() => patchObject("marquee", { items: [...content.marquee.items, { id: `text-${Date.now()}`, type: "text", text: "New marquee text", image: "" }] })}><PlusCircle className="size-4" /> Add text</Button><Button type="button" variant="outline" className="rounded-none" onClick={() => patchObject("marquee", { items: [...content.marquee.items, { id: `image-${Date.now()}`, type: "image", text: "", image: "" }] })}><PlusCircle className="size-4" /> Add image / GIF</Button><Button type="button" variant="outline" className="rounded-none" onClick={() => patchObject("marquee", { items: [...content.marquee.items, { id: `video-${Date.now()}`, type: "video", text: "", image: "" }] })}><PlusCircle className="size-4" /> Add video</Button><Button type="button" variant="outline" className="rounded-none" onClick={() => patchObject("marquee", { items: [...content.marquee.items, { id: `logo-${Date.now()}`, type: "logo", text: "", image: "" }] })}><PlusCircle className="size-4" /> Add logo</Button></div>
        </CmsRepeater>
      </CmsSection>

      <CmsSection eyebrow="Section 3" title="Feature strip">
        <div className="grid gap-4">
          {content.featureCards.map((card, index) => <div key={index} className="grid gap-3 border bg-[#fafaf8] p-4 md:grid-cols-3"><CmsInput label={`Feature ${index + 1} title`} value={card.title} onChange={(title) => patchFeature(index, { title })} /><CmsTextarea label="Description" value={card.text} onChange={(text) => patchFeature(index, { text })} /><CmsInput label="Icon name" value={card.icon} onChange={(icon) => patchFeature(index, { icon })} /></div>)}
          <Button type="button" className="w-fit rounded-none bg-[#6337d8] text-white hover:bg-[#5430bd]" onClick={() => patch("featureCards", [...content.featureCards, { title: "New feature", text: "Feature description", icon: "Sparkles" }])}><PlusCircle className="size-4" /> Add feature</Button>
        </div>
      </CmsSection>

      <CmsSection eyebrow="Section 4" title="Client Gallery tabs">
        <div className="grid gap-5 lg:grid-cols-2">
          <CmsRepeater title="Client Gallery text">
            <CmsInput label="Eyebrow" value={content.clientGallery.eyebrow} onChange={(eyebrow) => patchObject("clientGallery", { eyebrow })} />
            <CmsTextarea label="Heading" value={content.clientGallery.title} onChange={(title) => patchObject("clientGallery", { title })} />
            <CmsTextarea label="Description" value={content.clientGallery.subtitle} onChange={(subtitle) => patchObject("clientGallery", { subtitle })} />
          </CmsRepeater>
          <CmsRepeater title="Tabs and media">
            {content.clientGallery.tabs.map((tab, index) => (
              <div key={`${tab.value}-${index}`} className="grid gap-3 rounded-[10px] border border-[#e8e3ef] bg-white p-4">
                <CmsInput label={`Tab ${index + 1} label`} value={tab.label} onChange={(label) => patchClientGalleryTab(index, { label })} />
                <CmsImageInput label="Tab media" value={tab.image} onChange={(image) => patchClientGalleryTab(index, { image })} onUpload={onUpload} busy={busy} accept="image/*,.gif,video/mp4,video/webm,video/ogg,video/quicktime" mediaType={tab.mediaType ?? "image"} onMediaTypeChange={(mediaType) => patchClientGalleryTab(index, { mediaType })} onUploaded={(image, mediaType) => patchClientGalleryTab(index, { image, mediaType })} />
                <Button type="button" variant="outline" className="w-fit rounded-none" onClick={() => patchObject("clientGallery", { tabs: content.clientGallery.tabs.filter((_, i) => i !== index) })}><Trash2 className="size-4" /> Remove tab</Button>
              </div>
            ))}
            <Button type="button" className="w-fit rounded-none bg-[#6337d8] text-white hover:bg-[#5430bd]" onClick={() => patchObject("clientGallery", { tabs: [...content.clientGallery.tabs, { value: `tab-${Date.now()}`, label: "New tab", image: "", mediaType: "image" }] })}><PlusCircle className="size-4" /> Add tab</Button>
          </CmsRepeater>
        </div>
      </CmsSection>

      <CmsSection eyebrow="Section 5" title="Photographer types tabs">
        <div className="grid gap-5 lg:grid-cols-2">
          <CmsRepeater title="Section text">
            <CmsInput label="Eyebrow" value={content.photographerTypes.eyebrow} onChange={(eyebrow) => patchObject("photographerTypes", { eyebrow })} />
            <CmsTextarea label="Heading" value={content.photographerTypes.title} onChange={(title) => patchObject("photographerTypes", { title })} />
            <CmsTextarea label="Description" value={content.photographerTypes.subtitle} onChange={(subtitle) => patchObject("photographerTypes", { subtitle })} />
          </CmsRepeater>
          <CmsRepeater title="Photographer type tabs and media">
            {content.photographerTypes.tabs.map((tab, index) => (
              <div key={`${tab.value}-${index}`} className="grid gap-3 rounded-[10px] border border-[#e8e3ef] bg-white p-4">
                <CmsInput label={`Tab ${index + 1} label`} value={tab.label} onChange={(label) => patchPhotographerTypeTab(index, { label })} />
                <CmsImageInput label="Tab media" value={tab.image} onChange={(image) => patchPhotographerTypeTab(index, { image })} onUpload={onUpload} busy={busy} accept="image/*,.gif,video/mp4,video/webm,video/ogg,video/quicktime" mediaType={tab.mediaType ?? "image"} onMediaTypeChange={(mediaType) => patchPhotographerTypeTab(index, { mediaType })} onUploaded={(image, mediaType) => patchPhotographerTypeTab(index, { image, mediaType })} />
                <Button type="button" variant="outline" className="w-fit rounded-none" onClick={() => patchObject("photographerTypes", { tabs: content.photographerTypes.tabs.filter((_, i) => i !== index) })}><Trash2 className="size-4" /> Remove tab</Button>
              </div>
            ))}
            <Button type="button" className="w-fit rounded-none bg-[#6337d8] text-white hover:bg-[#5430bd]" onClick={() => patchObject("photographerTypes", { tabs: [...content.photographerTypes.tabs, { value: `type-${Date.now()}`, label: "New type", image: "", mediaType: "image" }] })}><PlusCircle className="size-4" /> Add photographer type</Button>
          </CmsRepeater>
        </div>
      </CmsSection>

      <CmsSection eyebrow="Section 6" title="Gallery showcase and statistics">
        <div className="grid gap-5 lg:grid-cols-2">
          <CmsRepeater title="Showcase text">
            <CmsInput label="Eyebrow" value={content.showcase.eyebrow} onChange={(eyebrow) => patchObject("showcase", { eyebrow })} />
            <CmsTextarea label="Heading" value={content.showcase.title} onChange={(title) => patchObject("showcase", { title })} />
            <CmsTextarea label="Description" value={content.showcase.subtitle} onChange={(subtitle) => patchObject("showcase", { subtitle })} />
            <CmsInput label="Explore button" value={content.showcase.button} onChange={(button) => patchObject("showcase", { button })} />
            <CmsInput label="Main card title" value={content.showcase.cardTitle} onChange={(cardTitle) => patchObject("showcase", { cardTitle })} />
            <CmsInput label="Main card date" value={content.showcase.cardDate} onChange={(cardDate) => patchObject("showcase", { cardDate })} />
            <CmsInput label="Main card button" value={content.showcase.cardButton} onChange={(cardButton) => patchObject("showcase", { cardButton })} />
          </CmsRepeater>
          <CmsRepeater title="Bullet points">
            {content.showcase.bullets.map((bullet, index) => <CmsInput key={index} label={`Bullet ${index + 1}`} value={bullet} onChange={(value) => { const bullets = [...content.showcase.bullets]; bullets[index] = value; patchObject("showcase", { bullets }); }} />)}
          </CmsRepeater>
          <CmsRepeater title="Statistics">
            {content.stats.map((stat, index) => <div key={index} className="grid grid-cols-2 gap-3"><CmsInput label={`Stat ${index + 1} value`} value={stat.value} onChange={(value) => { const stats = [...content.stats]; stats[index] = { ...stats[index], value }; patch("stats", stats); }} /><CmsInput label="Label" value={stat.label} onChange={(label) => { const stats = [...content.stats]; stats[index] = { ...stats[index], label }; patch("stats", stats); }} /></div>)}
          </CmsRepeater>
          <CmsRepeater title="Five gallery showcase media slots">
            <p className="rounded-[8px] bg-[#f5f1ff] px-3 py-2 text-xs leading-5 text-[#5f35c8]">Each slot can be an image, animated GIF, or video and maps directly to the homepage gallery showcase. Each item can open its own gallery URL.</p>
            {content.gallery.tabs.slice(0, 5).map((tab, index) => (
              <div key={index} className="grid gap-3 rounded-[10px] border border-[#e8e3ef] bg-white p-4">
                <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-[#6337d8]">Media slot {index + 1}</p><span className="text-xs text-[#777]">{index === 0 ? "Main center card" : index === 1 ? "Left top" : index === 2 ? "Left bottom" : index === 3 ? "Right top" : "Right bottom"}</span></div>
                <CmsInput label="Media label" value={tab.label} onChange={(label) => patchGalleryImage(index, { label })} />
                <CmsInput label="Gallery title" value={tab.title ?? ""} onChange={(title) => patchGalleryImage(index, { title })} />
                <CmsInput label="Full gallery URL (example: https://example.com/collection/name/gallery)" value={tab.href ?? ""} onChange={(href) => patchGalleryImage(index, { href })} />
                <CmsImageInput label="Upload media" value={tab.image} onChange={(image) => patchGalleryImage(index, { image })} onUpload={onUpload} busy={busy} accept="image/*,.gif,video/mp4,video/webm,video/ogg,video/quicktime" mediaType={tab.mediaType ?? "image"} onMediaTypeChange={(mediaType) => patchGalleryImage(index, { mediaType })} onUploaded={(image, mediaType) => patchGalleryImage(index, { image, mediaType })} />
              </div>
            ))}
          </CmsRepeater>
        </div>
      </CmsSection>

      <CmsSection eyebrow="Section 7" title="Call to action and trusted brands">
        <div className="grid gap-5 lg:grid-cols-2">
          <CmsRepeater title="Call to action">
            <CmsTextarea label="Heading" value={content.cta.title} onChange={(title) => patchObject("cta", { title })} />
            <CmsTextarea label="Description" value={content.cta.subtitle} onChange={(subtitle) => patchObject("cta", { subtitle })} />
            <CmsInput label="Button label" value={content.cta.button} onChange={(button) => patchObject("cta", { button })} />
            <CmsInput label="Trial note" value={content.cta.trialText} onChange={(trialText) => patchObject("cta", { trialText })} />
            <CmsInput label="Card note" value={content.cta.noCardText} onChange={(noCardText) => patchObject("cta", { noCardText })} />
          </CmsRepeater>
          <CmsRepeater title="Trusted brands">
            <CmsInput label="Section heading" value={content.trustHeading} onChange={(trustHeading) => patch("trustHeading", trustHeading)} />
            {content.brandLogos.map((logo, index) => <div key={index} className="border p-3"><CmsInput label="Brand name" value={logo.name} onChange={(name) => patchBrandLogo(index, { name })} /><div className="mt-3"><CmsImageInput label="Brand logo" value={logo.image} onChange={(image) => patchBrandLogo(index, { image })} onUpload={onUpload} busy={busy} /></div></div>)}
            <Button type="button" className="w-fit rounded-none bg-[#6337d8] text-white hover:bg-[#5430bd]" onClick={() => patch("brandLogos", [...content.brandLogos, { name: "New brand", image: "", url: "" }])}><PlusCircle className="size-4" /> Add brand</Button>
          </CmsRepeater>
        </div>
      </CmsSection>

      <CmsSection eyebrow="Section 8" title="Footer">
        <div className="grid gap-5 lg:grid-cols-2">
          <CmsRepeater title="Footer branding and text">
            <CmsInput label="Footer brand text (used only when no footer logo is uploaded)" value={content.footer.brandText} onChange={(brandText) => patchObject("footer", { brandText, logoUrl: brandText.trim() ? "" : content.footer.logoUrl })} />
            <CmsImageInput label="Footer logo — recommended 440 × 88 px, transparent PNG/SVG" value={content.footer.logoUrl} onChange={(logoUrl) => patchObject("footer", { logoUrl, brandText: logoUrl.trim() ? "" : content.footer.brandText })} onUpload={onUpload} busy={busy} />
            <CmsTextarea label="Description" value={content.footer.description} onChange={(description) => patchObject("footer", { description })} />
            <CmsInput label="Copyright" value={content.footer.copyright} onChange={(copyright) => patchObject("footer", { copyright })} />
          </CmsRepeater>
          <CmsRepeater title="Footer columns and links">
            {content.footer.columns.map((column, columnIndex) => <div key={columnIndex} className="grid gap-3 border p-4"><CmsInput label="Column title" value={column.title} onChange={(title) => patchFooterColumn(columnIndex, { title })} />{column.links.map((link, linkIndex) => { const item = typeof link === "string" ? { label: link, url: "" } : link; return <div key={linkIndex} className="grid gap-3 sm:grid-cols-2"><CmsInput label="Link label" value={item.label} onChange={(label) => patchFooterLink(columnIndex, linkIndex, { label })} /><CmsInput label="Link URL" value={item.url} onChange={(url) => patchFooterLink(columnIndex, linkIndex, { url })} /></div>; })}</div>)}
          </CmsRepeater>
        </div>
      </CmsSection>
    </div>
  );
}

function CmsSection({ eyebrow, title, children, defaultOpen }: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group bg-white shadow-[0_12px_35px_rgba(0,0,0,0.04)]" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border-b px-4 py-4 sm:px-6 sm:py-5">
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0a9c8b]">{eyebrow}</p>}
          <h3 className="mt-1 break-words text-lg font-semibold sm:text-xl">{title}</h3>
        </div>
        <span className="flex size-8 items-center justify-center bg-[#f4f4f1] text-lg font-semibold text-[#555] group-open:rotate-45">+</span>
      </summary>
      <div className="p-4 sm:p-6">{children}</div>
    </details>
  );
}

function CmsRepeater({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 rounded-none bg-[#fafaf8] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#777]">{title}</p>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function CmsInput({ label, value, onChange, wide, dark }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
  dark?: boolean;
}) {
  return (
    <label className={cn("grid gap-2", wide && "md:col-span-2")}>
      <span className={cn("text-xs font-bold uppercase tracking-[0.14em]", dark ? "text-white/50" : "text-[#777]")}>{label}</span>
      <Textarea
        rows={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "min-h-11 resize-y rounded-none py-3 shadow-none focus-visible:ring-[#6337d8]",
          dark ? "border-0 bg-white/8 text-white placeholder:text-white/40" : "border-[#ddd] bg-[#fbfbfa]",
        )}
      />
    </label>
  );
}

function CmsNumberInput({ label, value, min, max, onCommit }: {
  label: string; value: number; min: number; max: number; onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    const next = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : value;
    setDraft(String(next));
    onCommit(next);
  };
  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#777]">{label}</span>
      <Input type="number" inputMode="numeric" min={min} max={max} value={draft}
        onChange={(event) => setDraft(event.target.value)} onBlur={commit}
        onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
        className="h-11 rounded-none border-[#ddd] bg-[#fbfbfa] shadow-none focus-visible:ring-[#6337d8]" />
    </label>
  );
}

function CmsImageInput({ label, value, onChange, onUpload, busy, wide, accept = "image/*", mediaType = "image", onMediaTypeChange, onUploaded }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onUpload: (file: File) => Promise<string>;
  busy: boolean;
  wide?: boolean;
  accept?: string;
  mediaType?: "image" | "video";
  onMediaTypeChange?: (value: "image" | "video") => void;
  onUploaded?: (url: string, mediaType: "image" | "video") => void;
}) {
  const [uploading, setUploading] = useState(false);

  return (
    <div className={cn("grid gap-2", wide && "md:col-span-2")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#777]">{label}</span>
        {onMediaTypeChange && <select value={mediaType} onChange={(event) => onMediaTypeChange(event.target.value as "image" | "video")} className="h-8 border bg-white px-2 text-xs font-semibold"><option value="image">Image / GIF</option><option value="video">Video</option></select>}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 rounded-none border-[#ddd] bg-[#fbfbfa] shadow-none focus-visible:ring-[#6337d8]"
        />
        <label className="flex h-11 cursor-pointer items-center justify-center bg-[#111] px-4 text-sm font-bold text-white hover:bg-[#202020]">
          {uploading ? "Uploading" : "Upload"}
          <input
            type="file"
            accept={accept}
            disabled={busy || uploading}
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setUploading(true);
              try {
                const nextMediaType = file.type.startsWith("video/") ? "video" : "image";
                const url = await onUpload(file);
                if (onUploaded) onUploaded(url, nextMediaType);
                else onChange(url);
                toast.success(nextMediaType === "video" ? "Video uploaded" : "Image / GIF uploaded");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Upload failed");
              } finally {
                setUploading(false);
                event.target.value = "";
              }
            }}
          />
        </label>
      </div>
      {value && (mediaType === "video" ? <video src={value} className="h-28 w-full max-w-[320px] border bg-black object-contain" controls muted playsInline /> : <img src={value} alt={label} className="h-24 w-full max-w-[260px] border bg-white object-cover p-1" />)}
    </div>
  );
}

function CmsHeroHeadingEditor({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    editor.innerHTML = value || "";
  }, [value]);

  const applyColor = (color: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("foreColor", false, color);
    onChange(editor.innerHTML);
  };

  return (
    <div className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#777]">{label}</span>
      <div className="flex flex-wrap gap-2 border border-b-0 border-[#ddd] bg-[#f5f5f3] p-2">
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyColor("#080808")} className="border border-[#ccc] bg-white px-3 py-1.5 text-xs font-bold text-[#080808]">Black</button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyColor("#6240d7")} className="bg-[#6240d7] px-3 py-1.5 text-xs font-bold text-white">Purple</button>
        <span className="self-center text-xs text-[#777]">Select text, then choose a color.</span>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        className="min-h-32 border border-[#ddd] bg-[#fbfbfa] p-3 text-base leading-7 outline-none focus:border-[#6337d8]"
      />
    </div>
  );
}

function CmsTextarea({ label, value, onChange, wide }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  return (
    <label className={cn("grid gap-2", wide && "md:col-span-2")}>
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#777]">{label}</span>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-28 rounded-none border-[#ddd] bg-[#fbfbfa] shadow-none focus-visible:ring-[#6337d8]"
      />
    </label>
  );
}

function PlanTable({ plans, onEdit, onDelete, onOrderChange, onReorder, busy }: {
  plans: AdminPlan[];
  onEdit: (plan: AdminPlan) => void;
  onDelete: (id: string) => void;
  onOrderChange: (id: string, sortOrder: number) => void;
  onReorder: (planIds: string[]) => void;
  busy: boolean;
}) {
  const [orderedPlans, setOrderedPlans] = useState<AdminPlan[]>(() => [...plans].sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)));
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    setOrderedPlans([...plans].sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)));
  }, [plans]);

  const moveDraggedPlan = (targetId: string) => {
    if (!draggedId || draggedId === targetId || busy) return;
    const fromIndex = orderedPlans.findIndex((plan) => plan._id === draggedId);
    const toIndex = orderedPlans.findIndex((plan) => plan._id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...orderedPlans];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setOrderedPlans(next);
  };

  const finishDrag = () => {
    if (!draggedId) return;
    setDraggedId(null);
    onReorder(orderedPlans.map((plan) => plan._id));
  };

  return (
    <div className="mt-6 overflow-x-auto bg-white">
      <div className="flex items-center gap-2 border-b border-[#ece8f5] bg-[#faf8ff] px-4 py-3 text-xs font-semibold text-[#6337d8]">
        <GripVertical className="size-4" /> Drag plans by the handle to change their display order.
      </div>
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b text-left text-xs uppercase tracking-[0.14em] text-[#777]">
          <tr>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Storage</th>
            <th className="px-4 py-3">Emails</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">Order</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {orderedPlans.map((plan) => (
            <tr
              key={plan._id}
              onDragOver={(event) => { event.preventDefault(); moveDraggedPlan(plan._id); }}
              onDrop={(event) => event.preventDefault()}
              className={cn(
                "border-b transition last:border-0",
                plan.recommended && "bg-[#f7f3ff] shadow-[inset_3px_0_0_#6337d8]",
                draggedId === plan._id && "opacity-45",
              )}
            >
              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    draggable={!busy}
                    onDragStart={(event) => {
                      setDraggedId(plan._id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", plan._id);
                    }}
                    onDragEnd={finishDrag}
                    disabled={busy}
                    aria-label={`Drag ${plan.name} to reorder`}
                    title="Drag to reorder"
                    className="cursor-grab rounded p-1.5 text-[#8b80a8] hover:bg-[#f1edfb] hover:text-[#6337d8] active:cursor-grabbing disabled:cursor-not-allowed"
                  >
                    <GripVertical className="size-5" />
                  </button>
                  <p className="font-bold">{plan.name}</p>
                  {plan.recommended && <span className="rounded-full bg-[#6337d8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.12em] text-white">Recommended</span>}
                </div>
                <p className="mt-1 text-xs text-[#777]">Storage + monthly email allowance</p>
              </td>
              <td className="px-4 py-4">{plan.storageGb} GB</td>
              <td className="px-4 py-4">
                <p>{plan.monthlyEmails} emails / month</p>
                <p className="mt-1 text-xs text-[#777]">{Number(plan.videoMinutes ?? 0)} video min · {plan.videoQuality === "4k" ? "HD + 4K" : "HD"}</p>
              </td>
              <td className="px-4 py-4">
                <p>€{Number(plan.priceMonthly ?? 0).toLocaleString()} / month</p>
                {plan.yearlyEnabled && <p className="mt-1 text-xs text-[#777]">€{Number(plan.priceYearly ?? 0).toLocaleString()} / year</p>}
              </td>
              <td className="px-4 py-4">
                <input
                  type="number"
                  min={0}
                  defaultValue={Number(plan.sortOrder ?? 0)}
                  onBlur={(event) => onOrderChange(plan._id, Math.max(0, Number(event.currentTarget.value || 0)))}
                  disabled={busy}
                  aria-label={`Order for ${plan.name}`}
                  className="h-9 w-20 border border-[#d8d2e8] bg-white px-2 text-center font-semibold outline-none focus:border-[#6337d8] focus:ring-2 focus:ring-[#6337d8]/15"
                />
              </td>
              <td className="px-4 py-4">{plan.active ? "Active" : "Inactive"}</td>
              <td className="px-4 py-4">
                <div className="flex justify-end gap-2">
                  <button className="p-2 hover:bg-[#f3f3f3]" onClick={() => onEdit(plan)} disabled={busy} aria-label="Edit plan">
                    <Edit3 className="size-4" />
                  </button>
                  <button className="p-2 text-red-600 hover:bg-red-50" onClick={() => onDelete(plan._id)} disabled={busy} aria-label="Delete plan">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {!plans.length && (
            <tr>
              <td className="px-4 py-8 text-center text-sm font-semibold text-[#777]" colSpan={7}>
                No plans yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

