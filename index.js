const fs = require("fs");
const https = require("https");
const express = require("express");
const WebSocket = require("ws");
const { spawn } = require("child_process");
const selfsigned = require("selfsigned");
const path = require("path");
const crypto = require("crypto");
const { Worker } = require("worker_threads");
const inputWorker = new Worker(path.join(__dirname, "inputWorker.js"));

const PASSWORD = (process.env.PASSWORD || "mypassword").trim();
const PORT = parseInt(process.env.PORT, 10) || 5000;
const CONTROL_PORT = PORT + 1;

const validTokens = new Set();
const app = express();

const attrs = [{ name: "commonName", value: "localhost" }];
const pems = selfsigned.generate(attrs, {
  days: 365,
  extensions: [
    {
      name: "subjectAltName",
      altNames: [
        { type: 2, value: "localhost" },
        { type: 7, ip: "127.0.0.1" },
      ],
    },
  ],
});

const server = https.createServer(
  {
    cert: pems.cert,
    key: pems.private,
  },
  app
);

app.use(express.static(__dirname));
app.use(express.json());

app.post("/auth", (req, res) => {
  const { password } = req.body;
  if (password === PASSWORD) {
    const token = crypto.randomBytes(32).toString("hex");
    validTokens.add(token);
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: "Invalid password" });
  }
});

app.get("/screen-size", (req, res) => {
  const handleMessage = (msg) => {
    if (msg.type === "screenSize") {
      res.json({ width: msg.size.width, height: msg.size.height });
      inputWorker.off("message", handleMessage);
    }
  };

  inputWorker.on("message", handleMessage);
  inputWorker.postMessage({ type: "getScreenSize" });
});

const controlServer = https.createServer({
  cert: pems.cert,
  key: pems.private,
});

const wssControl = new WebSocket.Server({ server: controlServer });
wssControl.on("connection", (ws, req) => {
  console.log("Control connection established.");

  ws.on("message", (msg) => {
    const str = msg.toString();

    let data;
    try {
      data = JSON.parse(str);
    } catch (err) {
      console.error("Invalid JSON message:", str);
      return;
    }

    // Forward the valid control event to the input worker
    try {
      inputWorker.postMessage(data);
    } catch (err) {
      console.error("Error forwarding to input worker:", err);
    }
  });
});

controlServer.listen(CONTROL_PORT, () => {
  console.log(`Control server running at https://localhost:${CONTROL_PORT}/`);
});

const wss = new WebSocket.Server({ server });
let ffmpeg;

wss.on("connection", (ws, req) => {
  const params = new URLSearchParams(req.url.split("?")[1] || "");
  const token = params.get("token");

  if (!validTokens.has(token)) {
    console.log("Invalid token for video connection.");
    ws.close();
    return;
  }

  console.log("Video stream connection accepted.");
  validTokens.delete(token);

  if (!ffmpeg) {
    ffmpeg = spawn("ffmpeg", [
      "-f",
      "gdigrab",
      "-framerate",
      "30",
      "-offset_x",
      "0",
      "-offset_y",
      "0",
      "-video_size",
      "1920x1080",
      "-i",
      "desktop",
      "-vcodec",
      "mpeg1video",
      "-b:v",
      "2000k",
      "-f",
      "mpegts",
      "-",
    ]);

    ffmpeg.stderr.on("data", (data) => {
      console.error(data.toString());
      fs.appendFileSync("ffmpeg.log", data.toString());
    });
  }

  ffmpeg.stdout.on("data", (chunk) => {
    if (ws.readyState === 1) ws.send(chunk);
  });

  ws.on("close", () => {
    console.log("Video client disconnected.");
    // Optionally stop ffmpeg if no clients left
  });
});

server.listen(PORT, () => {
  console.log(`Server running at https://localhost:${PORT}/`);
});
