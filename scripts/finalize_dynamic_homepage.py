from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Missing block: {label}")
    return text.replace(old, new, 1)


def replace_after(text: str, anchor: str, old: str, new: str, label: str) -> str:
    start = text.find(anchor)
    if start < 0:
        raise RuntimeError(f"Missing anchor: {label}")
    position = text.find(old, start)
    if position < 0:
        raise RuntimeError(f"Missing block after anchor: {label}")
    return text[:position] + new + text[position + len(old):]


# ---------------------------------------------------------------------------
# Backend: Draft/Published is the collection publication state.
# ---------------------------------------------------------------------------
path = Path("backend/src/collections/collections.service.ts")
text = path.read_text()
text = replace_once(
    text,
    """      presetId: safeDto.presetId,
      design: safeDto.design ?? {},
      settings: safeDto.settings ?? {},""",
    """      presetId: safeDto.presetId,
      status: safeDto.status ?? 'draft',
      design: safeDto.design ?? {},
      settings: safeDto.settings ?? {},""",
    "create collection status",
)
text = replace_once(
    text,
    """  async findPublic(identifier: string) {
    const collection = await this.findCollectionByIdentifier(identifier);

    const images = await this.imageModel""",
    """  async findPublic(identifier: string) {
    const collection = await this.findCollectionByIdentifier(identifier);
    if (collection.status !== 'published') throw new NotFoundException('Collection not found');

    const images = await this.imageModel""",
    "public collection status",
)
text = replace_once(
    text,
    """    const collection = await this.findCollectionByIdentifier(identifier);
    const email = String(body?.email ?? '').trim().toLowerCase();""",
    """    const collection = await this.findCollectionByIdentifier(identifier);
    if (collection.status !== 'published') throw new NotFoundException('Collection not found');
    const email = String(body?.email ?? '').trim().toLowerCase();""",
    "public collection download status",
)
text = replace_once(
    text,
    """    if (dto.expiresAt !== undefined) collection.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    if (dto.design !== undefined) collection.design = dto.design;""",
    """    if (dto.expiresAt !== undefined) collection.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    if (dto.status !== undefined) collection.status = dto.status;
    if (dto.design !== undefined) collection.design = dto.design;""",
    "update collection status",
)
text = text.replace("status: source.status ?? 'draft',", "status: 'draft',")
path.write_text(text)


# ---------------------------------------------------------------------------
# Frontend API payload supports publication status when creating collections.
# ---------------------------------------------------------------------------
path = Path("frontend/api-hooks/use-collections.ts")
text = path.read_text()
text = replace_once(
    text,
    """      presetId?: string;
      design?: Record<string, any>;""",
    """      presetId?: string;
      status?: \"draft\" | \"published\";
      design?: Record<string, any>;""",
    "collection create hook status",
)
path.write_text(text)


# ---------------------------------------------------------------------------
# Client Gallery: real Homepage settings and explicit Draft/Published controls.
# ---------------------------------------------------------------------------
path = Path("frontend/components/dashboard/client-dashboard.tsx")
text = path.read_text()
text = replace_once(
    text,
    'import { PlanFeatureLock, PlanFeatureNotice } from "@/components/dashboard/plan-feature-lock";\n',
    'import { PlanFeatureLock, PlanFeatureNotice } from "@/components/dashboard/plan-feature-lock";\nimport { HomepageSettingsPanel } from "@/components/dashboard/homepage-settings-panel";\n',
    "homepage settings import",
)

start = text.find("function HomepageSettings() {")
end = text.find("\nfunction SearchBox({", start)
if start < 0 or end < 0:
    raise RuntimeError("HomepageSettings block not found")
text = text[:start] + "function HomepageSettings() {\n  return <HomepageSettingsPanel />;\n}\n" + text[end:]

# Starred is an independent settings flag; status is reserved for publication.
text = text.replace(
    '(collection.status === "starred" || collection.settings?.starred === true)',
    'collection.settings?.starred === true',
)

text = replace_once(
    text,
    '  const [quickForm, setQuickForm] = useState({ name: "", eventDate: "" });',
    '  const [quickForm, setQuickForm] = useState({ name: "", eventDate: "", status: "draft" as "draft" | "published" });',
    "quick form status state",
)
text = replace_once(
    text,
    """    setQuickForm({
      name: quickEdit.name,
      eventDate: quickEdit.eventDate ? quickEdit.eventDate.slice(0, 10) : "",
    });""",
    """    setQuickForm({
      name: quickEdit.name,
      eventDate: quickEdit.eventDate ? quickEdit.eventDate.slice(0, 10) : "",
      status: quickEdit.status === "published" ? "published" : "draft",
    });""",
    "quick form hydration",
)
text = replace_once(
    text,
    """        name: quickForm.name.trim(),
        eventDate: quickForm.eventDate || undefined,""",
    """        name: quickForm.name.trim(),
        eventDate: quickForm.eventDate || undefined,
        status: quickForm.status,""",
    "quick form save status",
)
text = replace_once(
    text,
    '            <DialogDescription>Rename collection and update event date.</DialogDescription>',
    '            <DialogDescription>Rename the collection and choose Draft or Published.</DialogDescription>',
    "quick edit copy",
)
quick_status_field = '''            <Field>
              <FieldLabel htmlFor="quick-status">Collection Status</FieldLabel>
              <select
                id="quick-status"
                value={quickForm.status}
                onChange={(event) => setQuickForm((current) => ({ ...current, status: event.target.value as "draft" | "published" }))}
                className="h-11 w-full border bg-white px-3 text-sm outline-none"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
              <p className="text-xs leading-5 text-[#777]">Only Published collections appear on your public homepage.</p>
            </Field>
'''
text = replace_after(
    text,
    '<DialogTitle>Quick edit</DialogTitle>',
    '          </FieldGroup>',
    quick_status_field + '          </FieldGroup>',
    "quick edit status field",
)

