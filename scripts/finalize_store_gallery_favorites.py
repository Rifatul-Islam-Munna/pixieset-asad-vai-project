from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing expected block: {label}")
    return text.replace(old, new, 1)


# Mobile Gallery: remove top utility icons and use a real delete confirmation modal.
path = Path("frontend/components/mobile-gallery/mobile-gallery-admin.tsx")
text = path.read_text()
text = text.replace("  MoreHorizontal,\n", "")
text = text.replace("  Settings,\n", "")
text = replace_once(
    text,
    '          <div className="flex shrink-0 items-center gap-3 text-[#777]"><Link href="/dashboard/mobile-gallery#search-apps" aria-label="Search mobile gallery apps" className="rounded p-1.5 hover:bg-white hover:text-[#18bfa6]"><Search className="size-5" /></Link><Link href="/dashboard/mobile-gallery/settings" aria-label="Mobile gallery settings" className="rounded p-1.5 hover:bg-white hover:text-[#18bfa6]"><Settings className="size-5" /></Link></div>\n',
    '',
    'mobile top utility icons',
)
text = replace_once(
    text,
    '  const [query, setQuery] = useState("");\n',
    '  const [query, setQuery] = useState("");\n  const [deleteTarget, setDeleteTarget] = useState<MobileGalleryApp | null>(null);\n',
    'mobile delete state',
)
old_card = '              <div className="flex items-center justify-between pt-3"><button onClick={() => router.push(`/dashboard/mobile-gallery/apps/${app._id}`)} className="truncate pr-3 text-left text-sm font-semibold uppercase">{app.name}</button><button onClick={async () => { if (confirm(`Delete ${app.name}?`)) await deleteApp.mutateAsync(app._id).catch((error) => toast.error(error.message)); }} className="rounded-full p-2 text-[#18bfa6] hover:bg-[#f4f4f4]"><MoreHorizontal className="size-5" /></button></div>'
new_card = '''              <div className="flex items-center justify-between pt-3">
                <button onClick={() => router.push(`/dashboard/mobile-gallery/apps/${app._id}`)} className="truncate pr-3 text-left text-sm font-semibold uppercase">{app.name}</button>
                <button onClick={() => setDeleteTarget(app)} className="rounded-full p-2 text-red-500 transition hover:bg-red-50" aria-label={`Delete ${app.name}`} title="Delete app"><Trash2 className="size-5" /></button>
              </div>'''
text = replace_once(text, old_card, new_card, 'mobile card delete button')
create_modal = '      {createOpen && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4"><form onSubmit={submit} className="w-full max-w-md bg-white p-6 shadow-2xl"><div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">Create Mobile Gallery App</h2><button type="button" onClick={() => setCreateOpen(false)}><X className="size-5" /></button></div><Field label="App Name" value={name} onChange={setName} required /><label className="mt-5 block text-sm font-semibold">Event Date<input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className="mt-2 h-12 w-full border px-4 font-normal outline-none focus:border-[#18bfa6]" /></label><button disabled={createApp.isPending} className="mt-7 w-full bg-[#18bfa6] px-5 py-3 font-semibold text-white">{createApp.isPending ? "Creating…" : "Create App"}</button></form></div>}\n'
delete_modal = '''      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => { if (event.currentTarget === event.target && !deleteApp.isPending) setDeleteTarget(null); }}>
          <div className="w-full max-w-md bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">Delete app</p><h2 className="mt-2 text-xl font-semibold">Delete {deleteTarget.name}?</h2></div>
              <button type="button" disabled={deleteApp.isPending} onClick={() => setDeleteTarget(null)} aria-label="Close delete confirmation"><X className="size-5" /></button>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#666]">This permanently removes the mobile gallery app and its uploaded photos. This action cannot be undone.</p>
            <div className="mt-7 flex justify-end gap-3">
              <button type="button" disabled={deleteApp.isPending} onClick={() => setDeleteTarget(null)} className="border px-5 py-3 text-sm font-semibold">Cancel</button>
              <button type="button" disabled={deleteApp.isPending} onClick={async () => { try { await deleteApp.mutateAsync(deleteTarget._id); toast.success("Mobile gallery app deleted"); setDeleteTarget(null); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete app"); } }} className="flex items-center gap-2 bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"><Trash2 className="size-4" />{deleteApp.isPending ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
'''
text = replace_once(text, create_modal, create_modal + delete_modal, 'mobile delete modal')
path.write_text(text)


