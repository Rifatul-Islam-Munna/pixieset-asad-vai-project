from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DASHBOARD = ROOT / "frontend/components/dashboard/client-dashboard.tsx"
REGISTRATION = ROOT / "frontend/components/dashboard/collection-registration-activity.tsx"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


text = DASHBOARD.read_text(encoding="utf-8")

text = replace_once(text, "  Eye,\n", "  Eye,\n  EyeOff,\n", "EyeOff import")

old_arrays = '''  const emailTemplates = useMemo(
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
  );'''
new_arrays = '''  const emailTemplates = useMemo(() => {
    const remote = Array.isArray(emailTemplateSettings.data?.data)
      ? emailTemplateSettings.data.data.map(
          (setting) => setting.data as EmailTemplateItem,
        )
      : [];
    const local = Array.isArray(storeEmailTemplates)
      ? storeEmailTemplates
      : [];
    return remote.length ? remote : local;
  }, [emailTemplateSettings.data?.data, storeEmailTemplates]);
  const presetItems = useMemo(() => {
    const remote = Array.isArray(presetSettings.data?.data)
      ? presetSettings.data.data.map(
          (setting) => setting.data as PresetItem,
        )
      : [];
    const local = Array.isArray(storePresetItems) ? storePresetItems : [];
    return remote.length ? remote : local;
  }, [presetSettings.data?.data, storePresetItems]);
  const watermarkItems = useMemo(() => {
    const remote = Array.isArray(watermarkSettings.data?.data)
      ? watermarkSettings.data.data.map(
          (setting) => setting.data as WatermarkItem,
        )
      : [];
    const local = Array.isArray(storeWatermarkItems)
      ? storeWatermarkItems
      : [];
    return remote.length ? remote : local;
  }, [storeWatermarkItems, watermarkSettings.data?.data]);'''
text = replace_once(text, old_arrays, new_arrays, "safe collection arrays")

text = text.replace(
    '"download" | "favorite" | "orders" | "email" | "contacts" | "private"',
    '"download" | "favorite" | "orders" | "email" | "contacts" | "links" | "private"',
)

text = replace_once(
    text,
    '    <div className="flex h-[100dvh] min-w-0 flex-col overflow-hidden px-4 py-5 transition-colors duration-300 md:px-6">',
    '    <div className="flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-white">',
    "collection page shell",
)

header_start = text.index('      <button\n        className="mb-4 inline-flex w-fit items-center gap-2 text-sm text-[#666] hover:text-[#222]"')
header_end = text.index('      <Dialog open={shareOpen} onOpenChange={setShareOpen}>', header_start)
new_header = '''      <header className="flex h-[90px] shrink-0 items-center justify-between gap-6 border-b border-[#e8e8e8] bg-white px-7">
        <div className="flex min-w-0 items-center gap-5">
          <button
            className="flex size-8 shrink-0 items-center justify-center text-[#8a8a8a] hover:text-[#222]"
            onClick={() => router.push(`/dashboard/${section}`)}
            aria-label="Back to collections"
            type="button"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-5">
              <h1 className="truncate text-[18px] font-medium leading-none text-[#111]">
                {collection.name}
              </h1>
              <span className="inline-flex h-8 items-center gap-2 rounded-full bg-[#e8f7f3] px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#009786]">
                {collectionStatus}
                <ChevronDown className="size-3" />
              </span>
            </div>
            <p className="mt-2 text-sm text-[#777]">{formatDate(collection.eventDate)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-8 text-sm">
          <button
            className="inline-flex items-center gap-2 font-medium text-[#222] disabled:opacity-50"
            onClick={saveCollection}
            disabled={updateCollection.isPending}
            type="button"
          >
            {updateCollection.isPending ? "Saving..." : "More"}
            <ChevronDown className="size-4" />
          </button>
          <button
            className="font-medium text-[#222]"
            onClick={() => window.open(publicLink, "_blank", "noopener,noreferrer")}
            type="button"
          >
            Preview
          </button>
          <button
            className="inline-flex h-10 items-center bg-[#22bda7] font-bold text-white hover:bg-[#19a995]"
            onClick={() => setShareOpen(true)}
            type="button"
          >
            <span className="px-7">Share</span>
            <span className="flex h-6 items-center border-l border-white/30 px-4">
              <ChevronDown className="size-4" />
            </span>
          </button>
        </div>
      </header>

'''
text = text[:header_start] + new_header + text[header_end:]