star_start = text.find("  const toggleCollectionStar = (collection: CollectionRecord) => {")
star_end = text.find("  const removeCollection =", star_start)
if star_start < 0 or star_end < 0:
    raise RuntimeError("Collection star function not found")
star_function = '''  const toggleCollectionStar = (collection: CollectionRecord) => {
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
'''
text = text[:star_start] + star_function + text[star_end:]

text = replace_once(
    text,
    """  const openCollectionPreview = (collection: CollectionRecord) => {
    window.open(publicCollectionPath(collection), "_blank", "noopener,noreferrer");
  };
  const shareCollection = async (collection: CollectionRecord) => {
    const url = `${window.location.origin}${publicCollectionPath(collection)}`;""",
    """  const openCollectionPreview = (collection: CollectionRecord) => {
    if (collection.status !== "published") {
      toast.error("Publish this collection before opening its public gallery.");
      return;
    }
    window.open(publicCollectionPath(collection), "_blank", "noopener,noreferrer");
  };
  const shareCollection = async (collection: CollectionRecord) => {
    if (collection.status !== "published") {
      toast.error("Publish this collection before sharing it.");
      return;
    }
    const url = `${window.location.origin}${publicCollectionPath(collection)}`;""",
    "preview and share publication guard",
)

# New collection form.
text = text.replace(
    '  const coverImageAccess = usePlanFeatureAccess("coverImage");\n',
    '',
    1,
)
text = replace_once(
    text,
    '  const [form, setForm] = useState({ name: "", eventDate: "", presetId: "" });',
    '  const [form, setForm] = useState({ name: "", eventDate: "", presetId: "", status: "draft" as "draft" | "published" });',
    "new collection status state",
)
text = replace_once(
    text,
    """        presetId: form.presetId || undefined,
        design,""",
    """        presetId: form.presetId || undefined,
        status: form.status,
        design,""",
    "new collection status payload",
)
new_status_field = '''          <Field>
            <FieldLabel htmlFor="new-status" className="font-bold">Collection Status</FieldLabel>
            <select
              id="new-status"
              value={form.status}
              onChange={(event) => setForm((value) => ({ ...value, status: event.target.value as "draft" | "published" }))}
              className="mt-2 h-12 w-full border bg-white px-3 text-sm outline-none"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <p className="mt-2 text-xs leading-5 text-[#777]">Published collections are listed on your unique homepage URL.</p>
          </Field>
'''
text = replace_after(
    text,
    "function CollectionNewPanel",
    '          <Field>\n            <FieldLabel htmlFor="new-preset"',
    new_status_field + '          <Field>\n            <FieldLabel htmlFor="new-preset"',
    "new collection status field",
)

# Collection detail form.
detail_anchor = "function CollectionDetailView({"
text = replace_after(
    text,
    detail_anchor,
    "  const router = useRouter();\n",
    "  const router = useRouter();\n  const coverImageAccess = usePlanFeatureAccess(\"coverImage\");\n",
    "detail cover access",
)
text = replace_after(
    text,
    detail_anchor,
    """  const [form, setForm] = useState(() => collectionForm(collection));
  const syncedCollectionFormKeyRef = useRef(collectionFormKey(form));""",
    """  const [form, setForm] = useState(() => collectionForm(collection));
  const [collectionStatus, setCollectionStatus] = useState<\"draft\" | \"published\">(collection?.status === \"published\" ? \"published\" : \"draft\");
  const syncedCollectionFormKeyRef = useRef(collectionFormKey(form));""",
    "detail status state",
)
text = replace_after(
    text,
    detail_anchor,
    """    syncedCollectionFormKeyRef.current = nextFormKey;
    setForm(nextForm);""",
    """    syncedCollectionFormKeyRef.current = nextFormKey;
    setForm(nextForm);
    setCollectionStatus(collection.status === \"published\" ? \"published\" : \"draft\");""",
    "detail status synchronization",
)
text = replace_after(
    text,
    detail_anchor,
    """      expiresAt: form.expiresAt || undefined,
      design: form.design,""",
    """      expiresAt: form.expiresAt || undefined,
      status: collectionStatus,
      design: form.design,""",
    "detail status save payload",
)
detail_status_field = '''                <Field>
                  <FieldLabel htmlFor="collection-status" className="font-bold">Collection Status</FieldLabel>
                  <select
                    id="collection-status"
                    value={collectionStatus}
                    onChange={(event) => setCollectionStatus(event.target.value as "draft" | "published")}
                    className="h-12 w-full border bg-white px-3 text-sm outline-none"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                  <p className="text-xs leading-5 text-[#777]">Only Published collections are visible on your public homepage and public gallery URL.</p>
                </Field>
'''
text = replace_after(
    text,
    '<h2 className="text-2xl font-medium">General Settings</h2>',
    '                <Field>\n                  <FieldLabel className="font-bold">Expire Date</FieldLabel>',
    detail_status_field + '                <Field>\n                  <FieldLabel className="font-bold">Expire Date</FieldLabel>',
    "detail status field",
)

path.write_text(text)
