from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# Collection dashboard: dedupe set IDs and rebuild the header menus.
# -----------------------------------------------------------------------------
path = ROOT / "frontend/components/dashboard/client-dashboard.tsx"
text = path.read_text()

marker = "function CollectionDetailView({\n"
helper = '''function uniqueCollectionSets(
  sets?: Array<{
    id: string;
    name: string;
    watermarkId?: string;
    createdAt?: string;
  }>,
) {
  const seen = new Set<string>();
  const unique = (sets ?? []).filter((set) => {
    const id = String(set?.id ?? "").trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return unique.length ? unique : [{ id: "highlights", name: "Highlights" }];
}

function collectionFormWithUniqueSets(collection?: CollectionRecord) {
  const next = collectionForm(collection);
  return { ...next, sets: uniqueCollectionSets(next.sets) };
}

'''
text = replace_once(text, marker, helper + marker, "insert set helpers")

text = replace_once(
    text,
    "  const { collectionsQuery } = useCollections();",
    "  const { collectionsQuery, duplicateCollection, deleteCollection } = useCollections();",
    "collection detail mutations",
)

old_sets = '''  const sets = useMemo(
    () =>
      detail?.sets?.length
        ? detail.sets
        : [{ id: "highlights", name: "Highlights" }],
    [detail?.sets],
  );'''
new_sets = '''  const sets = useMemo(
    () => uniqueCollectionSets(detail?.sets),
    [detail?.sets],
  );'''
text = replace_once(text, old_sets, new_sets, "dedupe dashboard sets")

text = replace_once(
    text,
    '  const [shareOpen, setShareOpen] = useState(false);',
    '  const [shareOpen, setShareOpen] = useState(false);\n  const [deleteCollectionConfirmOpen, setDeleteCollectionConfirmOpen] = useState(false);',
    "delete confirmation state",
)

text = replace_once(
    text,
    '  const [form, setForm] = useState(() => collectionForm(collection));',
    '  const [form, setForm] = useState(() => collectionFormWithUniqueSets(collection));',
    "dedupe initial collection form",
)
text = text.replace(
    'const nextForm = collectionForm(collection);',
    'const nextForm = collectionFormWithUniqueSets(collection);',
)
text = text.replace(
    'const nextForm = collectionForm(response.data);',
    'const nextForm = collectionFormWithUniqueSets(response.data);',
)
text = replace_once(
    text,
    '      sets: syncSetsFromPhotoSets(form.sets, form.general.photoSets),',
    '      sets: syncSetsFromPhotoSets(uniqueCollectionSets(form.sets), form.general.photoSets),',
    "dedupe saved sets",
)
text = replace_once(
    text,
    '            sets: [...value.sets, nextSet],',
    '            sets: uniqueCollectionSets([...value.sets, nextSet]),',
    "dedupe newly added set",
)

insert_marker = '''  if (!collection) {
    return <CollectionDetailSkeleton />;
  }
'''
insert_code = '''  const changeCollectionStatus = (nextStatus: "draft" | "published") => {
    if (!collection || nextStatus === collectionStatus || updateCollection.isPending)
      return;
    setCollectionStatus(nextStatus);
    updateCollection.mutate(
      { status: nextStatus },
      {
        onSuccess: () =>
          toast.success(nextStatus === "published" ? "Collection published" : "Collection hidden"),
        onError: (error) => {
          setCollectionStatus(collection.status === "published" ? "published" : "draft");
          toast.error(error instanceof Error ? error.message : "Status update failed");
        },
      },
    );
  };
  const duplicateCurrentCollection = () => {
    if (!collection || duplicateCollection.isPending) return;
    duplicateCollection.mutate(collection._id, {
      onSuccess: (response) => {
        toast.success("Collection duplicated");
        const duplicatedId = response?.data?.collection?._id;
        if (duplicatedId)
          router.push(`/dashboard/${section}/collections/${duplicatedId}`);
      },
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "Duplicate failed"),
    });
  };
  const deleteCurrentCollection = () => {
    if (!collection || deleteCollection.isPending) return;
    deleteCollection.mutate(collection._id, {
      onSuccess: () => {
        setDeleteCollectionConfirmOpen(false);
        toast.success("Collection deleted");
        router.push(`/dashboard/${section}`);
      },
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "Delete failed"),
    });
  };

'''
text = replace_once(text, insert_marker, insert_code + insert_marker, "collection header actions")

