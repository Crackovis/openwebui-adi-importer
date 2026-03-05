import fs from "node:fs";
import path from "node:path";

export type DbBackupService = {
  createBackup: (dbPath: string, jobId: string) => string;
};

export const createDbBackupService = (backupsDir: string): DbBackupService => {
  const createBackup = (dbPath: string, jobId: string): string => {
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Target database not found: ${dbPath}`);
    }

    fs.mkdirSync(backupsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.resolve(backupsDir, `${jobId}-${timestamp}-webui.db.backup`);
    fs.copyFileSync(dbPath, backupPath);
    return backupPath;
  };

  return {
    createBackup,
  };
};
