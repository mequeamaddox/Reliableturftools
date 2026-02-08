import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const DEFAULT_CONDITIONS = ["NEW_BOXED", "USED_UNBOXED", "USED", "DAMAGED"];
export const DEFAULT_POWER_TYPES = ["GAS", "ELECTRIC_18V", "ELECTRIC_40V", "OTHER"];
export const DEFAULT_CATEGORIES = ["TRIMMER", "BLOWER", "MOWER", "CHAINSAW", "BATTERY", "CHARGER", "OTHER"];
export const DEFAULT_PAYMENT_TYPES = ["CASH", "CASHAPP", "ZELLE", "VENMO", "OFFERUP", "FACEBOOK", "OTHER"];
export const DEFAULT_LEAD_SOURCES = ["OFFERUP", "FACEBOOK", "WORD_OF_MOUTH", "RANDOM_MEETUP", "CRAIGSLIST", "OTHER"];

export const listingStatusEnum = pgEnum("listing_status", [
  "AVAILABLE",
  "PENDING",
  "SOLD",
  "ARCHIVED",
]);


export const followUpTypeEnum = pgEnum("follow_up_type", [
  "NEW_INVENTORY",
  "BACK_IN_STOCK",
  "MEETUP_REMINDER",
  "CHECK_IN",
  "CUSTOM",
]);

export const buyerTagEnum = pgEnum("buyer_tag", [
  "REPEAT_BUYER",
  "FLAKE_RISK",
  "GOOD_BUYER",
]);

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  pushToken: text("push_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const listings = pgTable("listings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  sku: text("sku"),
  barcode: text("barcode"),
  condition: text("condition").notNull().default("USED"),
  powerType: text("power_type").notNull().default("GAS"),
  category: text("category").notNull().default("OTHER"),
  brand: text("brand"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  quantity: integer("quantity").notNull().default(1),
  status: listingStatusEnum("status").notNull().default("AVAILABLE"),
  notes: text("notes"),
  isPublished: boolean("is_published").notNull().default(false),
  photos: text("photos")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const buyers = pgTable("buyers", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name"),
  phone: text("phone").notNull().unique(),
  notes: text("notes"),
  tags: text("tags")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  preferredMeetupSpot: text("preferred_meetup_spot"),
  leadSource: text("lead_source"),
  lastContactedAt: timestamp("last_contacted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sales = pgTable("sales", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  buyerId: varchar("buyer_id").references(() => buyers.id),
  listingId: varchar("listing_id").references(() => listings.id),
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }).notNull(),
  paymentType: text("payment_type").notNull().default("CASH"),
  meetupSpot: text("meetup_spot"),
  leadSource: text("lead_source"),
  notes: text("notes"),
  soldAt: timestamp("sold_at").defaultNow().notNull(),
});

export const followUps = pgTable("follow_ups", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  buyerId: varchar("buyer_id").references(() => buyers.id),
  type: followUpTypeEnum("type").notNull(),
  message: text("message"),
  isCompleted: boolean("is_completed").notNull().default(false),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const inquiries = pgTable("inquiries", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  listingId: varchar("listing_id").references(() => listings.id),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  message: text("message"),
  isRead: boolean("is_read").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const meetupSpots = pgTable("meetup_spots", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  label: text("label").notNull(),
  address: text("address"),
  isDefault: boolean("is_default").notNull().default(false),
});

export const messageTemplates = pgTable("message_templates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  template: text("template").notNull(),
  type: followUpTypeEnum("type").notNull(),
});

export const settings = pgTable("settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
});
export const insertListingSchema = createInsertSchema(listings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertBuyerSchema = createInsertSchema(buyers).omit({
  id: true,
  createdAt: true,
});
export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  soldAt: true,
});
export const insertFollowUpSchema = createInsertSchema(followUps).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});
export const insertInquirySchema = createInsertSchema(inquiries).omit({
  id: true,
  createdAt: true,
  isRead: true,
});
export const insertMeetupSpotSchema = createInsertSchema(meetupSpots).omit({
  id: true,
});
export const insertMessageTemplateSchema = createInsertSchema(
  messageTemplates,
).omit({ id: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Buyer = typeof buyers.$inferSelect;
export type InsertBuyer = z.infer<typeof insertBuyerSchema>;
export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type FollowUp = typeof followUps.$inferSelect;
export type InsertFollowUp = z.infer<typeof insertFollowUpSchema>;
export type Inquiry = typeof inquiries.$inferSelect;
export type InsertInquiry = z.infer<typeof insertInquirySchema>;
export type MeetupSpot = typeof meetupSpots.$inferSelect;
export type InsertMeetupSpot = z.infer<typeof insertMeetupSpotSchema>;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = z.infer<
  typeof insertMessageTemplateSchema
>;
export type Setting = typeof settings.$inferSelect;
