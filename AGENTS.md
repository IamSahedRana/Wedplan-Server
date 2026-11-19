# WedPlan Server — Express + MongoDB, JavaScript (ESM), deployed on Vercel

## Working rules
- NEVER read, write or print any .env file. Maintain only .env.example (names, no values). .gitignore: .env, node_modules.
- Before using Stripe/jose/Better Auth APIs, check the docs for the installed version; don't rely on memory.
- Do only the task given. Don't re-read files you just wrote. Verify by running/`node --check`.
- Commit in small feature-based commits (1-3 per task): `git add -A && git commit -m "<type>: <specific message>"`. Never push unless told.
- Reply max 3 lines. No explanations, no code dumps.

## Structure
src/app.js (exports express app) · src/server.js (local listen) · src/config/db.js (cached Mongo connection, serverless-safe) · src/middleware/{auth,role,validate,error}.js · src/routes · src/controllers · src/utils · scripts/ · api/index.js (exports app for Vercel) · vercel.json (rewrite all to /api)

## Auth
- Better Auth runs on the CLIENT and issues JWTs via jwt plugin + JWKS.
- Verify `Authorization: Bearer <jwt>` with `jose` createRemoteJWKSet(CLIENT_URL + /api/auth/jwks).
- After verifying, load user from Mongo `users` by token sub. Role and isBlocked come from the DB, never from token/body/client.
- 401 missing/invalid/expired token; 403 wrong role or blocked user.
- Middleware: verifyJWT, requireRole(...roles), validate(zodSchema).

## Data (refs via ObjectId)
users (Better Auth, collection "users"): name email image role(vendor|customer|admin) isBlocked onboarded businessName phone address bio subscriptionPlan(free|premium) subscriptionExpiresAt stripeCustomerId stripeSubscriptionId
services: vendorId serviceName category description price location images[] status(pending|approved|rejected) isActive createdAt
bookings: serviceId vendorId customerId eventDate eventLocation message status(pending|accepted|rejected|cancelled) createdAt
transactions: vendorId plan amount currency stripeSessionId stripeSubscriptionId status(paid|pending|failed) createdAt
Categories: Photography & Videography, Wedding Venues, Decoration & Florist, Catering Services, Makeup & Styling, Wedding Fashion

## Business rules
- Public service list/featured: status=approved AND isActive=true AND vendor not blocked. Rejected never visible.
- Free vendor: max 3 active services (checked on create AND on re-activate). Premium: unlimited.
- getEffectivePlan(user): premium only if subscriptionPlan=premium AND subscriptionExpiresAt in future; else free. Use it everywhere (limit, badge, stats).
- On downgrade: keep 3 oldest active services, deactivate the rest.
- Booking: customers only; not own service; not admin; service approved+active; eventDate future, normalized to date-only UTC; no duplicate pending/accepted booking for same service+date; only pending can be accepted/rejected/cancelled; vendors/customers only touch their own records; customerId/vendorId derived server-side.
- Pro activated ONLY after server-side Stripe verification (signed webhook or checkout session retrieval), idempotent. Never from redirect alone.
- Admin cannot edit transactions. Profile PATCH whitelist: name,image,phone,address,bio,businessName. Never role/isBlocked/subscription.
- Validate every body with zod .strict(); validate every :id as ObjectId. JSON errors {message}. 404 handler. Consistent status codes.

## Env names
PORT, MONGODB_URI, DB_NAME, CLIENT_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID