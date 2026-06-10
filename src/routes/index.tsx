import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import { toast, Toaster } from "sonner";
import { Thermometer, Activity, MessageCircle, Send, Play, RotateCcw, FastForward } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ThermoTracker 2.0 — Smart Thermos Companion" },
      { name: "description", content: "Set drink temperature reminders, simulate Newton's cooling in real time, and chat with family about what's ready." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { property: "og:title", content: "ThermoTracker 2.0" },
      { property: "og:description", content: "Reminder, live cooling tracker, and family chat in one mobile-first app." },
    ],
  }),
  component: App,
});

type Tab = "reminder" | "tracker" | "chat";

function App() {
  const [tab, setTab] = useState<Tab>("reminder");
  const [unread, setUnread] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => loadMessages());
  const [myName, setMyName] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("tt:name") || "Me" : "Me"));

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("tt:messages", JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("tt:name", myName);
  }, [myName]);

  function postMessage(msg: Omit<ChatMessage, "id" | "time">) {
    const m: ChatMessage = { ...msg, id: Date.now() + Math.random(), time: Date.now() };
    setChatMessages((prev) => [...prev, m]);
    if (tab !== "chat") setUnread((u) => u + 1);
  }

  function onTab(t: Tab) {
    setTab(t);
    if (t === "chat") setUnread(0);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <Toaster theme="dark" position="top-center" richColors />
      <div className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-slate-950 pb-20">
        <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 px-5 py-3 backdrop-blur">
          <h1 className="text-base font-semibold tracking-tight">
            <span className="text-teal-400">Thermo</span>Tracker <span className="text-xs font-normal text-slate-500">2.0</span>
          </h1>
        </header>

        <main className="flex-1 px-4 pt-4">
          {tab === "reminder" && <ReminderScreen myName={myName} postMessage={postMessage} />}
          {tab === "tracker" && <TrackerScreen />}
          {tab === "chat" && (
            <ChatScreen
              myName={myName}
              setMyName={setMyName}
              messages={chatMessages}
              setMessages={setChatMessages}
            />
          )}
        </main>

        <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[480px] -translate-x-1/2 border-t border-slate-800 bg-slate-900/95 backdrop-blur">
          <div className="grid grid-cols-3">
            <TabButton active={tab === "reminder"} onClick={() => onTab("reminder")} icon={<Thermometer size={22} />} label="Reminder" />
            <TabButton active={tab === "tracker"} onClick={() => onTab("tracker")} icon={<Activity size={22} />} label="Tracker" />
            <TabButton
              active={tab === "chat"}
              onClick={() => onTab("chat")}
              icon={
                <div className="relative">
                  <MessageCircle size={22} />
                  {unread > 0 && (
                    <span className="absolute -right-2 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      {unread}
                    </span>
                  )}
                </div>
              }
              label="Chat"
            />
          </div>
        </nav>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-3 text-xs transition ${
        active ? "text-teal-400" : "text-slate-500"
      }`}
    >
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

/* ================= REMINDER SCREEN ================= */

type AlertLog = { id: number; time: number; message: string; tone: "amber" | "green" | "red" };

function ReminderScreen({
  myName,
  postMessage,
}: {
  myName: string;
  postMessage: (m: Omit<ChatMessage, "id" | "time">) => void;
}) {
  const [drink, setDrink] = useState("Morning tea");
  const [startTemp, setStartTemp] = useState(80);
  const [targetTemp, setTargetTemp] = useState(60);
  const [ratePerDeg, setRatePerDeg] = useState(3);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const firedRef = useRef<{ pre: boolean; ready: boolean; late: boolean }>({ pre: false, ready: false, late: false });

  const totalSeconds = Math.max(0, (startTemp - targetTemp) * ratePerDeg * 60);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);

  const elapsedSec = startedAt ? Math.floor((now - startedAt) / 1000) : 0;
  const remainingSec = Math.max(0, totalSeconds - elapsedSec);
  const pastTargetSec = Math.max(0, elapsedSec - totalSeconds);

  // current modelled temp (linear by the user's rate)
  const currentTemp = useMemo(() => {
    if (!startedAt) return startTemp;
    const drop = elapsedSec / 60 / ratePerDeg;
    return Math.max(targetTemp - 50, startTemp - drop);
  }, [startedAt, elapsedSec, ratePerDeg, startTemp, targetTemp]);

  useEffect(() => {
    if (!running || !startedAt) return;
    const f = firedRef.current;
    if (!f.pre && remainingSec <= 120 && remainingSec > 0) {
      f.pre = true;
      const msg = `${drink} is almost ready — 2 min left!`;
      toast(msg, { style: { background: "#92400e", color: "#fff" } });
      setLogs((l) => [{ id: Date.now(), time: Date.now(), message: msg, tone: "amber" }, ...l]);
    }
    if (!f.ready && remainingSec === 0 && elapsedSec >= totalSeconds) {
      f.ready = true;
      const msg = `${drink} is at ${targetTemp}°C — perfect to drink now!`;
      toast.success(msg);
      beep();
      setLogs((l) => [{ id: Date.now(), time: Date.now(), message: msg, tone: "green" }, ...l]);
      postMessage({ author: myName, text: `${myName}'s ${drink} is ready at ${targetTemp}°C!`, mine: true, kind: "auto" });
    }
    if (!f.late && pastTargetSec >= 5 * 60) {
      f.late = true;
      const msg = `${drink} is cooling further — drink soon`;
      toast.error(msg);
      setLogs((l) => [{ id: Date.now(), time: Date.now(), message: msg, tone: "red" }, ...l]);
    }
  }, [running, startedAt, remainingSec, pastTargetSec, elapsedSec, totalSeconds, drink, targetTemp, myName, postMessage]);

  function start() {
    firedRef.current = { pre: false, ready: false, late: false };
    setStartedAt(Date.now());
    setNow(Date.now());
    setRunning(true);
    setLogs((l) => [{ id: Date.now(), time: Date.now(), message: `Reminder started — ${formatMMSS(totalSeconds)} until ${targetTemp}°C`, tone: "amber" }, ...l]);
  }

  function reset() {
    setRunning(false);
    setStartedAt(null);
    firedRef.current = { pre: false, ready: false, late: false };
  }

  const pulsing = running && remainingSec > 0 && remainingSec <= 120;

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border border-teal-500/40 bg-gradient-to-br from-teal-600 to-teal-700 p-5 text-white shadow-lg shadow-teal-900/30 ${
          pulsing ? "animate-pulse" : ""
        }`}
      >
        <div className="text-xs uppercase tracking-widest text-teal-100/80">{drink || "Drink"}</div>
        <div className="mt-2 font-mono text-6xl font-bold tabular-nums tracking-tight">
          {formatMMSS(running ? remainingSec : totalSeconds)}
        </div>
        <div className="mt-2 flex justify-between text-xs text-teal-100/90">
          <span>≈ {currentTemp.toFixed(1)}°C now</span>
          <span>target {targetTemp}°C</span>
        </div>
      </div>

      <Card title="Setup">
        <Field label="Drink name">
          <input
            value={drink}
            onChange={(e) => setDrink(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start temp (°C)">
            <NumberInput value={startTemp} onChange={setStartTemp} />
          </Field>
          <Field label="Target (°C)">
            <NumberInput value={targetTemp} onChange={setTargetTemp} />
          </Field>
        </div>
        <Field label="Cooling rate (min per 1°C drop)">
          <NumberInput value={ratePerDeg} onChange={setRatePerDeg} step={0.5} />
          <p className="mt-1 text-[11px] text-slate-500">
            Measure once: time how long your thermos goes from 80→70°C, divide by 10.
          </p>
        </Field>
        <div className="flex gap-2 pt-1">
          <button
            onClick={start}
            disabled={running || totalSeconds === 0}
            className="flex-1 rounded-lg bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
          >
            {running ? "Running…" : "Start Reminder"}
          </button>
          {running && (
            <button onClick={reset} className="rounded-lg border border-slate-700 px-4 py-3 text-sm text-slate-300">
              Reset
            </button>
          )}
        </div>
      </Card>

      <Card title="Notifications">
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">No alerts yet. Start a reminder to see them here.</p>
        ) : (
          <ul className="space-y-2">
            {logs.map((l) => (
              <li key={l.id} className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm">
                <span
                  className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
                    l.tone === "green" ? "bg-emerald-400" : l.tone === "red" ? "bg-red-400" : "bg-amber-400"
                  }`}
                />
                <div className="flex-1">
                  <div className="text-slate-200">{l.message}</div>
                  <div className="text-[11px] text-slate-500">{formatTime(l.time)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ================= TRACKER SCREEN ================= */

function TrackerScreen() {
  const [efficiency, setEfficiency] = useState(70);
  const [initial, setInitial] = useState(90);
  const [room, setRoom] = useState(25);
  const [volume, setVolume] = useState(300);
  const [elapsed, setElapsed] = useState(0); // simulated minutes
  const [running, setRunning] = useState(false);
  const firedRef = useRef<Record<string, boolean>>({});

  const k = (1 - efficiency / 100) * 0.005 * (300 / Math.max(volume, 50));
  const temp = (t: number) => room + (initial - room) * Math.exp(-k * t);
  const current = temp(elapsed);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000); // 1 sim minute per second
    return () => clearInterval(id);
  }, [running]);

  // milestones: 25/50/75% heat lost + room
  useEffect(() => {
    const totalDrop = initial - room;
    if (totalDrop <= 0) return;
    const lost = (initial - current) / totalDrop;
    const f = firedRef.current;
    [
      { k: "25", v: 0.25, msg: "25% of heat lost" },
      { k: "50", v: 0.5, msg: "Halfway there — 50% heat lost" },
      { k: "75", v: 0.75, msg: "75% heat lost — drink soon!" },
      { k: "room", v: 0.99, msg: "Cooled to room temperature" },
    ].forEach((m) => {
      if (!f[m.k] && lost >= m.v) {
        f[m.k] = true;
        toast(m.msg);
      }
    });
  }, [current, initial, room]);

  const data = useMemo(() => {
    const span = Math.max(elapsed + 5, 60);
    const step = Math.max(1, Math.floor(span / 60));
    const arr: { t: number; temp: number }[] = [];
    for (let t = 0; t <= span; t += step) arr.push({ t, temp: +temp(t).toFixed(2) });
    return arr;
  }, [elapsed, initial, room, efficiency, volume]);

  const heatRetained = initial - room > 0 ? Math.max(0, ((current - room) / (initial - room)) * 100) : 0;
  const timeTo = (target: number) => {
    if (target <= room || target >= initial) return null;
    return Math.log((initial - room) / (target - room)) / k;
  };
  const t50 = timeTo(50);
  const troom = timeTo(room + 0.5);

  function reset() {
    setRunning(false);
    setElapsed(0);
    firedRef.current = {};
  }

  const tempColor = current > 70 ? "text-emerald-400" : current >= 50 ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-4">
      <Card>
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-slate-500">Current temperature</div>
          <div className={`mt-1 font-mono text-6xl font-bold tabular-nums transition-colors ${tempColor}`}>
            {current.toFixed(1)}°
          </div>
          <div className="mt-1 text-xs text-slate-500">{elapsed} min elapsed (1 sec = 1 min)</div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setRunning((r) => !r)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-teal-500"
          >
            <Play size={16} /> {running ? "Pause" : "Start"}
          </button>
          <button
            onClick={() => setElapsed((e) => e + 10)}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2.5 text-sm text-slate-200"
          >
            <FastForward size={16} /> +10
          </button>
          <button
            onClick={reset}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2.5 text-sm text-slate-200"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </Card>

      <Card title="Cooling curve">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fill: "#64748b", fontSize: 10 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} domain={[room - 5, initial + 5]} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} />
              <ReferenceArea y1={70} y2={initial + 5} fill="#10b981" fillOpacity={0.07} />
              <ReferenceArea y1={50} y2={70} fill="#f59e0b" fillOpacity={0.07} />
              <ReferenceArea y1={room - 5} y2={50} fill="#ef4444" fillOpacity={0.07} />
              <Line type="monotone" dataKey="temp" stroke="#14b8a6" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Setup">
        <Field label={`Thermos efficiency: ${efficiency}%`}>
          <input
            type="range"
            min={0}
            max={100}
            value={efficiency}
            onChange={(e) => setEfficiency(+e.target.value)}
            className="w-full accent-teal-500"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Initial temp (°C)">
            <NumberInput value={initial} onChange={setInitial} />
          </Field>
          <Field label="Room temp (°C)">
            <NumberInput value={room} onChange={setRoom} />
          </Field>
        </div>
        <Field label="Volume (ml)">
          <NumberInput value={volume} onChange={setVolume} step={50} />
        </Field>
      </Card>

      <Card title="Summary">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Heat retained" value={`${heatRetained.toFixed(0)}%`} />
          <Stat label="Elapsed" value={`${elapsed} min`} />
          <Stat label="Time → 50°C" value={t50 !== null && t50 > elapsed ? `${(t50 - elapsed).toFixed(0)} min` : "—"} />
          <Stat label="Time → room" value={troom !== null && troom > elapsed ? `${(troom - elapsed).toFixed(0)} min` : "—"} />
        </div>
      </Card>
    </div>
  );
}

