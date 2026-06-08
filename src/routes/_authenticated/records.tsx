import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast, Toaster } from "sonner";
import { createRecord, deleteRecord, listRecords } from "@/lib/records.functions";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/records")({
  head: () => ({ meta: [{ title: "Brew Records — ThermoTracker" }] }),
  component: RecordsPage,
});

function RecordsPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listRecords);
  const fetchCreate = useServerFn(createRecord);
  const fetchDelete = useServerFn(deleteRecord);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["records"],
    queryFn: () => fetchList(),
  });

  const createMut = useMutation({
    mutationFn: (input: Parameters<typeof createRecord>[0]["data"]) =>
      fetchCreate({ data: input }),
    onSuccess: () => {
      toast.success("Record saved");
      qc.invalidateQueries({ queryKey: ["records"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => fetchDelete({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["records"] }),
  });

  const [contents, setContents] = useState("Green tea");
  const [initialTemp, setInitialTemp] = useState("80");
  const [roomTemp, setRoomTemp] = useState("22");
  const [volume, setVolume] = useState("300");
  const [efficiency, setEfficiency] = useState("70");
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    createMut.mutate({
      contents,
      initial_temp: Number(initialTemp),
      room_temp: Number(roomTemp),
      volume_ml: Number(volume),
      efficiency: Number(efficiency),
      notes: notes || null,
    });
    setNotes("");
  }

  return (
    <AppShell title="Brew records">
      <Toaster theme="dark" richColors />
      <div className="grid gap-6 lg:grid-cols-5">
        <form
          onSubmit={submit}
          className="lg:col-span-2 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            New entry
          </h2>
          <Input label="What's in the thermos" value={contents} onChange={setContents} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Initial °C" value={initialTemp} onChange={setInitialTemp} type="number" />
            <Input label="Room °C" value={roomTemp} onChange={setRoomTemp} type="number" />
            <Input label="Volume ml" value={volume} onChange={setVolume} type="number" />
            <Input label="Efficiency %" value={efficiency} onChange={setEfficiency} type="number" />
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-300">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
              placeholder="How did it taste? Any reminders?"
            />
          </label>
          <button
            type="submit"
            disabled={createMut.isPending}
            className="w-full rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50"
          >
            {createMut.isPending ? "Saving..." : "Save record"}
          </button>
          <p className="text-xs text-slate-500">
            Or run a fresh simulation on the{" "}
            <Link to="/" className="text-teal-400 hover:underline">simulator</Link>.
          </p>
        </form>

        <section className="lg:col-span-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            History ({records.length})
          </h2>
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-slate-500">No records yet. Add your first brew on the left.</p>
          ) : (
            <ul className="space-y-3">
              {records.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-100">{r.contents}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {new Date(r.brewed_at).toLocaleString()} ·{" "}
                        {r.initial_temp != null ? `${r.initial_temp}°C` : "—"} ·{" "}
                        {r.volume_ml != null ? `${r.volume_ml}ml` : ""} ·{" "}
                        {r.efficiency != null ? `${r.efficiency}% eff` : ""}
                      </div>
                      {r.notes ? (
                        <p className="mt-2 text-sm text-slate-300">{r.notes}</p>
                      ) : null}
                    </div>
                    <button
                      onClick={() => deleteMut.mutate(r.id)}
                      className="text-xs text-slate-500 hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
      />
    </label>
  );
}