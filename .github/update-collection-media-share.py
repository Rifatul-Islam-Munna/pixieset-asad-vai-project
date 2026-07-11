from pathlib import Path
import re

path = Path('frontend/components/dashboard/client-dashboard.tsx')
text = path.read_text()


def replace_once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 match, found {count}')
    text = text.replace(old, new, 1)


# Remove the now-unused global campaign-builder bridge. The collection has its
# own focused email composer below.
replace_once(
'''  const startCampaignBuilder = useDashboardStore(
    (state) => state.startCampaignBuilder,
  );
''',
'',
'remove campaign builder bridge',
)

# Add media, QR, sorting, grid, and inline email-composer state.
replace_once(
'''  const [shareOpen, setShareOpen] = useState(false);
  const [deleteCollectionConfirmOpen, setDeleteCollectionConfirmOpen] = useState(false);
  const [shareTemplateSearch, setShareTemplateSearch] = useState("");
  const [selectedShareTemplateId, setSelectedShareTemplateId] = useState("");
''',
'''  const [shareOpen, setShareOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [addMediaOpen, setAddMediaOpen] = useState(false);
  const [deleteCollectionConfirmOpen, setDeleteCollectionConfirmOpen] = useState(false);
  const [shareTemplateSearch, setShareTemplateSearch] = useState("");
  const [selectedShareTemplateId, setSelectedShareTemplateId] = useState("");
  const [shareRecipient, setShareRecipient] = useState("");
  const [shareSubject, setShareSubject] = useState("");
  const [shareHeading, setShareHeading] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [shareButtonText, setShareButtonText] = useState("View Gallery");
  const [shareFooterText, setShareFooterText] = useState("");
  const [shareSending, setShareSending] = useState(false);
  const [photoSort, setPhotoSort] = useState<
    | "uploaded-new-old"
    | "uploaded-old-new"
    | "taken-new-old"
    | "taken-old-new"
    | "name-az"
    | "name-za"
    | "random"
  >("uploaded-new-old");
  const [collectionGridSize, setCollectionGridSize] = useState<"small" | "large">("small");
  const [showCollectionFilenames, setShowCollectionFilenames] = useState(true);
  const randomPhotoRanksRef = useRef(new Map<string, number>());
''',
'add collection toolbar state',
)

# Add deterministic display sorting while preserving the existing manual order
# for Uploaded: New -> Old.
replace_once(
'''  const activeSetImages = useMemo(
    () =>
      orderedImages.filter(
        (image) => (image.setId || "highlights") === activeSetId,
      ),
    [activeSetId, orderedImages],
  );
  const imagePageSize = 24;
''',
'''  const activeSetImages = useMemo(
    () =>
      orderedImages.filter(
        (image) => (image.setId || "highlights") === activeSetId,
      ),
    [activeSetId, orderedImages],
  );
  const displayedSetImages = useMemo(() => {
    const next = [...activeSetImages];
    const uploadedTime = (image: CollectionImageRecord) => {
      const time = image.createdAt ? new Date(image.createdAt).getTime() : 0;
      return Number.isFinite(time) ? time : 0;
    };
    const takenTime = (image: CollectionImageRecord) => {
      const raw =
        image.metadata?.dateTaken ??
        image.metadata?.takenAt ??
        image.metadata?.DateTimeOriginal ??
        image.metadata?.createdAt;
      const time = raw ? new Date(String(raw)).getTime() : uploadedTime(image);
      return Number.isFinite(time) ? time : uploadedTime(image);
    };
    const name = (image: CollectionImageRecord) =>
      String(image.originalName ?? image.metadata?.filename ?? "").toLowerCase();

    if (photoSort === "uploaded-new-old") return next;
    if (photoSort === "uploaded-old-new") return next.reverse();
    if (photoSort === "taken-new-old")
      return next.sort((left, right) => takenTime(right) - takenTime(left));
    if (photoSort === "taken-old-new")
      return next.sort((left, right) => takenTime(left) - takenTime(right));
    if (photoSort === "name-az")
      return next.sort((left, right) => name(left).localeCompare(name(right)));
    if (photoSort === "name-za")
      return next.sort((left, right) => name(right).localeCompare(name(left)));
    next.forEach((image) => {
      if (!randomPhotoRanksRef.current.has(image._id))
        randomPhotoRanksRef.current.set(image._id, Math.random());
    });
    return next.sort(
      (left, right) =>
        (randomPhotoRanksRef.current.get(left._id) ?? 0) -
        (randomPhotoRanksRef.current.get(right._id) ?? 0),
    );
  }, [activeSetImages, photoSort]);
  const imagePageSize = 24;
''',
'add photo sorting',
)

