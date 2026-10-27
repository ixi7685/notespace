export type MediaKind = "audio" | "video" | "image";
export type GoalStatus = "planned" | "in_progress" | "completed";
export type GoalPriority = "low" | "medium" | "high";

export interface Goal {
  id: string;
  title: string;
  content: string;
  description: string;
  dueDate: string | null;
  priority: GoalPriority;
  status: GoalStatus;
  media: Media[];
  createdAt: number;
  updatedAt: number;
}

export interface Media {
  id: string;
  kind: MediaKind;
  mimeType: string;
  storagePath: string;
  url: string;
  createdAt: number;
}

export interface Note {
  id: string;
  sectionId: string;
  goalId: string | null;
  title: string;
  text: string;
  position: number;
  media: Media[];
  createdAt: number;
  updatedAt: number;
}

export interface Section {
  id: string;
  parentId: string | null;
  name: string;
  icon: string;
  order: number;
}
