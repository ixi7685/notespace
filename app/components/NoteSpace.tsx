"use client";

import { useEffect, useMemo, useState } from "react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { getAppwrite } from "../lib/appwrite";
import { useNoteSpace } from "../lib/useNoteSpace";
import NoteCard, { type NoteViewMode } from "./NoteCard";
import Recorder from "./Recorder";
import GoalPanel from "./GoalPanel";
import ConfirmDialog from "./ConfirmDialog";
import InstallApp from "./InstallApp";

export default function NoteSpace() {
  const [username, setUsername] = useState("");
  const [viewMode, setViewMode] = useState<NoteViewMode>("grid");
  const [recorder, setRecorder] = useState<{ noteId: string; kind: "audio" | "video" } | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("🗂️");
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [notice, setNotice] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionToDelete, setSectionToDelete] = useState<{ id: string; name: string } | null>(null);

  const {
    loading,
    sections,
    activeSectionId,
    activeNotes,
    notes,
    setActiveSectionId,
    addSection,
    renameSection,
    deleteSection,
    addNote,
    updateNote,
    reorderNotes,
    deleteNote,
    addMedia,
    deleteMedia,
    goals,
    addGoal,
    updateGoal,
    addGoalMedia,
    deleteGoalMedia,
    updateGoalStatus,
    deleteGoal,
  } = useNoteSpace();

  useEffect(() => {
    getAppwrite()
      .account.get()
      .then((account) => setUsername(account.name || account.email))
      .catch(() => setUsername(""));
  }, []);

  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeSectionId),
    [sections, activeSectionId]
  );

  async function submitSection(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    if (editingSectionId) {
      await renameSection(editingSectionId, newName.trim(), newIcon);
    } else {
      await addSection(newName, newIcon, newParentId);
    }
    setNewName("");
    setNewIcon("🗂️");
    setNewParentId(null);
    setShowIconPicker(false);
    setAdding(false);
    setEditingSectionId(null);
    setNotice("");
  }

  function requestNote() {
    if (activeSectionId) {
      void addNote();
      return;
    }
    setAdding(true);
    setNotice("Prvo napravi sekciju, pa ćeš moći da dodaš belešku.");
  }

  function editSection(section: { id: string; name: string; icon: string; parentId: string | null }) {
    setEditingSectionId(section.id);
    setNewName(section.name);
    setNewIcon(section.icon);
    setNewParentId(section.parentId);
    setAdding(true);
    setShowIconPicker(false);
    setNotice("");
  }

  function renderSections(parentId: string | null = null, depth = 0) {
    return sections
      .filter((section) => section.parentId === parentId)
      .map((section) => (
        <div key={section.id}>
          <div
            className={`group flex items-center gap-1 rounded-xl px-1 ${
              activeSectionId === section.id ? "bg-white/10" : "hover:bg-white/5"
            }`}
            style={{ marginLeft: depth * 14 }}
          >
            <button
              onClick={() => {
                setActiveSectionId(section.id);
                setShowGoals(false);
                setNotice("");
              }}
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                activeSectionId === section.id ? "text-white" : "text-[#a9adcf]"
              }`}
            >
              <span className="text-base">{section.icon}</span>
              <span className="truncate">{section.name}</span>
            </button>
            <button
              onClick={() => editSection(section)}
              className="rounded px-2 text-[#8b90b8] opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-hover:opacity-100"
              title="Uredi sekciju"
              aria-label={`Uredi sekciju ${section.name}`}
            >
              ✎
            </button>
            <button
              onClick={() => {
                setNewParentId(section.id);
                setAdding(true);
              }}
              className="ml-1 rounded px-2 text-[#ffb454] opacity-0 hover:bg-white/10 group-hover:opacity-100"
              title="Dodaj podsekciju"
            >
              +
            </button>
            <button
              onClick={() => setSectionToDelete({ id: section.id, name: section.name })}
              className="rounded px-2 text-[#767a9c] opacity-0 transition-opacity hover:text-[#ff9d9d] group-hover:opacity-100"
              title="Obriši sekciju"
            >
              ×
            </button>
          </div>
          {renderSections(section.id, depth + 1)}
        </div>
      ));
  }

  if (loading) {
    return (
      <div className="aurora-canvas flex flex-1 items-center justify-center text-sm text-[#a9adcf]">
        Otvaranje prostora…
      </div>
    );
  }

  return (
    <div className="aurora-canvas flex h-[100dvh] min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
      <aside className="glass-panel relative z-10 flex min-h-0 shrink-0 flex-col border-x-0 border-t-0 p-4 text-[#e2e3f7] md:w-72 md:border-y-0 md:border-r md:p-6 lg:w-80">
        <div className="border-b border-white/10 pb-4 md:mb-8 md:pb-6">
          <div className="flex items-center gap-3">
            <img src="/note-space-icon.svg" alt="" className="h-10 w-10 rounded-xl" />
            <h1 className="font-serif text-xl font-semibold tracking-tight text-white md:text-2xl">Space Note</h1>
          </div>
        </div>

        <div className="mb-2 mt-5 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[#767a9c] md:mt-0">
          <span>Sekcije</span>
          <span>{sections.length} sekcija</span>
        </div>
        <nav className="mt-3 flex flex-1 gap-1 overflow-x-auto pb-1 md:mt-0 md:flex-col md:gap-1.5 md:overflow-y-auto md:overflow-x-hidden">
          {renderSections()}
        </nav>
        {notice && !showGoals && <p className="mt-3 rounded-xl border border-[#ffb454]/25 bg-[#ffb454]/10 px-3 py-2 text-xs leading-5 text-[#ffd9a8]" role="status" aria-live="polite">{notice}</p>}
        <button type="button" onClick={() => { setShowGoals((visible) => { const next = !visible; if (next) setActiveSectionId(null); return next; }); setAdding(false); setNotice(""); }} className={`mt-3 flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${showGoals ? "border-[#ffb454]/35 bg-[#ffb454]/10 text-[#ffd9a8]" : "border-white/10 text-[#c3c6e8] hover:bg-white/5"}`}>
          <span>🎯 Ciljevi</span><span className="text-xs text-[#8b90b8]">{goals.length}</span>
        </button>

        {adding && !showGoals ? (
          <form onSubmit={submitSection} className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffb454]">{editingSectionId ? "Uredi sekciju" : "Nova sekcija"}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowIconPicker((visible) => !visible)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#ffb454]/30 bg-[#ffb454]/10 text-lg hover:bg-[#ffb454]/20"
                aria-label="Otvori izbor ikonica"
                title="Izaberi ikonicu"
              >
                {newIcon}
              </button>
              <input
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Naziv sekcije"
                className="flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white outline-none placeholder:text-[#6e7396] focus:ring-2 focus:ring-[#ffb454]/40"
              />
            </div>
            <select
              value={newParentId ?? ""}
              onChange={(event) => setNewParentId(event.target.value || null)}
              className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#ffb454]/40"
            >
              <option value="">Glavna sekcija</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  ↳ {section.name}
                </option>
              ))}
            </select>
            {showIconPicker && (
              <div className="overflow-hidden rounded-lg border border-white/10">
                <EmojiPicker
                  theme={Theme.DARK}
                  width="100%"
                  height={330}
                  lazyLoadEmojis
                  searchPlaceholder="Pretraži ikonice"
                  onEmojiClick={(emojiData) => {
                    setNewIcon(emojiData.emoji);
                    setShowIconPicker(false);
                  }}
                />
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary flex-1 text-sm">
                {editingSectionId ? "Sačuvaj" : "Dodaj"}
              </button>
              <button type="button" onClick={() => { setAdding(false); setEditingSectionId(null); }} className="btn text-sm">
                Otkaži
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-4 rounded-xl border border-dashed border-white/20 bg-black/15 py-2.5 text-sm text-[#c3c6e8] hover:border-[#ffb454]/60 hover:text-[#ffd9a8]"
          >
            + Nova sekcija
          </button>
        )}

        <div className="mt-3 hidden border-t border-white/10 pt-4 md:block">
          <p className="truncate text-xs font-medium text-[#ffd9a8]" title={username}>
            {username}
          </p>
          <button
            onClick={() => getAppwrite().account.deleteSession({ sessionId: "current" }).then(() => window.location.reload())}
            className="mt-1 text-xs text-[#a9adcf] hover:text-white"
          >
            Odjavi se
          </button>
        </div>
      </aside>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        {showGoals ? <GoalPanel goals={goals} notes={notes} onAdd={addGoal} onUpdate={updateGoal} onStatusChange={updateGoalStatus} onDelete={deleteGoal} onAddMedia={addGoalMedia} onDeleteMedia={deleteGoalMedia} /> : <>
        <header className="glass-panel flex flex-wrap items-center justify-between gap-4 border-x-0 border-t-0 px-4 py-4 text-[#e2e3f7] md:px-9 md:py-5">
          <div>
            <h2 className="mt-1 flex items-center gap-2 font-serif text-xl font-semibold text-white md:text-3xl">
              <span>{activeSection?.icon}</span>
              {activeSection?.name ?? "—"}
            </h2>
            <p className="mt-1 hidden text-xs text-[#8b90b8] md:block">Piši, skupljaj ideje i gradi svoj lični sistem.</p>
          </div>
          <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
            <InstallApp />
            <div className="hidden rounded-xl border border-white/10 bg-black/20 p-1 sm:flex" aria-label="Izaberi prikaz beleški">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Kartice"
                aria-label="Prikaz kartica"
                className={`grid h-8 w-8 place-items-center rounded-lg text-sm ${viewMode === "grid" ? "bg-[#ffb454]/20 text-white" : "text-[#8b90b8] hover:text-white"}`}
              >
                ▦
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                title="Lista"
                aria-label="Prikaz liste"
                className={`grid h-8 w-8 place-items-center rounded-lg text-sm ${viewMode === "list" ? "bg-[#ffb454]/20 text-white" : "text-[#8b90b8] hover:text-white"}`}
              >
                ☷
              </button>
              <button
                type="button"
                onClick={() => setViewMode("icons")}
                title="Ikone"
                aria-label="Prikaz ikona"
                className={`grid h-8 w-8 place-items-center rounded-lg text-sm ${viewMode === "icons" ? "bg-[#ffb454]/20 text-white" : "text-[#8b90b8] hover:text-white"}`}
              >
                ▪
              </button>
            </div>
            <button
              onClick={requestNote}
              className="btn btn-primary text-sm"
            >
              + Nova beleška
            </button>
          </div>
        </header>

        <div className="notes-scrollbar min-h-0 flex-1 overflow-y-scroll overscroll-contain p-4 md:p-8 lg:p-10">
          {activeNotes.length === 0 ? (
            <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center text-[#a9adcf]">
              <p className="grid h-20 w-20 place-items-center rounded-3xl border border-[#ffb454]/30 bg-[#ffb454]/10 text-4xl shadow-[0_0_42px_rgba(255,180,84,0.16)]">
                {activeSection?.icon ?? "✦"}
              </p>
              <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ffb454]">
                NOVA IDEJA
              </p>
              <h3 className="mt-3 font-serif text-2xl font-semibold text-white">Spreman za novu ideju?</h3>
              <p className="mt-2 text-sm leading-6 text-[#a9adcf]">
                Napravi belešku, dodaj sliku ili uvezi tekst. Tvoj prostor čeka.
              </p>
              <button onClick={requestNote} className="btn btn-primary mt-6 min-h-11 px-5 text-sm">
                + Napravi belešku
              </button>
            </div>
          ) : (
            <div
              className={`mx-auto max-w-6xl gap-4 md:gap-5 ${
                viewMode === "grid"
                  ? "grid lg:grid-cols-2"
                  : viewMode === "list"
                    ? "flex flex-col"
                    : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
              }`}
            >
              {activeNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  noteId={note.id}
                                    goalId={note.goalId}
                                    goals={goals}
                  title={note.title}
                  text={note.text}
                  media={note.media}
                  updatedAt={note.updatedAt}
                  viewMode={viewMode}
                  onReorder={reorderNotes}
                  onChange={(patch) => updateNote(note.id, patch)}
                                    onGoalChange={(goalId) => updateNote(note.id, { goalId })}
                  onDelete={() => deleteNote(note.id)}
                  onDeleteMedia={(mediaId) => deleteMedia(note.id, mediaId)}
                  onAddFiles={(files) => {
                    void Promise.all(files.map((file) => addMedia(note.id, file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "image", file)));
                  }}
                  onRecordAudio={() => setRecorder({ noteId: note.id, kind: "audio" })}
                  onRecordVideo={() => setRecorder({ noteId: note.id, kind: "video" })}
                />
              ))}
            </div>
          )}
        </div>
        </>}
      </main>

      {recorder && (
        <Recorder kind={recorder.kind} onSave={(blob) => addMedia(recorder.noteId, recorder.kind, blob)} onClose={() => setRecorder(null)} />
      )}
      {sectionToDelete && (
        <ConfirmDialog
          title={`Obrisati sekciju „${sectionToDelete.name}“?`}
          description="Biće obrisane i sve podsekcije i beleške unutar nje. Ova radnja ne može da se vrati."
          confirmLabel="Obriši sekciju"
          onCancel={() => setSectionToDelete(null)}
          onConfirm={() => { void deleteSection(sectionToDelete.id); setSectionToDelete(null); }}
        />
      )}
    </div>
  );
}
