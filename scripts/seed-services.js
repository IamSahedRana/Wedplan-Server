import "dotenv/config";

import { MongoClient } from "mongodb";

import { CATEGORIES } from "../src/utils/constants.js";

const emails = [...new Set(process.argv.slice(2).map((e) => e.trim().toLowerCase()).filter(Boolean))];

if (emails.length < 2) {
  console.error("Usage: npm run seed:services -- vendor1@example.com vendor2@example.com");
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  console.error("Missing required env var: MONGODB_URI");
  process.exit(1);
}

const [c1, c2, c3, c4, c5, c6] = CATEGORIES;
const photo = (id) => `https://images.unsplash.com/${id}?q=80&w=1200&auto=format&fit=crop`;

const APPROVED = [
  {
    serviceName: "Cinematic Wedding Photography",
    category: c1,
    description: "Full-day cinematic coverage with a second shooter, drone shots and a hand-finished album.",
    price: 45000,
    location: "Dhaka",
    images: [photo("photo-1519741497674-611481863552"), photo("photo-1511285560929-80b456fea0bc"), photo("photo-1522673607200-164d1b6ce486")],
  },
  {
    serviceName: "Pre-Wedding Shoot Package",
    category: c1,
    description: "Two-location pre-wedding shoot with styling support, 40 edited images and a short film.",
    price: 32000,
    location: "Chattogram",
    images: [photo("photo-1537633552985-df8429e8048b"), photo("photo-1465495976277-4387d4b0b4c6")],
  },
  {
    serviceName: "Garden Wedding Venue",
    category: c2,
    description: "Landscaped outdoor garden venue for 300 guests with lawn, stage and guest seating.",
    price: 250000,
    location: "Sylhet",
    images: [photo("photo-1519225421980-715cb0215aed"), photo("photo-1469371670807-013ccf25f16a"), photo("photo-1507504031003-b417219a0fde")],
  },
  {
    serviceName: "Grand Banquet Hall",
    category: c2,
    description: "Air-conditioned banquet hall for 600 guests with bridal suite, parking and in-house catering.",
    price: 180000,
    location: "Dhaka",
    images: [photo("photo-1511795409834-ef04bbd61622"), photo("photo-1545232979-8bf68ee6f0d9")],
  },
  {
    serviceName: "Floral Stage Decoration",
    category: c3,
    description: "Custom floral stage and aisle decor with fresh roses, drapery, lighting and floral arches.",
    price: 85000,
    location: "Dhaka",
    images: [photo("photo-1519225421980-715cb0215aed"), photo("photo-1523438885200-e635ba2c371e"), photo("photo-1469371670807-013ccf25f16a")],
  },
  {
    serviceName: "Mandap & Floral Arrangement",
    category: c3,
    description: "Traditional mandap setup with marigold garlands, lanterns and matching reception centerpieces.",
    price: 65000,
    location: "Cox's Bazar",
    images: [photo("photo-1606800052052-a08af7148866"), photo("photo-1509927083803-b417219a0fde")],
  },
  {
    serviceName: "Bengali Wedding Feast",
    category: c4,
    description: "Traditional Bengali menu for 250 guests with biryani, curries, sweets and live counters.",
    price: 120000,
    location: "Dhaka",
    images: [photo("photo-1504674900247-0877df9cc836"), photo("photo-1555244162-803834f70033"), photo("photo-1414235077428-338989a2e8c0")],
  },
  {
    serviceName: "Multi-Cuisine Catering",
    category: c4,
    description: "Buffet catering for 300 guests with Bangla, North Indian and Chinese menus plus dessert bar.",
    price: 95000,
    location: "Chattogram",
    images: [photo("photo-1555939594-58d7cb561ad1"), photo("photo-1517248135467-4c7edcad34c4")],
  },
  {
    serviceName: "Bridal Makeup & Hair",
    category: c5,
    description: "HD bridal makeup, hair styling and draping with trial session and touch-up kit included.",
    price: 18000,
    location: "Dhaka",
    images: [photo("photo-1596704017254-9b121068fb31"), photo("photo-1522335789203-aabd1fc54bc9"), photo("photo-1487412720507-e7ab37603c6f")],
  },
  {
    serviceName: "Groom Styling Package",
    category: c5,
    description: "Groom grooming, hair styling and beard shaping for the ceremony and reception events.",
    price: 12000,
    location: "Sylhet",
    images: [photo("photo-1503951914875-452162b0f3f1"), photo("photo-1585747860715-2ba37e788b70")],
  },
  {
    serviceName: "Designer Bridal Lehenga",
    category: c6,
    description: "Hand-embroidered bridal lehenga with dupatta and custom fitting across three trial sessions.",
    price: 55000,
    location: "Dhaka",
    images: [photo("photo-1583939003579-730e3918a45a"), photo("photo-1595777457583-95e059d581b8"), photo("photo-1566174053879-31528523f8ae")],
  },
  {
    serviceName: "Groom Sherwani Collection",
    category: c6,
    description: "Tailored sherwani with matching churidar, stole and accessories for the wedding day.",
    price: 38000,
    location: "Cox's Bazar",
    images: [photo("photo-1593030761757-71fae45fa0e7"), photo("photo-1617137968427-85924c800a22")],
  },
];

