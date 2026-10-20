"use client";

import Link from "next/link";

export default function TraceError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel mx-auto mt-10 max-w-[520px] px-5 py-6">
      <div className="label">trace</div>
      <p className="mt-2">This trace has data the viewer couldn&apos;t display.</p>
      <div className="mt-4 flex gap-3">
        <button type="button" className="btn" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="btn">
          Back to traces
        </Link>
      </div>
    </div>
  );
}
