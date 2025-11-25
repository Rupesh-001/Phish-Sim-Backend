// backend/src/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "verysecret";

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });
  const db = req.app.locals.db;
  const existing = await db.collection("users").findOne({ email });
  if (existing) return res.status(400).json({ error: "User exists" });

  const hash = await bcrypt.hash(password, 10);
  const user = { name, email, passwordHash: hash, points: 0, badges: [], createdAt: new Date() };
  const result = await db.collection("users").insertOne(user);
  const userId = result.insertedId.toString();
  const token = jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: userId, name, email, points: 0 } });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const db = req.app.locals.db;
  const user = await db.collection("users").findOne({ email });
  if (!user) return res.status(400).json({ error: "Invalid credentials" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ error: "Invalid credentials" });
  const token = jwt.sign({ sub: user._id.toString(), email }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user._id.toString(), name: user.name, email: user.email, points: user.points }});
});

// middleware to protect routes (use in other routes)
export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Missing auth" });
  const token = auth.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export default router;
