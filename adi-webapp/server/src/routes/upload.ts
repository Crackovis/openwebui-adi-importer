import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream";
import util from "node:util";
import type { FastifyInstance } from "fastify";
import { success, failure } from "../lib/api-response";

const pump = util.promisify(pipeline);

type UploadRouteDeps = {
  uploadsDir: string;
  getRuntimeSettings: () => {
    maxInputFiles: number;
    maxInputTotalBytes: number;
  };
};

const cleanupStoredFiles = (storedFiles: Array<{ path: string }>): void => {
  for (const storedFile of storedFiles) {
    try {
      fs.rmSync(storedFile.path, { force: true });
    } catch {
      continue;
    }
  }
};

const isMultipartLimitError = (error: unknown): boolean => {
  const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined;
  return code === "FST_REQ_FILE_TOO_LARGE" || code === "FST_FILES_LIMIT" || code === "FST_PARTS_LIMIT";
};

export const registerUploadRoute = (app: FastifyInstance, deps: UploadRouteDeps): void => {
  app.post("/api/upload", async (request, reply) => {
    try {
      const limits = deps.getRuntimeSettings();
      const data = await request.file();
      
      if (!data) {
        reply.code(400);
        return failure("UPLOAD_NO_FILE", "No file provided.");
      }

      const filename = `${Date.now()}-${data.filename}`;
      const filepath = path.join(deps.uploadsDir, filename);
      
      await pump(data.file, fs.createWriteStream(filepath));
      const size = fs.statSync(filepath).size;
      if (size > limits.maxInputTotalBytes) {
        fs.rmSync(filepath, { force: true });
        reply.code(413);
        return failure(
          "UPLOAD_FILE_TOO_LARGE",
          `Uploaded file exceeds configured limit of ${limits.maxInputTotalBytes} bytes.`,
        );
      }
      
      return success({
        originalName: data.filename,
        storedName: filename,
        path: filepath,
        size,
      });
    } catch (error) {
      if (isMultipartLimitError(error)) {
        reply.code(413);
        return failure("UPLOAD_LIMIT_REACHED", error instanceof Error ? error.message : "Upload exceeds configured limits.");
      }
      reply.code(500);
      return failure("UPLOAD_ERROR", error instanceof Error ? error.message : "Upload failed.");
    }
  });

  // Upload multiple files
  app.post("/api/upload/batch", async (request, reply) => {
    const files: Array<{
      originalName: string;
      storedName: string;
      path: string;
      size: number;
    }> = [];

    try {
      const limits = deps.getRuntimeSettings();
      const parts = request.files();
      let totalBytes = 0;
      
      for await (const part of parts) {
        if (files.length >= limits.maxInputFiles) {
          part.file.resume();
          cleanupStoredFiles(files);
          reply.code(413);
          return failure("UPLOAD_TOO_MANY_FILES", `Upload exceeds configured limit of ${limits.maxInputFiles} files.`);
        }

        const filename = `${Date.now()}-${part.filename}`;
        const filepath = path.join(deps.uploadsDir, filename);
        
        await pump(part.file, fs.createWriteStream(filepath));
        const size = fs.statSync(filepath).size;

        if (size > limits.maxInputTotalBytes) {
          fs.rmSync(filepath, { force: true });
          cleanupStoredFiles(files);
          reply.code(413);
          return failure(
            "UPLOAD_FILE_TOO_LARGE",
            `Uploaded file exceeds configured limit of ${limits.maxInputTotalBytes} bytes.`,
          );
        }

        totalBytes += size;
        if (totalBytes > limits.maxInputTotalBytes) {
          fs.rmSync(filepath, { force: true });
          cleanupStoredFiles(files);
          reply.code(413);
          return failure(
            "UPLOAD_TOTAL_TOO_LARGE",
            `Total uploaded size exceeds configured limit of ${limits.maxInputTotalBytes} bytes.`,
          );
        }
        
        files.push({
          originalName: part.filename,
          storedName: filename,
          path: filepath,
          size,
        });
      }

      if (files.length === 0) {
        reply.code(400);
        return failure("UPLOAD_NO_FILES", "No files provided.");
      }

      return success({
        count: files.length,
        files,
      });
    } catch (error) {
      cleanupStoredFiles(files);
      if (isMultipartLimitError(error)) {
        reply.code(413);
        return failure("UPLOAD_LIMIT_REACHED", error instanceof Error ? error.message : "Upload exceeds configured limits.");
      }
      reply.code(500);
      return failure("UPLOAD_ERROR", error instanceof Error ? error.message : "Batch upload failed.");
    }
  });
};
