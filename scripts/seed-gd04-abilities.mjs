/**
 * Seeds structured abilities for all GD04 cards directly into Supabase.
 * Usage: node scripts/seed-gd04-abilities.mjs
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
// Convenience shorthands that produce valid FilterSchema discriminated-union objects.
// Use these instead of multi-key shorthand objects in filter fields below.

const F = {
  friendly:          { side: "friendly" },
  enemy:             { side: "enemy" },
  self:              { exclude_self: false },   // targets the source card itself
  notSelf:           { exclude_self: true },
  rested:            { is_resting: true },
  active:            { is_resting: false },

  traits:   (...t)  => ({ traits_include: t }),
  maxHp:    (n)     => ({ hp:    { op: "<=", value: n } }),
  minHp:    (n)     => ({ hp:    { op: ">=", value: n } }),
  maxLevel: (n)     => ({ level: { op: "<=", value: n } }),
  minLevel: (n)     => ({ level: { op: ">=", value: n } }),
  maxAp:    (n)     => ({ ap:    { op: "<=", value: n } }),
  minAp:    (n)     => ({ ap:    { op: ">=", value: n } }),

  all: (...clauses) => ({ all_of: clauses }),
};

// ─── Abilities ────────────────────────────────────────────────────────────────

const ABILITIES = {

  // GD04-001 — During Link + Attack (attacking a unit): may return blue Pilot paired with this Unit to hand.
  // Step order matters: resolve $paired_pilot FIRST (locks in the specific card instance),
  // THEN ask the player yes/no, THEN move that exact instance to hand.
  // paired_with_source resolves to the pilot whose instance_id === source unit's paired_with_instance_id.
  // requires_link guarantees a linked pilot exists when this fires, so all_matching will always find exactly 1.
  "GD04-001": [
    {
      id: "a1",
      display_text: "【During Link】【Attack】If you are attacking an enemy Unit, you may return a blue Pilot paired with this Unit to its owner's hand.",
      trigger: { type: "on_attack", qualifiers: { requires_link: true, target_is_unit: true } },
      steps: [
        // Identify the specific pilot instance upfront — stored before the choice is offered.
        { action: "all_matching", filter: { paired_with_source: true }, store_as: "$paired_pilot" },
        {
          action: "prompt_yes_no",
          prompt: "Return the Pilot paired with this Unit to your hand?",
          store_as: "$choice",
          on_yes: [
            { action: "move_to_hand", target: "$paired_pilot" },
          ],
        },
      ],
    },
  ],

  // GD04-002 — Static: EF Units get AP+1 your turn. Deploy: this turn, when EF Unit destroys enemy with battle damage, rest enemy ≤5 HP.
  "GD04-002": [
    {
      id: "a1",
      display_text: "During your turn, all your (Earth Federation) Units get AP+1.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "During your turn, all your (Earth Federation) Units get AP+1." }],
    },
    {
      id: "a2",
      display_text: "【Deploy】During this turn, when one of your (Earth Federation) Units destroys an enemy Unit with battle damage, choose 1 enemy Unit with 5 or less HP. Rest it.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Until end of turn: when an (Earth Federation) Unit destroys an enemy Unit with battle damage, choose 1 enemy Unit with 5 or less HP and rest it." }],
    },
  ],

  // GD04-003 — Attack: if ≥3 League Militaire Units in play, draw 1.
  "GD04-003": [
    {
      id: "a1",
      display_text: "【Attack】If you have 3 or more (League Militaire) Units in play, draw 1.",
      trigger: { type: "on_attack" },
      steps: [
        {
          action: "draw", side: "friendly", amount: 1,
          condition: { type: "count", filter: F.all(F.friendly, F.traits("League Militaire")), op: ">=", value: 3 },
        },
      ],
    },
  ],

  // GD04-004 — Repair 2 always-on (correct). Once/turn: when pairing Cyber-Newtype Pilot with blue Unit, draw 1.
  "GD04-004": [
    {
      id: "a1",
      display_text: "【Once per Turn】When you pair a (Cyber-Newtype) Pilot with one of your blue Units, draw 1.",
      trigger: { type: "on_pair", qualifiers: { once_per_turn: true, pilot_traits_include: ["Cyber-Newtype"], unit_color: "blue" } },
      steps: [{ action: "draw", side: "friendly", amount: 1 }],
    },
  ],

  // GD04-005 — No abilities.
  "GD04-005": [],

  // GD04-006 — Breach 3 always-on (correct). Activated Main (once/turn): rest another LM Unit → rest enemy ≤4 HP.
  "GD04-006": [
    {
      id: "a1",
      display_text: "【Activate･Main】【Once per Turn】Rest 1 of your other (League Militaire) Units: Choose 1 enemy Unit with 4 or less HP. Rest it.",
      trigger: { type: "activated_main", qualifiers: { once_per_turn: true } },
      steps: [
        { action: "choose_target", filter: F.all(F.friendly, F.traits("League Militaire"), F.notSelf, F.active), selector: "controller_chooses", min: 1, max: 1, store_as: "$cost" },
        { action: "rest", target: "$cost" },
        { action: "choose_target", filter: F.all(F.enemy, F.maxHp(4)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "rest", target: "$target" },
      ],
    },
  ],

  // GD04-007 — During Pair / Attack: deploy Parts token (League Militaire, AP1, HP1, can't target player).
  "GD04-007": [
    {
      id: "a1",
      display_text: "【During Pair】【Attack】Deploy 1 [Parts]((League Militaire)･AP1･HP1･This Unit can't choose the enemy player as its attack target) Unit token.",
      trigger: { type: "on_attack", qualifiers: { requires_pair: true } },
      steps: [
        {
          action: "create_token",
          token_id: "parts_league_militaire_ap1_hp1",
          count: 1, side: "friendly", rest_state: "rested",
        },
      ],
    },
  ],

  // GD04-008 — During Link: gains High-Maneuver while linked.
  "GD04-008": [
    {
      id: "a1",
      display_text: "【During Link】This Unit gains <High-Maneuver>.",
      trigger: { type: "during_link" },
      steps: [{ action: "gain_keyword", target: { filter: F.self }, keywords: [{ keyword: "high_maneuver" }], duration: "while_linked" }],
    },
  ],

  // GD04-009 — When Linked: set active another White Base Team Unit ≥Lv4.
  "GD04-009": [
    {
      id: "a1",
      display_text: "【When Linked】Choose 1 of your other (White Base Team) Units that is Lv.4 or higher. Set it as active.",
      trigger: { type: "on_linked" },
      steps: [
        { action: "choose_target", filter: F.all(F.friendly, F.traits("White Base Team"), F.minLevel(4), F.notSelf), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "ready", target: "$target" },
      ],
    },
  ],

  // GD04-010 — No abilities.
  "GD04-010": [],

  // GD04-011 — Destroyed: if another LM Unit in play, deploy Parts token.
  "GD04-011": [
    {
      id: "a1",
      display_text: "【Destroyed】If another friendly (League Militaire) Unit is in play, deploy 1 [Parts]((League Militaire)･AP1･HP1･This Unit can't choose the enemy player as its attack target) Unit token.",
      trigger: { type: "on_destroyed" },
      steps: [
        {
          action: "create_token",
          token_id: "parts_league_militaire_ap1_hp1",
          count: 1, side: "friendly", rest_state: "rested",
          condition: { type: "count", filter: F.all(F.friendly, F.traits("League Militaire"), F.notSelf), op: ">=", value: 1 },
        },
      ],
    },
  ],

  // GD04-012 — No abilities.
  "GD04-012": [],

  // GD04-013 — Blocker scraper artifact. Static: while rested, all LM tokens gain Blocker.
  "GD04-013": [
    {
      id: "a1",
      display_text: "While this Unit is rested, all your (League Militaire) Unit tokens gain <Blocker>.",
      trigger: { type: "static" },
      notes: "Scraper artifact: blocker in keywords[] is conditional — this Unit gives Blocker to (League Militaire) tokens only while this Unit is rested.",
      steps: [{ action: "manual_resolve", prompt_text: "While this Unit is rested, all your (League Militaire) Unit tokens gain <Blocker>." }],
    },
  ],

  // GD04-014 — No abilities.
  "GD04-014": [],

  // GD04-015 — Deploy: rest one active LM Unit and one enemy Unit ≤Lv3.
  "GD04-015": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 of your active (League Militaire) Units and 1 enemy Unit that is Lv.3 or lower. Rest them.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: F.all(F.friendly, F.traits("League Militaire"), F.active), selector: "controller_chooses", min: 1, max: 1, store_as: "$friendly" },
        { action: "choose_target", filter: F.all(F.enemy, F.maxLevel(3)), selector: "controller_chooses", min: 1, max: 1, store_as: "$enemy" },
        { action: "rest", target: "$friendly" },
        { action: "rest", target: "$enemy" },
      ],
    },
  ],

  // GD04-016 — Blocker always-on. Static: can't choose enemy player as attack target.
  "GD04-016": [
    {
      id: "a1",
      display_text: "This Unit can't choose the enemy player as its attack target.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "This Unit can't choose the enemy player as its attack target." }],
    },
  ],

  // GD04-017 — When Paired + Newtype Pilot: deploy 2 Wire-Guided Arm tokens (can't be paired). Destroyed: deploy rested Zeong (Head) token.
  "GD04-017": [
    {
      id: "a1",
      display_text: "【When Paired･(Newtype) Pilot】Deploy 2 [Wire-Guided Arm]((Zeon)･AP2･HP1･This Unit can't be paired with a Pilot) Unit tokens.",
      trigger: { type: "on_pair", qualifiers: { pilot_traits_include: ["Newtype"] } },
      steps: [
        {
          action: "create_token",
          token_id: "wire_guided_arm_zeon_ap2_hp1",
          count: 2, side: "friendly", rest_state: "rested",
        },
      ],
    },
    {
      id: "a2",
      display_text: "【Destroyed】Deploy 1 rested [Zeong (Head)]((Zeon)･AP3･HP1) Unit token.",
      trigger: { type: "on_destroyed" },
      steps: [
        {
          action: "create_token",
          token_id: "zeong_head_zeon_ap3_hp1",
          count: 1, side: "friendly", rest_state: "rested",
        },
      ],
    },
  ],

  // GD04-018 — Breach 5 always-on. Once/turn: when another Academy Unit receives damage from enemy, place 1 EX Resource.
  "GD04-018": [
    {
      id: "a1",
      display_text: "【Once per Turn】During your turn, when one of your other (Academy) Units receives damage from an enemy, place 1 EX Resource.",
      trigger: { type: "on_friendly_receives_damage", qualifiers: { once_per_turn: true, your_turn_only: true, source_traits: ["Academy"], not_self: true } },
      steps: [{ action: "manual_resolve", prompt_text: "Place 1 EX Resource." }],
    },
  ],

  // GD04-019 — Breach 3 always-on. Destroyed: look at top 3, may reveal CB Unit ≤Lv5 and add to hand; rest go to deck bottom.
  "GD04-019": [
    {
      id: "a1",
      display_text: "【Destroyed】Look at the top 3 cards of your deck. You may reveal 1 (CB) Unit card that is Lv.5 or lower among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
      trigger: { type: "on_destroyed" },
      steps: [
        { action: "peek_top", side: "friendly", count: 3, reveal_to: "friendly", store_as: "$peeked" },
        { action: "manual_resolve", prompt_text: "You may reveal 1 (CB) Unit card that is Lv.5 or lower among the peeked cards and add it to your hand. Return the rest randomly to the bottom of your deck." },
      ],
    },
  ],

  // GD04-020 — Once/turn: when you play/activate a Dawn of Fold Command using EX Resource, draw 1.
  "GD04-020": [
    {
      id: "a1",
      display_text: "【Once per Turn】During your turn, when you play and activate a (Dawn of Fold) Command card using an EX Resource, draw 1.",
      trigger: { type: "on_command_played_with_ex_resource", qualifiers: { once_per_turn: true, command_traits: ["Dawn of Fold"] } },
      steps: [{ action: "draw", side: "friendly", amount: 1 }],
    },
  ],

  // GD04-021 — Breach 3 always-on. When you play/activate a Dawn of Fold Command using EX Resource: may pair that Command from trash with a Gundam Lfrith unit.
  "GD04-021": [
    {
      id: "a1",
      display_text: "During your turn, when you play and activate a (Dawn of Fold) Command card using an EX Resource, you may pair that card from your trash with one of your Units with 'Gundam Lfrith' in its card name.",
      trigger: { type: "on_command_played_with_ex_resource", qualifiers: { command_traits: ["Dawn of Fold"] } },
      steps: [{ action: "manual_resolve", prompt_text: "You may pair the just-played (Dawn of Fold) Command card (from your trash) with one of your Units with 'Gundam Lfrith' in its card name." }],
    },
  ],

  // GD04-022 — Static: all tokens gain Breach 1. During Link: all Units ≤Lv3 except tokens are deployed rested.
  "GD04-022": [
    {
      id: "a1",
      display_text: "All your Unit tokens gain <Breach 1>.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "All your Unit tokens gain <Breach 1>." }],
    },
    {
      id: "a2",
      display_text: "【During Link】All Units that are Lv.3 or lower other than Unit tokens are deployed rested.",
      trigger: { type: "during_link" },
      steps: [{ action: "manual_resolve", prompt_text: "While this Unit is linked, all Units (except tokens) that are Lv.3 or lower are deployed rested." }],
    },
  ],

  // GD04-023 — Deploy: choose Unit paired with Super Soldier Pilot → may target active enemy ≤Lv4 this turn.
  "GD04-023": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 of your Units paired with a (Super Soldier) Pilot. During this turn, it may choose an active enemy Unit that is Lv.4 or lower as its attack target.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: F.all(F.friendly, { is_paired: true }), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "During this turn, the chosen Unit (paired with a (Super Soldier) Pilot) may choose an active enemy Unit that is Lv.4 or lower as its attack target." },
      ],
    },
  ],

  // GD04-024 — Deploy: look at top 3, may reveal Academy Unit/Command and add to hand; rest to bottom.
  "GD04-024": [
    {
      id: "a1",
      display_text: "【Deploy】Look at the top 3 cards of your deck. You may reveal 1 (Academy) Unit card/Command card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "peek_top", side: "friendly", count: 3, reveal_to: "friendly", store_as: "$peeked" },
        { action: "manual_resolve", prompt_text: "You may reveal 1 (Academy) Unit or Command card among the peeked cards and add it to your hand. Return the rest randomly to the bottom of your deck." },
      ],
    },
  ],

  // GD04-025 — Destroyed (your turn): if another Dawn of Fold Unit in play, place 1 EX Resource.
  "GD04-025": [
    {
      id: "a1",
      display_text: "【Destroyed】During your turn, if you have another (Dawn of Fold) Unit in play, place 1 EX Resource.",
      trigger: { type: "on_destroyed", qualifiers: { your_turn_only: true } },
      steps: [
        {
          action: "manual_resolve", prompt_text: "Place 1 EX Resource.",
          condition: { type: "count", filter: F.all(F.friendly, F.traits("Dawn of Fold"), F.notSelf), op: ">=", value: 1 },
        },
      ],
    },
  ],

  // GD04-026 — Deploy: look at top card → return to top or place in trash.
  "GD04-026": [
    {
      id: "a1",
      display_text: "【Deploy】Look at the top card of your deck. Return it to the top of your deck or place it into your trash.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "peek_top", side: "friendly", count: 1, reveal_to: "friendly", store_as: "$peeked" },
        { action: "manual_resolve", prompt_text: "Return the peeked card to the top of your deck or place it into your trash." },
      ],
    },
  ],

  // GD04-027 — No abilities.
  "GD04-027": [],

  // GD04-028 — Blocker scraper artifact (given to enemy). Attack: choose active enemy Unit → it gains Blocker this turn.
  "GD04-028": [
    {
      id: "a1",
      display_text: "【Attack】Choose 1 active enemy Unit. It gains <Blocker> during this turn.",
      trigger: { type: "on_attack" },
      notes: "Scraper artifact: blocker in keywords[] is not on this Unit — this card gives <Blocker> to an enemy Unit to redirect attacks toward it.",
      steps: [
        { action: "choose_target", filter: F.all(F.enemy, F.active), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "gain_keyword", target: "$target", keywords: [{ keyword: "blocker" }], duration: "end_of_turn" },
      ],
    },
  ],

  // GD04-029 — Once/turn: if CB Pilot in play, when this Unit receives damage from enemy, reduce by 1.
  "GD04-029": [
    {
      id: "a1",
      display_text: "【Once per Turn】If you have a (CB) Pilot in play, when this Unit receives damage from an enemy, reduce it by 1.",
      trigger: { type: "on_receives_damage", qualifiers: { once_per_turn: true, from_enemy: true } },
      steps: [
        {
          action: "manual_resolve", prompt_text: "Reduce the damage this Unit receives by 1.",
          condition: { type: "count", filter: F.all(F.friendly, { card_type: "pilot" }, F.traits("CB")), op: ">=", value: 1 },
        },
      ],
    },
  ],

  // GD04-030 — Attack: choose another Academy Unit → may target active enemy ≤Lv3 this turn.
  "GD04-030": [
    {
      id: "a1",
      display_text: "【Attack】Choose 1 of your other (Academy) Units. During this turn, it may choose an active enemy Unit that is Lv.3 or lower as its attack target.",
      trigger: { type: "on_attack" },
      steps: [
        { action: "choose_target", filter: F.all(F.friendly, F.traits("Academy"), F.notSelf), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "During this turn, the chosen (Academy) Unit may choose an active enemy Unit that is Lv.3 or lower as its attack target." },
      ],
    },
  ],

  // GD04-031 — No abilities.
  "GD04-031": [],

  // GD04-032 — No abilities.
  "GD04-032": [],

  // GD04-033 — Triggered: when this or any Neo Zeon Unit is deployed, deal 3 damage to enemy Unit. During Link: all Units gain Neo Zeon.
  "GD04-033": [
    {
      id: "a1",
      display_text: "When this Unit or one of your (Neo Zeon) Units is deployed, choose 1 enemy Unit. Deal 3 damage to it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: F.enemy, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 3 },
      ],
    },
    {
      id: "a2",
      display_text: "【During Link】All your Units gain (Neo Zeon).",
      trigger: { type: "during_link" },
      steps: [{ action: "manual_resolve", prompt_text: "While this Unit is linked, all your Units gain the (Neo Zeon) trait." }],
    },
  ],

  // GD04-034 — First Strike always-on (correct). During Link: gets AP+2 for each rested CB Unit.
  "GD04-034": [
    {
      id: "a1",
      display_text: "【During Link】This Unit gets AP+2 for each of your rested (CB) Units.",
      trigger: { type: "during_link" },
      steps: [{ action: "manual_resolve", prompt_text: "While linked, this Unit gets AP+2 for each of your rested (CB) Units (including this Unit if rested)." }],
    },
  ],

  // GD04-035 — Deploy: choose Mafty Unit → if it destroys enemy with battle damage this turn and ≤3 cards in hand, draw 1.
  "GD04-035": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 of your (Mafty) Units. When it destroys an enemy Unit with battle damage during this turn, if you have 3 or less cards in your hand, draw 1.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: F.all(F.friendly, F.traits("Mafty")), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "Until end of turn: when the chosen (Mafty) Unit destroys an enemy Unit with battle damage, if you have 3 or less cards in hand, draw 1." },
      ],
    },
  ],

  // GD04-036 — Deploy: may rest 1–2 active CB Units → deal damage = number rested to all enemy Units ≤Lv6.
  "GD04-036": [
    {
      id: "a1",
      display_text: "【Deploy】You may choose 1 to 2 of your other active (CB) Units. Rest them. If you do, deal damage equal to the number of Units rested with this effect to all enemy Units that are Lv.6 or lower.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: F.all(F.friendly, F.traits("CB"), F.active, F.notSelf), selector: "controller_chooses", min: 0, max: 2, store_as: "$costs", optional: true },
        { action: "rest", target: "$costs", condition: { type: "has_card", filter: { card_id: "$costs" } } },
        { action: "manual_resolve", prompt_text: "Deal damage equal to the number of Units just rested to all enemy Units that are Lv.6 or lower." },
      ],
    },
  ],

  // GD04-037 — First Strike + Breach 3 both conditional. Scraper artifacts.
  "GD04-037": [
    {
      id: "a1",
      display_text: "While you have a red (Super Soldier) Pilot in play, this Unit gains <First Strike>.",
      trigger: { type: "static" },
      notes: "Scraper artifact: first_strike and breach3 in keywords[] are conditional — each requires a specific-colored (Super Soldier) Pilot in play.",
      steps: [{ action: "manual_resolve", prompt_text: "While you have a red (Super Soldier) Pilot in play, this Unit gains <First Strike>." }],
    },
    {
      id: "a2",
      display_text: "While you have a green (Super Soldier) Pilot in play, this Unit gains <Breach 3>.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While you have a green (Super Soldier) Pilot in play, this Unit gains <Breach 3>." }],
    },
  ],

  // GD04-038 — Deploy: if ≥2 enemy Units in play, deal 2 damage to enemy ≤Lv2.
  "GD04-038": [
    {
      id: "a1",
      display_text: "【Deploy】If 2 or more enemy Units are in play, choose 1 enemy Unit that is Lv.2 or lower. Deal 2 damage to it.",
      trigger: { type: "on_deploy" },
      steps: [
        {
          action: "choose_target", filter: F.all(F.enemy, F.maxLevel(2)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target",
          condition: { type: "count", filter: F.enemy, op: ">=", value: 2 },
        },
        {
          action: "deal_damage", target: "$target", amount: 2,
          condition: { type: "count", filter: F.enemy, op: ">=", value: 2 },
        },
      ],
    },
  ],

  // GD04-039 — Repair scraper artifact (refers to target card's keyword). Static cost reduction. Deploy: deal 1 or 3 damage.
  "GD04-039": [
    {
      id: "a1",
      display_text: "If there are 8 or more (Neo Zeon) cards in your trash, this card in your hand gets cost -4.",
      trigger: { type: "static" },
      notes: "Scraper artifact: repair in keywords[] refers to the enemy Unit's <Repair> keyword (used in the deploy effect target check), not a keyword on this card.",
      steps: [{ action: "manual_resolve", prompt_text: "While there are 8 or more (Neo Zeon) cards in your trash, this card in your hand gets cost -4." }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Choose 1 enemy Unit. Deal 1 damage to it. If it has <Repair>, deal 3 damage instead.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: F.enemy, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "Deal 1 damage to the chosen enemy Unit. If it has <Repair>, deal 3 damage instead." },
      ],
    },
  ],

  // GD04-040 — No abilities.
  "GD04-040": [],

  // GD04-041 — Once/turn: when this Unit is rested by an effect, set it as active.
  "GD04-041": [
    {
      id: "a1",
      display_text: "【Once per Turn】When this Unit is rested by an effect, set it as active.",
      trigger: { type: "on_rested_by_effect", qualifiers: { once_per_turn: true } },
      steps: [{ action: "ready", target: { filter: F.self } }],
    },
  ],

  // GD04-042 — During Link (once/turn): when a Cyber-Newtype Pilot unit's damage destroys enemy shield, deal 2 damage to enemy ≤5 AP.
  "GD04-042": [
    {
      id: "a1",
      display_text: "【During Link】【Once per Turn】When damage from one of your Units paired with a (Cyber-Newtype) Pilot destroys an enemy shield area card, choose 1 enemy Unit with 5 or less AP. Deal 2 damage to it.",
      trigger: { type: "on_shield_destroy", qualifiers: { requires_link: true, once_per_turn: true, source_pilot_traits: ["Cyber-Newtype"] } },
      steps: [
        { action: "choose_target", filter: F.all(F.enemy, F.maxAp(5)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 2 },
      ],
    },
  ],

  // GD04-043 — Deploy: deal 1 damage to enemy Base.
  "GD04-043": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 enemy Base. Deal 1 damage to it.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 enemy Base and deal 1 damage to it." }],
    },
  ],

  // GD04-044 — Breach 3 conditional (when attacking damaged enemy). Scraper artifact.
  "GD04-044": [
    {
      id: "a1",
      display_text: "【Attack】If you are attacking a damaged enemy Unit, this Unit gains <Breach 3> during this battle.",
      trigger: { type: "on_attack" },
      notes: "Scraper artifact: breach3 in keywords[] applies only when attacking a damaged enemy Unit.",
      steps: [{ action: "manual_resolve", prompt_text: "If attacking a damaged enemy Unit (damage > 0), this Unit gains <Breach 3> during this battle." }],
    },
  ],

  // GD04-045 — When Linked: choose CB Unit → may target damaged active enemy this turn.
  "GD04-045": [
    {
      id: "a1",
      display_text: "【When Linked】Choose 1 of your (CB) Units. During this turn, it may choose a damaged active enemy Unit as its attack target.",
      trigger: { type: "on_linked" },
      steps: [
        { action: "choose_target", filter: F.all(F.friendly, F.traits("CB")), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "During this turn, the chosen (CB) Unit may choose a damaged active enemy Unit as its attack target." },
      ],
    },
  ],

  // GD04-046 — Deploy: may rest self → deal 2 damage to enemy ≤Lv3.
  "GD04-046": [
    {
      id: "a1",
      display_text: "【Deploy】You may rest this Unit. If you do, choose 1 enemy Unit that is Lv.3 or lower. Deal 2 damage to it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "prompt_yes_no", prompt: "Rest this Unit to deal 2 damage to an enemy Unit Lv.3 or lower?", store_as: "$do_it",
          on_yes: [
            { action: "rest", target: { filter: F.self } },
            { action: "choose_target", filter: F.all(F.enemy, F.maxLevel(3)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
            { action: "deal_damage", target: "$target", amount: 2 },
          ],
        },
      ],
    },
  ],

  // GD04-047 — No abilities.
  "GD04-047": [],

  // GD04-048 — No abilities.
  "GD04-048": [],

  // GD04-049 — Suppression always-on. During Pair / Attack: if attacking player, may exile 7 Vulture → destroy enemy Unit/Base ≤Lv8.
  "GD04-049": [
    {
      id: "a1",
      display_text: "【During Pair】【Attack】If you are attacking the enemy player, you may choose 7 (Vulture) cards from your trash. Exile them from the game. If you do, choose 1 enemy Unit/Base that is Lv.8 or lower. Destroy it.",
      trigger: { type: "on_attack", qualifiers: { requires_pair: true, attacking_player: true } },
      steps: [{ action: "manual_resolve", prompt_text: "If attacking the enemy player: you may exile 7 (Vulture) cards from your trash. If you do, choose 1 enemy Unit or Base that is Lv.8 or lower and destroy it." }],
    },
  ],

  // GD04-050 — High-Maneuver always-on (correct). During Pair / Attack: may choose Minerva Squad Unit from trash, pay cost to deploy.
  "GD04-050": [
    {
      id: "a1",
      display_text: "【During Pair】【Attack】You may choose 1 (Minerva Squad) Unit card from your trash. Pay its cost to deploy it.",
      trigger: { type: "on_attack", qualifiers: { requires_pair: true } },
      steps: [{ action: "manual_resolve", prompt_text: "You may choose 1 (Minerva Squad) Unit card from your trash and pay its cost to deploy it." }],
    },
  ],

  // GD04-051 — During Pair + Vulture Pilot: if ≥7 cards in trash, may target active enemy with keyword effect.
  "GD04-051": [
    {
      id: "a1",
      display_text: "【During Pair･(Vulture) Pilot】If there are 7 or more cards in your trash, this Unit may choose an active enemy Unit with a keyword effect as its attack target.",
      trigger: { type: "during_pair", qualifiers: { pilot_traits_include: ["Vulture"] } },
      steps: [{ action: "manual_resolve", prompt_text: "While paired with a (Vulture) Pilot and there are 7 or more cards in your trash, this Unit may choose an active enemy Unit that has a keyword ability as its attack target." }],
    },
  ],

  // GD04-052 — During Pair / Attack: may deal 2 damage to enemy Unit and 2 damage to self.
  "GD04-052": [
    {
      id: "a1",
      display_text: "【During Pair】【Attack】You may choose 1 enemy Unit. Deal 2 damage to it and this Unit.",
      trigger: { type: "on_attack", qualifiers: { requires_pair: true } },
      steps: [
        { action: "prompt_yes_no", prompt: "Deal 2 damage to an enemy Unit and 2 damage to this Unit?", store_as: "$do_it",
          on_yes: [
            { action: "choose_target", filter: F.enemy, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
            { action: "deal_damage", target: "$target", amount: 2 },
            { action: "deal_damage", target: { filter: F.self }, amount: 2 },
          ],
        },
      ],
    },
  ],

  // GD04-053 — During Link (once/turn): when this Unit receives damage from enemy, reduce by 1.
  "GD04-053": [
    {
      id: "a1",
      display_text: "【During Link】【Once per Turn】When this Unit receives damage from an enemy, reduce it by 1.",
      trigger: { type: "on_receives_damage", qualifiers: { requires_link: true, once_per_turn: true, from_enemy: true } },
      steps: [{ action: "manual_resolve", prompt_text: "Reduce the damage this Unit receives from an enemy by 1." }],
    },
  ],

  // GD04-054 — When this Unit deals battle damage to enemy Unit, destroy that Unit.
  "GD04-054": [
    {
      id: "a1",
      display_text: "When this Unit deals battle damage to an enemy Unit, destroy that enemy Unit.",
      trigger: { type: "on_battle_damage_dealt" },
      steps: [{ action: "manual_resolve", prompt_text: "Destroy the enemy Unit that this Unit dealt battle damage to." }],
    },
  ],

  // GD04-055 — No abilities.
  "GD04-055": [],

  // GD04-056 — Deploy: deal 1 damage to self → rest enemy ≤3 AP.
  "GD04-056": [
    {
      id: "a1",
      display_text: "【Deploy】Deal 1 damage to this Unit. If you do, choose 1 enemy Unit with 3 or less AP. Rest it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "deal_damage", target: { filter: F.self }, amount: 1 },
        { action: "choose_target", filter: F.all(F.enemy, F.maxAp(3)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "rest", target: "$target" },
      ],
    },
  ],

  // GD04-057 — Deploy: choose enemy ≤Lv6 → reduce AP by # of "Gundam Virtue" in trash.
  "GD04-057": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 enemy Unit that is Lv.6 or lower. During this turn, reduce its AP by an amount equal to the number of Unit cards with 'Gundam Virtue' in their card names in your trash.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: F.all(F.enemy, F.maxLevel(6)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "Reduce the chosen enemy Unit's AP by the number of Unit cards with 'Gundam Virtue' in their card name in your trash (until end of turn)." },
      ],
    },
  ],

  // GD04-058 — During Pair + Vulture Pilot / Destroyed (your turn): return paired Pilot to hand.
  "GD04-058": [
    {
      id: "a1",
      display_text: "【During Pair･(Vulture) Pilot】【Destroyed】If it is your turn, return this Unit's paired Pilot to its owner's hand.",
      trigger: { type: "on_destroyed", qualifiers: { requires_pair: true, pilot_traits_include: ["Vulture"], your_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "Return the (Vulture) Pilot paired with this Unit to your hand." }],
    },
  ],

  // GD04-059 — No abilities.
  "GD04-059": [],

  // GD04-060 — Deploy: if deployed from trash, draw 1.
  "GD04-060": [
    {
      id: "a1",
      display_text: "【Deploy】If you deploy this Unit from your trash, draw 1.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "If this Unit was deployed from your trash, draw 1." }],
    },
  ],

  // GD04-061 — Blocker always-on. Static: can't attack while ≤6 cards in trash.
  "GD04-061": [
    {
      id: "a1",
      display_text: "This Unit can't attack while there are 6 or less cards in your trash.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "This Unit can't attack while there are 6 or less cards in your trash." }],
    },
  ],

  // GD04-062 — No abilities.
  "GD04-062": [],

  // GD04-063 — Deploy: destroy enemy ≤Lv1 or ≤1 AP.
  "GD04-063": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 enemy Unit that is Lv.1 or lower or has 1 or less AP. Destroy it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "manual_resolve", prompt_text: "Choose 1 enemy Unit that is Lv.1 or lower OR has 1 or less AP. Destroy it." },
      ],
    },
  ],

  // GD04-064 — No abilities.
  "GD04-064": [],

  // GD04-065 — During Link / Activated Main: exile 3 blue cards from trash → set self active (can't target player this turn). Attack: all enemy Units AP-1.
  "GD04-065": [
    {
      id: "a1",
      display_text: "【During Link】【Activate･Main】Exile 3 blue cards from your trash: Set this Unit as active. It can't choose the enemy player as its attack target during this turn.",
      trigger: { type: "activated_main", qualifiers: { requires_link: true } },
      steps: [
        { action: "manual_resolve", prompt_text: "Exile 3 blue cards from your trash. If you do, set this Unit as active. It can't choose the enemy player as its attack target this turn." },
      ],
    },
    {
      id: "a2",
      display_text: "【Attack】All enemy Units get AP-1 during this turn.",
      trigger: { type: "on_attack" },
      steps: [
        { action: "all_matching", filter: F.enemy, store_as: "$enemies" },
        { action: "modify_stat", target: "$enemies", stat: "ap", amount: -1, duration: "end_of_turn" },
      ],
    },
  ],

  // GD04-066 — Suppression always-on. When activate a Command's Main/Action: enemy Unit AP-2 this turn.
  "GD04-066": [
    {
      id: "a1",
      display_text: "When you activate a Command's 【Main】/【Action】 effect, choose 1 enemy Unit. It gets AP-2 during this turn.",
      trigger: { type: "on_command_activated" },
      steps: [
        { action: "choose_target", filter: F.enemy, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: -2, duration: "end_of_turn" },
      ],
    },
  ],

  // GD04-067 — All keywords scraper artifacts. Activated Main (once/turn): ① → copy keywords from trash Unit + AP+1.
  "GD04-067": [
    {
      id: "a1",
      display_text: "【Activate･Main】【Once per Turn】①: Choose 1 Unit card with <Repair>/<Breach>/<First Strike>/<Support>/<High-Maneuver>/<Suppression>/<Blocker> from your trash. During this turn, this Unit gets AP+1 and all those keywords on that Unit card.",
      trigger: { type: "activated_main", qualifiers: { once_per_turn: true, resource_cost: 1 } },
      notes: "Scraper artifact: all keywords in keywords[] are conditional — this unit copies keywords from a unit card in trash each activation.",
      steps: [
        { action: "manual_resolve", prompt_text: "Pay ① and choose 1 Unit card with at least one keyword from your trash. This Unit gets AP+1 and gains all the keywords on that chosen card until end of turn." },
      ],
    },
  ],

  // GD04-068 — Blocker always-on. When receives effect damage from enemy, reduce by 3.
  "GD04-068": [
    {
      id: "a1",
      display_text: "When this Unit receives effect damage from an enemy, reduce it by 3.",
      trigger: { type: "on_receives_effect_damage", qualifiers: { from_enemy: true } },
      steps: [{ action: "manual_resolve", prompt_text: "Reduce the effect damage this Unit receives from an enemy by 3." }],
    },
  ],

  // GD04-069 — Blocker always-on. During Link: at end of turn when you paid ① for Militia/Dianna Counter unit effect, set a Militia Unit active.
  "GD04-069": [
    {
      id: "a1",
      display_text: "【During Link】At the end of a turn where you have paid ① or more for one of your other (Militia)/(Dianna Counter) Units' effects, choose 1 of your (Militia) Units. Set it as active.",
      trigger: { type: "on_end_phase", qualifiers: { requires_link: true } },
      steps: [{ action: "manual_resolve", prompt_text: "If you paid ① or more for a (Militia)/(Dianna Counter) Unit's effect this turn, choose 1 of your (Militia) Units and set it as active." }],
    },
  ],

  // GD04-070 — Deploy: may pair "Ali al-Saachez" Pilot from hand with this Unit.
  "GD04-070": [
    {
      id: "a1",
      display_text: "【Deploy】You may pair 1 Pilot card with 'Ali al-Saachez' in its card name from your hand with this Unit.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "You may pair 1 Pilot card with 'Ali al-Saachez' in its card name from your hand with this Unit." }],
    },
  ],

  // GD04-071 — Burst: if enemy CB Unit in play, add to hand. Activated Main: exile Superpower Bloc + UN from trash → set active, can't attack.
  "GD04-071": [
    {
      id: "a1",
      display_text: "【Burst】If an enemy (CB) Unit is in play, add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [
        {
          action: "move_to_hand", target: { filter: F.self },
          condition: { type: "count", filter: F.all(F.enemy, F.traits("CB")), op: ">=", value: 1 },
        },
      ],
    },
    {
      id: "a2",
      display_text: "【Activate･Main】Choose 1 (Superpower Bloc) card and 1 (UN) card from your trash. Exile them from the game. If you do, set this Unit as active. It can't attack during this turn.",
      trigger: { type: "activated_main" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 (Superpower Bloc) card and 1 (UN) card from your trash and exile them. If you do, set this Unit as active. It can't attack this turn." }],
    },
  ],

  // GD04-072 — When Linked: return enemy ≤3 HP to hand.
  "GD04-072": [
    {
      id: "a1",
      display_text: "【When Linked】Choose 1 enemy Unit with 3 or less HP. Return it to its owner's hand.",
      trigger: { type: "on_linked" },
      steps: [
        { action: "choose_target", filter: F.all(F.enemy, F.maxHp(3)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "move_to_hand", target: "$target" },
      ],
    },
  ],

  // GD04-073 — Activated Main (once/turn): ① → AP+2 this turn.
  "GD04-073": [
    {
      id: "a1",
      display_text: "【Activate･Main】【Once per Turn】①: This Unit gets AP+2 during this turn.",
      trigger: { type: "activated_main", qualifiers: { once_per_turn: true, resource_cost: 1 } },
      steps: [{ action: "modify_stat", target: { filter: F.self }, stat: "ap", amount: 2, duration: "end_of_turn" }],
    },
  ],

  // GD04-074 — Attack: may pay ① → draw 1, discard 1.
  "GD04-074": [
    {
      id: "a1",
      display_text: "【Attack】You may pay ①. If you do, draw 1. Then, discard 1.",
      trigger: { type: "on_attack" },
      steps: [
        { action: "prompt_yes_no", prompt: "Pay ① to draw 1 then discard 1?", store_as: "$do_it",
          on_yes: [
            { action: "manual_resolve", prompt_text: "Pay ①." },
            { action: "draw", side: "friendly", amount: 1 },
            { action: "manual_resolve", prompt_text: "Discard 1 card from your hand." },
          ],
        },
      ],
    },
  ],

  // GD04-075 — Static cost reduction based on UN/Superpower Bloc Commands in trash.
  "GD04-075": [
    {
      id: "a1",
      display_text: "Reduce the cost of this card in your hand by an amount equal to the number of (UN)/(Superpower Bloc) Command cards in your trash.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "This card's cost in hand is reduced by the number of (UN)/(Superpower Bloc) Command cards in your trash." }],
    },
  ],

  // GD04-076 — No abilities.
  "GD04-076": [],

  // GD04-077 — Blocker always-on. No additional ability.
  "GD04-077": [],

  // GD04-078 — No abilities.
  "GD04-078": [],

  // GD04-079 — No abilities.
  "GD04-079": [],

  // GD04-080 — Destroyed: if another UN/Superpower Bloc Unit in play, deploy rested Alvaaron token (UN, AP4, HP1).
  "GD04-080": [
    {
      id: "a1",
      display_text: "【Destroyed】If you have another (UN)/(Superpower Bloc) Unit in play, deploy 1 rested [Alvaaron]((UN)･AP4･HP1) Unit token.",
      trigger: { type: "on_destroyed" },
      steps: [
        {
          action: "create_token",
          token_id: "alvaaron_un_ap4_hp1",
          count: 1, side: "friendly", rest_state: "rested",
          condition: { type: "count", filter: F.all(F.friendly, F.traits("UN", "Superpower Bloc"), F.notSelf), op: ">=", value: 1 },
        },
      ],
    },
  ],

  // ─── Pilots ───────────────────────────────────────────────────────────────────

  // GD04-081 — Burst: to hand. When Paired: if LM Unit, deploy Parts token.
  "GD04-081": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【When Paired】If this is a (League Militaire) Unit, deploy 1 [Parts]((League Militaire)･AP1･HP1･This Unit can't choose the enemy player as its attack target) Unit token.",
      trigger: { type: "on_pair" },
      steps: [
        {
          action: "create_token",
          token_id: "parts_league_militaire_ap1_hp1",
          count: 1, side: "friendly", rest_state: "rested",
          condition: { type: "has_card", filter: F.all(F.friendly, F.traits("League Militaire")) },
        },
      ],
    },
  ],

  // GD04-082 — Burst: to hand. When Linked: deal 1 damage to a rested Unit.
  "GD04-082": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【When Linked】Choose 1 rested Unit. Deal 1 damage to it.",
      trigger: { type: "on_linked" },
      steps: [
        { action: "choose_target", filter: F.rested, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1 },
      ],
    },
  ],

  // GD04-083 — Burst: to hand. Static: all LM tokens get AP+1.
  "GD04-083": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "All your (League Militaire) Unit tokens get AP+1.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "All your (League Militaire) Unit tokens get AP+1." }],
    },
  ],

  // GD04-084 — Burst: to hand. Attack: choose WBT Unit → AP+1.
  "GD04-084": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【Attack】Choose 1 of your (White Base Team) Units. It gets AP+1 during this turn.",
      trigger: { type: "on_attack" },
      steps: [
        { action: "choose_target", filter: F.all(F.friendly, F.traits("White Base Team")), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 1, duration: "end_of_turn" },
      ],
    },
  ],

  // GD04-085 — Burst: to hand. During Link (once/turn): when Academy Command played with EX Resource, if no EX remaining, place rested EX Resource.
  "GD04-085": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【During Link】【Once per Turn】When you play and activate an (Academy) Command card using an EX Resource, if you have no remaining EX Resources, place 1 rested EX Resource.",
      trigger: { type: "on_command_played_with_ex_resource", qualifiers: { requires_link: true, once_per_turn: true, command_traits: ["Academy"] } },
      steps: [{ action: "manual_resolve", prompt_text: "If you have no remaining EX Resources after playing this Command, place 1 rested EX Resource." }],
    },
  ],

  // GD04-086 — Burst: to hand. During Link / Destroyed: if no EX Resources, place 1 EX Resource.
  "GD04-086": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【During Link】【Destroyed】If you have no EX Resources, place 1 EX Resource.",
      trigger: { type: "on_destroyed", qualifiers: { requires_link: true } },
      steps: [{ action: "manual_resolve", prompt_text: "If you have no EX Resources, place 1 EX Resource." }],
    },
  ],

  // GD04-087 — Burst: to hand. During Link / Attack: may redirect battle damage to another Academy Unit.
  "GD04-087": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【During Link】【Attack】You may choose 1 of your (Academy) Units. During this battle, battle damage this Unit would receive is dealt to that Unit instead.",
      trigger: { type: "on_attack", qualifiers: { requires_link: true } },
      steps: [{ action: "manual_resolve", prompt_text: "You may choose 1 of your (Academy) Units. Battle damage this Unit would receive is redirected to the chosen Unit for this battle." }],
    },
  ],

  // GD04-088 — Burst: to hand. Static: when blocked by ≤Lv4 enemy, can't receive battle damage.
  "GD04-088": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "When this Unit is blocked by an enemy Unit that is Lv.4 or lower, it can't receive battle damage during this battle.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "When this Unit is blocked by an enemy Unit that is Lv.4 or lower, this Unit can't receive battle damage this battle." }],
    },
  ],

  // GD04-089 — Burst: to hand. Activated Main: Support 2 (correct keyword).
  "GD04-089": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【Activate･Main】<Support 2> (Rest this Unit. 1 other friendly Unit gets AP+2 during this turn.)",
      trigger: { type: "activated_main" },
      steps: [
        { action: "rest", target: { filter: F.self } },
        { action: "choose_target", filter: F.all(F.friendly, F.notSelf), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 2, duration: "end_of_turn" },
      ],
    },
  ],

  // GD04-090 — Burst: to hand. During Link (once/turn): when destroys enemy with battle damage, peek top 1 → if CB, may add to hand.
  "GD04-090": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【During Link】【Once per Turn】During your turn, when this Unit destroys an enemy Unit with battle damage, look at the top card of your deck. If it is a (CB) card, you may reveal it and add it to your hand. Return any remaining card to the bottom of your deck.",
      trigger: { type: "on_battle_destroy", qualifiers: { requires_link: true, once_per_turn: true, your_turn_only: true } },
      steps: [
        { action: "peek_top", side: "friendly", count: 1, reveal_to: "friendly", store_as: "$peeked" },
        { action: "manual_resolve", prompt_text: "If the peeked card is a (CB) card, you may reveal it and add it to your hand. Otherwise, return it to the bottom of your deck." },
      ],
    },
  ],

  // GD04-091 — Burst: to hand. Destroyed: deal 1 damage to undamaged enemy Unit.
  "GD04-091": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【Destroyed】Choose 1 undamaged enemy Unit. Deal 1 damage to it.",
      trigger: { type: "on_destroyed" },
      steps: [
        { action: "choose_target", filter: F.all(F.enemy, { is_damaged: false }), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1 },
      ],
    },
  ],

  // GD04-092 — Burst: to hand. When Linked: deal 1 damage to damaged enemy Unit.
  "GD04-092": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【When Linked】Choose 1 damaged enemy Unit. Deal 1 damage to it.",
      trigger: { type: "on_linked" },
      steps: [
        { action: "choose_target", filter: F.all(F.enemy, { is_damaged: true }), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1 },
      ],
    },
  ],

  // GD04-093 — Burst: to hand. When Linked: choose ZAFT Link Unit → reduce next damage it receives by 2.
  "GD04-093": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【When Linked】Choose 1 of your (ZAFT) Link Units. During this turn, reduce the next damage it receives by 2.",
      trigger: { type: "on_linked" },
      steps: [
        { action: "choose_target", filter: F.all(F.friendly, F.traits("ZAFT"), { is_linked: true }), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "Reduce the next damage the chosen (ZAFT) Link Unit receives by 2 during this turn." },
      ],
    },
  ],

  // GD04-094 — Suppression scraper artifact (refers to target card). Burst: to hand. When Linked: retrieve purple Suppression Unit from trash.
  "GD04-094": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      notes: "Scraper artifact: suppression in keywords[] refers to the card retrieved from trash having <Suppression>, not this Pilot having it permanently.",
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【When Linked】Choose 1 purple Unit card with <Suppression> from your trash. Add it to your hand.",
      trigger: { type: "on_linked" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 purple Unit card with <Suppression> from your trash and add it to your hand." }],
    },
  ],

  // GD04-095 — Burst: to hand. When Linked: choose Minerva Squad Unit → battle damage redirected to this Unit this turn.
  "GD04-095": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【When Linked】Choose 1 of your (Minerva Squad) Units. During this turn, battle damage it would receive is dealt to this Unit instead.",
      trigger: { type: "on_linked" },
      steps: [
        { action: "choose_target", filter: F.all(F.friendly, F.traits("Minerva Squad")), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "During this turn, battle damage the chosen (Minerva Squad) Unit would receive is redirected to this Pilot's Unit instead." },
      ],
    },
  ],

  // GD04-096 — Burst: to hand. During Link: when deals battle damage to enemy ≤Lv5, destroy it.
  "GD04-096": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【During Link】When this Unit deals battle damage to an enemy Unit that is Lv.5 or lower, destroy that enemy Unit.",
      trigger: { type: "on_battle_damage_dealt", qualifiers: { requires_link: true } },
      steps: [{ action: "manual_resolve", prompt_text: "If the enemy Unit that received battle damage is Lv.5 or lower, destroy it." }],
    },
  ],

  // GD04-097 — Burst: to hand. When Linked: return enemy ≤3 HP to hand.
  "GD04-097": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【When Linked】Choose 1 enemy Unit with 3 or less HP. Return it to its owner's hand.",
      trigger: { type: "on_linked" },
      steps: [
        { action: "choose_target", filter: F.all(F.enemy, F.maxHp(3)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "move_to_hand", target: "$target" },
      ],
    },
  ],

  // GD04-098 — Burst: to hand. During Link: when receives effect damage from enemy, reduce by 2.
  "GD04-098": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【During Link】When this Unit receives effect damage from an enemy, reduce it by 2.",
      trigger: { type: "on_receives_effect_damage", qualifiers: { requires_link: true, from_enemy: true } },
      steps: [{ action: "manual_resolve", prompt_text: "Reduce the effect damage this Unit receives from an enemy by 2." }],
    },
  ],

  // GD04-099 — Burst: to hand. During Link / Attack: may return enemy Pilot to hand.
  "GD04-099": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【During Link】【Attack】You may choose 1 enemy Pilot. Return it to its owner's hand.",
      trigger: { type: "on_attack", qualifiers: { requires_link: true } },
      steps: [{ action: "manual_resolve", prompt_text: "You may choose 1 enemy Pilot (paired with an enemy Unit) and return it to its owner's hand." }],
    },
  ],

  // GD04-100 — Burst: to hand. Once/turn: when you pay ① or more for friendly unit effect, AP += cost paid.
  "GD04-100": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【Once per Turn】When you pay ① or more cost for one of your Units' effects, you may increase this Unit's AP during this turn by an amount equal to the cost paid.",
      trigger: { type: "on_resource_payment_for_unit_effect", qualifiers: { once_per_turn: true } },
      steps: [{ action: "manual_resolve", prompt_text: "This Unit gets AP+(cost paid) during this turn." }],
    },
  ],

  // ─── Commands ─────────────────────────────────────────────────────────────────

  // GD04-101 — Burst: activate Main. Main/Action: friendly Units can't be destroyed by enemy effects this turn; draw 1.
  "GD04-101": [
    {
      id: "a1",
      display_text: "【Burst】Activate this card's 【Main】.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Activate this card's 【Main】 effect." }],
    },
    {
      id: "a2",
      display_text: "【Main】/【Action】During this turn, friendly Units can't be destroyed by enemy effects. Then, draw 1.",
      trigger: { type: "activated_main_or_action" },
      steps: [
        { action: "manual_resolve", prompt_text: "During this turn, friendly Units can't be destroyed by enemy effects." },
        { action: "draw", side: "friendly", amount: 1 },
      ],
    },
  ],

  // GD04-102 — Burst: draw 1. Main: rested enemy ≤Lv5 won't be set active next opponent start phase.
  "GD04-102": [
    {
      id: "a1",
      display_text: "【Burst】Draw 1.",
      trigger: { type: "on_burst" },
      steps: [{ action: "draw", side: "friendly", amount: 1 }],
    },
    {
      id: "a2",
      display_text: "【Main】Choose 1 rested enemy Unit that is Lv.5 or lower. It won't be set as active during the start phase of your opponent's next turn.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: F.all(F.enemy, F.rested, F.maxLevel(5)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "The chosen enemy Unit won't be set as active during the start phase of your opponent's next turn." },
      ],
    },
  ],

  // GD04-103 — Repair 2 scraper artifact. Main: choose friendly Unit → gains Repair 2 this turn.
  "GD04-103": [
    {
      id: "a1",
      display_text: "【Main】Choose 1 of your Units. It gains <Repair 2> during this turn.",
      trigger: { type: "activated_main" },
      notes: "Scraper artifact: repair2 in keywords[] is not on this card — it's given to another Unit temporarily.",
      steps: [
        { action: "choose_target", filter: F.friendly, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "gain_keyword", target: "$target", keywords: [{ keyword: "repair", amount: 2 }], duration: "end_of_turn" },
      ],
    },
  ],

  // GD04-104 — Main/Action: rest 1–2 enemy Units ≤Lv2. Pilot: Junko Jenko.
  "GD04-104": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 to 2 enemy Units that are Lv.2 or lower. Rest them.",
      trigger: { type: "activated_main_or_action" },
      steps: [
        { action: "choose_target", filter: F.all(F.enemy, F.maxLevel(2)), selector: "controller_chooses", min: 1, max: 2, store_as: "$targets" },
        { action: "rest", target: "$targets" },
      ],
    },
  ],

  // GD04-105 — Main: look at top 5, may reveal Pilot and add to hand; rest to bottom.
  "GD04-105": [
    {
      id: "a1",
      display_text: "【Main】Look at the top 5 cards of your deck. You may reveal 1 Pilot card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "peek_top", side: "friendly", count: 5, reveal_to: "friendly", store_as: "$peeked" },
        { action: "manual_resolve", prompt_text: "You may reveal 1 Pilot card among the peeked cards and add it to your hand. Return the rest randomly to the bottom of your deck." },
      ],
    },
  ],

  // GD04-106 — Main: choose Academy Unit → may target active ≤5 AP enemy this turn (1–2 units if EX Resource used). Pilot: Norea Du Noc.
  "GD04-106": [
    {
      id: "a1",
      display_text: "【Main】Choose 1 friendly (Academy) Unit. During this turn, it may choose an active enemy Unit with 5 or less AP as its attack target. If you use an EX Resource to play this card, choose 1 to 2 friendly (Academy) Units instead.",
      trigger: { type: "activated_main" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 (or 1–2 if EX Resource used) friendly (Academy) Unit(s). During this turn, each may choose an active enemy Unit with 5 or less AP as its attack target." }],
    },
  ],

  // GD04-107 — Burst: to hand. Action: choose rested friendly Unit → all enemies must target it.
  "GD04-107": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【Action】Choose 1 of your rested Units. During this turn, all enemy Units must choose that Unit as their attack target when attacking.",
      trigger: { type: "activated_action" },
      steps: [
        { action: "choose_target", filter: F.all(F.friendly, F.rested), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "During this turn, all enemy Units must choose the selected rested Unit as their attack target." },
      ],
    },
  ],

  // GD04-108 — Main/Action: choose Academy Unit → reduce next damage by 2 (or 4 if EX Resource used). Pilot: Sophie Pulone.
  "GD04-108": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 friendly (Academy) Unit. During this turn, reduce the next damage it receives by 2. If you use an EX Resource to play this card, reduce by 4 instead.",
      trigger: { type: "activated_main_or_action" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 friendly (Academy) Unit. Reduce the next damage it receives by 2 (or 4 if played using an EX Resource)." }],
    },
  ],

  // GD04-109 — Main/Action: deal 4 damage to enemy Unit ≤Lv6.
  "GD04-109": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 enemy Unit that is Lv.6 or lower. Deal 4 damage to it.",
      trigger: { type: "activated_main_or_action" },
      steps: [
        { action: "choose_target", filter: F.all(F.enemy, F.maxLevel(6)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 4 },
      ],
    },
  ],

  // GD04-110 — Main/Action: deploy 1 EX Base.
  "GD04-110": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Deploy 1 EX Base.",
      trigger: { type: "activated_main_or_action" },
      steps: [{ action: "manual_resolve", prompt_text: "Deploy 1 EX Base from your hand or use the appropriate EX Base." }],
    },
  ],

  // GD04-111 — Main/Action: choose 1–3 CB Units → AP+2. Pilot: Johann Trinity.
  "GD04-111": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 to 3 of your (CB) Units. They get AP+2 during this turn.",
      trigger: { type: "activated_main_or_action" },
      steps: [
        { action: "choose_target", filter: F.all(F.friendly, F.traits("CB")), selector: "controller_chooses", min: 1, max: 3, store_as: "$targets" },
        { action: "modify_stat", target: "$targets", stat: "ap", amount: 2, duration: "end_of_turn" },
      ],
    },
  ],

  // GD04-112 — Main: deal 1 damage to all Units ≤Lv2. Pilot: Gates Capa.
  "GD04-112": [
    {
      id: "a1",
      display_text: "【Main】Deal 1 damage to all Units that are Lv.2 or lower.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "all_matching", filter: F.maxLevel(2), store_as: "$targets" },
        { action: "deal_damage", target: "$targets", amount: 1 },
      ],
    },
  ],

  // GD04-113 — Burst: enemy Unit AP-2 this turn. Action: choose friendly Unit → reduce battle damage received by 3 this battle.
  "GD04-113": [
    {
      id: "a1",
      display_text: "【Burst】Choose 1 enemy Unit. It gets AP-2 during this turn.",
      trigger: { type: "on_burst" },
      steps: [
        { action: "choose_target", filter: F.enemy, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: -2, duration: "end_of_turn" },
      ],
    },
    {
      id: "a2",
      display_text: "【Action】Choose 1 of your Units. During this battle, reduce battle damage it receives by 3.",
      trigger: { type: "activated_action" },
      steps: [
        { action: "choose_target", filter: F.friendly, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "During this battle, reduce battle damage the chosen Unit receives by 3." },
      ],
    },
  ],

  // GD04-114 — Burst: retrieve "Trans-Am" Unit from trash. Main/Action: deal 1 damage to friendly Unit and enemy Unit.
  "GD04-114": [
    {
      id: "a1",
      display_text: "【Burst】Choose 1 Unit card with 'Trans-Am' in its card name from your trash. Add it to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 Unit card with 'Trans-Am' in its card name from your trash and add it to your hand." }],
    },
    {
      id: "a2",
      display_text: "【Main】/【Action】Choose 1 of your Units and 1 enemy Unit. Deal 1 damage to them.",
      trigger: { type: "activated_main_or_action" },
      steps: [
        { action: "choose_target", filter: F.friendly, selector: "controller_chooses", min: 1, max: 1, store_as: "$friendly" },
        { action: "choose_target", filter: F.enemy, selector: "controller_chooses", min: 1, max: 1, store_as: "$enemy" },
        { action: "deal_damage", target: "$friendly", amount: 1 },
        { action: "deal_damage", target: "$enemy", amount: 1 },
      ],
    },
  ],

  // GD04-115 — Burst: deal 1 damage to enemy Unit. Main: choose friendly Unit → if it deals battle damage to enemy ≤Lv5 this turn, destroy it.
  "GD04-115": [
    {
      id: "a1",
      display_text: "【Burst】Choose 1 enemy Unit. Deal 1 damage to it.",
      trigger: { type: "on_burst" },
      steps: [
        { action: "choose_target", filter: F.enemy, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1 },
      ],
    },
    {
      id: "a2",
      display_text: "【Main】Choose 1 of your Units. When it deals battle damage to an enemy Unit that is Lv.5 or lower during this turn, destroy that enemy Unit.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: F.friendly, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "Until end of turn: when the chosen Unit deals battle damage to an enemy Unit that is Lv.5 or lower, destroy that enemy Unit." },
      ],
    },
  ],

  // GD04-116 — Main: mill top 2 → deal damage to enemy ≤4 AP equal to # Minerva Squad cards milled. Pilot: Heine Westenfluss.
  "GD04-116": [
    {
      id: "a1",
      display_text: "【Main】Place the top 2 cards of your deck into your trash. If you do, choose 1 enemy Unit with 4 or less AP. Deal an amount of damage equal to the number of (Minerva Squad) cards placed with this effect to that enemy Unit.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "manual_resolve", prompt_text: "Mill the top 2 cards of your deck. Choose 1 enemy Unit with 4 or less AP. Deal damage equal to the number of (Minerva Squad) cards among the milled cards to that Unit." },
      ],
    },
  ],

  // GD04-117 — Burst: activate Action. Action: return 1–2 enemy Units ≤Lv3 to hand.
  "GD04-117": [
    {
      id: "a1",
      display_text: "【Burst】Activate this card's 【Action】.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Activate this card's 【Action】 effect." }],
    },
    {
      id: "a2",
      display_text: "【Action】Choose 1 to 2 enemy Units that are Lv.3 or lower. Return them to their owners' hands.",
      trigger: { type: "activated_action" },
      steps: [
        { action: "choose_target", filter: F.all(F.enemy, F.maxLevel(3)), selector: "controller_chooses", min: 1, max: 2, store_as: "$targets" },
        { action: "move_to_hand", target: "$targets" },
      ],
    },
  ],

  // GD04-118 — Main/Action: if ≥2 friendly UN Units in play, return enemy ≤5 HP to hand. Pilot: Alejandro Corner.
  "GD04-118": [
    {
      id: "a1",
      display_text: "【Main】/【Action】If 2 or more friendly (UN) Units are in play, choose 1 enemy Unit with 5 or less HP. Return it to its owner's hand.",
      trigger: { type: "activated_main_or_action" },
      steps: [
        {
          action: "choose_target", filter: F.all(F.enemy, F.maxHp(5)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target",
          condition: { type: "count", filter: F.all(F.friendly, F.traits("UN")), op: ">=", value: 2 },
        },
        {
          action: "move_to_hand", target: "$target",
          condition: { type: "count", filter: F.all(F.friendly, F.traits("UN")), op: ">=", value: 2 },
        },
      ],
    },
  ],

  // GD04-119 — Main/Action: choose friendly Unit paired with Newtype Pilot → can't receive effect damage this turn. Pilot: Gael Chan.
  "GD04-119": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 friendly Unit paired with a (Newtype) Pilot. It can't receive effect damage from enemy Units during this turn.",
      trigger: { type: "activated_main_or_action" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 friendly Unit paired with a (Newtype) Pilot. During this turn, it can't receive effect damage from enemy Units." }],
    },
  ],

  // GD04-120 — Main/Action: choose Militia/Dianna Counter Unit → AP+2. Pilot: Miashei Kune.
  "GD04-120": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 friendly (Militia)/(Dianna Counter) Unit. It gets AP+2 during this turn.",
      trigger: { type: "activated_main_or_action" },
      steps: [
        { action: "choose_target", filter: F.all(F.friendly, F.traits("Militia", "Dianna Counter")), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 2, duration: "end_of_turn" },
      ],
    },
  ],

  // ─── Bases ────────────────────────────────────────────────────────────────────

  // GD04-121 — Burst: deploy self. Deploy: shield to hand; if LM Unit in play (your turn), deploy Parts token.
  "GD04-121": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, during your turn, if a friendly (League Militaire) Unit is in play, deploy 1 [Parts]((League Militaire)･AP1･HP1･This Unit can't choose the enemy player as its attack target) Unit token.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." },
        {
          action: "create_token",
          token_id: "parts_league_militaire_ap1_hp1",
          count: 1, side: "friendly", rest_state: "rested",
          condition: { and: [
            { type: "is_my_turn" },
            { type: "count", filter: F.all(F.friendly, F.traits("League Militaire")), op: ">=", value: 1 },
          ]},
        },
      ],
    },
  ],

  // GD04-122 — Burst: deploy self. Deploy: shield to hand. Activated Main (once/turn): rest EF Unit → rest enemy ≤Lv3.
  "GD04-122": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." }],
    },
    {
      id: "a3",
      display_text: "【Activate･Main】【Once per Turn】Rest 1 of your (Earth Federation) Units: Choose 1 enemy Unit that is Lv.3 or lower. Rest it.",
      trigger: { type: "activated_main", qualifiers: { once_per_turn: true } },
      steps: [
        { action: "choose_target", filter: F.all(F.friendly, F.traits("Earth Federation"), F.active), selector: "controller_chooses", min: 1, max: 1, store_as: "$cost" },
        { action: "rest", target: "$cost" },
        { action: "choose_target", filter: F.all(F.enemy, F.maxLevel(3)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "rest", target: "$target" },
      ],
    },
  ],

  // GD04-123 — Burst: deploy self. Deploy: shield to hand. Static: while rested Zeon Unit in play, Base can't receive battle damage from ≤Lv4 units.
  "GD04-123": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." }],
    },
    {
      id: "a3",
      display_text: "While you have a rested (Zeon) Unit in play, this Base can't receive battle damage from enemy Units that are Lv.4 or lower.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While a rested (Zeon) Unit is in play on your side, this Base can't receive battle damage from enemy Units that are Lv.4 or lower." }],
    },
  ],

  // GD04-124 — Burst: deploy self. Deploy: shield to hand. Triggered: when you place EX Resource, choose Academy Unit → AP+2.
  "GD04-124": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." }],
    },
    {
      id: "a3",
      display_text: "When you place an EX Resource, choose 1 friendly (Academy) Unit. It gets AP+2 during this turn.",
      trigger: { type: "on_ex_resource_placed" },
      steps: [
        { action: "choose_target", filter: F.all(F.friendly, F.traits("Academy")), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 2, duration: "end_of_turn" },
      ],
    },
  ],

  // GD04-125 — Burst: deploy self. Deploy: shield to hand. Activated Main (once/turn): ① + rest CB Unit → deal 1 damage to enemy ≤Lv5.
  "GD04-125": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." }],
    },
    {
      id: "a3",
      display_text: "【Activate･Main】【Once per Turn】①, rest 1 friendly (CB) Unit: Choose 1 enemy Unit that is Lv.5 or lower. Deal 1 damage to it.",
      trigger: { type: "activated_main", qualifiers: { once_per_turn: true, resource_cost: 1 } },
      steps: [
        { action: "manual_resolve", prompt_text: "Pay ① and rest 1 friendly (CB) Unit." },
        { action: "choose_target", filter: F.all(F.enemy, F.maxLevel(5)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1 },
      ],
    },
  ],

  // GD04-126 — Burst: deploy self. Deploy: shield to hand. When this Base receives battle damage from ≤3 AP unit, deal 1 damage back.
  "GD04-126": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." }],
    },
    {
      id: "a3",
      display_text: "When this Base receives battle damage from an enemy Unit with 3 or less AP, deal 1 damage to that Unit.",
      trigger: { type: "on_receives_battle_damage", qualifiers: { attacker_max_ap: 3 } },
      steps: [{ action: "manual_resolve", prompt_text: "Deal 1 damage to the enemy Unit that attacked this Base (if it has 3 or less AP)." }],
    },
  ],

  // GD04-127 — Burst: deploy self. Deploy: shield to hand; if ≥7 Vulture in trash, destroy enemy ≤2 AP.
  "GD04-127": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, if there are 7 or more (Vulture) cards in your trash, choose 1 enemy Unit with 2 or less AP. Destroy it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." },
        {
          action: "choose_target", filter: F.all(F.enemy, F.maxAp(2)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target",
          condition: { type: "zone_count", side: "friendly", zone: "trash", filter: F.traits("Vulture"), op: ">=", value: 7 },
        },
        {
          action: "destroy", target: "$target",
          condition: { type: "zone_count", side: "friendly", zone: "trash", filter: F.traits("Vulture"), op: ">=", value: 7 },
        },
      ],
    },
  ],

  // GD04-128 — Burst: deploy self. Deploy: shield to hand. Destroyed: all players draw 1.
  "GD04-128": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." }],
    },
    {
      id: "a3",
      display_text: "【Destroyed】All players draw 1.",
      trigger: { type: "on_destroyed" },
      steps: [
        { action: "draw", side: "friendly", amount: 1 },
        { action: "draw", side: "enemy", amount: 1 },
      ],
    },
  ],

  // GD04-129 — Burst: deploy self. Deploy: shield to hand + deal 3 damage to self. Once/turn: when pay ① for friendly unit effect, recover 2 HP.
  "GD04-129": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, deal 3 damage to this Base.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." },
        { action: "deal_damage", target: { filter: F.self }, amount: 3 },
      ],
    },
    {
      id: "a3",
      display_text: "【Once per Turn】During your turn, when you pay ① or more for a friendly Unit's effect, this Base recovers 2 HP.",
      trigger: { type: "on_resource_payment_for_unit_effect", qualifiers: { once_per_turn: true, your_turn_only: true } },
      steps: [{ action: "heal", target: { filter: F.self }, amount: 2 }],
    },
  ],

  // GD04-130 — Burst: deploy self. Deploy: shield to hand. Activated Main (once/turn): exile Command from trash → enemy Unit AP-1.
  "GD04-130": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "deploy_card", target: { filter: F.self } }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Add 1 of your Shields to your hand." }],
    },
    {
      id: "a3",
      display_text: "【Activate･Main】【Once per Turn】Exile 1 Command card from your trash: Choose 1 enemy Unit. It gets AP-1 during this turn.",
      trigger: { type: "activated_main", qualifiers: { once_per_turn: true } },
      steps: [
        { action: "manual_resolve", prompt_text: "Exile 1 Command card from your trash." },
        { action: "choose_target", filter: F.enemy, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: -1, duration: "end_of_turn" },
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
  log("Seeding GD04 abilities…\n");
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
