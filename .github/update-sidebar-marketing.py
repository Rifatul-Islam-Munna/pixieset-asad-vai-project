from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


# Default the dashboard to the compact icon rail.
store_path = Path("frontend/lib/dashboard-store.ts")
store = store_path.read_text()
store = replace_once(
    store,
    "  collapsed: false,",
    "  collapsed: true,",
    "default compact sidebar",
)
store_path.write_text(store)


path = Path("frontend/components/dashboard/client-dashboard.tsx")
text = path.read_text()

# Compact, polished collapsible dashboard rail.
text = replace_once(
    text,
    '"fixed inset-y-0 left-0 hidden border-r border-[#e6e6e6] bg-white transition-all md:flex md:flex-col",\n            collapsed ? "w-[76px]" : "w-[292px]",',
    '"fixed inset-y-0 left-0 z-40 hidden border-r border-[#e8e8e8] bg-white shadow-[4px_0_20px_rgba(0,0,0,0.025)] transition-[width] duration-200 md:flex md:flex-col",\n            collapsed ? "w-[72px]" : "w-[248px]",',
    "sidebar width",
)
text = replace_once(
    text,
    '<div className="flex h-[62px] items-center justify-between border-b border-[#f1f1f1] px-4">',
    '<div className={cn("flex h-[72px] items-center border-b border-[#f1f1f1]", collapsed ? "justify-center px-2" : "justify-between px-4")}>',
    "sidebar header",
)
text = replace_once(
    text,
    '<button className="flex items-center gap-2 text-sm font-bold outline-none">',
    '<button className={cn("flex h-11 items-center rounded-md text-sm font-bold outline-none hover:bg-[#f5f7f7]", collapsed ? "w-11 justify-center" : "gap-3 px-2")} title={collapsed ? active.title : undefined}>',
    "switcher button",
)
text = replace_once(
    text,
    '<nav className="flex flex-1 flex-col px-4 py-7">',
    '<nav className={cn("flex min-h-0 flex-1 flex-col py-5", collapsed ? "px-2" : "px-3")}>',
    "sidebar nav",
)
text = replace_once(
    text,
    '<div className="flex flex-col gap-8">',
    '<div className="flex flex-col gap-2">',
    "main nav spacing",
)
text = replace_once(
    text,
    '''                  className={cn(
                    "flex items-center gap-4 text-left text-base text-[#222]",
                    activeNav === item.label && "font-semibold text-[#00a997]",
                  )}
                >''',
    '''                  className={cn(
                    "group flex h-12 items-center rounded-md text-left text-sm text-[#333] transition-colors hover:bg-[#f5f7f7]",
                    collapsed ? "justify-center px-0" : "gap-4 px-3",
                    activeNav === item.label && "bg-[#eaf8f5] font-semibold text-[#009b8c]",
                  )}
                  title={collapsed ? item.label : undefined}
                >''',
    "main nav item",
)
text = replace_once(
    text,
    '<div className="mt-11 flex flex-col gap-8">',
    '<div className="mt-5 flex flex-col gap-2 border-t border-[#eeeeee] pt-5">',
    "marketing group",
)
text = replace_once(
    text,
    '''                  className={cn(
                    "flex items-center gap-4 text-left text-base text-[#222]",
                    page === "marketing" && "font-semibold text-[#00a997]",
                  )}
                >''',
    '''                  className={cn(
                    "flex h-12 items-center rounded-md text-left text-sm text-[#333] transition-colors hover:bg-[#f5f7f7]",
                    collapsed ? "justify-center px-0" : "gap-4 px-3",
                    page === "marketing" && "bg-[#eaf8f5] font-semibold text-[#009b8c]",
                  )}
                  title={collapsed ? "Marketing" : undefined}
                >''',
    "marketing nav item",
)
text = replace_once(
    text,
    '<div className="ml-7 flex flex-col border-l border-[#e8e8e8] pl-4">',
    '<div className="ml-5 flex flex-col border-l border-[#e8e8e8] pl-3">',
    "marketing nested nav",
)
text = replace_once(
    text,
    '"flex h-12 items-center gap-4 px-3 text-base text-[#222]",',
    '"flex h-11 items-center gap-3 rounded-md px-3 text-sm text-[#333] hover:bg-[#f7f7f7]",',
    "nested marketing items",
)
text = replace_once(
    text,
    '<div className="mt-auto grid gap-4 pt-8">',
    '<div className="mt-auto grid gap-2 border-t border-[#eeeeee] pt-4">',
    "sidebar bottom",
)
text = replace_once(
    text,
    '''                    "flex items-center gap-3 bg-[#f3faf6] text-left",
                    collapsed
                      ? "mx-auto size-12 justify-center p-0"
                      : "w-full p-4",''',
    '''                    "flex items-center rounded-md text-left transition-colors hover:bg-[#eef8f6]",
                    collapsed
                      ? "mx-auto size-11 justify-center p-0"
                      : "w-full gap-3 bg-[#f3faf6] p-3",''',
    "storage link",
)
text = replace_once(
    text,
    '<div className="flex size-10 items-center justify-center rounded-full bg-[#dff6ef] text-[#19bba7]">',
    '<div className="flex size-9 items-center justify-center rounded-md bg-[#dff6ef] text-[#19bba7]">',
    "storage icon",
)
text = replace_once(
    text,
    '''              <button
                className={cn(
                  "flex items-center gap-3 text-sm font-semibold text-[#555] hover:text-red-600 disabled:opacity-50",
                  collapsed && "justify-center",
                )}
                onClick={logout}''',
    '''              {section === "client-gallery" && collapsed && (
                <div className="flex h-11 items-center justify-center" title="Notifications">
                  <DashboardNotifications />
                </div>
              )}
              {collapsed && (
                <Link
                  href="/dashboard/client-gallery/account"
                  className="flex h-11 items-center justify-center"
                  aria-label="Account profile"
                  title="Account"
                >
                  <Avatar className="size-8">
                    <AvatarImage src={billingUser?.avatar || ""} />
                    <AvatarFallback className="bg-[#dff3ef] text-[#0b9f91]">
                      {billingUser?.name?.slice(0, 1).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              )}
              <button
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-[#555] hover:bg-red-50 hover:text-red-600 disabled:opacity-50",
                  collapsed && "justify-center px-0",
                )}
                title={collapsed ? "Log out" : undefined}
                onClick={logout}''',
    "compact bottom actions",
)
text = replace_once(
    text,
    '''                className={cn(
                  "flex items-center text-[#333]",
                  collapsed && "justify-center",
                )}''',
    '''                className={cn(
                  "flex h-11 items-center rounded-md px-3 text-[#555] hover:bg-[#f5f7f7]",
                  collapsed ? "justify-center px-0" : "gap-3",
                )}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}''',
    "collapse button",
)
text = replace_once(
    text,
    '''              <button
                className={cn(
                  "flex h-11 items-center rounded-md px-3 text-[#555] hover:bg-[#f5f7f7]",
                  collapsed ? "justify-center px-0" : "gap-3",
                )}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={toggleCollapsed}
                aria-label="Toggle sidebar"
              >
                <ChevronsLeft
                  className={cn("size-6", collapsed && "rotate-180")}
                />
              </button>''',
    '''              <button
                className={cn(
                  "flex h-11 items-center rounded-md px-3 text-[#555] hover:bg-[#f5f7f7]",
                  collapsed ? "justify-center px-0" : "gap-3",
                )}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={toggleCollapsed}
                aria-label="Toggle sidebar"
              >
                <ChevronsLeft
                  className={cn("size-5 transition-transform", collapsed && "rotate-180")}
                />
                {!collapsed && <span className="text-sm font-medium">Collapse</span>}
              </button>''',
    "collapse label",
)
text = replace_once(
    text,
    '''              ? collapsed
                ? "md:pl-[76px]"
                : "md:pl-[292px]"''',
    '''              ? collapsed
                ? "md:pl-[72px]"
                : "md:pl-[248px]"''',
    "content sidebar offset",
)

