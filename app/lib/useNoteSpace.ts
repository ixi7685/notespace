"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { goalsRepo, notesRepo, sectionsRepo } from "./db";
import type { Goal, GoalPriority, GoalStatus, MediaKind, Note, Section } from "./types";

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useNoteSpace() {
  const [sections, setSections] = useState<Section[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const loadedSections = await sectionsRepo.all();
      const loadedNotes = await notesRepo.all();
      const loadedGoals = await goalsRepo.all();
      if (cancelled) return;

      loadedSections.sort((a, b) => a.order - b.order);
      setSections(loadedSections);
      setNotes(loadedNotes);
      setGoals(loadedGoals);
      setActiveSectionId(loadedSections[0]?.id ?? null);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeNotes = useMemo(
    () =>
      notes
        .filter((note) => note.sectionId === activeSectionId)
        .sort((a, b) => a.position - b.position || b.updatedAt - a.updatedAt),
    [notes, activeSectionId]
  );

  const addSection = useCallback(async (name: string, icon: string, parentId: string | null = null) => {
    const section: Section = {
      id: uid(),
      parentId,
      name: name.trim() || "Nova sekcija",
      icon: icon.trim() || "🗂️",
      order: Date.now(),
    };
    await sectionsRepo.put(section);
    setSections((prev) => [...prev, section]);
    setActiveSectionId(section.id);
  }, []);

  const renameSection = useCallback(
    async (id: string, name: string, icon: string) => {
      setSections((prev) => {
        const next = prev.map((section) =>
          section.id === id ? { ...section, name, icon } : section
        );
        const updated = next.find((section) => section.id === id);
        if (updated) void sectionsRepo.put(updated);
        return next;
      });
    },
    []
  );

  const deleteSection = useCallback(
    async (id: string) => {
      const descendantIds = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const section of sections) {
          if (section.parentId && descendantIds.has(section.parentId) && !descendantIds.has(section.id)) {
            descendantIds.add(section.id);
            changed = true;
          }
        }
      }
      const doomed = notes.filter((note) => descendantIds.has(note.sectionId));
      await Promise.all(doomed.map((note) => notesRepo.remove(note.id)));
      await sectionsRepo.remove(id);

      setNotes((prev) => prev.filter((note) => !descendantIds.has(note.sectionId)));
      setSections((prev) => {
        const next = prev.filter((section) => !descendantIds.has(section.id));
        setActiveSectionId((current) =>
          current === id ? next[0]?.id ?? null : current
        );
        return next;
      });
    },
    [notes, sections]
  );

  const clearSections = useCallback(async () => {
    await Promise.all(notes.map((note) => notesRepo.remove(note.id)));
    await Promise.all(sections.map((section) => sectionsRepo.remove(section.id)));
    setNotes([]);
    setSections([]);
    setActiveSectionId(null);
  }, [notes, sections]);

  const addNote = useCallback(
    async (text = "", title = "") => {
      if (!activeSectionId) return;
      const now = Date.now();
      const note: Note = {
        id: uid(),
        sectionId: activeSectionId,
        goalId: null,
        title,
        text,
        position: notes.filter((note) => note.sectionId === activeSectionId).length,
        media: [],
        createdAt: now,
        updatedAt: now,
      };
      await notesRepo.put(note);
      setNotes((prev) => [note, ...prev]);
    },
    [activeSectionId, notes]
  );

  const updateNote = useCallback(
    async (id: string, patch: Partial<Pick<Note, "title" | "text" | "goalId">>) => {
      setNotes((prev) => {
        const next = prev.map((note) =>
          note.id === id
            ? { ...note, ...patch, updatedAt: Date.now() }
            : note
        );
        const updated = next.find((note) => note.id === id);
        if (updated) void notesRepo.put(updated);
        return next;
      });
    },
    []
  );

  const reorderNotes = useCallback(async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setNotes((previous) => {
      const current = previous.filter((note) => note.sectionId === activeSectionId)
        .sort((a, b) => a.position - b.position);
      const fromIndex = current.findIndex((note) => note.id === fromId);
      const toIndex = current.findIndex((note) => note.id === toId);
      if (fromIndex < 0 || toIndex < 0) return previous;
      const [moved] = current.splice(fromIndex, 1);
      current.splice(toIndex, 0, moved);
      const positions = new Map(current.map((note, index) => [note.id, index]));
      const next = previous.map((note) => positions.has(note.id) ? { ...note, position: positions.get(note.id)! } : note);
      void Promise.all(current.map((note, index) => notesRepo.put({ ...note, position: index })));
      return next;
    });
  }, [activeSectionId]);

  const deleteNote = useCallback(async (id: string) => {
    await notesRepo.remove(id);
    setNotes((prev) => prev.filter((note) => note.id !== id));
  }, []);

  const clearNotesInSection = useCallback(async () => {
    if (!activeSectionId) return;
    const notesToDelete = notes.filter(
      (note) => note.sectionId === activeSectionId
    );
    await Promise.all(notesToDelete.map((note) => notesRepo.remove(note.id)));
    setNotes((previous) =>
      previous.filter((note) => note.sectionId !== activeSectionId)
    );
  }, [activeSectionId, notes]);

  const addMedia = useCallback(
    async (noteId: string, kind: MediaKind, blob: Blob) => {
      const media = await notesRepo.addMedia(noteId, kind, blob);
      setNotes((prev) => {
        const next = prev.map((note) =>
          note.id === noteId
            ? { ...note, media: [...note.media, media], updatedAt: Date.now() }
            : note
        );
        const updated = next.find((note) => note.id === noteId);
        if (updated) void notesRepo.put(updated);
        return next;
      });
    },
    []
  );

  const deleteMedia = useCallback(async (noteId: string, mediaId: string) => {
    setNotes((prev) => {
      const next = prev.map((note) =>
        note.id === noteId
          ? {
              ...note,
              media: note.media.filter((item) => item.id !== mediaId),
              updatedAt: Date.now(),
            }
          : note
      );
      const current = prev.find((note) => note.id === noteId);
      const removed = current?.media.find((item) => item.id === mediaId);
      if (removed) void notesRepo.removeMedia(mediaId, removed.storagePath);
      const updated = next.find((note) => note.id === noteId);
      if (updated) void notesRepo.put(updated);
      return next;
    });
  }, []);

  const addGoal = useCallback(async (title: string, description: string, dueDate: string | null, priority: GoalPriority) => {
    const now = Date.now();
    const goal: Goal = { id: uid(), title: title.trim(), content: "", description: description.trim(), dueDate, priority, status: "planned", media: [], createdAt: now, updatedAt: now };
    await goalsRepo.put(goal);
    setGoals((previous) => [goal, ...previous]);
  }, []);

  const updateGoal = useCallback(async (id: string, patch: Partial<Pick<Goal, "title" | "content" | "description" | "dueDate" | "priority">>) => {
    setGoals((previous) => {
      const next = previous.map((goal) => goal.id === id ? { ...goal, ...patch, updatedAt: Date.now() } : goal);
      const updated = next.find((goal) => goal.id === id);
      if (updated) void goalsRepo.put(updated);
      return next;
    });
  }, []);

  const addGoalMedia = useCallback(async (goalId: string, kind: MediaKind, blob: Blob) => {
    const media = await goalsRepo.addMedia(goalId, kind, blob);
    setGoals((previous) => previous.map((goal) => goal.id === goalId ? { ...goal, media: [...goal.media, media], updatedAt: Date.now() } : goal));
  }, []);

  const deleteGoalMedia = useCallback(async (goalId: string, mediaId: string) => {
    const goal = goals.find((item) => item.id === goalId);
    const media = goal?.media.find((item) => item.id === mediaId);
    if (!media) return;
    await goalsRepo.removeMedia(mediaId, media.storagePath);
    setGoals((previous) => previous.map((item) => item.id === goalId ? { ...item, media: item.media.filter((entry) => entry.id !== mediaId) } : item));
  }, [goals]);

  const updateGoalStatus = useCallback(async (id: string, status: GoalStatus) => {
    setGoals((previous) => {
      const next = previous.map((goal) => goal.id === id ? { ...goal, status, updatedAt: Date.now() } : goal);
      const updated = next.find((goal) => goal.id === id);
      if (updated) void goalsRepo.put(updated);
      return next;
    });
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    await goalsRepo.remove(id);
    const linkedNotes = notes.filter((note) => note.goalId === id).map((note) => ({ ...note, goalId: null, updatedAt: Date.now() }));
    await Promise.all(linkedNotes.map((note) => notesRepo.put(note)));
    setNotes((previous) => previous.map((note) => note.goalId === id ? { ...note, goalId: null } : note));
    setGoals((previous) => previous.filter((goal) => goal.id !== id));
  }, [notes]);

  return {
    loading,
    sections,
    activeSectionId,
    activeNotes,
    notes,
    setActiveSectionId,
    addSection,
    renameSection,
    deleteSection,
    clearSections,
    addNote,
    updateNote,
    reorderNotes,
    deleteNote,
    clearNotesInSection,
    addMedia,
    deleteMedia,
    goals,
    addGoal,
    updateGoal,
    addGoalMedia,
    deleteGoalMedia,
    updateGoalStatus,
    deleteGoal,
  };
}
