import { Router } from "express";

import * as ctrl from "../controllers/payment.controller.js";
import { verifyJWT } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = Router();

router.use(verifyJWT, requireRole("vendor"));

router.post("/checkout-session", ctrl.createCheckoutSession);
router.post("/cancel-subscription", ctrl.cancelSubscription);
router.get("/session/:id", ctrl.getSessionStatus);

export default router;
