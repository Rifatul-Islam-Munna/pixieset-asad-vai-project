"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ComponentType, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart3, Check, Edit3, Euro, ExternalLink, FileImage, FileText, HardDrive, Images, Loader2, LogOut, Mail, Menu, Package, PlusCircle, Search, ShieldCheck, ShoppingBag, Trash2, Users, X } from "lucide-react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import {
  createAdminPlan,
  createAdminUser,
  deleteAdminCollection,
  deleteAdminPlan,
  deleteAdminUser,
  updateAdminPlan,
  updateAdminFreePlanSettings,
  updateAdminStripeSettings,
  updateAdminUser,
  updateHomeCms,
  uploadHomeCmsFile,
  type AdminCollection,
  type AdminDashboardData,
  type AdminFreePlanSetting,
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
import { mergeHomeCms, type BrandLogo, type FeatureCard, type FooterLink, type GalleryTab, type HomeCmsData, type HomeContent, type HomeLanguage, type SeoMetaTag, type Testimonial } from "@/lib/home-cms";
import { cn } from "@/lib/utils";

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
  monthlyEmails: string;
  videoMinutes: string;
  videoQuality: "hd" | "4k";
  priceMonthly: string;
  yearlyEnabled: boolean;
  priceYearly: string;
  features: Record<string, boolean>;
  active: boolean;
};

type AdminTab = "overview" | "users" | "collections" | "plans" | "free-plan" | "stripe" | "cms" | "terms" | "privacy";

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
  monthlyEmails: "",
  videoMinutes: "",
  videoQuality: "hd",
  priceMonthly: "",
  yearlyEnabled: false,
  priceYearly: "",
  features: {},
  active: true,
};

const planFeatures = [
  ["pinSet", "PIN set"],
  ["downloadLimit", "Download limit"],
  ["store", "Store"],
  ["marketingEmails", "Marketing email"],
] as const;

