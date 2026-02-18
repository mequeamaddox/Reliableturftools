import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { storage } from "./storage";
import { DEFAULT_CONDITIONS, DEFAULT_POWER_TYPES, DEFAULT_CATEGORIES, DEFAULT_PAYMENT_TYPES, DEFAULT_LEAD_SOURCES } from "@shared/schema";
import { SquareClient, SquareEnvironment } from "square";

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
  const PgSession = connectPgSimple(session);

  const sessionPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const pgSessionStore = new PgSession({
    pool: sessionPool,
    createTableIfMissing: true,
    errorLog: (err: Error) => {
      console.error("PgSession error:", err);
    },
  });

  const isProduction = process.env.NODE_ENV === "production" || !!process.env.REPLIT_DEPLOYMENT;

  app.set("trust proxy", 1);

  app.use(
    session({
      store: pgSessionStore,
      secret: process.env.SESSION_SECRET || "reliable-turf-tools-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProduction,
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: isProduction ? "none" as const : "lax" as const,
      },
    }),
  );

  app.use("/uploads", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  }, express_static_uploads());

  app.use("/public", express.static(path.resolve(process.cwd(), "public")));

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      console.log("Login attempt:", { email, hasPassword: !!password, origin: req.header("origin"), userAgent: req.header("user-agent")?.substring(0, 80) });
      if (!email || !password) {
        console.log("Login failed: missing email or password");
        return res.status(400).json({ error: "Email and password required" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        console.log("Login failed: no user found for email", email);
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      req.session.userId = user.id;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
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

  app.post("/api/listings/batch-labels", requireAuth, async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No listing IDs provided" });
      }
      const results = await Promise.all(ids.map((id: string) => storage.getListingById(id)));
      const listings = results.filter((l: any) => l !== null && l !== undefined);
      return res.json(listings);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/listings", requireAuth, async (req: Request, res: Response) => {
    try {
      const { status, powerType, category, search, listingType } = req.query;
      const list = await storage.getListings({
        status: status as string,
        powerType: powerType as string,
        category: category as string,
        search: search as string,
        listingType: listingType as string,
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

  async function handleInquirySubmission(req: Request, res: Response) {
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
  }

  app.post("/api/inquiries", handleInquirySubmission);
  app.post("/api/store/inquiries", handleInquirySubmission);

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

  app.get("/api/listings/:id/label-print", async (req: Request, res: Response) => {
    try {
      const listing = await storage.getListingById(req.params.id);
      if (!listing) return res.status(404).send("Not found");
      const sku = listing.sku || "N/A";
      const price = parseFloat(listing.price || "0").toFixed(2);
      const condition = (listing.condition || "").replace(/_/g, " ");
      const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Label - ${sku}</title>
<style>
  @page { size: 2in 1in; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; background: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .label { width: 2in; height: 1in; padding: 3px 5px; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid #ccc; }
  .biz { font-size: 6.5pt; font-weight: bold; text-align: center; letter-spacing: 1px; border-bottom: 1px solid #000; padding-bottom: 1px; margin-bottom: 1px; }
  .mid { display: flex; flex-direction: row; align-items: center; justify-content: space-between; }
  .sku { font-size: 7pt; font-weight: bold; }
  .cond { font-size: 5.5pt; color: #555; }
  .price { font-size: 14pt; font-weight: bold; }
  .barcode { text-align: center; }
  .barcode-text { font-size: 5.5pt; letter-spacing: 1px; }
  .bars { display: flex; justify-content: center; height: 18px; }
  .bar { height: 100%; }
  @media print { body { min-height: auto; } .label { border: none; } }
</style></head>
<body>
<div class="label">
  <div class="biz">RELIABLE TURF TOOLS</div>
  <div class="mid">
    <div><div class="sku">${sku}</div><div class="cond">${condition}</div></div>
    <div class="price">$${price}</div>
  </div>
  <div class="barcode">
    <div class="bars" id="bars"></div>
    <div class="barcode-text">${sku}</div>
  </div>
</div>
<script>
const sku="${sku}";const b=document.getElementById('bars');
for(let i=0;i<sku.length;i++){const c=sku.charCodeAt(i);
[{w:1.5,f:true},{w:c%3===0?2:1,f:false},{w:c%2===0?1.5:2,f:true},{w:1,f:false}].forEach(x=>{
const d=document.createElement('div');d.className='bar';d.style.width=x.w+'px';
d.style.backgroundColor=x.f?'#000':'#fff';b.appendChild(d);});
if(i<sku.length-1){const s=document.createElement('div');s.className='bar';s.style.width='1px';
s.style.backgroundColor=c%5>2?'#000':'#fff';b.appendChild(s);}}
window.onload=function(){setTimeout(function(){window.print();},500);};
</script></body></html>`;
      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    } catch (err) {
      return res.status(500).send("Server error");
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
      const items = await storage.getPublishedListings("ITEM");
      const partsList = await storage.getPublishedListings("PART");
      const template = fs.readFileSync(storeListingTemplatePath, "utf-8");

      function buildCardsHtml(listingsList: typeof items): string {
        let html = "";
        for (const listing of listingsList) {
          const photoUrl = listing.photos && listing.photos.length > 0
            ? `${baseUrl}${listing.photos[0]}`
            : "";
          const canShip = listing.weightLbs && parseFloat(listing.weightLbs) > 0;
          const fulfillmentBadge = canShip
            ? '<span class="card-badge badge-ships">Ships</span>'
            : '<span class="card-badge badge-pickup">Pickup</span>';
          const imgHtml = photoUrl
            ? `<div class="card-img-wrap"><img class="card-img" src="${escapeHtml(photoUrl)}" alt="${escapeHtml(listing.title)}" loading="lazy" />${fulfillmentBadge}</div>`
            : `<div class="card-img-wrap"><div class="card-img-placeholder">No Photo</div>${fulfillmentBadge}</div>`;
          const typeBadge = listing.listingType === "PART"
            ? '<span class="card-type-badge">Part</span>'
            : "";

          html += `<a href="/store/${listing.id}" class="card">
            ${imgHtml}
            <div class="card-body">
              <div class="card-category">${escapeHtml(formatCategory(listing.category))}</div>
              <div class="card-title">${escapeHtml(listing.title)}</div>
              <div class="card-meta">
                <span class="card-condition">${escapeHtml(formatCondition(listing.condition))}</span>
                ${typeBadge}
              </div>
              <div class="card-price">${formatPrice(listing.price)}</div>
            </div>
          </a>`;
        }
        return html;
      }

      let cardsHtml = "";
      if (items.length === 0 && partsList.length === 0) {
        cardsHtml = '<div class="empty-state">No equipment available right now. Check back soon!</div>';
      } else {
        if (items.length > 0) {
          cardsHtml += buildCardsHtml(items);
        }
        if (partsList.length > 0) {
          cardsHtml += `</div><h2 class="section-title" style="margin-top:32px">Parts For Sale</h2><div class="grid">`;
          cardsHtml += buildCardsHtml(partsList);
        }
      }

      const totalCount = items.length + partsList.length;
      const countText = totalCount === 1 ? "1 item" : `${totalCount} items`;
      const html = template
        .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
        .replace("LISTINGS_COUNT_PLACEHOLDER", countText)
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

      const hasShipping = listing.weightLbs && parseFloat(listing.weightLbs) > 0;
      let shippingSectionHtml = "";
      if (hasShipping) {
        shippingSectionHtml = `
          <div class="shipping-section">
            <h3>Ship to Your Door</h3>
            <p class="shipping-subtitle">Enter your ZIP code to see shipping options</p>
            <div class="zip-row">
              <input type="text" id="ship-zip" placeholder="ZIP code" maxlength="5" inputmode="numeric" pattern="[0-9]*" />
              <button class="btn-calc" id="btn-calc" onclick="calcShipping()">Get Rates</button>
            </div>
            <div class="rates-container" id="rates-container"></div>
          </div>`;
      } else {
        shippingSectionHtml = `<div class="shipping-not-available">
          <strong>Local Pickup Only</strong><br>
          This item is available for local meetup at safe, public locations in the Columbia, SC area.
        </div>`;
      }

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
        .replace(/LISTING_PRICE_PLACEHOLDER/g, formatPrice(listing.price))
        .replace("LISTING_CONDITION_PLACEHOLDER", escapeHtml(formatCondition(listing.condition)))
        .replace("LISTING_POWER_TYPE_PLACEHOLDER", escapeHtml(formatPowerType(listing.powerType)))
        .replace("LISTING_BRAND_ROW_PLACEHOLDER", brandRow)
        .replace("LISTING_SKU_ROW_PLACEHOLDER", skuRow)
        .replace("LISTING_NOTES_PLACEHOLDER", notesHtml)
        .replace(/LISTING_ID_PLACEHOLDER/g, listing.id)
        .replace("LISTING_SHIPPING_SECTION_PLACEHOLDER", shippingSectionHtml)
        .replace("LISTING_WEIGHT_PLACEHOLDER", listing.weightLbs || "0")
        .replace("LISTING_BOX_LENGTH_PLACEHOLDER", listing.boxLengthIn || "12")
        .replace("LISTING_BOX_WIDTH_PLACEHOLDER", listing.boxWidthIn || "10")
        .replace("LISTING_BOX_HEIGHT_PLACEHOLDER", listing.boxHeightIn || "8");

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

  app.post("/api/shipping-rates", async (req: Request, res: Response) => {
    try {
      const { destinationZip, weightLbs, boxLengthIn, boxWidthIn, boxHeightIn } = req.body;
      if (!destinationZip) {
        return res.status(400).json({ error: "Destination ZIP code is required" });
      }
      const weightOz = Math.max(1, Math.round((parseFloat(weightLbs) || 1) * 16));
      const dimX = parseFloat(boxLengthIn) || 12;
      const dimY = parseFloat(boxWidthIn) || 10;

      const graphqlBody = {
        operationName: "RatesQuery",
        variables: {
          originZip: "29204",
          originCity: "Columbia",
          originRegionCode: "SC",
          isResidential: true,
          destinationZip: destinationZip.trim(),
          destinationCountryCode: "US",
          mailClassKeys: ["GroundAdvantage", "Priority", "PriorityExpress"],
          packageTypeKeys: ["Parcel"],
          weight: weightOz,
          dimensionX: dimX,
          dimensionY: dimY,
          showUpsRatesWhen2x7Selected: false,
        },
        query: `query RatesQuery($originZip: String!, $originCity: String, $originRegionCode: String, $destinationZip: String, $isResidential: Boolean, $destinationCountryCode: String, $weight: Float, $dimensionX: Float, $dimensionY: Float, $dimensionZ: Float, $mailClassKeys: [String!]!, $packageTypeKeys: [String!]!, $pricingTypes: [String!], $showUpsRatesWhen2x7Selected: Boolean) { rates(originZip: $originZip, originCity: $originCity, originRegionCode: $originRegionCode, destinationZip: $destinationZip, isResidential: $isResidential, destinationCountryCode: $destinationCountryCode, weight: $weight, dimensionX: $dimensionX, dimensionY: $dimensionY, dimensionZ: $dimensionZ, mailClassKeys: $mailClassKeys, packageTypeKeys: $packageTypeKeys, pricingTypes: $pricingTypes, showUpsRatesWhen2x7Selected: $showUpsRatesWhen2x7Selected) { title deliveryDescription trackingDescription serviceDescription pricingDescription mailClassKey carrier { carrierKey title __typename } totalPrice basePrice cheapest fastest __typename } }`,
      };

      const ratesResp = await fetch("https://ship.pirateship.com/api/graphql?opname=RatesQuery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(graphqlBody),
      });
      const ratesData = await ratesResp.json() as any;

      if (!ratesData.data?.rates) {
        return res.status(500).json({ error: "No shipping rates available for that ZIP code" });
      }

      const formattedRates = ratesData.data.rates
        .filter((r: any) => r.totalPrice > 0)
        .map((r: any) => ({
          service: r.title,
          carrier: r.carrier?.title || "USPS",
          price: r.totalPrice,
          delivery: (r.deliveryDescription || "").replace(/\[\/?\w+\]/g, ""),
          mailClassKey: r.mailClassKey,
        }))
        .sort((a: any, b: any) => a.price - b.price);

      return res.json(formattedRates);
    } catch (err) {
      console.error("Shipping rates error:", err);
      return res.status(500).json({ error: "Failed to fetch shipping rates" });
    }
  });

  app.post("/api/checkout", async (req: Request, res: Response) => {
    try {
      const { listingId, shippingRate, buyerName, buyerPhone, buyerEmail } = req.body;
      if (!listingId) {
        return res.status(400).json({ error: "Listing ID is required" });
      }

      const accessToken = process.env.SQUARE_ACCESS_TOKEN;
      const locationId = process.env.SQUARE_LOCATION_ID;
      if (!accessToken || !locationId) {
        return res.status(500).json({ error: "Square is not configured yet" });
      }

      const listing = await storage.getListingById(listingId);
      if (!listing || !listing.isPublished || listing.status !== "AVAILABLE") {
        return res.status(404).json({ error: "Listing not found or not available" });
      }

      const squareClient = new SquareClient({
        token: accessToken,
        environment: process.env.SQUARE_ENVIRONMENT === "sandbox"
          ? SquareEnvironment.Sandbox
          : SquareEnvironment.Production,
      });

      const itemPriceCents = BigInt(Math.round(parseFloat(listing.price) * 100));
      const lineItems: any[] = [
        {
          name: listing.title,
          quantity: "1",
          basePriceMoney: {
            amount: itemPriceCents,
            currency: "USD",
          },
        },
      ];

      if (shippingRate && shippingRate.price > 0) {
        const shippingCents = BigInt(Math.round(shippingRate.price * 100));
        lineItems.push({
          name: `Shipping: ${shippingRate.service}`,
          quantity: "1",
          basePriceMoney: {
            amount: shippingCents,
            currency: "USD",
          },
        });
      }

      const baseUrl = getBaseUrl(req);

      const response = await squareClient.checkout.paymentLinks.create({
        idempotencyKey: crypto.randomUUID(),
        order: {
          locationId,
          lineItems,
        },
        checkoutOptions: {
          askForShippingAddress: !!shippingRate,
          redirectUrl: `${baseUrl}/store/thank-you`,
          acceptedPaymentMethods: {
            applePay: true,
            googlePay: true,
          },
        },
        paymentNote: `RTT Listing: ${listing.title} (SKU: ${listing.sku || "N/A"})`,
      });

      const paymentLink = response.paymentLink;
      if (!paymentLink?.url) {
        return res.status(500).json({ error: "Failed to create payment link" });
      }

      return res.json({
        checkoutUrl: paymentLink.url,
        orderId: paymentLink.orderId,
      });
    } catch (err: any) {
      console.error("Checkout error:", err?.message || err);
      return res.status(500).json({ error: "Failed to create checkout" });
    }
  });

  app.get("/store/thank-you", (_req: Request, res: Response) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Thank You - Reliable Turf Tools</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8faf8; color: #1a1a1a; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; border-radius: 16px; padding: 48px 32px; text-align: center; max-width: 480px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .check { width: 64px; height: 64px; background: #2d6a2e; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
    .check svg { width: 32px; height: 32px; }
    h1 { font-size: 24px; margin-bottom: 12px; color: #1a1a1a; }
    p { font-size: 16px; color: #666; line-height: 1.5; margin-bottom: 24px; }
    a { display: inline-block; background: #2d6a2e; color: #fff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; }
    a:hover { background: #245a25; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check"><svg fill="none" stroke="#fff" stroke-width="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg></div>
    <h1>Thank You for Your Order!</h1>
    <p>Your payment has been received. We'll be in touch soon with shipping details.</p>
    <a href="/store">Continue Shopping</a>
  </div>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  const httpServer = createServer(app);
  return httpServer;
}

import express from "express";
function express_static_uploads() {
  return express.static(uploadDir);
}
