import "dotenv/config";

import app from "../src/app.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

export default app;