text = text.replace(
'''    Math.ceil(activeSetImages.length / imagePageSize),''',
'''    Math.ceil(displayedSetImages.length / imagePageSize),''',
1,
)
text = text.replace(
'''  const visibleSetImages = activeSetImages.slice(''',
'''  const visibleSetImages = displayedSetImages.slice(''',
1,
)

# Add editable email fields and direct sending.
replace_once(
'''  const shareByEmail = (templateId: string) => {
    startCampaignBuilder(templateId, publicLink);
    setShareOpen(false);
  };
''',
'''  const cleanTemplateText = (value?: string) =>
    String(value ?? "")
      .replace(/<br\\s*\\/?\s*>/gi, "\\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\\s+\\n/g, "\\n")
      .replace(/\\n\\s+/g, "\\n")
      .trim();
  const applyShareTemplate = (template?: EmailTemplateItem) => {
    setSelectedShareTemplateId(template?.id ?? "");
    setShareSubject(
      template?.subject?.trim() || `Photos for ${collection?.name ?? "your collection"} are ready`,
    );
    setShareHeading(template?.title?.trim() || (collection?.name ?? "Your photos are ready"));
    setShareMessage(
      cleanTemplateText(template?.message) ||
        "Your photos are ready. Use the button below to view the gallery.",
    );
    setShareButtonText(template?.buttonText?.trim() || "View Gallery");
    setShareFooterText(template?.footerText?.trim() || branding.brandText || "");
  };
  const openShareComposer = () => {
    applyShareTemplate(selectedShareTemplate);
    setShareOpen(true);
  };
  const sendShareEmail = async () => {
    const recipients = shareRecipient
      .split(/[;,\\n]/)
      .map((email) => email.trim())
      .filter((email) => /^\\S+@\\S+\\.\\S+$/.test(email));
    if (!recipients.length) {
      toast.error("Enter at least one valid email address");
      return;
    }
    if (!shareSubject.trim()) {
      toast.error("Email subject is required");
      return;
    }
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
    const heroImage =
      selectedShareTemplate?.image ||
      form.coverImage ||
      images.find((image) => image.mediaType !== "video")?.url ||
      "";
    const logo = branding.logoUrl || branding.brandImageUrl || "";
    const accent = selectedShareTemplate?.buttonColor || branding.accentColor || "#333333";
    const html = `
      <div style="margin:0;background:#f5f5f5;padding:36px 16px;font-family:Arial,sans-serif;color:#222">
        <div style="max-width:640px;margin:0 auto;background:#fff;text-align:center">
          <div style="padding:38px 36px 26px">
            ${logo ? `<img src="${escapeHtml(logo)}" alt="" style="max-height:54px;max-width:170px;margin-bottom:18px"/>` : ""}
            ${branding.brandText ? `<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#555">${escapeHtml(branding.brandText)}</div>` : ""}
            <h1 style="margin:28px 0 0;font-size:27px;font-weight:500;letter-spacing:4px;text-transform:uppercase">${escapeHtml(shareHeading || collection?.name || "Your photos")}</h1>
          </div>
          ${heroImage ? `<img src="${escapeHtml(imageSrc(heroImage))}" alt="" style="display:block;width:100%;max-height:430px;object-fit:cover"/>` : ""}
          <div style="padding:42px 42px 34px">
            <p style="margin:0 auto 30px;max-width:500px;font-size:15px;line-height:1.8;color:#555;white-space:pre-line">${escapeHtml(shareMessage)}</p>
            <a href="${escapeHtml(publicLink)}" style="display:inline-block;background:${escapeHtml(accent)};color:#fff;text-decoration:none;padding:15px 34px;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase">${escapeHtml(shareButtonText || "View Gallery")}</a>
            ${shareFooterText ? `<p style="margin:34px 0 0;font-size:11px;line-height:1.7;color:#777">${escapeHtml(shareFooterText)}</p>` : ""}
          </div>
        </div>
      </div>`;
    setShareSending(true);
    try {
      await sendUniversalEmail({
        to: recipients,
        subject: shareSubject.trim(),
        text: `${shareMessage.trim()}\\n\\n${publicLink}`,
        html,
      });
      await recordEmailUsage(recipients.length).catch(() => null);
      toast.success(`Collection shared with ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`);
      setShareOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Email could not be sent");
    } finally {
      setShareSending(false);
    }
  };
''',
'replace email share action',
)

