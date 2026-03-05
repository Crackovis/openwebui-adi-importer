import fs from "node:fs";
import path from "node:path";
import type { PythonAdapter } from "./python-adapter";

export type SqlOrchestratorInput = {
  jobId: string;
  normalizedInputPath: string;
  sqlDir: string;
  tags: string[];
};

export type SqlOrchestratorOutput = {
  sqlPath: string;
  stdout: string;
  stderr: string;
};

export type SqlOrchestrator = {
  generate: (input: SqlOrchestratorInput) => Promise<SqlOrchestratorOutput>;
};

export const createSqlOrchestrator = (pythonAdapter: PythonAdapter): SqlOrchestrator => {
  const generate = async (input: SqlOrchestratorInput): Promise<SqlOrchestratorOutput> => {
    fs.mkdirSync(input.sqlDir, { recursive: true });
    const sqlPath = path.resolve(input.sqlDir, `${input.jobId}.sql`);

    const result = await pythonAdapter.runCreateSql({
      inputs: [input.normalizedInputPath],
      outputFile: sqlPath,
      tags: input.tags,
    });

    return {
      sqlPath,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  };

  return {
    generate,
  };
};
