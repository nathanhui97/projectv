/**
 * Seeds structured abilities for all GD02 cards directly into Supabase.
 * Usage: node scripts/seed-gd02-abilities.mjs
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

// ── Filter helpers ─────────────────────────────────────────────────────────────
// Each value is a single-key FilterSchema clause. Combine multiples with all_of.
const F = {
  unit:          { type: "unit" },
  friendlySide:  { side: "friendly" },
  enemySide:     { side: "enemy" },
  shield:        { zone: "shield_area" },
  isResting:     { is_resting: true },
  isDamaged:     { is_damaged: true },
  isToken:       { is_token: true },
  isLinked:      { is_linked: true },
  excludeSelf:   { exclude_self: true },
  notLinked:     { not_linked: true },
  colorBlue:     { color: "blue" },
  hp:  (op, value) => ({ hp:    { op, value } }),
  lv:  (op, value) => ({ level: { op, value } }),
  ap:  (op, value) => ({ ap:    { op, value } }),
  traits: (...names) => ({ traits_include: names }),
};

/** Wrap one or more filter clauses into an all_of (or return the single clause directly). */
function all(...clauses) {
  if (clauses.length === 1) return clauses[0];
  return { all_of: clauses };
}

const ABILITIES = {

  // GD02-001 — Breach 3 in keywords[]. Conditional HP recovery during pair.
  "GD02-001": [
    {
      id: "a1",
      display_text: "【During Pair･(Cyber-Newtype) Pilot】When one of your (Titans) Units destroys an enemy shield area card with damage, this Unit recovers 2 HP.",
      trigger: { type: "during_pair", qualifiers: { pilot_traits_include: ["Cyber-Newtype"] } },
      steps: [{ action: "manual_resolve", prompt_text: "When one of your (Titans) Units destroys an enemy shield area card with damage, this Unit recovers 2 HP." }],
    },
  ],

  // GD02-002
  "GD02-002": [
    {
      id: "a1",
      display_text: "【During Link】【Once per Turn】During your turn, when one of your Units destroys an enemy Unit with battle damage, set this Unit as active.",
      trigger: { type: "during_link", qualifiers: { once_per_turn: true, your_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "When one of your Units destroys an enemy Unit with battle damage, set this Unit as active (once per turn)." }],
    },
  ],

  // GD02-003
  "GD02-003": [
    {
      id: "a1",
      display_text: "【During Pair･Lv.3 or Lower Pilot】【Destroyed】You may discard 1 Unit card. If you do, return the card paired with this Unit to your hand.",
      trigger: { type: "on_destroyed" },
      notes: "Requires Lv.3 or lower pilot — manual_resolve for pilot level check.",
      steps: [{ action: "manual_resolve", prompt_text: "If paired with a Lv.3 or lower Pilot: you may discard 1 Unit card from your hand. If you do, return the Pilot that was paired with this Unit to your hand." }],
    },
  ],

  // GD02-004
  "GD02-004": [
    {
      id: "a1",
      display_text: "【When Paired】Choose 1 rested enemy Unit with 3 or less HP. It won't be set as active during the start phase of your opponent's next turn.",
      trigger: { type: "on_pair" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 rested enemy Unit with 3 or less HP. It will not be set as active during the start phase of your opponent's next turn." }],
    },
  ],

  // GD02-005
  "GD02-005": [
    {
      id: "a1",
      display_text: "【During Link】【Attack】Choose 1 enemy Unit with 2 or less HP. Rest it.",
      trigger: { type: "on_attack", qualifiers: { requires_link: true } },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.enemySide, F.hp("<=", 2)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "rest", target: "$target" },
      ],
    },
  ],

  // GD02-006 — Blocker in keywords[]. Additional static rule.
  "GD02-006": [
    {
      id: "a1",
      display_text: "During your turn, this Unit can't receive battle damage from enemy Units that are Lv.2 or lower.",
      trigger: { type: "static", qualifiers: { your_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "During your turn, this Unit cannot receive battle damage from enemy Units that are Lv.2 or lower." }],
    },
  ],

  "GD02-007": [], // Repair 2 in keywords[]
  "GD02-008": [
    {
      id: "a1",
      display_text: "【When Linked】Choose 1 rested enemy Unit. Deal 1 damage to it.",
      trigger: { type: "on_link_established" },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.enemySide, F.isResting), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
      ],
    },
  ],

  // GD02-009
  "GD02-009": [
    {
      id: "a1",
      display_text: "【Once per Turn】When this Unit's AP is reduced by an enemy effect, choose 1 rested enemy Unit. Deal 2 damage to it.",
      trigger: { type: "static", qualifiers: { once_per_turn: true } },
      steps: [{ action: "manual_resolve", prompt_text: "When this Unit's AP is reduced by an enemy effect, choose 1 rested enemy Unit and deal 2 damage to it (once per turn)." }],
    },
  ],

  // GD02-010
  "GD02-010": [
    {
      id: "a1",
      display_text: "【Once per Turn】When this Unit receives enemy effect damage, draw 1.",
      trigger: { type: "on_damage_taken", qualifiers: { once_per_turn: true } },
      steps: [{ action: "manual_resolve", prompt_text: "When this Unit receives damage from an enemy effect (not battle damage), draw 1 (once per turn)." }],
    },
  ],

  // GD02-011
  "GD02-011": [
    {
      id: "a1",
      display_text: "【Activate･Action】Destroy this Unit: Choose 1 enemy Base/enemy Shield this Unit is battling. Deal 6 damage to it.",
      trigger: { type: "activated_action", cost: { destroy_self: true } },
      steps: [{ action: "manual_resolve", prompt_text: "Destroy this Unit (cost). Then choose 1 enemy Base or enemy Shield area card that this Unit is currently battling. Deal 6 damage to it." }],
    },
  ],

  "GD02-012": [],
  "GD02-013": [],

  // GD02-014
  "GD02-014": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 of your (Titans) Units. It gets AP+1 during this turn.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.friendlySide, F.traits("Titans")), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 1, duration: "end_of_turn" },
      ],
    },
  ],

  "GD02-015": [],

  // GD02-016 — same pattern as 014
  "GD02-016": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 of your (Titans) Units. It gets AP+1 during this turn.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.friendlySide, F.traits("Titans")), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 1, duration: "end_of_turn" },
      ],
    },
  ],

  "GD02-017": [], // Repair 2 in keywords[]

  // GD02-018
  "GD02-018": [
    {
      id: "a1",
      display_text: "This Unit can't choose the enemy player as its attack target.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "This Unit cannot choose the enemy player as its attack target. It may only attack enemy Units." }],
    },
  ],

  "GD02-019": [],

  // GD02-020
  "GD02-020": [
    {
      id: "a1",
      display_text: "【Deploy】Look at the top 5 cards of your deck. You may reveal 1 green (Zeon) Pilot card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Look at the top 5 cards of your deck. You may reveal 1 green (Zeon) Pilot card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck." }],
    },
    {
      id: "a2",
      display_text: "【During Link】This Unit gets AP+2.",
      trigger: { type: "during_link" },
      steps: [{ action: "modify_stat", target: "$self", stat: "ap", amount: 2, duration: "while_linked" }],
    },
  ],

  // GD02-021
  "GD02-021": [
    {
      id: "a1",
      display_text: "【Deploy】You may discard 1 green (Earth Federation) Unit card. If you do, place 1 EX Resource. Then, if you are Lv.7 or higher, draw 1.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "You may discard 1 green (Earth Federation) Unit card from your hand. If you do, place 1 EX Resource. Then, if you are Lv.7 or higher, draw 1." }],
    },
  ],

  // GD02-022 — breach in keywords[] is scraper artifact (conditional)
  "GD02-022": [
    {
      id: "a1",
      display_text: "【Once per Turn】When you place an EX Resource, choose 1 of your (AGE System) Units. It gains <Breach 2> during this turn.",
      trigger: { type: "on_resource_placed", qualifiers: { once_per_turn: true } },
      notes: "breach in keywords[] is a scraper artifact — Breach 2 is conditional on EX Resource placement.",
      steps: [
        { action: "choose_target", filter: all(F.unit, F.friendlySide, F.traits("AGE System")), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "gain_keyword", target: "$target", keyword: "breach", amount: 2, duration: "end_of_turn" },
      ],
    },
  ],

  // GD02-023 — first_strike in keywords[] is scraper artifact (conditional)
  "GD02-023": [
    {
      id: "a1",
      display_text: "【During Link】While you are Lv.7 or higher, this Unit gains <First Strike>.",
      trigger: { type: "during_link" },
      notes: "first_strike in keywords[] is a scraper artifact — conditional on link + Lv.7+.",
      steps: [{ action: "manual_resolve", prompt_text: "While this Unit is linked and you are Lv.7 or higher, this Unit has <First Strike>." }],
    },
  ],

  // GD02-024
  "GD02-024": [
    {
      id: "a1",
      display_text: "【During Link】This Unit gains <High-Maneuver>.",
      trigger: { type: "during_link" },
      steps: [{ action: "gain_keyword", target: "$self", keyword: "high_maneuver", duration: "while_linked" }],
    },
  ],

  // GD02-025
  "GD02-025": [
    {
      id: "a1",
      display_text: "【Deploy】Look at the top card of your deck. Return it to the top or bottom of your deck.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Look at the top card of your deck. Return it to the top or to the bottom of your deck." }],
    },
  ],

  // GD02-026
  "GD02-026": [
    {
      id: "a1",
      display_text: "【Deploy】If you are Lv.7 or higher, choose 1 of your (AGE System) Units. It gets AP+2 during this turn.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "If you are Lv.7 or higher, choose 1 of your (AGE System) Units. It gets AP+2 during this turn." }],
    },
  ],

  "GD02-027": [], // Breach 3 in keywords[], no other abilities
  "GD02-028": [],
  "GD02-029": [],
  "GD02-030": [],

  // GD02-031
  "GD02-031": [
    {
      id: "a1",
      display_text: "While you are Lv.7 or higher, this Unit gets AP+2.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While you are Lv.7 or higher, this Unit has +2 AP." }],
    },
  ],

  "GD02-032": [],

  // GD02-033 — breach in keywords[] is scraper artifact
  "GD02-033": [
    {
      id: "a1",
      display_text: "While another friendly (Zeon) Link Unit is in play, this Unit gains <Breach 5>.",
      trigger: { type: "static" },
      notes: "breach in keywords[] is a scraper artifact — Breach 5 is conditional on another Zeon Link Unit.",
      steps: [{ action: "manual_resolve", prompt_text: "While another friendly (Zeon) Link Unit is in play, this Unit has <Breach 5>." }],
    },
  ],

  // GD02-034
  "GD02-034": [
    {
      id: "a1",
      display_text: "【During Pair･Red Pilot】This Unit gets AP+2.",
      trigger: { type: "during_pair", qualifiers: { pilot_color: "red" } },
      steps: [{ action: "modify_stat", target: "$self", stat: "ap", amount: 2, duration: "while_paired" }],
    },
  ],

  // GD02-035
  "GD02-035": [
    {
      id: "a1",
      display_text: "This Unit can't choose the enemy player as its attack target.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "This Unit cannot choose the enemy player as its attack target. It may only attack enemy Units." }],
    },
  ],

  // GD02-036 — suppression in keywords[] is scraper artifact (conditional)
  "GD02-036": [
    {
      id: "a1",
      display_text: "【When Linked】This Unit gains <Suppression> during this turn.",
      trigger: { type: "on_link_established" },
      notes: "suppression in keywords[] is a scraper artifact — Suppression is gained conditionally when linked.",
      steps: [{ action: "gain_keyword", target: "$self", keyword: "suppression", duration: "end_of_turn" }],
    },
    {
      id: "a2",
      display_text: "【During Pair･(Neo Zeon) Pilot】【Attack】Choose 1 damaged enemy Unit. Deal 2 damage to it.",
      trigger: { type: "on_attack", qualifiers: { pilot_traits_include: ["Neo Zeon"] } },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.enemySide, F.isDamaged), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "deal_damage", target: "$target", amount: 2, damage_type: "effect" },
      ],
    },
  ],

  // GD02-037 — Breach 1 in keywords[]. Conditional deploy effect.
  "GD02-037": [
    {
      id: "a1",
      display_text: "【Deploy】If there are 3 or less enemy Shields, choose 1 enemy Unit with 5 or less AP. Deal 2 damage to it.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "If there are 3 or less enemy Shields in play, choose 1 enemy Unit with 5 or less AP. Deal 2 damage to it." }],
    },
  ],

  // GD02-038
  "GD02-038": [
    {
      id: "a1",
      display_text: "【Deploy】Look at the top 3 cards of your deck. You may deploy 1 (Clan) Unit card that is Lv.4 or lower among them. Return the remaining cards randomly to the bottom of your deck.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Look at the top 3 cards of your deck. You may deploy 1 (Clan) Unit card that is Lv.4 or lower among them. Return the remaining cards randomly to the bottom of your deck." }],
    },
  ],

  // GD02-039
  "GD02-039": [
    {
      id: "a1",
      display_text: "【When Paired】Choose 1 enemy Unit that is Lv.3 or lower. Deal 1 damage to it.",
      trigger: { type: "on_pair" },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.enemySide, F.lv("<=", 3)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
      ],
    },
  ],

  // GD02-040 — Support 2 in keywords[]. Deploy immunity effect.
  "GD02-040": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 of your other (New UNE) Units. It can't receive battle damage from enemy Units with 2 or less HP during this turn.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 of your other (New UNE) Units. During this turn, it cannot receive battle damage from enemy Units with 2 or less HP." }],
    },
  ],

  // GD02-041
  "GD02-041": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 enemy Unit that is Lv.5 or higher. Deal 2 damage to it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.enemySide, F.lv(">=", 5)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "deal_damage", target: "$target", amount: 2, damage_type: "effect" },
      ],
    },
  ],

  // GD02-042
  "GD02-042": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 of your (New UNE) Units. It gains <High-Maneuver> during this turn.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.friendlySide, F.traits("New UNE")), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "gain_keyword", target: "$target", keyword: "high_maneuver", duration: "end_of_turn" },
      ],
    },
  ],

  // GD02-043
  "GD02-043": [
    {
      id: "a1",
      display_text: "【Deploy】If you have another (New UNE) Unit in play, deploy 1 rested [Daughtress]((New UNE)·AP0·HP1) Unit token.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "If you have another (New UNE) Unit in play, deploy 1 rested [Daughtress] Unit token with traits (New UNE), AP 0, HP 1." }],
    },
  ],

  // GD02-044
  "GD02-044": [
    {
      id: "a1",
      display_text: "【Destroyed】If you have another (New UNE) Unit in play, deploy 1 rested [Daughtress]((New UNE)·AP0·HP1) Unit token.",
      trigger: { type: "on_destroyed" },
      steps: [{ action: "manual_resolve", prompt_text: "If you have another (New UNE) Unit in play, deploy 1 rested [Daughtress] Unit token with traits (New UNE), AP 0, HP 1." }],
    },
  ],

  // GD02-045
  "GD02-045": [
    {
      id: "a1",
      display_text: "【Attack】If this Unit has 5 or more AP and it is attacking an enemy Unit, draw 1.",
      trigger: { type: "on_attack" },
      steps: [{ action: "manual_resolve", prompt_text: "If this Unit has 5 or more AP and is attacking an enemy Unit (not a Base or Shield), draw 1." }],
    },
  ],

  // GD02-046
  "GD02-046": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 enemy Unit token. Deal 2 damage to it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.enemySide, F.isToken), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "deal_damage", target: "$target", amount: 2, damage_type: "effect" },
      ],
    },
  ],

  // GD02-047
  "GD02-047": [
    {
      id: "a1",
      display_text: "【Activate･Main】Rest this Unit: Destroy this and choose 1 enemy Unit that is Lv.5 or lower. Deal 1 damage to it.",
      trigger: { type: "activated_main", cost: { rest_self: true } },
      steps: [
        { action: "destroy", target: "$self" },
        { action: "choose_target", filter: all(F.unit, F.enemySide, F.lv("<=", 5)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
      ],
    },
  ],

  "GD02-048": [],
  "GD02-049": [], // Support 1 in keywords[]
  "GD02-050": [],
  "GD02-051": [],
  "GD02-052": [],

  // GD02-053 — [Suppression] always-on (scraper missed because [..] not <..>) + during_link aura
  "GD02-053": [
    {
      id: "a1",
      display_text: "[Suppression] (Damage to Shields by an attack is dealt to the first 2 cards simultaneously.)",
      trigger: { type: "static" },
      notes: "Suppression is always-on; scraper missed it because rules text uses [...] not <...>.",
      steps: [{ action: "gain_keyword", target: "$self", keyword: "suppression", duration: "permanent" }],
    },
    {
      id: "a2",
      display_text: "【During Link】During your turn, while there are 7 or more cards in your trash, all your other (Vulture) Units get AP+2.",
      trigger: { type: "during_link", qualifiers: { your_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "While linked and during your turn: if there are 7 or more cards in your trash, all your other (Vulture) Units get AP+2." }],
    },
  ],

  // GD02-054
  "GD02-054": [
    {
      id: "a1",
      display_text: "【Attack】If this Unit is damaged, draw 1.",
      trigger: { type: "on_attack" },
      steps: [{ action: "manual_resolve", prompt_text: "If this Unit is currently damaged (current HP below maximum HP), draw 1." }],
    },
  ],

  // GD02-055 — Blocker in keywords[]. Two-target deploy.
  "GD02-055": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 of your Units and 1 enemy Unit. Deal 1 damage to them.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.friendlySide), selector: "controller_chooses", min: 1, max: 1, store_as: "$friendly_target" },
        { action: "choose_target", filter: all(F.unit, F.enemySide), selector: "controller_chooses", min: 1, max: 1, store_as: "$enemy_target" },
        { action: "deal_damage", target: "$friendly_target", amount: 1, damage_type: "effect" },
        { action: "deal_damage", target: "$enemy_target", amount: 1, damage_type: "effect" },
      ],
    },
  ],

  // GD02-056
  "GD02-056": [
    {
      id: "a1",
      display_text: "【During Pair･(Vulture) Pilot】【Destroyed】Choose 1 (Vulture) Unit card that is Lv.5 or higher from your trash. Add it to your hand.",
      trigger: { type: "on_destroyed", qualifiers: { pilot_traits_include: ["Vulture"] } },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 (Vulture) Unit card that is Lv.5 or higher from your trash. Add it to your hand." }],
    },
  ],

  // GD02-057
  "GD02-057": [
    {
      id: "a1",
      display_text: "【During Pair】【Attack】You may choose 1 of your other Units. Destroy it. If you do, choose 1 enemy Unit that is Lv.4 or lower. Deal 2 damage to it.",
      trigger: { type: "on_attack" },
      steps: [{ action: "manual_resolve", prompt_text: "While paired: you may choose 1 of your other Units and destroy it. If you do, choose 1 enemy Unit that is Lv.4 or lower and deal 2 damage to it." }],
    },
  ],

  // GD02-058
  "GD02-058": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 of your Units. Deal 1 damage to it. If you do, draw 1. Then, discard 1.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 of your Units and deal 1 damage to it. If you dealt damage this way, draw 1 card, then discard 1 card." }],
    },
  ],

  "GD02-059": [], // Blocker in keywords[]

  // GD02-060
  "GD02-060": [
    {
      id: "a1",
      display_text: "【Deploy】If there are 7 or more cards in your trash, choose 1 enemy Unit that is Lv.4 or lower. Rest it.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "If there are 7 or more cards in your trash, choose 1 enemy Unit that is Lv.4 or lower. Rest it." }],
    },
  ],

  // GD02-061
  "GD02-061": [
    {
      id: "a1",
      display_text: "【When Paired･Purple Pilot】If there are 3 or more (Teiwaz)/(Tekkadan) cards in your trash, choose 1 enemy Unit with 3 or less AP. Rest it.",
      trigger: { type: "on_pair", qualifiers: { pilot_color: "purple" } },
      steps: [{ action: "manual_resolve", prompt_text: "If there are 3 or more (Teiwaz) or (Tekkadan) cards in your trash, choose 1 enemy Unit with 3 or less AP. Rest it." }],
    },
  ],

  "GD02-062": [],
  "GD02-063": [],

  // GD02-064
  "GD02-064": [
    {
      id: "a1",
      display_text: "During your turn, while there are 7 or more cards in your trash, this Unit can't receive effect damage from enemy Commands.",
      trigger: { type: "static", qualifiers: { your_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "During your turn: while there are 7 or more cards in your trash, this Unit cannot receive effect damage from enemy Command cards." }],
    },
  ],

  "GD02-065": [],

  // GD02-066
  "GD02-066": [
    {
      id: "a1",
      display_text: "This Unit can't choose the enemy player as its attack target.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "This Unit cannot choose the enemy player as its attack target. It may only attack enemy Units." }],
    },
  ],

  "GD02-067": [],

  // GD02-068
  "GD02-068": [
    {
      id: "a1",
      display_text: "【Deploy】Deal 2 damage to this Unit.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "deal_damage", target: "$self", amount: 2, damage_type: "effect" }],
    },
  ],

  // GD02-069
  "GD02-069": [
    {
      id: "a1",
      display_text: "【During Link】【Activate･Main】【Once per Turn】Choose 1 active friendly Base. Rest it. If you do, set this Unit as active. It can't choose the enemy player as its attack target during this turn.",
      trigger: { type: "activated_main", qualifiers: { once_per_turn: true, requires_link: true } },
      steps: [{ action: "manual_resolve", prompt_text: "While linked: choose 1 active friendly Base and rest it. If you do, set this Unit as active. During this turn, this Unit cannot choose the enemy player as its attack target." }],
    },
  ],

  // GD02-070
  "GD02-070": [
    {
      id: "a1",
      display_text: "【Deploy】If there are 4 or more (Gjallarhorn) cards in your trash, draw 2. If you do, discard 2.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "If there are 4 or more (Gjallarhorn) cards in your trash, draw 2 cards, then discard 2 cards." }],
    },
  ],

  // GD02-071
  "GD02-071": [
    {
      id: "a1",
      display_text: "【Deploy】If a friendly white Base is in play, you may pair 1 (AEUG) Pilot card from your hand with this Unit.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "If a friendly white Base is in play, you may pair 1 (AEUG) Pilot card from your hand with this Unit." }],
    },
  ],

  // GD02-072 — Blocker always-on in keywords[]. Repair 1 is conditional (scraper artifact).
  "GD02-072": [
    {
      id: "a1",
      display_text: "While a friendly white Base is in play, this Unit gains <Repair 1>.",
      trigger: { type: "static" },
      notes: "repair in keywords[] is a scraper artifact — Repair 1 is conditional on white Base in play.",
      steps: [{ action: "manual_resolve", prompt_text: "While a friendly white Base is in play, this Unit has <Repair 1> (recover 1 HP at end of your turn)." }],
    },
  ],

  // GD02-073
  "GD02-073": [
    {
      id: "a1",
      display_text: "During your opponent's turn, the enemy Unit battling this Unit gains <First Strike>.",
      trigger: { type: "static", qualifiers: { opponent_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "During your opponent's turn, the enemy Unit currently battling this Unit gains <First Strike> for that battle." }],
    },
  ],

  // GD02-074 — High-Maneuver always-on (scraper missed it). Blocker conditional (scraper artifact).
  "GD02-074": [
    {
      id: "a1",
      display_text: "<High-Maneuver> (This Unit can't be blocked.)",
      trigger: { type: "static" },
      notes: "High-Maneuver is always-on; scraper missed it from keywords[].",
      steps: [{ action: "gain_keyword", target: "$self", keyword: "high_maneuver", duration: "permanent" }],
    },
    {
      id: "a2",
      display_text: "【During Pair】While there are 4 or more Command cards in your trash, this Unit gains <Blocker>.",
      trigger: { type: "during_pair" },
      notes: "blocker in keywords[] is a scraper artifact — Blocker is conditional.",
      steps: [{ action: "manual_resolve", prompt_text: "While paired and there are 4 or more Command cards in your trash, this Unit has <Blocker>." }],
    },
  ],

  // GD02-075
  "GD02-075": [
    {
      id: "a1",
      display_text: "【Attack】Choose 1 active friendly Base. Rest it. If you do, choose 1 enemy Unit that is Lv.4 or lower. It gets AP-2 during this battle.",
      trigger: { type: "on_attack" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 active friendly Base and rest it. If you do, choose 1 enemy Unit that is Lv.4 or lower — it gets AP-2 during this battle." }],
    },
  ],

  // GD02-076 — blocker in keywords[] is scraper artifact (conditional on AP>=5)
  "GD02-076": [
    {
      id: "a1",
      display_text: "While this Unit has 5 or more AP, it gains <Blocker>.",
      trigger: { type: "static" },
      notes: "blocker in keywords[] is a scraper artifact — Blocker is conditional on AP 5+.",
      steps: [{ action: "manual_resolve", prompt_text: "While this Unit has 5 or more AP, it has <Blocker>." }],
    },
  ],

  "GD02-077": [],
  "GD02-078": [],
  "GD02-079": [], // Blocker in keywords[]
  "GD02-080": [],

  // GD02-081
  "GD02-081": [
    {
      id: "a1",
      display_text: "【Deploy】If a friendly white Base is in play, choose 1 enemy Unit. It gets AP-2 during this turn.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "If a friendly white Base is in play, choose 1 enemy Unit. It gets AP-2 during this turn." }],
    },
  ],

  // GD02-082 — blocker conditional (scraper artifact)
  "GD02-082": [
    {
      id: "a1",
      display_text: "While you have another (Gjallarhorn) Unit in play, this Unit gains <Blocker>.",
      trigger: { type: "static" },
      notes: "blocker in keywords[] is a scraper artifact — Blocker is conditional on another Gjallarhorn Unit.",
      steps: [{ action: "manual_resolve", prompt_text: "While you have another (Gjallarhorn) Unit in play, this Unit has <Blocker>." }],
    },
  ],

  // GD02-083
  "GD02-083": [
    {
      id: "a1",
      display_text: "【Destroyed】If it is your opponent's turn, choose 1 of your (Gjallarhorn) Units. Set it as active.",
      trigger: { type: "on_destroyed", qualifiers: { opponent_turn_only: true } },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.friendlySide, F.traits("Gjallarhorn")), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "ready", target: "$target" },
      ],
    },
  ],

  "GD02-084": [],

  // ── Pilots ────────────────────────────────────────────────────────────────────

  "GD02-085": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【During Link】【Once per Turn】During your turn, when this Unit recovers HP, if you have 4 or less cards in your hand, draw 1.",
      trigger: { type: "during_link", qualifiers: { once_per_turn: true, your_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "When the Unit this Pilot is linked with recovers any HP, if you have 4 or less cards in hand, draw 1 (once per turn)." }],
    },
  ],

  "GD02-086": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "While you have another (Titans) Unit in play, this gets AP+1.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While you have another (Titans) Unit in play, the Unit this Pilot is paired with gets AP+1." }],
    },
  ],

  "GD02-087": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【When Linked】If this is a blue Unit, choose 1 enemy Unit with <Blocker>. Rest it.",
      trigger: { type: "on_link_established" },
      steps: [{ action: "manual_resolve", prompt_text: "If the Unit this Pilot is linked with is a blue Unit, choose 1 enemy Unit with <Blocker>. Rest it." }],
    },
  ],

  "GD02-088": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【When Linked】Look at the top 3 cards of your deck. You may reveal 1 green (Earth Federation) Unit card/1 card with 'AGE Device' in its card name among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
      trigger: { type: "on_link_established" },
      steps: [{ action: "manual_resolve", prompt_text: "Look at the top 3 cards of your deck. You may reveal 1 green (Earth Federation) Unit card or 1 card with 'AGE Device' in its name among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck." }],
    },
  ],

  // GD02-089 — breach in keywords[] is scraper artifact
  "GD02-089": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【When Paired】Choose 1 of your other (Zeon) Link Units. It gains <Breach 1> during this turn.",
      trigger: { type: "on_pair" },
      notes: "breach in keywords[] is scraper artifact — Breach 1 is granted to another unit conditionally.",
      steps: [
        { action: "choose_target", filter: all(F.unit, F.friendlySide, F.traits("Zeon"), F.isLinked, F.excludeSelf), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "gain_keyword", target: "$target", keyword: "breach", amount: 1, duration: "end_of_turn" },
      ],
    },
  ],

  "GD02-090": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "While you have another Unit with <High-Maneuver> in play, this Unit gets AP+1.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While you have another Unit with <High-Maneuver> in play, the Unit this Pilot is paired with gets AP+1." }],
    },
  ],

  "GD02-091": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【When Paired】If this Unit is red, choose 1 enemy Unit whose Lv. is equal to or lower than this Unit. Deal 1 damage to it.",
      trigger: { type: "on_pair" },
      steps: [{ action: "manual_resolve", prompt_text: "If the Unit this Pilot is paired with is red, choose 1 enemy Unit whose Level is equal to or lower than this Unit's Level. Deal 1 damage to it." }],
    },
  ],

  "GD02-092": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【During Link】【Attack】Choose 1 of your (New UNE) Units. It gets AP+2 during this turn.",
      trigger: { type: "on_attack", qualifiers: { requires_link: true } },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.friendlySide, F.traits("New UNE")), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 2, duration: "end_of_turn" },
      ],
    },
  ],

  "GD02-093": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "During your turn, when this Unit destroys an enemy Unit paired with a (Newtype) Pilot with battle damage, draw 1.",
      trigger: { type: "static", qualifiers: { your_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "During your turn: when this Unit destroys an enemy Unit that is paired with a (Newtype) Pilot using battle damage, draw 1." }],
    },
  ],

  "GD02-094": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【When Paired】You may discard 1. If you do, look at the top 3 cards of your deck. You may reveal 1 (Vulture) Unit card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
      trigger: { type: "on_pair" },
      steps: [{ action: "manual_resolve", prompt_text: "You may discard 1 card from your hand. If you do, look at the top 3 cards of your deck. You may reveal 1 (Vulture) Unit card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck." }],
    },
  ],

  "GD02-095": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【Attack】If this Unit is damaged and Lv.5 or lower, it gains <High-Maneuver> during this battle.",
      trigger: { type: "on_attack" },
      steps: [{ action: "manual_resolve", prompt_text: "If this Unit is currently damaged (HP below maximum) and is Lv.5 or lower, it gains <High-Maneuver> during this battle." }],
    },
  ],

  "GD02-096": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【When Linked】You may choose 1 (Vagan) Unit card that is Lv.2 or lower from your trash. Pay its cost to deploy it.",
      trigger: { type: "on_link_established" },
      steps: [{ action: "manual_resolve", prompt_text: "You may choose 1 (Vagan) Unit card that is Lv.2 or lower from your trash. Pay its deploy cost to deploy it." }],
    },
  ],

  "GD02-097": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "While there is a friendly white Base in play, this Unit gets AP+2.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While a friendly white Base is in play, the Unit this Pilot is paired with gets AP+2." }],
    },
  ],

  "GD02-098": [
    {
      id: "a1",
      display_text: "This card's name is also treated as [Char Aznable].",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "This card's name is also treated as [Char Aznable] for all game effects that reference that name." }],
    },
    {
      id: "a2",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a3",
      display_text: "【When Linked】If this is an (AEUG) Unit, draw 1. If you do, discard 1.",
      trigger: { type: "on_link_established" },
      steps: [{ action: "manual_resolve", prompt_text: "If the Unit this Pilot is linked with is an (AEUG) Unit, draw 1 card. If you drew a card, discard 1 card." }],
    },
  ],

  "GD02-099": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【When Paired】If there are 4 or more (Gjallarhorn) cards in your trash, choose 1 enemy Unit. It gets AP-2 during this turn.",
      trigger: { type: "on_pair" },
      steps: [{ action: "manual_resolve", prompt_text: "If there are 4 or more (Gjallarhorn) cards in your trash, choose 1 enemy Unit. It gets AP-2 during this turn." }],
    },
  ],

  // ── Commands ──────────────────────────────────────────────────────────────────

  "GD02-100": [
    {
      id: "a1",
      display_text: "【Burst】Draw 1.",
      trigger: { type: "on_burst" },
      steps: [{ action: "draw", side: "friendly", amount: 1 }],
    },
    {
      id: "a2",
      display_text: "【Main】Choose 1 friendly damaged Unit. It recovers 2 HP. Then, draw 1.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.friendlySide, F.isDamaged), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "heal", target: "$target", amount: 2 },
        { action: "draw", side: "friendly", amount: 1 },
      ],
    },
  ],

  "GD02-101": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 to 2 enemy Units that are Lv.2 or lower. Rest them.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.enemySide, F.lv("<=", 2)), selector: "controller_chooses", min: 1, max: 2, store_as: "$targets" },
        { action: "rest", target: "$targets" },
      ],
    },
  ],

  "GD02-102": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 friendly (Titans) Unit. It gets AP+2 during this turn.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.friendlySide, F.traits("Titans")), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 2, duration: "end_of_turn" },
      ],
    },
  ],

  "GD02-103": [
    {
      id: "a1",
      display_text: "【Burst】Choose 1 (Asuno Family) Pilot card from your trash. Add it to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 (Asuno Family) Pilot card from your trash. Add it to your hand." }],
    },
    {
      id: "a2",
      display_text: "【Main】If you have an (AGE System) Unit in play, place 1 EX Resource.",
      trigger: { type: "activated_main" },
      steps: [{ action: "manual_resolve", prompt_text: "If you have an (AGE System) Unit in play, place 1 EX Resource." }],
    },
  ],

  "GD02-104": [
    {
      id: "a1",
      display_text: "【Main】Look at the top 3 cards of your deck and return 1 to the top. Return the remaining cards to the bottom of your deck. Then, if you have a (Newtype) Pilot in play, draw 1.",
      trigger: { type: "activated_main" },
      steps: [{ action: "manual_resolve", prompt_text: "Look at the top 3 cards of your deck. Return 1 to the top and the other 2 to the bottom in any order. Then, if you have a (Newtype) Pilot in play, draw 1." }],
    },
  ],

  "GD02-105": [
    {
      id: "a1",
      display_text: "【Action】Choose 1 of your Unit tokens. It can't receive battle damage from enemy Units during this battle.",
      trigger: { type: "activated_action" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 of your Unit tokens. During this battle, it cannot receive battle damage from enemy Units." }],
    },
  ],

  "GD02-106": [
    {
      id: "a1",
      display_text: "【Action】During this battle, your shield area cards can't receive damage from enemy Units that are Lv.3 or lower.",
      trigger: { type: "activated_action" },
      steps: [{ action: "manual_resolve", prompt_text: "During this battle, your shield area cards cannot receive damage from enemy Units that are Lv.3 or lower." }],
    },
  ],

  "GD02-107": [
    {
      id: "a1",
      display_text: "【Burst】Choose 1 enemy Unit. Deal 1 damage to it.",
      trigger: { type: "on_burst" },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.enemySide), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
      ],
    },
    {
      id: "a2",
      display_text: "【Main】Deal 1 damage to all enemy Units other than Link Units.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "all_matching", filter: all(F.unit, F.enemySide, F.notLinked), store_as: "$targets" },
        { action: "deal_damage", target: "$targets", amount: 1, damage_type: "effect" },
      ],
    },
  ],

  "GD02-108": [
    {
      id: "a1",
      display_text: "【Main】Choose 1 friendly (Clan) Unit. During this turn, it may choose an active enemy Unit that is Lv.4 or lower as its attack target.",
      trigger: { type: "activated_main" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 friendly (Clan) Unit. During this turn, it may declare an attack against an active enemy Unit that is Lv.4 or lower." }],
    },
  ],

  "GD02-109": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 enemy Unit. Deal 1 damage to it.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.enemySide), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
      ],
    },
  ],

  "GD02-110": [
    {
      id: "a1",
      display_text: "【Main】Choose 1 Unit card that is Lv.5 or lower from your trash. Pay its cost to deploy it.",
      trigger: { type: "activated_main" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 Unit card that is Lv.5 or lower from your trash. Pay its deploy cost to deploy it." }],
    },
  ],

  "GD02-111": [
    {
      id: "a1",
      display_text: "【Burst】Choose 1 enemy Unit that is Lv.3 or lower. Deal 2 damage to it.",
      trigger: { type: "on_burst" },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.enemySide, F.lv("<=", 3)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "deal_damage", target: "$target", amount: 2, damage_type: "effect" },
      ],
    },
    {
      id: "a2",
      display_text: "【Main】Choose 6 purple Unit cards from your trash. Exile them from the game. If you do, choose 1 enemy Unit. Destroy it.",
      trigger: { type: "activated_main" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 6 purple Unit cards from your trash and exile them from the game. If you exiled 6 cards this way, choose 1 enemy Unit and destroy it." }],
    },
  ],

  "GD02-112": [
    {
      id: "a1",
      display_text: "【Burst】Draw 1.",
      trigger: { type: "on_burst" },
      steps: [{ action: "draw", side: "friendly", amount: 1 }],
    },
    {
      id: "a2",
      display_text: "【Main】Choose 1 purple Pilot card from your trash. Add it to your hand.",
      trigger: { type: "activated_main" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 purple Pilot card from your trash. Add it to your hand." }],
    },
  ],

  "GD02-113": [
    {
      id: "a1",
      display_text: "【Main】/【Action】If a friendly (Teiwaz) Link Unit is in play, choose 1 enemy Unit with 2 or less AP. Destroy it.",
      trigger: { type: "activated_main" },
      steps: [{ action: "manual_resolve", prompt_text: "If a friendly (Teiwaz) Link Unit is in play, choose 1 enemy Unit with 2 or less AP. Destroy it." }],
    },
  ],

  "GD02-114": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 damaged friendly Unit. It gets AP+2 during this turn.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.friendlySide, F.isDamaged), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 2, duration: "end_of_turn" },
      ],
    },
  ],

  "GD02-115": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 friendly (Vulture) Unit. It gets AP+2 during this turn.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.friendlySide, F.traits("Vulture")), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 2, duration: "end_of_turn" },
      ],
    },
  ],

  "GD02-116": [
    {
      id: "a1",
      display_text: "【Main】If there are 7 or more cards in your trash, choose 1 friendly (Vulture) Unit. During this turn, it may choose an active enemy Unit that is Lv.4 or lower as its attack target.",
      trigger: { type: "activated_main" },
      steps: [{ action: "manual_resolve", prompt_text: "If there are 7 or more cards in your trash, choose 1 friendly (Vulture) Unit. During this turn, it may declare an attack against an active enemy Unit that is Lv.4 or lower." }],
    },
  ],

  "GD02-117": [
    {
      id: "a1",
      display_text: "【Burst】Choose 1 (AEUG) Base card from your trash. Add it to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 (AEUG) Base card from your trash. Add it to your hand." }],
    },
    {
      id: "a2",
      display_text: "【Main】Draw 3. Then, discard 2.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "draw", side: "friendly", amount: 3 },
        { action: "manual_resolve", prompt_text: "Discard 2 cards from your hand." },
      ],
    },
  ],

  // GD02-118 — blocker in keywords[] is scraper artifact (references enemy unit's keyword, not this card)
  "GD02-118": [
    {
      id: "a1",
      display_text: "【Action】Choose 1 enemy Unit with 4 or less HP battling a friendly Unit with <Blocker>. Return it to its owner's hand.",
      trigger: { type: "activated_action" },
      notes: "blocker in keywords[] is a scraper artifact — Blocker referenced belongs to the friendly battling Unit.",
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 enemy Unit with 4 or less HP that is currently battling a friendly Unit with <Blocker>. Return it to its owner's hand." }],
    },
  ],

  "GD02-119": [
    {
      id: "a1",
      display_text: "【Action】If you have a (Gjallarhorn) Link Unit in play, choose 1 enemy Unit. It gets AP-3 during this battle.",
      trigger: { type: "activated_action" },
      steps: [{ action: "manual_resolve", prompt_text: "If you have a (Gjallarhorn) Link Unit in play, choose 1 enemy Unit. It gets AP-3 during this battle." }],
    },
  ],

  "GD02-120": [
    {
      id: "a1",
      display_text: "【Action】Choose 1 of your (AEUG) Units/Bases. It recovers 2 HP.",
      trigger: { type: "activated_action" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 of your (AEUG) Units or (AEUG) Bases. It recovers 2 HP." }],
    },
  ],

  // ── Bases ─────────────────────────────────────────────────────────────────────

  "GD02-121": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, choose 1 friendly blue Unit. It recovers 2 HP.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all(F.shield, F.friendlySide), selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
        { action: "choose_target", filter: all(F.unit, F.friendlySide, F.colorBlue), selector: "controller_chooses", min: 0, max: 1, store_as: "$unit", optional: true },
        { action: "heal", target: "$unit", amount: 2 },
      ],
    },
  ],

  "GD02-122": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, choose 1 rested enemy Unit that is Lv.4 or lower. Deal 1 damage to it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all(F.shield, F.friendlySide), selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
        { action: "choose_target", filter: all(F.unit, F.enemySide, F.isResting, F.lv("<=", 4)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
      ],
    },
  ],

  "GD02-123": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, choose 1 friendly Unit token. During this turn, it may choose an active enemy Unit with 5 or less AP as its attack target.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all(F.shield, F.friendlySide), selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
        { action: "manual_resolve", prompt_text: "Choose 1 friendly Unit token. During this turn, it may choose an active enemy Unit with 5 or less AP as its attack target." },
      ],
    },
  ],

  "GD02-124": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all(F.shield, F.friendlySide), selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
      ],
    },
    {
      id: "a3",
      display_text: "During your turn, while you are Lv.7 or higher, all friendly green (Earth Federation) Units get AP+1.",
      trigger: { type: "static", qualifiers: { your_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "During your turn: while you are Lv.7 or higher, all friendly green (Earth Federation) Units get AP+1." }],
    },
  ],

  "GD02-125": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, if it is your turn, you may discard 1 red card. If you do, draw 1.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all(F.shield, F.friendlySide), selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
        { action: "manual_resolve", prompt_text: "If it is your turn, you may discard 1 red card from your hand. If you do, draw 1." },
      ],
    },
  ],

  "GD02-126": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all(F.shield, F.friendlySide), selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
      ],
    },
    {
      id: "a3",
      display_text: "【Destroyed】Choose 1 enemy Unit that is Lv.4 or lower. Deal 1 damage to it.",
      trigger: { type: "on_destroyed" },
      steps: [
        { action: "choose_target", filter: all(F.unit, F.enemySide, F.lv("<=", 4)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
      ],
    },
  ],

  "GD02-127": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all(F.shield, F.friendlySide), selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
      ],
    },
    {
      id: "a3",
      display_text: "【Destroyed】Place the top 2 cards of your deck into your trash.",
      trigger: { type: "on_destroyed" },
      steps: [{ action: "manual_resolve", prompt_text: "Place the top 2 cards of your deck into your trash." }],
    },
  ],

  "GD02-128": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, if it is your turn and a friendly (Teiwaz) Link Unit is in play, choose 1 enemy Unit with 2 or less AP. Destroy it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all(F.shield, F.friendlySide), selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
        { action: "manual_resolve", prompt_text: "If it is your turn and a friendly (Teiwaz) Link Unit is in play, choose 1 enemy Unit with 2 or less AP. Destroy it." },
      ],
    },
  ],

  "GD02-129": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all(F.shield, F.friendlySide), selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
      ],
    },
    {
      id: "a3",
      display_text: "This Base can't receive enemy effect damage.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "This Base cannot receive damage from enemy card effects." }],
    },
  ],

  "GD02-130": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, if a friendly (Gjallarhorn) Unit is in play, choose 1 enemy Unit. It gets AP-2 during this turn.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all(F.shield, F.friendlySide), selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
        { action: "manual_resolve", prompt_text: "If a friendly (Gjallarhorn) Unit is in play, choose 1 enemy Unit. It gets AP-2 during this turn." },
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
  log("Seeding GD02 abilities…\n");
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
