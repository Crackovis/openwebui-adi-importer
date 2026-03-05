import type { DbClient } from "../client";

export type SettingsValue = Record<string, unknown>;

export type SettingsRepository = {
  getAll: () => Record<string, SettingsValue>;
  getOne: (key: string) => SettingsValue | null;
  setOne: (key: string, value: SettingsValue) => void;
};

type Row = {
  key: string;
  valueJson: string;
};

const parseJson = (value: string): SettingsValue => {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed as SettingsValue;
    }
    return {};
  } catch {
    return {};
  }
};

export const createSettingsRepository = (db: DbClient): SettingsRepository => {
  const getAllStmt = db.prepare("SELECT key, valueJson FROM settings");
  const getOneStmt = db.prepare("SELECT key, valueJson FROM settings WHERE key = ?");
  const setOneStmt = db.prepare(
    [
      "INSERT INTO settings (key, valueJson, updatedAt)",
      "VALUES (?, ?, ?)",
      "ON CONFLICT(key) DO UPDATE SET valueJson = excluded.valueJson, updatedAt = excluded.updatedAt",
    ].join(" "),
  );

  const getAll = (): Record<string, SettingsValue> => {
    const rows = getAllStmt.all() as Row[];
    return rows.reduce<Record<string, SettingsValue>>((acc, row) => {
      acc[row.key] = parseJson(row.valueJson);
      return acc;
    }, {});
  };

  const getOne = (key: string): SettingsValue | null => {
    const row = getOneStmt.get(key) as Row | undefined;
    return row ? parseJson(row.valueJson) : null;
  };

  const setOne = (key: string, value: SettingsValue): void => {
    setOneStmt.run(key, JSON.stringify(value), Date.now());
  };

  return {
    getAll,
    getOne,
    setOne,
  };
};
