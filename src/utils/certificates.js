// backend/src/utils/certificates.js
import { ObjectId } from "mongodb";

const LEVELS = [
  { key: "Beginner", minPoints: 0, requiredCorrect: 0 },
  { key: "Intermediate", minPoints: 50, requiredCorrect: 5 },
  { key: "Advanced", minPoints: 150, requiredCorrect: 10 },
  { key: "Expert", minPoints: 300, requiredCorrect: 20 }
];

export function calculateLevel(points = 0) {
  let level = LEVELS[0].key;
  for (const L of LEVELS) {
    if (points >= L.minPoints) level = L.key;
  }
  return level;
}

export function levelThreshold(levelKey) {
  const L = LEVELS.find(l => l.key === levelKey);
  return L ? L.minPoints : null;
}

/**
 * Checks whether user qualifies for a certificate by:
 *  - crossing the points threshold for a higher level OR
 *  - completing 'requiredCorrect' number of correct attempts for that level's difficulty (gamified)
 *
 * If qualifies and not already awarded the same level, it will insert a certificate document into users.certificates.
 * Returns the certificate object if awarded, otherwise null.
 */
export async function tryIssueCertificate(db, userId, oldPoints, newPoints) {
  // compute old & new levels
  const oldLevel = calculateLevel(oldPoints);
  const newLevel = calculateLevel(newPoints);

  // award if crossed to a higher level by points
  if (levelRank(newLevel) > levelRank(oldLevel)) {
    const awarded = await createCertificateIfNotExists(db, userId, newLevel);
    if (awarded) return awarded;
  }

  // gamified check: for each level, if user completed requiredCorrect count of correct attempts in that difficulty
  // We'll check the level corresponding to newPoints (current level)
  const currentLevelObj = LEVELS.find(l => l.key === newLevel);
  if (!currentLevelObj) return null;

  const requiredCorrect = currentLevelObj.requiredCorrect;
  if (requiredCorrect <= 0) return null;

  // Count unique correct challenges of that difficulty solved by user
  // This assumes challenges have `difficulty` field set to Beginner/Intermediate/Advanced/Expert (or "beginner" etc.)
  // We'll compare case-insensitively.
  const difficultyName = currentLevelObj.key.toLowerCase();

  const pipeline = [
    {
      $match: {
        userId: new ObjectId(userId),
        correct: true
      }
    },
    {
      $lookup: {
        from: "challenges",
        localField: "challengeId",
        foreignField: "_id",
        as: "challenge"
      }
    },
    { $unwind: "$challenge" },
    {
      $match: {
        "challenge.difficulty": { $regex: new RegExp(`^${difficultyName}$`, "i") }
      }
    },
    {
      $group: {
        _id: "$challenge._id"
      }
    },
    {
      $count: "uniqueCorrectCount"
    }
  ];

  const agg = await db.collection("attempts").aggregate(pipeline).toArray();
  const uniqueCorrectCount = agg[0]?.uniqueCorrectCount || 0;

  if (uniqueCorrectCount >= requiredCorrect) {
    const awarded = await createCertificateIfNotExists(db, userId, newLevel);
    if (awarded) return awarded;
  }

  return null;
}

function levelRank(levelKey) {
  return LEVELS.findIndex(l => l.key === levelKey);
}

async function createCertificateIfNotExists(db, userId, levelKey) {
  // Check whether user already has certificate for this level
  const user = await db.collection("users").findOne({ _id: new ObjectId(userId) }, { projection: { certificates: 1, name:1, email:1 } });
  const already = Array.isArray(user?.certificates) && user.certificates.some(c => c.level === levelKey);
  if (already) return null;

  const certId = cryptoId();
  const issuedAt = new Date();

  const cert = {
    id: certId,
    level: levelKey,
    issuedAt,
    name: (user && user.name) || "Unknown",
    email: (user && user.email) || ""
  };

  // push into user's certificates array
  await db.collection("users").updateOne(
    { _id: new ObjectId(userId) },
    { $push: { certificates: cert } , $setOnInsert: { createdAt: new Date() } }
  );

  return cert;
}

// small random id for certificate (64-bit-ish)
function cryptoId() {
  // use randomUUID if available
  try {
    return (globalThis?.crypto && globalThis.crypto.randomUUID) ? crypto.randomUUID() : (Math.random().toString(36).slice(2) + Date.now().toString(36));
  } catch (e) {
    return (Math.random().toString(36).slice(2) + Date.now().toString(36));
  }
}
