// backend/src/routes/badges.js
import express from "express";
const router = express.Router();

/**
 * Badge metadata: slug, title, description, icon (emoji)
 * Keep this server-side so frontend can fetch canonical display info.
 */
const BADGES = [
  { slug: "first-correct", title: "First Correct", description: "Correct on your very first challenge.", icon: "🏅" },
  { slug: "5-correct", title: "5 Correct", description: "Solved 5 challenges correctly.", icon: "🎯" },
  { slug: "10-correct", title: "10 Correct", description: "Solved 10 challenges correctly.", icon: "🔥" },
  { slug: "streak-3", title: "3 Win Streak", description: "3 correct answers in a row.", icon: "⚡️" },
  { slug: "streak-5", title: "5 Win Streak", description: "5 correct answers in a row.", icon: "🚀" },
  { slug: "100-points", title: "100 Points", description: "Earned 100 total points.", icon: "🏆" }
];

router.get("/", (req, res) => {
  res.json({ badges: BADGES });
});

export default router;
