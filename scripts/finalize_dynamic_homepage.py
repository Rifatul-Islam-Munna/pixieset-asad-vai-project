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


# Backend collection publication rules.
path = Path("backend/src/collections/collections.service.ts")
text = path.read_text()
text = replace_once(
    text,
    """      presetId: safeDto.presetId,
      design: safeDto.design ?? {},
      settings: safeDto.settings ?? {},
      sets: [{ id: 'highlights', name: 'Highlights', createdAt: new Date() }],""",
    """      presetId: safeDto.presetId,
      status: safeDto.status ?? 'draft',
      design: safeDto.design ?? {},
      settings: safeDto.settings ?? {},
      sets: [{ id: 'highlights', name: 'Highlights', createdAt: new Date() }],""",
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
    "public download status",
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

# Frontend collection mutation payload.
path = Path("frontend/api-hooks/use-collections.ts")
text = path.read_text()
text = replace_once(
    text,
    """      presetId?: string;
      design?: Record<string, any>;""",
    """      presetId?: string;
      status?: \"draft\" | \"published\";
      design?: Record<string, any>;""",
    "create collection hook status",
)
path.write_text(text)

# Client dashboard integration.
path = Path("frontend/components/dashboard/client-dashboard.tsx")
text = path.read_text()
text = replace_once(
    text,
    'import { PlanFeatureLock, PlanFeatureNotice } from "@/components/dashboard/plan-feature-lock";\n',
    'import { PlanFeatureLock, PlanFeatureNotice } from "@/components/dashboard/plan-feature-lock";\nimport { HomepageSettingsPanel } from "@/components/dashboard/homepage-settings-panel";\n',
    "homepage panel import",
)

start = text.find("function HomepageSettings() {")
end = text.find("\nfunction SearchBox({", start)
if start < 0 or end < 0:
    raise RuntimeError("HomepageSettings block not found")
text = text[:start] + "function HomepageSettings() {\n  return <HomepageSettingsPanel />;\n}\n" + text[end:]

# Status belongs only to publication. Starred remains a separate settings flag.
text = text.replace('(collection.status === "starred" || collection.settings?.starred === true)', 'collection.settings?.starred === true')
text = replace_once(
    text,
    '  const [quickForm, setQuickForm] = useState({ name: "", eventDate: "" });',
    '  const [quickForm, setQuickForm] = useState({ name: "", eventDate: "", status: "draft" as "draft" | "published" });',
    "quick form status",
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
    "hydrate quick status",
)
text = replace_once(
    text,
    """        name: quickForm.name.trim(),
        eventDate: quickForm.eventDate || undefined,""",
    """        name: quickForm.name.trim(),
        eventDate: quickForm.eventDate || undefined,
        status: quickForm.status,""",
    "save quick status",
)
text = replace_once(
    text,
    '            <DialogDescription>Rename collection and update event date.</DialogDescription>',
    '            <DialogDescription>Rename the collection and choose Draft or Published.</DialogDescription>',
    "quick edit description",
)
quick_status = '''            <Field>
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
    "<DialogTitle>Quick edit</DialogTitle>",
    "          </FieldGroup>",
    quick_status + "          </FieldGroup>",
    "quick status field",
)
text = replace_once(
    text,
    """  const toggleCollectionStar = (collection: CollectionRecord) => {
    const isStarred = collection.status === "starred" || collection.settings?.starred === true;
    const nextStatus = isStarred ? (collection.status === "starred" ? "draft" : collection.status) : "starred";
    const nextSettings = {
      ...(collection.settings ?? {}),
      starred: !isStarred,
    };
    updateCollection.mutate({
      collectionId: collection._id,
      payload: { status: nextStatus, settings: nextSettings },
    });
  };""",
    """  const toggleCollectionStar = (collection: CollectionRecord) => {
    const isStarred = collection.settings?.starred === true;
    const nextSettings = {
      ...(collection.settings ?? {}),
      starred: !isStarred,
    };
    updateCollection.mutate({
      collectionId: collection._id,
      payload: { settings: nextSettings },
    });
  };""",
    "separate star and status",
)
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

# New collections can begin as draft or published.
text = replace_once(
    text,
    '  const [form, setForm] = useState({ name: "", eventDate: "", presetId: "" });',
    '  const [form, setForm] = useState({ name: "", eventDate: "", presetId: "", status: "draft" as "draft" | "published" });',
    "new collection form status",
)
text = replace_once(
    text,
    """        presetId: form.presetId || undefined,
        design,""",
    """        presetId: form.presetId || undefined,
        status: form.status,
        design,""",
    "new collection payload status",
)
new_status = '''          <Field>
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
    "          <Field>\n            <FieldLabel htmlFor=\"new-preset\"",
    new_status + "          <Field>\n            <FieldLabel htmlFor=\"new-preset\"",
    "new collection status field",
)

# Collection detail status state and save control.
text = replace_once(
    text,
    """  const [form, setForm] = useState(() => collectionForm(collection));
  const syncedCollectionFormKeyRef = useRef(collectionFormKey(form));""",
    """  const [form, setForm] = useState(() => collectionForm(collection));
  const [collectionStatus, setCollectionStatus] = useState<"draft" | "published">(collection?.status === "published" ? "published" : "draft");
  const syncedCollectionFormKeyRef = useRef(collectionFormKey(form));""",
    "detail collection status state",
)
text = replace_once(
    text,
    """    syncedCollectionFormKeyRef.current = nextFormKey;
    setForm(nextForm);""",
    """    syncedCollectionFormKeyRef.current = nextFormKey;
    setForm(nextForm);
    setCollectionStatus(collection.status === "published" ? "published" : "draft");""",
    "sync detail status",
)
text = replace_once(
    text,
    """      expiresAt: form.expiresAt || undefined,
      design: form.design,""",
    """      expiresAt: form.expiresAt || undefined,
      status: collectionStatus,
      design: form.design,""",
    "save detail status",
)
detail_status = '''                <Field>
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
    "                <Field>\n                  <FieldLabel className=\"font-bold\">Expire Date</FieldLabel>",
    detail_status + "                <Field>\n                  <FieldLabel className=\"font-bold\">Expire Date</FieldLabel>",
    "detail status field",
)

path.write_text(text)
