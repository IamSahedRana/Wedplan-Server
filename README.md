# WedPlan

WedPlan is a wedding services marketplace that connects couples with trusted local vendors. Customers can discover, compare and book wedding services; vendors can publish and manage their offerings and bookings; admins can moderate users, services and transactions.

**Live website:** `https://<live-website-url>`

**Client repository:** `https://github.com/<owner>/<client-repo>`

**Server repository:** `https://github.com/<owner>/<server-repo>`

## Features

- Email/password and Google sign-in with role-based access (`customer`, `vendor`, `admin`)
- One-time onboarding to choose customer or vendor role
- Browse services with search, category filter, price sorting and pagination
- Service detail pages with gallery, vendor info and booking request form
- Vendor dashboard: overview, service management, add service, booking requests, subscription, profile
- Customer dashboard: overview, bookings, profile
- Admin dashboard: overview, user management, service moderation, transactions
- Booking lifecycle: pending / accepted / rejected / cancelled, with duplicate-date protection
- Service moderation: pending / approved / rejected; only approved and active services are public
- Free plan allows 3 active services; premium allows unlimited
- Stripe subscription checkout with signature-verified webhook activation
- Blocked-user enforcement, JWT verification on every protected API request
- Responsive UI with loading skeletons, empty states and error states

## Tech stack

| Layer | Technologies |
| --- | --- |
| Client | Next.js 16 (App Router), React 19, JavaScript, Tailwind CSS 4, shadcn/ui, Radix UI, Framer Motion, React Hook Form, Zod, Better Auth, Recharts, Sonner, Lucide icons |
| Server | Node.js 18+, Express 5, MongoDB (native driver), Better Auth JWT verification via `jose`, Stripe, Zod, Helmet, CORS, Morgan |
| Hosting | Vercel (client and server) |

## Installation

Requirements: Node.js 18 or newer, npm and a MongoDB database URI.

1. Clone the two repositories into a folder:

   ```bash
   git clone https://github.com/<owner>/<client-repo>.git wedplan-client
   git clone https://github.com/<owner>/<server-repo>.git wedplan-server
   ```

2. Install dependencies:

   ```bash
   cd wedplan-client && npm install
   cd ../wedplan-server && npm install
   ```

3. In each project, copy `.env.example` to `.env` and fill in your own values. Never commit `.env` files; `.gitignore` already excludes them. The variable names are listed below.

## Environment variables (names only)

Client (`wedplan-client/.env`):

```text
MONGODB_URI
DB_NAME
BETTER_AUTH_SECRET
BETTER_AUTH_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_API_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
IMGBB_API_KEY
ADMIN_EMAIL
ADMIN_PASSWORD
ADMIN_NAME
```

Server (`wedplan-server/.env`):

```text
PORT
MONGODB_URI
DB_NAME
CLIENT_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID
```

## Local run

Start the API first, then the client (use two terminals):

```bash
# Terminal 1 - API at http://localhost:5000
cd wedplan-server
npm run dev
```

```bash
# Terminal 2 - website at http://localhost:3000
cd wedplan-client
npm run dev
```

Optional demo data:

```bash
# Client - create the first admin (uses values from client .env)
npm run seed:admin

# Server - seed services for two existing vendor emails
npm run seed:services -- vendor1@example.com vendor2@example.com
```

Production commands:

```bash
# Client
npm run build
npm start

# Server
npm start
```
