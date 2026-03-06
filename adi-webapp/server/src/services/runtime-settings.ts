import type { EnvConfig } from "../config/env";
import type { SettingsRepository } from "../db/repositories/settings-repository";

export type RuntimeSettings = {
  pythonBin: string;
  importerRoot: string;
  maxInputFiles: number;
  maxInputTotalBytes: number;
  subprocessTimeoutMs: number;
};

const toNonEmptyString = (value: unknown, fallback: string): string => {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
};

const toPositiveInteger = (value: unknown, fallback: number): number => {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
};

export const defaultsFromEnv = (env: EnvConfig): RuntimeSettings => {
  return {
    pythonBin: env.pythonBin,
    importerRoot: env.importerRoot,
    maxInputFiles: env.maxInputFiles,
    maxInputTotalBytes: env.maxInputTotalBytes,
    subprocessTimeoutMs: env.subprocessTimeoutMs,
  };
};

export const mergeRuntimeSettings = (
  defaults: RuntimeSettings,
  persisted: Record<string, unknown> | null,
): RuntimeSettings => {
  if (!persisted) {
    return defaults;
  }

  return {
    pythonBin: toNonEmptyString(persisted.pythonBin, defaults.pythonBin),
    importerRoot: toNonEmptyString(persisted.importerRoot, defaults.importerRoot),
    maxInputFiles: toPositiveInteger(persisted.maxInputFiles, defaults.maxInputFiles),
    maxInputTotalBytes: toPositiveInteger(persisted.maxInputTotalBytes, defaults.maxInputTotalBytes),
    subprocessTimeoutMs: toPositiveInteger(persisted.subprocessTimeoutMs, defaults.subprocessTimeoutMs),
  };
};

export const createRuntimeSettingsResolver = (
  env: EnvConfig,
  settingsRepository: SettingsRepository,
): (() => RuntimeSettings) => {
  const defaults = defaultsFromEnv(env);
  return () => mergeRuntimeSettings(defaults, settingsRepository.getOne("app"));
};
