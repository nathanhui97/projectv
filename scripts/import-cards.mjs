/**
 * Import scraped card JSON into Supabase.
 * Uses upsert — safe to run multiple times.
 *
 * Usage:
 *   node scripts/import-cards.mjs <json-file>
 *
 * Example:
 *   node scripts/import-cards.mjs /tmp/st01_cards.json
 *   node scripts/import-cards.mjs /tmp/all_cards.json
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from environment,
 * or falls back to the admin app's .env.local.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import process from "process";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __dir = dirname(fileURLToPath(import.meta.url));

// Load .env.local if env vars not set
function loadEnv() {
  const envPath = join(__dir, "../apps/admin/.env.local");
  try {
    const lines = readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const [key, ...rest] = line.split("=");
      if (key && rest.length && !process.env[key.trim()]) {
        process.env[key.trim()] = rest.join("=").trim();
      }
    }
  } catch {
    // ignore if file doesn't exist
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const REST = `${SUPABASE_URL}/rest/v1`;

function log(...args) {
  console.error(args.join(" "));
}

async function upsertBatch(cards) {
  // DB schema: id, data (jsonb), status, set_code, version, previous_version_id, created_at, updated_at
  const rows = cards.map((c) => ({
    id: c.id,
    set_code: c.set_code,
    status: c.status,
    version: c.version,
    data: c, // full CardSchema stored as jsonb
  }));

  const resp = await fetch(`${REST}/cards`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Supabase error ${resp.status}: ${text}`);
  }

  return resp.json();
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    log("Usage: node scripts/import-cards.mjs <json-file>");
    process.exit(1);
  }

  const cards = JSON.parse(readFileSync(filePath, "utf8"));
  log(`Importing ${cards.length} cards from ${filePath}…`);

  // Batch in chunks of 50 to avoid request size limits
  const CHUNK = 50;
  let imported = 0;

  for (let i = 0; i < cards.length; i += CHUNK) {
    const batch = cards.slice(i, i + CHUNK);
    log(`  Upserting batch ${Math.floor(i / CHUNK) + 1} (${batch.length} cards)…`);
    await upsertBatch(batch);
    imported += batch.length;
  }

  log(`Done. ${imported} cards upserted.`);
}

main().catch((err) => {
  log(`Fatal: ${err.message}`);
  process.exit(1);
});
