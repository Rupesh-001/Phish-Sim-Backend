// backend/scripts/seed.js
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME || "phish_sim");
    const challenges = db.collection("challenges");

    const doc = {
      title: "Urgent: Verify your account",
      sender: "Security Team <no-reply@secure-update.com>",
      body: "Dear user,\nWe detected suspicious activity. Click here to verify: http://secure-update-login.com",
      options: [
        { id: "A", text: "This is a phishing email", correct: true },
        { id: "B", text: "This is a safe email", correct: false },
        { id: "C", text: "Looks like spam but not harmful", correct: false }
      ],
      explanation: "The sender domain is suspicious and uses urgency to trick you.",
      difficulty: "beginner",
      generatedBy: "manual",
      createdAt: new Date()
    };

    const result = await challenges.insertOne(doc);
    console.log("Inserted challenge id:", result.insertedId);
  } finally {
    await client.close();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
