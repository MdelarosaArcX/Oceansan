import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import CopyService from "./services/copy.service";
import scheduleRoutes from "./routes/schedule.routes";
import "./config/mongo";


const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

/* ---------------- WebSocket ---------------- */

const wss = new WebSocketServer({ port: 3001 });

function broadcast(data: unknown) {
  const payload = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

console.log("WebSocket running on ws://localhost:3001");

/* ---------------- REST API ---------------- */

app.post("/copy/start", async (req, res) => {
  const { from, to } = req.body;

  if (!from || !to) {
    return res.status(400).json({ error: "Missing from/to paths" });
  }

  const copier = new CopyService();

  copier.on("progress", p => {
    broadcast({ type: "progress", payload: p });
  });

  copier.on("complete", () => {
    broadcast({ type: "complete" });
  });

  copier.on("start", s => {
    broadcast({ type: "start", payload: s });
  });

  copier.copyFolder(from, to).catch(err => {
    broadcast({ type: "error", message: err.message });
  });

  res.json({ status: "started" });
});

/* ---------------- Schedule CRUD ---------------- */

app.use("/api/schedules", scheduleRoutes);

/* ---------------- Server ---------------- */

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
