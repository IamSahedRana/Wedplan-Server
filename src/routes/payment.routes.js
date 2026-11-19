import { Router } from "express";

import * as ctrl from "../controllers/payment.controller.js";
import { verifyJWT } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = Router();

router.use(verifyJWT, requireRole("vendor"));

router.post("/create-checkout-session", ctrl.createCheckoutSession);
router.get("/verify-session", ctrl.verifySession);
router.get("/session/:id", ctrl.getSessionStatus);
router.get("/transactions", ctrl.vendorTransactions);

export default router;
