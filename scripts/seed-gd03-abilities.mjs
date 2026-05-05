/**
 * Seeds structured abilities for all GD03 cards directly into Supabase.
 * Usage: node scripts/seed-gd03-abilities.mjs
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

// ─── Filter helpers ───────────────────────────────────────────────────────────
// Convenience shorthands used inside the ABILITIES data below.
// Every value is a valid formal FilterSchema (single-key discriminated union,
// or an all_of wrapper for multi-predicate filters).

const F = {
  enemy:   { side: "enemy" },
  friendly: { side: "friendly" },
  any:     { side: "any" },

  // Stat comparisons
  hp_lte:   (n) => ({ hp:    { op: "<=", value: n } }),
  hp_gte:   (n) => ({ hp:    { op: ">=", value: n } }),
  level_lte:(n) => ({ level: { op: "<=", value: n } }),
  level_gte:(n) => ({ level: { op: ">=", value: n } }),
  ap_lte:   (n) => ({ ap:    { op: "<=", value: n } }),
  ap_gte:   (n) => ({ ap:    { op: ">=", value: n } }),

  // Boolean flags
  resting:    { is_resting: true },
  not_resting:{ is_resting: false },
  exclude_self:{ exclude_self: true },

  // Trait helpers
  traits: (arr) => ({ traits_include: arr }),

  // Composite builder
  all: (...clauses) => ({ all_of: clauses }),
};

// ─── Abilities ────────────────────────────────────────────────────────────────

const ABILITIES = {

  // GD03-001 — Repair 2 keyword always-on (correct). When Paired: deal 1 damage to rested enemy, draw if destroys.
  "GD03-001": [
    {
      id: "a1",
      display_text: "【When Paired】Choose 1 rested enemy Unit. Deal 1 damage to it. When this effect destroys an enemy Unit, draw 1.",
      trigger: { type: "on_pair" },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "enemy" }, { is_resting: true }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1 },
        { action: "draw", side: "friendly", amount: 1, condition: { type: "count", filter: { card_id: "$target" }, op: "=", value: 0 } },
      ],
    },
  ],

  // GD03-002 — Repair 3 correct. Bare "repair" in keywords[] is scraper artifact (keyword reminder text).
  // During Pair: when another Repair unit attacks, rest enemy ≤ that unit's Lv.
  "GD03-002": [
    {
      id: "a1",
      display_text: "【During Pair】When one of your other Units with <Repair> attacks, choose 1 enemy Unit whose Lv. is equal to or lower than that Unit. Rest it.",
      trigger: { type: "during_pair" },
      notes: "Scraper artifact: bare 'repair' keyword without amount is keyword reminder text, not a second keyword instance.",
      steps: [{ action: "manual_resolve", prompt_text: "When one of your other Units with <Repair> attacks, choose 1 enemy Unit whose Lv. is equal to or lower than that attacking Unit. Rest it." }],
    },
  ],

  // GD03-003 — Blocker + Repair 1 both always-on. No additional ability text.
  "GD03-003": [],

  // GD03-004 — Attack: if ≥2 other Titans Units in play, rest enemy Unit with ≤5 HP.
  "GD03-004": [
    {
      id: "a1",
      display_text: "【Attack】If you have 2 or more other (Titans) Units in play, choose 1 enemy Unit with 5 or less HP. Rest it.",
      trigger: { type: "on_attack" },
      steps: [
        {
          action: "choose_target",
          filter: { all_of: [{ side: "enemy" }, { hp: { op: "<=", value: 5 } }] },
          selector: "controller_chooses", min: 1, max: 1, store_as: "$target",
          condition: { type: "count", filter: { all_of: [{ side: "friendly" }, { traits_include: ["Titans"] }, { exclude_self: true }] }, op: ">=", value: 2 },
        },
        { action: "rest", target: "$target" },
      ],
    },
  ],

  // GD03-005 — Repair 1 always-on. Deploy: draw 1.
  "GD03-005": [
    {
      id: "a1",
      display_text: "【Deploy】Draw 1.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "draw", side: "friendly", amount: 1 }],
    },
  ],

  // GD03-006 — Deploy: choose 1–2 enemy Units with ≤3 HP, rest them.
  "GD03-006": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 to 2 enemy Units with 3 or less HP. Rest them.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "enemy" }, { hp: { op: "<=", value: 3 } }] }, selector: "controller_chooses", min: 1, max: 2, store_as: "$targets" },
        { action: "rest", target: "$targets" },
      ],
    },
  ],

  // GD03-007 — Destroyed: rest enemy Unit with ≤3 HP.
  "GD03-007": [
    {
      id: "a1",
      display_text: "【Destroyed】Choose 1 enemy Unit with 3 or less HP. Rest it.",
      trigger: { type: "on_destroyed" },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "enemy" }, { hp: { op: "<=", value: 3 } }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "rest", target: "$target" },
      ],
    },
  ],

  // GD03-008 — During Pair: gains Repair 2. Scraper artifact: repair2 in keywords[] should only apply while paired.
  "GD03-008": [
    {
      id: "a1",
      display_text: "【During Pair】This Unit gains <Repair 2>.",
      trigger: { type: "during_pair" },
      notes: "Scraper artifact: repair2 in keywords[] is conditional — applies only while this Unit is paired with a Pilot.",
      steps: [{ action: "gain_keyword", target: { filter: { exclude_self: false } }, keywords: [{ keyword: "repair", amount: 2 }], duration: "while_paired" }],
    },
  ],

  // GD03-009 — Deploy: may exile 2 Titans from trash → rest enemy Unit ≤Lv4.
  "GD03-009": [
    {
      id: "a1",
      display_text: "【Deploy】You may choose 2 (Titans) cards from your trash. Exile them from the game. If you do, choose 1 enemy Unit that is Lv.4 or lower. Rest it.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "You may choose 2 (Titans) cards from your trash and exile them. If you do, choose 1 enemy Unit that is Lv.4 or lower and rest it." }],
    },
  ],

  // GD03-010 — Repair 3 always-on. No ability.
  "GD03-010": [],

  // GD03-011 — No abilities.
  "GD03-011": [],

  // GD03-012 — Repair 1 always-on. No ability.
  "GD03-012": [],

  // GD03-013 — Static: while Jupitris Unit in play, AP+1 and Repair 1. Scraper artifact: repair1 is conditional.
  "GD03-013": [
    {
      id: "a1",
      display_text: "While you have another (Jupitris) Unit in play, this Unit gets AP+1 and <Repair 1>.",
      trigger: { type: "static" },
      notes: "Scraper artifact: repair1 in keywords[] applies only while a (Jupitris) Unit is in play.",
      steps: [{ action: "manual_resolve", prompt_text: "While you have another (Jupitris) Unit in play, this Unit gets AP+1 and <Repair 1>." }],
    },
  ],

  // GD03-014 — Static cost reduction (in hand): while ≥2 Titans Units in play, cost -1.
  "GD03-014": [
    {
      id: "a1",
      display_text: "While you have 2 or more (Titans) Units in play, this card in your hand gets cost -1.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While you have 2 or more (Titans) Units in play, this card in your hand gets cost -1." }],
    },
  ],

  // GD03-015 — Activated Main (once/turn): exile 3 Titans from trash → gain Breach 4 this turn.
  // Scraper artifact: breach4 in keywords[] is conditional (requires activation each turn).
  "GD03-015": [
    {
      id: "a1",
      display_text: "【Activate･Main】【Once per Turn】Exile 3 (Titans) cards from your trash: This Unit gains <Breach 4> during this turn.",
      trigger: { type: "activated_main", qualifiers: { once_per_turn: true } },
      notes: "Scraper artifact: breach4 in keywords[] is conditional — requires paying 3 Titans exile cost each activation.",
      steps: [
        { action: "manual_resolve", prompt_text: "Exile 3 (Titans) cards from your trash. If you do, this Unit gains <Breach 4> during this turn." },
        { action: "gain_keyword", target: { filter: { exclude_self: false } }, keywords: [{ keyword: "breach", amount: 4 }], duration: "end_of_turn" },
      ],
    },
  ],

  // GD03-016 — No abilities.
  "GD03-016": [],

  // GD03-017 — Burst: retrieve Cyclops Team Pilot from trash. When Paired + Cyclops Team Pilot: all Cyclops Team Units may target active enemies with ≤5 AP.
  "GD03-017": [
    {
      id: "a1",
      display_text: "【Burst】Choose 1 (Cyclops Team) Pilot card from your trash. Add it to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 (Cyclops Team) Pilot card from your trash and add it to your hand." }],
    },
    {
      id: "a2",
      display_text: "【When Paired･(Cyclops Team) Pilot】All your (Cyclops Team) Units may choose an active enemy Unit with 5 or less AP as their attack target during this turn.",
      trigger: { type: "on_pair", qualifiers: { pilot_traits_include: ["Cyclops Team"] } },
      steps: [{ action: "manual_resolve", prompt_text: "All your (Cyclops Team) Units may choose an active enemy Unit with 5 or less AP as their attack target during this turn." }],
    },
  ],

  // GD03-018 — Breach 5 + Blocker always-on (correct). Attack: deal 5 damage to enemy Unit with Blocker.
  "GD03-018": [
    {
      id: "a1",
      display_text: "【Attack】Choose 1 enemy Unit with <Blocker>. Deal 5 damage to it.",
      trigger: { type: "on_attack" },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "enemy" }, { has_keyword: ["blocker"] }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 5 },
      ],
    },
  ],

  // GD03-019 — During Pair: taunt (enemies must attack this rested unit). When Linked: place 1 EX Resource.
  "GD03-019": [
    {
      id: "a1",
      display_text: "【During Pair】Enemy Units choose this rested Unit as their attack target if possible when attacking.",
      trigger: { type: "during_pair" },
      steps: [{ action: "manual_resolve", prompt_text: "While paired, enemy Units must choose this rested Unit as their attack target if possible." }],
    },
    {
      id: "a2",
      display_text: "【When Linked】Place 1 EX Resource.",
      trigger: { type: "on_linked" },
      steps: [{ action: "manual_resolve", prompt_text: "Place 1 EX Resource." }],
    },
  ],

  // GD03-020 — When Paired: if ≥4 Cyclops Team in trash, deploy 2 rested Ad Balloon tokens (special rule: can't be set active or paired).
  // Static: while Ad Balloon in play, this Unit can't receive battle damage.
  "GD03-020": [
    {
      id: "a1",
      display_text: "【When Paired】If there are 4 or more (Cyclops Team) cards in your trash, deploy 2 rested [Ad Balloon]((Civilian)･AP0･HP1･This Unit can't be set as active or paired with a Pilot) Unit tokens.",
      trigger: { type: "on_pair" },
      steps: [
        {
          action: "create_token",
          token_id: "ad_balloon_civilian_ap0_hp1",
          count: 2, side: "friendly", rest_state: "rested",
          condition: { type: "zone_count", side: "friendly", zone: "trash", filter: { traits_include: ["Cyclops Team"] }, op: ">=", value: 4 },
        },
      ],
    },
    {
      id: "a2",
      display_text: "While you have a Unit with 'Ad Balloon' in its card name in play, this Unit can't receive enemy battle damage.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While a Unit named 'Ad Balloon' is in play on your side, this Unit can't receive battle damage from enemy Units." }],
    },
  ],

  // GD03-021 — Deploy: choose friendly Operation Meteor/G Team Unit, may target active enemies this turn.
  "GD03-021": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 of your (Operation Meteor)/(G Team) Units. During this turn, it may choose an active enemy Unit as its attack target.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 of your (Operation Meteor)/(G Team) Units. During this turn, it may choose an active enemy Unit as its attack target." }],
    },
  ],

  // GD03-022 — During Link: when this Unit destroys enemy with battle damage, deal 1 damage to all enemy Units ≤Lv3.
  "GD03-022": [
    {
      id: "a1",
      display_text: "【During Link】During your turn, when this Unit destroys an enemy Unit with battle damage, deal 1 damage to all enemy Units that are Lv.3 or lower.",
      trigger: { type: "on_battle_destroy", qualifiers: { requires_link: true, your_turn_only: true } },
      steps: [
        { action: "all_matching", filter: { all_of: [{ side: "enemy" }, { level: { op: "<=", value: 3 } }] }, store_as: "$splash" },
        { action: "deal_damage", target: "$splash", amount: 1 },
      ],
    },
  ],

  // GD03-023 — Static triggered: when you place EX Resource, choose AGE System Unit → gains High-Maneuver this turn.
  "GD03-023": [
    {
      id: "a1",
      display_text: "When you place an EX Resource, choose 1 of your (AGE System) Units. It gains <High-Maneuver> during this turn.",
      trigger: { type: "on_ex_resource_placed" },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "friendly" }, { traits_include: ["AGE System"] }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "gain_keyword", target: "$target", keywords: [{ keyword: "high_maneuver" }], duration: "end_of_turn" },
      ],
    },
  ],

  // GD03-024 — When Linked: if another Cyclops Team Unit in play, deploy rested Hy-Gogg token.
  "GD03-024": [
    {
      id: "a1",
      display_text: "【When Linked】If you have another (Cyclops Team) Unit in play, deploy 1 rested [Hy-Gogg]((Cyclops Team)･AP2･HP1) Unit token.",
      trigger: { type: "on_linked" },
      steps: [
        {
          action: "create_token",
          token_id: "hy_gogg_cyclops_team_ap2_hp1",
          count: 1, side: "friendly", rest_state: "rested",
          condition: { type: "count", filter: { all_of: [{ side: "friendly" }, { traits_include: ["Cyclops Team"] }, { exclude_self: true }] }, op: ">=", value: 1 },
        },
      ],
    },
  ],

  // GD03-025 — Static taunt: enemies must target a rested Maganac Corps Unit if possible.
  "GD03-025": [
    {
      id: "a1",
      display_text: "Enemy Units choose one of your rested (Maganac Corps) Units as their attack target if possible when attacking.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "Enemy Units must choose one of your rested (Maganac Corps) Units as their attack target if possible when attacking." }],
    },
  ],

  // GD03-026 — Breach 3 always-on. No ability.
  "GD03-026": [],

  // GD03-027 — No abilities.
  "GD03-027": [],

  // GD03-028 — Attack: if attacking enemy Unit, gets AP+2 this battle.
  "GD03-028": [
    {
      id: "a1",
      display_text: "【Attack】If you are attacking an enemy Unit, this Unit gets AP+2 during this battle.",
      trigger: { type: "on_attack" },
      steps: [{ action: "manual_resolve", prompt_text: "If this Unit is attacking an enemy Unit (not a Base/Shield), it gets AP+2 during this battle." }],
    },
  ],

  // GD03-029 — Blocker always-on. When this Unit destroys enemy with battle damage, deal 2 damage to all enemy Blocker Units.
  "GD03-029": [
    {
      id: "a1",
      display_text: "During your turn, when this Unit destroys an enemy Unit with battle damage, deal 2 damage to all enemy Units with <Blocker>.",
      trigger: { type: "on_battle_destroy", qualifiers: { your_turn_only: true } },
      steps: [
        { action: "all_matching", filter: { all_of: [{ side: "enemy" }, { has_keyword: ["blocker"] }] }, store_as: "$blockers" },
        { action: "deal_damage", target: "$blockers", amount: 2 },
      ],
    },
  ],

  // GD03-030 — Static cost reduction: while CB Link Unit in play, cost -1 in hand.
  "GD03-030": [
    {
      id: "a1",
      display_text: "While you have a (CB) Link Unit in play, this card in your hand gets cost -1.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While you have a (CB) Link Unit in play, this card in your hand gets cost -1." }],
    },
  ],

  // GD03-031 — No abilities.
  "GD03-031": [],

  // GD03-032 — No abilities.
  "GD03-032": [],

  // GD03-033 — During Pair + ZAFT Pilot: all ZAFT Units get AP+2 your turn. Attack: deal 1 damage per 4 AP.
  "GD03-033": [
    {
      id: "a1",
      display_text: "【During Pair･(ZAFT) Pilot】During your turn, all your (ZAFT) Units get AP+2.",
      trigger: { type: "during_pair", qualifiers: { pilot_traits_include: ["ZAFT"], your_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "During your turn, all your (ZAFT) Units get AP+2." }],
    },
    {
      id: "a2",
      display_text: "【Attack】Choose 1 enemy Unit. Deal 1 damage to it for each 4 AP this Unit has.",
      trigger: { type: "on_attack" },
      steps: [
        { action: "choose_target", filter: { side: "enemy" }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "Deal 1 damage to the chosen enemy Unit for each 4 AP this Unit currently has (round down)." },
      ],
    },
  ],

  // GD03-034 — Suppression always-on (correct, not a scraper artifact). Deploy: deal 3 damage to enemy Unit.
  "GD03-034": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 enemy Unit. Deal 3 damage to it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: { side: "enemy" }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 3 },
      ],
    },
  ],

  // GD03-035 — Activated Main (once/turn): ①, exile Pilot from trash → deal 1 damage to all enemy Units.
  // When Linked: may target active enemy Unit with AP ≤ this Unit's AP.
  "GD03-035": [
    {
      id: "a1",
      display_text: "【Activate･Main】【Once per Turn】①, exile 1 Pilot card from your trash: Deal 1 damage to all enemy Units.",
      trigger: { type: "activated_main", qualifiers: { once_per_turn: true, resource_cost: 1 } },
      steps: [
        { action: "manual_resolve", prompt_text: "Pay ① and exile 1 Pilot card from your trash." },
        { action: "all_matching", filter: { side: "enemy" }, store_as: "$targets" },
        { action: "deal_damage", target: "$targets", amount: 1 },
      ],
    },
    {
      id: "a2",
      display_text: "【When Linked】During this turn, this Unit may choose an active enemy Unit with AP equal to or less than this Unit as its attack target.",
      trigger: { type: "on_linked" },
      steps: [{ action: "manual_resolve", prompt_text: "During this turn, this Unit may choose an active enemy Unit with AP equal to or less than this Unit's AP as its attack target." }],
    },
  ],

  // GD03-036 — When Linked: deal 1 damage to all enemy Units.
  "GD03-036": [
    {
      id: "a1",
      display_text: "【When Linked】Deal 1 damage to all enemy Units.",
      trigger: { type: "on_linked" },
      steps: [
        { action: "all_matching", filter: { side: "enemy" }, store_as: "$targets" },
        { action: "deal_damage", target: "$targets", amount: 1 },
      ],
    },
  ],

  // GD03-037 — During Link: gains First Strike while battling enemy with Destroyed effect. Scraper artifact.
  "GD03-037": [
    {
      id: "a1",
      display_text: "【During Link】During your turn, while this Unit is battling an enemy Unit with a 【Destroyed】 effect, it gains <First Strike>.",
      trigger: { type: "during_link", qualifiers: { your_turn_only: true } },
      notes: "Scraper artifact: first_strike in keywords[] applies only during link while battling an enemy Unit that has a Destroyed trigger.",
      steps: [{ action: "manual_resolve", prompt_text: "While this Link Unit is battling an enemy Unit that has a 【Destroyed】 effect, this Unit gains <First Strike> (deals damage first)." }],
    },
  ],

  // GD03-038 — Activated Main: Support 1. When rested by effect, choose ZAFT Unit → AP+2.
  "GD03-038": [
    {
      id: "a1",
      display_text: "【Activate･Main】<Support 1> (Rest this Unit. 1 other friendly Unit gets AP+1 during this turn.)",
      trigger: { type: "activated_main" },
      steps: [
        { action: "rest", target: { filter: { exclude_self: false } } },
        { action: "choose_target", filter: { all_of: [{ side: "friendly" }, { exclude_self: true }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 1, duration: "end_of_turn" },
      ],
    },
    {
      id: "a2",
      display_text: "During your turn, when this Unit is rested by an effect, choose 1 of your (ZAFT) Units. It gets AP+2 during this turn.",
      trigger: { type: "on_rested_by_effect", qualifiers: { your_turn_only: true } },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "friendly" }, { traits_include: ["ZAFT"] }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 2, duration: "end_of_turn" },
      ],
    },
  ],

  // GD03-039 — Deploy: rest another active friendly Clan Unit → deal 2 damage to enemy Unit with ≤2 AP.
  "GD03-039": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 other active friendly (Clan) Unit. Rest it. If you do, choose 1 enemy Unit with 2 or less AP. Deal 2 damage to it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "friendly" }, { traits_include: ["Clan"] }, { is_resting: false }, { exclude_self: true }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$cost" },
        { action: "rest", target: "$cost" },
        { action: "choose_target", filter: { all_of: [{ side: "enemy" }, { ap: { op: "<=", value: 2 } }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 2 },
      ],
    },
  ],

  // GD03-040 — During Link: gains High-Maneuver (always while linked).
  "GD03-040": [
    {
      id: "a1",
      display_text: "【During Link】This Unit gains <High-Maneuver>.",
      trigger: { type: "during_link" },
      steps: [{ action: "gain_keyword", target: { filter: { exclude_self: false } }, keywords: [{ keyword: "high_maneuver" }], duration: "while_linked" }],
    },
  ],

  // GD03-041 — Deploy: deal 3 damage to all Bases.
  "GD03-041": [
    {
      id: "a1",
      display_text: "【Deploy】Deal 3 damage to all Bases.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Deal 3 damage to all Bases (both friendly and enemy)." }],
    },
  ],

  // GD03-042 — Static: while this Unit has ≥5 AP, may target active enemy Lv.5 or lower.
  "GD03-042": [
    {
      id: "a1",
      display_text: "While this Unit has 5 or more AP, it may choose an active enemy Unit that is Lv.5 or lower as its attack target.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While this Unit has 5 or more AP, it may choose an active enemy Unit that is Lv.5 or lower as its attack target." }],
    },
  ],

  // GD03-043 — When Paired: deal 1 damage to enemy Unit.
  "GD03-043": [
    {
      id: "a1",
      display_text: "【When Paired】Choose 1 enemy Unit. Deal 1 damage to it.",
      trigger: { type: "on_pair" },
      steps: [
        { action: "choose_target", filter: { side: "enemy" }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1 },
      ],
    },
  ],

  // GD03-044 — Deploy: create rested Daughtress token (New UNE, AP0, HP1).
  "GD03-044": [
    {
      id: "a1",
      display_text: "【Deploy】Deploy 1 rested [Daughtress]((New UNE)･AP0･HP1) Unit token.",
      trigger: { type: "on_deploy" },
      steps: [
        {
          action: "create_token",
          token_id: "daughtress_new_une_ap0_hp1",
          count: 1, side: "friendly", rest_state: "rested",
        },
      ],
    },
  ],

  // GD03-045 — Static: while a Unit token in play, this Unit gets AP+1.
  "GD03-045": [
    {
      id: "a1",
      display_text: "While you have a Unit token in play, this Unit gets AP+1.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While you have at least 1 Unit token in play, this Unit gets AP+1." }],
    },
  ],

  // GD03-046 — No abilities.
  "GD03-046": [],

  // GD03-047 — No abilities.
  "GD03-047": [],

  // GD03-048 — Burst: if ≤3 enemy Shields, deploy rested GFreD token (Zeon, AP4, HP3).
  "GD03-048": [
    {
      id: "a1",
      display_text: "【Burst】If there are 3 or less enemy Shields, deploy 1 rested [GFreD]((Zeon)･AP4･HP3) Unit token.",
      trigger: { type: "on_burst" },
      steps: [
        {
          action: "create_token",
          token_id: "gfred_zeon_ap4_hp3",
          count: 1, side: "friendly", rest_state: "rested",
          condition: { type: "shields_remaining", side: "enemy", op: "<=", value: 3 },
        },
      ],
    },
  ],

  // GD03-049 — Suppression always-on (correct). When destroys shield with battle damage, if ≥10 CB in trash, destroy lowest-HP enemy Unit.
  "GD03-049": [
    {
      id: "a1",
      display_text: "When this Unit destroys an enemy shield area card with battle damage, if there are 10 or more (CB) cards in your trash, choose 1 enemy Unit with the lowest HP. Destroy it.",
      trigger: { type: "on_shield_destroy", qualifiers: { battle_damage: true } },
      steps: [
        {
          action: "manual_resolve",
          prompt_text: "If there are 10 or more (CB) cards in your trash, choose 1 enemy Unit with the lowest HP and destroy it.",
          condition: { type: "zone_count", side: "friendly", zone: "trash", filter: { traits_include: ["CB"] }, op: ">=", value: 10 },
        },
      ],
    },
  ],

  // GD03-050 — Activated Main: exile 3 Tekkadan/Teiwaz Units from trash → deal 2 damage to enemy Unit.
  "GD03-050": [
    {
      id: "a1",
      display_text: "【Activate･Main】Choose 3 (Tekkadan)/(Teiwaz) Unit cards from your trash. Exile them from the game. If you do, choose 1 enemy Unit. Deal 2 damage to it.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "manual_resolve", prompt_text: "Choose 3 (Tekkadan)/(Teiwaz) Unit cards from your trash and exile them." },
        { action: "choose_target", filter: { side: "enemy" }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 2 },
      ],
    },
  ],

  // GD03-051 — When Linked: may choose Unit ≤Lv4 from trash, pay its cost to deploy it.
  "GD03-051": [
    {
      id: "a1",
      display_text: "【When Linked】You may choose 1 Unit card that is Lv.4 or lower from your trash. Pay its cost to deploy it.",
      trigger: { type: "on_linked" },
      steps: [{ action: "manual_resolve", prompt_text: "You may choose 1 Unit card that is Lv.4 or lower from your trash. Pay its cost to deploy it." }],
    },
  ],

  // GD03-052 — Activated Main: Support 2. When deals battle damage to Lv≤5 enemy + CB Pilot in play → destroy that enemy.
  "GD03-052": [
    {
      id: "a1",
      display_text: "【Activate･Main】<Support 2> (Rest this Unit. 1 other friendly Unit gets AP+2 during this turn.)",
      trigger: { type: "activated_main" },
      steps: [
        { action: "rest", target: { filter: { exclude_self: false } } },
        { action: "choose_target", filter: { all_of: [{ side: "friendly" }, { exclude_self: true }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 2, duration: "end_of_turn" },
      ],
    },
    {
      id: "a2",
      display_text: "When this Unit deals battle damage to an enemy Unit that is Lv.5 or lower, if you have a (CB) Pilot in play, destroy that enemy Unit.",
      trigger: { type: "on_battle_damage_dealt" },
      steps: [
        {
          action: "manual_resolve",
          prompt_text: "If the damaged enemy Unit is Lv.5 or lower and you have a (CB) Pilot in play, destroy that enemy Unit.",
        },
      ],
    },
  ],

  // GD03-053 — Blocker always-on. During Pair (once/turn): when Tekkadan/Teiwaz receives effect damage, rest enemy Lv≤4.
  "GD03-053": [
    {
      id: "a1",
      display_text: "【During Pair】【Once per Turn】During your turn, when one of your (Tekkadan)/(Teiwaz) Units receives effect damage, choose 1 enemy Unit that is Lv.4 or lower. Rest it.",
      trigger: { type: "on_friendly_receives_effect_damage", qualifiers: { requires_pair: true, once_per_turn: true, your_turn_only: true, source_traits: ["Tekkadan", "Teiwaz"] } },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "enemy" }, { level: { op: "<=", value: 4 } }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "rest", target: "$target" },
      ],
    },
  ],

  // GD03-054 — High-Maneuver always-on (scraper missed it). When Paired + X-Rounder Pilot: exile 4 Vagan from trash → destroy enemy Lv≤4.
  "GD03-054": [
    {
      id: "a1",
      display_text: "<High-Maneuver> (This Unit can't be blocked.)",
      trigger: { type: "static" },
      notes: "Scraper missed High-Maneuver — it's an always-on keyword printed directly on the card.",
      steps: [{ action: "gain_keyword", target: { filter: { exclude_self: false } }, keywords: [{ keyword: "high_maneuver" }], duration: "permanent" }],
    },
    {
      id: "a2",
      display_text: "【When Paired･(X-Rounder) Pilot】You may choose 4 (Vagan) cards from your trash. Exile them from the game. If you do, choose 1 enemy Unit that is Lv.4 or lower. Destroy it.",
      trigger: { type: "on_pair", qualifiers: { pilot_traits_include: ["X-Rounder"] } },
      steps: [{ action: "manual_resolve", prompt_text: "You may choose 4 (Vagan) cards from your trash and exile them. If you do, choose 1 enemy Unit that is Lv.4 or lower and destroy it." }],
    },
  ],

  // GD03-055 — When Paired + Purple Pilot: destroy enemy Unit Lv≤2.
  "GD03-055": [
    {
      id: "a1",
      display_text: "【When Paired･Purple Pilot】Choose 1 enemy Unit that is Lv.2 or lower. Destroy it.",
      trigger: { type: "on_pair", qualifiers: { pilot_color: "purple" } },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "enemy" }, { level: { op: "<=", value: 2 } }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "destroy", target: "$target" },
      ],
    },
  ],

  // GD03-056 — Deploy: deal 1 damage to one friendly Unit and 1 enemy Unit.
  "GD03-056": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 of your Units and 1 enemy Unit. Deal 1 damage to them.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: { side: "friendly" }, selector: "controller_chooses", min: 1, max: 1, store_as: "$friendly" },
        { action: "choose_target", filter: { side: "enemy" }, selector: "controller_chooses", min: 1, max: 1, store_as: "$enemy" },
        { action: "deal_damage", target: "$friendly", amount: 1 },
        { action: "deal_damage", target: "$enemy", amount: 1 },
      ],
    },
  ],

  // GD03-057 — Blocker always-on. No ability.
  "GD03-057": [],

  // GD03-058 — Static: this card in trash gets cost -1.
  "GD03-058": [
    {
      id: "a1",
      display_text: "This card in your trash gets cost -1.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While this card is in your trash, it gets cost -1." }],
    },
  ],

  // GD03-059 — Attack: may exile 1 Vagan from trash → choose friendly Vagan Unit → AP+2.
  "GD03-059": [
    {
      id: "a1",
      display_text: "【Attack】You may choose 1 (Vagan) card from your trash. Exile it from the game. If you do, choose 1 of your (Vagan) Units. It gets AP+2 during this turn.",
      trigger: { type: "on_attack" },
      steps: [{ action: "manual_resolve", prompt_text: "You may exile 1 (Vagan) card from your trash. If you do, choose 1 of your (Vagan) Units and it gets AP+2 during this turn." }],
    },
  ],

  // GD03-060 — Once per turn: when this Unit receives effect damage (your turn), deploy rested CGS Mobile Worker token.
  "GD03-060": [
    {
      id: "a1",
      display_text: "【Once per Turn】During your turn, when this Unit receives effect damage, deploy 1 rested [CGS Mobile Worker]((Tekkadan)･AP1･HP1) Unit token.",
      trigger: { type: "on_receives_effect_damage", qualifiers: { once_per_turn: true, your_turn_only: true } },
      steps: [
        {
          action: "create_token",
          token_id: "cgs_mobile_worker_tekkadan_ap1_hp1",
          count: 1, side: "friendly", rest_state: "rested",
        },
      ],
    },
  ],

  // GD03-061 — Repair 3 conditional (only when at 1 HP). Scraper artifact.
  "GD03-061": [
    {
      id: "a1",
      display_text: "While this Unit has 1 HP, it gains <Repair 3>.",
      trigger: { type: "static" },
      notes: "Scraper artifact: repair3 in keywords[] applies only when this Unit has exactly 1 HP remaining.",
      steps: [{ action: "manual_resolve", prompt_text: "While this Unit has exactly 1 HP remaining, it gains <Repair 3>." }],
    },
  ],

  // GD03-062 — Deploy: if deployed from trash, deal 2 damage to enemy Unit with ≤4 AP.
  "GD03-062": [
    {
      id: "a1",
      display_text: "【Deploy】If you deploy this Unit from your trash, choose 1 enemy Unit with 4 or less AP. Deal 2 damage to it.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "If this Unit was deployed from your trash, choose 1 enemy Unit with 4 or less AP and deal 2 damage to it." }],
    },
  ],

  // GD03-063 — No abilities.
  "GD03-063": [],

  // GD03-064 — Deploy: may choose X-Rounder from trash → hand; if you do, discard 1.
  "GD03-064": [
    {
      id: "a1",
      display_text: "【Deploy】You may choose 1 (X-Rounder) card from your trash and add it to your hand. If you do, discard 1.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "manual_resolve", prompt_text: "You may choose 1 (X-Rounder) card from your trash and add it to your hand. If you do, discard 1 card from your hand." },
      ],
    },
  ],

  // GD03-065 — No abilities.
  "GD03-065": [],

  // GD03-066 — No abilities.
  "GD03-066": [],

  // GD03-067 — Deploy: may deal 1 damage to one of your Units → it gets AP+1 this turn.
  "GD03-067": [
    {
      id: "a1",
      display_text: "【Deploy】You may choose 1 of your Units. Deal 1 damage to it. It gets AP+1 during this turn.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: { side: "friendly" }, selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "deal_damage", target: "$target", amount: 1, condition: { type: "has_card", filter: { card_id: "$target" } } },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 1, duration: "end_of_turn", condition: { type: "has_card", filter: { card_id: "$target" } } },
      ],
    },
  ],

  // GD03-068 — Blocker conditional (while friendly Base in play). Scraper artifact.
  "GD03-068": [
    {
      id: "a1",
      display_text: "While a friendly Base is in play, this Unit gains <Blocker>.",
      trigger: { type: "static" },
      notes: "Scraper artifact: blocker in keywords[] applies only while a friendly Base is in play.",
      steps: [{ action: "manual_resolve", prompt_text: "While a friendly Base is in play, this Unit gains <Blocker>." }],
    },
  ],

  // GD03-069 — High-Maneuver always-on (scraper missed). During Link: at end of turn when paired, set active.
  "GD03-069": [
    {
      id: "a1",
      display_text: "<High-Maneuver> (This Unit can't be blocked.)",
      trigger: { type: "static" },
      notes: "Scraper missed High-Maneuver — it's an always-on keyword printed directly on the card.",
      steps: [{ action: "gain_keyword", target: { filter: { exclude_self: false } }, keywords: [{ keyword: "high_maneuver" }], duration: "permanent" }],
    },
    {
      id: "a2",
      display_text: "【During Link】At the end of the turn when this Unit is paired with a Pilot, set it as active.",
      trigger: { type: "on_end_phase", qualifiers: { requires_link: true } },
      steps: [{ action: "ready", target: { filter: { exclude_self: false } } }],
    },
  ],

  // GD03-070 — Static: while this Unit is rested, friendly Shields can't receive battle damage.
  "GD03-070": [
    {
      id: "a1",
      display_text: "While this Unit is rested, friendly Shields can't receive battle damage from enemy Units.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While this Unit is rested, friendly Shields can't receive battle damage from enemy Units." }],
    },
  ],

  // GD03-071 — Deploy: choose enemy Unit, deal AP-1 for each AEUG Unit card in trash.
  "GD03-071": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 enemy Unit. For each (AEUG) Unit card in your trash, it gets AP-1 during this turn.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: { side: "enemy" }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "Count (AEUG) Unit cards in your trash. The chosen enemy Unit gets AP-(that count) during this turn." },
      ],
    },
  ],

  // GD03-072 — Blocker always-on. Deploy: if another Triple Ship Alliance Unit in play → draw 1, discard 1.
  "GD03-072": [
    {
      id: "a1",
      display_text: "【Deploy】If you have another (Triple Ship Alliance) Unit in play, draw 1. Then, discard 1.",
      trigger: { type: "on_deploy" },
      steps: [
        {
          action: "draw", side: "friendly", amount: 1,
          condition: { type: "count", filter: { all_of: [{ side: "friendly" }, { traits_include: ["Triple Ship Alliance"] }, { exclude_self: true }] }, op: ">=", value: 1 },
        },
        {
          action: "manual_resolve", prompt_text: "Discard 1 card from your hand.",
          condition: { type: "count", filter: { all_of: [{ side: "friendly" }, { traits_include: ["Triple Ship Alliance"] }, { exclude_self: true }] }, op: ">=", value: 1 },
        },
      ],
    },
  ],

  // GD03-073 — Blocker always-on. During Link / Activated Action (once/turn): if ≥6 Gjallarhorn in trash, battling enemy gets AP-3.
  "GD03-073": [
    {
      id: "a1",
      display_text: "【During Link】【Activate･Action】【Once per Turn】If there are 6 or more (Gjallarhorn) cards in your trash, choose 1 enemy Unit battling this Unit. It gets AP-3 during this battle.",
      trigger: { type: "activated_action", qualifiers: { requires_link: true, once_per_turn: true } },
      steps: [
        {
          action: "manual_resolve",
          prompt_text: "If there are 6 or more (Gjallarhorn) cards in your trash, the enemy Unit battling this Unit gets AP-3 during this battle.",
          condition: { type: "zone_count", side: "friendly", zone: "trash", filter: { traits_include: ["Gjallarhorn"] }, op: ">=", value: 6 },
        },
      ],
    },
  ],

  // GD03-074 — During Pair: while another Superpower Bloc Unit in play, taunt (enemies must attack this rested unit).
  "GD03-074": [
    {
      id: "a1",
      display_text: "【During Pair】While you have another (Superpower Bloc) Unit in play, enemy Units choose this rested Unit as their attack target if possible when attacking.",
      trigger: { type: "during_pair" },
      steps: [{ action: "manual_resolve", prompt_text: "While paired and you have another (Superpower Bloc) Unit in play, enemy Units must choose this rested Unit as their attack target if possible." }],
    },
  ],

  // GD03-075 — During Link / Attack: choose enemy Unit with no paired Pilot → AP-2.
  "GD03-075": [
    {
      id: "a1",
      display_text: "【During Link】【Attack】Choose 1 enemy Unit with no paired Pilot. It gets AP-2 during this turn.",
      trigger: { type: "on_attack", qualifiers: { requires_link: true } },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "enemy" }, { is_paired: false }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: -2, duration: "end_of_turn" },
      ],
    },
  ],

  // GD03-076 — Once/turn: when Triple Ship Alliance Unit deals battle damage to enemy Unit, may return enemy to hand.
  "GD03-076": [
    {
      id: "a1",
      display_text: "【Once per Turn】During your turn, when your (Triple Ship Alliance) Unit deals battle damage to an enemy Unit, you may return the enemy Unit to its owner's hand.",
      trigger: { type: "on_battle_damage_dealt", qualifiers: { once_per_turn: true, your_turn_only: true, source_traits: ["Triple Ship Alliance"] } },
      steps: [{ action: "manual_resolve", prompt_text: "You may return the enemy Unit that received battle damage from your (Triple Ship Alliance) Unit to its owner's hand." }],
    },
  ],

  // GD03-077 — When Linked: choose 1–3 enemy Units with ≤3 HP, return to hands.
  "GD03-077": [
    {
      id: "a1",
      display_text: "【When Linked】Choose 1 to 3 enemy Units with 3 or less HP. Return them to their owners' hands.",
      trigger: { type: "on_linked" },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "enemy" }, { hp: { op: "<=", value: 3 } }] }, selector: "controller_chooses", min: 1, max: 3, store_as: "$targets" },
        { action: "move_to_hand", target: "$targets" },
      ],
    },
  ],

  // GD03-078 — During Link / Destroyed: return paired card to hand.
  "GD03-078": [
    {
      id: "a1",
      display_text: "【During Link】【Destroyed】Return the card paired with this Unit to your hand.",
      trigger: { type: "on_destroyed", qualifiers: { requires_link: true } },
      steps: [{ action: "manual_resolve", prompt_text: "Return the Pilot card that was paired with this Unit to your hand." }],
    },
  ],

  // GD03-079 — Static replacement: when you would rest your Base with a Unit effect, may rest this Unit instead.
  "GD03-079": [
    {
      id: "a1",
      display_text: "When you rest your Base with one of your Units' effects, you may rest this Unit instead.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "When one of your Units' effects would rest your Base, you may rest this Unit instead." }],
    },
  ],

  // GD03-080 — When Linked: retrieve Gjallarhorn Command card from trash.
  "GD03-080": [
    {
      id: "a1",
      display_text: "【When Linked】Choose 1 (Gjallarhorn) Command card from your trash. Add it to your hand.",
      trigger: { type: "on_linked" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 (Gjallarhorn) Command card from your trash and add it to your hand." }],
    },
  ],

  // GD03-081 — Static restriction: can only attack during a turn when a Superpower Bloc/UN Unit is deployed.
  "GD03-081": [
    {
      id: "a1",
      display_text: "This Unit can only attack during a turn when one of your (Superpower Bloc)/(UN) Units is deployed.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "This Unit can only attack during a turn in which you have deployed a (Superpower Bloc)/(UN) Unit." }],
    },
  ],

  // GD03-082 — Static cost reduction: while ≥2 Superpower Bloc/UN Units in play, cost -1 in hand.
  "GD03-082": [
    {
      id: "a1",
      display_text: "While you have 2 or more (Superpower Bloc)/(UN) Units in play, this card in your hand gets cost -1.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While you have 2 or more (Superpower Bloc)/(UN) Units in play, this card in your hand gets cost -1." }],
    },
  ],

  // GD03-083 — Blocker always-on. No ability.
  "GD03-083": [],

  // ─── Pilots ───────────────────────────────────────────────────────────────────

  // GD03-084 — Repair 2 scraper artifact (given temporarily to another Unit). Burst: to hand. When Linked: choose other Unit → Repair 2 this turn; if Jupitris, draw 1.
  "GD03-084": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      notes: "Scraper artifact: repair2 in keywords[] is not permanent — this Pilot grants Repair 2 to another Unit temporarily via When Linked.",
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【When Linked】Choose 1 of your other Units. It gains <Repair 2> during this turn. Then, if it is a (Jupitris) Unit, draw 1.",
      trigger: { type: "on_linked" },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "friendly" }, { exclude_self: true }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "gain_keyword", target: "$target", keywords: [{ keyword: "repair", amount: 2 }], duration: "end_of_turn" },
        { action: "draw", side: "friendly", amount: 1, condition: { type: "has_card", filter: { all_of: [{ card_id: "$target" }, { traits_include: ["Jupitris"] }] } } },
      ],
    },
  ],

  // GD03-085 — Burst: to hand. Static cost reduction: free when pairing with "Gundam NT-1" unit.
  "GD03-085": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "When playing this card from your hand and pairing it with a Unit with 'Gundam NT-1' in its card name, play this card as if it has 0 cost.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "When playing this Pilot from your hand and pairing it with a Unit with 'Gundam NT-1' in its card name, its cost is reduced to 0." }],
    },
  ],

  // GD03-086 — Burst: to hand. Attack: choose Titans Unit ≤ this Unit's Lv → AP+1.
  "GD03-086": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【Attack】Choose 1 of your (Titans) Units whose Lv. is equal to or lower than this Unit. It gets AP+1 during this turn.",
      trigger: { type: "on_attack" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 of your (Titans) Units whose Lv. is equal to or lower than this Pilot's Lv. It gets AP+1 during this turn." }],
    },
  ],

  // GD03-087 — Burst: to hand. When Linked: rest enemy Unit Lv≤3.
  "GD03-087": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【When Linked】Choose 1 enemy Unit that is Lv.3 or lower. Rest it.",
      trigger: { type: "on_linked" },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "enemy" }, { level: { op: "<=", value: 3 } }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "rest", target: "$target" },
      ],
    },
  ],

  // GD03-088 — Breach 1 scraper artifact (conditional during link + AGE System). Burst: to hand. During Link: if AGE System, AP+1 and Breach 1.
  "GD03-088": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      notes: "Scraper artifact: breach1 in keywords[] applies only during link with an (AGE System) Unit.",
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【During Link】If this is an (AGE System) Unit, it gets AP+1 and <Breach 1>.",
      trigger: { type: "during_link" },
      steps: [{ action: "manual_resolve", prompt_text: "If this Pilot is paired with an (AGE System) Unit, that Unit gets AP+1 and <Breach 1> while linked." }],
    },
  ],

  // GD03-089 — Burst: to hand. Static AP buff: equal to unique Cyclops Team Pilots/Commands in trash.
  "GD03-089": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "Increase this Unit's AP by an amount equal to the number of (Cyclops Team) Pilot cards/Command cards with unique names in your trash.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "This Unit's AP is increased by the number of (Cyclops Team) Pilot and Command cards with unique names in your trash." }],
    },
  ],

  // GD03-090 — Breach 1 scraper artifact (given to Cyclops Team unit on attack). Burst: to hand. Attack: give Cyclops Team unit Breach 1 this turn.
  "GD03-090": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      notes: "Scraper artifact: breach1 in keywords[] is not permanent — this Pilot grants Breach 1 to a Cyclops Team Unit during attack.",
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【Attack】Choose 1 of your (Cyclops Team) Units. It gains <Breach 1> during this turn.",
      trigger: { type: "on_attack" },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "friendly" }, { traits_include: ["Cyclops Team"] }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "gain_keyword", target: "$target", keywords: [{ keyword: "breach", amount: 1 }], duration: "end_of_turn" },
      ],
    },
  ],

  // GD03-091 — Burst: to hand. When Linked: retrieve ZAFT Base from trash.
  "GD03-091": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【When Linked】Choose 1 (ZAFT) Base card from your trash. Add it to your hand.",
      trigger: { type: "on_linked" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 (ZAFT) Base card from your trash and add it to your hand." }],
    },
  ],

  // GD03-092 — Burst: to hand. When Linked: mill 1 → if Zeon/Clan card, deal 1 damage to enemy Unit.
  "GD03-092": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【When Linked】Place the top card of your deck into your trash. If you placed a (Zeon)/(Clan) card with this effect, choose 1 enemy Unit. Deal 1 damage to it.",
      trigger: { type: "on_linked" },
      steps: [
        { action: "mill", target: { filter: { side: "friendly" } }, amount: 1 },
        { action: "manual_resolve", prompt_text: "If the milled card is a (Zeon)/(Clan) card, choose 1 enemy Unit and deal 1 damage to it." },
      ],
    },
  ],

  // GD03-093 — Burst: to hand. Static: while no enemy Base in play, AP+1.
  "GD03-093": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "While no enemy Base is in play, this Unit gets AP+1.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While no enemy Base is in play, this Unit gets AP+1." }],
    },
  ],

  // GD03-094 — Burst: to hand. When Paired: mill 2 → if Vagan card placed, enemy Unit AP-2.
  "GD03-094": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【When Paired】Place the top 2 cards of your deck into your trash. If you placed a (Vagan) card with this effect, choose 1 enemy Unit. It gets AP-2 during this turn.",
      trigger: { type: "on_pair" },
      steps: [
        { action: "manual_resolve", prompt_text: "Mill the top 2 cards of your deck. If any milled card is a (Vagan) card, choose 1 enemy Unit and it gets AP-2 during this turn." },
      ],
    },
  ],

  // GD03-095 — Burst: to hand. Once/turn: when this Unit receives effect damage, enemy Unit AP-1.
  "GD03-095": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【Once per Turn】When this Unit receives effect damage, choose 1 enemy Unit. It gets AP-1 during this turn.",
      trigger: { type: "on_receives_effect_damage", qualifiers: { once_per_turn: true } },
      steps: [
        { action: "choose_target", filter: { side: "enemy" }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: -1, duration: "end_of_turn" },
      ],
    },
  ],

  // GD03-096 — Burst: to hand. During Link / Attack: may discard 1 → draw 1.
  "GD03-096": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【During Link】【Attack】You may discard 1. If you do, draw 1.",
      trigger: { type: "on_attack", qualifiers: { requires_link: true } },
      steps: [
        { action: "prompt_yes_no", prompt: "Discard 1 card to draw 1?", store_as: "$do_it",
          on_yes: [
            { action: "manual_resolve", prompt_text: "Discard 1 card from your hand." },
            { action: "draw", side: "friendly", amount: 1 },
          ],
        },
      ],
    },
  ],

  // GD03-097 — Burst: to hand. During Link (once/turn): when destroys enemy with battle damage, peek top 2 → return 1, trash 1.
  "GD03-097": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【During Link】【Once per Turn】During your turn, when this Unit destroys an enemy Unit with battle damage, look at the top 2 cards of your deck and return 1 to the top. Place the remaining card into your trash.",
      trigger: { type: "on_battle_destroy", qualifiers: { requires_link: true, once_per_turn: true, your_turn_only: true } },
      steps: [
        { action: "peek_top", side: "friendly", count: 2, reveal_to: "friendly", store_as: "$peeked" },
        { action: "manual_resolve", prompt_text: "Return 1 of the 2 peeked cards to the top of your deck. Place the other into your trash." },
      ],
    },
  ],

  // GD03-098 — Burst: to hand. During Link: when set active by effect, return enemy Unit ≤3 HP to hand.
  "GD03-098": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【During Link】When this rested Unit is set as active by an effect, choose 1 enemy Unit with 3 or less HP. Return it to its owner's hand.",
      trigger: { type: "on_set_active_by_effect", qualifiers: { requires_link: true } },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "enemy" }, { hp: { op: "<=", value: 3 } }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "move_to_hand", target: "$target" },
      ],
    },
  ],

  // GD03-099 — Burst: to hand. During Link / Destroyed: if friendly white Base in play, return enemy Unit ≤ this Lv to hand.
  "GD03-099": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【During Link】【Destroyed】If a friendly white Base is in play, choose 1 enemy Unit whose Lv. is equal to or lower than this Unit. Return it to its owner's hand.",
      trigger: { type: "on_destroyed", qualifiers: { requires_link: true } },
      steps: [{ action: "manual_resolve", prompt_text: "If a friendly white Base is in play, choose 1 enemy Unit whose Lv. is equal to or lower than this Pilot's Lv. Return it to its owner's hand." }],
    },
  ],

  // GD03-100 — Burst: to hand. Destroyed: enemy Unit AP-3.
  "GD03-100": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【Destroyed】Choose 1 enemy Unit. It gets AP-3 during this turn.",
      trigger: { type: "on_destroyed" },
      steps: [
        { action: "choose_target", filter: { side: "enemy" }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: -3, duration: "end_of_turn" },
      ],
    },
  ],

  // ─── Commands ─────────────────────────────────────────────────────────────────

  // GD03-101 — Main: draw 1; if ≥2 "A Healthy Curiosity" in trash, rest enemy Unit ≤4 HP.
  "GD03-101": [
    {
      id: "a1",
      display_text: "【Main】Draw 1. Then, if there are 2 or more cards with 'A Healthy Curiosity' in their card name in your trash, choose 1 enemy Unit with 4 or less HP. Rest it.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "draw", side: "friendly", amount: 1 },
        {
          action: "choose_target", filter: { all_of: [{ side: "enemy" }, { hp: { op: "<=", value: 4 } }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target",
          condition: { type: "zone_count", side: "friendly", zone: "trash", filter: { name_includes: "A Healthy Curiosity" }, op: ">=", value: 2 },
        },
        {
          action: "rest", target: "$target",
          condition: { type: "zone_count", side: "friendly", zone: "trash", filter: { name_includes: "A Healthy Curiosity" }, op: ">=", value: 2 },
        },
      ],
    },
  ],

  // GD03-102 — Burst: draw 1. Action: set active Titans Link Unit battling an enemy.
  "GD03-102": [
    {
      id: "a1",
      display_text: "【Burst】Draw 1.",
      trigger: { type: "on_burst" },
      steps: [{ action: "draw", side: "friendly", amount: 1 }],
    },
    {
      id: "a2",
      display_text: "【Action】Choose 1 of your (Titans) Link Units battling an enemy Unit. Set it as active.",
      trigger: { type: "activated_action" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 of your (Titans) Link Units currently battling an enemy Unit. Set it as active." }],
    },
  ],

  // GD03-103 — Burst: rest enemy Unit ≤2 HP. Main: if ≥3 enemy Units in play, deal 2 damage to rested enemy Unit.
  "GD03-103": [
    {
      id: "a1",
      display_text: "【Burst】Choose 1 enemy Unit with 2 or less HP. Rest it.",
      trigger: { type: "on_burst" },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "enemy" }, { hp: { op: "<=", value: 2 } }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "rest", target: "$target" },
      ],
    },
    {
      id: "a2",
      display_text: "【Main】If 3 or more enemy Units are in play, choose 1 rested enemy Unit. Deal 2 damage to it.",
      trigger: { type: "activated_main" },
      steps: [
        {
          action: "choose_target", filter: { all_of: [{ side: "enemy" }, { is_resting: true }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target",
          condition: { type: "count", filter: { side: "enemy" }, op: ">=", value: 3 },
        },
        {
          action: "deal_damage", target: "$target", amount: 2,
          condition: { type: "count", filter: { side: "enemy" }, op: ">=", value: 3 },
        },
      ],
    },
  ],

  // GD03-104 — Main/Action: rest 1 enemy Unit ≤3 HP (or 1–2 if Jupitris Link Unit in play). Pilot locked: Reccoa Londe.
  "GD03-104": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 enemy Unit with 3 or less HP. Rest it. If a friendly (Jupitris) Link Unit is in play, choose 1 to 2 enemy Units with 3 or less HP instead.",
      trigger: { type: "activated_main_or_action" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 enemy Unit with 3 or less HP and rest it. If a friendly (Jupitris) Link Unit is in play, choose 1 to 2 enemy Units with 3 or less HP instead." }],
    },
  ],

  // GD03-105 — Burst: to hand. Main: choose friendly Unit → may target active unpaired enemy this turn.
  "GD03-105": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【Main】Choose 1 friendly Unit. During this turn, it may choose an active enemy Unit that has no Pilot paired with it as its attack target.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: { side: "friendly" }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "During this turn, the chosen friendly Unit may choose an active enemy Unit with no paired Pilot as its attack target." },
      ],
    },
  ],

  // GD03-106 — Main: deploy GQuuuuuuX (Omega Psycommu) token + Red Gundam token (both Clan).
  "GD03-106": [
    {
      id: "a1",
      display_text: "【Main】Deploy 1 rested [GQuuuuuuX (Omega Psycommu)]((Clan)･AP3･HP2) Unit token and 1 rested [Red Gundam]((Clan)･AP2･HP3) Unit token.",
      trigger: { type: "activated_main" },
      steps: [
        {
          action: "create_token",
          token_id: "gquuuuuux_omega_psycommu_clan_ap3_hp2",
          count: 1, side: "friendly", rest_state: "rested",
        },
        {
          action: "create_token",
          token_id: "red_gundam_clan_ap2_hp3",
          count: 1, side: "friendly", rest_state: "rested",
        },
      ],
    },
  ],

  // GD03-107 — Main: deal damage to enemy Unit Lv≤5 equal to number of friendly tokens. Pilot: Hardie Steiner.
  "GD03-107": [
    {
      id: "a1",
      display_text: "【Main】Choose 1 enemy Unit that is Lv.5 or lower. Deal damage to it equal to the number of friendly Unit tokens in play.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "enemy" }, { level: { op: "<=", value: 5 } }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "Count the number of friendly Unit tokens in play. Deal that much damage to the chosen enemy Unit." },
      ],
    },
  ],

  // GD03-108 — Main: deploy Hy-Gogg token (Cyclops Team, AP2, HP1). Pilot: Gabriel Ramirez Garcia.
  "GD03-108": [
    {
      id: "a1",
      display_text: "【Main】Deploy 1 [Hy-Gogg]((Cyclops Team)･AP2･HP1) Unit token.",
      trigger: { type: "activated_main" },
      steps: [
        {
          action: "create_token",
          token_id: "hy_gogg_cyclops_team_ap2_hp1",
          count: 1, side: "friendly", rest_state: "rested",
        },
      ],
    },
  ],

  // GD03-109 — Burst: activate Main. Main/Action: deal 3 damage to enemy Unit ≤Lv4 (or any if ≥2 copies in trash).
  "GD03-109": [
    {
      id: "a1",
      display_text: "【Burst】Activate this card's 【Main】.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Activate this card's 【Main】 effect." }],
    },
    {
      id: "a2",
      display_text: "【Main】/【Action】Choose 1 enemy Unit that is Lv.4 or lower. Deal 3 damage to it. If there are 2 or more cards with 'Improved Technique' in their card name in your trash, choose 1 enemy Unit instead.",
      trigger: { type: "activated_main_or_action" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 enemy Unit Lv.4 or lower (or any Lv. if 2+ 'Improved Technique' in trash) and deal 3 damage to it." }],
    },
  ],

  // GD03-110 — Main/Action: destroy a Pilot paired with enemy Unit ≤Lv5.
  "GD03-110": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 Pilot paired with an enemy Unit that is Lv.5 or lower. Destroy it.",
      trigger: { type: "activated_main_or_action" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 Pilot that is paired with an enemy Unit that is Lv.5 or lower. Destroy that Pilot." }],
    },
  ],

  // GD03-111 — Main/Action: friendly Mafty Unit gets AP+3. Pilot: Emeralda Zubin.
  "GD03-111": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 friendly (Mafty) Unit. It gets AP+3 during this turn.",
      trigger: { type: "activated_main_or_action" },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "friendly" }, { traits_include: ["Mafty"] }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 3, duration: "end_of_turn" },
      ],
    },
  ],

  // GD03-112 — Burst: to hand. Main/Action: all paired Units get AP+2.
  "GD03-112": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【Main】/【Action】During this turn, all Units paired with a Pilot get AP+2.",
      trigger: { type: "activated_main_or_action" },
      steps: [{ action: "manual_resolve", prompt_text: "During this turn, all Units that are currently paired with a Pilot get AP+2." }],
    },
  ],

  // GD03-113 — Main/Action: rest active friendly Unit → deal 3 damage to enemy Unit ≤ rested unit's Lv.
  "GD03-113": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 active friendly Unit. Rest it. If you do, choose 1 enemy Unit whose Lv. is equal to or lower than the Unit rested with this ability. Deal 3 damage to it.",
      trigger: { type: "activated_main_or_action" },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "friendly" }, { is_resting: false }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$cost" },
        { action: "rest", target: "$cost" },
        { action: "manual_resolve", prompt_text: "Choose 1 enemy Unit whose Lv. is equal to or lower than the rested Unit's Lv. Deal 3 damage to it." },
      ],
    },
  ],

  // GD03-114 — Burst: activate Action. Action: destroy active enemy Unit Lv≤2 (or Lv≤4 if ≥10 in trash).
  "GD03-114": [
    {
      id: "a1",
      display_text: "【Burst】Activate this card's 【Action】.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Activate this card's 【Action】 effect." }],
    },
    {
      id: "a2",
      display_text: "【Action】Choose 1 active enemy Unit that is Lv.2 or lower. Destroy it. If there are 10 or more cards in your trash, choose 1 active enemy Unit that is Lv.4 or lower instead.",
      trigger: { type: "activated_action" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 active enemy Unit Lv.2 or lower (or Lv.4 or lower if ≥10 cards in your trash). Destroy it." }],
    },
  ],

  // GD03-115 — Action: friendly Unit with X-Rounder Pilot can't receive battle damage from ≤2 AP units (or ≤5 AP if player Lv≥7). Pilot: Yurin L'Ciel.
  "GD03-115": [
    {
      id: "a1",
      display_text: "【Action】Choose 1 friendly Unit paired with an (X-Rounder) Pilot. It can't receive battle damage from enemy Units with 2 or less AP during this battle. If you are Lv.7 or higher, it can't receive battle damage from enemy Units with 5 or less AP instead.",
      trigger: { type: "activated_action" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 friendly Unit paired with an (X-Rounder) Pilot. During this battle, it can't receive battle damage from enemy Units with 2 or less AP (or 5 or less AP if your resource level is 7+)." }],
    },
  ],

  // GD03-116 — Main/Action: deal 2 damage to one friendly Vagan Unit and 1 enemy Unit.
  "GD03-116": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 friendly (Vagan) Unit and 1 enemy Unit. Deal 2 damage to them.",
      trigger: { type: "activated_main_or_action" },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "friendly" }, { traits_include: ["Vagan"] }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$friendly" },
        { action: "choose_target", filter: { side: "enemy" }, selector: "controller_chooses", min: 1, max: 1, store_as: "$enemy" },
        { action: "deal_damage", target: "$friendly", amount: 2 },
        { action: "deal_damage", target: "$enemy", amount: 2 },
      ],
    },
  ],

  // GD03-117 — Main: if 1–4 enemy Units → deploy Graze Custom token; if ≥5 → deploy Gundam Barbatos 4th Form token.
  "GD03-117": [
    {
      id: "a1",
      display_text: "【Main】If 1 to 4 enemy Units are in play, deploy 1 [Graze Custom]((Tekkadan)･AP2･HP2) Unit token. If 5 or more are in play, deploy 1 [Gundam Barbatos 4th Form]((Tekkadan)･AP4･HP4) Unit token.",
      trigger: { type: "activated_main" },
      steps: [
        {
          action: "create_token",
          token_id: "graze_custom_tekkadan_ap2_hp2",
          count: 1, side: "friendly", rest_state: "rested",
          condition: { and: [
            { type: "count", filter: { side: "enemy" }, op: ">=", value: 1 },
            { type: "count", filter: { side: "enemy" }, op: "<=", value: 4 },
          ]},
        },
        {
          action: "create_token",
          token_id: "gundam_barbatos_4th_form_tekkadan_ap4_hp4",
          count: 1, side: "friendly", rest_state: "rested",
          condition: { type: "count", filter: { side: "enemy" }, op: ">=", value: 5 },
        },
      ],
    },
  ],

  // GD03-118 — Blocker scraper artifact (conditional). Burst: to hand. Action: return rested enemy ≤Lv4 to hand; if ≥2 copies in trash, may give Blocker to friendly unit.
  "GD03-118": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      notes: "Scraper artifact: blocker in keywords[] is conditional — only granted to a friendly Unit when there are 2+ 'Awakened Potential' in trash.",
      steps: [{ action: "move_to_hand", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【Action】Choose 1 rested enemy Unit that is Lv.4 or lower. Return it to its owner's hand. Then, if there are 2 or more cards with 'Awakened Potential' in their card name in your trash, you may choose 1 friendly Unit. It gains <Blocker> during this turn.",
      trigger: { type: "activated_action" },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "enemy" }, { is_resting: true }, { level: { op: "<=", value: 4 } }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "move_to_hand", target: "$target" },
        {
          action: "choose_target", filter: { side: "friendly" }, selector: "controller_chooses", min: 0, max: 1, store_as: "$buff", optional: true,
          condition: { type: "zone_count", side: "friendly", zone: "trash", filter: { name_includes: "Awakened Potential" }, op: ">=", value: 2 },
        },
        {
          action: "gain_keyword", target: "$buff", keywords: [{ keyword: "blocker" }], duration: "end_of_turn",
          condition: { type: "has_card", filter: { card_id: "$buff" } },
        },
      ],
    },
  ],

  // GD03-119 — Main: set active a rested friendly Base → all enemy Units AP-1.
  "GD03-119": [
    {
      id: "a1",
      display_text: "【Main】Choose 1 rested friendly Base. Set it as active. If you do, all enemy Units get AP-1 during this turn.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "manual_resolve", prompt_text: "Choose 1 rested friendly Base and set it as active." },
        { action: "all_matching", filter: { side: "enemy" }, store_as: "$enemies" },
        { action: "modify_stat", target: "$enemies", stat: "ap", amount: -1, duration: "end_of_turn" },
      ],
    },
  ],

  // GD03-120 — Main: this turn, when friendly Superpower Bloc/UN Unit destroys enemy with battle damage, set active a rested Superpower Bloc/UN Unit (can't attack). Pilot: Patrick Colasour.
  "GD03-120": [
    {
      id: "a1",
      display_text: "【Main】During this turn, if a friendly (Superpower Bloc)/(UN) Unit destroys an enemy Unit with battle damage, choose 1 rested friendly (Superpower Bloc)/(UN) Unit. Set it as active. It can't attack during this turn.",
      trigger: { type: "activated_main" },
      steps: [{ action: "manual_resolve", prompt_text: "Until end of turn: when a friendly (Superpower Bloc)/(UN) Unit destroys an enemy Unit with battle damage, choose 1 rested friendly (Superpower Bloc)/(UN) Unit, set it as active — it can't attack this turn." }],
    },
  ],

  // GD03-121 — Action: rest 1 friendly Base and 1 enemy Unit ≤3 HP. Pilot: Katz Kobayashi.
  "GD03-121": [
    {
      id: "a1",
      display_text: "【Action】Choose 1 friendly Base and 1 enemy Unit with 3 or less HP. Rest them.",
      trigger: { type: "activated_action" },
      steps: [
        { action: "manual_resolve", prompt_text: "Choose 1 friendly Base and 1 enemy Unit with 3 or less HP. Rest both of them." },
      ],
    },
  ],

  // GD03-122 — Action: return enemy Unit Lv≤3 to hand. Pilot: Sergei Smirnov.
  "GD03-122": [
    {
      id: "a1",
      display_text: "【Action】Choose 1 enemy Unit that is Lv.3 or lower. Return it to its owner's hand.",
      trigger: { type: "activated_action" },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "enemy" }, { level: { op: "<=", value: 3 } }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "move_to_hand", target: "$target" },
      ],
    },
  ],

  // ─── Bases ────────────────────────────────────────────────────────────────────

  // GD03-123 — Burst: deploy self. Deploy: shield to hand; if Jupitris Unit in play, rest enemy Lv≤3.
  "GD03-123": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, if a friendly (Jupitris) Unit is in play, choose 1 enemy Unit that is Lv.3 or lower. Rest it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." },
        {
          action: "choose_target", filter: { all_of: [{ side: "enemy" }, { level: { op: "<=", value: 3 } }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target",
          condition: { type: "count", filter: { all_of: [{ side: "friendly" }, { traits_include: ["Jupitris"] }] }, op: ">=", value: 1 },
        },
        {
          action: "rest", target: "$target",
          condition: { type: "count", filter: { all_of: [{ side: "friendly" }, { traits_include: ["Jupitris"] }] }, op: ">=", value: 1 },
        },
      ],
    },
  ],

  // GD03-124 — Burst: deploy self. Deploy: shield to hand. Once/turn: when you pair ≤Lv3 Pilot, rest enemy ≤3 HP.
  "GD03-124": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." }],
    },
    {
      id: "a3",
      display_text: "【Once per Turn】When you pair a Pilot that is Lv.3 or lower with one of your Units, choose 1 enemy Unit with 3 or less HP. Rest it.",
      trigger: { type: "on_pair", qualifiers: { once_per_turn: true, pilot_max_level: 3 } },
      steps: [
        { action: "choose_target", filter: { all_of: [{ side: "enemy" }, { hp: { op: "<=", value: 3 } }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "rest", target: "$target" },
      ],
    },
  ],

  // GD03-125 — Burst: deploy self. Deploy: shield to hand. Once/turn: Operation Meteor/G Team Lv≥6 destroys enemy with battle → may recover 2 HP.
  "GD03-125": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." }],
    },
    {
      id: "a3",
      display_text: "【Once per Turn】During your turn, when a friendly (Operation Meteor)/(G Team) Unit that is Lv.6 or higher destroys an enemy Unit with battle damage, that friendly Unit may recover 2 HP.",
      trigger: { type: "on_battle_destroy", qualifiers: { once_per_turn: true, your_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "If the destroying friendly Unit is (Operation Meteor)/(G Team) and Lv.6 or higher, it may recover 2 HP." }],
    },
  ],

  // GD03-126 — Burst: deploy self. Deploy: shield to hand. Static: all friendly tokens get AP+1 during opponent's turn.
  "GD03-126": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." }],
    },
    {
      id: "a3",
      display_text: "All friendly Unit tokens get AP+1 during your opponent's turn.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "During your opponent's turn, all friendly Unit tokens get AP+1." }],
    },
  ],

  // GD03-127 — Burst: deploy self. Deploy: shield to hand; then choose ZAFT Unit → AP+3.
  "GD03-127": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, choose 1 friendly (ZAFT) Unit. It gets AP+3 during this turn.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." },
        { action: "choose_target", filter: { all_of: [{ side: "friendly" }, { traits_include: ["ZAFT"] }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 3, duration: "end_of_turn" },
      ],
    },
  ],

  // GD03-128 — Burst: deploy self. Deploy: shield to hand. Once/turn (opponent's turn): when your Unit is rested by opponent's effect, deal 1 damage to enemy Unit.
  "GD03-128": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." }],
    },
    {
      id: "a3",
      display_text: "【Once per Turn】During your opponent's turn, when one of your Units is rested by one of your opponent's effects, choose 1 enemy Unit. Deal 1 damage to it.",
      trigger: { type: "on_friendly_rested_by_opponent_effect", qualifiers: { once_per_turn: true, opponent_turn_only: true } },
      steps: [
        { action: "choose_target", filter: { side: "enemy" }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1 },
      ],
    },
  ],

  // GD03-129 — Burst: deploy self. Deploy: shield to hand. Static triggered: when Tekkadan/Teiwaz receives effect damage, may rest this Base → mill 1.
  "GD03-129": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." }],
    },
    {
      id: "a3",
      display_text: "During your turn, when one of your friendly (Tekkadan)/(Teiwaz) Units receives effect damage, you may rest this Base. If you do, place the top card of your deck into your trash.",
      trigger: { type: "on_friendly_receives_effect_damage", qualifiers: { your_turn_only: true, source_traits: ["Tekkadan", "Teiwaz"] } },
      steps: [{ action: "manual_resolve", prompt_text: "You may rest this Base. If you do, place the top card of your deck into your trash." }],
    },
  ],

  // GD03-130 — Burst: deploy self. Deploy: shield to hand; if your turn, may deploy Vagan Unit ≤Lv4 from trash (pay cost).
  "GD03-130": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, if it is your turn, you may choose 1 (Vagan) Unit card that is Lv.4 or lower from your trash. Pay its cost to deploy it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand. If it is your turn, you may choose 1 (Vagan) Unit card that is Lv.4 or lower from your trash and pay its cost to deploy it." },
      ],
    },
  ],

  // GD03-131 — Burst: deploy self. Deploy: shield to hand; if ≥2 Triple Ship Alliance Units in play, return enemy Unit ≤Lv4 to hand.
  "GD03-131": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, if you have 2 or more (Triple Ship Alliance) Units in play, choose 1 enemy Unit that is Lv.4 or lower. Return it to its owner's hand.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." },
        {
          action: "choose_target", filter: { all_of: [{ side: "enemy" }, { level: { op: "<=", value: 4 } }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target",
          condition: { type: "count", filter: { all_of: [{ side: "friendly" }, { traits_include: ["Triple Ship Alliance"] }] }, op: ">=", value: 2 },
        },
        {
          action: "move_to_hand", target: "$target",
          condition: { type: "count", filter: { all_of: [{ side: "friendly" }, { traits_include: ["Triple Ship Alliance"] }] }, op: ">=", value: 2 },
        },
      ],
    },
  ],

  // GD03-132 — Burst: deploy self. Deploy: shield to hand. Destroyed: if AEUG Link Unit in play, rest enemy ≤4 HP.
  "GD03-132": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: { exclude_self: false } } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." }],
    },
    {
      id: "a3",
      display_text: "【Destroyed】If you have an (AEUG) Link Unit in play, choose 1 enemy Unit with 4 or less HP. Rest it.",
      trigger: { type: "on_destroyed" },
      steps: [
        {
          action: "choose_target", filter: { all_of: [{ side: "enemy" }, { hp: { op: "<=", value: 4 } }] }, selector: "controller_chooses", min: 1, max: 1, store_as: "$target",
          condition: { type: "count", filter: { all_of: [{ side: "friendly" }, { traits_include: ["AEUG"] }, { is_linked: true }] }, op: ">=", value: 1 },
        },
        {
          action: "rest", target: "$target",
          condition: { type: "count", filter: { all_of: [{ side: "friendly" }, { traits_include: ["AEUG"] }, { is_linked: true }] }, op: ">=", value: 1 },
        },
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
  log("Seeding GD03 abilities…\n");
  for (const [id, abilities] of Object.entries(ABILITIES)) {
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
