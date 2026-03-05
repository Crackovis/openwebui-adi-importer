import fs from "node:fs";
import path from "node:path";

type PreviewMessage = {
  title: string;
  snippet: string;
};

export type PreviewData = {
  conversationCount: number;
  sampleTitles: string[];
  sampleMessages: PreviewMessage[];
  effectiveTags: string[];
  generatedAt: string;
};

export type PreviewArtifact = {
  previewPath: string;
  data: PreviewData;
};

type BuildPreviewInput = {
  convertedFiles: string[];
  effectiveTags: string[];
  previewDir: string;
  jobId: string;
};

const truncateSnippet = (text: string, max = 180): string => {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : `${compact.slice(0, max)}...`;
};

const getSnippet = (parsed: Record<string, unknown>): string => {
  const messages = parsed.messages;
  if (Array.isArray(messages)) {
    for (const entry of messages) {
      if (entry && typeof entry === "object") {
        const content = (entry as Record<string, unknown>).content;
        if (typeof content === "string" && content.trim()) {
          return truncateSnippet(content);
        }
      }
    }
  }
  return "No message snippet available.";
};

const parseConversation = (filePath: string): { title: string; snippet: string } | null => {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : "Untitled";
    return {
      title,
      snippet: getSnippet(parsed),
    };
  } catch {
    return null;
  }
};

export const createPreviewArtifact = (input: BuildPreviewInput): PreviewArtifact => {
  const conversations = input.convertedFiles
    .map((filePath) => parseConversation(filePath))
    .filter((value): value is { title: string; snippet: string } => value !== null);

  const data: PreviewData = {
    conversationCount: conversations.length,
    sampleTitles: conversations.slice(0, 10).map((entry) => entry.title),
    sampleMessages: conversations.slice(0, 10).map((entry) => ({
      title: entry.title,
      snippet: entry.snippet,
    })),
    effectiveTags: input.effectiveTags,
    generatedAt: new Date().toISOString(),
  };

  fs.mkdirSync(input.previewDir, { recursive: true });
  const previewPath = path.resolve(input.previewDir, `${input.jobId}.preview.json`);
  fs.writeFileSync(previewPath, JSON.stringify(data, null, 2), "utf8");

  return {
    previewPath,
    data,
  };
};
