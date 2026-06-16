import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/thermominder.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — ThermoTracker" }] }),
  component: AuthPage,
});

const PHONE_RE = /^[0-9]{7,15}$/;
const PIN_RE = /^[0-9]{5}$/;
const phoneToEmail = (phone: string) => `${phone}@thermominder.app`;
const pinToPassword = (pin: string) => `tm-pin-${pin}`;

function AuthPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("0798937387");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/records" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "");
    if (!PHONE_RE.test(cleanPhone)) {
      toast.error("Enter a valid phone number");
      return;
    }
    if (!PIN_RE.test(pin)) {
      toast.error("PIN must be exactly 5 digits");
      return;
    }
    if (mode === "signup") {
      if (pin !== confirmPin) {
        toast.error("PINs do not match");
        return;
      }
      if (!name.trim()) {
        toast.error("Please enter your name");
        return;
      }
    }
    setLoading(true);
    const email = phoneToEmail(cleanPhone);
    const password = pinToPassword(pin);
    try {
      if (mode === "signup") {
        const signUp = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim() } },
        });
        if (signUp.error) {
          const m = signUp.error.message.toLowerCase();
          if (m.includes("registered") || m.includes("exists")) {
            toast.error("Account already exists. Please sign in instead.");
            setMode("signin");
            return;
          }
          throw signUp.error;
        }
        if (!signUp.data.session) {
          const retry = await supabase.auth.signInWithPassword({ email, password });
          if (retry.error) throw retry.error;
        }
        toast.success("Account created");
        navigate({ to: "/records" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const m = error.message.toLowerCase();
          if (m.includes("invalid") || m.includes("credentials") || m.includes("not found")) {
            toast.error("No account found. Please create one first.");
            setMode("signup");
            return;
          }
          throw error;
        }
        navigate({ to: "/records" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
      <Toaster theme="dark" richColors />
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-slate-100">
        <Link to="/" className="text-xs uppercase tracking-widest text-teal-400">
          ← ThermoTracker
        </Link>
        <div className="mt-4 flex flex-col items-center text-center">
          <img
            src={logoAsset.url}
            alt="ThermoMinder logo"
            className="h-20 w-20 rounded-2xl object-contain shadow-lg shadow-teal-500/10"
          />
          <h1 className="mt-3 text-2xl font-bold">{mode === "signup" ? "Create account" : "Sign in"}</h1>
        </div>
        <p className="mt-1 text-center text-sm text-slate-400">
          {mode === "signup"
            ? "Enter your name, phone number, and a 5-digit PIN."
            : "Use your phone number and 5-digit PIN."}
        </p>

        <div className="mt-4 grid grid-cols-2 rounded-lg border border-slate-700 bg-slate-950/40 p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              mode === "signin" ? "bg-teal-500 text-slate-950" : "text-slate-300"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              mode === "signup" ? "bg-teal-500 text-slate-950" : "text-slate-300"
            }`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Phone number</span>
            <input
              type="tel"
              required
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0798937387"
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm tracking-wider"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">5-digit PIN</span>
            <input
              type="password"
              required
              inputMode="numeric"
              pattern="[0-9]{5}"
              maxLength={5}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="•••••"
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-center text-lg tracking-[0.6em]"
            />
          </label>
          {mode === "signup" && (
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Confirm PIN</span>
              <input
                type="password"
                required
                inputMode="numeric"
                pattern="[0-9]{5}"
                maxLength={5}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="•••••"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-center text-lg tracking-[0.6em]"
              />
            </label>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50"
          >
            {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}