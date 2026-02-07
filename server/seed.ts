import bcrypt from "bcryptjs";
import { db } from "./db";
import {
  users,
  listings,
  buyers,
  sales,
  followUps,
  meetupSpots,
  messageTemplates,
  settings,
} from "@shared/schema";

async function seed() {
  console.log("Seeding database...");

  const hashedPw = await bcrypt.hash("password123", 10);
  const [admin] = await db
    .insert(users)
    .values({ email: "demo@reliable.com", password: hashedPw })
    .onConflictDoNothing()
    .returning();

  if (!admin) {
    console.log("Admin user already exists, skipping seed.");
    return;
  }

  const spots = await db
    .insert(meetupSpots)
    .values([
      { label: "Walmart Parking - Main St", address: "123 Main St" },
      { label: "Target Parking - Oak Ave", address: "456 Oak Ave" },
      { label: "Home Depot Lot - West", address: "789 West Blvd" },
      { label: "Police Station Lobby", address: "100 Safety Dr" },
      { label: "Gas Station - Highway 9", address: "901 Hwy 9" },
      { label: "Library Parking Lot", address: "222 Book Ln" },
      { label: "Fire Station #3", address: "333 Rescue Rd" },
      { label: "Community Center", address: "444 Center Ave" },
      { label: "Bank Parking - Downtown", address: "555 Money St" },
      { label: "Post Office - Elm St", address: "666 Elm St" },
    ])
    .returning();

  const listingData = [
    {
      title: "EGO 56V Trimmer",
      sku: "TRM-001",
      condition: "USED" as const,
      powerType: "ELECTRIC_40V" as const,
      category: "TRIMMER" as const,
      brand: "EGO",
      price: "89.99",
      cost: "45.00",
      quantity: 1,
      status: "AVAILABLE" as const,
      isPublished: true,
      notes: "Works great, minor cosmetic wear",
    },
    {
      title: "Husqvarna 525L Trimmer",
      sku: "TRM-002",
      condition: "NEW_BOXED" as const,
      powerType: "GAS" as const,
      category: "TRIMMER" as const,
      brand: "Husqvarna",
      price: "249.99",
      cost: "180.00",
      quantity: 1,
      status: "AVAILABLE" as const,
      isPublished: true,
    },
    {
      title: "Stihl BR600 Backpack Blower",
      sku: "BLW-001",
      condition: "USED" as const,
      powerType: "GAS" as const,
      category: "BLOWER" as const,
      brand: "Stihl",
      price: "329.99",
      cost: "200.00",
      quantity: 1,
      status: "AVAILABLE" as const,
      isPublished: true,
      notes: "Runs strong, just serviced",
    },
    {
      title: "EGO 580 CFM Blower",
      sku: "BLW-002",
      condition: "USED_UNBOXED" as const,
      powerType: "ELECTRIC_40V" as const,
      category: "BLOWER" as const,
      brand: "EGO",
      price: "149.99",
      cost: "90.00",
      quantity: 2,
      status: "AVAILABLE" as const,
      isPublished: true,
    },
    {
      title: "Honda HRX217 Mower",
      sku: "MWR-001",
      condition: "USED" as const,
      powerType: "GAS" as const,
      category: "MOWER" as const,
      brand: "Honda",
      price: "449.99",
      cost: "280.00",
      quantity: 1,
      status: "PENDING" as const,
      isPublished: false,
    },
    {
      title: "EGO 21in Self-Propelled Mower",
      sku: "MWR-002",
      condition: "NEW_BOXED" as const,
      powerType: "ELECTRIC_40V" as const,
      category: "MOWER" as const,
      brand: "EGO",
      price: "549.99",
      cost: "400.00",
      quantity: 1,
      status: "AVAILABLE" as const,
      isPublished: true,
    },
    {
      title: "Stihl MS250 Chainsaw",
      sku: "CSW-001",
      condition: "USED" as const,
      powerType: "GAS" as const,
      category: "CHAINSAW" as const,
      brand: "Stihl",
      price: "199.99",
      cost: "120.00",
      quantity: 1,
      status: "SOLD" as const,
      isPublished: false,
    },
    {
      title: "EGO 5.0Ah Battery",
      sku: "BAT-001",
      condition: "NEW_BOXED" as const,
      powerType: "ELECTRIC_40V" as const,
      category: "BATTERY" as const,
      brand: "EGO",
      price: "149.99",
      cost: "100.00",
      quantity: 3,
      status: "AVAILABLE" as const,
      isPublished: true,
    },
    {
      title: "EGO Rapid Charger",
      sku: "CHG-001",
      condition: "NEW_BOXED" as const,
      powerType: "ELECTRIC_40V" as const,
      category: "CHARGER" as const,
      brand: "EGO",
      price: "69.99",
      cost: "40.00",
      quantity: 2,
      status: "AVAILABLE" as const,
      isPublished: true,
    },
    {
      title: "Echo SRM-225 Trimmer",
      sku: "TRM-003",
      condition: "DAMAGED" as const,
      powerType: "GAS" as const,
      category: "TRIMMER" as const,
      brand: "Echo",
      price: "49.99",
      cost: "15.00",
      quantity: 1,
      status: "ARCHIVED" as const,
      isPublished: false,
      notes: "Needs carburetor rebuild",
    },
  ];

  const createdListings = await db
    .insert(listings)
    .values(listingData)
    .returning();

  const buyerData = [
    {
      name: "Mike Johnson",
      phone: "555-0101",
      tags: ["GOOD_BUYER", "REPEAT_BUYER"],
      preferredMeetupSpot: spots[0].label,
    },
    {
      name: "Sarah Williams",
      phone: "555-0102",
      tags: ["GOOD_BUYER"],
      preferredMeetupSpot: spots[1].label,
    },
    {
      name: "Tom Davis",
      phone: "555-0103",
      tags: ["FLAKE_RISK"],
      notes: "Ghosted twice, be cautious",
    },
    {
      name: "Lisa Chen",
      phone: "555-0104",
      tags: ["REPEAT_BUYER", "GOOD_BUYER"],
      preferredMeetupSpot: spots[3].label,
    },
  ];

  const createdBuyers = await db.insert(buyers).values(buyerData).returning();

  await db.insert(sales).values([
    {
      buyerId: createdBuyers[0].id,
      listingId: createdListings[6].id,
      salePrice: "189.99",
      paymentType: "CASH" as const,
      meetupSpot: spots[0].label,
      soldAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      buyerId: createdBuyers[3].id,
      listingId: createdListings[0].id,
      salePrice: "85.00",
      paymentType: "ZELLE" as const,
      meetupSpot: spots[3].label,
      soldAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
  ]);

  await db.insert(followUps).values([
    {
      buyerId: createdBuyers[0].id,
      type: "CHECK_IN" as const,
      message: "Hey Mike! Hope the chainsaw is treating you well. Let me know if you need anything else!",
      isCompleted: false,
    },
    {
      buyerId: createdBuyers[3].id,
      type: "NEW_INVENTORY" as const,
      message: "Hey Lisa! Just got some new EGO batteries in stock. Thought you might be interested since you got the trimmer!",
      isCompleted: false,
    },
    {
      buyerId: createdBuyers[1].id,
      type: "MEETUP_REMINDER" as const,
      message: "Hi Sarah! Just confirming our meetup tomorrow at Target parking lot for the blower. See you at 2pm!",
      isCompleted: true,
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  ]);

  await db.insert(messageTemplates).values([
    {
      name: "New Inventory Alert",
      template:
        "Hey {buyer_name}! Just got a {listing_title} in stock. Thought you might be interested! Let me know if you want to check it out.",
      type: "NEW_INVENTORY" as const,
    },
    {
      name: "Meetup Reminder",
      template:
        "Hi {buyer_name}! Just confirming our meetup at {meetup_spot} for the {listing_title}. See you there!",
      type: "MEETUP_REMINDER" as const,
    },
    {
      name: "Monthly Check-In",
      template:
        "Hey {buyer_name}! Hope everything is going well with your {listing_title}. Let me know if you need anything else!",
      type: "CHECK_IN" as const,
    },
  ]);

  await db
    .insert(settings)
    .values([
      { key: "business_name", value: "Reliable Turf Tools" },
    ])
    .onConflictDoNothing();

  console.log("Seed completed!");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
