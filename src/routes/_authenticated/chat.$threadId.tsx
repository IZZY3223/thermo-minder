import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";
import {
  createThread,
  deleteThread,
  listThreads,
  loadThreadMessages,
} from "@/lib/chat.functions";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({ meta: [{ title: "ThermoBot — Family Chat" }] }),
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = useParams({ from: "/_authenticated/chat/$threadId" });
  return <ChatWindow key={threadId} threadId={threadId} />;
}

function ChatWindow({ threadId }: { threadId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listThreads);
  const createFn = useServerFn(createThread);
  const deleteFn = useServerFn(deleteThread);
  const loadFn = useServerFn(loadThreadMessages);

  const { data: threads = [] } = useQuery({
    queryKey: ["threads"],
    queryFn: () => listFn(),
  });

  const { data: initialMessages = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: () => loadFn({ data: { threadId } }),
  });

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages, id }) => {
          const { data } = await supabase.auth.getSession();
          return {
            body: { messages, threadId: id },
            headers: {
              Authorization: `Bearer ${data.session?.access_token ?? ""}`,
            },
          };
        },
      }),
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: threadId,
    transport,
    onFinish: () => {
      qc.invalidateQueries({ queryKey: ["threads"] });
    },
  });

  useEffect(() => {
    if (!loadingMsgs) {
      setMessages(initialMessages as unknown as UIMessage[]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, loadingMsgs]);

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, status]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, status]);

  const isLoading = status === "submitted" || status === "streaming";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage({ text });
  }

  async function onNewThread() {
    const t = await createFn();
    qc.invalidateQueries({ queryKey: ["threads"] });
    navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
  }

  async function onDelete(id: string) {
    await deleteFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["threads"] });
    if (id === threadId) {
      const remaining = threads.filter((t) => t.id !== id);
      if (remaining.length > 0) {
        navigate({ to: "/chat/$threadId", params: { threadId: remaining[0].id } });
      } else {
        navigate({ to: "/chat" });
      }
    }
  }

  return (
    <AppShell title="ThermoBot">
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
          <button
            onClick={onNewThread}
            className="mb-3 w-full rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400"
          >
            + New chat
          </button>
          <ul className="space-y-1">
            {threads.map((t) => {
              const active = t.id === threadId;
              return (
                <li key={t.id} className="group flex items-center gap-1">
                  <Link
                    to="/chat/$threadId"
                    params={{ threadId: t.id }}
                    className={`flex-1 truncate rounded-md px-2 py-1.5 text-sm ${
                      active
                        ? "bg-slate-800 text-teal-300"
                        : "text-slate-300 hover:bg-slate-800/50"
                    }`}
                  >
                    {t.title}
                  </Link>
                  <button
                    onClick={() => onDelete(t.id)}
                    className="opacity-0 group-hover:opacity-100 text-xs text-slate-500 hover:text-red-400"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="flex h-[70vh] flex-col rounded-2xl border border-slate-800 bg-slate-900/60">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && !isLoading ? (
              <div className="mt-10 text-center text-sm text-slate-500">
                Ask ThermoBot anything about your tea, coffee, or whatever's in the thermos.
              </div>
            ) : null}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-teal-500 text-slate-950"
                      : "bg-slate-800 text-slate-100"
                  }`}
                >
                  {m.parts
                    .map((p) => (p.type === "text" ? p.text : ""))
                    .join("")}
                </div>
              </div>
            ))}
            {status === "submitted" ? (
              <div className="text-xs text-slate-500">ThermoBot is thinking…</div>
            ) : null}
          </div>

          <form onSubmit={submit} className="border-t border-slate-800 p-3">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(e);
                  }
                }}
                rows={1}
                placeholder="Ask about brew temps, timing, or ideas…"
                className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}