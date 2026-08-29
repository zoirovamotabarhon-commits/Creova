import type { AIFeature } from "./ai";

export interface Project {
  id: string;
  userId: string;
  title: string;
  feature: AIFeature;
  generationIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  title: string;
  feature: AIFeature;
}

export interface ProjectResponse {
  success: boolean;
  data?: Project;
  error?: string;
}

export interface ProjectListResponse {
  success: boolean;
  data?: Project[];
  error?: string;
}