const MODERATION = [
  {
    serviceName: "Destination Wedding Planning",
    category: c2,
    description: "Full destination wedding planning package for an intimate beach ceremony.",
    price: 300000,
    location: "Cox's Bazar",
    images: [photo("photo-1507525428034-b723cf961d3e"), photo("photo-1533105079780-92b9be482077")],
    status: "pending",
    vendorIndex: 0,
  },
  {
    serviceName: "Luxury Floral Package",
    category: c3,
    description: "Premium imported-flower arrangement for a grand stage and reception.",
    price: 150000,
    location: "Sylhet",
    images: [photo("photo-1490750967868-88aa4486c946"), photo("photo-1457089328109-e5d9bd499191")],
    status: "pending",
    vendorIndex: 1,
  },
  {
    serviceName: "Outdoor Lawn Venue",
    category: c2,
    description: "Open lawn venue proposal for up to 150 guests with a temporary canopy.",
    price: 90000,
    location: "Dhaka",
    images: [photo("photo-1470071459604-3b5ec3a7fe05"), photo("photo-1441974231531-c6227db76b6e")],
    status: "rejected",
    vendorIndex: 0,
  },
];

const mongo = new MongoClient(process.env.MONGODB_URI);

try {
  await mongo.connect();
  const db = mongo.db(process.env.DB_NAME || undefined);
  const users = await db.collection("users").find({ email: { $in: emails } }).toArray();
  const byEmail = new Map(users.map((u) => [u.email, u]));
  const vendors = emails.map((email) => byEmail.get(email));
  const missing = emails.filter((_, i) => !vendors[i]);

  if (missing.length) {
    console.error(`Vendor account(s) not found: ${missing.join(", ")}`);
    process.exitCode = 1;
  } else if (vendors.some((v) => v.role !== "vendor")) {
    console.error("All supplied accounts must have role=vendor.");
    process.exitCode = 1;
  } else {
    const templates = [
      ...APPROVED.map((item, i) => ({ ...item, status: "approved", vendorIndex: i % vendors.length })),
      ...MODERATION,
    ];

    let inserted = 0;
    let skipped = 0;
    const byStatus = {};

    for (const { vendorIndex, ...item } of templates) {
      const vendor = vendors[vendorIndex % vendors.length];
      const doc = { ...item, vendorId: vendor._id, isActive: true, createdAt: new Date() };
      const result = await db.collection("services").updateOne(
        { vendorId: vendor._id, serviceName: item.serviceName },
        { $setOnInsert: doc },
        { upsert: true }
      );
      if (result.upsertedCount) {
        inserted += 1;
        byStatus[item.status] = (byStatus[item.status] || 0) + 1;
      } else {
        skipped += 1;
      }
    }

    console.log(`Seeded services: ${inserted} inserted, ${skipped} already existed.`);
    console.log(`By status: ${JSON.stringify(byStatus)}`);
  }
} finally {
  await mongo.close();
}
