/**
 * Scrape card data from the official Gundam Card Game website.
 * Outputs a JSON array of card records ready for Supabase import.
 *
 * Usage:
 *   node scripts/scrape-gcg.mjs [set_code] [--all]
 *
 * Examples:
 *   node scripts/scrape-gcg.mjs ST01          # scrape one set
 *   node scripts/scrape-gcg.mjs --all         # scrape every known set
 *   node scripts/scrape-gcg.mjs ST01 --out=cards.json
 *
 * Output goes to stdout (or --out file). Progress/errors go to stderr.
 */

import { writeFileSync } from "fs";
import process from "process";
import { Agent } from "https";

// Corporate SSL proxy doesn't have a trusted cert in Node.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE = "https://www.gundam-gcg.com/en/cards";
const IMG_BASE = "https://www.gundam-gcg.com/en/images/cards/card";

// All known set codes → package IDs
const SET_MAP = {
  ST01: "616001",
  ST02: "616002",
  ST03: "616003",
  ST04: "616004",
  ST05: "616005",
  ST06: "616006",
  ST07: "616007",
  ST08: "616008",
  ST09: "616009",
  GD01: "616101",
  GD02: "616102",
  GD03: "616103",
  GD04: "616104",
};

const DELAY_MS = 300; // be polite — 300ms between requests
const USER_AGENT =
  "Mozilla/5.0 (compatible; GTCG-Scraper/1.0; research tool)";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(...args) {
  process.stderr.write(args.join(" ") + "\n");
}

async function fetchHtml(url, options = {}) {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: `${BASE}/index.php`,
      Accept: "text/html,application/xhtml+xml",
      ...options.headers,
    },
    ...options,
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.text();
}

// ─── Listing page: extract unique card IDs ───────────────────────────────────

async function fetchCardIds(packageId) {
  log(`Fetching card listing for package ${packageId}…`);
  const html = await fetchHtml(`${BASE}/index.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `package=${packageId}`,
  });

  // Match data-src="detail.php?detailSearch=ST01-001" — skip _p1 alternate arts
  const re = /data-src="detail\.php\?detailSearch=([^"_]+)"/g;
  const ids = new Set();
  let m;
  while ((m = re.exec(html)) !== null) {
    ids.add(m[1]);
  }
  log(`  Found ${ids.size} unique card IDs`);
  return [...ids];
}

// ─── Detail page: parse card data ────────────────────────────────────────────

function extract(html, label) {
  // Match: <dt class="dataTit">LABEL</dt> <dd class="dataTxt">VALUE</dd>
  const re = new RegExp(
    `<dt class="dataTit">${label}<\\/dt>\\s*<dd class="dataTxt[^"]*">([\\s\\S]*?)<\\/dd>`,
    "i"
  );
  const m = html.match(re);
  if (!m) return null;
  return m[1]
    .replace(/<[^>]+>/g, " ") // strip HTML tags
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRulesText(html) {
  // Rules text is inside <div class="dataTxt isRegular"> — preserve newlines
  const m = html.match(
    /<div class="dataTxt isRegular">([\s\S]*?)<\/div>/
  );
  if (!m) return "";
  return m[1]
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mapType(raw) {
  if (!raw) return "unit";
  const t = raw.toUpperCase();
  if (t === "UNIT") return "unit";
  if (t === "PILOT") return "pilot";
  if (t === "COMMAND") return "command";
  if (t === "BASE") return "base";
  if (t === "RESOURCE") return "resource";
  return "unit";
}

function mapColor(raw) {
  if (!raw) return undefined;
  const c = raw.toLowerCase();
  if (c === "blue") return "blue";
  if (c === "green") return "green";
  if (c === "red") return "red";
  if (c === "white") return "white";
  if (c === "purple") return "purple";
  return undefined;
}

function mapRarity(raw) {
  if (!raw) return "common";
  const r = raw.toUpperCase();
  if (r === "C") return "common";
  if (r === "U") return "uncommon";
  if (r === "R") return "rare";
  if (r === "SR") return "super_rare";
  if (r === "LR") return "legendary_rare";
  if (r === "P") return "promo";
  return "common";
}

// Pull traits from "(Earth Federation) (White Base Team)" → ["Earth Federation", "White Base Team"]
function parseTraits(raw) {
  if (!raw) return [];
  const matches = raw.match(/\(([^)]+)\)/g);
  if (!matches) return [];
  return matches.map((m) => m.replace(/[()]/g, "").trim());
}

// Extract keywords from rules text: <Repair 2>, <Breach>, etc.
function parseKeywords(rulesText) {
  const keywords = [];
  const re = /<([A-Za-z][A-Za-z\s]+?)(?:\s+(\d+))?>/g;
  let m;
  while ((m = re.exec(rulesText)) !== null) {
    const kw = m[1].toLowerCase().replace(/\s+/g, "_");
    const KNOWN = [
      "repair",
      "breach",
      "support",
      "blocker",
      "first_strike",
      "high_maneuver",
      "suppression",
    ];
    if (KNOWN.includes(kw)) {
      keywords.push({
        keyword: kw,
        ...(m[2] ? { amount: parseInt(m[2], 10) } : {}),
      });
    }
  }
  return keywords;
}

