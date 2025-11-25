// backend/src/db.js
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

export async function connectDB(app) {
  const url = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const client = new MongoClient(url);
  await client.connect();
  app.locals.db = client.db(process.env.DB_NAME || "phish_sim");
  console.log("Connected to MongoDB at", url);
}
