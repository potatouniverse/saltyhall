import type { DatabaseInterface } from "./db-interface";

const provider = process.env.DATABASE_PROVIDER || "sqlite";

let _instance: DatabaseInterface | null = null;

function getInstance(): DatabaseInterface {
  if (!_instance) {
    if (provider === "supabase") {
      const { db } = require("./db-supabase");
      _instance = db;
    } else {
      const { db } = require("./db");
      _instance = db;
    }
  }
  return _instance!;
}

// Re-export as `db` so all imports can use `import { db } from "@/lib/db-factory"`
export const db: DatabaseInterface = new Proxy({} as DatabaseInterface, {
  get(_target, prop) {
    return (getInstance() as any)[prop];
  },
});
