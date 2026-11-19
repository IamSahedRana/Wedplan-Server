import "dotenv/config";

import { MongoClient } from "mongodb";

/** One-time migration: grant vendor "zakaria" lifetime Pro access. */
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 45000 });
await client.connect();
const db = client.db(process.env.DB_NAME);

const result = await db.collection("users").updateOne(
  { role: "vendor", name: "zakaria" },
  {
    $set: {
      subscriptionPlan: "PRO",
      subscriptionId: "lifetime-zakaria",
      subscriptionTimeline: "UNLIMITED",
      subscriptionExpiresAt: null,
    },
  }
);

console.log(`zakaria Pro migration: matched=${result.matchedCount} modified=${result.modifiedCount}`);
await client.close();
