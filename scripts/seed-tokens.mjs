#!/usr/bin/env node
/**
 * Seed token card records for all tokens referenced across ST01-ST09, GD01-GD04.
 * Tokens use set_code "TK" and their own card_number sequence.
 * After seeding, update create_token steps in seed scripts to use token_id.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __dir = dirname(fileURLToPath(import.meta.url));

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
const REST = `${SUPABASE_URL}/rest/v1`;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const HEADERS = {
  "Content-Type": "application/json",
  "apikey": KEY,
  "Authorization": `Bearer ${KEY}`,
  "Prefer": "return=minimal",
};

const NOW = new Date().toISOString();

// ─── Token definitions ────────────────────────────────────────────────────────
// id is used as the card id (primary key) and as the token_id reference in abilities.
// card_number is padded to 3 digits within the TK set.

const TOKENS = [
  // ── GD01 token_id references (retroactively defined here) ──
  {
    id: "TK-001",
    token_id: "zaku_ii_zeon_ap1_hp1",
    name: "Zaku II",
    traits: ["Zeon"],
    ap: 1, hp: 1,
    notes: "Spawned by GD01 cards and ST02/ST09 starter decks.",
  },
  {
    id: "TK-002",
    token_id: "chars_zaku_ii_zeon_ap3_hp1",
    name: "Char's Zaku II",
    traits: ["Zeon"],
    ap: 3, hp: 1,
    notes: "Spawned by GD01 Char cards.",
  },
  {
    id: "TK-003",
    token_id: "fatum_00_tsa_ap2_hp2_blocker",
    name: "Fatum-00",
    traits: ["Triple Ship Alliance"],
    keywords: [{ keyword: "blocker" }],
    ap: 2, hp: 2,
    notes: "Spawned by GD01 Athrun / Freedom cards.",
  },

  // ── GD03 inline tokens ──
  {
    id: "TK-004",
    token_id: "ad_balloon_civilian_ap0_hp1",
    name: "Ad Balloon",
    traits: ["Civilian"],
    ap: 0, hp: 1,
    notes: "Spawned by GD03. Can't be set active or paired with a Pilot (enforced by manual_mode rules).",
  },
  {
    id: "TK-005",
    token_id: "hy_gogg_cyclops_team_ap2_hp1",
    name: "Hy-Gogg",
    traits: ["Cyclops Team"],
    ap: 2, hp: 1,
    notes: "Spawned by GD03 Cyclops Team cards.",
  },
  {
    id: "TK-006",
    token_id: "daughtress_new_une_ap0_hp1",
    name: "Daughtress",
    traits: ["New UNE"],
    ap: 0, hp: 1,
    notes: "Spawned by GD03 New UNE / Superpower Bloc cards.",
  },
  {
    id: "TK-007",
    token_id: "gfred_zeon_ap4_hp3",
    name: "GFreD",
    traits: ["Zeon"],
    ap: 4, hp: 3,
    notes: "Spawned by GD03-054 (Dozle Zabi). Enters rested.",
  },
  {
    id: "TK-008",
    token_id: "cgs_mobile_worker_tekkadan_ap1_hp1",
    name: "CGS Mobile Worker",
    traits: ["Tekkadan"],
    ap: 1, hp: 1,
    notes: "Spawned by GD03 Tekkadan cards.",
  },
  {
    id: "TK-009",
    token_id: "gquuuuuux_omega_psycommu_clan_ap3_hp2",
    name: "GQuuuuuuX (Omega Psycommu)",
    traits: ["Clan"],
    ap: 3, hp: 2,
    notes: "Spawned by GD03-117 Lfrith (≤4 enemy units branch).",
  },
  {
    id: "TK-010",
    token_id: "red_gundam_clan_ap2_hp3",
    name: "Red Gundam",
    traits: ["Clan"],
    ap: 2, hp: 3,
    notes: "Spawned by GD03-117 Lfrith (≤4 enemy units branch).",
  },
  {
    id: "TK-011",
    token_id: "graze_custom_tekkadan_ap2_hp2",
    name: "Graze Custom",
    traits: ["Tekkadan"],
    ap: 2, hp: 2,
    notes: "Spawned by GD03-117 Lfrith (1-4 enemy units).",
  },
  {
    id: "TK-012",
    token_id: "gundam_barbatos_4th_form_tekkadan_ap4_hp4",
    name: "Gundam Barbatos 4th Form",
    traits: ["Tekkadan"],
    ap: 4, hp: 4,
    notes: "Spawned by GD03-117 Lfrith (≥5 enemy units).",
  },

  // ── GD04 inline tokens ──
  {
    id: "TK-013",
    token_id: "parts_league_militaire_ap1_hp1",
    name: "Parts",
    traits: ["League Militaire"],
    ap: 1, hp: 1,
    notes: "Spawned by several GD04 League Militaire / V Gundam cards.",
  },
  {
    id: "TK-014",
    token_id: "wire_guided_arm_zeon_ap2_hp1",
    name: "Wire-Guided Arm",
    traits: ["Zeon"],
    ap: 2, hp: 1,
    notes: "Spawned by GD04-016 (Zeong). Cannot be paired with a Pilot.",
  },
  {
    id: "TK-015",
    token_id: "zeong_head_zeon_ap3_hp1",
    name: "Zeong (Head)",
    traits: ["Zeon"],
    ap: 3, hp: 1,
    notes: "Spawned by GD04-016 (Zeong) upon its destruction.",
  },
  {
    id: "TK-016",
    token_id: "alvaaron_un_ap4_hp1",
    name: "Alvaaron",
    traits: ["UN"],
    ap: 4, hp: 1,
    notes: "Spawned by GD04-080 (Alvatore) upon its destruction, if a friendly UN/Superpower Bloc unit exists.",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cardNumber(n) {
  return String(n).padStart(3, "0");
}

function buildCardData(tok, index) {
  return {
    id: tok.id,
    set_code: "TK",
    card_number: cardNumber(index + 1),
    name: tok.name,
    type: "token",
    color: null,          // tokens are colorless by default
    rarity: "common",
    traits: tok.traits,
    keywords: tok.keywords ?? [],
    abilities: [],
    ap: tok.ap,
    hp: tok.hp,
    rules_text: tok.notes ?? "",
    status: "published",
    format_legality: {},
    manual_mode: false,
    version: 1,
    authored_by: "system",
    created_at: NOW,
    updated_at: NOW,
    // Store the token_id as a lookup key for engine
    token_id: tok.token_id,
  };
}

async function upsertToken(data) {
  const res = await fetch(`${REST}/cards?id=eq.${data.id}`, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify({ data }),
  });
  if (res.status === 404 || res.status === 204) {
    // Not found via PATCH with no rows — try INSERT
  }
  if (!res.ok && res.status !== 204) {
    // Try insert
    const ins = await fetch(`${REST}/cards`, {
      method: "POST",
      headers: { ...HEADERS, "Prefer": "return=minimal" },
      body: JSON.stringify({ id: data.id, data }),
    });
    if (!ins.ok) {
      const body = await ins.text();
      throw new Error(`INSERT ${data.id} failed ${ins.status}: ${body}`);
    }
  }
}

async function checkExists(id) {
  const res = await fetch(`${REST}/cards?id=eq.${id}&select=id`, {
    headers: { "apikey": KEY, "Authorization": `Bearer ${KEY}` },
  });
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log("Seeding token card records…\n");

let ok = 0, errors = 0;

for (let i = 0; i < TOKENS.length; i++) {
  const tok = TOKENS[i];
  const data = buildCardData(tok, i);
  try {
    const exists = await checkExists(tok.id);
    if (exists) {
      const res = await fetch(`${REST}/cards?id=eq.${tok.id}`, {
        method: "PATCH",
        headers: HEADERS,
        body: JSON.stringify({ data, set_code: "TK", status: "published" }),
      });
      if (!res.ok && res.status !== 204) {
        const body = await res.text();
        throw new Error(`PATCH ${tok.id} ${res.status}: ${body}`);
      }
    } else {
      const res = await fetch(`${REST}/cards`, {
        method: "POST",
        headers: { ...HEADERS, "Prefer": "return=minimal" },
        body: JSON.stringify({ id: tok.id, set_code: "TK", status: "published", version: 1, data }),
      });
      if (!res.ok && res.status !== 201) {
        const body = await res.text();
        throw new Error(`POST ${tok.id} ${res.status}: ${body}`);
      }
    }
    console.log(`  ✓ ${tok.id.padEnd(8)} ${tok.name} (token_id: ${tok.token_id})`);
    ok++;
  } catch (err) {
    console.error(`  ✗ ${tok.id} ${tok.name}: ${err.message}`);
    errors++;
  }
}

console.log(`\nDone: ${ok} ok, ${errors} errors`);
if (errors > 0) process.exit(1);
