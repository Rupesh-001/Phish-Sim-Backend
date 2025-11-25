// backend/src/routes/leaderboard.js
import express from "express";
import { ObjectId } from "mongodb";

const router = express.Router();

/**
 * GET /api/leaderboard
 * Query params:
 *  - limit (optional, default 20)
 *  - aroundUserId (optional) -> return user's rank and few neighbors (not implemented here)
 */
router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);

    const users = await db.collection("users")
      .find({}, { projection: { name: 1, points: 1, badges: 1 } })
      .sort({ points: -1 })
      .limit(limit)
      .toArray();

    // Add rank numbers
    const leaderboard = users.map((u, idx) => ({
      rank: idx + 1,
      id: u._id,
      name: u.name,
      points: u.points || 0,
      badgesCount: Array.isArray(u.badges) ? u.badges.length : 0
    }));

    res.json({ leaderboard });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

export default router;
