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
  type Setting,
} from "@shared/schema";

export const storage = {
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(sql`LOWER(${users.email}) = LOWER(${email})`);
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

  async updatePushToken(userId: string, pushToken: string): Promise<void> {
    await db.update(users).set({ pushToken }).where(eq(users.id, userId));
  },

  async getAllPushTokens(): Promise<string[]> {
    const result = await db.select({ pushToken: users.pushToken }).from(users);
    return result.filter((r) => r.pushToken).map((r) => r.pushToken as string);
  },

  async getListings(filters?: {
    status?: string;
    powerType?: string;
    category?: string;
    search?: string;
    listingType?: string;
    pallet?: string;
  }): Promise<Listing[]> {
    const conditions: any[] = [];

    if (filters?.listingType) {
      conditions.push(eq(listings.listingType, filters.listingType));
    }
    if (filters?.status) {
      conditions.push(eq(listings.status, filters.status as any));
    }
    if (filters?.powerType) {
      conditions.push(eq(listings.powerType, filters.powerType as any));
    }
    if (filters?.category) {
      conditions.push(eq(listings.category, filters.category as any));
    }
    if (filters?.pallet) {
      conditions.push(ilike(listings.palletName, filters.pallet));
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

  async getDistinctPallets(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ palletName: listings.palletName })
      .from(listings)
      .where(sql`${listings.palletName} IS NOT NULL AND ${listings.palletName} != ''`)
      .orderBy(listings.palletName);
    return rows.map((r) => r.palletName as string).filter(Boolean);
  },

  async setPalletCost(palletName: string, cost: string): Promise<number> {
    const result = await db
      .update(listings)
      .set({ palletCost: cost, updatedAt: new Date() })
      .where(sql`${listings.palletName} = ${palletName}`);
    return (result as any).rowCount ?? 0;
  },

  async distributePalletCost(palletName: string): Promise<number> {
    const items = await db
      .select()
      .from(listings)
      .where(sql`${listings.palletName} = ${palletName}`);
    if (items.length === 0) return 0;
    const palletCostStr = items.find((i) => i.palletCost != null)?.palletCost;
    if (!palletCostStr) return 0;
    const palletCost = parseFloat(palletCostStr);
    const costPerItem = (palletCost / items.length).toFixed(2);
    await db
      .update(listings)
      .set({ cost: costPerItem, updatedAt: new Date() })
      .where(sql`${listings.palletName} = ${palletName}`);
    return items.length;
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
    await db.delete(inquiries).where(eq(inquiries.listingId, id));
    await db.update(sales).set({ listingId: null }).where(eq(sales.listingId, id));
    await db.delete(listings).where(eq(listings.id, id));
  },

  async getPublishedListings(listingType?: string): Promise<Listing[]> {
    const conditions = [
      eq(listings.isPublished, true),
      eq(listings.status, "AVAILABLE"),
      sql`${listings.quantity} > 0`,
    ];
    if (listingType) {
      conditions.push(eq(listings.listingType, listingType) as any);
    }
    return db
      .select()
      .from(listings)
      .where(and(...conditions))
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

  async getSaleById(id: string): Promise<Sale | undefined> {
    const [sale] = await db.select().from(sales).where(eq(sales.id, id));
    return sale;
  },

  async updateSale(id: string, data: Partial<InsertSale>): Promise<Sale> {
    const [sale] = await db.update(sales).set(data).where(eq(sales.id, id)).returning();
    return sale;
  },

  async deleteSale(id: string): Promise<void> {
    await db.delete(sales).where(eq(sales.id, id));
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

  async updateFollowUp(id: string, data: Partial<InsertFollowUp>): Promise<FollowUp> {
    const [followUp] = await db
      .update(followUps)
      .set(data)
      .where(eq(followUps.id, id))
      .returning();
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

  async uncompleteFollowUp(id: string): Promise<FollowUp> {
    const [followUp] = await db
      .update(followUps)
      .set({ isCompleted: false, completedAt: null })
      .where(eq(followUps.id, id))
      .returning();
    return followUp;
  },

  async deleteFollowUp(id: string): Promise<void> {
    await db.delete(followUps).where(eq(followUps.id, id));
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

  async markInquiryUnread(id: string): Promise<Inquiry> {
    const [inquiry] = await db
      .update(inquiries)
      .set({ isRead: false })
      .where(eq(inquiries.id, id))
      .returning();
    return inquiry;
  },

  async archiveInquiry(id: string): Promise<Inquiry> {
    const [inquiry] = await db
      .update(inquiries)
      .set({ isArchived: true, isRead: true })
      .where(eq(inquiries.id, id))
      .returning();
    return inquiry;
  },

  async unarchiveInquiry(id: string): Promise<Inquiry> {
    const [inquiry] = await db
      .update(inquiries)
      .set({ isArchived: false })
      .where(eq(inquiries.id, id))
      .returning();
    return inquiry;
  },

  async deleteInquiry(id: string): Promise<void> {
    await db.delete(inquiries).where(eq(inquiries.id, id));
  },

  async getMeetupSpots(): Promise<MeetupSpot[]> {
    return db.select().from(meetupSpots);
  },

  async createMeetupSpot(data: InsertMeetupSpot): Promise<MeetupSpot> {
    const [spot] = await db.insert(meetupSpots).values(data).returning();
    return spot;
  },

  async updateMeetupSpot(id: string, data: Partial<InsertMeetupSpot>): Promise<MeetupSpot> {
    const [spot] = await db
      .update(meetupSpots)
      .set(data)
      .where(eq(meetupSpots.id, id))
      .returning();
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

  async updateMessageTemplate(id: string, data: Partial<InsertMessageTemplate>): Promise<MessageTemplate> {
    const [template] = await db
      .update(messageTemplates)
      .set(data)
      .where(eq(messageTemplates.id, id))
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

  async getAllSettings(): Promise<Setting[]> {
    return db.select().from(settings);
  },

  async deleteSetting(key: string): Promise<void> {
    await db.delete(settings).where(eq(settings.key, key));
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
    salesTodayCount: number;
    revenueToday: number;
    itemsListedToday: number;
    inquiriesToday: number;
    salesThisWeekCount: number;
    revenueThisWeek: number;
    salesLastWeekCount: number;
    revenueLastWeek: number;
    avgSalePrice7d: number;
    topCategories: { name: string; count: number }[];
    dailySales: { date: string; revenue: number; count: number }[];
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

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const salesToday = allSales.filter((s) => new Date(s.soldAt) >= todayStart);
    const revenueToday = salesToday.reduce((sum, s) => sum + parseFloat(s.salePrice), 0);
    const itemsListedToday = allListings.filter((l) => new Date(l.createdAt) >= todayStart).length;

    const inquiriesToday = await db.select().from(inquiries);
    const inquiriesTodayCount = inquiriesToday.filter((i) => new Date(i.createdAt) >= todayStart).length;

    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const lastWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    const salesThisWeek = allSales.filter((s) => new Date(s.soldAt) >= weekStart);
    const salesLastWeek = allSales.filter((s) => {
      const d = new Date(s.soldAt);
      return d >= lastWeekStart && d < weekStart;
    });
    const revenueThisWeek = salesThisWeek.reduce((sum, s) => sum + parseFloat(s.salePrice), 0);
    const revenueLastWeek = salesLastWeek.reduce((sum, s) => sum + parseFloat(s.salePrice), 0);

    const avgSalePrice7d = sales7d.length > 0 ? revenue7d / sales7d.length : 0;

    const categoryCounts: Record<string, number> = {};
    for (const sale of sales30d) {
      const listing = allListings.find((l) => l.id === sale.listingId);
      if (listing) {
        categoryCounts[listing.category] = (categoryCounts[listing.category] || 0) + 1;
      }
    }
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const dailySales: { date: string; revenue: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const daySales = allSales.filter((s) => {
        const d = new Date(s.soldAt);
        return d >= dayStart && d < dayEnd;
      });
      dailySales.push({
        date: dayStart.toISOString().slice(0, 10),
        revenue: daySales.reduce((sum, s) => sum + parseFloat(s.salePrice), 0),
        count: daySales.length,
      });
    }

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
      salesTodayCount: salesToday.length,
      revenueToday,
      itemsListedToday,
      inquiriesToday: inquiriesTodayCount,
      salesThisWeekCount: salesThisWeek.length,
      revenueThisWeek,
      salesLastWeekCount: salesLastWeek.length,
      revenueLastWeek,
      avgSalePrice7d,
      topCategories,
      dailySales,
    };
  },

  async getSalesAnalytics() {
    const allSales = await db.select().from(sales);
    const allListings = await db.select().from(listings);
    const allBuyers = await db.select().from(buyers);

    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const sales7d = allSales.filter((s) => new Date(s.soldAt) >= d7);
    const sales30d = allSales.filter((s) => new Date(s.soldAt) >= d30);
    const sales90d = allSales.filter((s) => new Date(s.soldAt) >= d90);

    function calcRevenue(arr: typeof allSales) {
      return arr.reduce((sum, s) => sum + parseFloat(s.salePrice), 0);
    }
    function calcProfit(arr: typeof allSales) {
      return arr.reduce((sum, s) => {
        const listing = allListings.find((l) => l.id === s.listingId);
        const cost = listing?.cost ? parseFloat(listing.cost) : 0;
        return sum + parseFloat(s.salePrice) - cost;
      }, 0);
    }

    const avgSalePrice = allSales.length > 0
      ? allSales.reduce((sum, s) => sum + parseFloat(s.salePrice), 0) / allSales.length
      : 0;

    const categoryBreakdown: Record<string, { count: number; revenue: number }> = {};
    for (const sale of allSales) {
      const listing = allListings.find((l) => l.id === sale.listingId);
      const cat = listing?.category || "OTHER";
      if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { count: 0, revenue: 0 };
      categoryBreakdown[cat].count += 1;
      categoryBreakdown[cat].revenue += parseFloat(sale.salePrice);
    }

    const paymentBreakdown: Record<string, number> = {};
    for (const sale of allSales) {
      const pt = sale.paymentType || "CASH";
      paymentBreakdown[pt] = (paymentBreakdown[pt] || 0) + 1;
    }

    const weeklyTrend: { week: string; revenue: number; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekSales = allSales.filter((s) => {
        const d = new Date(s.soldAt);
        return d >= weekStart && d < weekEnd;
      });
      weeklyTrend.push({
        week: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        revenue: calcRevenue(weekSales),
        count: weekSales.length,
      });
    }

    const topBuyers: { id: string; name: string; totalSpent: number; count: number }[] = [];
    const buyerTotals: Record<string, { totalSpent: number; count: number }> = {};
    for (const sale of allSales) {
      if (!sale.buyerId) continue;
      if (!buyerTotals[sale.buyerId]) buyerTotals[sale.buyerId] = { totalSpent: 0, count: 0 };
      buyerTotals[sale.buyerId].totalSpent += parseFloat(sale.salePrice);
      buyerTotals[sale.buyerId].count += 1;
    }
    for (const [buyerId, totals] of Object.entries(buyerTotals)) {
      const buyer = allBuyers.find((b) => b.id === buyerId);
      topBuyers.push({
        id: buyerId,
        name: buyer?.name || buyer?.phone || "Unknown",
        ...totals,
      });
    }
    topBuyers.sort((a, b) => b.totalSpent - a.totalSpent);

    return {
      totalSales: allSales.length,
      totalRevenue: calcRevenue(allSales),
      totalProfit: calcProfit(allSales),
      avgSalePrice,
      revenue7d: calcRevenue(sales7d),
      revenue30d: calcRevenue(sales30d),
      revenue90d: calcRevenue(sales90d),
      profit7d: calcProfit(sales7d),
      profit30d: calcProfit(sales30d),
      profit90d: calcProfit(sales90d),
      count7d: sales7d.length,
      count30d: sales30d.length,
      count90d: sales90d.length,
      categoryBreakdown,
      paymentBreakdown,
      weeklyTrend,
      topBuyers: topBuyers.slice(0, 5),
    };
  },

};
