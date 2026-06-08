import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ThermoTracker — Heat Loss Simulator & Drink Reminder" },
      { name: "description", content: "Simulate heat loss in a thermos using Newton's Law of Cooling and get reminders when it's the perfect time to drink." },
      { property: "og:title", content: "ThermoTracker" },
      { property: "og:description", content: "Track your thermos temperature in real time and get reminders." },
    ],
  }),
  component: Index,
});

type LogEntry = { id: number; time: string; message: string; tone: string };

const MILESTONES = [
  { pct: 0.25, message: "Your liquid is cooling — consider drinking soon", tone: "amber" },
  { pct: 0.5, message: "Halfway to room temperature — liquid is warm but not hot", tone: "orange" },
  { pct: 0.75, message: "Liquid is mostly cool — heat loss nearly complete", tone: "red" },
  { pct: 0.99, message: "Liquid has reached room temperature", tone: "slate" },
] as const;

const toneStyles: Record<string, string> = {
  amber: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  orange: "border-orange-400/40 bg-orange-400/10 text-orange-200",
  red: "border-red-400/40 bg-red-400/10 text-red-200",
  slate: "border-slate-400/40 bg-slate-400/10 text-slate-200",
};

function tempColor(t: number) {
  if (t >= 70) return "text-emerald-400";
  if (t >= 50) return "text-amber-400";
  return "text-red-400";
}