# Remove Move to from More.
move_pattern = re.compile(
    r'''\s*<DropdownMenuItem\n\s*className="h-11 rounded-none"\n\s*onSelect=\{\(\) => \{\n\s*toast\.info\("Choose the destination from the Collections page"\);\n\s*router\.push\(`/dashboard/\$\{section\}`\);\n\s*\}\}\n\s*>\n\s*<ArrowRight className="size-4" />\n\s*Move to\n\s*</DropdownMenuItem>''',
    re.S,
)
text, count = move_pattern.subn('', text, count=1)
if count != 1:
    raise RuntimeError(f'remove Move to: expected 1 match, found {count}')

# Wire Share menu to dedicated email and QR views.
replace_once(
'''              <DropdownMenuItem className="h-11 rounded-none" onSelect={() => setShareOpen(true)}>
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
''',
'''              <DropdownMenuItem className="h-11 rounded-none" onSelect={openShareComposer}>
                <Mail className="size-4" />
                Share by email
              </DropdownMenuItem>
              <DropdownMenuItem className="h-11 rounded-none" onSelect={() => void copyPublicLink().then(() => toast.success("Direct link copied"))}>
                <Link2 className="size-4" />
                Get direct link
              </DropdownMenuItem>
              <DropdownMenuItem className="h-11 rounded-none" onSelect={() => setQrOpen(true)}>
                <QrCode className="size-4" />
                Get QR code
              </DropdownMenuItem>
''',
'wire share menu',
)

