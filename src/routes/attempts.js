// backend/src/routes/attempts.js
import express from "express";
import { ObjectId } from "mongodb";
import { requireAuth } from "./auth.js";
import { awardBadges } from "../utils/badges.js";
import { tryIssueCertificate, calculateLevel } from "../utils/certificates.js";

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id; // string
    const { challengeId, chosenId } = req.body;

    if (!challengeId || !chosenId) {
      return res.status(400).json({ error: "challengeId and chosenId are required" });
    }

    // fetch challenge
    const challenge = await db.collection("challenges").findOne({ _id: new ObjectId(challengeId) });
    if (!challenge) return res.status(404).json({ error: "Challenge not found" });

    const chosen = challenge.options.find(o => o.id === chosenId);
    const correct = !!(chosen && chosen.correct);
    const pointsEarned = correct ? (challenge.points || 10) : 0;

    // get user's current points (before update)
    const userBefore = await db.collection("users").findOne({ _id: new ObjectId(userId) }, { projection: { points: 1 } });
    const oldPoints = userBefore?.points || 0;
    const newPoints = oldPoints + pointsEarned;

    // record attempt
    const attemptDoc = {
      userId: new ObjectId(userId),
      challengeId: new ObjectId(challengeId),
      chosenId,
      correct,
      pointsEarned,
      createdAt: new Date()
    };
    await db.collection("attempts").insertOne(attemptDoc);

    // update points if correct
    if (correct && pointsEarned > 0) {
      await db.collection("users").updateOne(
        { _id: new ObjectId(userId) },
        { $inc: { points: pointsEarned } }
      );
    }

    // award badges (reads latest attempts/points inside)
    const awardedBadges = await awardBadges(db, userId);

    // try to issue certificate (either by crossing points level or gamified completions)
    const awardedCertificate = await tryIssueCertificate(db, userId, oldPoints, newPoints);

    // fetch updated points & level
    const updatedUser = await db.collection("users").findOne({ _id: new ObjectId(userId) }, { projection: { points: 1, badges:1, certificates:1 } });
    const currentPoints = updatedUser?.points || newPoints;
    const level = calculateLevel(currentPoints);

    return res.json({
      correct,
      pointsEarned,
      awardedBadges,
      awardedCertificate,
      points: currentPoints,
      level
    });
  } catch (err) {
    console.error("Attempt error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
