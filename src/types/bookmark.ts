export type PipelineStatus = "saved" | "fetched" | "extracted" | "ai_enriched" | "indexed";

export type PipelineError = {
  stage: PipelineStatus;
  message: string;
  failedAt: string;
};

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  summary: string;
  content: string;
  domain: string;
  favicon: string;
  tags: string[];
  category: string;
  status: PipelineStatus;
  error?: PipelineError;
  savedAt: string;
  updatedAt: string;
}

export interface Category {
  name: string;
  count: number;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface DomainCount {
  domain: string;
  count: number;
}

export const PIPELINE_STAGES: PipelineStatus[] = ["saved", "fetched", "extracted", "ai_enriched", "indexed"];

export const PIPELINE_LABELS: Record<PipelineStatus, string> = {
  saved: "Saved",
  fetched: "Fetched",
  extracted: "Extracted",
  ai_enriched: "AI Enriched",
  indexed: "Indexed",
};
