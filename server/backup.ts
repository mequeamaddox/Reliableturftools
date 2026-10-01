import { db } from "./db";
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
} from "@shared/schema";
import { sql } from "drizzle-orm";
import { putObject, getObject } from "./objectStorage";

const log = console.log;
const BACKUP_OBJECT = "backups/db-backup-latest.json";

export async function saveBackup(): Promise<void> {
  try {
    const [
      usersData,
      listingsData,
      buyersData,
      salesData,
      followUpsData,
      inquiriesData,
      meetupSpotsData,
      messageTemplatesData,
      settingsData,
    ] = await Promise.all([
      db.select().from(users),
      db.select().from(listings),
      db.select().from(buyers),
      db.select().from(sales),
      db.select().from(followUps),
      db.select().from(inquiries),
      db.select().from(meetupSpots),
      db.select().from(messageTemplates),
      db.select().from(settings),
    ]);

    const backup = {
      version: 2,
      savedAt: new Date().toISOString(),
      counts: {
        users: usersData.length,
        listings: listingsData.length,
        buyers: buyersData.length,
        sales: salesData.length,
        followUps: followUpsData.length,
        inquiries: inquiriesData.length,
        meetupSpots: meetupSpotsData.length,
        messageTemplates: messageTemplatesData.length,
        settings: settingsData.length,
      },
      data: {
        users: usersData,
        listings: listingsData,
        buyers: buyersData,
        sales: salesData,
        followUps: followUpsData,
        inquiries: inquiriesData,
        meetupSpots: meetupSpotsData,
        messageTemplates: messageTemplatesData,
        settings: settingsData,
      },
    };

    const body = Buffer.from(JSON.stringify(backup, null, 2), "utf-8");
    await putObject(BACKUP_OBJECT, body, "application/json");

    log(`[backup] Saved backup: ${JSON.stringify(backup.counts)}`);

    // Also save a dated daily snapshot (overwrite same day)
    const dateStr = new Date().toISOString().slice(0, 10);
    const dailyObject = `backups/db-backup-${dateStr}.json`;
    await putObject(dailyObject, body, "application/json");
    log(`[backup] Also saved daily snapshot: ${dailyObject}`);
  } catch (err) {
    console.error("[backup] saveBackup failed:", err);
  }
}

