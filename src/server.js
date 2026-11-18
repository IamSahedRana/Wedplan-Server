import "dotenv/config";

import app from "./app.js";
import { getDb } from "./config/db.js";

const port = Number(process.env.PORT) || 5000;

getDb()
  .then(() => {
    app.listen(port, () => console.log(`WedPlan API listening on port ${port}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
