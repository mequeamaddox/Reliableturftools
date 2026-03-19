import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users, listings, messageTemplates } from "@shared/schema";

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    origins.add("https://reliableturftools.replit.app");
    origins.add("https://www.reliableturftools.com");

    const origin = req.header("origin");

    // Allow localhost origins for Expo web development (any port)
    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    // Native mobile apps (EAS builds) don't send origin headers — allow those requests
    const isNativeApp = !origin;

    if (isNativeApp || (origin && (origins.has(origin) || isLocalhost))) {
      if (origin) {
        res.header("Access-Control-Allow-Origin", origin);
      }
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();

  log("Serving static Expo files with dynamic manifest routing");

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    if (req.path !== "/" && req.path !== "/manifest" && req.path !== "/admin") {
      return next();
    }

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }

    if (req.path === "/admin") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }

    if (req.path === "/") {
      return res.redirect("/store");
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });
}

async function ensureAdminAndData() {
  try {
    const { sql: rawSql } = await import("drizzle-orm");
    const enumValues = ["BACK_IN_STOCK", "PRICE_DROP", "CUSTOM"];
    for (const val of enumValues) {
      try {
        await db.execute(rawSql.raw(`ALTER TYPE follow_up_type ADD VALUE IF NOT EXISTS '${val}'`));
      } catch (_) {}
    }

    const adminEmail = "mequeamaddox@gmail.com";
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length === 0) {
      log("No users found — creating admin account...");
      const hashedPw = await bcrypt.hash("Sparky15!", 10);
      await db.insert(users).values({ email: adminEmail, password: hashedPw });
      log("Admin account created successfully");
    }

    const secondAdminEmail = "ishmel_maddox12@yahoo.com";
    const { sql } = await import("drizzle-orm");
    const [existingSecond] = await db.select().from(users).where(sql`LOWER(${users.email}) = LOWER(${secondAdminEmail})`);
    if (!existingSecond) {
      log("Creating second admin account...");
      const hashedPw2 = await bcrypt.hash("Ursula93", 10);
      await db.insert(users).values({ email: secondAdminEmail, password: hashedPw2 });
      log("Second admin account created successfully");
    }

    const DEFAULT_TEMPLATES: { name: string; template: string; type: "CHECK_IN" | "NEW_INVENTORY" | "MEETUP_REMINDER" | "BACK_IN_STOCK" | "PRICE_DROP" | "CUSTOM" }[] = [
      {
        name: "New Listing Alert",
        template: "Hey {buyer_name}! Just got in a {listing_title} that I think you'd be interested in. Let me know if you want more details or photos!",
        type: "NEW_INVENTORY",
      },
      {
        name: "Back in Stock",
        template: "Hey {buyer_name}, good news! The {listing_title} is back in stock. Want me to hold it for you?",
        type: "BACK_IN_STOCK",
      },
      {
        name: "Meetup Confirm",
        template: "Hey {buyer_name}, just confirming our meetup today. I'll be there with the {listing_title}. See you soon!",
        type: "MEETUP_REMINDER",
      },
      {
        name: "Check In",
        template: "Hey {buyer_name}! Just checking in - how's that {listing_title} working out for you?",
        type: "CHECK_IN",
      },
      {
        name: "Price Drop",
        template: "Hey {buyer_name}, I just dropped the price on the {listing_title}. Let me know if you're still interested!",
        type: "CUSTOM",
      },
      {
        name: "Follow Up Interest",
        template: "Hey {buyer_name}! Just following up on the {listing_title} you were looking at. Still interested? I can hold it for you.",
        type: "CUSTOM",
      },
    ];
    const existingTemplates = await db.select().from(messageTemplates);
    const existingNames = new Set(existingTemplates.map((t) => t.name));
    const toInsert = DEFAULT_TEMPLATES.filter((t) => !existingNames.has(t.name));
    if (toInsert.length > 0) {
      log(`Seeding ${toInsert.length} missing default message template(s)...`);
      await db.insert(messageTemplates).values(toInsert);
      log("Message templates seeded successfully");
    }

    const existingListings = await db.select().from(listings).limit(1);
    if (existingListings.length === 0) {
      log("No listings found — seeding initial inventory...");
      await db.insert(listings).values({
        title: "Ryobi Gas Chainsaw",
        sku: "RTT-CHA-0001",
        barcode: "046396015198",
        condition: "USED",
        powerType: "GAS",
        category: "CHAINSAW",
        brand: "Ryobi",
        price: "100.00",
        quantity: 1,
        status: "AVAILABLE",
        notes: "Like New Condition",
        isPublished: true,
        weightLbs: "10.00",
        boxLengthIn: "12.00",
        boxWidthIn: "12.00",
        boxHeightIn: "48.00",
        listingType: "ITEM",
      });
      log("Initial inventory seeded successfully");
    }
  } catch (err) {
    console.error("Error ensuring admin/data:", err);
  }
}

(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);

  await ensureAdminAndData();

  configureExpoAndLanding(app);

  const server = await registerRoutes(app);

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`express server serving on port ${port}`);
    },
  );
})();
