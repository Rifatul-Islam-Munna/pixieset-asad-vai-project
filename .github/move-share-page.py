from pathlib import Path

path = Path("frontend/components/dashboard/client-dashboard.tsx")
text = path.read_text()

old = """  Heart,
  Images,"""
new = """  Heart,
  Home,
  Images,"""
if text.count(old) != 1:
    raise RuntimeError(f"Home import anchor: expected 1 match, found {text.count(old)}")
text = text.replace(old, new, 1)

old = """  const openShareComposer = () => {
    applyShareTemplate(selectedShareTemplate);
    setShareOpen(true);
  };"""
new = """  const openShareComposer = () => {
    router.push(`/dashboard/${section}/collections/${collectionId}/share`);
  };"""
if text.count(old) != 1:
    raise RuntimeError(f"Share navigation anchor: expected 1 match, found {text.count(old)}")
text = text.replace(old, new, 1)

old = """          <button
            className=\"flex size-8 shrink-0 items-center justify-center text-[#8a8a8a] hover:text-[#222]\"
            onClick={() => router.push(`/dashboard/${section}`)}
            aria-label=\"Back to collections\"
            type=\"button\"
          >
            <ArrowLeft className=\"size-5\" />
          </button>
          <div className=\"min-w-0\">"""
new = """          <button
            className=\"flex size-8 shrink-0 items-center justify-center text-[#8a8a8a] hover:text-[#222]\"
            onClick={() => router.push(`/dashboard/${section}`)}
            aria-label=\"Back to collections\"
            type=\"button\"
          >
            <ArrowLeft className=\"size-5\" />
          </button>
          <button
            className=\"flex size-8 shrink-0 items-center justify-center text-[#8a8a8a] hover:bg-[#f4f4f4] hover:text-[#222]\"
            onClick={() => router.push(`/dashboard/${section}`)}
            aria-label=\"Go to dashboard home\"
            title=\"Home\"
            type=\"button\"
          >
            <Home className=\"size-5\" />
          </button>
          <div className=\"min-w-0\">"""
if text.count(old) != 1:
    raise RuntimeError(f"Home button anchor: expected 1 match, found {text.count(old)}")
text = text.replace(old, new, 1)

path.write_text(text)
print("Share composer moved to its own route and home button added.")
