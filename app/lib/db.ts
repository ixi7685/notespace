import { appwriteConfig, getAppwrite, ID, Permission, Query, Role } from "./appwrite";
import type { Goal, GoalPriority, GoalStatus, Media, MediaKind, Note, Section } from "./types";

async function currentUser() {
  try {
    return await getAppwrite().account.get();
  } catch {
    throw new Error("Prijavi se da sačuvaš svoj Space Note.");
  }
}

function permissions(userId: string) {
  return [Permission.read(Role.user(userId)), Permission.write(Role.user(userId))];
}

function personalFilters() {
  return [Query.equal("is_family", false), Query.equal("is_creative", false)];
}

function sectionFromDocument(document: Record<string, unknown>): Section {
  return {
    id: String(document.$id),
    parentId: (document.parent_id as string | null) ?? null,
    name: String(document.name ?? "Nova sekcija"),
    icon: String(document.icon ?? "🗂️"),
    order: Number(document.position ?? 0),
  };
}

async function mediaFromDocument(document: Record<string, unknown>): Promise<Media | null> {
  const { storage } = getAppwrite();
  const fileId = String(document.storage_path);
  try {
    await storage.getFile({ bucketId: appwriteConfig.bucketId, fileId });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === 404) return null;
    throw error;
  }
  const fileUrl = storage.getFileView({ bucketId: appwriteConfig.bucketId, fileId });
  return {
    id: String(document.$id),
    kind: document.kind as MediaKind,
    mimeType: String(document.mime_type ?? "application/octet-stream"),
    storagePath: String(document.storage_path),
    url: fileUrl.toString(),
    createdAt: new Date(String(document.created_at ?? Date.now())).getTime(),
  };
}

export const sectionsRepo = {
  async all(): Promise<Section[]> {
    const { databases } = getAppwrite();
    const result = await databases.listDocuments({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.sectionsCollectionId,
      queries: personalFilters(),
    });
    return result.documents.map((document) => sectionFromDocument(document as unknown as Record<string, unknown>));
  },
  async put(section: Section) {
    const user = await currentUser();
    const { databases } = getAppwrite();
    await databases.upsertDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.sectionsCollectionId,
      documentId: section.id,
      data: { user_id: user.$id, parent_id: section.parentId, name: section.name, icon: section.icon, position: section.order, is_family: false, is_creative: false },
      permissions: permissions(user.$id),
    });
  },
  async remove(id: string) {
    await getAppwrite().databases.deleteDocument({ databaseId: appwriteConfig.databaseId, collectionId: appwriteConfig.sectionsCollectionId, documentId: id });
  },
};

export const goalsRepo = {
  async all(): Promise<Goal[]> {
    const user = await currentUser();
    const { databases } = getAppwrite();
    const result = await databases.listDocuments({ databaseId: appwriteConfig.databaseId, collectionId: appwriteConfig.goalsCollectionId, queries: [Query.equal("user_id", user.$id), Query.orderDesc("updated_at")] });
    const mediaResult = await databases.listDocuments({ databaseId: appwriteConfig.databaseId, collectionId: appwriteConfig.goalMediaCollectionId, queries: [Query.equal("user_id", user.$id)] });
    return Promise.all(result.documents.map(async (document) => ({
      id: document.$id,
      title: String(document.title ?? ""),
      content: String(document.content ?? ""),
      description: String(document.description ?? ""),
      dueDate: document.due_date ? String(document.due_date) : null,
      priority: (document.priority as GoalPriority) || "medium",
      status: document.status as GoalStatus,
      createdAt: new Date(String(document.created_at ?? document.$createdAt)).getTime(),
      updatedAt: new Date(String(document.updated_at ?? document.$updatedAt)).getTime(),
      media: (await Promise.all(mediaResult.documents.filter((media) => media.goal_id === document.$id).map((media) => mediaFromDocument(media as unknown as Record<string, unknown>)))).filter((item): item is Media => item !== null),
    })));
  },
  async put(goal: Goal) {
    const user = await currentUser();
    await getAppwrite().databases.upsertDocument({ databaseId: appwriteConfig.databaseId, collectionId: appwriteConfig.goalsCollectionId, documentId: goal.id, data: { user_id: user.$id, title: goal.title, content: goal.content, description: goal.description, due_date: goal.dueDate, priority: goal.priority, status: goal.status, created_at: new Date(goal.createdAt).toISOString(), updated_at: new Date(goal.updatedAt).toISOString() }, permissions: permissions(user.$id) });
  },
  async remove(id: string) {
    const media = await getAppwrite().databases.listDocuments({ databaseId: appwriteConfig.databaseId, collectionId: appwriteConfig.goalMediaCollectionId, queries: [Query.equal("goal_id", id)] });
    await Promise.all(media.documents.map((item) => goalsRepo.removeMedia(item.$id, String(item.storage_path))));
    await getAppwrite().databases.deleteDocument({ databaseId: appwriteConfig.databaseId, collectionId: appwriteConfig.goalsCollectionId, documentId: id });
  },
  async addMedia(goalId: string, kind: MediaKind, blob: Blob): Promise<Media> {
    const user = await currentUser();
    const fileId = ID.unique();
    const extension = blob.type.startsWith("image/") ? blob.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg" : blob.type.includes("mp4") ? "mp4" : "webm";
    const file = new File([blob], `${fileId}.${extension}`, { type: blob.type });
    await getAppwrite().storage.createFile({ bucketId: appwriteConfig.bucketId, fileId, file, permissions: permissions(user.$id) });
    const document = await getAppwrite().databases.createDocument({ databaseId: appwriteConfig.databaseId, collectionId: appwriteConfig.goalMediaCollectionId, documentId: ID.unique(), data: { user_id: user.$id, goal_id: goalId, kind, mime_type: blob.type, storage_path: fileId, created_at: new Date().toISOString() }, permissions: permissions(user.$id) });
    const uploaded = await mediaFromDocument(document as unknown as Record<string, unknown>);
    if (!uploaded) throw new Error("Uploadovani prilog cilja nije pronađen.");
    return uploaded;
  },
  async removeMedia(id: string, storagePath: string) {
    try { await getAppwrite().storage.deleteFile({ bucketId: appwriteConfig.bucketId, fileId: storagePath }); } catch (error) { if (!(typeof error === "object" && error && "code" in error && error.code === 404)) throw error; }
    await getAppwrite().databases.deleteDocument({ databaseId: appwriteConfig.databaseId, collectionId: appwriteConfig.goalMediaCollectionId, documentId: id });
  },
};