export async function restoreBackup(): Promise<boolean> {
  try {
    const stream = await getObject(BACKUP_OBJECT);
    if (!stream) {
      log("[backup] No backup found in Object Storage (this is normal on first run)");
      return false;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const backup = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as {
      version: number;
      savedAt: string;
      counts: Record<string, number>;
      data: {
        users: any[];
        listings: any[];
        buyers: any[];
        sales: any[];
        followUps: any[];
        inquiries: any[];
        meetupSpots: any[];
        messageTemplates: any[];
        settings: any[];
      };
    };

    log(`[backup] Found backup from ${backup.savedAt} — ${JSON.stringify(backup.counts)}`);
    log("[backup] Restoring data...");

    // Restore in dependency order — tables with no FK deps first
    const d = backup.data;

    if (d.users?.length) {
      for (const row of d.users) {
        await db.execute(sql`
          INSERT INTO users (id, email, password, push_token, created_at)
          VALUES (${row.id}, ${row.email}, ${row.password}, ${row.pushToken ?? null}, ${row.createdAt})
          ON CONFLICT (id) DO NOTHING
        `);
      }
      log(`[backup] Restored ${d.users.length} users`);
    }

    if (d.meetupSpots?.length) {
      for (const row of d.meetupSpots) {
        await db.execute(sql`
          INSERT INTO meetup_spots (id, label, address, is_default)
          VALUES (${row.id}, ${row.label}, ${row.address ?? null}, ${row.isDefault})
          ON CONFLICT (id) DO NOTHING
        `);
      }
      log(`[backup] Restored ${d.meetupSpots.length} meetup spots`);
    }

    if (d.messageTemplates?.length) {
      for (const row of d.messageTemplates) {
        await db.execute(sql`
          INSERT INTO message_templates (id, name, template, type)
          VALUES (${row.id}, ${row.name}, ${row.template}, ${row.type})
          ON CONFLICT (id) DO NOTHING
        `);
      }
      log(`[backup] Restored ${d.messageTemplates.length} message templates`);
    }

    if (d.settings?.length) {
      for (const row of d.settings) {
        await db.execute(sql`
          INSERT INTO settings (id, key, value)
          VALUES (${row.id}, ${row.key}, ${row.value})
          ON CONFLICT (id) DO NOTHING
        `);
      }
      log(`[backup] Restored ${d.settings.length} settings`);
    }

    if (d.listings?.length) {
      for (const row of d.listings) {
        await db.execute(sql`
          INSERT INTO listings (
            id, title, sku, barcode, condition, power_type, category, brand,
            price, cost, retail_price, quantity, status, listing_type,
            notes, description,
            weight_lbs, box_length_in, box_width_in, box_height_in,
            pallet_name, pallet_cost, is_published, photos, linked_accessory_ids,
            created_at, updated_at
          ) VALUES (
            ${row.id}, ${row.title}, ${row.sku ?? null}, ${row.barcode ?? null},
            ${row.condition}, ${row.powerType}, ${row.category}, ${row.brand ?? null},
            ${row.price}, ${row.cost ?? null}, ${row.retailPrice ?? null},
            ${row.quantity}, ${row.status}, ${row.listingType},
            ${row.notes ?? null}, ${row.description ?? null},
            ${row.weightLbs ?? null}, ${row.boxLengthIn ?? null},
            ${row.boxWidthIn ?? null}, ${row.boxHeightIn ?? null},
            ${row.palletName ?? null}, ${row.palletCost ?? null},
            ${row.isPublished},
            ${row.photos ?? []}::text[],
            ${row.linkedAccessoryIds ?? []}::text[],
            ${row.createdAt}, ${row.updatedAt}
          )
          ON CONFLICT (id) DO NOTHING
        `);
      }
      log(`[backup] Restored ${d.listings.length} listings`);
    }

    if (d.buyers?.length) {
      for (const row of d.buyers) {
        await db.execute(sql`
          INSERT INTO buyers (
            id, name, phone, notes, tags, preferred_meetup_spot,
            lead_source, last_contacted_at, created_at
          ) VALUES (
            ${row.id}, ${row.name ?? null}, ${row.phone ?? null},
            ${row.notes ?? null}, ${row.tags ?? []}::text[],
            ${row.preferredMeetupSpot ?? null}, ${row.leadSource ?? null},
            ${row.lastContactedAt ?? null}, ${row.createdAt}
          )
          ON CONFLICT (id) DO NOTHING
        `);
      }
      log(`[backup] Restored ${d.buyers.length} buyers`);
    }

    if (d.sales?.length) {
      for (const row of d.sales) {
        await db.execute(sql`
          INSERT INTO sales (
            id, buyer_id, listing_id, sale_price, payment_type,
            meetup_spot, lead_source, notes, sold_at
          ) VALUES (
            ${row.id}, ${row.buyerId ?? null}, ${row.listingId ?? null},
            ${row.salePrice}, ${row.paymentType},
            ${row.meetupSpot ?? null}, ${row.leadSource ?? null},
            ${row.notes ?? null}, ${row.soldAt}
          )
          ON CONFLICT (id) DO NOTHING
        `);
      }
      log(`[backup] Restored ${d.sales.length} sales`);
    }

    if (d.followUps?.length) {
      for (const row of d.followUps) {
        await db.execute(sql`
          INSERT INTO follow_ups (
            id, buyer_id, type, message, is_completed,
            due_date, completed_at, created_at
          ) VALUES (
            ${row.id}, ${row.buyerId ?? null}, ${row.type},
            ${row.message ?? null}, ${row.isCompleted},
            ${row.dueDate ?? null}, ${row.completedAt ?? null}, ${row.createdAt}
          )
          ON CONFLICT (id) DO NOTHING
        `);
      }
      log(`[backup] Restored ${d.followUps.length} follow-ups`);
    }

    if (d.inquiries?.length) {
      for (const row of d.inquiries) {
        await db.execute(sql`
          INSERT INTO inquiries (
            id, listing_id, name, phone, message,
            is_read, is_archived, created_at
          ) VALUES (
            ${row.id}, ${row.listingId ?? null}, ${row.name},
            ${row.phone}, ${row.message ?? null},
            ${row.isRead}, ${row.isArchived}, ${row.createdAt}
          )
          ON CONFLICT (id) DO NOTHING
        `);
      }
      log(`[backup] Restored ${d.inquiries.length} inquiries`);
    }

    log("[backup] Restore complete!");
    return true;
  } catch (err) {
    console.error("[backup] restoreBackup failed:", err);
    return false;
  }
}

export function schedulePeriodicBackup(intervalMs = 4 * 60 * 60 * 1000) {
  setInterval(async () => {
    log("[backup] Running scheduled backup...");
    await saveBackup();
  }, intervalMs);
  log(`[backup] Periodic backup scheduled every ${intervalMs / 3600000}h`);
}