# Store header: compact product switcher, real order notifications, and logout only.
path = Path("frontend/components/dashboard/client-dashboard.tsx")
text = path.read_text()
start = text.index('          <DropdownMenu>\n', text.index('function StoreTopNavigation'))
end = text.index('          </DropdownMenu>\n', start) + len('          </DropdownMenu>\n')
compact_switcher = '''          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex min-w-0 items-center gap-2 text-sm font-semibold outline-none">
                <span className="flex size-[18px] items-center justify-center rounded-full bg-[#ff4f5d]"><span className="h-[2px] w-3 bg-white" /></span>
                <span>Store Gallery</span>
                <ChevronDown className="size-4 text-[#333]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[calc(100vw-2rem)] max-w-[340px] rounded-none border bg-white p-3 shadow-[0_18px_45px_rgba(0,0,0,0.14)]">
              {switcherItems.map((item) => (
                <DropdownMenuItem key={item.key} asChild className="rounded-none p-0 focus:bg-transparent">
                  <Link href={item.href} className={cn("block w-full px-4 py-3 hover:bg-[#f5f5f5]", item.key === "store-gallery" && "bg-[#fff4f5]")}>
                    <span className="block font-bold text-[#151515]">{item.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#777]">{item.text}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
'''
text = text[:start] + compact_switcher + text[end:]
old_icons = '''        <div className="flex shrink-0 items-center gap-2 text-[#8a8a8a] sm:gap-4">
          <button className="hidden size-8 items-center justify-center rounded-full hover:bg-white sm:flex" aria-label="Help">
            <Info className="size-5" />
          </button>
          <button className="hidden size-8 items-center justify-center rounded-full hover:bg-white sm:flex" aria-label="Notifications">
            <Bell className="size-5" />
          </button>
          <button
            className="flex size-8 items-center justify-center rounded-full bg-white text-[#555] hover:text-red-600 disabled:opacity-50"
            onClick={logout}
            disabled={logoutPending}
            aria-label="Logout"
          >
            <CircleUserRound className="size-5" />
          </button>
        </div>'''
new_icons = '''        <div className="flex shrink-0 items-center gap-3 text-[#666]">
          <DashboardNotifications />
          <button className="flex size-8 items-center justify-center rounded-full bg-white text-[#555] transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50" onClick={logout} disabled={logoutPending} aria-label="Logout" title="Logout">
            <LogOut className="size-5" />
          </button>
        </div>'''
text = replace_once(text, old_icons, new_icons, 'store top icons')
path.write_text(text)


# Public collection: ZIP download replaces Install App, and favorites work by saved email without login.
path = Path("frontend/components/dashboard/public-gallery.tsx")
text = path.read_text()
text = replace_once(
    text,
    'import { cn } from "@/lib/utils";\n',
    'import { cn } from "@/lib/utils";\nimport { usePublicGalleryFavorites } from "./public-gallery-favorites";\n',
    'public favorite hook import',
)
type_start = text.index('type BeforeInstallPromptEvent = Event & {')
type_end = text.index('\n};\n', type_start) + len('\n};\n')
text = text[:type_start] + text[type_end:]
for line in [
    '  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);\n',
    '  const [isStandaloneApp, setIsStandaloneApp] = useState(false);\n',
    '  const [installRequested, setInstallRequested] = useState(false);\n',
    '  const [collectionFavorited, setCollectionFavorited] = useState(false);\n',
    '  const [favoriteImageIds, setFavoriteImageIds] = useState<Set<string>>(() => new Set());\n',
    '  const [favoriteBusy, setFavoriteBusy] = useState(false);\n',
    '  const [favoriteImageBusy, setFavoriteImageBusy] = useState("");\n',
]:
    text = replace_once(text, line, '', f'remove state {line.strip()}')
