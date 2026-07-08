from pathlib import Path

path = Path("frontend/components/dashboard/client-dashboard.tsx")
text = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise RuntimeError(f"Missing block: {label}")
    text = text.replace(old, new, 1)


# Collection cover images remain visible, but cannot be selected unless the plan includes them.
replace_once(
    '''  const router = useRouter();
  const presetSettings = useDashboardSettings("preset").query;''',
    '''  const router = useRouter();
  const coverImageAccess = usePlanFeatureAccess("coverImage");
  const presetSettings = useDashboardSettings("preset").query;''',
    "collection cover image access",
)
replace_once(
    '''                      <button
                        className="absolute bottom-2 left-2 hidden bg-white/90 px-3 py-2 text-xs font-bold text-[#333] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:text-[#00a997] group-hover:block"
                        disabled={deletingImages}
                        onClick={() => {''',
    '''                      <button
                        className={cn("absolute bottom-2 left-2 hidden bg-white/90 px-3 py-2 text-xs font-bold text-[#333] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:text-[#00a997] group-hover:block", coverImageAccess.locked && "cursor-not-allowed opacity-60")}
                        disabled={deletingImages || coverImageAccess.locked}
                        title={coverImageAccess.locked ? "Cover image is not included in your current plan" : "Make collection cover"}
                        onClick={() => {''',
    "make cover button",
)

# PIN controls stay on screen but are disabled when not included in the plan.
replace_once(
    '''        {[
          ["Video Download", "videoDownload", "Allow videos to be downloaded for offline viewing."],
          ["Download PIN", "downloadPin", "If enabled, all collections created from this preset will have a download PIN set automatically."],
        ].map(([label, key, text]) => (
          <Field key={key}>''',
    '''        <PlanFeatureNotice feature="pinSet" label="Download PIN" />
        {[
          ["Video Download", "videoDownload", "Allow videos to be downloaded for offline viewing."],
          ["Download PIN", "downloadPin", "If enabled, all collections created from this preset will have a download PIN set automatically."],
        ].map(([label, key, text]) => (
          <Field key={key} className={cn(key === "downloadPin" && pinAccess.locked && "pointer-events-none opacity-45")}>
'''.rstrip(),
    "download pin notice and field",
)
replace_once(
    '''              <Switch
                checked={download[key as "videoDownload" | "downloadPin"]}''',
    '''              <Switch
                disabled={key === "downloadPin" && pinAccess.locked}
                checked={download[key as "videoDownload" | "downloadPin"]}''',
    "download pin switch",
)

# Download restriction/limit controls follow the same visible-but-disabled behavior.
replace_once(
    '''        <div>
          <p className="mb-8 text-[11px] font-bold uppercase tracking-widest text-[#777]">
            Advanced Settings''',
    '''        <div>
          <PlanFeatureNotice feature="downloadLimit" label="Download limits" />
          <p className="mb-8 text-[11px] font-bold uppercase tracking-widest text-[#777]">
            Advanced Settings''',
    "download limits notice",
)
replace_once(
    '''            ].map(([label, key, text]) => (
              <Field key={key}>
                <FieldLabel className="font-bold">{label}</FieldLabel>''',
    '''            ].map(([label, key, text]) => (
              <Field key={key} className={cn(limitAccess.locked && "pointer-events-none opacity-45")}>
                <FieldLabel className="font-bold">{label}</FieldLabel>''',
    "download limits fields",
)
replace_once(
    '''                  <Switch
                    checked={download[key as "restrictDownloads" | "limitDownloads"]}''',
    '''                  <Switch
                    disabled={limitAccess.locked}
                    checked={download[key as "restrictDownloads" | "limitDownloads"]}''',
    "download limits switches",
)

path.write_text(text)
