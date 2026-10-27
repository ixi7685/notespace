import { Account, Client, Databases, ID, Permission, Query, Role, Storage } from "appwrite";

let client: Client | null = null;

export const appwriteConfig = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "",
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "",
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "",
  sectionsCollectionId: process.env.NEXT_PUBLIC_APPWRITE_SECTIONS_COLLECTION_ID ?? "",
  notesCollectionId: process.env.NEXT_PUBLIC_APPWRITE_NOTES_COLLECTION_ID ?? "",
  goalsCollectionId: process.env.NEXT_PUBLIC_APPWRITE_GOALS_COLLECTION_ID || "goals",
  goalMediaCollectionId: process.env.NEXT_PUBLIC_APPWRITE_GOAL_MEDIA_COLLECTION_ID || "goal-media",
  mediaCollectionId: process.env.NEXT_PUBLIC_APPWRITE_MEDIA_COLLECTION_ID ?? "",
  bucketId: process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID ?? "",
};

export function isAppwriteConfigured() {
  return Boolean(
    appwriteConfig.endpoint &&
      appwriteConfig.projectId &&
      appwriteConfig.databaseId &&
      appwriteConfig.sectionsCollectionId &&
      appwriteConfig.notesCollectionId &&
      appwriteConfig.goalsCollectionId &&
      appwriteConfig.goalMediaCollectionId &&
      appwriteConfig.mediaCollectionId &&
      appwriteConfig.bucketId
  );
}

export function getAppwrite() {
  if (!isAppwriteConfigured()) throw new Error("Appwrite is not configured.");
  if (!client) {
    client = new Client()
      .setEndpoint(appwriteConfig.endpoint)
      .setProject(appwriteConfig.projectId);
  }
  return {
    account: new Account(client),
    databases: new Databases(client),
    storage: new Storage(client),
  };
}

export { ID, Permission, Query, Role };