export function AdminDashboard({ initialData }: { initialData: AdminDashboardData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [stripeForm, setStripeForm] = useState<AdminStripeSetting>(
    initialData.stripe ?? { enabled: false, publishableKey: "" },
  );
  const [freePlanForm, setFreePlanForm] = useState<AdminFreePlanSetting>(
    initialData.freePlan ?? { storageGb: 3, monthlyEmails: 1000 },
  );
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
      monthlyEmails: Number(planForm.monthlyEmails || 0),
      videoMinutes: Number(planForm.videoMinutes || 0),
      videoQuality: planForm.videoQuality,
      priceMonthly: Number(planForm.priceMonthly || 0),
      yearlyEnabled: planForm.yearlyEnabled,
      priceYearly: planForm.yearlyEnabled ? Number(planForm.priceYearly || 0) : 0,
      features: planForm.features,
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

  const editPlan = (plan: AdminPlan) => {
    setTab("plans");
    setPlanForm({
      id: plan._id,
      name: plan.name,
      storageGb: String(plan.storageGb ?? 0),
      monthlyEmails: String(plan.monthlyEmails ?? 0),
      videoMinutes: String(plan.videoMinutes ?? 0),
      videoQuality: plan.videoQuality === "4k" ? "4k" : "hd",
      priceMonthly: String(plan.priceMonthly ?? 0),
      yearlyEnabled: Boolean(plan.yearlyEnabled),
      priceYearly: String(plan.priceYearly ?? 0),
      features: plan.features ?? {},
      active: plan.active,
    });
    setPlanModalOpen(true);
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
          <div className="flex items-center gap-3 text-sm font-bold">
            <span className="size-5 rounded-full bg-[#0dc6b5]" />
            Nikoset Admin
          </div>
          <AdminNav tab={tab} setTab={setTab} />
          <Button onClick={logout} variant="outline" className="mt-10 h-10 w-full rounded-none" disabled={pending}>
            <LogOut className="size-4" />
            Logout
          </Button>
        </aside>

        <section className="min-w-0 px-3 py-4 sm:px-4 md:px-8 md:py-6">
          <div className="mb-5 flex items-center justify-between gap-3 bg-white px-3 py-3 sm:px-4 lg:hidden">
            <div className="flex items-center gap-3 text-sm font-bold">
              <span className="size-5 rounded-full bg-[#0dc6b5]" />
              Nikoset Admin
            </div>
            <button className="flex size-10 items-center justify-center bg-[#111] text-white" onClick={() => setAdminMenuOpen(true)} aria-label="Open admin menu">
              <Menu />
            </button>
          </div>

          {adminMenuOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 lg:hidden">
              <aside className="h-full w-[88vw] max-w-[320px] overflow-y-auto bg-white px-5 py-6 shadow-[20px_0_60px_rgba(0,0,0,0.25)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-sm font-bold">
                    <span className="size-5 rounded-full bg-[#0dc6b5]" />
                    Nikoset Admin
                  </div>
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
                <ShieldCheck className="size-4 text-[#0aa997]" />
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
              <Button onClick={saveStripe} className="h-11 rounded-none bg-[#111] text-white" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : "Save Stripe"}
              </Button>
            )}
            {tab === "users" && (
              <Button onClick={openAddModal} className="h-11 rounded-none bg-[#111] text-white">
                <PlusCircle className="size-4" />
                Add user
              </Button>
            )}
            {tab === "plans" && (
              <Button onClick={openPlanModal} className="h-11 rounded-none bg-[#111] text-white">
                <PlusCircle className="size-4" />
                Add plan
              </Button>
            )}
          </div>

          {tab === "overview" ? (
            <AdminOverview data={initialData} />
          ) : tab === "users" ? (
            <div className="mt-6">
              <UserTable users={filteredUsers} onEdit={editUser} onDelete={removeUser} busy={pending} />
            </div>
          ) : tab === "plans" ? (
            <PlanTable plans={filteredPlans} onEdit={editPlan} onDelete={removePlan} busy={pending} />
          ) : tab === "free-plan" ? (
            <FreePlanSettingsPanel form={freePlanForm} setForm={setFreePlanForm} onSave={saveFreePlan} busy={pending} />
          ) : tab === "stripe" ? (
            <StripeSettingsPanel form={stripeForm} setForm={setStripeForm} />
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
            <CollectionTable collections={filteredCollections} onDelete={removeCollection} busy={pending} />
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
    active ? "bg-[#111] text-white" : "text-[#555] hover:bg-[#f3f3f3]",
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
    { id: "cms", label: "Homepage Editor", icon: FileImage },
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
        className="h-11 rounded-none border-[#ddd] shadow-none focus-visible:ring-[#22bda7]"
      />
    </label>
  );
}

function UserTable({ users, onEdit, onDelete, busy }: {
  users: AdminUser[];
  onEdit: (user: AdminUser) => void;
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
  const chartColors = ["#22bda7", "#111111", "#9ca3af", "#d6b86a", "#ec6f58", "#6b8afd"];

  return (
    <div className="mt-6 grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={Users} label="Total users" value={stats.users} />
        <MetricCard icon={Images} label="Collections" value={stats.collections} />
        <MetricCard icon={FileImage} label="Images" value={stats.images} />
        <MetricCard icon={ShoppingBag} label="Orders" value={stats.orders ?? 0} />
        <MetricCard icon={Euro} label="Revenue" value={`â‚¬${Number(stats.revenue ?? 0).toLocaleString()}`} strong />
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
                <Tooltip formatter={(value, name) => name === "revenue" ? [`â‚¬${Number(value).toLocaleString()}`, "Revenue"] : [value, "Orders"]} />
                <Bar dataKey="revenue" fill="#22bda7" radius={[4, 4, 0, 0]} />
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
                <Line type="monotone" dataKey="users" stroke="#22bda7" strokeWidth={3} dot={{ r: 3 }} />
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
        <Icon className={cn("size-5", strong ? "text-[#22bda7]" : "text-[#0a9c8b]")} />
      </div>
      <p className="mt-5 text-3xl font-semibold">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}

function CollectionTable({ collections, onDelete, busy }: {
  collections: AdminCollection[];
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
                <button className="p-2 text-red-600 hover:bg-red-50" onClick={() => onDelete(collection._id)} disabled={busy} aria-label="Delete collection">
                  <Trash2 className="size-4" />
                </button>
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
  return <div className="mt-6 overflow-hidden border border-[#dfe5e2] bg-white shadow-[0_18px_55px_rgba(18,38,32,.07)]"><header className="border-b bg-[#f7faf8] px-5 py-6 md:px-8"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#079c8a]">Public legal page</p><h2 className="mt-2 text-3xl font-semibold">{type === "terms" ? "Terms of Service" : "Privacy Policy"}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#68726e]">Edit title and fully formatted page content.</p></div><div className="flex gap-2"><a href={previewHref} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 border bg-white px-4 text-sm font-bold">Preview <ExternalLink className="size-4" /></a><Button onClick={onSave} disabled={busy} className="h-10 rounded-none bg-[#111] px-5 text-white">Save now</Button></div></div></header><div className="grid md:grid-cols-[210px_1fr]"><aside className="border-b bg-[#fbfbfa] p-5 md:border-b-0 md:border-r"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#888]">Language</p><div className="mt-4 grid gap-2">{(["en", "gr"] as HomeLanguage[]).map((value) => <button key={value} onClick={() => setLang(value)} className={cn("flex h-11 items-center justify-between px-4 text-left text-sm font-bold", lang === value ? "bg-[#111] text-white" : "border bg-white text-[#555]")}>{value === "en" ? "English" : "Greek"}<span>{value.toUpperCase()}</span></button>)}</div><div className={cn("mt-6 px-3 py-3 text-xs font-bold", saveState === "error" ? "bg-red-50 text-red-700" : saveState === "saved" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800")}>{saveState === "saving" ? "Savingâ€¦" : saveState === "unsaved" ? "Unsaved changes" : saveState === "error" ? "Save failed" : "Saved Â· Live"}</div></aside><section className="p-5 md:p-8"><label className="grid gap-2"><span className="text-sm font-bold">Page title</span><Input value={page.title} onChange={(event) => update({ title: event.target.value })} className="h-13 rounded-none border-[#ccd5d1] px-4 text-lg shadow-none" /></label><div className="mt-7 grid gap-2"><span className="text-sm font-bold">Page content</span><RichTextEditor key={`${type}-${lang}`} value={page.content} onChange={(content) => update({ content })} /></div></section></div></div>;
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
  const patchBrandLogo = (index: number, value: Partial<BrandLogo>) => {
    const logos = [...content.brandLogos];
    logos[index] = { ...logos[index], ...value };
    patch("brandLogos", logos);
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
            <h2 className="mt-1 text-2xl font-semibold">Six homepage sections</h2>
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
            <Button type="button" onClick={onSave} disabled={busy} className="h-10 rounded-none bg-[#22bda7] px-6 text-white hover:bg-[#19a995]">Save now</Button>
          </div>
        </div>
      </div>

      <CmsSection eyebrow="Section 1" title="Header, brand, login and registration" defaultOpen>
        <div className="grid gap-5 lg:grid-cols-2">
          <CmsRepeater title="Brand and navbar">
            <CmsInput label="Brand text" value={safeForm.brand.brandText} onChange={(brandText) => setForm({ ...safeForm, brand: { ...safeForm.brand, brandText }, auth: { ...safeForm.auth, brand: brandText } })} />
            <CmsImageInput label="Brand logo" value={safeForm.brand.logoUrl} onChange={(logoUrl) => setForm({ ...safeForm, brand: { ...safeForm.brand, logoUrl } })} onUpload={onUpload} busy={busy} />
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
            <CmsInput label="Main heading (black)" value={content.hero.title} onChange={(title) => patchObject("hero", { title })} />
            <CmsInput label="Highlighted heading (purple)" value={content.hero.accentTitle} onChange={(accentTitle) => patchObject("hero", { accentTitle })} />
            <CmsInput label="Ending heading (black)" value={content.hero.endingTitle} onChange={(endingTitle) => patchObject("hero", { endingTitle })} />
            <CmsTextarea label="Description (normal paragraph text)" value={content.hero.subtitle} onChange={(subtitle) => patchObject("hero", { subtitle })} />
            <CmsInput label="Primary button" value={content.hero.cta} onChange={(cta) => patchObject("hero", { cta })} />
            <CmsInput label="Secondary button" value={content.hero.secondaryCta} onChange={(secondaryCta) => patchObject("hero", { secondaryCta })} />
            <CmsInput label="Review text" value={content.hero.ratingText} onChange={(ratingText) => patchObject("hero", { ratingText })} />
          </CmsRepeater>
          <CmsRepeater title="Hero media">
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Media type</span><select value={safeForm.media.heroMediaType} onChange={(event) => setForm({ ...safeForm, media: { ...safeForm.media, heroMediaType: event.target.value as "image" | "video" } })} className="h-11 border bg-[#fbfbfa] px-3 text-sm"><option value="image">Image</option><option value="video">Video</option></select></label>
            <CmsInput label="Image or video URL" value={safeForm.media.heroMediaUrl} onChange={(heroMediaUrl) => setForm({ ...safeForm, media: { ...safeForm.media, heroMediaUrl } })} />
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Upload hero media</span><Input type="file" accept="image/*,video/*" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) onHeroUpload(file); }} className="h-11 rounded-none border-[#ddd] bg-[#fbfbfa] pt-2" /></label>
            <div className="mt-2 grid gap-3">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#777]">Reviewer avatars</p>
              {content.hero.avatarImages.map((avatar, index) => (
                <CmsImageInput key={index} label={`Avatar ${index + 1}`} value={avatar} onChange={(value) => { const avatarImages = [...content.hero.avatarImages]; avatarImages[index] = value; patchObject("hero", { avatarImages }); }} onUpload={onUpload} busy={busy} />
              ))}
              <Button type="button" className="w-fit rounded-none bg-[#111] text-white" onClick={() => patchObject("hero", { avatarImages: [...content.hero.avatarImages, ""] })}><PlusCircle className="size-4" /> Add avatar</Button>
            </div>
          </CmsRepeater>
        </div>
      </CmsSection>

      <CmsSection eyebrow="Section 3" title="Feature strip">
        <div className="grid gap-4">
          {content.featureCards.map((card, index) => <div key={index} className="grid gap-3 border bg-[#fafaf8] p-4 md:grid-cols-3"><CmsInput label={`Feature ${index + 1} title`} value={card.title} onChange={(title) => patchFeature(index, { title })} /><CmsTextarea label="Description" value={card.text} onChange={(text) => patchFeature(index, { text })} /><CmsInput label="Icon name" value={card.icon} onChange={(icon) => patchFeature(index, { icon })} /></div>)}
          <Button type="button" className="w-fit rounded-none bg-[#111] text-white" onClick={() => patch("featureCards", [...content.featureCards, { title: "New feature", text: "Feature description", icon: "Sparkles" }])}><PlusCircle className="size-4" /> Add feature</Button>
        </div>
      </CmsSection>

      <CmsSection eyebrow="Section 4" title="Gallery showcase and statistics">
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
          <CmsRepeater title="Gallery images">
            {content.gallery.tabs.map((tab, index) => <div key={index} className="border p-3"><CmsInput label={`Image ${index + 1} label`} value={tab.label} onChange={(label) => patchGalleryImage(index, { label })} /><div className="mt-3"><CmsImageInput label="Image" value={tab.image} onChange={(image) => patchGalleryImage(index, { image })} onUpload={onUpload} busy={busy} /></div></div>)}
            {content.workflow.tabs.map((tab, index) => <div key={`workflow-${index}`} className="border p-3"><CmsInput label={`Extra image ${index + 1} label`} value={tab.label} onChange={(label) => patchWorkflowImage(index, { label })} /><div className="mt-3"><CmsImageInput label="Image" value={tab.image} onChange={(image) => patchWorkflowImage(index, { image })} onUpload={onUpload} busy={busy} /></div></div>)}
          </CmsRepeater>
        </div>
      </CmsSection>

      <CmsSection eyebrow="Section 5" title="Call to action and trusted brands">
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
            <Button type="button" className="w-fit rounded-none bg-[#111] text-white" onClick={() => patch("brandLogos", [...content.brandLogos, { name: "New brand", image: "", url: "" }])}><PlusCircle className="size-4" /> Add brand</Button>
          </CmsRepeater>
        </div>
      </CmsSection>

      <CmsSection eyebrow="Section 6" title="Footer">
        <div className="grid gap-5 lg:grid-cols-2">
          <CmsRepeater title="Footer text">
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
          "min-h-11 resize-y rounded-none py-3 shadow-none focus-visible:ring-[#22bda7]",
          dark ? "border-0 bg-white/8 text-white placeholder:text-white/40" : "border-[#ddd] bg-[#fbfbfa]",
        )}
      />
    </label>
  );
}

