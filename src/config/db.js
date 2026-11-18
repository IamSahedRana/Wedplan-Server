import { MongoClient } from "mongodb";

let client;
let dbPromise;

/**
 * Returns a promise resolving to the MongoDB database.
 * Connection is cached per process instance — safe for serverless reuse.
 */
export function getDb() {
  if (!dbPromise) {
    client = new MongoClient(process.env.MONGODB_URI);
    dbPromise = client.connect().then(async () => {
      const db = client.db(process.env.DB_NAME || undefined);
      await db.collection("services").createIndex({ status: 1 });
      await db.collection("services").createIndex({ category: 1 });
      await db.collection("services").createIndex({ vendorId: 1 });
      await db.collection("services").createIndex({ price: 1 });
      return db;
    });
  }
  return dbPromise;
}
