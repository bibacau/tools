import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";
import { fileURLToPath } from "node:url";
import path from "node:path";
import multer from "multer";
const db = new PrismaClient({
  adapter: new PrismaBetterSQLite3({ url: process.env.DATABASE_URL }),
});
const app = express();
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: [
          "'self'",
          "https://api.frankfurter.dev",
          "https://ipapi.co",
          "https://api64.ipify.org",
        ],
        workerSrc: ["'self'", "blob:"],
      },
    },
  }),
);
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!["GET", "HEAD"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin && new URL(origin).host !== req.get("host"))
      return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  next();
});
app.get("/api/health", async (req, res) => {
  await db.$queryRaw`SELECT 1`;
  res.json({ ok: true });
});
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 });
async function session(req) {
  const s = await db.session.findUnique({
    where: { id: req.cookies.session || "" },
  });
  return s && Number(s.expires) > Date.now();
}
app.get("/api/auth", async (req, res) =>
  res.json({
    setup: !(await db.account.count()),
    authenticated: !!(await session(req)),
  }),
);
app.post("/api/auth", authLimit, async (req, res) => {
  const { password } = req.body;
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 200
  )
    return res
      .status(400)
      .json({ error: "Use a password of 12–200 characters." });
  let owner = await db.account.findUnique({ where: { id: "owner" } });
  if (!owner) {
    try {
      owner = await db.account.create({
        data: { hash: await bcrypt.hash(password, 12) },
      });
    } catch {
      return res
        .status(409)
        .json({ error: "Account was initialized. Sign in again." });
    }
  } else if (!(await bcrypt.compare(password, owner.hash)))
    return res.status(401).json({ error: "Incorrect password" });
  const id = randomBytes(32).toString("hex");
  await db.session.deleteMany({
    where: { expires: { lt: BigInt(Date.now()) } },
  });
  await db.session.create({
    data: { id, expires: BigInt(Date.now() + 30 * 86400000) },
  });
  res.cookie("session", id, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: 30 * 86400000,
  });
  res.json({ ok: true });
});
app.post("/api/logout", async (req, res) => {
  await db.session.deleteMany({ where: { id: req.cookies.session || "" } });
  res.clearCookie("session");
  res.json({ ok: true });
});
app.use("/api", async (req, res, next) => {
  if (!(await session(req)))
    return res.status(401).json({ error: "Sign in to synchronize" });
  next();
});
app.get("/api/records", async (req, res) =>
  res.json(
    (await db.record.findMany()).map((r) => ({
      id: r.id,
      rev: r.rev,
      data: JSON.parse(r.payload),
    })),
  ),
);
app.put("/api/records/:id", async (req, res) => {
  const { baseRev, data } = req.body;
  if (
    !Number.isSafeInteger(baseRev) ||
    baseRev < 0 ||
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.type !== "string" ||
    req.params.id.length > 200
  )
    return res.status(400).json({ error: "Invalid record" });
  const result = await db.$transaction(async (tx) => {
    const r = await tx.record.findUnique({ where: { id: req.params.id } });
    if ((r?.rev || 0) !== baseRev)
      return {
        conflict: r
          ? { id: r.id, rev: r.rev, data: JSON.parse(r.payload) }
          : null,
      };
    const row = await tx.record.upsert({
      where: { id: req.params.id },
      create: {
        id: req.params.id,
        rev: 1,
        payload: JSON.stringify(data),
        updated: BigInt(Date.now()),
      },
      update: {
        rev: { increment: 1 },
        payload: JSON.stringify(data),
        updated: BigInt(Date.now()),
      },
    });
    return { id: row.id, rev: row.rev };
  });
  res.status("conflict" in result ? 409 : 200).json(result);
});
app.get("/api/network", (req, res) =>
  res.json({
    serverReachable: true,
    clientAddress: req.socket.remoteAddress,
    serverTime: new Date().toISOString(),
    note: "Address observed by this server; a reverse proxy can change it.",
  }),
);
app.get("/api/speech", async (req, res) => {
  if (!process.env.SPEECH_URL) return res.json({ available: false });
  try {
    const r = await fetch(process.env.SPEECH_URL + "/health", {
      signal: AbortSignal.timeout(3000),
    });
    res.json({ available: r.ok });
  } catch {
    res.json({ available: false });
  }
});
app.post(
  "/api/speech",
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
  }).single("audio"),
  async (req, res) => {
    if (!process.env.SPEECH_URL || !req.file)
      return res.status(503).json({
        error: "Install and start the optional local speech service.",
      });
    try {
      const form = new FormData();
      form.append("audio", new Blob([req.file.buffer]), "recording.webm");
      const r = await fetch(process.env.SPEECH_URL + "/transcribe", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(120000),
      });
      if (!r.ok) throw Error("Local recognition failed");
      res.json(await r.json());
    } catch (e) {
      res.status(503).json({ error: e.message });
    }
  },
);
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist",
);
app.use(express.static(root));
app.get("/{*path}", (req, res) => res.sendFile(path.join(root, "index.html")));
app.use((e, req, res, _next) => {
  console.error(e.message);
  res.status(500).json({ error: "The server could not complete the request." });
});
const port = Number(process.env.PORT || 8003);
app.listen(port, "0.0.0.0", () =>
  console.log(`Personal OS listening on ${port}`),
);
