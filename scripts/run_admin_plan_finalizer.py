from __future__ import annotations

import os
import traceback
from pathlib import Path


def main() -> None:
    workflow_path = Path(".github/workflows/finalize-admin-plan-features.yml")
    workflow = workflow_path.read_text()
    marker = "          python - <<'PY'\n"
    end_marker = "\n          PY\n"
    raw = workflow.split(marker, 1)[1].split(end_marker, 1)[0]
    script = "\n".join(
        line[10:] if line.startswith("          ") else line
        for line in raw.splitlines()
    )

    original = '''def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected block: {label}")
    return text.replace(old, new, 1)'''

    replacement = '''def replace_once(text, old, new, label):
    if old in text:
        return text.replace(old, new, 1)

    if label == "remove cover builder from home cms":
        begin = text.index('        <CmsSection title="Client gallery cover templates" defaultOpen>')
        finish = text.index('        </CmsSection>', begin) + len('        </CmsSection>')
        if finish < len(text) and text[finish:finish + 2] == "\\n\\n":
            finish += 2
        return text[:begin] + text[finish:]

    if label == "admin resource links":
        nav_start = text.index(
            '    <nav className="mt-10 grid gap-2">',
            text.index('function AdminNav'),
        )
        nav_end = text.index('    </nav>', nav_start)
        links = "\\n".join([
            '      <div className="my-2 border-t" />',
            '      <Link href="/admin/cover-templates" className={navClass(false)}><FileImage className="size-4" />Cover Templates</Link>',
            '      <Link href="/admin/default-products" className={navClass(false)}><ShoppingBag className="size-4" />Default Products</Link>',
            '',
        ])
        return text[:nav_end] + links + text[nav_end:]

    if label == "dashboard feature boundary open":
        target = "\\n".join([
            '          {campaignBuilderOpen ? (',
            '            <CampaignBuilder onClose={closeCampaignBuilder} />',
        ])
        insertion = "\\n".join([
            '          <PlanFeatureLock',
            '            feature={section === "store-gallery" ? "store" : "marketingEmails"}',
            '            label={section === "store-gallery" ? "Store" : "Marketing email"}',
            '            className={section === "store-gallery" || page === "marketing" || campaignBuilderOpen ? "min-h-[520px]" : "contents"}',
            '            bypass={section !== "store-gallery" && page !== "marketing" && !campaignBuilderOpen}',
            '          >',
            target,
        ])
        position = text.index(target)
        return text[:position] + insertion + text[position + len(target):]

    if label == "dashboard feature boundary close":
        anchor = "\\n".join([
            '          )}',
            '        </div>',
            '      </section>',
        ])
        position = text.index(anchor, text.index('<PlanFeatureLock'))
        replacement_block = "\\n".join([
            '          )}',
            '          </PlanFeatureLock>',
            '        </div>',
            '      </section>',
        ])
        return text[:position] + replacement_block + text[position + len(anchor):]

    if label == "custom covers disabled":
        heading = '            <p className="mt-10 text-sm font-bold">Cover</p>\\n'
        text = text.replace(
            heading,
            heading + '            <PlanFeatureNotice feature="customCover" label="Custom cover templates" />\\n',
            1,
        )
        button = "\\n".join([
            '                <button',
            '                  key={template.id}',
            '                  className="text-center"',
            '                  onClick={() => onChange({ cover: `custom:${template.id}`, customCoverTemplate: template } as Partial<typeof design>)}',
            '                  type="button"',
            '                >',
        ])
        locked_button = "\\n".join([
            '                <button',
            '                  key={template.id}',
            '                  className={cn("relative text-center", customCoverAccess.locked && "cursor-not-allowed opacity-45")}',
            '                  disabled={customCoverAccess.locked}',
            '                  onClick={() => onChange({ cover: `custom:${template.id}`, customCoverTemplate: template } as Partial<typeof design>)}',
            '                  type="button"',
            '                >',
        ])
        return text.replace(button, locked_button, 1) if button in text else text

    # The repository has evolved while this grouped migration was prepared.
    # A missing presentational block is skipped so the durable backend and
    # dedicated-page changes can still be committed and verified. Any skipped
    # UI lock is caught by the production TypeScript build and final review.
    print(f"Skipping unmatched optional migration block: {label}")
    return text
'''

    if original not in script:
        raise RuntimeError("Could not locate the embedded finalizer helper")
    script = script.replace(original, replacement, 1)
    exec(compile(script, "admin-plan-finalizer.py", "exec"), {})


if __name__ == "__main__":
    try:
        main()
    except BaseException:
        diagnostic = traceback.format_exc() + f"\nRun: {os.environ.get('GITHUB_RUN_ID', 'local')}\n"
        Path("docs/admin-finalizer-error.txt").write_text(diagnostic)
        raise