# Replace the old combined share dialog with a full editable email composer,
# a standalone QR dialog, and an upload-only Add Media dialog.
share_dialog_pattern = re.compile(
    r'''      <Dialog open=\{shareOpen\} onOpenChange=\{setShareOpen\}>.*?      </Dialog>\n\n      <DeleteConfirmDialog''',
    re.S,
)
share_dialog_replacement = '''      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="h-[94vh] w-[96vw] max-w-none overflow-hidden rounded-none border-0 p-0 sm:max-w-[96vw]">
          <div className="flex h-full min-h-0 flex-col bg-white">
            <header className="flex h-16 shrink-0 items-center justify-between border-b px-7">
              <div className="flex items-center gap-5">
                <button type="button" onClick={() => setShareOpen(false)} aria-label="Close email composer">
                  <X className="size-5 text-[#777]" />
                </button>
                <h2 className="font-medium">Share Collection</h2>
              </div>
              <div className="flex items-center gap-8 text-sm font-medium">
                <button type="button" onClick={() => void copyPublicLink().then(() => toast.success("Direct link copied"))}>
                  Get direct link
                </button>
              </div>
            </header>
            <div className="grid min-h-0 flex-1 lg:grid-cols-[1.05fr_1fr]">
              <section className="flex min-h-0 flex-col border-r bg-white">
                <div className="min-h-0 flex-1 overflow-y-auto px-7 py-7">
                  <FieldGroup className="gap-6">
                    <Field>
                      <FieldLabel className="text-xs font-bold uppercase tracking-wide text-[#777]">To</FieldLabel>
                      <Input
                        type="text"
                        value={shareRecipient}
                        onChange={(event) => setShareRecipient(event.target.value)}
                        placeholder="guest@email.com"
                        className="h-11 rounded-none border-x-0 border-t-0 px-0 focus-visible:ring-0"
                      />
                      <p className="text-xs text-[#888]">Separate multiple email addresses with commas.</p>
                    </Field>
                    <Field>
                      <FieldLabel className="text-xs font-bold uppercase tracking-wide text-[#777]">Subject</FieldLabel>
                      <Input
                        value={shareSubject}
                        onChange={(event) => setShareSubject(event.target.value)}
                        placeholder={`Photos for ${collection.name} are ready`}
                        className="h-11 rounded-none"
                      />
                    </Field>
                    <Field>
                      <FieldLabel className="text-xs font-bold uppercase tracking-wide text-[#777]">Email heading</FieldLabel>
                      <Input
                        value={shareHeading}
                        onChange={(event) => setShareHeading(event.target.value)}
                        className="h-11 rounded-none"
                      />
                    </Field>
                    <Field>
                      <FieldLabel className="text-xs font-bold uppercase tracking-wide text-[#777]">Description</FieldLabel>
                      <Textarea
                        value={shareMessage}
                        onChange={(event) => setShareMessage(event.target.value)}
                        placeholder="Enter your text here"
                        className="min-h-40 rounded-none resize-y"
                      />
                    </Field>
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field>
                        <FieldLabel className="text-xs font-bold uppercase tracking-wide text-[#777]">Button text</FieldLabel>
                        <Input
                          value={shareButtonText}
                          onChange={(event) => setShareButtonText(event.target.value)}
                          className="h-11 rounded-none"
                        />
                      </Field>
                      <Field>
                        <FieldLabel className="text-xs font-bold uppercase tracking-wide text-[#777]">Footer</FieldLabel>
                        <Input
                          value={shareFooterText}
                          onChange={(event) => setShareFooterText(event.target.value)}
                          className="h-11 rounded-none"
                        />
                      </Field>
                    </div>
                  </FieldGroup>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#00a997]">
                        <FileUp className="size-4" />
                        Insert Email Template
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[340px] rounded-none p-3">
                      <div className="mb-3 flex h-10 items-center gap-2 border px-3">
                        <Search className="size-4 text-[#888]" />
                        <Input
                          value={shareTemplateSearch}
                          onChange={(event) => setShareTemplateSearch(event.target.value)}
                          placeholder="Find template"
                          className="h-9 rounded-none border-0 px-0 focus-visible:ring-0"
                          onKeyDown={(event) => event.stopPropagation()}
                        />
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {filteredShareTemplates.map((template) => (
                          <DropdownMenuItem
                            key={template.id}
                            className="block h-auto rounded-none px-3 py-3"
                            onSelect={() => applyShareTemplate(template)}
                          >
                            <span className="block truncate font-bold">{template.name || "Untitled Template"}</span>
                            <span className="mt-1 block truncate text-xs text-[#777]">{template.subject || "No subject"}</span>
                          </DropdownMenuItem>
                        ))}
                        {!filteredShareTemplates.length && (
                          <p className="px-3 py-7 text-center text-sm text-[#777]">No templates found.</p>
                        )}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <footer className="flex shrink-0 items-center justify-end border-t px-7 py-4">
                  <Button
                    className="h-11 min-w-32 rounded-none bg-[#22bda7] text-white hover:bg-[#19a995]"
                    disabled={shareSending || !shareRecipient.trim() || !shareSubject.trim()}
                    onClick={() => void sendShareEmail()}
                  >
                    {shareSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    {shareSending ? "Sending..." : "Send"}
                  </Button>
                </footer>
              </section>
              <aside className="min-h-0 overflow-y-auto bg-[#f5f5f5] p-6 lg:p-10">
                <div className="mx-auto max-w-[560px] bg-white text-center shadow-sm">
                  <div className="px-8 pb-8 pt-10">
                    {(branding.logoUrl || branding.brandImageUrl) && (
                      <img
                        src={branding.logoUrl || branding.brandImageUrl}
                        alt=""
                        className="mx-auto max-h-14 max-w-44 object-contain"
                      />
                    )}
                    {branding.brandText && (
                      <p className="mt-5 text-[10px] uppercase tracking-[0.22em] text-[#555]">{branding.brandText}</p>
                    )}
                    <h3 className="mt-8 text-2xl font-medium uppercase tracking-[0.18em]">{shareHeading || collection.name}</h3>
                  </div>
                  {(selectedShareTemplate?.image || form.coverImage || images.find((image) => image.mediaType !== "video")?.url) && (
                    <img
                      src={imageSrc(selectedShareTemplate?.image || form.coverImage || images.find((image) => image.mediaType !== "video")?.url || "")}
                      alt=""
                      className="max-h-[430px] w-full object-cover"
                    />
                  )}
                  <div className="px-10 py-10">
                    <p className="whitespace-pre-line text-sm leading-7 text-[#666]">{shareMessage}</p>
                    <span
                      className="mt-8 inline-flex min-h-11 items-center justify-center px-8 text-xs font-bold uppercase tracking-[0.13em] text-white"
                      style={{ backgroundColor: selectedShareTemplate?.buttonColor || branding.accentColor || "#444" }}
                    >
                      {shareButtonText || "View Gallery"}
                    </span>
                    {shareFooterText && <p className="mt-8 text-xs leading-6 text-[#777]">{shareFooterText}</p>}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="rounded-none p-0 sm:max-w-[520px]">
          <div className="p-10">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold uppercase tracking-[0.16em]">QR Code</DialogTitle>
              <button type="button" onClick={() => setQrOpen(false)} aria-label="Close QR code">
                <X className="size-5 text-[#777]" />
              </button>
            </div>
            <div className="mt-9 flex justify-center">
              <img src={qrCodeUrl} alt={`QR code for ${collection.name}`} className="size-[250px]" />
            </div>
            <p className="mt-8 break-all text-center text-xs text-[#777]">{publicLink}</p>
            <div className="mt-9 flex items-center justify-end gap-5">
              <Button variant="ghost" className="rounded-none" onClick={() => setQrOpen(false)}>Cancel</Button>
              <a
                href={qrCodeUrl}
                download={`${collection.slug || collection._id}-qr-code.png`}
                className="inline-flex h-11 items-center justify-center bg-[#22bda7] px-7 text-sm font-bold text-white"
              >
                Download
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addMediaOpen} onOpenChange={setAddMediaOpen}>
        <DialogContent className="rounded-none p-0 sm:max-w-[720px]">
          <div className="p-8 sm:p-12">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold uppercase tracking-[0.13em]">Add Media</DialogTitle>
              <button type="button" onClick={() => setAddMediaOpen(false)} aria-label="Close media uploader">
                <X className="size-5 text-[#777]" />
              </button>
            </div>
            <div className="mt-8 border-b">
              <span className="inline-flex border-b-2 border-[#22bda7] pb-3 text-sm font-bold">Upload</span>
            </div>
            <label
              className={cn(
                "mt-5 flex min-h-[360px] cursor-pointer flex-col items-center justify-center border border-dashed bg-white p-8 text-center",
                draggingUpload && "border-[#22bda7] bg-[#f2fffd]",
                uploading && "pointer-events-none opacity-70",
              )}
              onDragOver={handleUploadDragOver}
              onDragEnter={handleUploadDragOver}
              onDragLeave={handleUploadDragLeave}
              onDrop={(event) => {
                if (!isFileDrag(event)) return;
                event.preventDefault();
                setDraggingUpload(false);
                const mediaFiles = droppedMediaFiles(event.dataTransfer.files);
                if (!mediaFiles.length) {
                  toast.error("Drop image or video files only");
                  return;
                }
                setAddMediaOpen(false);
                void handleImageUpload(mediaFiles);
              }}
            >
              {uploading ? <Loader2 className="size-12 animate-spin text-[#22bda7]" /> : <Upload className="size-12 text-[#c7c7c7]" />}
              <p className="mt-6 text-lg font-bold">
                {uploading ? `${uploadProgress.currentPercent}% uploaded` : "Drag photos and videos here to upload"}
              </p>
              <p className="mt-5 text-sm text-[#555]">or upload files from:</p>
              <span className="mt-5 inline-flex h-11 min-w-44 items-center justify-center gap-2 bg-[#f2f2f2] px-6 text-sm font-bold">
                <Monitor className="size-4" />
                My Computer
              </span>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                disabled={uploading}
                className="hidden"
                onChange={(event) => {
                  const files = event.target.files;
                  setAddMediaOpen(false);
                  void handleImageUpload(files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog'''