function CmsImageInput({ label, value, onChange, onUpload, busy, wide, accept = "image/*" }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onUpload: (file: File) => Promise<string>;
  busy: boolean;
  wide?: boolean;
  accept?: string;
}) {
  const [uploading, setUploading] = useState(false);

  return (
    <div className={cn("grid gap-2", wide && "md:col-span-2")}>
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#777]">{label}</span>
      <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 rounded-none border-[#ddd] bg-[#fbfbfa] shadow-none focus-visible:ring-[#22bda7]"
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
                const url = await onUpload(file);
                onChange(url);
                toast.success("Image uploaded");
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
      {value && <img src={value} alt={label} className="h-24 w-full max-w-[260px] border bg-white object-cover p-1" />}
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
        className="min-h-28 rounded-none border-[#ddd] bg-[#fbfbfa] shadow-none focus-visible:ring-[#22bda7]"
      />
    </label>
  );
}

function PlanTable({ plans, onEdit, onDelete, busy }: {
  plans: AdminPlan[];
  onEdit: (plan: AdminPlan) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  return (
    <div className="mt-6 overflow-x-auto bg-white">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b text-left text-xs uppercase tracking-[0.14em] text-[#777]">
          <tr>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Storage</th>
            <th className="px-4 py-3">Emails</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr key={plan._id} className="border-b last:border-0">
              <td className="px-4 py-4">
                <p className="font-bold">{plan.name}</p>
                <p className="mt-1 text-xs text-[#777]">Storage + monthly email allowance</p>
              </td>
              <td className="px-4 py-4">{plan.storageGb} GB</td>
              <td className="px-4 py-4">
                <p>{plan.monthlyEmails} emails / month</p>
                <p className="mt-1 text-xs text-[#777]">{Number(plan.videoMinutes ?? 0)} video min Â· {plan.videoQuality === "4k" ? "HD + 4K" : "HD"}</p>
              </td>
              <td className="px-4 py-4">
                <p>â‚¬{Number(plan.priceMonthly ?? 0).toLocaleString()} / month</p>
                {plan.yearlyEnabled && <p className="mt-1 text-xs text-[#777]">â‚¬{Number(plan.priceYearly ?? 0).toLocaleString()} / year</p>}
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
              <td className="px-4 py-8 text-center text-sm font-semibold text-[#777]" colSpan={6}>
                No plans yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