function fmtTime(min: number) {
  if (min < 60) return `${min.toFixed(0)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}

function Index() {
  const [efficiency, setEfficiency] = useState(70);
  const [initialTemp, setInitialTemp] = useState(90);
  const [roomTemp, setRoomTemp] = useState(25);
  const [volume, setVolume] = useState(300);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // minutes
  const [contents, setContents] = useState("Tea");
  const [log, setLog] = useState<LogEntry[]>([]);
  const triggered = useRef<Set<number>>(new Set());
  const startedAt = useRef<{ initial: number; room: number } | null>(null);

  const k = useMemo(() => (1 - efficiency / 100) * 0.005, [efficiency]);

  const currentTemp = useMemo(() => {
    const base = startedAt.current ?? { initial: initialTemp, room: roomTemp };
    return base.room + (base.initial - base.room) * Math.exp(-k * elapsed);
  }, [elapsed, initialTemp, roomTemp, k]);

  const chartData = useMemo(() => {
    const base = startedAt.current ?? { initial: initialTemp, room: roomTemp };
    const maxT = Math.max(elapsed + 5, 30);
    const step = Math.max(1, Math.round(maxT / 60));
    const points = [];
    for (let t = 0; t <= maxT; t += step) {
      points.push({
        t,
        temp: +(base.room + (base.initial - base.room) * Math.exp(-k * t)).toFixed(2),
      });
    }
    return points;
  }, [elapsed, initialTemp, roomTemp, k]);

  // Real-time tick: 1 simulated minute per real second for visible progress
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Notifications
  useEffect(() => {
    const base = startedAt.current;
    if (!base) return;
    const totalDrop = base.initial - base.room;
    if (totalDrop <= 0) return;
    const lostPct = (base.initial - currentTemp) / totalDrop;
    MILESTONES.forEach((m, idx) => {
      if (lostPct >= m.pct && !triggered.current.has(idx)) {
        triggered.current.add(idx);
        const entry: LogEntry = {
          id: Date.now() + idx,
          time: fmtTime(elapsed),
          message: m.message,
          tone: m.tone,
        };
        setLog((l) => [entry, ...l]);
        toast(m.message, { description: `${contents} • ${currentTemp.toFixed(1)}°C @ ${fmtTime(elapsed)}` });
      }
    });
  }, [currentTemp, elapsed, contents]);

  function start() {
    startedAt.current = { initial: initialTemp, room: roomTemp };
    triggered.current = new Set();
    setLog([]);
    setElapsed(0);
    setRunning(true);
  }

  function reset() {
    setRunning(false);
    setElapsed(0);
    startedAt.current = null;
    triggered.current = new Set();
    setLog([]);
  }

  function fastForward() {
    if (!startedAt.current) startedAt.current = { initial: initialTemp, room: roomTemp };
    setElapsed((e) => e + 10);
  }

  const base = startedAt.current ?? { initial: initialTemp, room: roomTemp };
  const heatRetained =
    base.initial > base.room
      ? Math.max(0, ((currentTemp - base.room) / (base.initial - base.room)) * 100)
      : 0;

  const timeTo = (target: number) => {
    if (target >= base.initial) return "—";
    if (target <= base.room) return "∞";
    const ratio = (target - base.room) / (base.initial - base.room);
    if (ratio <= 0) return "∞";
    if (k <= 0) return "∞";
    const t = -Math.log(ratio) / k;
    return fmtTime(Math.max(0, t));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-teal-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-teal-400" />
              <span className="text-xs font-medium uppercase tracking-widest">ThermoTracker</span>
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              Heat-loss simulator & drink reminder
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Newton's Law of Cooling, in real time. Get pinged when your {contents.toLowerCase()} hits the sweet spot.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: inputs + summary */}
          <aside className="lg:col-span-3 space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Setup</h2>
              <div className="space-y-4">
                <Field label="What's in the thermos?">
                  <input
                    value={contents}
                    onChange={(e) => setContents(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
                  />
                </Field>
                <Field label={`Thermos efficiency: ${efficiency}%`}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={efficiency}
                    onChange={(e) => setEfficiency(+e.target.value)}
                    className="w-full accent-teal-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Cup</span><span>Basic</span><span>Vacuum</span>
                  </div>
                </Field>
                <Field label="Initial temp (°C)">
                  <input type="number" min={30} max={100} value={initialTemp}
                    onChange={(e) => setInitialTemp(+e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none" />
                </Field>
                <Field label="Room temp (°C)">
                  <input type="number" min={10} max={40} value={roomTemp}
                    onChange={(e) => setRoomTemp(+e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none" />
                </Field>
                <Field label="Volume (ml)">
                  <input type="number" min={100} max={1000} value={volume}
                    onChange={(e) => setVolume(+e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none" />
                </Field>
              </div>
              <div className="mt-5 flex gap-2">
                {!running ? (
                  <button onClick={start}
                    className="flex-1 rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-teal-400">
                    Start
                  </button>
                ) : (
                  <button onClick={() => setRunning(false)}
                    className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">
                    Pause
                  </button>
                )}
                <button onClick={fastForward}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:border-teal-400 hover:text-teal-300">
                  +10 min
                </button>
                <button onClick={reset}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:border-red-400 hover:text-red-300">
                  Reset
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Summary</h2>
              <dl className="space-y-3 text-sm">
                <Row label="Heat retained" value={`${heatRetained.toFixed(1)}%`} />
                <Row label="Time elapsed" value={fmtTime(elapsed)} />
                <Row label="Cooling constant k" value={k.toFixed(5)} />
                <Row label="Time → 50°C" value={timeTo(50)} />
                <Row label="Time → room" value={timeTo(roomTemp + 0.5)} />
              </dl>
            </section>
          </aside>

          {/* Center: live temp + chart */}
          <main className="lg:col-span-6 space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center">
              <p className="text-xs uppercase tracking-widest text-slate-400">Current temperature</p>
              <div className={`mt-2 text-7xl font-bold tabular-nums transition-colors sm:text-8xl ${tempColor(currentTemp)}`}>
                {currentTemp.toFixed(1)}<span className="text-3xl text-slate-500">°C</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                {contents} • efficiency {efficiency}% • {volume} ml
              </p>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Cooling curve</h2>
                <div className="flex gap-3 text-[10px] text-slate-400">
                  <Legend color="bg-emerald-400" label=">70°C" />
                  <Legend color="bg-amber-400" label="50–70°C" />
                  <Legend color="bg-red-400" label="<50°C" />
                </div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis dataKey="t" stroke="#64748b" tick={{ fontSize: 11 }}
                      label={{ value: "minutes", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 11 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={[roomTemp - 2, Math.max(initialTemp + 2, base.initial + 2)]} />
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#94a3b8" }}
                      formatter={(v: number) => [`${v}°C`, "Temp"]}
                    />
                    <ReferenceLine y={70} stroke="#10b981" strokeDasharray="4 4" />
                    <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 4" />
                    <ReferenceLine x={elapsed} stroke="#14b8a6" />
                    <Line type="monotone" dataKey="temp" stroke="#14b8a6" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </main>

          {/* Right: notifications */}
          <aside className="lg:col-span-3">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Notifications log
              </h2>
              {log.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Reminders will appear here as your {contents.toLowerCase()} cools.
                </p>
              ) : (
                <ul className="space-y-2">
                  {log.map((entry) => (
                    <li key={entry.id}
                      className={`rounded-lg border px-3 py-2 text-sm ${toneStyles[entry.tone]}`}>
                      <div className="text-[10px] uppercase tracking-wider opacity-70">{entry.time}</div>
                      <div>{entry.message}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>

        <footer className="mt-10 text-center text-xs text-slate-500">
          T(t) = T<sub>room</sub> + (T<sub>0</sub> − T<sub>room</sub>) · e<sup>−kt</sup>  •  k = (1 − efficiency/100) × 0.005
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2 last:border-0 last:pb-0">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-100">{value}</dd>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
