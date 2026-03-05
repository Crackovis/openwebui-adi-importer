import type { JobSource } from "../domain/job-types";

type SmartTagOptions = {
  source: JobSource;
  jobId: string;
  customTags?: string[];
  includeDateTag?: boolean;
  includeBatchTag?: boolean;
  now?: Date;
};

const normalizeTag = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "");
};

const getDateTag = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `imported-${year}-${month}`;
};

const getBatchTag = (jobId: string): string => {
  return `batch-${jobId.slice(0, 8).toLowerCase()}`;
};

export const buildSmartTags = (options: SmartTagOptions): string[] => {
  const now = options.now ?? new Date();
  const result = new Set<string>();

  result.add(`imported-${options.source}`);

  if (options.includeDateTag !== false) {
    result.add(getDateTag(now));
  }

  if (options.includeBatchTag !== false) {
    result.add(getBatchTag(options.jobId));
  }

  for (const rawTag of options.customTags ?? []) {
    const normalized = normalizeTag(rawTag);
    if (normalized) {
      result.add(normalized);
    }
  }

  return Array.from(result).sort();
};
