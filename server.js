const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const QRCode = require("qrcode");
const db = require("./db");

const cfg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "config.json"), "utf8"),
);
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const pub = (f) => (req, res) =>
  res.sendFile(path.join(__dirname, "public", f));

app.use(express.json());
app.use("/assets", express.static(path.join(__dirname, "public/assets")));
app.get("/", pub("index.html"));
app.get("/admin", pub("admin.html"));

const broadcast = () => io.emit("state", db.state());
io.on("connection", (s) => s.emit("state", db.state()));

app.get("/api/state", (req, res) => res.json(db.state()));
app.get("/api/qr", async (req, res) => {
  const text = String(req.query.text || "").slice(0, 300);
  if (!text) return res.status(400).end();
  res
    .type("image/svg+xml")
    .send(
      await QRCode.toString(text, {
        type: "svg",
        margin: 1,
        errorCorrectionLevel: "M",
      }),
    );
});

// Admin API (optionally protected by a PIN)
const admin = express.Router();
admin.use((req, res, next) => {
  if (!cfg.adminPin || req.get("x-admin-pin") === String(cfg.adminPin))
    return next();
  res.status(401).json({ error: "Wrong PIN" });
});
// Write route: respond and push a live update to all clients
const act = (fn) => (req, res) => {
  try {
    const out = fn(req);
    broadcast();
    res.json(out || { ok: true });
  } catch (e) {
    res.status(e.status || 400).json({ error: e.message });
  }
};
admin.get("/config", (req, res) =>
  res.json({
    ssid: cfg.ssid,
    password: cfg.password,
    baseUrl: cfg.baseUrl,
    points: cfg.points,
  }),
);
admin.post(
  "/players",
  act((r) => db.addPlayer(r.body.name)),
);
admin.delete(
  "/players/:id",
  act((r) => db.delPlayer(+r.params.id)),
);
admin.post(
  "/races",
  act((r) => db.addRace(r.body.name)),
);
admin.put(
  "/races/:id",
  act((r) => db.renameRace(+r.params.id, r.body.name)),
);
admin.delete(
  "/races/:id",
  act((r) => db.delRace(+r.params.id)),
);
admin.get("/races/:id/results", (req, res) =>
  res.json(db.results(+req.params.id)),
);
admin.put(
  "/races/:id/results",
  act((r) => db.setResults(+r.params.id, r.body.results)),
);
app.use("/api/admin", admin);

// Player page: http://<ip>/<player-name>
app.get("/:slug", (req, res) => {
  if (!db.bySlug(req.params.slug))
    return res.status(404).send("Player not found");
  res.sendFile(path.join(__dirname, "public", "player.html"));
});

server.listen(cfg.port, "0.0.0.0", () =>
  console.log(`Game Night running on port ${cfg.port}`),
);
