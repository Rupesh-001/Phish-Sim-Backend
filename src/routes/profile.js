// backend/src/routes/profile.js
import express from "express";
import { requireAuth } from "./auth.js";
import { ObjectId } from "mongodb";
import { calculateLevel } from "../utils/certificates.js";

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = new ObjectId(req.user.id);

    const user = await db.collection("users").findOne(
      { _id: userId },
      { projection: { passwordHash: 0 } }
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    const attempts = await db.collection("attempts")
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    // Calculate Level
    const points = user.points ?? 0;
    const level = calculateLevel(points);

    return res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      points,
      badges: user.badges ?? [],
      certificates: user.certificates ?? [],
      level,
      attempts
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
