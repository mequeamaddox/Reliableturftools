# Reliable Turf Tools

## Overview

Reliable Turf Tools is a business management system for a small turf/outdoor power equipment resale operation. It consists of two main parts:

1. **Admin Mobile App** — A React Native (Expo) mobile-first application for the business owner to manage inventory, buyers, sales, follow-ups, and settings. Designed to be ADHD-friendly with minimal typing, big buttons, and quick actions.
2. **Customer-Facing Storefront** — Public-facing pages where customers can browse available listings and submit inquiries.
3. **Backend API** — An Express.js server providing RESTful endpoints for both the admin app and storefront.

The business model is currently meetup-based sales but expanding to online sales with nationwide shipping. Primary sales channels are Facebook groups and ads. Inventory is barcode-first with support for scanning. Items can be published from the admin side to the public storefront with one click. Payment preferences: Square, Found (banking app), PayPal — no Stripe.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

- **Framework**: Expo SDK 54 with expo-router (file-based routing)
- **Language**: TypeScript with strict mode
- **State Management**: TanStack React Query for server state; React context for auth
- **Navigation Structure**:
  - `app/index.tsx` — Login screen
  - `app/(tabs)/` — Main tab navigation (Dashboard, Inventory, Buyers, Sales, More)
  - `app/inventory/` — Inventory CRUD screens (new, detail, barcode scan)
  - `app/buyers/` — Buyer management screens
  - `app/followups/` — Follow-up creation/editing
  - `app/settings/` — Meetup spots and message templates management
  - `app/store/` — Public storefront screens (listing browse and detail)
- **Fonts**: Inter (Google Fonts via expo-google-fonts)
- **UI Style**: Dark theme with custom color constants (`constants/colors.ts`), no external UI library like shadcn — all custom React Native StyleSheet components
- **Haptics**: Used throughout for tactile feedback on button presses
- **Platform Support**: Primarily mobile (iOS/Android) via Expo, with web support. Platform-specific adjustments for web (e.g., web top inset offsets)

### Backend (Express.js)

- **Runtime**: Node.js with Express 5
- **Language**: TypeScript (compiled via tsx for dev, esbuild for production)
- **Entry Point**: `server/index.ts`
- **Routes**: `server/routes.ts` — Registers all API routes including auth, CRUD for listings/buyers/sales/follow-ups, dashboard stats, storefront endpoints, file uploads
- **Authentication**: Session-based auth using `express-session` with `connect-pg-simple` for PostgreSQL session storage. Passwords hashed with bcryptjs.
- **File Uploads**: Multer saves files to `public/uploads/` directory, paths stored in DB
- **CORS**: Dynamic origin allowlist based on Replit environment variables, plus localhost support for dev
- **Storage Layer**: `server/storage.ts` — Data access layer wrapping Drizzle ORM queries

### Database

- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with `drizzle-zod` for schema validation
- **Schema Location**: `shared/schema.ts` — Shared between frontend and backend
- **Schema Design**:
  - `users` — Admin accounts (email/password)
  - `listings` — Inventory items with fields for title, SKU, barcode, condition, power type, category, price, cost, quantity, status (AVAILABLE/PENDING/SOLD/ARCHIVED), published flag, photos, shipping fields (weightLbs, boxLengthIn, boxWidthIn, boxHeightIn)
  - `buyers` — Customer contacts with phone, name, notes, tags (REPEAT_BUYER, GOOD_BUYER, FLAKE_RISK), preferred meetup spot
  - `sales` — Completed transactions linking listing + buyer with sale price, payment type, meetup spot
  - `followUps` — Scheduled follow-up reminders with type, message, due date, completion status
  - `parts` — Individual parts for sale from listings (linked to parent listing via listingId, cascade delete). Fields: name, description, price, condition, photo, isSold
  - `inquiries` — Customer inquiries from the public storefront
  - `meetupSpots` — Configurable meetup locations
  - `messageTemplates` — Reusable message templates for follow-ups
  - `settings` — Key-value settings store
