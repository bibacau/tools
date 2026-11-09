import { defineConfig } from "prisma/config";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";
process.env.DATABASE_URL ||= "file:./data/personal-os.db";
export default defineConfig({
  experimental: { adapter: true },
  schema: "prisma/schema.prisma",
  engine: "js",
  adapter: async () =>
    new PrismaBetterSQLite3({
      url: process.env.DATABASE_URL || "file:./data/personal-os.db",
    }),
});
