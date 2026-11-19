import { MongoClient } from "mongodb";

let client;
let dbPromise;

/**
 * Returns a promise resolving to the MongoDB database.
 * Connection is cached per process instance — safe for serverless reuse.
 */
export function getDb() {
  if (!dbPromise) {
    const pendingClient = new MongoClient(process.env.MONGODB_URI);
    client = pendingClient;
    dbPromise = pendingClient
      .connect()
      .then(async () => {
        const db = pendingClient.db(process.env.DB_NAME || undefined);
        await db.collection("services").createIndex({ status: 1 });
        await db.collection("services").createIndex({ category: 1 });
        await db.collection("services").createIndex({ vendorId: 1 });
        await db.collection("services").createIndex({ price: 1 });
        return db;
      })
      .catch(async (err) => {
        // A transient connection failure must not poison the process forever;
        // clear the cache so the next request can retry.
        if (client === pendingClient) client = undefined;
        dbPromise = undefined;
        await pendingClient.close().catch(() => {});
        throw err;
      });
  }
  return dbPromise;
}