async function parseDetail(cardId) {
  const url = `${BASE}/detail.php?detailSearch=${cardId}`;
  const html = await fetchHtml(url);

  // Card number and rarity from the header block
  const cardNoM = html.match(/<div class="cardNo">\s*([\w-]+)\s*<\/div>/);
  const rarityM = html.match(/<div class="rarity">\s*([A-Z]+)\s*<\/div>/);
  const nameM = html.match(/<h1 class="cardName">([\s\S]*?)<\/h1>/);

  const cardNo = cardNoM ? cardNoM[1].trim() : cardId;
  const rarity = rarityM ? rarityM[1].trim() : "";
  const name = nameM
    ? nameM[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .trim()
    : cardId;

  // Split card number into set + number
  const parts = cardNo.match(/^([A-Z]+\d+)-(.+)$/);
  const setCode = parts ? parts[1] : "";
  const cardNumber = parts ? parts[2] : cardNo;

  const rawType = extract(html, "TYPE");
  const rawColor = extract(html, "COLOR");
  const rawLevel = extract(html, "Lv\\.");
  const rawCost = extract(html, "COST");
  const rawAp = extract(html, "AP");
  const rawHp = extract(html, "HP");
  const rawTrait = extract(html, "Trait");
  const rawZone = extract(html, "Zone");
  const rawLink = extract(html, "Link");
  const rawColor2 = extract(html, "COLOR");

  const rulesText = extractRulesText(html);
  const keywords = parseKeywords(rulesText);
  const traits = parseTraits(rawTrait);

  const type = mapType(rawType);
  const color = mapColor(rawColor2 || rawColor);
  const rarityMapped = mapRarity(rarity);

  const now = new Date().toISOString();

  const card = {
    id: cardNo,
    set_code: setCode,
    card_number: cardNumber,
    name,
    type,
    ...(color ? { color } : {}),
    rarity: rarityMapped,
    ...(rawCost ? { cost: parseInt(rawCost, 10) } : {}),
    ...(rawLevel ? { level: parseInt(rawLevel, 10) } : {}),
    ...(rawAp ? { ap: parseInt(rawAp, 10) } : {}),
    ...(rawHp ? { hp: parseInt(rawHp, 10) } : {}),
    traits,
    keywords,
    abilities: [],
    rules_text: rulesText,
    art_url: `${IMG_BASE}/${cardNo}.webp`,
    status: "draft",
    format_legality: {},
    manual_mode: false,
    ...(rawZone ? { authoring_notes: `Zone: ${rawZone}${rawLink ? ` | Link: ${rawLink}` : ""}` } : {}),
    version: 1,
    created_at: now,
    updated_at: now,
    authored_by: "scraper",
  };

  return card;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function scrapeSet(setCode) {
  const packageId = SET_MAP[setCode];
  if (!packageId) throw new Error(`Unknown set code: ${setCode}`);

  const cardIds = await fetchCardIds(packageId);
  const cards = [];

  for (let i = 0; i < cardIds.length; i++) {
    const id = cardIds[i];
    log(`  [${i + 1}/${cardIds.length}] ${id}`);
    try {
      const card = await parseDetail(id);
      cards.push(card);
    } catch (err) {
      log(`    ERROR: ${err.message}`);
    }
    if (i < cardIds.length - 1) await sleep(DELAY_MS);
  }

  return cards;
}

async function main() {
  const args = process.argv.slice(2);
  const doAll = args.includes("--all");
  const outArg = args.find((a) => a.startsWith("--out="));
  const outFile = outArg ? outArg.slice(6) : null;
  const setCodes = doAll
    ? Object.keys(SET_MAP)
    : args.filter((a) => !a.startsWith("--") && SET_MAP[a]);

  if (setCodes.length === 0) {
    log("Usage: node scripts/scrape-gcg.mjs <SET_CODE> [--out=file.json]");
    log("       node scripts/scrape-gcg.mjs --all [--out=file.json]");
    log(`Known sets: ${Object.keys(SET_MAP).join(", ")}`);
    process.exit(1);
  }

  const allCards = [];

  for (const setCode of setCodes) {
    log(`\n=== Scraping ${setCode} ===`);
    const cards = await scrapeSet(setCode);
    allCards.push(...cards);
    log(`  Done: ${cards.length} cards`);
  }

  const json = JSON.stringify(allCards, null, 2);

  if (outFile) {
    writeFileSync(outFile, json, "utf8");
    log(`\nWrote ${allCards.length} cards to ${outFile}`);
  } else {
    process.stdout.write(json + "\n");
  }
}

main().catch((err) => {
  log(`Fatal: ${err.message}`);
  process.exit(1);
});