export const notesRepo = {
  async all(): Promise<Note[]> {
    const { databases } = getAppwrite();
    const result = await databases.listDocuments({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.notesCollectionId,
      queries: personalFilters(),
    });
    const mediaResult = await databases.listDocuments({ databaseId: appwriteConfig.databaseId, collectionId: appwriteConfig.mediaCollectionId, queries: personalFilters() });
    return Promise.all(result.documents.map(async (document) => {
      const row = document as unknown as Record<string, unknown>;
      const mediaRows = mediaResult.documents.filter((media) => media.note_id === document.$id) as unknown as Record<string, unknown>[];
      return {
        id: document.$id,
        sectionId: String(row.section_id),
        goalId: row.goal_id ? String(row.goal_id) : null,
        title: String(row.title ?? ""),
        text: String(row.text ?? ""),
        position: Number(row.position ?? 0),
        media: (await Promise.all(mediaRows.map(mediaFromDocument))).filter((item): item is Media => item !== null),
        createdAt: new Date(String(row.created_at ?? document.$createdAt)).getTime(),
        updatedAt: new Date(String(row.updated_at ?? document.$updatedAt)).getTime(),
      } satisfies Note;
    }));
  },
  async put(note: Note) {
    const user = await currentUser();
    await getAppwrite().databases.upsertDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.notesCollectionId,
      documentId: note.id,
      data: { user_id: user.$id, section_id: note.sectionId, goal_id: note.goalId, title: note.title, text: note.text, position: note.position, is_family: false, is_creative: false, created_at: new Date(note.createdAt).toISOString(), updated_at: new Date(note.updatedAt).toISOString() },
      permissions: permissions(user.$id),
    });
  },
  async remove(id: string) {
    const media = await getAppwrite().databases.listDocuments({ databaseId: appwriteConfig.databaseId, collectionId: appwriteConfig.mediaCollectionId, queries: [Query.equal("note_id", id)] });
    await Promise.all(media.documents.map((item) => notesRepo.removeMedia(item.$id, String(item.storage_path))));
    await getAppwrite().databases.deleteDocument({ databaseId: appwriteConfig.databaseId, collectionId: appwriteConfig.notesCollectionId, documentId: id });
  },
  async addMedia(noteId: string, kind: MediaKind, blob: Blob): Promise<Media> {
    const user = await currentUser();
    const fileId = ID.unique();
    const extension = blob.type.startsWith("image/") ? blob.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg" : blob.type.includes("mp4") ? "mp4" : "webm";
    const file = new File([blob], `${fileId}.${extension}`, { type: blob.type });
    await getAppwrite().storage.createFile({ bucketId: appwriteConfig.bucketId, fileId, file, permissions: permissions(user.$id) });
    const document = await getAppwrite().databases.createDocument({ databaseId: appwriteConfig.databaseId, collectionId: appwriteConfig.mediaCollectionId, documentId: ID.unique(), data: { user_id: user.$id, note_id: noteId, kind, mime_type: blob.type, storage_path: fileId, is_family: false, is_creative: false, created_at: new Date().toISOString() }, permissions: permissions(user.$id) });
    const uploaded = await mediaFromDocument(document as unknown as Record<string, unknown>);
    if (!uploaded) throw new Error("Uploadovani fajl nije pronađen u Appwrite Storage-u.");
    return uploaded;
  },
  async removeMedia(id: string, storagePath: string) {
    try {
      await getAppwrite().storage.deleteFile({ bucketId: appwriteConfig.bucketId, fileId: storagePath });
    } catch (error) {
      if (!(typeof error === "object" && error && "code" in error && error.code === 404)) throw error;
    }
    await getAppwrite().databases.deleteDocument({ databaseId: appwriteConfig.databaseId, collectionId: appwriteConfig.mediaCollectionId, documentId: id });
  },
};
