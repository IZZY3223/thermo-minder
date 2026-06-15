// Client-side error collector. Stores recent runtime errors in localStorage
// so they can be inspected on the /debug page.

export type LoggedError = {
  id: string;
  time: string; // ISO
  kind: "error" | "unhandledrejection" | "console.error" | "manual";
  message: string;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  url?: string;
};

const KEY = "tt:errors";
const MAX = 100;

function safeParse(raw: string | null): LoggedError[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as LoggedError[]) : [];
  } catch {
    return [];
  }
}

export function readErrors(): LoggedError[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(KEY));
}

export function clearErrors() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export function logError(entry: Omit<LoggedError, "id" | "time" | "url"> & { url?: string }) {
  if (typeof window === "undefined") return;
  const list = readErrors();
  const next: LoggedError = {
    id: Math.random().toString(36).slice(2, 10),
    time: new Date().toISOString(),
    url: entry.url ?? window.location.href,
    ...entry,
  };
  list.unshift(next);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // ignore quota
  }
}

let installed = false;
export function installErrorCollector() {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  window.addEventListener("error", (event) => {
    const err = (event as ErrorEvent).error;
    logError({
      kind: "error",
      message: (event as ErrorEvent).message || String(err) || "Unknown error",
      stack: err && err.stack ? String(err.stack) : undefined,
      source: (event as ErrorEvent).filename,
      lineno: (event as ErrorEvent).lineno,
      colno: (event as ErrorEvent).colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    const message =
      reason instanceof Error ? reason.message : typeof reason === "string" ? reason : JSON.stringify(reason);
    logError({
      kind: "unhandledrejection",
      message: message || "Unhandled promise rejection",
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      const first = args[0];
      const message =
        first instanceof Error ? first.message : args.map((a) => (typeof a === "string" ? a : safeStringify(a))).join(" ");
      const stack = first instanceof Error ? first.stack : undefined;
      logError({ kind: "console.error", message, stack });
    } catch {
      // swallow logging failures
    }
    origError(...args);
  };
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}