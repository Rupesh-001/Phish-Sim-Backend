// backend/scripts/quick-seed.js
import { MongoClient } from "mongodb";
const client = new MongoClient(process.env.MONGODB_URI || "mongodb://localhost:27017");
await client.connect();
const db = client.db("phish_sim");

for (let i=0;i<10;i++){
  await db.collection("challenges").insertOne({
    title: `Seed challenge ${i+1}`,
    sender: "no-reply@seed.local",
    body: `This is seeded challenge ${i+1}\nClick link: http://example.com`,
    options: [
      { id: "A", text: "Phishing", correct: true },
      { id: "B", text: "Safe", correct: false },
      { id: "C", text: "Spam", correct: false }
    ],
    explanation: "Auto-seeded training item",
    difficulty: "beginner",
    generatedBy: "seed",
    createdAt: new Date()
  });
}
console.log("seed done");
await client.close();
