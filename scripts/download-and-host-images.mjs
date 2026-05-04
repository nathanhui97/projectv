/**
 * Downloads all card images from the GCG site and uploads them to Supabase Storage.
 * Updates each card's art_url in the DB to point to your own bucket.
 *
 * Usage:
 *   node scripts/download-and-host-images.mjs
 *   node scripts/download-and-host-images.mjs --dry-run   # list what would be uploaded, no changes
 *   node scripts/download-and-host-images.mjs --set=GD01  # only process one set
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import process from "process";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __dir = dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const lines = readFileSync(join(__dir, "../apps/admin/.env.local"), "utf8").split("\n");
    for (const line of lines) {
      const [key, ...rest] = line.split("=");
      if (key && rest.length && !process.env[key.trim()]) {
        process.env[key.trim()] = rest.join("=").trim();
      }
    }
  } catch {}
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "card-art";
const REST = `${SUPABASE_URL}/rest/v1`;
const STORAGE = `${SUPABASE_URL}/storage/v1`;

const GCG_IMG_BASE = "https://www.gundam-gcg.com/en/images/cards/card";
const DELAY_MS = 200; // polite delay between downloads
const CHUNK = 5;      // parallel uploads per batch

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SET_FILTER = (args.find((a) => a.startsWith("--set=")) ?? "").slice(6) || null;

function log(...a) { process.stderr.write(a.join(" ") + "\n"); }

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ─── Fetch all card IDs from Supabase ────────────────────────────────────────

async function fetchAllCards() {
  log("Fetching card list from Supabase…");
  let all = [];
  let from = 0;
  const PAGE = 1000;

  while (true) {
    let url = `${REST}/cards?select=id,set_code,data&order=id.asc&limit=${PAGE}&offset=${from}`;
    if (SET_FILTER) url += `&set_code=eq.${SET_FILTER}`;

    const resp = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    if (!resp.ok) throw new Error(`Supabase fetch failed: ${await resp.text()}`);
    const page = await resp.json();
    all = all.concat(page);
    if (page.length < PAGE) break;
    from += PAGE;
  }

  log(`  Found ${all.length} cards${SET_FILTER ? ` in ${SET_FILTER}` : ""}`);
  return all;
}

// ─── Download image bytes from GCG ───────────────────────────────────────────

async function downloadImage(cardId) {
  const url = `${GCG_IMG_BASE}/${cardId}.webp`;
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; GTCG-Archiver/1.0)",
      Referer: "https://www.gundam-gcg.com/en/cards/index.php",
    },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return { bytes: Buffer.from(await resp.arrayBuffer()), contentType: "image/webp" };
}

// ─── Upload to Supabase Storage ───────────────────────────────────────────────

async function uploadImage(cardId, bytes, contentType) {
  const path = `${cardId}.webp`;
  const url = `${STORAGE}/object/${BUCKET}/${path}`;

  // Try PUT (upsert) first
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Storage upload failed (${resp.status}): ${text}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

// ─── Update art_url in DB ─────────────────────────────────────────────────────

async function updateArtUrl(cardId, artUrl) {
  // The card data is stored as jsonb in the `data` column
  // We need to patch data->>'art_url' using Postgres jsonb merge
  const resp = await fetch(`${REST}/cards?id=eq.${encodeURIComponent(cardId)}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      data: { art_url: artUrl }, // Supabase merges jsonb on PATCH
    }),
  });

  if (!resp.ok) throw new Error(`DB update failed: ${await resp.text()}`);
}

// ─── Process one card ─────────────────────────────────────────────────────────

async function processCard(card, index, total) {
  const { id: cardId } = card;
  const currentArtUrl = card.data?.art_url ?? "";

  // Skip if already hosted on Supabase
  if (currentArtUrl.includes("supabase.co")) {
    log(`  [${index}/${total}] ${cardId} — already hosted, skipping`);
    return "skipped";
  }

  if (DRY_RUN) {
    log(`  [${index}/${total}] ${cardId} — would upload`);
    return "dry-run";
  }

  try {
    const { bytes, contentType } = await downloadImage(cardId);
    const publicUrl = await uploadImage(cardId, bytes, contentType);
    await updateArtUrl(cardId, publicUrl);
    log(`  [${index}/${total}] ${cardId} ✓  (${(bytes.length / 1024).toFixed(0)} KB)`);
    return "uploaded";
  } catch (err) {
    log(`  [${index}/${total}] ${cardId} ✗  ${err.message}`);
    return "error";
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    log("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  if (DRY_RUN) log("DRY RUN — no uploads or DB changes will happen\n");

  const cards = await fetchAllCards();
  const total = cards.length;

  const stats = { uploaded: 0, skipped: 0, error: 0, "dry-run": 0 };

  // Process in small parallel batches with a polite delay between batches
  for (let i = 0; i < cards.length; i += CHUNK) {
    const batch = cards.slice(i, i + CHUNK);
    const results = await Promise.all(
      batch.map((card, j) => processCard(card, i + j + 1, total))
    );
    for (const r of results) stats[r] = (stats[r] ?? 0) + 1;

    if (i + CHUNK < cards.length) await sleep(DELAY_MS);
  }

  log(`\nDone.`);
  log(`  Uploaded: ${stats.uploaded}`);
  log(`  Skipped (already hosted): ${stats.skipped}`);
  log(`  Errors: ${stats.error}`);
  if (DRY_RUN) log(`  Would upload: ${stats["dry-run"]}`);
}

main().catch((err) => {
  log(`Fatal: ${err.message}`);
  process.exit(1);
});
