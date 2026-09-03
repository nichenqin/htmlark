import { DatabaseSync } from "node:sqlite";

export type SqliteValue = string | number | bigint | Uint8Array | null;
export type SqliteParams = Record<string, SqliteValue | undefined>;

function bind(params?: SqliteParams): Record<string, SqliteValue> | undefined {
  if (!params) return undefined;
  const out: Record<string, SqliteValue> = {};
  for (const [key, value] of Object.entries(params)) {
    out[key.startsWith("$") ? key : `$${key}`] = value === undefined ? null : value;
  }
  return out;
}

export class Sqlite {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  query(sql: string) {
    const stmt = this.db.prepare(sql);
    return {
      get: (params?: SqliteParams) => {
        const bound = bind(params);
        return bound ? stmt.get(bound) : stmt.get();
      },
      all: (params?: SqliteParams) => {
        const bound = bind(params);
        return bound ? stmt.all(bound) : stmt.all();
      },
      run: (params?: SqliteParams) => {
        const bound = bind(params);
        return bound ? stmt.run(bound) : stmt.run();
      },
    };
  }

  transaction<T>(fn: () => T): () => T {
    return () => {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const out = fn();
        this.db.exec("COMMIT");
        return out;
      } catch (err) {
        this.db.exec("ROLLBACK");
        throw err;
      }
    };
  }

  close(): void {
    this.db.close();
  }
}
