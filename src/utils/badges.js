import { ObjectId } from "mongodb";

export async function awardBadges(db, userId) {
  const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
  if (!user) return [];

  const badges = user.badges ?? [];

  const totalCorrect = await db.collection("attempts")
    .countDocuments({ userId: new ObjectId(userId), correct: true });

  const last5 = await db.collection("attempts")
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();

  const streak5 = last5.length === 5 && last5.every(a => a.correct);
  const streak3 = last5.length >= 3 && last5.slice(0, 3).every(a => a.correct);

  const newBadges = [];

  function give(b) {
    if (!badges.includes(b)) {
      badges.push(b);
      newBadges.push(b);
    }
  }

  if (totalCorrect >= 1) give("first-correct");
  if (totalCorrect >= 5) give("5-correct");
  if (totalCorrect >= 10) give("10-correct");

  if (streak3) give("streak-3");
  if (streak5) give("streak-5");

  if ((user.points ?? 0) >= 100) give("100-points");

  if (newBadges.length > 0) {
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: { badges } }
    );
  }

  return newBadges;
}
