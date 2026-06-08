import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as {
          messages?: UIMessage[];
          threadId?: string;
        };
        const messages = body.messages;
        const threadId = body.threadId;
        if (!Array.isArray(messages) || !threadId) {
          return new Response("Invalid request", { status: 400 });
        }

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { global: { headers: { Authorization: `Bearer ${token}` } } },
        );
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        // verify thread ownership
        const { data: thread } = await supabase
          .from("chat_threads")
          .select("id")
          .eq("id", threadId)
          .maybeSingle();
        if (!thread) return new Response("Thread not found", { status: 404 });

        // persist the latest user message if not already saved
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        if (lastUser) {
          const { data: existing } = await supabase
            .from("chat_messages")
            .select("id")
            .eq("thread_id", threadId)
            .eq("role", "user")
            .order("created_at", { ascending: false })
            .limit(1);
          const existingContent =
            existing && existing.length > 0
              ? await supabase
                  .from("chat_messages")
                  .select("content")
                  .eq("id", existing[0].id)
                  .single()
                  .then((r) => r.data?.content)
              : null;
          const sameId =
            existingContent &&
            typeof existingContent === "object" &&
            (existingContent as UIMessage).id === lastUser.id;
          if (!sameId) {
            await supabase.from("chat_messages").insert({
              thread_id: threadId,
              user_id: userId,
              role: "user",
              content: lastUser,
            });
            // auto-title from first user message
            const text = lastUser.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join(" ")
              .trim()
              .slice(0, 80);
            await supabase
              .from("chat_threads")
              .update({
                title: text || "New chat",
                updated_at: new Date().toISOString(),
              })
              .eq("id", threadId);
          }
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const gateway = createLovableAiGatewayProvider(key);

        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system:
            "You are ThermoBot, a warm family-friendly assistant who helps people brew and enjoy what's in their thermos. Give friendly, concise advice about ideal serving temperatures for tea (green, black, herbal, oolong, matcha), coffee, hot chocolate, soup, and infused water. Remind users when it's a good time to drink based on cooling. Use simple language and short paragraphs.",
          messages: convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage }) => {
            await supabase.from("chat_messages").insert({
              thread_id: threadId,
              user_id: userId,
              role: "assistant",
              content: responseMessage,
            });
            await supabase
              .from("chat_threads")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", threadId);
          },
        });
      },
    },
  },
});