header_pattern = re.compile(
    r'''      <header className="flex h-\[90px\] shrink-0 items-center justify-between gap-6 border-b border-\[#e8e8e8\] bg-white px-7">.*?      </header>''',
    re.S,
)
header_replacement = '''      <header className="flex h-[90px] shrink-0 items-center justify-between gap-6 border-b border-[#e8e8e8] bg-white px-7">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-2 rounded-full bg-[#e8f7f3] px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#009786]"
                  >
                    {collectionStatus === "published" ? "Published" : "Hidden"}
                    <ChevronDown className="size-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52 rounded-none p-2">
                  <DropdownMenuItem
                    className="h-11 rounded-none"
                    onSelect={() => changeCollectionStatus("published")}
                  >
                    <span className="flex-1">Published</span>
                    {collectionStatus === "published" && <Check className="size-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="h-11 rounded-none"
                    onSelect={() => changeCollectionStatus("draft")}
                  >
                    <span className="flex-1">Hidden</span>
                    {collectionStatus === "draft" && <Check className="size-4" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="mt-2 text-sm text-[#777]">{formatDate(collection.eventDate)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-8 text-sm">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-2 font-medium text-[#222]" type="button">
                More
                <ChevronDown className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-none p-2">
              <DropdownMenuItem className="h-11 rounded-none" onSelect={() => void copyPublicLink().then(() => toast.success("Direct link copied"))}>
                <Link2 className="size-4" />
                Get direct link
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-11 rounded-none"
                onSelect={() => {
                  setActiveTab("download");
                  setActivityPage("email");
                }}
              >
                <RefreshCw className="size-4" />
                View email history
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-11 rounded-none"
                onSelect={() => router.push(`/dashboard/${section}/settings/presets`)}
              >
                <Settings className="size-4" />
                Manage presets
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-11 rounded-none"
                onSelect={() => {
                  toast.info("Choose the destination from the Collections page");
                  router.push(`/dashboard/${section}`);
                }}
              >
                <ArrowRight className="size-4" />
                Move to
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-11 rounded-none"
                disabled={duplicateCollection.isPending}
                onSelect={duplicateCurrentCollection}
              >
                <Copy className="size-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="h-11 rounded-none text-red-600 focus:text-red-600"
                onSelect={() => setDeleteCollectionConfirmOpen(true)}
              >
                <Trash2 className="size-4" />
                Delete collection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            className="font-medium text-[#222]"
            onClick={() => window.open(publicLink, "_blank", "noopener,noreferrer")}
            type="button"
          >
            Preview
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex h-10 items-center bg-[#22bda7] font-bold text-white hover:bg-[#19a995]" type="button">
                <span className="px-7">Share</span>
                <span className="flex h-6 items-center border-l border-white/30 px-4">
                  <ChevronDown className="size-4" />
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-none p-2">
              <DropdownMenuItem className="h-11 rounded-none" onSelect={() => setShareOpen(true)}>
                <Mail className="size-4" />
                Share by email
              </DropdownMenuItem>
              <DropdownMenuItem className="h-11 rounded-none" onSelect={() => void copyPublicLink().then(() => toast.success("Direct link copied"))}>
                <Link2 className="size-4" />
                Get direct link
              </DropdownMenuItem>
              <DropdownMenuItem className="h-11 rounded-none" onSelect={() => setShareOpen(true)}>
                <QrCode className="size-4" />
                Get QR code
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>'''
text, count = header_pattern.subn(header_replacement, text, count=1)
if count != 1:
    raise RuntimeError(f"collection header: expected 1 match, found {count}")

