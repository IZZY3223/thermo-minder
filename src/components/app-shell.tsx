import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      navigate({ to: "/" });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <button
              onClick={goBack}
              aria-label="Go back"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-300 hover:border-teal-400 hover:text-teal-300"
            >
              <ArrowLeft size={16} />
            </button>
            <Link to="/" className="flex items-center gap-2 text-teal-400">
              <img
                src="/__l5e/assets-v1/96422966-c9e8-4a26-87d0-b7f3f3b977fc/thermominder.png"
                alt="ThermoMinder"
                className="h-7 w-7 rounded-md object-contain"
              />
              <span className="text-xs font-semibold uppercase tracking-widest">ThermoTracker</span>
            </Link>
            <nav className="hidden gap-1 text-sm sm:flex">
              <NavLink to="/">Simulator</NavLink>
              <NavLink to="/records">Records</NavLink>
              <NavLink to="/family">Family</NavLink>
              <NavLink to="/chat">Chat</NavLink>
            </nav>
          </div>
          <button
            onClick={signOut}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-red-400 hover:text-red-300"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {children}
      </main>
    </div>
  );
}

function NavLink({ to, children }: { to: "/" | "/records" | "/family" | "/chat"; children: ReactNode }) {
  return (
    <Link
      to={to}
      activeProps={{ className: "bg-slate-800/80 text-teal-300" }}
      inactiveProps={{ className: "text-slate-400 hover:text-slate-100" }}
      activeOptions={{ exact: to === "/" }}
      className="rounded-md px-3 py-1.5"
    >
      {children}
    </Link>
  );
}