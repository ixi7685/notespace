"use client";

import { useEffect, useRef, useState } from "react";
import { RichTextEditor } from "./NoteCard";
import ConfirmDialog from "./ConfirmDialog";
import type { Goal, GoalPriority, GoalStatus, MediaKind, Note } from "../lib/types";

const columns: { status: GoalStatus; label: string; tone: string }[] = [
  { status: "planned", label: "Planirano", tone: "text-[#c3c6e8]" },
  { status: "in_progress", label: "U progresu", tone: "text-[#ffd9a8]" },
  { status: "completed", label: "Završeno", tone: "text-[#b8edc8]" },
];

function deadlineText(dueDate: string | null, now: Date): string | null {
  if (!dueDate) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const deadline = new Date(`${dueDate}T00:00:00`);
  const target = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate()).getTime();
  const days = Math.round((target - today) / 86_400_000);
  if (days < 0) return `Kasni ${Math.abs(days)} ${Math.abs(days) === 1 ? "dan" : "dana"}`;
  if (days === 0) return "Rok je danas";
  if (days === 1) return "Još 1 dan";
  return `Još ${days} dana`;
}

export default function GoalPanel({ goals, notes, onAdd, onUpdate, onStatusChange, onDelete, onAddMedia, onDeleteMedia }: {
  goals: Goal[];
  notes: Note[];
  onAdd: (title: string, description: string, dueDate: string | null, priority: GoalPriority) => Promise<void>;
  onUpdate: (id: string, patch: Partial<Pick<Goal, "title" | "content" | "description" | "dueDate" | "priority">>) => Promise<void>;
  onStatusChange: (id: string, status: GoalStatus) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddMedia: (id: string, kind: MediaKind, blob: Blob) => Promise<void>;
  onDeleteMedia: (id: string, mediaId: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<GoalPriority>("medium");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);
  const goalFileRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);


  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    await onAdd(title, description, dueDate || null, priority);
    setTitle("");
    setDescription("");
    setDueDate("");
    setPriority("medium");
    setEditingId(null);
  }

  function openCreate() {
    setTitle("");
    setDescription("");
    setDueDate("");
    setPriority("medium");
    setEditingId("new");
  }

  function openDatePicker(event: React.MouseEvent<HTMLInputElement>) {
    event.currentTarget.showPicker?.();
  }

  function linkedNotes(goalId: string) {
    return notes.filter((note) => note.goalId === goalId);
  }

  return (
    <section className="notes-scrollbar min-h-0 flex-1 overflow-y-auto p-4 md:p-8 lg:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-end justify-between gap-4 border-b border-white/10 pb-5">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ffb454]">Tvoj plan</p><h2 className="mt-1 font-serif text-2xl font-semibold text-white">Ciljevi</h2><p className="mt-2 text-sm text-[#a9adcf]">Svaki cilj može imati tekst, linkove, slike i svoj rok.</p></div>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#c3c6e8]">{goals.length} ukupno</span>
        </div>
        <button type="button" onClick={openCreate} className="btn btn-primary mb-6">+ Novi cilj</button>
        <div className="grid gap-3 md:grid-cols-3">
          {columns.map((column) => {
            const items = goals.filter((goal) => goal.status === column.status);
            return <div key={column.status} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedId) void onStatusChange(draggedId, column.status); setDraggedId(null); }} className={`min-h-44 rounded-2xl border p-3 transition-colors ${draggedId ? "border-[#ffb454]/25 bg-[#ffb454]/[0.04]" : "border-white/10 bg-black/10"}`}>
              <div className="mb-3 flex items-center justify-between"><h3 className={`text-xs font-semibold uppercase tracking-[0.14em] ${column.tone}`}>{column.label}</h3><span className="text-xs text-[#6e7396]">{items.length}</span></div>
              <div className="space-y-2">
                {items.map((goal) => <article key={goal.id} draggable onDragStart={() => setDraggedId(goal.id)} onDragEnd={() => setDraggedId(null)} className="cursor-grab rounded-xl border border-white/10 bg-[#191a31] p-3 active:cursor-grabbing">
                  <div className="flex items-start justify-between gap-2"><h4 className={`min-w-0 text-sm font-semibold ${goal.status === "completed" ? "text-[#b8edc8] line-through" : "text-white"}`}>{goal.title}</h4><button type="button" onClick={() => setGoalToDelete(goal)} className="text-[#767a9c] hover:text-[#ffb9b9]" aria-label="Obriši cilj">×</button></div>
                  {goal.description && <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#a9adcf]">{goal.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[#8b90b8]">{goal.dueDate && <span>Rok: {new Date(`${goal.dueDate}T00:00:00`).toLocaleDateString("sr-RS")}</span>}<span className={goal.dueDate && deadlineText(goal.dueDate, now)?.startsWith("Kasni") ? "text-[#ff9d9d]" : "text-[#ffd9a8]"}>{deadlineText(goal.dueDate, now)}</span><span>Prioritet: {goal.priority === "high" ? "Važno" : goal.priority === "low" ? "Lako" : "Srednje"}</span></div>
                  {linkedNotes(goal.id).length > 0 && <div className="mt-3 rounded-lg border border-white/5 bg-black/15 p-2"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b90b8]">Povezane beleške</p><ul className="mt-1 space-y-1">{linkedNotes(goal.id).map((note) => <li key={note.id} className="truncate text-xs text-[#dfe1fb]" title={note.title || "Beleška bez naslova"}>• {note.title.trim() || "Beleška bez naslova"}</li>)}</ul></div>}
                  <button type="button" onClick={() => setEditingId(goal.id)} className="mt-3 text-xs text-[#ffd9a8] hover:text-white">Otvori cilj</button>
                  <select value={goal.status} onChange={(event) => void onStatusChange(goal.id, event.target.value as GoalStatus)} className="mt-3 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-xs text-[#dfe1fb] outline-none" aria-label="Status cilja"><option value="planned">Planirano</option><option value="in_progress">U progresu</option><option value="completed">Završeno</option></select>
                </article>)}
                {items.length === 0 && <p className="py-7 text-center text-xs leading-5 text-[#6e7396]">Nema ciljeva<br />u ovoj fazi</p>}
              </div>
            </div>;
          })}
        </div>
      </div>
      {editingId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="goal-modal-title">
        <div className="notes-scrollbar max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#17172d] p-4 shadow-2xl md:p-6">
          {editingId === "new" ? <form onSubmit={submit}>
            <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ffb454]">Novi cilj</p><h2 id="goal-modal-title" className="mt-1 font-serif text-2xl font-semibold text-white">Šta želiš da postigneš?</h2></div><button type="button" onClick={() => setEditingId(null)} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-xl text-[#a9adcf] hover:bg-white/5 hover:text-white" aria-label="Zatvori novi cilj">×</button></div>
            <label className="block text-xs text-[#8b90b8]">Naziv cilja<input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus placeholder="Npr. Naučiti španski…" className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-base text-white outline-none placeholder:text-[#6e7396] focus:border-[#ffb454]/45" /></label>
            <label className="mt-4 block text-xs text-[#8b90b8]">Kratak opis<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Objasni šta želiš da postigneš…" rows={3} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white outline-none placeholder:text-[#6e7396] focus:border-[#ffb454]/45" /></label>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-[#8b90b8]">Rok<input type="date" value={dueDate} onClick={openDatePicker} onChange={(event) => setDueDate(event.target.value)} className="mt-2 w-full cursor-pointer rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-[#dfe1fb]" /></label><label className="text-xs text-[#8b90b8]">Prioritet<select value={priority} onChange={(event) => setPriority(event.target.value as GoalPriority)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-[#dfe1fb]"><option value="low">Lako</option><option value="medium">Srednje</option><option value="high">Važno</option></select></label></div>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setEditingId(null)} className="btn">Otkaži</button><button type="submit" className="btn btn-primary">Sačuvaj cilj</button></div>
          </form> : (() => { const goal = goals.find((item) => item.id === editingId); if (!goal) return null; return <div>
            <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ffb454]">Detalji cilja</p><h2 id="goal-modal-title" className="mt-1 font-serif text-2xl font-semibold text-white">{goal.title}</h2></div><button type="button" onClick={() => setEditingId(null)} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-xl text-[#a9adcf] hover:bg-white/5 hover:text-white" aria-label="Zatvori cilj">×</button></div>
            <input value={goal.title} onChange={(event) => void onUpdate(goal.id, { title: event.target.value })} className="mb-4 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-base font-semibold text-white outline-none focus:border-[#ffb454]/45" aria-label="Naslov cilja" />
            <RichTextEditor value={goal.content} onChange={(content) => void onUpdate(goal.id, { content })} expanded />
            <textarea defaultValue={goal.description} onBlur={(event) => void onUpdate(goal.id, { description: event.target.value })} rows={3} className="mt-4 w-full resize-y rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white outline-none focus:border-[#ffb454]/45" aria-label="Kratak opis cilja" placeholder="Kratak opis cilja…" />
            {linkedNotes(goal.id).length > 0 && <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-[#ffd9a8]">Beleške povezane sa ovim ciljem</p><span className="text-[11px] text-[#8b90b8]">{linkedNotes(goal.id).length}</span></div><div className="mt-2 space-y-1.5">{linkedNotes(goal.id).map((note) => <div key={note.id} className="flex items-center gap-2 rounded-lg bg-white/[0.035] px-2.5 py-2 text-sm text-[#e2e3f7]"><span className="text-[#ffb454]">•</span><span className="truncate">{note.title.trim() || "Beleška bez naslova"}</span></div>)}</div></div>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-[#8b90b8]">Rok<input type="date" value={goal.dueDate ?? ""} onClick={openDatePicker} onChange={(event) => void onUpdate(goal.id, { dueDate: event.target.value || null })} className="mt-2 w-full cursor-pointer rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-[#dfe1fb]" />{goal.dueDate && <span className={`mt-1.5 block text-xs ${deadlineText(goal.dueDate, now)?.startsWith("Kasni") ? "text-[#ff9d9d]" : "text-[#ffd9a8]"}`}>{deadlineText(goal.dueDate, now)}</span>}</label><label className="text-xs text-[#8b90b8]">Prioritet<select value={goal.priority} onChange={(event) => void onUpdate(goal.id, { priority: event.target.value as GoalPriority })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-[#dfe1fb]"><option value="low">Lako</option><option value="medium">Srednje</option><option value="high">Važno</option></select></label></div>
            <input ref={goalFileRef} type="file" accept="image/*,audio/*,video/*" multiple className="hidden" onChange={(event) => { Array.from(event.target.files ?? []).forEach((file) => { const kind: MediaKind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "audio"; void onAddMedia(goal.id, kind, file); }); event.target.value = ""; }} />
            <button type="button" onClick={() => goalFileRef.current?.click()} className="btn mt-4 text-xs">+ Dodaj sliku ili snimak</button>
            {goal.media.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{goal.media.map((media) => <div key={media.id} className="relative overflow-hidden rounded-lg border border-white/10 bg-black/25 p-2">{media.kind === "image" ? <img src={media.url} alt="Prilog uz cilj" width={480} height={320} className="h-32 w-full object-cover" /> : media.kind === "video" ? <video src={media.url} controls className="w-full" /> : <audio src={media.url} controls className="w-full" />}<button type="button" onClick={() => void onDeleteMedia(goal.id, media.id)} className="mt-1 text-xs text-[#ffb9b9] hover:text-white">Obriši prilog</button></div>)}</div>}
          </div>; })()}
        </div>
      </div>}
      {goalToDelete && (
        <ConfirmDialog
          title={`Obrisati cilj „${goalToDelete.title}“?`}
          description="Cilj i njegovi prilozi biće obrisani. Povezane beleške ostaju, ali više neće biti vezane za ovaj cilj."
          confirmLabel="Obriši cilj"
          onCancel={() => setGoalToDelete(null)}
          onConfirm={() => { void onDelete(goalToDelete.id); setGoalToDelete(null); if (editingId === goalToDelete.id) setEditingId(null); }}
        />
      )}
    </section>
  );
}