/* ================= CHAT SCREEN ================= */

type ChatMessage = { id: number; author: string; text: string; mine: boolean; time: number; kind?: "auto" };

const PRESETS = ["Tea is ready", "Coffee is ready", "Porridge is ready", "Food is ready", "Drink now!"];
const NAMES = ["Mum", "Dad", "Me"];

function loadMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("tt:messages") || "[]");
  } catch {
    return [];
  }
}

function ChatScreen({
  myName,
  setMyName,
  messages,
  setMessages,
}: {
  myName: string;
  setMyName: (n: string) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}) {
  const [text, setText] = useState("");
  const [customName, setCustomName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function send(t?: string) {
    const val = (t ?? text).trim();
    if (!val) return;
    setMessages((m) => [...m, { id: Date.now() + Math.random(), author: myName, text: val, mine: true, time: Date.now() }]);
    setText("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex h-[calc(100vh-180px)] flex-col gap-3">
      <Card>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">You are:</span>
          <div className="flex gap-1">
            {NAMES.map((n) => (
              <button
                key={n}
                onClick={() => setMyName(n)}
                className={`rounded-full px-3 py-1 text-xs ${
                  myName === n ? "bg-teal-600 text-white" : "bg-slate-800 text-slate-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onBlur={() => customName.trim() && setMyName(customName.trim())}
            placeholder="Custom…"
            className="ml-auto w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
        </div>
      </Card>

      <div className="flex-1 space-y-2 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
        {messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-slate-500">No messages yet. Say hi!</p>
        ) : (
          messages.map((m) => {
            const mine = m.author === myName;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-teal-600 text-white" : "bg-slate-800 text-slate-100"
                  }`}
                >
                  {!mine && <div className="mb-0.5 text-[10px] font-semibold text-teal-300">{m.author}</div>}
                  <div className="whitespace-pre-wrap">{m.text}</div>
                  <div className={`mt-0.5 text-[10px] ${mine ? "text-teal-100/70" : "text-slate-500"}`}>
                    {formatTime(m.time)}
                    {m.kind === "auto" && " • auto"}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setText(p)}
              className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300 hover:border-teal-500 hover:text-teal-300"
            >
              {p}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="rounded-lg bg-teal-600 px-4 text-white disabled:opacity-50"
            aria-label="Send"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

/* ================= UI atoms ================= */

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      {title && <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</h2>}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => onChange(+e.target.value)}
      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function formatMMSS(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
function formatTime(t: number) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function beep() {
  try {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {
    /* noop */
  }
}