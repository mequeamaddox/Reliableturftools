import { db } from "./db";
import { eq, desc, and, sql, ilike, or, gte } from "drizzle-orm";
import {
  users,
  listings,
  buyers,
  sales,
  followUps,
  inquiries,
  meetupSpots,
  messageTemplates,
  settings,
  type User,
  type InsertUser,
  type Listing,
  type InsertListing,
  type Buyer,
  type InsertBuyer,
  type Sale,
  type InsertSale,
  type FollowUp,
  type InsertFollowUp,
  type Inquiry,
  type InsertInquiry,
  type MeetupSpot,
  type InsertMeetupSpot,
  type MessageTemplate,
  type InsertMessageTemplate,
} from "@shared/schema";

export const storage = {
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  },

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  async createUser(data: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  },

  async getListings(filters?: {
    status?: string;
    powerType?: string;
    category?: string;
    search?: string;
  }): Promise<Listing[]> {
    let query = db.select().from(listings);
    const conditions: any[] = [];

    if (filters?.status) {
      conditions.push(eq(listings.status, filters.status as any));
    }
    if (filters?.powerType) {
      conditions.push(eq(listings.powerType, filters.powerType as any));
    }
    if (filters?.category) {
      conditions.push(eq(listings.category, filters.category as any));
    }
    if (filters?.search) {
      conditions.push(
        or(
          ilike(listings.title, `%${filters.search}%`),
          ilike(listings.sku, `%${filters.search}%`),
          ilike(listings.barcode ?? "", `%${filters.search}%`),
          ilike(listings.brand ?? "", `%${filters.search}%`),
        ),
      );
    }

    if (conditions.length > 0) {
      return db
        .select()
        .from(listings)
        .where(and(...conditions))
        .orderBy(desc(listings.createdAt));
    }
    return db.select().from(listings).orderBy(desc(listings.createdAt));
  },

  async getListingById(id: string): Promise<Listing | undefined> {
    const [listing] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, id));
    return listing;
  },

  async getListingByBarcode(barcode: string): Promise<Listing | undefined> {
    const [listing] = await db
      .select()
      .from(listings)
      .where(eq(listings.barcode, barcode));
    return listing;
  },

  async createListing(data: InsertListing): Promise<Listing> {
    const [listing] = await db.insert(listings).values(data).returning();
    return listing;
  },

  async updateListing(
    id: string,
    data: Partial<InsertListing>,
  ): Promise<Listing> {
    const [listing] = await db
      .update(listings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(listings.id, id))
      .returning();
    return listing;
  },

  async deleteListing(id: string): Promise<void> {
    await db.delete(listings).where(eq(listings.id, id));
  },

  async getPublishedListings(): Promise<Listing[]> {
    return db
      .select()
      .from(listings)
      .where(
        and(
          eq(listings.isPublished, true),
          eq(listings.status, "AVAILABLE"),
          sql`${listings.quantity} > 0`,
        ),
      )
      .orderBy(desc(listings.createdAt));
  },

  async getBuyers(): Promise<Buyer[]> {
    return db.select().from(buyers).orderBy(desc(buyers.createdAt));
  },

  async getBuyerById(id: string): Promise<Buyer | undefined> {
    const [buyer] = await db.select().from(buyers).where(eq(buyers.id, id));
    return buyer;
  },

  async getBuyerByPhone(phone: string): Promise<Buyer | undefined> {
    const [buyer] = await db
      .select()
      .from(buyers)
      .where(eq(buyers.phone, phone));
    return buyer;
  },

  async createBuyer(data: InsertBuyer): Promise<Buyer> {
    const [buyer] = await db.insert(buyers).values(data).returning();
    return buyer;
  },

  async updateBuyer(id: string, data: Partial<InsertBuyer>): Promise<Buyer> {
    const [buyer] = await db
      .update(buyers)
      .set(data)
      .where(eq(buyers.id, id))
      .returning();
    return buyer;
  },

  async getSales(): Promise<Sale[]> {
    return db.select().from(sales).orderBy(desc(sales.soldAt));
  },

  async getSalesByBuyer(buyerId: string): Promise<Sale[]> {
    return db
      .select()
      .from(sales)
      .where(eq(sales.buyerId, buyerId))
      .orderBy(desc(sales.soldAt));
  },

  async createSale(data: InsertSale): Promise<Sale> {
    const [sale] = await db.insert(sales).values(data).returning();
    return sale;
  },

  async getFollowUps(includeCompleted = false): Promise<FollowUp[]> {
    if (includeCompleted) {
      return db.select().from(followUps).orderBy(desc(followUps.createdAt));
    }
    return db
      .select()
      .from(followUps)
      .where(eq(followUps.isCompleted, false))
      .orderBy(desc(followUps.createdAt));
  },

  async getFollowUpsByBuyer(buyerId: string): Promise<FollowUp[]> {
    return db
      .select()
      .from(followUps)
      .where(eq(followUps.buyerId, buyerId))
      .orderBy(desc(followUps.createdAt));
  },

  async createFollowUp(data: InsertFollowUp): Promise<FollowUp> {
    const [followUp] = await db.insert(followUps).values(data).returning();
    return followUp;
  },

  async completeFollowUp(id: string): Promise<FollowUp> {
    const [followUp] = await db
      .update(followUps)
      .set({ isCompleted: true, completedAt: new Date() })
      .where(eq(followUps.id, id))
      .returning();
    return followUp;
  },

  async getInquiries(): Promise<Inquiry[]> {
    return db.select().from(inquiries).orderBy(desc(inquiries.createdAt));
  },

  async createInquiry(data: InsertInquiry): Promise<Inquiry> {
    const [inquiry] = await db.insert(inquiries).values(data).returning();
    return inquiry;
  },

  async markInquiryRead(id: string): Promise<Inquiry> {
    const [inquiry] = await db
      .update(inquiries)
      .set({ isRead: true })
      .where(eq(inquiries.id, id))
      .returning();
    return inquiry;
  },

  async getMeetupSpots(): Promise<MeetupSpot[]> {
    return db.select().from(meetupSpots);
  },

  async createMeetupSpot(data: InsertMeetupSpot): Promise<MeetupSpot> {
    const [spot] = await db.insert(meetupSpots).values(data).returning();
    return spot;
  },

  async deleteMeetupSpot(id: string): Promise<void> {
    await db.delete(meetupSpots).where(eq(meetupSpots.id, id));
  },

  async getMessageTemplates(): Promise<MessageTemplate[]> {
    return db.select().from(messageTemplates);
  },

  async createMessageTemplate(
    data: InsertMessageTemplate,
  ): Promise<MessageTemplate> {
    const [template] = await db
      .insert(messageTemplates)
      .values(data)
      .returning();
    return template;
  },

  async deleteMessageTemplate(id: string): Promise<void> {
    await db.delete(messageTemplates).where(eq(messageTemplates.id, id));
  },

  async getSetting(key: string): Promise<string | undefined> {
    const [setting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key));
    return setting?.value;
  },

  async setSetting(key: string, value: string): Promise<void> {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  },

  async getDashboardStats(): Promise<{
    revenue7d: number;
    revenue30d: number;
    profit7d: number;
    profit30d: number;
    totalAvailable: number;
    totalPending: number;
    totalSold: number;
    totalArchived: number;
    recentSales: Sale[];
    pendingInquiries: number;
    pendingFollowUps: number;
  }> {
    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const allSales = await db.select().from(sales);
    const allListings = await db.select().from(listings);
    const allInquiries = await db
      .select()
      .from(inquiries)
      .where(eq(inquiries.isRead, false));
    const allFollowUps = await db
      .select()
      .from(followUps)
      .where(eq(followUps.isCompleted, false));

    const sales7d = allSales.filter((s) => new Date(s.soldAt) >= d7);
    const sales30d = allSales.filter((s) => new Date(s.soldAt) >= d30);

    const revenue7d = sales7d.reduce(
      (sum, s) => sum + parseFloat(s.salePrice),
      0,
    );
    const revenue30d = sales30d.reduce(
      (sum, s) => sum + parseFloat(s.salePrice),
      0,
    );

    let profit7d = 0;
    let profit30d = 0;
    for (const sale of sales7d) {
      const listing = allListings.find((l) => l.id === sale.listingId);
      const cost = listing?.cost ? parseFloat(listing.cost) : 0;
      profit7d += parseFloat(sale.salePrice) - cost;
    }
    for (const sale of sales30d) {
      const listing = allListings.find((l) => l.id === sale.listingId);
      const cost = listing?.cost ? parseFloat(listing.cost) : 0;
      profit30d += parseFloat(sale.salePrice) - cost;
    }

    const totalAvailable = allListings.filter(
      (l) => l.status === "AVAILABLE",
    ).length;
    const totalPending = allListings.filter(
      (l) => l.status === "PENDING",
    ).length;
    const totalSold = allListings.filter((l) => l.status === "SOLD").length;
    const totalArchived = allListings.filter(
      (l) => l.status === "ARCHIVED",
    ).length;

    const recentSales = allSales
      .sort(
        (a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime(),
      )
      .slice(0, 5);

    return {
      revenue7d,
      revenue30d,
      profit7d,
      profit30d,
      totalAvailable,
      totalPending,
      totalSold,
      totalArchived,
      recentSales,
      pendingInquiries: allInquiries.length,
      pendingFollowUps: allFollowUps.length,
    };
  },
};
