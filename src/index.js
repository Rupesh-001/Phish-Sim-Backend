import express from "express";
import dotenv from "dotenv";
import path from "path";
import { MongoClient } from "mongodb";
import cors from "cors";

dotenv.config();

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "phish_sim";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const app = express();
app.use(express.json());

// --- CORS: allow both deployed frontend and local dev (preflight handled) ---
const allowedOrigins = [
  FRONTEND_URL,
  "http://localhost:5173", // local dev (vite)
];

app.use((req, res, next) => {
  // handle preflight quickly
  const origin = req.headers.origin;
  if (!origin) {
    // no origin (server-to-server or curl), allow
    res.header("Access-Control-Allow-Origin", "*");
  } else if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  } else {
    // not allowed origin — do not set ACAO header
    // let CORS middleware/your code reject it later if needed
  }

  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  next();
});

// ensure OPTIONS preflight requests are handled
app.options("*", cors({
  origin: (origin, cb) => {
    // allow no-origin requests (curl / server)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

// ✅ Health check for Render monitoring
app.get("/health", (req, res) => {
  res.status(200).json({ status: "Backend is running ✅" });
});

// serve public static (images, invoices, certificates)
app.use("/images", express.static(path.join(process.cwd(), "public", "images")));
app.use("/invoices", express.static(path.join(process.cwd(), "public", "invoices")));
app.use("/certificates", express.static(path.join(process.cwd(), "public", "certificates")));
app.use(express.static("public"));


// --- Routes ---
import challengesRouter from "./routes/challenges.js";
import attemptsRouter from "./routes/attempts.js";
import authRouter from "./routes/auth.js";
import profileRouter from "./routes/profile.js";
import certificatesRouter from "./routes/certificates.js";
import leaderboardRouter from "./routes/leaderboard.js";

app.use("/api/challenges", challengesRouter);
app.use("/api/attempts", attemptsRouter);
app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/certificates", certificatesRouter);
app.use("/api/leaderboard", leaderboardRouter);

// ✅ Database connection
async function start() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();

    console.log("✅ Connected to MongoDB");
    app.locals.db = client.db(DB_NAME);

    app.listen(PORT, () => {
      console.log(`🚀 Backend running on port ${PORT}`);
      console.log(`=> FRONTEND_URL: ${FRONTEND_URL}`);
    });

  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

start();
