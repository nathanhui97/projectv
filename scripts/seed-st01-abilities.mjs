/**
 * Seeds structured abilities for all ST01 cards directly into Supabase.
 * Abilities hand-encoded from official card rulings.
 * Filters use formal FilterSchema format (all_of / single-key objects).
 *
 * Usage: node scripts/seed-st01-abilities.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import process from "process";

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
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REST = `${SUPABASE_URL}/rest/v1`;

// ─── Filter shorthands ────────────────────────────────────────────────────────
// Helpers so the ability data below stays readable.

const f = {
  friendlyUnit:    { all_of: [{ side: "friendly" }, { type: "unit" }] },
  enemyUnit:       { all_of: [{ side: "enemy" },   { type: "unit" }] },
  friendlyPilot:   { all_of: [{ side: "friendly" }, { type: "pilot" }] },
  enemyUnitMaxHp:  (n) => ({ all_of: [{ side: "enemy" },   { type: "unit" }, { hp: { op: "<=", value: n } }] }),
  enemyUnitMaxLv:  (n) => ({ all_of: [{ side: "enemy" },   { type: "unit" }, { level: { op: "<=", value: n } }] }),
  enemyUnitRested: { all_of: [{ side: "enemy" },   { type: "unit" }, { is_resting: true }] },
  friendlyRested:  (zone) => ({ all_of: [{ zone }, { side: "friendly" }, { is_resting: true }] }),
  friendlyLinked:  { all_of: [{ side: "friendly" }, { type: "unit" }, { is_linked: true }] },
  friendlyShield:  { all_of: [{ zone: "shield_area" }, { side: "friendly" }] },
};

// ─── ST01 abilities ───────────────────────────────────────────────────────────

const ABILITIES = {

  // ── ST01-001 Gundam ─────────────────────────────────────────────────────────
  // 【During Pair】During your turn, all your Units get AP+1.
  "ST01-001": [
    {
      id: "a1",
      display_text: "【During Pair】During your turn, all your Units get AP+1.",
      trigger: { type: "during_pair", qualifiers: { your_turn_only: true } },
      steps: [
        { action: "all_matching", filter: f.friendlyUnit, store_as: "$targets" },
        { action: "modify_stat", target: "$targets", stat: "ap", amount: 1, duration: "while_paired" },
      ],
    },
  ],

  // ── ST01-002 Gundam (MA Form) ────────────────────────────────────────────────
  // 【When Paired･(White Base Team) Pilot】Draw 1.
  "ST01-002": [
    {
      id: "a1",
      display_text: "【When Paired･(White Base Team) Pilot】Draw 1.",
      trigger: { type: "on_pair", qualifiers: { pilot_traits_include: ["White Base Team"] } },
      steps: [
        { action: "draw", side: "friendly", amount: 1 },
      ],
    },
  ],

  // ── ST01-003 Guncannon ───────────────────────────────────────────────────────
  "ST01-003": [],

  // ── ST01-004 Guntank ─────────────────────────────────────────────────────────
  // 【Deploy】Choose 1 enemy Unit with 2 or less HP. Rest it.
  "ST01-004": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 enemy Unit with 2 or less HP. Rest it.",
      trigger: { type: "on_deploy" },
      steps: [
        {
          action: "choose_target",
          filter: f.enemyUnitMaxHp(2),
          selector: "controller_chooses",
          min: 0, max: 1,
          store_as: "$target",
          optional: true,
        },
        { action: "rest", target: "$target" },
      ],
    },
  ],

  // ── ST01-005 Zaku II ─────────────────────────────────────────────────────────
  "ST01-005": [],

  // ── ST01-006 Char's Zaku II ──────────────────────────────────────────────────
  // 【When Paired】Choose 1 enemy Unit that is Lv.5 or lower. It gets AP-3 during this turn.
  "ST01-006": [
    {
      id: "a1",
      display_text: "【When Paired】Choose 1 enemy Unit that is Lv.5 or lower. It gets AP-3 during this turn.",
      trigger: { type: "on_pair" },
      steps: [
        {
          action: "choose_target",
          filter: f.enemyUnitMaxLv(5),
          selector: "controller_chooses",
          min: 0, max: 1,
          store_as: "$target",
          optional: true,
        },
        { action: "modify_stat", target: "$target", stat: "ap", amount: -3, duration: "end_of_turn" },
      ],
    },
  ],

  // ── ST01-007 Dom ─────────────────────────────────────────────────────────────
  "ST01-007": [],

  // ── ST01-008 Ball ────────────────────────────────────────────────────────────
  "ST01-008": [],

  // ── ST01-009 Gouf ────────────────────────────────────────────────────────────
  // <Blocker> already in keywords. Extra static restriction: can't target enemy player.
  // No step type can express this — engine enforces at attack-declaration time.
  "ST01-009": [
    {
      id: "a1",
      display_text: "This Unit can't choose the enemy player as its attack target.",
      trigger: { type: "static" },
      steps: [
        {
          action: "manual_resolve",
          prompt_text: "This Unit cannot target the enemy player when declaring an attack. It may only attack enemy Units.",
        },
      ],
    },
  ],

  // ── ST01-010 Amuro Ray (Pilot) ───────────────────────────────────────────────
  // 【Burst】Add this card to your hand.
  // 【When Paired】Choose 1 enemy Unit with 5 or less HP. Rest it.
  "ST01-010": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [
        { action: "move_to_hand", target: "$self" },
      ],
    },
    {
      id: "a2",
      display_text: "【When Paired】Choose 1 enemy Unit with 5 or less HP. Rest it.",
      trigger: { type: "on_pair" },
      steps: [
        {
          action: "choose_target",
          filter: f.enemyUnitMaxHp(5),
          selector: "controller_chooses",
          min: 0, max: 1,
          store_as: "$target",
          optional: true,
        },
        { action: "rest", target: "$target" },
      ],
    },
  ],

  // ── ST01-011 Kai Shiden (Pilot) ───────────────────────────────────────────────
  // 【Burst】Add this card to your hand.
  // 【Attack】【Once per Turn】Choose 1 of your Resources. Set it as active.
  "ST01-011": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [
        { action: "move_to_hand", target: "$self" },
      ],
    },
    {
      id: "a2",
      display_text: "【Attack】【Once per Turn】Choose 1 of your Resources. Set it as active.",
      trigger: { type: "on_attack", qualifiers: { once_per_turn: true } },
      steps: [
        {
          action: "choose_target",
          filter: f.friendlyRested("resource_area"),
          selector: "controller_chooses",
          min: 1, max: 1,
          store_as: "$target",
        },
        { action: "ready", target: "$target" },
      ],
    },
  ],

  // ── ST01-012 Command card ────────────────────────────────────────────────────
  // 【Main】Choose 1 rested enemy Unit. Deal 1 damage to it.
  "ST01-012": [
    {
      id: "a1",
      display_text: "【Main】Choose 1 rested enemy Unit. Deal 1 damage to it.",
      trigger: { type: "activated_main" },
      steps: [
        {
          action: "choose_target",
          filter: f.enemyUnitRested,
          selector: "controller_chooses",
          min: 1, max: 1,
          store_as: "$target",
        },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
      ],
    },
  ],

  // ── ST01-013 Command card ────────────────────────────────────────────────────
  // 【Main】Choose 1 friendly Unit. It recovers 3 HP.
  "ST01-013": [
    {
      id: "a1",
      display_text: "【Main】Choose 1 friendly Unit. It recovers 3 HP.",
      trigger: { type: "activated_main" },
      steps: [
        {
          action: "choose_target",
          filter: f.friendlyUnit,
          selector: "controller_chooses",
          min: 1, max: 1,
          store_as: "$target",
        },
        { action: "heal", target: "$target", amount: 3 },
      ],
    },
  ],

  // ── ST01-014 Command card ────────────────────────────────────────────────────
  // 【Burst】Activate this card's 【Main】.
  // 【Main】/【Action】Choose 1 enemy Unit. It gets AP-3 during this turn.
  "ST01-014": [
    {
      id: "a1",
      display_text: "【Burst】Activate this card's 【Main】 — Choose 1 enemy Unit. It gets AP-3 during this turn.",
      trigger: { type: "on_burst" },
      steps: [
        {
          action: "choose_target",
          filter: f.enemyUnit,
          selector: "controller_chooses",
          min: 1, max: 1,
          store_as: "$target",
        },
        { action: "modify_stat", target: "$target", stat: "ap", amount: -3, duration: "end_of_turn" },
      ],
    },
    {
      id: "a2",
      display_text: "【Main】/【Action】Choose 1 enemy Unit. It gets AP-3 during this turn.",
      trigger: { type: "activated_main" },
      steps: [
        {
          action: "choose_target",
          filter: f.enemyUnit,
          selector: "controller_chooses",
          min: 1, max: 1,
          store_as: "$target",
        },
        { action: "modify_stat", target: "$target", stat: "ap", amount: -3, duration: "end_of_turn" },
      ],
    },
  ],

  // ── ST01-015 White Base (Base) ───────────────────────────────────────────────
  // 【Burst】Deploy this base.
  // 【Deploy】Add 1 of your Shields to your hand.
  // 【Activate･Main】【Once per Turn】②: Deploy token based on friendly unit count.
  "ST01-015": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [
        { action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." },
      ],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [
        {
          action: "choose_target",
          filter: f.friendlyShield,
          selector: "controller_chooses",
          min: 1, max: 1,
          store_as: "$shield",
        },
        { action: "move_to_hand", target: "$shield" },
      ],
    },
    {
      id: "a3",
      display_text: "【Activate･Main】【Once per Turn】②: Deploy a Unit token — Gundam (AP3/HP3) if 0 Units, Guncannon (AP2/HP2) if 1 Unit, Guntank (AP1/HP1) if 2+ Units.",
      trigger: {
        type: "activated_main",
        qualifiers: { once_per_turn: true },
        cost: { pay_resources: 2 },
      },
      steps: [
        // Each step fires only when the friendly unit count matches.
        // ConditionSchema `count` counts cards matching the filter in play (battle_area).
        {
          action: "create_token",
          name: "Gundam", traits: ["White Base Team"], ap: 3, hp: 3,
          count: 1, side: "friendly",
          condition: { type: "count", filter: f.friendlyUnit, op: "=", value: 0 },
        },
        {
          action: "create_token",
          name: "Guncannon", traits: ["White Base Team"], ap: 2, hp: 2,
          count: 1, side: "friendly",
          condition: { type: "count", filter: f.friendlyUnit, op: "=", value: 1 },
        },
        {
          action: "create_token",
          name: "Guntank", traits: ["White Base Team"], ap: 1, hp: 1,
          count: 1, side: "friendly",
          condition: { type: "count", filter: f.friendlyUnit, op: ">=", value: 2 },
        },
      ],
    },
  ],

  // ── ST01-016 Zanzibar (Base) ─────────────────────────────────────────────────
  // 【Burst】Deploy this base.
  // 【Deploy】Add 1 of your Shields to your hand.
  // 【Activate･Main】Rest this Base: All friendly Link Units get AP+1 during this turn.
  "ST01-016": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [
        { action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." },
      ],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [
        {
          action: "choose_target",
          filter: f.friendlyShield,
          selector: "controller_chooses",
          min: 1, max: 1,
          store_as: "$shield",
        },
        { action: "move_to_hand", target: "$shield" },
      ],
    },
    {
      id: "a3",
      display_text: "【Activate･Main】Rest this Base: All friendly Link Units get AP+1 during this turn.",
      trigger: { type: "activated_main", cost: { rest_self: true } },
      steps: [
        { action: "all_matching", filter: f.friendlyLinked, store_as: "$targets" },
        { action: "modify_stat", target: "$targets", stat: "ap", amount: 1, duration: "end_of_turn" },
      ],
    },
  ],
};

// ─── Upload ───────────────────────────────────────────────────────────────────

function log(...a) { console.log(a.join(" ")); }

async function getCard(id) {
  const resp = await fetch(`${REST}/cards?id=eq.${encodeURIComponent(id)}&select=id,data`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const rows = await resp.json();
  return rows[0] ?? null;
}

async function saveAbilities(id, abilities) {
  const card = await getCard(id);
  if (!card) { log(`  ✗ ${id} not found in DB`); return; }
  const merged = { ...(card.data ?? {}), abilities };
  const resp = await fetch(`${REST}/cards?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ data: merged }),
  });
  if (!resp.ok) throw new Error(`Save failed: ${await resp.text()}`);
}

async function main() {
  log("Seeding ST01 abilities…\n");
  const entries = Object.entries(ABILITIES);

  for (const [id, abilities] of entries) {
    try {
      await saveAbilities(id, abilities);
      log(`  ✓ ${id}  (${abilities.length} abilities)`);
    } catch (err) {
      log(`  ✗ ${id}  ERROR: ${err.message}`);
    }
  }

  log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
