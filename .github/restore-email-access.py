from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DASHBOARD = ROOT / "frontend/components/dashboard/client-dashboard.tsx"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


text = DASHBOARD.read_text(encoding="utf-8")

text = text.replace(
    '"download" | "favorite" | "orders" | "email" | "contacts" | "links" | "private"',
    '"download" | "favorite" | "orders" | "email" | "contacts" | "private"',
)

quick_share_nav = '''              <button
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
'''
text = replace_once(text, quick_share_nav, "", "remove quick share navigation")

text = replace_once(
    text,
    '''                <Mail className="size-4" />
                Email Registration
''',
    '''                <Mail className="size-4" />
                Email Access
''',
    "restore email access label",
)

email_branch_start = '''        {activityPage === "email" ? (
          <>
          <CollectionRegistrationActivity
            mode="registration"
            registrations={emailRegistrations}
            privatePhotos={privatePhotos}
            collectionName={collectionName}
          />
          <div className="hidden" aria-hidden="true">
          <div className="max-h-[calc(100dvh-220px)] min-h-[560px] overflow-y-auto pr-1">
'''
text = replace_once(
    text,
    email_branch_start,
    '''        {activityPage === "email" ? (
          <div className="max-h-[calc(100dvh-220px)] min-h-[560px] overflow-y-auto pr-1">
''',
    "restore email access content",
)

quick_share_branch = '''          </div>
          </div>
        </>

        ) : activityPage === "links" ? (
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
'''
text = replace_once(
    text,
    quick_share_branch,
    '''          </div>
        ) : activityPage === "contacts" ? (
''',
    "remove quick share content",
)

text = text.replace('{request?.reason || "â€”"}', '{request?.reason || "—"}')

DASHBOARD.write_text(text, encoding="utf-8")
print("Email Access restored and Quick Share Links removed")
