import { Router } from "express";

import { stripeWebhook } from "../controllers/stripe-webhook.controller.js";

const router = Router();

router.post("/", stripeWebhook);

export default router;
