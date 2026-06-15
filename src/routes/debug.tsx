import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { readErrors, clearErrors, type LoggedError } from "@/lib/error-log";

export const Route = createFileRoute("/debug")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Debug — Captured Errors" },
      { name: "description", content: "Inspect runtime errors collected from the app." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DebugPage,
});

function DebugPage() {
  const [errors, setErrors] = useState<LoggedError[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setErrors(readErrors());
    const i = setInterval(() => setErrors(readErrors()), 2000);
    return () => clearInterval(i);
  }, [tick]);

  function copyAll() {
    const text = errors
      .map(
        (e) =>
          `[${e.time}] (${e.kind}) ${e.message}\n` +
          (e.source ? `  at ${e.source}:${e.lineno ?? "?"}:${e.colno ?? "?"}\n` : "") +
          (e.url ? `  url: ${e.url}\n` : "") +
          (e.stack ? e.stack + "\n" : ""),
      )
      .join("\n");
    if (navigator.clipboard) navigator.clipboard.writeText(text);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Captured Errors</h1>
            <p className="text-sm text-slate-400">
              {errors.length} entr{errors.length === 1 ? "y" : "ies"} stored locally on this device.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/"
              className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
            >
              ← Back
            </Link>
            <button
              onClick={copyAll}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
            >
              Copy all
            </button>
            <button
              onClick={() => {
                clearErrors();
                setTick((t) => t + 1);
              }}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium hover:bg-red-500"
            >
              Clear
            </button>
          </div>
        </header>

        {errors.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-center text-slate-400">
            No errors captured yet. 🎉
          </div>
        ) : (
          <ul className="space-y-3">
            {errors.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      e.kind === "error"
                        ? "bg-red-500/20 text-red-300"
                        : e.kind === "unhandledrejection"
                          ? "bg-orange-500/20 text-orange-300"
                          : "bg-yellow-500/20 text-yellow-300"
                    }`}
                  >
                    {e.kind}
                  </span>
                  <span className="text-xs text-slate-500">{new Date(e.time).toLocaleString()}</span>
                </div>
                <div className="font-medium text-slate-100 break-words">{e.message}</div>
                {e.source && (
                  <div className="mt-1 text-xs text-slate-400">
                    at {e.source}:{e.lineno ?? "?"}:{e.colno ?? "?"}
                  </div>
                )}
                {e.url && (
                  <div className="mt-1 text-xs text-slate-500 break-all">url: {e.url}</div>
                )}
                {e.stack && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-950/80 p-2 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
                    {e.stack}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}