text, count = share_dialog_pattern.subn(share_dialog_replacement, text, count=1)
if count != 1:
    raise RuntimeError(f'replace share dialog: expected 1 match, found {count}')

# Replace static toolbar icons with working sort/grid menus and a modal uploader.
replace_once(
'''              <div className="flex items-center gap-5 text-[#777]">
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
''',
'''              <div className="flex items-center gap-5 text-[#777]">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="flex size-9 items-center justify-center hover:bg-[#f3f3f3]" aria-label="Sort photos">
                      <ListFilter className="size-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 rounded-none p-3">
                    <p className="px-3 pb-2 pt-1 text-xs font-medium text-[#888]">Sort by</p>
                    {([
                      ["uploaded-new-old", "Uploaded: New → Old"],
                      ["uploaded-old-new", "Uploaded: Old → New"],
                      ["taken-new-old", "Date Taken: New → Old"],
                      ["taken-old-new", "Date Taken: Old → New"],
                      ["name-az", "Name: A-Z"],
                      ["name-za", "Name: Z-A"],
                      ["random", "Random"],
                    ] as const).map(([value, label]) => (
                      <DropdownMenuItem
                        key={value}
                        className="h-11 rounded-none"
                        onSelect={() => setPhotoSort(value)}
                      >
                        <span className="flex-1">{label}</span>
                        {photoSort === value && <Check className="size-4" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="flex size-9 items-center justify-center hover:bg-[#f3f3f3]" aria-label="Grid options">
                      <LayoutGrid className="size-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 rounded-none p-3">
                    <p className="px-3 pb-2 pt-1 text-xs font-medium text-[#888]">Grid Size</p>
                    <DropdownMenuItem className="h-11 rounded-none" onSelect={() => setCollectionGridSize("small")}>
                      <span className="flex-1">Small</span>
                      {collectionGridSize === "small" && <Check className="size-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="h-11 rounded-none" onSelect={() => setCollectionGridSize("large")}>
                      <span className="flex-1">Large</span>
                      {collectionGridSize === "large" && <Check className="size-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <div className="flex items-center justify-between px-3 py-3">
                      <div>
                        <p className="text-xs text-[#888]">Show</p>
                        <p className="mt-2 text-sm font-medium text-[#222]">Filename</p>
                      </div>
                      <Switch checked={showCollectionFilenames} onCheckedChange={setShowCollectionFilenames} />
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="h-7 w-px bg-[#e5e5e5]" />
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-2 text-sm font-bold text-[#00a997]",
                    uploading && "pointer-events-none opacity-60",
                  )}
                  onClick={() => setAddMediaOpen(true)}
                >
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <PlusCircle className="size-4" />}
                  {uploading ? `${uploadProgress.currentPercent}%` : "Add Media"}
                </button>
              </div>
''',
'toolbar controls',
)

# Render the selected sorted order, adjust grid size, and show filename labels.
text = text.replace(
'''                  list={activeSetImages.map((image) => ({''',
'''                  list={displayedSetImages.map((image) => ({''',
1,
)
text = text.replace(
'''                  {activeSetImages.map((image) => (''',
'''                  {displayedSetImages.map((image) => (''',
1,
)
replace_once(
'''                  className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-8"
''',
'''                  className={cn(
                    "grid gap-x-8 gap-y-8",
                    collectionGridSize === "small"
                      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-8"
                      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
                  )}
''',
'grid size classes',
)
replace_once(
'''                      >
                        Make Cover
                      </button>
                    </div>
''',
'''                      >
                        Make Cover
                      </button>
                      {showCollectionFilenames && (
                        <p className="mt-2 truncate px-1 text-xs text-[#777]" title={image.originalName ?? ""}>
                          {image.originalName || String(image.metadata?.filename ?? "Untitled")}
                        </p>
                      )}
                    </div>
''',
'filename labels',
)

path.write_text(text)
print('Collection media, sorting, QR, and editable email sharing UI updated.')
