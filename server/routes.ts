import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import session from "express-session";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { DEFAULT_CONDITIONS, DEFAULT_POWER_TYPES, DEFAULT_CATEGORIES, DEFAULT_PAYMENT_TYPES, DEFAULT_LEAD_SOURCES } from "@shared/schema";

const uploadDir = path.resolve(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

async function sendPushNotifications(tokens: string[], title: string, body: string, data?: Record<string, string>) {
  const messages = tokens.map((token) => ({
    to: token,
    sound: "default" as const,
    title,
    body,
    data: data || {},
  }));
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error("Push notification error:", err);
  }
}

async function generateSku(category: string): Promise<string> {
  const catPrefix = (category || "OTH").substring(0, 3).toUpperCase();
  const allListings = await storage.getListings({});
  const existingSkus = allListings
    .map((l: any) => l.sku)
    .filter((s: string) => s && s.startsWith(`RTT-${catPrefix}-`))
    .map((s: string) => parseInt(s.split("-").pop() || "0", 10))
    .filter((n: number) => !isNaN(n));
  const nextNum = existingSkus.length > 0 ? Math.max(...existingSkus) + 1 : 1;
  return `RTT-${catPrefix}-${String(nextNum).padStart(4, "0")}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "reliable-turf-tools-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    }),
  );

  app.use("/uploads", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  }, express_static_uploads());

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      req.session.userId = user.id;
      return res.json({
        id: user.id,
        email: user.email,
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/auth/push-token", requireAuth, async (req: Request, res: Response) => {
    try {
      const { pushToken } = req.body;
      if (!pushToken) return res.status(400).json({ error: "Push token required" });
      await storage.updatePushToken(req.session.userId!, pushToken);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    return res.json({ id: user.id, email: user.email });
  });

  app.get("/api/dashboard", requireAuth, async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getDashboardStats();
      return res.json(stats);
    } catch (err) {
      console.error("Dashboard error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/sales/analytics", requireAuth, async (_req: Request, res: Response) => {
    try {
      const analytics = await storage.getSalesAnalytics();
      return res.json(analytics);
    } catch (err) {
      console.error("Sales analytics error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/listings", requireAuth, async (req: Request, res: Response) => {
    try {
      const { status, powerType, category, search } = req.query;
      const list = await storage.getListings({
        status: status as string,
        powerType: powerType as string,
        category: category as string,
        search: search as string,
      });
      return res.json(list);
    } catch (err) {
      console.error("Listings error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/listings/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const listing = await storage.getListingById(req.params.id);
      if (!listing) return res.status(404).json({ error: "Not found" });
      return res.json(listing);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/listings/barcode/:barcode", requireAuth, async (req: Request, res: Response) => {
    try {
      const listing = await storage.getListingByBarcode(req.params.barcode);
      if (!listing) return res.status(404).json({ error: "Not found" });
      return res.json(listing);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/listings", requireAuth, async (req: Request, res: Response) => {
    try {
      const data = req.body;
      const listing = await storage.createListing(data);
      return res.status(201).json(listing);
    } catch (err) {
      console.error("Create listing error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/listings/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const listing = await storage.updateListing(req.params.id, req.body);
      return res.json(listing);
    } catch (err) {
      console.error("Update listing error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/api/listings/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.deleteListing(req.params.id);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/listings/:id/sell", requireAuth, async (req: Request, res: Response) => {
    try {
      const listing = await storage.getListingById(req.params.id);
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      const { buyerPhone, buyerName, salePrice, paymentType, meetupSpot, leadSource, notes } = req.body;

      let buyer = await storage.getBuyerByPhone(buyerPhone);
      if (!buyer) {
        buyer = await storage.createBuyer({ phone: buyerPhone, name: buyerName, leadSource });
      } else if (leadSource && !buyer.leadSource) {
        await storage.updateBuyer(buyer.id, { leadSource });
      }

      const sale = await storage.createSale({
        buyerId: buyer.id,
        listingId: listing.id,
        salePrice: salePrice || listing.price,
        paymentType: paymentType || "CASH",
        meetupSpot,
        leadSource,
        notes,
      });

      const newQty = Math.max(0, listing.quantity - 1);
      await storage.updateListing(listing.id, {
        quantity: newQty,
        status: newQty === 0 ? "SOLD" : listing.status,
      });

      return res.json({ sale, buyer });
    } catch (err) {
      console.error("Sell error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/upload", requireAuth, upload.array("photos", 10), async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      const urls = files.map((f) => `/uploads/${f.filename}`);
      return res.json({ urls });
    } catch (err) {
      return res.status(500).json({ error: "Upload error" });
    }
  });

  app.get("/api/buyers", requireAuth, async (_req: Request, res: Response) => {
    try {
      const list = await storage.getBuyers();
      const allSales = await storage.getSales();
      const enriched = list.map((b) => {
        const buyerSales = allSales.filter((s) => s.buyerId === b.id);
        return {
          ...b,
          totalPurchases: buyerSales.length,
          totalSpend: buyerSales.reduce(
            (sum, s) => sum + parseFloat(s.salePrice),
            0,
          ),
        };
      });
      return res.json(enriched);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/buyers/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const buyer = await storage.getBuyerById(req.params.id);
      if (!buyer) return res.status(404).json({ error: "Not found" });
      const buyerSales = await storage.getSalesByBuyer(buyer.id);
      const buyerFollowUps = await storage.getFollowUpsByBuyer(buyer.id);
      return res.json({
        ...buyer,
        totalPurchases: buyerSales.length,
        totalSpend: buyerSales.reduce(
          (sum, s) => sum + parseFloat(s.salePrice),
          0,
        ),
        sales: buyerSales,
        followUps: buyerFollowUps,
      });
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/buyers", requireAuth, async (req: Request, res: Response) => {
    try {
      const buyer = await storage.createBuyer(req.body);
      return res.status(201).json(buyer);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/buyers/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const buyer = await storage.updateBuyer(req.params.id, req.body);
      return res.json(buyer);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/sales", requireAuth, async (_req: Request, res: Response) => {
    try {
      const list = await storage.getSales();
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/sales", requireAuth, async (req: Request, res: Response) => {
    try {
      const { listingId, buyerId, salePrice, paymentType, meetupSpot, notes, soldAt } = req.body;
      if (!salePrice) return res.status(400).json({ error: "Sale price is required" });

      const sale = await storage.createSale({
        listingId: listingId || null,
        buyerId: buyerId || null,
        salePrice,
        paymentType: paymentType || "CASH",
        meetupSpot: meetupSpot || null,
        notes: notes || null,
        ...(soldAt ? { soldAt: new Date(soldAt) } : {}),
      });

      if (listingId) {
        const listing = await storage.getListingById(listingId);
        if (listing) {
          const newQty = Math.max(0, listing.quantity - 1);
          await storage.updateListing(listing.id, {
            quantity: newQty,
            status: newQty === 0 ? "SOLD" : listing.status,
          });
        }
      }

      return res.status(201).json(sale);
    } catch (err) {
      console.error("Create sale error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/sales/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const sale = await storage.getSaleById(req.params.id);
      if (!sale) return res.status(404).json({ error: "Sale not found" });
      return res.json(sale);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/sales/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getSaleById(req.params.id);
      if (!existing) return res.status(404).json({ error: "Sale not found" });

      const { listingId, buyerId, salePrice, paymentType, meetupSpot, notes, soldAt } = req.body;
      const sale = await storage.updateSale(req.params.id, {
        ...(listingId !== undefined ? { listingId } : {}),
        ...(buyerId !== undefined ? { buyerId } : {}),
        ...(salePrice !== undefined ? { salePrice } : {}),
        ...(paymentType !== undefined ? { paymentType } : {}),
        ...(meetupSpot !== undefined ? { meetupSpot } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(soldAt ? { soldAt: new Date(soldAt) } : {}),
      });
      return res.json(sale);
    } catch (err) {
      console.error("Update sale error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/api/sales/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getSaleById(req.params.id);
      if (!existing) return res.status(404).json({ error: "Sale not found" });
      await storage.deleteSale(req.params.id);
      return res.json({ success: true });
    } catch (err) {
      console.error("Delete sale error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/followups", requireAuth, async (req: Request, res: Response) => {
    try {
      const includeCompleted = req.query.all === "true";
      const list = await storage.getFollowUps(includeCompleted);
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/followups", requireAuth, async (req: Request, res: Response) => {
    try {
      const followUp = await storage.createFollowUp(req.body);
      return res.status(201).json(followUp);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/followups/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const followUp = await storage.updateFollowUp(req.params.id, req.body);
      return res.json(followUp);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/followups/:id/complete", requireAuth, async (req: Request, res: Response) => {
    try {
      const followUp = await storage.completeFollowUp(req.params.id);
      return res.json(followUp);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/followups/:id/uncomplete", requireAuth, async (req: Request, res: Response) => {
    try {
      const followUp = await storage.uncompleteFollowUp(req.params.id);
      return res.json(followUp);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/api/followups/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.deleteFollowUp(req.params.id);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/inquiries", requireAuth, async (_req: Request, res: Response) => {
    try {
      const list = await storage.getInquiries();
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/inquiries", async (req: Request, res: Response) => {
    try {
      const inquiry = await storage.createInquiry(req.body);

      const tokens = await storage.getAllPushTokens();
      if (tokens.length > 0) {
        sendPushNotifications(
          tokens,
          "New Inquiry",
          `${req.body.name || "Someone"} is interested! "${(req.body.message || "").substring(0, 80)}"`,
          { type: "inquiry", inquiryId: inquiry.id },
        );
      }

      return res.status(201).json(inquiry);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/inquiries/:id/read", requireAuth, async (req: Request, res: Response) => {
    try {
      const inquiry = await storage.markInquiryRead(req.params.id);
      return res.json(inquiry);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/inquiries/:id/unread", requireAuth, async (req: Request, res: Response) => {
    try {
      const inquiry = await storage.markInquiryUnread(req.params.id);
      return res.json(inquiry);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/inquiries/:id/archive", requireAuth, async (req: Request, res: Response) => {
    try {
      const inquiry = await storage.archiveInquiry(req.params.id);
      return res.json(inquiry);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/inquiries/:id/unarchive", requireAuth, async (req: Request, res: Response) => {
    try {
      const inquiry = await storage.unarchiveInquiry(req.params.id);
      return res.json(inquiry);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/api/inquiries/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.deleteInquiry(req.params.id);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/meetup-spots", requireAuth, async (_req: Request, res: Response) => {
    try {
      const list = await storage.getMeetupSpots();
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/meetup-spots", requireAuth, async (req: Request, res: Response) => {
    try {
      const spot = await storage.createMeetupSpot(req.body);
      return res.status(201).json(spot);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/meetup-spots/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const spot = await storage.updateMeetupSpot(req.params.id, req.body);
      return res.json(spot);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/api/meetup-spots/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.deleteMeetupSpot(req.params.id);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/message-templates", requireAuth, async (_req: Request, res: Response) => {
    try {
      const list = await storage.getMessageTemplates();
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/message-templates", requireAuth, async (req: Request, res: Response) => {
    try {
      const template = await storage.createMessageTemplate(req.body);
      return res.status(201).json(template);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/message-templates/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const template = await storage.updateMessageTemplate(req.params.id, req.body);
      return res.json(template);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/api/message-templates/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.deleteMessageTemplate(req.params.id);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/settings", requireAuth, async (_req: Request, res: Response) => {
    try {
      const list = await storage.getAllSettings();
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/settings/:key", requireAuth, async (req: Request, res: Response) => {
    try {
      const value = await storage.getSetting(req.params.key);
      return res.json({ key: req.params.key, value: value || "" });
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/settings/:key", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.setSetting(req.params.key, req.body.value);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/api/settings/:key", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.deleteSetting(req.params.key);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/inventory-options", async (_req: Request, res: Response) => {
    try {
      const conditionsRaw = await storage.getSetting("custom_conditions");
      const powerTypesRaw = await storage.getSetting("custom_power_types");
      const categoriesRaw = await storage.getSetting("custom_categories");
      const paymentTypesRaw = await storage.getSetting("custom_payment_types");
      const leadSourcesRaw = await storage.getSetting("custom_lead_sources");
      return res.json({
        conditions: conditionsRaw ? JSON.parse(conditionsRaw) : DEFAULT_CONDITIONS,
        powerTypes: powerTypesRaw ? JSON.parse(powerTypesRaw) : DEFAULT_POWER_TYPES,
        categories: categoriesRaw ? JSON.parse(categoriesRaw) : DEFAULT_CATEGORIES,
        paymentTypes: paymentTypesRaw ? JSON.parse(paymentTypesRaw) : DEFAULT_PAYMENT_TYPES,
        leadSources: leadSourcesRaw ? JSON.parse(leadSourcesRaw) : DEFAULT_LEAD_SOURCES,
      });
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/inventory-options", requireAuth, async (req: Request, res: Response) => {
    try {
      const { conditions, powerTypes, categories, paymentTypes, leadSources } = req.body;
      if (conditions) await storage.setSetting("custom_conditions", JSON.stringify(conditions));
      if (powerTypes) await storage.setSetting("custom_power_types", JSON.stringify(powerTypes));
      if (categories) await storage.setSetting("custom_categories", JSON.stringify(categories));
      if (paymentTypes) await storage.setSetting("custom_payment_types", JSON.stringify(paymentTypes));
      if (leadSources) await storage.setSetting("custom_lead_sources", JSON.stringify(leadSources));
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/listings/:id/label", requireAuth, async (req: Request, res: Response) => {
    try {
      const listing = await storage.getListingById(req.params.id);
      if (!listing) return res.status(404).json({ error: "Not found" });
      return res.json(listing);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/generate-sku", requireAuth, async (req: Request, res: Response) => {
    try {
      const { category } = req.body;
      const catPrefix = (category || "OTH").substring(0, 3).toUpperCase();
      const allListings = await storage.getListings({});
      const existingSkus = allListings
        .map((l: any) => l.sku)
        .filter((s: string) => s && s.startsWith(`RTT-${catPrefix}-`))
        .map((s: string) => parseInt(s.split("-").pop() || "0", 10))
        .filter((n: number) => !isNaN(n));
      const nextNum = existingSkus.length > 0 ? Math.max(...existingSkus) + 1 : 1;
      const sku = `RTT-${catPrefix}-${String(nextNum).padStart(4, "0")}`;
      return res.json({ sku });
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/store/listings", async (_req: Request, res: Response) => {
    try {
      const list = await storage.getPublishedListings();
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/store/listings/:id", async (req: Request, res: Response) => {
    try {
      const listing = await storage.getListingById(req.params.id);
      if (!listing || !listing.isPublished || listing.status !== "AVAILABLE") {
        return res.status(404).json({ error: "Not found" });
      }
      return res.json(listing);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  function getBaseUrl(req: Request): string {
    const proto = req.header("x-forwarded-proto") || req.protocol || "https";
    const host = req.header("x-forwarded-host") || req.get("host");
    return `${proto}://${host}`;
  }

  function formatCondition(c: string): string {
    const map: Record<string, string> = {
      NEW_BOXED: "New In Box",
      USED_UNBOXED: "Used - Unboxed",
      USED: "Used",
      DAMAGED: "Damaged",
    };
    return map[c] || c.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  }

  function formatCategory(c: string): string {
    return c.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  }

  function formatPowerType(p: string): string {
    const map: Record<string, string> = {
      GAS: "Gas",
      ELECTRIC_18V: "Electric 18V",
      ELECTRIC_40V: "Electric 40V",
      OTHER: "Other",
    };
    return map[p] || p.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  }

  function formatPrice(price: string | number): string {
    return `$${Number(price).toFixed(2)}`;
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  const storeListingTemplatePath = path.resolve(process.cwd(), "server", "templates", "store-listing.html");
  const storeDetailTemplatePath = path.resolve(process.cwd(), "server", "templates", "store-detail.html");

  app.get("/store", async (req: Request, res: Response) => {
    try {
      const baseUrl = getBaseUrl(req);
      const listings_list = await storage.getPublishedListings();
      const template = fs.readFileSync(storeListingTemplatePath, "utf-8");

      let cardsHtml = "";
      if (listings_list.length === 0) {
        cardsHtml = '<div class="empty-state">No equipment available right now. Check back soon!</div>';
      } else {
        for (const listing of listings_list) {
          const photoUrl = listing.photos && listing.photos.length > 0
            ? `${baseUrl}${listing.photos[0]}`
            : "";
          const imgHtml = photoUrl
            ? `<img class="card-img" src="${escapeHtml(photoUrl)}" alt="${escapeHtml(listing.title)}" loading="lazy" />`
            : `<div class="card-img-placeholder">No Photo</div>`;

          cardsHtml += `<a href="/store/${listing.id}" class="card">
            ${imgHtml}
            <div class="card-body">
              <div class="card-category">${escapeHtml(formatCategory(listing.category))}</div>
              <div class="card-title">${escapeHtml(listing.title)}</div>
              <div class="card-meta">
                <span class="card-condition">${escapeHtml(formatCondition(listing.condition))}</span>
              </div>
              <div class="card-price">${formatPrice(listing.price)}</div>
            </div>
          </a>`;
        }
      }

      const html = template
        .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
        .replace("LISTINGS_HTML_PLACEHOLDER", cardsHtml);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(html);
    } catch (err) {
      console.error("Store listing page error:", err);
      res.status(500).send("Server error");
    }
  });

  app.get("/store/:id", async (req: Request, res: Response) => {
    try {
      const baseUrl = getBaseUrl(req);
      const listing = await storage.getListingById(req.params.id);
      if (!listing || !listing.isPublished || listing.status !== "AVAILABLE") {
        return res.status(404).send("<!doctype html><html><head><title>Not Found</title></head><body><h1>Item not found</h1><p><a href='/store'>Back to store</a></p></body></html>");
      }

      const template = fs.readFileSync(storeDetailTemplatePath, "utf-8");
      const canonicalUrl = `${baseUrl}/store/${listing.id}`;
      const ogImage = listing.photos && listing.photos.length > 0
        ? `${baseUrl}${listing.photos[0]}`
        : "";
      const metaDesc = `${escapeHtml(listing.title)} — ${formatCondition(listing.condition)} ${formatCategory(listing.category)} for ${formatPrice(listing.price)}. Buy quality used outdoor power equipment from Reliable Turf Tools. Ships nationwide.`;

      let galleryHtml = "";
      if (listing.photos && listing.photos.length > 0) {
        const mainPhoto = `${baseUrl}${listing.photos[0]}`;
        galleryHtml = `<div class="gallery"><div class="gallery-main"><img src="${escapeHtml(mainPhoto)}" alt="${escapeHtml(listing.title)}" /></div>`;
        if (listing.photos.length > 1) {
          galleryHtml += '<div class="gallery-thumbs">';
          for (const photo of listing.photos) {
            const thumbUrl = `${baseUrl}${photo}`;
            galleryHtml += `<img class="gallery-thumb${photo === listing.photos[0] ? " active" : ""}" src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(listing.title)}" />`;
          }
          galleryHtml += "</div>";
        }
        galleryHtml += "</div>";
      } else {
        galleryHtml = '<div class="no-photo">No photo available</div>';
      }

      const brandRow = listing.brand ? `<tr><th>Brand</th><td>${escapeHtml(listing.brand)}</td></tr>` : "";
      const skuRow = listing.sku ? `<tr><th>SKU</th><td>${escapeHtml(listing.sku)}</td></tr>` : "";
      const notesHtml = listing.notes
        ? `<div class="listing-notes"><h3>Notes</h3><p>${escapeHtml(listing.notes)}</p></div>`
        : "";

      const ogCondition = listing.condition.includes("NEW") ? "NewCondition" : "UsedCondition";

      const jsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: listing.title,
        description: `${listing.title} — ${formatCondition(listing.condition)} ${formatCategory(listing.category)}. Quality used outdoor power equipment from Reliable Turf Tools.`,
        image: listing.photos ? listing.photos.map((p: string) => `${baseUrl}${p}`) : [],
        sku: listing.sku || undefined,
        brand: listing.brand ? { "@type": "Brand", name: listing.brand } : undefined,
        category: formatCategory(listing.category),
        offers: {
          "@type": "Offer",
          url: canonicalUrl,
          priceCurrency: "USD",
          price: Number(listing.price).toFixed(2),
          availability: "https://schema.org/InStock",
          itemCondition: `https://schema.org/${ogCondition}`,
          seller: {
            "@type": "Organization",
            name: "Reliable Turf Tools",
          },
        },
      });

      const html = template
        .replace(/LISTING_TITLE_PLACEHOLDER/g, escapeHtml(listing.title))
        .replace(/LISTING_META_DESCRIPTION_PLACEHOLDER/g, metaDesc)
        .replace(/LISTING_CANONICAL_URL_PLACEHOLDER/g, canonicalUrl)
        .replace(/LISTING_OG_IMAGE_PLACEHOLDER/g, escapeHtml(ogImage))
        .replace(/LISTING_OG_CONDITION_PLACEHOLDER/g, ogCondition)
        .replace(/LISTING_PRICE_RAW_PLACEHOLDER/g, Number(listing.price).toFixed(2))
        .replace("LISTING_JSONLD_PLACEHOLDER", jsonLd)
        .replace("LISTING_GALLERY_PLACEHOLDER", galleryHtml)
        .replace(/LISTING_CATEGORY_PLACEHOLDER/g, escapeHtml(formatCategory(listing.category)))
        .replace("LISTING_PRICE_PLACEHOLDER", formatPrice(listing.price))
        .replace("LISTING_CONDITION_PLACEHOLDER", escapeHtml(formatCondition(listing.condition)))
        .replace("LISTING_POWER_TYPE_PLACEHOLDER", escapeHtml(formatPowerType(listing.powerType)))
        .replace("LISTING_BRAND_ROW_PLACEHOLDER", brandRow)
        .replace("LISTING_SKU_ROW_PLACEHOLDER", skuRow)
        .replace("LISTING_NOTES_PLACEHOLDER", notesHtml)
        .replace("LISTING_ID_PLACEHOLDER", listing.id);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(html);
    } catch (err) {
      console.error("Store detail page error:", err);
      res.status(500).send("Server error");
    }
  });

  app.get("/sitemap.xml", async (req: Request, res: Response) => {
    try {
      const baseUrl = getBaseUrl(req);
      const listings_list = await storage.getPublishedListings();
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      xml += `  <url><loc>${baseUrl}/store</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;
      for (const listing of listings_list) {
        xml += `  <url><loc>${baseUrl}/store/${listing.id}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
      }
      xml += "</urlset>";
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.status(200).send(xml);
    } catch (err) {
      console.error("Sitemap error:", err);
      res.status(500).send("Server error");
    }
  });

  app.get("/robots.txt", (req: Request, res: Response) => {
    const baseUrl = getBaseUrl(req);
    res.type("text/plain").send(`User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml`);
  });

  const httpServer = createServer(app);
  return httpServer;
}

import express from "express";
function express_static_uploads() {
  return express.static(uploadDir);
}
