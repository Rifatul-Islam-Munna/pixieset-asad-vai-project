"use client";

export function RequestError({ unstable_retry }: { unstable_retry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f5] px-6 text-[#222]">
      <div className="max-w-md space-y-4 text-center" role="alert">
        <h1 className="text-2xl font-semibold">This page is temporarily unavailable</h1>
        <p className="text-sm text-[#666]">Please wait a moment, then try again.</p>
        <button type="button" onClick={unstable_retry} className="rounded-lg bg-[#222] px-5 py-3 text-sm font-semibold text-white">
          Try again
        </button>
      </div>
    </main>
  );
}
