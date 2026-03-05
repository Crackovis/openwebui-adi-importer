import path from "node:path";
import { JOB_SOURCES, type JobSource } from "../domain/job-types";

const sourceSet = new Set<JobSource>(JOB_SOURCES);

const converterScriptNames: Record<JobSource, string> = {
  chatgpt: "convert_chatgpt.py",
  claude: "convert_claude.py",
  grok: "convert_grok.py",
  aistudio: "convert_aistudio.py",
};

const sourceExtensions: Record<JobSource, string[]> = {
  chatgpt: [".json"],
  claude: [".json"],
  grok: [".json"],
  aistudio: [".json", ""],
};

export const isJobSource = (value: string): value is JobSource => {
  return sourceSet.has(value as JobSource);
};

export const getSourceExtensions = (source: JobSource): string[] => {
  return sourceExtensions[source];
};

export const getConverterScriptPath = (importerRoot: string, source: JobSource): string => {
  return path.resolve(importerRoot, converterScriptNames[source]);
};

export const getCreateSqlScriptPath = (importerRoot: string): string => {
  return path.resolve(importerRoot, "create_sql.py");
};

export const getBatchScriptPath = (importerRoot: string): string => {
  return path.resolve(importerRoot, "scripts", "run_batch.py");
};