# Image compression helper for the marketing pop-up uploader.
helper_anchor = '''const defaultMarketingSettings: MarketingSettings = {
  optIn: {
    emailRegistration: true,
    storeCheckout: true,
    download: false,
    favoriteSignIn: false,
  },
  popup: {
    enabled: true,
    title: "Stay Connected",
    body: "Sign up to get updates and special offers from your photography studio.",
    button: "Subscribe",
    imageUrl: "",
  },
};
'''
helper_replacement = helper_anchor + '''
function optimiseMarketingPopupImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choose a JPG, PNG, or WebP image"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error("Image must be smaller than 10 MB"));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      try {
        const maxSide = 1400;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image could not be processed");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
        resolve(canvas.toDataURL(outputType, 0.84));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image could not be opened"));
    };
    image.src = objectUrl;
  });
}
'''
text = replace_once(text, helper_anchor, helper_replacement, "marketing image helper")

# Marketing settings functionality and flatter Pixieset-style layout.
text = replace_once(
    text,
    '  const [form, setForm] = useState<MarketingSettings>(saved);',
    '  const [form, setForm] = useState<MarketingSettings>(saved);\n  const [popupImageUploading, setPopupImageUploading] = useState(false);',
    "marketing image state",
)
text = replace_once(
    text,
    '''  const save = () => {
    saveSetting.mutate(''',
    '''  const uploadPopupImage = async (file?: File) => {
    if (!file) return;
    setPopupImageUploading(true);
    try {
      const imageUrl = await optimiseMarketingPopupImage(file);
      updatePopup("imageUrl", imageUrl);
      toast.success("Pop-up image ready. Save changes to publish it.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setPopupImageUploading(false);
    }
  };
  const save = () => {
    saveSetting.mutate(''',
    "marketing upload handler",
)
text = replace_once(
    text,
    '  const activeSources = Object.values(form.optIn).filter(Boolean).length;\n\n',
    '',
    "remove subscription source count",
)
text = replace_once(
    text,
    '<div className="mx-auto w-full max-w-[1240px]">',
    '<div className="mx-auto w-full max-w-[1180px]">',
    "marketing max width",
)
text = replace_once(
    text,
    '<div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_440px]">\n        <div className="space-y-7">',
    '<div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_390px]">\n        <div className="divide-y divide-[#e9e9e9] border-y border-[#e9e9e9] bg-white">',
    "marketing grid",
)
text = replace_once(
    text,
    '<section className="overflow-hidden border bg-white">',
    '<section className="px-1 py-8 sm:px-6">',
    "email registration section",
)
text = replace_once(
    text,
    '<div className="border-b bg-[#f4fbf9] px-6 py-5">',
    '<div>',
    "email registration heading",
)
text = replace_once(
    text,
    '<div className="px-6 py-5 text-sm leading-6 text-[#666]">',
    '<div className="mt-5 border-l-2 border-[#22bda7] pl-4 text-sm leading-6 text-[#666]">',
    "email registration note",
)
text = replace_once(
    text,
    '<section className="border bg-white p-6">',
    '<section className="px-1 py-8 sm:px-6">',
    "popup section",
)
text = replace_once(
    text,
    '<div className="mt-7 grid gap-5 border-t pt-7 sm:grid-cols-2">',
    '<div className="mt-8 grid gap-6 border-t border-[#ededed] pt-8 sm:grid-cols-2">',
    "popup form grid",
)