text = replace_once(
    text,
    '''      </Dialog>\n\n      {uploading && (''',
    '''      </Dialog>\n\n      <DeleteConfirmDialog\n        open={deleteCollectionConfirmOpen}\n        title="Delete collection"\n        description={`Delete "${collection.name}" and all of its media? This action cannot be undone.`}\n        pending={deleteCollection.isPending}\n        onCancel={() => setDeleteCollectionConfirmOpen(false)}\n        onConfirm={deleteCurrentCollection}\n      />\n\n      {uploading && (''',
    "collection delete dialog",
)

path.write_text(text)


# -----------------------------------------------------------------------------
# Public gallery: dedupe set IDs and reliably show marketing subscription UI.
# -----------------------------------------------------------------------------
path = ROOT / "frontend/components/dashboard/public-gallery.tsx"
text = path.read_text()

old_gallery_sets = '''  const gallerySets = useMemo(
    () => collection?.sets?.length
      ? collection.sets
      : [{ id: "highlights", name: "Highlights" }],
    [collection?.sets],
  );'''
new_gallery_sets = '''  const gallerySets = useMemo(() => {
    const seen = new Set<string>();
    const unique = (collection?.sets ?? []).filter((set) => {
      const id = String(set?.id ?? "").trim();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return unique.length ? unique : [{ id: "highlights", name: "Highlights" }];
  }, [collection?.sets]);'''
text = replace_once(text, old_gallery_sets, new_gallery_sets, "dedupe public gallery sets")

text = replace_once(
    text,
    '''  const marketing = collection?.marketing ?? {};
  const marketingOptIn = marketing.optIn ?? {};
  const marketingPopup = marketing.popup ?? {};''',
    '''  const marketing = collection?.marketing ?? {};
  const marketingOptIn = marketing.optIn ?? {};
  const marketingPopup = marketing.popup ?? {};
  const marketingEmailRegistrationEnabled = marketingOptIn.emailRegistration !== false;
  const marketingPopupEnabled = marketingPopup.enabled !== false;''',
    "marketing defaults",
)

text = replace_once(
    text,
    '''  const [popupOpen, setPopupOpen] = useState(() =>
    Boolean(marketingSubscriptionEnabled && marketingPopup.enabled),
  );''',
    '''  const [popupOpen, setPopupOpen] = useState(() =>
    Boolean(marketingSubscriptionEnabled && marketingPopupEnabled),
  );''',
    "popup initial state",
)

old_effect = '''  useEffect(() => {
    if (!collection || !marketingSubscriptionEnabled || !marketingPopup.enabled) {
      setPopupOpen(false);
      return;
    }
    const key = `gallery-marketing-popup:${collection._id}`;
    if (!window.sessionStorage.getItem(key)) setPopupOpen(true);
  }, [collection?._id, marketingPopup.enabled, marketingSubscriptionEnabled]);

  const closeMarketingPopup = () => {
    if (collection?._id) window.sessionStorage.setItem(`gallery-marketing-popup:${collection._id}`, "1");
    setPopupOpen(false);
  };'''
new_effect = '''  useEffect(() => {
    setPopupOpen(
      Boolean(
        collection &&
          marketingSubscriptionEnabled &&
          marketingPopupEnabled &&
          !emailAccessLocked,
      ),
    );
  }, [collection?._id, emailAccessLocked, marketingPopupEnabled, marketingSubscriptionEnabled]);

  const closeMarketingPopup = () => setPopupOpen(false);'''
text = replace_once(text, old_effect, new_effect, "marketing popup load behavior")

text = text.replace(
    'popupOpen && marketingSubscriptionEnabled && marketingPopup.enabled',
    'popupOpen && marketingSubscriptionEnabled && marketingPopupEnabled',
)
text = text.replace(
    'marketingSubscriptionEnabled && marketingOptIn.emailRegistration',
    'marketingSubscriptionEnabled && marketingEmailRegistrationEnabled',
)

path.write_text(text)

print("Collection UI, duplicate keys, and marketing modal fixes applied.")
