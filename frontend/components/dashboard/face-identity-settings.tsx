"use client";

import { useMemo, useState } from "react";
import { Check, FolderOpen, Images, Loader2, Search, UserRound } from "lucide-react";
import { useFaceIdentities, useRenameFaceIdentity } from "@/api-hooks/use-face-identities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FaceIdentitySettings() {
  const identitiesQuery = useFaceIdentities();
  const renameIdentity = useRenameFaceIdentity();
  const identities = useMemo(() => identitiesQuery.data?.data ?? [], [identitiesQuery.data]);
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedKey, setSavedKey] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return identities;
    return identities.filter((identity) => {
      const collectionNames = identity.collections.map((collection) => collection.name).join(" ");
      return [identity.name, identity.identityKey, collectionNames]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [identities, query]);

  const saveName = async (identityKey: string) => {
    setSavedKey("");
    await renameIdentity.mutateAsync({
      identityKey,
      name: String(drafts[identityKey] ?? identities.find((item) => item.identityKey === identityKey)?.name ?? "").trim(),
    });
    setSavedKey(identityKey);
    window.setTimeout(() => setSavedKey((current) => (current === identityKey ? "" : current)), 1800);
  };

  if (identitiesQuery.isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-[#ece8f4] bg-white">
        <Loader2 className="size-6 animate-spin text-[#6337d8]" />
      </div>
    );
  }

  if (identitiesQuery.isError) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
        {identitiesQuery.error instanceof Error
          ? identitiesQuery.error.message
          : "Could not load face identities."}
      </div>
    );
  }

  return (
    <div className="max-w-[1080px]">
      <div className="rounded-2xl border border-[#e9e5f1] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-[680px]">
            <div className="flex items-center gap-2 text-[#6337d8]">
              <UserRound className="size-5" />
              <span className="text-xs font-bold uppercase tracking-[0.14em]">People library</span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-[#242126]">Reusable face IDs across collections</h2>
            <p className="mt-2 text-sm leading-6 text-[#716d76]">
              Faces are learned quietly in the existing background indexing queue. Give a person a name once and future matching faces from your other collections reuse the same identity.
            </p>
          </div>
          <div className="rounded-xl bg-[#f7f4fd] px-4 py-3 text-right">
            <div className="text-2xl font-semibold text-[#45209b]">{identities.length}</div>
            <div className="text-xs font-medium text-[#756b86]">known people</div>
          </div>
        </div>

        <div className="relative mt-5 max-w-[440px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#aaa3b2]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, face ID, or collection"
            className="h-11 rounded-xl border-[#ddd7e6] pl-10"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[#dcd5e8] bg-[#fbfafd] px-6 py-14 text-center">
          <UserRound className="mx-auto size-9 text-[#aa9fbe]" />
          <p className="mt-3 font-semibold text-[#433d49]">
            {identities.length ? "No people match this search" : "No face IDs yet"}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#827c89]">
            {identities.length
              ? "Try a different person name, ID, or collection name."
              : "As gallery photos finish face indexing, learned people will appear here automatically."}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {filtered.map((identity) => {
            const saving = renameIdentity.isPending && renameIdentity.variables?.identityKey === identity.identityKey;
            const changed = String(drafts[identity.identityKey] ?? identity.name ?? "").trim() !== String(identity.name ?? "").trim();
            const box = identity.representativeBox;
            const objectPosition = box
              ? `${Math.max(0, Math.min(100, box.x + box.width / 2))}% ${Math.max(0, Math.min(100, box.y + box.height / 2))}%`
              : "50% 50%";

            return (
              <div key={identity.identityKey} className="rounded-2xl border border-[#e8e4ed] bg-white p-4 shadow-[0_8px_24px_rgba(62,40,95,0.04)]">
                <div className="flex gap-4">
                  <div className="size-24 shrink-0 overflow-hidden rounded-xl bg-[#f1eef5]">
                    {identity.representativeUrl ? (
                      <img
                        src={identity.representativeUrl}
                        alt={identity.name || "Detected person"}
                        className="h-full w-full object-cover"
                        style={{ objectPosition }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <UserRound className="size-8 text-[#a69db5]" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Input
                      value={drafts[identity.identityKey] ?? identity.name ?? ""}
                      onChange={(event) => setDrafts((current) => ({
                        ...current,
                        [identity.identityKey]: event.target.value,
                      }))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && changed && !saving) void saveName(identity.identityKey);
                      }}
                      maxLength={80}
                      placeholder="Add this person's name"
                      className="h-10 rounded-lg border-[#ddd7e5] font-medium"
                    />
                    <div className="mt-2 truncate font-mono text-[11px] text-[#9a94a0]" title={identity.identityKey}>
                      {identity.identityKey}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#69616f]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#f6f3fa] px-2.5 py-1">
                        <FolderOpen className="size-3.5" /> {identity.collectionCount} {identity.collectionCount === 1 ? "collection" : "collections"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#f6f3fa] px-2.5 py-1">
                        <Images className="size-3.5" /> {identity.imageCount} {identity.imageCount === 1 ? "photo" : "photos"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-[#f0edf3] pt-3">
                  <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 text-xs text-[#837c89]">
                      {identity.collections.length ? (
                        <span title={identity.collections.map((item) => item.name).join(", ")}>
                          Seen in {identity.collections.slice(0, 2).map((item) => item.name).join(", ")}
                          {identity.collections.length > 2 ? ` +${identity.collections.length - 2}` : ""}
                        </span>
                      ) : (
                        <span>Saved identity available for future collections</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!changed || saving}
                      onClick={() => void saveName(identity.identityKey)}
                      className="min-w-[82px] bg-[#6337d8] hover:bg-[#532bc1]"
                    >
                      {saving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : savedKey === identity.identityKey ? (
                        <><Check className="mr-1 size-4" /> Saved</>
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </div>
                  {renameIdentity.isError && renameIdentity.variables?.identityKey === identity.identityKey ? (
                    <p className="mt-2 text-xs text-red-600">
                      {renameIdentity.error instanceof Error ? renameIdentity.error.message : "Could not save name."}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
