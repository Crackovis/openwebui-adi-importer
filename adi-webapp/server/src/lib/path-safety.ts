import fs from "node:fs";
import path from "node:path";

export class PathSafetyError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = "PathSafetyError";
    this.code = code;
  }
}

export const resolveSafePath = (basePath: string, unsafePath: string): string => {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(resolvedBase, unsafePath);
  const relative = path.relative(resolvedBase, resolvedTarget);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new PathSafetyError("PATH_TRAVERSAL", `Path traversal is not allowed: ${unsafePath}`);
  }

  return resolvedTarget;
};

export const ensureReadableFile = (targetPath: string): void => {
  try {
    const stats = fs.statSync(targetPath);
    if (!stats.isFile()) {
      throw new PathSafetyError("INPUT_UNREADABLE", `Path is not a file: ${targetPath}`);
    }
    fs.accessSync(targetPath, fs.constants.R_OK);
  } catch (error) {
    if (error instanceof PathSafetyError) {
      throw error;
    }
    throw new PathSafetyError("INPUT_UNREADABLE", `Unable to read file: ${targetPath}`);
  }
};

export const ensureReadableDirectory = (targetPath: string): void => {
  try {
    const stats = fs.statSync(targetPath);
    if (!stats.isDirectory()) {
      throw new PathSafetyError("FOLDER_UNREADABLE", `Path is not a directory: ${targetPath}`);
    }
    fs.accessSync(targetPath, fs.constants.R_OK);
  } catch (error) {
    if (error instanceof PathSafetyError) {
      throw error;
    }
    throw new PathSafetyError("FOLDER_UNREADABLE", `Unable to read directory: ${targetPath}`);
  }
};

export const ensureWritableDirectory = (targetPath: string): void => {
  try {
    fs.mkdirSync(targetPath, { recursive: true });
    fs.accessSync(targetPath, fs.constants.W_OK);
  } catch {
    throw new PathSafetyError("OUTPUT_NOT_WRITABLE", `Unable to write directory: ${targetPath}`);
  }
};

export const collectDirectoryFiles = (dirPath: string, maxFiles: number): string[] => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(dirPath, entry.name))
    .sort();

  return files.slice(0, maxFiles);
};

export const translateHostPathToContainer = (
  inputPath: string,
  mappings: Array<{ host: string; container: string }>,
): string => {
  const normalizedInput = path.normalize(inputPath);

  for (const mapping of mappings) {
    const hostPath = path.normalize(mapping.host);
    const containerPath = path.normalize(mapping.container);

    if (normalizedInput === hostPath) {
      return containerPath;
    }

    const relative = path.relative(hostPath, normalizedInput);
    if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
      return path.join(containerPath, relative);
    }
  }

  return normalizedInput;
};