text = replace_once(
    text,
    '  const [zipDownloading, setZipDownloading] = useState(false);\n',
    '  const [zipDownloading, setZipDownloading] = useState(false);\n  const [zipStage, setZipStage] = useState("Preparing your photos");\n',
    'zip stage state',
)
favorite_block = '''  const favoriteSettings = collection?.settings?.favorite;
  const favoritesEnabled = favoriteSettings?.favoritePhotos !== false;
  const maxFavoriteCount = Number(favoriteSettings?.maxFavorites || 0);
  const canFavoriteMore = !maxFavoriteCount || favoriteImageIds.size < maxFavoriteCount;
'''
favorite_hook = '''  const favoriteSettings = collection?.settings?.favorite;
  const favoritesEnabled = favoriteSettings?.favoritePhotos !== false;
  const maxFavoriteCount = Number(favoriteSettings?.maxFavorites || 0);
  const favoriteTools = usePublicGalleryFavorites({
    collectionId: collection?._id,
    identifier: collection?.slug ?? galary,
    collectionTitle: title,
    images: galleryImages,
    enabled: favoritesEnabled,
    maxFavorites: maxFavoriteCount,
  });
  const {
    collectionFavorited,
    favoriteImageIds,
    favoriteBusy,
    favoriteImageBusy,
    toggleCollectionFavorite,
    toggleImageFavorite,
  } = favoriteTools;
'''
text = replace_once(text, favorite_block, favorite_hook, 'favorite hook setup')

text = text.replace(
    '      : visibleImages.length;\n    const downloadable = visibleImages.slice(0, remaining || visibleImages.length);',
    '      : galleryImages.length;\n    const downloadable = galleryImages.slice(0, remaining || galleryImages.length);',
    1,
)
text = replace_once(text, '    setZipDownloading(true);\n', '    setZipDownloading(true);\n    setZipStage("Collecting gallery photos");\n', 'zip start stage')
text = replace_once(text, '    const response = await fetch("/api/public-download", {\n', '    setZipStage("Creating ZIP archive");\n    const response = await fetch("/api/public-download", {\n', 'zip create stage')
text = replace_once(text, '      const blob = await response.blob();\n', '      setZipStage("Starting download");\n      const blob = await response.blob();\n', 'zip download stage')
text = text.replace(
    '      setZipDownloading(false);\n    }\n  };',
    '      setZipDownloading(false);\n      setZipStage("Preparing your photos");\n    }\n  };',
    1,
)

start = text.index('  const installApp = async () => {')
end = text.index('  const startSlideshow = () => {', start)
text = text[:start] + text[end:]

start = text.index('  useEffect(() => {\n    setIsStandaloneApp(')
end = text.index('  useEffect(() => {\n    const startUrl =', start)
text = text[:start] + text[end:]
start = text.index('  useEffect(() => {\n    if (isStandaloneApp) return;')
end = text.index('  useEffect(() => {\n    const identifier = collection?.slug ?? galary;', start)
text = text[:start] + text[end:]
start = text.index('  useEffect(() => {\n    const identifier = collection?.slug ?? galary;')
end = text.index('  useEffect(() => {\n    if (slideshowIndex === null', start)
text = text[:start] + text[end:]

old_top_text = '''              {!isStandaloneApp && (
                <button className="flex items-center gap-2 text-sm" onClick={() => void installApp()} type="button">
                  <Download className="size-4" /> Install
                </button>
              )}'''