old_grid = '''      <div
        className={cn(
          "mt-6 grid h-[calc(100vh-220px)] min-h-[520px] overflow-hidden border transition-[grid-template-columns] duration-300 ease-out",
          detailCollapsed
            ? "md:grid-cols-[76px_minmax(0,1fr)]"
            : "md:grid-cols-[250px_minmax(0,1fr)]",
        )}
      >'''
new_grid = '''      <div
        className={cn(
          "grid min-h-0 flex-1 overflow-hidden transition-[grid-template-columns] duration-300 ease-out",
          detailCollapsed
            ? "md:grid-cols-[76px_minmax(0,1fr)]"
            : "md:grid-cols-[296px_minmax(0,1fr)]",
        )}
      >'''
text = replace_once(text, old_grid, new_grid, "collection main grid")
text = replace_once(text, 'className="h-32 shrink-0 bg-[#e8e8e8]"', 'className="h-[208px] shrink-0 bg-[#e8e8e8]"', "cover height")

text = replace_once(
    text,
    '''              <div className="mb-4 flex items-center justify-end">
                <button''',
    '''              <div className="mb-4 flex items-center justify-between px-1">
                <p className="text-xs font-bold uppercase tracking-wide text-[#777]">Photos</p>
                <button''',
    "photos sidebar label",
)

old_activity_email = '''              <button
                className={cn(
                  "flex h-14 w-full items-center gap-3 px-5 text-left",
                  activityPage === "email" && "bg-white font-bold",
                )}
                onClick={() => setActivityPage("email")}
                type="button"
              >
                <Mail className="size-4" />
                Email Access
              </button>'''
new_activity_email = '''              <button
                className={cn(
                  "flex h-14 w-full items-center gap-3 px-5 text-left",
                  activityPage === "email" && "bg-[#f3f3f3] font-medium",
                )}
                onClick={() => setActivityPage("email")}
                type="button"
              >
                <Mail className="size-4" />
                Email Registration
              </button>
              <button
                className={cn(
                  "flex h-14 w-full items-center gap-3 px-5 text-left",
                  activityPage === "contacts" && "bg-[#f3f3f3] font-medium",
                )}
                onClick={() => setActivityPage("contacts")}
                type="button"
              >
                <Megaphone className="size-4" />
                Marketing Contacts
              </button>
              <button
                className={cn(
                  "flex h-14 w-full items-center gap-3 px-5 text-left",
                  activityPage === "links" && "bg-[#f3f3f3] font-medium",
                )}
                onClick={() => setActivityPage("links")}
                type="button"
              >
                <Link2 className="size-4" />
                Quick Share Links
              </button>
              <button
                className={cn(
                  "flex h-14 w-full items-center gap-3 px-5 text-left",
                  activityPage === "private" && "bg-[#f3f3f3] font-medium",
                )}
                onClick={() => setActivityPage("private")}
                type="button"
              >
                <EyeOff className="size-4" />
                Private Photos
              </button>'''
text = replace_once(text, old_activity_email, new_activity_email, "activity navigation")

text = text.replace('activityPage === "download" && "bg-white font-bold"', 'activityPage === "download" && "bg-[#f3f3f3] font-medium"')
text = text.replace('activityPage === "favorite" && "bg-white font-bold"', 'activityPage === "favorite" && "bg-[#f3f3f3] font-medium"')
text = text.replace('activityPage === "orders" && "bg-white font-bold"', 'activityPage === "orders" && "bg-[#f3f3f3] font-medium"')

old_content_start = '''        <div className="min-w-0 overflow-y-auto p-5 md:p-6">
          {activeTab === "photos" &&'''
new_content_start = '''        <div className="min-w-0 overflow-y-auto bg-white px-8 py-7">
          {activeTab === "photos" && (
            <div className="mb-7 flex flex-wrap items-center justify-between gap-5">
              <h2 className="text-[22px] font-medium text-[#111]">
                {activeSet?.name ?? "Photos"}
              </h2>
              <div className="flex items-center gap-5 text-[#777]">
                <ListFilter className="size-5" />
                <LayoutGrid className="size-5" />
                <span className="h-7 w-px bg-[#e5e5e5]" />
                <label
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-[#00a997]",
                    uploading && "pointer-events-none opacity-60",
                  )}
                >
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <PlusCircle className="size-4" />}
                  {uploading ? `${uploadProgress.currentPercent}%` : "Add Media"}
                  <input
                    type="file"
                    accept="image/*,video/*"
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
          )}
          {activeTab === "photos" &&'''
text = replace_once(text, old_content_start, new_content_start, "photo content header")

old_photo_grid = '''                  className={cn(
                    "grid gap-2",
                    form.design.gridStyle === "Horizontal"
                      ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
                      : "grid-cols-3 md:grid-cols-5 xl:grid-cols-6",
                    form.design.thumbnailSize === "Large" &&
                      "md:grid-cols-4 xl:grid-cols-5",
                  )}'''