- **Enums**: PostgreSQL enums for listing_status, follow_up_type, buyer_tag. payment_type is a text column (customizable). Condition, power_type, and category are text columns (customizable via settings)
- **Migrations**: Drizzle Kit with `drizzle-kit push` for schema sync (config in `drizzle.config.ts`)
- **Seeding**: `server/seed.ts` creates a demo admin user and sample data

### API Structure

All API routes are prefixed with `/api/`:
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` — Authentication
- `GET/POST /api/listings`, `GET/PUT/DELETE /api/listings/:id` — Inventory CRUD
- `GET /api/listings/barcode/:barcode` — Barcode lookup
- `POST /api/listings/:id/upload` — Photo upload
- `GET/POST /api/buyers`, `GET/PUT/DELETE /api/buyers/:id` — Buyer CRUD
- `GET/POST /api/sales` — Sales management
- `GET/POST /api/followups`, `PUT/DELETE /api/followups/:id` — Follow-up management
- `GET/POST /api/meetup-spots`, `PUT/DELETE /api/meetup-spots/:id` — Meetup location management
- `GET/POST /api/message-templates`, `PUT/DELETE /api/message-templates/:id` — Template management
- `GET /api/dashboard` — Dashboard statistics
- `GET/PUT /api/inventory-options` — Custom condition/powerType/category/paymentTypes/leadSources options (GET is public, PUT requires auth)
- `POST /api/generate-sku` — Auto-generate SKU in RTT-[CAT]-XXXX format
- `GET /api/listings/:id/label` — Get listing data for label generation
- `GET/POST /api/listings/:id/parts` — Parts CRUD for a listing (auth required)
- `PUT/DELETE /api/parts/:id` — Update/delete individual parts (auth required)
- `POST /api/parts/:id/upload` — Upload part photo (auth required)
- `GET /api/store/listings`, `GET /api/store/listings/:id` — Public storefront API (no auth)
- `GET /api/store/listings/:id/parts` — Public parts API (returns unsold parts only, no auth)
- `POST /api/store/inquiries` — Public inquiry submission (no auth)

### SEO Storefront (Server-Rendered HTML)

- `GET /store` — Public storefront browse page (server-rendered HTML with SEO meta tags)
- `GET /store/:id` — Individual listing detail page (server-rendered with JSON-LD Product schema, OG tags)
- `GET /sitemap.xml` — Dynamic XML sitemap of all published listings
- `GET /robots.txt` — Search engine crawler instructions
- Templates: `server/templates/store-listing.html`, `server/templates/store-detail.html`

### Build & Run

- **Development**: Two processes run simultaneously — `expo:dev` (Expo/Metro on default port) and `server:dev` (Express on port 5000 via tsx)
- **Production Build**: `expo:static:build` creates static web bundle; `server:build` bundles server with esbuild; `server:prod` serves everything
- **Path Aliases**: `@/*` maps to project root, `@shared/*` maps to `./shared/*`

## External Dependencies

### Core Infrastructure
- **PostgreSQL** — Primary database (connection via `DATABASE_URL` env var)
- **connect-pg-simple** — Session storage in PostgreSQL

### Key npm Packages
- **expo** (~54.0.27) — Mobile app framework
- **expo-router** (~6.0.17) — File-based routing
- **express** (^5.0.1) — Backend HTTP server
- **drizzle-orm** (^0.39.3) — Database ORM
- **drizzle-kit** — Schema migration tooling
- **@tanstack/react-query** (^5.83.0) — Server state management
- **bcryptjs** (^3.0.3) — Password hashing
- **multer** (^2.0.2) — File upload handling
- **expo-haptics** — Tactile feedback
- **expo-image-picker** — Photo selection
- **expo-clipboard** — Copy to clipboard functionality
- **expo-location** — Location services
- **react-native-gesture-handler** — Touch gesture handling
- **react-native-keyboard-controller** — Keyboard-aware scrolling

### Environment Variables Required
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — Express session secret (falls back to default in dev)
- `EXPO_PUBLIC_DOMAIN` — Domain for API requests from the Expo frontend
- `REPLIT_DEV_DOMAIN` — Auto-set by Replit for development
- `REPLIT_DOMAINS` — Auto-set by Replit for CORS configuration