import fs from "node:fs";
import path from "node:path";
import type { JobSource } from "../domain/job-types";
import type { PythonAdapter } from "./python-adapter";
import { buildSmartTags } from "./tagging-service";
import { createPreviewArtifact, type PreviewArtifact } from "./preview-service";

export type ConversionInput = {
  source: JobSource;
  userId: string;
  inputFiles: string[];
  customTags: string[];
  jobId: string;
  workDir: string;
  previewDir: string;
};

export type ConversionFileResult = {
  inputPath: string;
  ok: boolean;
  error?: string;
};

export type ConversionResult = {
  effectiveTags: string[];
  convertedFiles: string[];
  failedFiles: ConversionFileResult[];
  convertedCount: number;
  normalizedDir: string;
  rawOutputDir: string;
  preview: PreviewArtifact;
};

type ConversionOrchestratorDeps = {
  pythonAdapter: PythonAdapter;
};

const ensureDirectory = (directoryPath: string): void => {
  fs.mkdirSync(directoryPath, { recursive: true });
};

const listJsonFiles = (directoryPath: string): string[] => {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }
  const files = fs.readdirSync(directoryPath);
  return files
    .map((name) => path.resolve(directoryPath, name))
    .filter((fullPath) => fullPath.toLowerCase().endsWith(".json") && fs.statSync(fullPath).isFile())
    .sort();
};

const normalizeConvertedPayload = (payload: unknown, userId: string, effectiveTags: string[]): Record<string, unknown> => {
  if (Array.isArray(payload) && payload.length > 0) {
    const first = payload[0];
    if (first && typeof first === "object") {
      const wrapper = first as Record<string, unknown>;
      const maybeChat = wrapper.chat;
      if (maybeChat && typeof maybeChat === "object") {
        return {
          ...(maybeChat as Record<string, unknown>),
          userId,
          tags: effectiveTags,
        };
      }
    }
  }

  if (payload && typeof payload === "object") {
    return {
      ...(payload as Record<string, unknown>),
      userId,
      tags: effectiveTags,
    };
  }

  throw new Error("Converted payload is not a valid JSON object.");
};

const normalizeConvertedFile = (
  sourceFile: string,
  destinationFile: string,
  userId: string,
  effectiveTags: string[],
): void => {
  const raw = fs.readFileSync(sourceFile, "utf8");
  const parsed = JSON.parse(raw);
  const normalized = normalizeConvertedPayload(parsed, userId, effectiveTags);
  fs.writeFileSync(destinationFile, JSON.stringify(normalized, null, 2), "utf8");
};

export type ConversionOrchestrator = {
  run: (input: ConversionInput) => Promise<ConversionResult>;
};

export const createConversionOrchestrator = (
  deps: ConversionOrchestratorDeps,
): ConversionOrchestrator => {
  const run = async (input: ConversionInput): Promise<ConversionResult> => {
    const outputRoot = path.resolve(input.workDir, input.jobId, "converted");
    const rawOutputDir = path.resolve(outputRoot, input.source);
    const normalizedDir = path.resolve(input.workDir, input.jobId, "normalized");
    ensureDirectory(outputRoot);
    ensureDirectory(normalizedDir);

    const fileResults: ConversionFileResult[] = [];
    for (const inputPath of input.inputFiles) {
      try {
        await deps.pythonAdapter.runConverter({
          source: input.source,
          files: [inputPath],
          userId: input.userId,
          outputDir: outputRoot,
        });
        fileResults.push({
          inputPath,
          ok: true,
        });
      } catch (error) {
        fileResults.push({
          inputPath,
          ok: false,
          error: error instanceof Error ? error.message : "Conversion failed.",
        });
      }
    }

    const effectiveTags = buildSmartTags({
      source: input.source,
      jobId: input.jobId,
      customTags: input.customTags,
      includeBatchTag: true,
      includeDateTag: true,
    });

    const convertedRawFiles = listJsonFiles(rawOutputDir);
    const convertedFiles: string[] = [];
    for (const rawFile of convertedRawFiles) {
      const targetPath = path.resolve(normalizedDir, path.basename(rawFile));
      try {
        normalizeConvertedFile(rawFile, targetPath, input.userId, effectiveTags);
        convertedFiles.push(targetPath);
      } catch {
        fileResults.push({
          inputPath: rawFile,
          ok: false,
          error: "Failed to normalize converted file.",
        });
      }
    }

    const preview = createPreviewArtifact({
      convertedFiles,
      effectiveTags,
      previewDir: input.previewDir,
      jobId: input.jobId,
    });

    return {
      effectiveTags,
      convertedFiles,
      failedFiles: fileResults.filter((entry) => !entry.ok),
      convertedCount: convertedFiles.length,
      normalizedDir,
      rawOutputDir,
      preview,
    };
  };

  return {
    run,
  };
};