new_photo_grid = '''                  className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-8"'''
text = replace_once(text, old_photo_grid, new_photo_grid, "photo grid layout")

text = text.replace(
    '"group relative animate-in fade-in zoom-in-95 text-left transition-all duration-300 ease-out",',
    '"group relative animate-in fade-in zoom-in-95 bg-[#fafafa] p-2 text-left transition-all duration-300 ease-out",',
    1,
)
text = text.replace(
    '''                              "w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105",
                              form.design.gridStyle === "Horizontal" ? "aspect-[1.45]" : "aspect-square",''',
    '''                              "aspect-[1.35] w-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.02]",''',
    1,
)
text = text.replace(
    '''                              "w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105",
                              form.design.gridStyle === "Horizontal"
                                ? "aspect-[1.45]"
                                : "aspect-square",''',
    '''                              "aspect-[1.35] w-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.02]",''',
    1,
)

old_activity_props = '''              favoriteLists={activityQuery.data?.data.favoriteLists ?? []}
              downloads={activityQuery.data?.data.downloads ?? []}
              orders={collectionOrders}'''
new_activity_props = '''              favoriteLists={
                Array.isArray(activityQuery.data?.data?.favoriteLists)
                  ? activityQuery.data.data.favoriteLists
                  : []
              }
              downloads={
                Array.isArray(activityQuery.data?.data?.downloads)
                  ? activityQuery.data.data.downloads
                  : []
              }
              emailRegistrations={
                Array.isArray(activityQuery.data?.data?.emailRegistrations)
                  ? activityQuery.data.data.emailRegistrations
                  : []
              }
              privatePhotos={
                Array.isArray(activityQuery.data?.data?.privatePhotos)
                  ? activityQuery.data.data.privatePhotos
                  : []
              }
              orders={collectionOrders}'''
text = replace_once(text, old_activity_props, new_activity_props, "activity data props")

old_panel_params = '''function CollectionActivityPanel({
  loading,
  favoriteLists,
  downloads,
  emailRegistrations,
  privatePhotos,
  orders,
  collectionName,
  collectionImages,
  publicLink,
  activityPage,
  emailTemplates,
  favoriteSettings,
  accessSettings,'''
new_panel_params = '''function CollectionActivityPanel({
  loading,
  favoriteLists = [],
  downloads = [],
  emailRegistrations = [],
  privatePhotos = [],
  orders = [],
  collectionName,
  collectionImages = [],
  publicLink,
  activityPage,
  emailTemplates = [],
  favoriteSettings,
  accessSettings = {},'''
text = replace_once(text, old_panel_params, new_panel_params, "activity defaults")

old_contacts_branch = ''') : activityPage === "contacts" ? (
        <CollectionRegistrationActivity'''
new_contacts_branch = ''') : activityPage === "links" ? (
        <section className="max-w-[900px]">
          <h2 className="text-2xl font-medium">Quick Share Links</h2>
          <p className="mt-2 text-sm text-[#666]">
            Copy this direct collection link and share it with your client.
          </p>
          <div className="mt-8 flex flex-col gap-4 border bg-[#fafafa] p-6 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 break-all bg-white px-4 py-3 text-sm text-[#555]">
              {publicLink}
            </p>
            <Button
              className="h-11 shrink-0 rounded-none bg-[#22bda7] px-6 text-white"
              onClick={async () => {
                await navigator.clipboard.writeText(publicLink);
                toast.success("Collection link copied");
              }}
            >
              <Copy className="size-4" />
              Copy Link
            </Button>
          </div>
        </section>
      ) : activityPage === "contacts" ? (
        <CollectionRegistrationActivity'''
text = replace_once(text, old_contacts_branch, new_contacts_branch, "quick share activity")

DASHBOARD.write_text(text, encoding="utf-8")

registration = REGISTRATION.read_text(encoding="utf-8")
registration = replace_once(
    registration,
    '''  mode,
  registrations,
  privatePhotos,
  collectionName,''',
    '''  mode,
  registrations = [],
  privatePhotos = [],
  collectionName,''',
    "registration defaults",
)
registration = replace_once(
    registration,
    '  const contacts = registrations.filter((item) => item.marketingOptIn);',
    '  const contacts = (Array.isArray(registrations) ? registrations : []).filter((item) => item.marketingOptIn);',
    "registration safe filter",
)
REGISTRATION.write_text(registration, encoding="utf-8")

print("Collection detail runtime, navigation, and layout fixes applied")
