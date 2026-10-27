import dotenv from "dotenv";
import { Client, Databases, Storage, Permission, Role } from "node-appwrite";

dotenv.config({ path: ".env.local" });

const required = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "space-note",
  sectionsCollectionId: process.env.NEXT_PUBLIC_APPWRITE_SECTIONS_COLLECTION_ID || "sections",
  notesCollectionId: process.env.NEXT_PUBLIC_APPWRITE_NOTES_COLLECTION_ID || "notes",
  goalsCollectionId: process.env.NEXT_PUBLIC_APPWRITE_GOALS_COLLECTION_ID || "goals",
  goalMediaCollectionId: process.env.NEXT_PUBLIC_APPWRITE_GOAL_MEDIA_COLLECTION_ID || "goal-media",
  mediaCollectionId: process.env.NEXT_PUBLIC_APPWRITE_MEDIA_COLLECTION_ID || "media",
  bucketId: process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID || "note-media",
  apiKey: process.env.APPWRITE_API_KEY,
};

for (const [name, value] of Object.entries(required)) {
  if (!value) throw new Error(`Missing environment variable for ${name}`);
}

const client = new Client()
  .setEndpoint(required.endpoint)
  .setProject(required.projectId)
  .setKey(required.apiKey);
const databases = new Databases(client);
const storage = new Storage(client);

const userPermissions = [Permission.read(Role.users()), Permission.write(Role.users())];

async function ensure(get, create, label) {
  try {
    await get();
    console.log(`exists: ${label}`);
  } catch (error) {
    if (error?.code !== 404) throw error;
    await create();
    console.log(`created: ${label}`);
  }
}

async function ensureAttribute(collectionId, attributeId, create) {
  try {
    await databases.getAttribute({ databaseId: required.databaseId, collectionId, key: attributeId });
    console.log(`exists: ${collectionId}.${attributeId}`);
  } catch (error) {
    if (error?.code !== 404) throw error;
    await create();
    console.log(`created: ${collectionId}.${attributeId}`);
  }
}

async function ensureBooleanAttribute(collectionId, attributeId) {
  try {
    const attribute = await databases.getAttribute({ databaseId: required.databaseId, collectionId, key: attributeId });
    if (attribute.type !== "boolean") {
      await databases.deleteAttribute({ databaseId: required.databaseId, collectionId, key: attributeId });
      await new Promise((resolve) => setTimeout(resolve, 500));
      await databases.createBooleanAttribute({ databaseId: required.databaseId, collectionId, key: attributeId, required: true });
      console.log(`recreated: ${collectionId}.${attributeId} as boolean`);
    } else {
      console.log(`exists: ${collectionId}.${attributeId}`);
    }
  } catch (error) {
    if (error?.code !== 404) throw error;
    await databases.createBooleanAttribute({ databaseId: required.databaseId, collectionId, key: attributeId, required: true });
    console.log(`created: ${collectionId}.${attributeId}`);
  }
}

async function ensureIntegerAttribute(collectionId, attributeId) {
  try {
    const attribute = await databases.getAttribute({ databaseId: required.databaseId, collectionId, key: attributeId });
    if (attribute.type !== "integer") {
      await databases.deleteAttribute({ databaseId: required.databaseId, collectionId, key: attributeId });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await databases.createIntegerAttribute({ databaseId: required.databaseId, collectionId, key: attributeId, required: true });
      console.log(`recreated: ${collectionId}.${attributeId} as integer`);
    } else {
      console.log(`exists: ${collectionId}.${attributeId}`);
    }
  } catch (error) {
    if (error?.code !== 404) throw error;
    await databases.createIntegerAttribute({ databaseId: required.databaseId, collectionId, key: attributeId, required: true });
    console.log(`created: ${collectionId}.${attributeId}`);
  }
}