old_image_field = '''              <Field>
                <FieldLabel className="font-bold">Image URL</FieldLabel>
                <Input
                  value={form.popup.imageUrl}
                  onChange={(event) => updatePopup("imageUrl", event.target.value)}
                  placeholder="https://..."
                  className="h-12 rounded-none bg-white"
                />
              </Field>'''
new_image_field = '''              <Field className="sm:col-span-2">
                <FieldLabel className="font-bold">Pop-up image</FieldLabel>
                <div className="mt-2 grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center border border-dashed border-[#cfcfcf] bg-[#fafafa] px-5 py-5 text-center transition hover:border-[#22bda7] hover:bg-[#f4fbf9]">
                    {popupImageUploading ? (
                      <Loader2 className="size-6 animate-spin text-[#22bda7]" />
                    ) : (
                      <Upload className="size-6 text-[#777]" />
                    )}
                    <span className="mt-3 text-sm font-bold text-[#222]">
                      {popupImageUploading ? "Processing image..." : "Upload image"}
                    </span>
                    <span className="mt-1 text-xs text-[#888]">JPG, PNG, or WebP up to 10 MB</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={popupImageUploading}
                      className="hidden"
                      onChange={(event) => {
                        void uploadPopupImage(event.target.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <div className="relative min-h-28 overflow-hidden border bg-[#f4f4f4]">
                    {form.popup.imageUrl ? (
                      <>
                        <img
                          src={form.popup.imageUrl}
                          alt="Subscription pop-up preview"
                          className="h-full min-h-28 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => updatePopup("imageUrl", "")}
                          className="absolute right-2 top-2 flex size-8 items-center justify-center bg-white/95 text-[#444] shadow hover:text-red-600"
                          aria-label="Remove pop-up image"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </>
                    ) : (
                      <div className="flex h-full min-h-28 items-center justify-center px-4 text-center text-xs text-[#999]">
                        Image preview
                      </div>
                    )}
                  </div>
                </div>
              </Field>'''
