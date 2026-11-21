# WedPlan — Wedding Services Marketplace (Server)

WedPlan is a wedding services marketplace where couples discover, compare and book trusted vendors for photography, venues, decoration, catering, makeup and fashion. This repository contains the Express 5 + MongoDB API that powers JWT verification, services, bookings, admin moderation and one-time lifetime Pro payments.

## Important Features

- Better Auth JWT verification via JWKS hosted by the client; role and blocked status come from MongoDB
- Customer, vendor and admin dashboards with booking and service moderation workflows
- Free plan: 3 active services. Pro: unlimited services, featured placement and priority support
- One-time lifetime Pro checkout (USD); Pro is granted by a signed Stripe webhook or by server-side verification of a paid checkout session
- Idempotent Stripe webhook handling with raw-body signature verification
- Zod-validated requests, role guards and consistent JSON error responses

## Technology Stack

Node.js 18+, Express 5, MongoDB native driver, `jose`, Stripe, Zod, Helmet, CORS, Morgan.
Hosting: Railway (long-running Node process). The `api/index.js` + `vercel.json` pair remains as a legacy Vercel fallback.

## Installation Instructions

```bash
npm install
cp .env.example .env   # fill in your own values; never commit .env
```

Environment variable names are listed in `.env.example`; see the section below for details.

## How to Run the Project Locally

1. In this directory run `npm run dev` and open http://localhost:5000.
2. Start the client from the `Wedplan-Client` repository with `npm run dev` (http://localhost:3000) and set `CLIENT_URL=http://localhost:3000` so the API can fetch the client's JWKS.
3. `npm start` runs `node src/server.js` and is the production entrypoint.
4. Check `http://localhost:5000/api/health` returns 200.

## Live Website

- Client: https://wedplan-client-five.vercel.app/
- API: https://wedplan-server-production.up.railway.app/

## Repository Links

- Client: https://github.com/IamSahedRana/Wedplan-Client
- Server: https://github.com/IamSahedRana/Wedplan-Server

## Environment variables (names only)

```text
PORT
MONGODB_URI
DB_NAME
CLIENT_URL
FRONTEND_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID
```

- `CLIENT_URL` must be the exact client origin (no trailing slash). The API fetches `${CLIENT_URL}/api/auth/jwks` to verify JWTs, so a wrong value makes every protected request return 401.
- `FRONTEND_URL` is used for Stripe success/cancel URLs; it falls back to `CLIENT_URL`.
- `PORT` is injected by Railway; locally it defaults to 5000.

## Local Stripe webhook testing

Stripe cannot reach `localhost`. Use the Stripe CLI:

```bash
stripe listen --forward-to localhost:5000/api/payments/webhook
```

Copy the printed `whsec_...` signing secret into `STRIPE_WEBHOOK_SECRET`. Checkout still works without a webhook because `/api/payments/verify-session` verifies the paid session directly with Stripe.

## Deployment on Railway

1. Create a Railway project and deploy this repository (`Wedplan-Server`), root directory `/`.
2. Set the start command to `node src/server.js` (also defined in `railway.json`); healthcheck path is `/api/health`.
3. Add all environment variables above. Do not hardcode `PORT`; Railway injects it.
4. Set `CLIENT_URL` and `FRONTEND_URL` to `https://wedplan-client-five.vercel.app`.
5. Allow Railway egress IPs in MongoDB Atlas Network Access (or `0.0.0.0/0` for development), with a `readWrite` database user.
6. Verify `https://wedplan-server-production.up.railway.app/api/health` returns 200.

## Stripe webhook in production

Dashboard → Developers → Webhooks → Add endpoint:

```text
https://wedplan-server-production.up.railway.app/api/payments/webhook
```

Listen to `checkout.session.completed` and `payment_intent.payment_failed`, then copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET` on Railway and redeploy.

## Troubleshooting

- Every API call returns 401: `CLIENT_URL` is wrong, so JWKS cannot be fetched.
- Browser shows "Failed to fetch": `NEXT_PUBLIC_API_URL` on the client still points to localhost or CORS only allows the exact `CLIENT_URL`.
- No data after redeploy: `NEXT_PUBLIC_*` values are baked into the client at build time; rebuild after changing them.
- Mongo timeouts: Atlas IP allowlist or wrong `MONGODB_URI`/`DB_NAME`.
