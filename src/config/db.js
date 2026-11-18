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
    dbPromise = client.connect().then(() => client.db(process.env.DB_NAME || undefined));
  }
  return dbPromise;
}