text = replace_once(text, old_image_field, new_image_field, "marketing image uploader")

other_section = '''
          <section className="border bg-white p-6">
            <div className="flex items-center justify-between gap-5">
              <div>
                <h2 className="text-lg font-bold">Other subscription points</h2>
                <p className="mt-2 text-sm leading-6 text-[#666]">
                  Choose which visitor actions may include an optional marketing
                  subscription checkbox.
                </p>
              </div>
              <span className="rounded-full bg-[#eef8f6] px-3 py-1 text-xs font-bold text-[#008f80]">
                {activeSources} active
              </span>
            </div>
            <div className="mt-6 divide-y border">
              {([
                ["storeCheckout", ShoppingCart, "Store checkout", "Let customers subscribe during checkout."],
                ["download", Download, "Photo and video download", "Offer subscription when an email is collected for downloads."],
                ["favoriteSignIn", Heart, "Favorite sign-in", "Offer subscription when visitors identify themselves for favorites."],
              ] as const).map(([key, Icon, label, text]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-4 px-4 py-4 hover:bg-[#fafafa]"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center bg-[#f4f4f4] text-[#555]">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#777]">
                      {text}
                    </span>
                  </span>
                  <Switch
                    checked={form.optIn[key]}
                    onCheckedChange={(value) => updateOptIn(key, value)}
                  />
                </label>
              ))}
            </div>
          </section>'''
text = replace_once(text, other_section, '', "remove other subscription points")

text = replace_once(
    text,
    '<aside className="bg-[#f3f3f3] p-10">\n      <div className="mx-auto max-w-[450px] bg-white p-10 shadow-[0_22px_60px_rgba(0,0,0,0.08)]">',
    '<aside className="border border-[#e7e7e7] bg-[#f7f7f7] p-6">\n      <div className="mx-auto max-w-[450px] border border-[#ededed] bg-white p-8 shadow-[0_14px_40px_rgba(0,0,0,0.06)]">',
    "marketing preview card",
)
text = replace_once(
    text,
    'className="mb-6 h-32 w-full object-cover"',
    'className="mb-7 h-40 w-full object-cover"',
    "marketing preview image",
)

path.write_text(text)
print("Updated compact dashboard sidebar and marketing settings image uploader.")
