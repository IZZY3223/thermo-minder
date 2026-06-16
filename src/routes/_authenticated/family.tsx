import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/family")({
  head: () => ({ meta: [{ title: "Family Chat — ThermoTracker" }] }),
  component: FamilyPage,
});

type Family = { id: string; name: string; created_by: string; invite_code?: string | null };
type Member = { user_id: string; display_name: string };
type Message = {
  id: string;
  family_id: string;
  user_id: string;
  display_name: string;
  content: string;
  created_at: string;
};

function FamilyPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // create / join form state
  const [newName, setNewName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase
      .from("families")
      .select("id, name, created_by")
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) return toast.error(error.message);
    setFamilies(data ?? []);
    if (!activeId && data && data.length) setActiveId(data[0].id);
  }
  useEffect(() => {
    if (userId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function createFamily(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const name = newName.trim();
    const dn = displayName.trim();
    if (!name || !dn) return toast.error("Family name and your display name are required");
    const { data: fam, error } = await supabase
      .from("families")
      .insert({ name, created_by: userId })
      .select("id, name, created_by")
      .single();
    if (error || !fam) return toast.error(error?.message ?? "Failed");
    const { error: mErr } = await supabase
      .from("family_members")
      .insert({ family_id: fam.id, user_id: userId, display_name: dn });
    if (mErr) return toast.error(mErr.message);
    const { data: code } = await supabase.rpc("get_family_invite_code", { _family_id: fam.id });
    setNewName("");
    setDisplayName("");
    setActiveId(fam.id);
    toast.success(`Created “${fam.name}”${code ? `. Invite code: ${code}` : ""}`);
    refresh();
  }

  async function joinFamily(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const code = joinCode.trim().toUpperCase();
    const dn = joinName.trim();
    if (!code || !dn) return toast.error("Invite code and your display name are required");
    const { data: famId, error } = await supabase.rpc("join_family_by_code", {
      _code: code,
      _display_name: dn,
    });
    if (error || !famId) return toast.error(error?.message ?? "No family found for that code");
    setJoinCode("");
    setJoinName("");
    setActiveId(famId as string);
    toast.success("Joined family");
    refresh();
  }

  const active = families.find((f) => f.id === activeId) ?? null;

  return (
    <AppShell title="Family Chat">
      <Toaster theme="dark" richColors />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-teal-300">
              Your families
            </h2>
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : families.length === 0 ? (
              <p className="text-sm text-slate-400">No families yet. Create or join one below.</p>
            ) : (
              <ul className="space-y-1">
                {families.map((f) => (
                  <li key={f.id}>
                    <button
                      onClick={() => setActiveId(f.id)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                        f.id === activeId
                          ? "bg-teal-500/15 text-teal-200"
                          : "text-slate-300 hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="font-medium">{f.name}</div>
                      {f.created_by === userId && f.invite_code && (
                        <div className="text-xs text-slate-500">Code: {f.invite_code}</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-teal-300">
              Create a family
            </h2>
            <form onSubmit={createFamily} className="space-y-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Family name"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
              />
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name in this family"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
              />
              <button className="w-full rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400">
                Create
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-teal-300">
              Join with code
            </h2>
            <form onSubmit={joinFamily} className="space-y-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Invite code"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm uppercase"
              />
              <input
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Your name in that family"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
              />
              <button className="w-full rounded-lg border border-teal-400/40 px-3 py-2 text-sm font-semibold text-teal-200 hover:bg-teal-500/10">
                Join
              </button>
            </form>
          </section>

          {active && active.created_by === userId && (
            <AddMemberSection familyId={active.id} onAdded={() => setActiveId(active.id)} />
          )}
        </aside>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
          {active && userId ? (
            <FamilyRoom family={active} userId={userId} />
          ) : (
            <div className="flex h-[60vh] items-center justify-center p-6 text-center text-slate-400">
              Pick a family on the left, or create / join one to start chatting.
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function FamilyRoom({ family, userId }: { family: Family; userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <FamilyRoomView
      family={family} userId={userId}
      messages={messages} setMessages={setMessages}
      members={members} setMembers={setMembers}
      text={text} setText={setText}
      sending={sending} setSending={setSending}
      inviteCode={inviteCode} setInviteCode={setInviteCode}
      scrollRef={scrollRef}
    />
  );
}

function AddMemberSection({ familyId, onAdded }: { familyId: string; onAdded: () => void }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 7) return toast.error("Enter a valid phone number");
    if (!name.trim()) return toast.error("Enter the member's name");
    setBusy(true);
    const { error } = await supabase.rpc("add_family_member_by_phone", {
      _family_id: familyId,
      _phone: cleanPhone,
      _display_name: name.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${name.trim()} added to the family`);
    setPhone("");
    setName("");
    onAdded();
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-teal-300">
        Add member
      </h2>
      <p className="mb-2 text-xs text-slate-400">
        Add anyone with an account by their phone number — no invite code needed.
      </p>
      <form onSubmit={submit} className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Member's name"
          className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Member's phone number"
          inputMode="tel"
          className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm tracking-wider"
        />
        <button
          disabled={busy}
          className="w-full rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add to family"}
        </button>
      </form>
    </section>
  );
}

type FamilyRoomViewProps = {
  family: Family; userId: string;
  messages: Message[]; setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  members: Member[]; setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  text: string; setText: React.Dispatch<React.SetStateAction<string>>;
  sending: boolean; setSending: React.Dispatch<React.SetStateAction<boolean>>;
  inviteCode: string | null; setInviteCode: React.Dispatch<React.SetStateAction<string | null>>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
};

function FamilyRoomView({
  family, userId, messages, setMessages, members, setMembers,
  text, setText, sending, setSending, inviteCode, setInviteCode, scrollRef,
}: FamilyRoomViewProps) {

  const me = members.find((m) => m.user_id === userId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: msgs }, { data: mems }] = await Promise.all([
        supabase
          .from("family_messages")
          .select("*")
          .eq("family_id", family.id)
          .order("created_at", { ascending: true })
          .limit(500),
        supabase
          .from("family_members")
          .select("user_id, display_name")
          .eq("family_id", family.id),
      ]);
      if (cancelled) return;
      setMessages((msgs as Message[]) ?? []);
      setMembers((mems as Member[]) ?? []);
    })();

    const channel = supabase
      .channel(`family:${family.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "family_messages", filter: `family_id=eq.${family.id}` },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as Message).id) ? prev : [...prev, payload.new as Message],
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [family.id]);

  useEffect(() => {
    if (family.created_by !== userId) {
      setInviteCode(null);
      return;
    }
    supabase
      .rpc("get_family_invite_code", { _family_id: family.id })
      .then(({ data }) => setInviteCode((data as string | null) ?? null));
  }, [family.id, family.created_by, userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || !me) return;
    setSending(true);
    const { error } = await supabase.from("family_messages").insert({
      family_id: family.id,
      user_id: userId,
      display_name: me.display_name,
      content,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setText("");
  }

  return (
    <div className="flex h-[70vh] flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="font-semibold">{family.name}</h2>
          <p className="text-xs text-slate-400">
            {members.length} member{members.length === 1 ? "" : "s"}
            {inviteCode && (
              <>
                {" "}· code <span className="font-mono text-teal-300">{inviteCode}</span>
              </>
            )}
          </p>
        </div>
        {inviteCode && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(inviteCode);
              toast.success("Invite code copied");
            }}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:border-teal-400"
          >
            Copy code
          </button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-slate-500">No messages yet. Say hi 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === userId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-teal-500 text-slate-950" : "bg-slate-800 text-slate-100"
                  }`}
                >
                  {!mine && (
                    <div className="mb-0.5 text-xs font-semibold text-teal-300">{m.display_name}</div>
                  )}
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {me ? (
        <form onSubmit={send} className="flex gap-2 border-t border-slate-800 p-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Message ${family.name}…`}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
          />
          <button
            disabled={sending || !text.trim()}
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      ) : (
        <div className="border-t border-slate-800 p-3 text-center text-xs text-slate-400">
          You aren't a member of this family.
        </div>
      )}
    </div>
  );
}