async function ensureIndex(collectionId, indexId, attributes, type = "key") {
  try {
    await databases.getIndex({ databaseId: required.databaseId, collectionId, key: indexId });
    console.log(`exists: index ${collectionId}.${indexId}`);
  } catch (error) {
    if (error?.code !== 404) throw error;
    let lastError;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      try {
        await databases.createIndex({ databaseId: required.databaseId, collectionId, key: indexId, type, attributes });
        console.log(`created: index ${collectionId}.${indexId}`);
        return;
      } catch (retryError) {
        lastError = retryError;
        if (!String(retryError?.message).toLowerCase().includes("not yet available")) throw retryError;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    throw lastError;
  }
}

async function waitForAttributes(collectionId, keys) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await databases.listAttributes({ databaseId: required.databaseId, collectionId });
    const ready = result.attributes.filter((attribute) => keys.includes(attribute.key)).every((attribute) => attribute.status === "available");
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Attributes not ready for ${collectionId}`);
}

await ensure(
  () => databases.get({ databaseId: required.databaseId }),
  () => databases.create({ databaseId: required.databaseId, name: "Space Note" }),
  `database ${required.databaseId}`
);

for (const [collectionId, name] of [
  [required.sectionsCollectionId, "Sections"],
  [required.notesCollectionId, "Notes"],
  [required.goalsCollectionId, "Goals"],
  [required.goalMediaCollectionId, "Goal Media"],
  [required.mediaCollectionId, "Media"],
]) {
  await ensure(
    () => databases.getCollection({ databaseId: required.databaseId, collectionId }),
    () => databases.createCollection({ databaseId: required.databaseId, collectionId, name, permissions: userPermissions, documentSecurity: true }),
    `collection ${collectionId}`
  );
}


const goals = required.goalsCollectionId;
for (const [id, size, requiredAttr] of [["user_id", 64, true], ["title", 512, true], ["content", 100000, false], ["description", 5000, false], ["due_date", 32, false], ["priority", 32, false], ["status", 32, true], ["created_at", 64, true], ["updated_at", 64, true]]) {
  await ensureAttribute(goals, id, () => databases.createStringAttribute({ databaseId: required.databaseId, collectionId: goals, key: id, size, required: requiredAttr }));
}
await waitForAttributes(goals, ["user_id", "status", "updated_at"]);
await ensureIndex(goals, "goals_user_updated", ["user_id", "updated_at"]);
const goalMedia = required.goalMediaCollectionId;
for (const [id, size] of [["user_id", 64], ["goal_id", 64], ["kind", 32], ["mime_type", 128], ["storage_path", 256], ["created_at", 64]]) {
  await ensureAttribute(goalMedia, id, () => databases.createStringAttribute({ databaseId: required.databaseId, collectionId: goalMedia, key: id, size, required: true }));
}
await waitForAttributes(goalMedia, ["user_id", "goal_id", "storage_path"]);
await ensureIndex(goalMedia, "goal_media_goal", ["goal_id"]);
const sections = required.sectionsCollectionId;
for (const [id, requiredAttr] of [["user_id", true], ["parent_id", false], ["name", true], ["icon", true], ["position", true], ["is_family", true], ["is_creative", true]]) {
  if (id === "position") {
    await ensureIntegerAttribute(sections, id);
    continue;
  }
  if (id === "is_family" || id === "is_creative") {
    await ensureBooleanAttribute(sections, id);
    continue;
  }
  await ensureAttribute(sections, id, () => id === "position"
    ? databases.createIntegerAttribute({ databaseId: required.databaseId, collectionId: sections, key: id, required: requiredAttr })
    : id === "is_family" || id === "is_creative"
      ? databases.createBooleanAttribute({ databaseId: required.databaseId, collectionId: sections, key: id, required: requiredAttr })
      : databases.createStringAttribute({ databaseId: required.databaseId, collectionId: sections, key: id, size: id === "name" ? 256 : 64, required: requiredAttr }));
}
await waitForAttributes(sections, ["is_family", "is_creative", "position"]);
await ensureIndex(sections, "sections_scope_position", ["is_family", "is_creative", "position"]);

const notes = required.notesCollectionId;
for (const [id, requiredAttr, size] of [["user_id", true, 64], ["section_id", true, 64], ["goal_id", false, 64], ["title", true, 512], ["text", true, 100000], ["position", true, 0], ["is_family", true, 0], ["is_creative", true, 0], ["created_at", true, 64], ["updated_at", true, 64]]) {
  await ensureAttribute(notes, id, () => id === "position" ? databases.createIntegerAttribute({ databaseId: required.databaseId, collectionId: notes, key: id, required: requiredAttr }) : id === "is_family" || id === "is_creative" ? databases.createBooleanAttribute({ databaseId: required.databaseId, collectionId: notes, key: id, required: requiredAttr }) : databases.createStringAttribute({ databaseId: required.databaseId, collectionId: notes, key: id, size, required: requiredAttr }));
}
await waitForAttributes(notes, ["is_family", "is_creative", "position"]);
await ensureIndex(notes, "notes_scope_position", ["is_family", "is_creative", "section_id", "position"]);

const media = required.mediaCollectionId;
for (const [id, requiredAttr, size] of [["user_id", true, 64], ["note_id", true, 64], ["kind", true, 32], ["mime_type", true, 128], ["storage_path", true, 256], ["is_family", true, 0], ["is_creative", true, 0], ["created_at", true, 64]]) {
  await ensureAttribute(media, id, () => id === "is_family" || id === "is_creative" ? databases.createBooleanAttribute({ databaseId: required.databaseId, collectionId: media, key: id, required: requiredAttr }) : databases.createStringAttribute({ databaseId: required.databaseId, collectionId: media, key: id, size, required: requiredAttr }));
}
await waitForAttributes(media, ["is_family", "is_creative"]);
await ensureIndex(media, "media_note_scope", ["note_id", "is_family", "is_creative"]);

await ensure(
  () => storage.getBucket({ bucketId: required.bucketId }),
  () => storage.createBucket({ bucketId: required.bucketId, name: "Space Note Media", permissions: userPermissions, fileSecurity: true, maximumFileSize: 50_000_000 }),
  `bucket ${required.bucketId}`
);

console.log("Appwrite Space Note setup complete.");
