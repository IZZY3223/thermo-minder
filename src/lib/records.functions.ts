import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RecordInput = z.object({
  contents: z.string().trim().min(1).max(100),
  initial_temp: z.number().min(0).max(150).nullable(),
  room_temp: z.number().min(-20).max(60).nullable(),
  volume_ml: z.number().min(0).max(5000).nullable(),
  efficiency: z.number().min(0).max(100).nullable(),
  notes: z.string().max(2000).optional().nullable(),
  brewed_at: z.string().optional(),
});

export const listRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("records")
      .select("*")
      .order("brewed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RecordInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("records")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("records").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });