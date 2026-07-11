from pathlib import Path

root = Path(__file__).resolve().parents[1]
terms = [
    "emailRegistration",
    "marketingOptIn",
    "gallery-marketing",
    "MarketingContactsGrid",
    "marketing subscription",
    "Subscribe",
]

for path in sorted((root / "frontend").rglob("*.ts*")):
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        continue
    hits = []
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if any(term.lower() in line.lower() for term in terms):
            hits.append(index)
    if not hits:
        continue
    print(f"\n===== {path.relative_to(root)} =====")
    shown = set()
    for hit in hits:
        start = max(0, hit - 4)
        end = min(len(lines), hit + 6)
        for line_no in range(start, end):
            if line_no in shown:
                continue
            shown.add(line_no)
            print(f"{line_no + 1:05d}: {lines[line_no]}")
        print("-----")
