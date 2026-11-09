import Database from "better-sqlite3";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const url = process.env.DATABASE_URL || "file:./data/personal-os.db";
if (!url.startsWith("file:")) throw Error("Use a SQLite file: URL");
const filename = url.slice(5);
mkdirSync(path.dirname(filename), { recursive: true });
const db = new Database(filename);
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");
db.exec(
  "CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL)",
);
const directory = fileURLToPath(
  new URL("../prisma/migrations/", import.meta.url),
);
for (const name of readdirSync(directory).sort()) {
  const sql = readFileSync(path.join(directory, name, "migration.sql"), "utf8"),
    checksum = createHash("sha256").update(sql).digest("hex");
  db.transaction(() => {
    const existing = db
      .prepare("SELECT checksum FROM app_migrations WHERE name=?")
      .get(name);
    if (existing) {
      if (existing.checksum !== checksum)
        throw Error("Applied migration was modified: " + name);
      return;
    }
    db.exec(sql);
    db.prepare("INSERT INTO app_migrations VALUES (?,?)").run(name, checksum);
    console.log("Applied migration:", name);
  })();
}
db.close();