new_top_text = '''              <button className="flex items-center gap-2 text-sm" onClick={favoriteTools.openFavorites} type="button">
                <Heart className="size-4" /> My Favorites
              </button>
              {canDownload && (
                <button className="flex items-center gap-2 text-sm disabled:opacity-50" onClick={() => void downloadAllImages()} disabled={zipDownloading} type="button">
                  {zipDownloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} {zipDownloading ? "Preparing" : "Download All"}
                </button>
              )}'''
text = replace_once(text, old_top_text, new_top_text, 'top text install replacement')
old_top_icon = '''              {!isStandaloneApp && (
                <button onClick={() => void installApp()} type="button" aria-label="Install app">
                  <Download className="size-5" />
                </button>
              )}'''
new_top_icon = '''              <button onClick={favoriteTools.openFavorites} type="button" aria-label="My Favorites" title="My Favorites">
                <Heart className="size-5" />
              </button>
              {canDownload && (
                <button onClick={() => void downloadAllImages()} disabled={zipDownloading} type="button" aria-label={zipDownloading ? "Preparing ZIP download" : "Download all photos"} title="Download all photos">
                  {zipDownloading ? <Loader2 className="size-5 animate-spin" /> : <Download className="size-5" />}
                </button>
              )}'''
text = replace_once(text, old_top_icon, new_top_icon, 'top icon install replacement')

old_sticky_install = '''            {!isStandaloneApp && (
              <button className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition hover:bg-black/5 md:w-10 md:justify-center md:px-0" onClick={() => void installApp()} type="button" title="Install app" aria-label="Install app">
                <Download className="size-4" />
                <span className="hidden sm:inline md:sr-only">Install</span>
              </button>
            )}'''
new_sticky_favorites = '''            <button className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition hover:bg-black/5 md:w-10 md:justify-center md:px-0" onClick={favoriteTools.openFavorites} type="button" title="My Favorites" aria-label="My Favorites">
              <Heart className="size-4" />
              <span className="hidden sm:inline md:sr-only">My Favorites</span>
            </button>'''
text = replace_once(text, old_sticky_install, new_sticky_favorites, 'sticky install replacement')

if '        {installRequested && !isStandaloneApp && (' in text:
    start = text.index('        {installRequested && !isStandaloneApp && (')
    end = text.index('        {shareNotice && (', start)
    text = text[:start] + text[end:]

pin_marker = '      {pinDialogOpen && (\n'
overlays = '''      {favoriteTools.overlays}
      {zipDownloading && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white p-7 text-center text-[#202326] shadow-[0_28px_90px_rgba(0,0,0,0.32)]">
            <div className="relative mx-auto flex size-20 items-center justify-center rounded-full bg-[#eef8f6] text-[#009b8c]">
              <Download className="size-7 animate-bounce" />
              <span className="absolute inset-0 animate-ping rounded-full border border-[#19bda8]/30" />
            </div>
            <h2 className="mt-6 text-xl font-semibold">Preparing ZIP download</h2>
            <p className="mt-2 text-sm text-[#666]">{zipStage}</p>
            <div className="mx-auto mt-6 flex w-28 items-end justify-center gap-1.5">
              {[0, 1, 2, 3, 4].map((index) => <span key={index} className="h-2 w-3 animate-pulse rounded-full bg-[#18bfa6]" style={{ animationDelay: `${index * 120}ms` }} />)}
            </div>
          </div>
        </div>
      )}
'''
text = replace_once(text, pin_marker, overlays + pin_marker, 'favorite and zip overlays')

for forbidden in [
    'installApp()',
    'isStandaloneApp',
    'installRequested',
    'installPrompt',
    '/api/collection-favorites',
    '/api/collection-image-favorites',
]:
    if forbidden in text:
        raise SystemExit(f"Obsolete public gallery code remains: {forbidden}")
path.write_text(text)
