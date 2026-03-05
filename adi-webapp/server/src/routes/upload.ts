import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream";
import util from "node:util";
import type { FastifyInstance } from "fastify";
import { success, failure } from "../lib/api-response";

const pump = util.promisify(pipeline);

type UploadRouteDeps = {
  uploadsDir: string;
};

export const registerUploadRoute = (app: FastifyInstance, deps: UploadRouteDeps): void => {
  app.post("/api/upload", async (request, reply) => {
    try {
      const data = await request.file();
      
      if (!data) {
        reply.code(400);
        return failure("UPLOAD_NO_FILE", "No file provided.");
      }

      const filename = `${Date.now()}-${data.filename}`;
      const filepath = path.join(deps.uploadsDir, filename);
      
      await pump(data.file, fs.createWriteStream(filepath));
      
      return success({
        originalName: data.filename,
        storedName: filename,
        path: filepath,
        size: fs.statSync(filepath).size,
      });
    } catch (error) {
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
      const parts = request.files();
      
      for await (const part of parts) {
        const filename = `${Date.now()}-${part.filename}`;
        const filepath = path.join(deps.uploadsDir, filename);
        
        await pump(part.file, fs.createWriteStream(filepath));
        
        files.push({
          originalName: part.filename,
          storedName: filename,
          path: filepath,
          size: fs.statSync(filepath).size,
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
      reply.code(500);
      return failure("UPLOAD_ERROR", error instanceof Error ? error.message : "Batch upload failed.");
    }
  });
};
