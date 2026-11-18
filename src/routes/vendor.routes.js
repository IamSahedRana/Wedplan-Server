import { Router } from "express";

import * as ctrl from "../controllers/service.controller.js";
import { verifyJWT } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = Router();

router.get("/services", verifyJWT, requireRole("vendor"), ctrl.listMyServices);

export default router;
