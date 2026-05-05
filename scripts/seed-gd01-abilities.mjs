/**
 * Seeds structured abilities for GD01 cards directly into Supabase.
 * Usage: node scripts/seed-gd01-abilities.mjs
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
      if (key && rest.length && !process.env[key.trim()])
        process.env[key.trim()] = rest.join("=").trim();
    }
  } catch {}
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REST = `${SUPABASE_URL}/rest/v1`;

// ─── Filter helpers ───────────────────────────────────────────────────────────
// Each value is a valid single-key FilterSchema clause.
// Combine multiples with { all_of: [...] }.
const F = {
  unit:              { type: "unit" },
  pilot:             { type: "pilot" },
  command:           { type: "command" },
  friendly:          { side: "friendly" },
  enemy:             { side: "enemy" },
  shieldArea:        { zone: "shield_area" },
  resourceArea:      { zone: "resource_area" },
  resting:           { is_resting: true },
  active:            { is_resting: false },
  linked:            { is_linked: true },
  damaged:           { is_damaged: true },
  blocker:           { has_keyword: "blocker" },
  hp:    (op, n)  => ({ hp:    { op, value: n } }),
  ap:    (op, n)  => ({ ap:    { op, value: n } }),
  level: (op, n)  => ({ level: { op, value: n } }),
  traits:  (arr)  => ({ traits_include: arr }),
  color:   (c)    => ({ color: c }),
};

// Shorthand combinators
const all_of = (...clauses) => ({ all_of: clauses.flat() });

const ABILITIES = {

  // ── GD01-001 RX-78-2 Gundam (aura + on_pair) ────────────────────────────────
  "GD01-001": [
    {
      id: "a1",
      display_text: "All your (White Base Team) Units gain <Repair 1>.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While this card is in play: all your (White Base Team) Units gain <Repair 1>. (At the end of your turn, those Units recover 1 HP.)" }],
    },
    {
      id: "a2",
      display_text: "【When Paired】If you have 2 or more other Units in play, draw 1.",
      trigger: { type: "on_pair" },
      steps: [{ action: "manual_resolve", prompt_text: "If you have 2 or more other Units in play: draw 1." }],
    },
  ],

  // ── GD01-002 Unicorn Gundam (Destroy Mode) ──────────────────────────────────
  "GD01-002": [
    {
      id: "a1",
      display_text: "When playing this card from your hand, you may destroy 1 of your Link Units with \"Unicorn Mode\" in its card name that is Lv.5. If you do, play this card as if it has 0 Lv. and cost.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "When playing from hand: you may destroy 1 of your Link Units with 'Unicorn Mode' in its name that is Lv.5. If you do, this card costs 0 and has Lv.0 for this play." }],
    },
    {
      id: "a2",
      display_text: "【Attack】Choose 1 enemy Unit. Rest it.",
      trigger: { type: "on_attack" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "rest", target: "$target" },
      ],
    },
  ],

  // ── GD01-003 Full Armor Unicorn Gundam ──────────────────────────────────────
  "GD01-003": [
    {
      id: "a1",
      display_text: "【During Link】【Attack】Choose 12 cards from your trash. Return them to their owner's deck and shuffle it. If you do, set this Unit as active. It gains <First Strike> during this turn.",
      trigger: { type: "during_link" },
      steps: [{ action: "manual_resolve", prompt_text: "When attacking (while linked): choose 12 cards from your trash and return them to your deck, then shuffle. If you do, set this Unit as active and it gains <First Strike> during this turn." }],
    },
  ],

  // ── GD01-004 Gundam NT-1 Alex ────────────────────────────────────────────────
  // repair 1 in keywords
  "GD01-004": [
    {
      id: "a1",
      display_text: "【When Paired】Choose 1 enemy Unit with 2 or less HP. Rest it.",
      trigger: { type: "on_pair" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.hp("<=", 2)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "rest", target: "$target" },
      ],
    },
  ],

  // ── GD01-005 Gundam RX-0 Unicorn Mode ────────────────────────────────────────
  "GD01-005": [
    {
      id: "a1",
      display_text: "【During Link】【Destroyed】Return this Unit's paired Pilot to its owner's hand. Then, discard 1.",
      trigger: { type: "on_destroyed" },
      notes: "Only triggers if a pilot is linked at time of destruction.",
      steps: [
        { action: "manual_resolve", prompt_text: "If this Unit is linked: return its paired Pilot to its owner's hand. Then, discard 1 card from your hand." },
      ],
    },
  ],

  // ── GD01-006 Gundam Mark II ──────────────────────────────────────────────────
  // repair 1 in keywords
  "GD01-006": [
    {
      id: "a1",
      display_text: "【During Link】This Unit gets HP+1.",
      trigger: { type: "during_link" },
      steps: [{ action: "modify_stat", target: "$self", stat: "hp", amount: 1, duration: "while_paired" }],
    },
  ],

  // ── GD01-007 OZ-06MS Leo ─────────────────────────────────────────────────────
  "GD01-007": [
    {
      id: "a1",
      display_text: "【Destroyed】If you have another (OZ) Unit in play, draw 1.",
      trigger: { type: "on_destroyed" },
      steps: [{ action: "manual_resolve", prompt_text: "If you have another (OZ) Unit in play: draw 1." }],
    },
  ],

  // ── GD01-008 ─────────────────────────────────────────────────────────────────
  "GD01-008": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 rested enemy Unit. Deal 1 damage to it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.resting), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
      ],
    },
  ],

  // ── GD01-009 ─────────────────────────────────────────────────────────────────
  "GD01-009": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 of your (White Base Team) Units. It gains <High-Maneuver> during this turn.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.friendly, F.traits(["White Base Team"])), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "gain_keyword", target: "$target", keyword: "high_maneuver", duration: "end_of_turn" },
      ],
    },
  ],

  // ── GD01-010 ─────────────────────────────────────────────────────────────────
  "GD01-010": [
    {
      id: "a1",
      display_text: "【When Paired】Choose 1 enemy Unit with 3 or less HP. Rest it.",
      trigger: { type: "on_pair" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.hp("<=", 3)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "rest", target: "$target" },
      ],
    },
  ],

  "GD01-011": [],
  "GD01-012": [
    {
      id: "a1",
      display_text: "【When Paired】Choose 1 enemy Unit with 3 or less HP. Rest it.",
      trigger: { type: "on_pair" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.hp("<=", 3)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "rest", target: "$target" },
      ],
    },
  ],
  "GD01-013": [],

  // ── GD01-014 ─────────────────────────────────────────────────────────────────
  "GD01-014": [
    {
      id: "a1",
      display_text: "【During Link】【Activate･Action】【Once per Turn】Choose 1 Unit. It recovers 1 HP.",
      trigger: { type: "during_link" },
      steps: [
        { action: "manual_resolve", prompt_text: "Once per turn, as an action: choose 1 Unit and it recovers 1 HP." },
      ],
    },
  ],

  // ── GD01-015 ─────────────────────────────────────────────────────────────────
  "GD01-015": [
    {
      id: "a1",
      display_text: "【Attack】Choose 1 of your Units. It recovers 1 HP.",
      trigger: { type: "on_attack" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.friendly), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "heal", target: "$target", amount: 1 },
      ],
    },
  ],

  // ── GD01-016 ─────────────────────────────────────────────────────────────────
  "GD01-016": [
    {
      id: "a1",
      display_text: "While you have 2 or more (Earth Federation) Units in play, this card in your hand gets cost -1.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While you have 2 or more (Earth Federation) Units in play: this card in your hand gets cost -1." }],
    },
  ],

  "GD01-017": [], // repair 1 keyword only
  "GD01-018": [],

  // ── GD01-019 ─────────────────────────────────────────────────────────────────
  "GD01-019": [
    {
      id: "a1",
      display_text: "While 4 or more enemy Units are in play, this Unit gains <Blocker>.",
      trigger: { type: "static" },
      notes: "Blocker is conditional; keyword in keywords[] is a scraper artifact.",
      steps: [{ action: "manual_resolve", prompt_text: "While 4 or more enemy Units are in play: this Unit gains <Blocker>." }],
    },
  ],

  // ── GD01-020 ─────────────────────────────────────────────────────────────────
  "GD01-020": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 rested enemy Unit. Deal 1 damage to it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.resting), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
      ],
    },
  ],

  "GD01-021": [],
  "GD01-022": [],

  // ── GD01-023 ─────────────────────────────────────────────────────────────────
  "GD01-023": [
    {
      id: "a1",
      display_text: "【Activate･Main】Discard 1 (Zeon)/(Neo Zeon) Unit card：If a Pilot is not paired with this Unit, choose 1 (Newtype) Pilot card that is Lv.3 or lower from your trash. Pair it with this Unit.",
      trigger: { type: "activated_main", cost: { discard_card: true } },
      steps: [{ action: "manual_resolve", prompt_text: "Discard 1 (Zeon) or (Neo Zeon) Unit card. If no Pilot is paired with this Unit: choose 1 (Newtype) Pilot card that is Lv.3 or lower from your trash and pair it with this Unit." }],
    },
  ],

  // ── GD01-024 ─────────────────────────────────────────────────────────────────
  // High-Maneuver keyword was missed by scraper
  "GD01-024": [
    {
      id: "a1",
      display_text: "<High-Maneuver> (This Unit can't be blocked.)",
      trigger: { type: "static" },
      notes: "Keyword missed by scraper — always has High-Maneuver.",
      steps: [{ action: "gain_keyword", target: "$self", keyword: "high_maneuver", duration: "permanent" }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Deal 3 damage to all Units that are Lv.5 or lower.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "all_matching", filter: all_of(F.unit, F.level("<=", 5)), store_as: "$targets" },
        { action: "deal_damage", target: "$targets", amount: 3, damage_type: "effect" },
      ],
    },
  ],

  // ── GD01-025 ─────────────────────────────────────────────────────────────────
  // First Strike in keywords is a scraper artifact (it's conditional)
  "GD01-025": [
    {
      id: "a1",
      display_text: "【When Paired･(Operation Meteor) Pilot】Place 1 rested Resource. Then, this Unit gains <First Strike> during this turn.",
      trigger: { type: "on_pair", qualifiers: { pilot_traits_include: ["Operation Meteor"] } },
      steps: [
        { action: "manual_resolve", prompt_text: "Place 1 rested Resource. This Unit gains <First Strike> during this turn." },
      ],
    },
  ],

  // ── GD01-026 ─────────────────────────────────────────────────────────────────
  "GD01-026": [
    {
      id: "a1",
      display_text: "【During Pair】【Destroyed】Deploy 1 rested [Char's Zaku Ⅱ]((Zeon)･AP3･HP1) Unit token.",
      trigger: { type: "on_destroyed" },
      notes: "Only triggers if a pilot is paired at time of destruction.",
      steps: [{ action: "create_token", token_id: "chars_zaku_ii_zeon_ap3_hp1", count: 1, rested: true }],
    },
  ],

  // ── GD01-027 ─────────────────────────────────────────────────────────────────
  // Breach 4, Blocker in keywords
  "GD01-027": [
    {
      id: "a1",
      display_text: "【Deploy】If there are 10 or more (Zeon)/(Neo Zeon) Unit cards in your trash, deal 4 damage to all Units with <Blocker>.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "If there are 10 or more (Zeon) or (Neo Zeon) Unit cards in your trash: deal 4 damage to all Units with <Blocker>." }],
    },
  ],

  // ── GD01-028 ─────────────────────────────────────────────────────────────────
  "GD01-028": [
    {
      id: "a1",
      display_text: "【Deploy】You may deploy 1 (Maganac Corps) Unit card from your hand.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "You may deploy 1 (Maganac Corps) Unit card from your hand." }],
    },
  ],

  // ── GD01-029 ─────────────────────────────────────────────────────────────────
  // Breach 4, Blocker in keywords
  "GD01-029": [
    {
      id: "a1",
      display_text: "【Attack】Choose 1 enemy Unit with <Blocker> that is Lv.3 or lower. Destroy it.",
      trigger: { type: "on_attack" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.blocker, F.level("<=", 3)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "destroy", target: "$target" },
      ],
    },
  ],

  "GD01-030": [], // breach 2 keyword only
  "GD01-031": [],

  // ── GD01-032 ─────────────────────────────────────────────────────────────────
  // Blocker in keywords
  "GD01-032": [
    {
      id: "a1",
      display_text: "【When Paired･(Zeon) Pilot】Choose 1 enemy Unit with <Blocker> that is Lv.2 or lower. Destroy it.",
      trigger: { type: "on_pair", qualifiers: { pilot_traits_include: ["Zeon"] } },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.blocker, F.level("<=", 2)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "destroy", target: "$target" },
      ],
    },
  ],

  "GD01-033": [], // repair 1 keyword only

  // ── GD01-034 ─────────────────────────────────────────────────────────────────
  // Breach 3 in keywords is a scraper artifact — only active during pair
  "GD01-034": [
    {
      id: "a1",
      display_text: "【During Pair】This Unit gains <Breach 3>.",
      trigger: { type: "during_pair" },
      notes: "Breach 3 is conditional (only while paired); keyword in keywords[] is a scraper artifact.",
      steps: [{ action: "gain_keyword", target: "$self", keyword: "breach", amount: 3, duration: "while_paired" }],
    },
  ],

  "GD01-035": [],
  "GD01-036": [],
  "GD01-037": [],

  // ── GD01-038 ─────────────────────────────────────────────────────────────────
  "GD01-038": [
    {
      id: "a1",
      display_text: "【Deploy】If 5 or more enemy Units are in play, deal 1 damage to all enemy Units.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "If 5 or more enemy Units are in play: deal 1 damage to all enemy Units." }],
    },
  ],

  // ── GD01-039 ─────────────────────────────────────────────────────────────────
  "GD01-039": [
    {
      id: "a1",
      display_text: "【Deploy】Look at the top card of your deck. Return it to the top or bottom of your deck.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Look at the top card of your deck and return it to the top or bottom." }],
    },
  ],

  "GD01-040": [],
  "GD01-041": [], // breach 3 keyword only

  // ── GD01-042 ─────────────────────────────────────────────────────────────────
  "GD01-042": [
    {
      id: "a1",
      display_text: "This Unit may choose an active enemy Unit that is Lv.2 or lower as its attack target.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "This Unit may target active enemy Units with Lv.2 or lower as an attack target." }],
    },
  ],

  // ── GD01-043 ─────────────────────────────────────────────────────────────────
  "GD01-043": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 of your green Units. During this turn, it may choose an active enemy Unit with 4 or less AP as its attack target.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.friendly, F.color("green")), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "The chosen green Unit may target active enemy Units with 4 or less AP as an attack target during this turn." },
      ],
    },
  ],

  // ── GD01-044 ─────────────────────────────────────────────────────────────────
  "GD01-044": [
    {
      id: "a1",
      display_text: "【When Paired･(Cyber-Newtype)/(Newtype) Pilot】Choose 1 to 2 enemy Units. Deal 1 damage to them.",
      trigger: { type: "on_pair" },
      steps: [
        { action: "manual_resolve", prompt_text: "Only if paired pilot has (Cyber-Newtype) or (Newtype) trait: choose 1 to 2 enemy Units and deal 1 damage to each." },
      ],
    },
  ],

  // ── GD01-045 ─────────────────────────────────────────────────────────────────
  "GD01-045": [
    {
      id: "a1",
      display_text: "【When Paired】Look at the top 3 cards of your deck. You may deploy 1 (ZAFT) Unit card that is Lv.4 or lower among them. Return the remaining cards randomly to the bottom of your deck.",
      trigger: { type: "on_pair" },
      steps: [{ action: "manual_resolve", prompt_text: "Look at the top 3 cards of your deck. You may deploy 1 (ZAFT) Unit card with Lv.4 or lower from among them. Return remaining cards randomly to the bottom." }],
    },
  ],

  // ── GD01-046 ─────────────────────────────────────────────────────────────────
  // Support 3 keyword only (for the Support ability itself). Extra: Coordinator pair bonus.
  "GD01-046": [
    {
      id: "a1",
      display_text: "【During Pair･(Coordinator) Pilot】【Once per Turn】When you use this Unit's <Support> to increase a (ZAFT) Unit's AP, set this Unit as active.",
      trigger: { type: "during_pair", qualifiers: { pilot_traits_include: ["Coordinator"], once_per_turn: true } },
      steps: [{ action: "manual_resolve", prompt_text: "When you use this Unit's <Support> ability to increase a (ZAFT) Unit's AP (once per turn while a Coordinator Pilot is paired): set this Unit as active." }],
    },
  ],

  // ── GD01-047 ─────────────────────────────────────────────────────────────────
  "GD01-047": [
    {
      id: "a1",
      display_text: "【Attack】If 2 or more other rested friendly Units are in play, choose 1 enemy Unit. Deal 3 damage to it.",
      trigger: { type: "on_attack" },
      steps: [{ action: "manual_resolve", prompt_text: "If 2 or more other rested friendly Units are in play: choose 1 enemy Unit and deal 3 damage to it." }],
    },
  ],

  // ── GD01-048 ─────────────────────────────────────────────────────────────────
  // Support 1 keyword only (for the Support ability itself). Extra: on_deploy scry.
  "GD01-048": [
    {
      id: "a1",
      display_text: "【Deploy】Look at the top card of your deck. If it is a (Zeon)/(Neo Zeon) Unit card, you may reveal it and add it to your hand. Return any remaining card to the bottom of your deck.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Look at the top card of your deck. If it is a (Zeon) or (Neo Zeon) Unit card, you may reveal it and add it to your hand. Return any remaining card to the bottom." }],
    },
  ],

  // ── GD01-049 ─────────────────────────────────────────────────────────────────
  // First Strike keyword is scraper artifact (conditional)
  "GD01-049": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 of your (ZAFT) Units with 5 or more AP. It gains <First Strike> during this turn.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.friendly, F.traits(["ZAFT"]), F.ap(">=", 5)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "gain_keyword", target: "$target", keyword: "first_strike", duration: "end_of_turn" },
      ],
    },
  ],

  // ── GD01-050 ─────────────────────────────────────────────────────────────────
  "GD01-050": [
    {
      id: "a1",
      display_text: "【Attack】If this Unit has 5 or more AP and it is attacking an enemy Unit, choose 1 enemy Unit. Deal 2 damage to it.",
      trigger: { type: "on_attack" },
      steps: [{ action: "manual_resolve", prompt_text: "If this Unit has 5 or more AP and is attacking an enemy Unit (not the player): choose 1 enemy Unit and deal 2 damage to it." }],
    },
  ],

  "GD01-051": [],

  // ── GD01-052 ─────────────────────────────────────────────────────────────────
  "GD01-052": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 enemy Unit. Deal 1 damage to it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
      ],
    },
  ],

  // ── GD01-053 ─────────────────────────────────────────────────────────────────
  "GD01-053": [
    {
      id: "a1",
      display_text: "【Activate･Main】【Once per Turn】①：Choose 1 enemy Unit with 2 or less AP. Deal 1 damage to it.",
      trigger: { type: "activated_main", qualifiers: { once_per_turn: true }, cost: { pay_resources: 1 } },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.ap("<=", 2)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
      ],
    },
  ],

  // ── GD01-054 ─────────────────────────────────────────────────────────────────
  // Breach 3 keyword is scraper artifact (conditional)
  "GD01-054": [
    {
      id: "a1",
      display_text: "While this Unit has 5 or more AP, it gains <Breach 3>.",
      trigger: { type: "static" },
      notes: "Breach 3 is conditional; keyword in keywords[] is a scraper artifact.",
      steps: [{ action: "manual_resolve", prompt_text: "While this Unit has 5 or more AP: it gains <Breach 3>." }],
    },
  ],

  "GD01-055": [], // support 2 keyword only

  // ── GD01-056 ─────────────────────────────────────────────────────────────────
  "GD01-056": [
    {
      id: "a1",
      display_text: "【Destroyed】Choose 1 enemy Unit with 5 or less AP. Deal 1 damage to it.",
      trigger: { type: "on_destroyed" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.ap("<=", 5)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
      ],
    },
  ],

  "GD01-057": [],

  // ── GD01-058 ─────────────────────────────────────────────────────────────────
  "GD01-058": [
    {
      id: "a1",
      display_text: "【Activate･Action】【Once per Turn】①：Choose 1 Unit that is Lv.4 or higher. It gets AP+1 during this battle.",
      trigger: { type: "activated_action", qualifiers: { once_per_turn: true }, cost: { pay_resources: 1 } },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.level(">=", 4)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 1, duration: "end_of_battle" },
      ],
    },
  ],

  // ── GD01-059 ─────────────────────────────────────────────────────────────────
  "GD01-059": [
    {
      id: "a1",
      display_text: "【Attack】If you are attacking the enemy player, this Unit gets AP+2 during this battle.",
      trigger: { type: "on_attack" },
      steps: [{ action: "manual_resolve", prompt_text: "If this Unit is attacking the enemy player: it gets AP+2 during this battle." }],
    },
  ],

  "GD01-060": [],
  "GD01-061": [], // support 1 keyword only
  "GD01-062": [],

  // ── GD01-063 ─────────────────────────────────────────────────────────────────
  // First Strike keyword is scraper artifact (conditional)
  "GD01-063": [
    {
      id: "a1",
      display_text: "During your turn, while this Unit is battling an enemy Unit that is Lv.2 or lower, it gains <First Strike>.",
      trigger: { type: "static", qualifiers: { your_turn_only: true } },
      notes: "First Strike is conditional; keyword in keywords[] is a scraper artifact.",
      steps: [{ action: "manual_resolve", prompt_text: "During your turn, while battling an enemy Unit that is Lv.2 or lower: this Unit gains <First Strike>." }],
    },
  ],

  "GD01-064": [],

  // ── GD01-065 ─────────────────────────────────────────────────────────────────
  // Blocker in keywords
  "GD01-065": [
    {
      id: "a1",
      display_text: "【During Pair】【Once per Turn】When you pair a Pilot with this Unit or one of your white Units, choose 1 enemy Unit. It gets AP-2 during this turn.",
      trigger: { type: "during_pair", qualifiers: { once_per_turn: true } },
      steps: [{ action: "manual_resolve", prompt_text: "Once per turn while paired: when you pair a Pilot with this Unit or one of your white Units, choose 1 enemy Unit. It gets AP-2 during this turn." }],
    },
  ],

  // ── GD01-066 ─────────────────────────────────────────────────────────────────
  "GD01-066": [
    {
      id: "a1",
      display_text: "【Deploy】Deploy 1 [Fatum-00]((Triple Ship Alliance)･AP2･HP2･<Blocker>) Unit token.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "create_token", token_id: "fatum_00_tsa_ap2_hp2_blocker", count: 1, rested: false }],
    },
    {
      id: "a2",
      display_text: "【During Pair】【Attack】Choose 1 of your (Triple Ship Alliance) Unit tokens. It may attack on the turn it is deployed.",
      trigger: { type: "during_pair" },
      steps: [{ action: "manual_resolve", prompt_text: "When attacking while paired: choose 1 of your (Triple Ship Alliance) Unit tokens. It may attack on the turn it was deployed." }],
    },
  ],

  // ── GD01-067 ─────────────────────────────────────────────────────────────────
  "GD01-067": [
    {
      id: "a1",
      display_text: "【When Paired】Choose 1 Command card that is Lv.5 or lower from your trash. Add it to your hand.",
      trigger: { type: "on_pair" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 Command card with Lv.5 or lower from your trash and add it to your hand." }],
    },
  ],

  // ── GD01-068 ─────────────────────────────────────────────────────────────────
  // Blocker in keywords
  "GD01-068": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 enemy Unit with 1 HP. Return it to its owner's hand.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.hp("<=", 1)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "move_to_hand", target: "$target" },
      ],
    },
  ],

  // ── GD01-069 ─────────────────────────────────────────────────────────────────
  // Blocker in keywords
  "GD01-069": [
    {
      id: "a1",
      display_text: "【Activate･Main】【Once per Turn】①：Choose 1 of your rested white Units with <Blocker>. Set it as active. It can't attack during this turn.",
      trigger: { type: "activated_main", qualifiers: { once_per_turn: true }, cost: { pay_resources: 1 } },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.friendly, F.color("white"), F.resting, F.blocker), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "ready", target: "$target" },
        { action: "manual_resolve", prompt_text: "The chosen Unit is now active but cannot attack this turn." },
      ],
    },
  ],

  // ── GD01-070 ─────────────────────────────────────────────────────────────────
  "GD01-070": [
    {
      id: "a1",
      display_text: "While there are 4 or more Command cards in your trash, this card in your hand gets cost -2.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While there are 4 or more Command cards in your trash: this card in your hand gets cost -2." }],
    },
  ],

  // ── GD01-071 ─────────────────────────────────────────────────────────────────
  "GD01-071": [
    {
      id: "a1",
      display_text: "【During Link】【Attack】Choose 1 enemy Unit. It gets AP-2 during this battle.",
      trigger: { type: "during_link" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: -2, duration: "end_of_battle" },
      ],
    },
  ],

  "GD01-072": [], // blocker keyword only

  // ── GD01-073 ─────────────────────────────────────────────────────────────────
  "GD01-073": [
    {
      id: "a1",
      display_text: "【During Link】【Attack】Choose 1 enemy Unit with 2 or less HP. Return it to its owner's hand.",
      trigger: { type: "during_link" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.hp("<=", 2)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "move_to_hand", target: "$target" },
      ],
    },
  ],

  // ── GD01-074 ─────────────────────────────────────────────────────────────────
  "GD01-074": [
    {
      id: "a1",
      display_text: "【Attack】Draw 1. Then, discard 1.",
      trigger: { type: "on_attack" },
      steps: [
        { action: "draw", side: "friendly", amount: 1 },
        { action: "manual_resolve", prompt_text: "Discard 1 card from your hand." },
      ],
    },
  ],

  // ── GD01-075 ─────────────────────────────────────────────────────────────────
  "GD01-075": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 enemy Unit with 1 HP. Return it to its owner's hand.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.hp("<=", 1)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "move_to_hand", target: "$target" },
      ],
    },
  ],

  // ── GD01-076 ─────────────────────────────────────────────────────────────────
  "GD01-076": [
    {
      id: "a1",
      display_text: "While there are 4 or more Command cards in your trash, this Unit gets AP+1 and HP+1.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While there are 4 or more Command cards in your trash: this Unit gets AP+1 and HP+1." }],
    },
  ],

  "GD01-077": [],

  // ── GD01-078 ─────────────────────────────────────────────────────────────────
  "GD01-078": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 enemy Unit. It gets AP-1 during this turn.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: -1, duration: "end_of_turn" },
      ],
    },
  ],

  "GD01-079": [],

  // ── GD01-080 ─────────────────────────────────────────────────────────────────
  "GD01-080": [
    {
      id: "a1",
      display_text: "【Destroyed】Choose 1 enemy Unit that is Lv.2 or lower. Return it to its owner's hand.",
      trigger: { type: "on_destroyed" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.level("<=", 2)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "move_to_hand", target: "$target" },
      ],
    },
  ],

  // ── GD01-081 ─────────────────────────────────────────────────────────────────
  // Blocker in keywords (conditional)
  "GD01-081": [
    {
      id: "a1",
      display_text: "While you have another (Triple Ship Alliance) Unit in play, this Unit gets AP+1 and <Blocker>.",
      trigger: { type: "static" },
      notes: "Blocker and AP+1 are conditional; keyword in keywords[] is a scraper artifact.",
      steps: [{ action: "manual_resolve", prompt_text: "While you have another (Triple Ship Alliance) Unit in play: this Unit gets AP+1 and gains <Blocker>." }],
    },
  ],

  // ── GD01-082 ─────────────────────────────────────────────────────────────────
  "GD01-082": [
    {
      id: "a1",
      display_text: "【During Pair】【Activate･Action】【Once per Turn】②：Choose 1 enemy Unit. It gets AP-1 during this battle.",
      trigger: { type: "during_pair", qualifiers: { once_per_turn: true } },
      steps: [
        { action: "manual_resolve", prompt_text: "Once per turn as an Action (cost ②) while paired: choose 1 enemy Unit. It gets AP-1 during this battle." },
      ],
    },
  ],

  "GD01-083": [],
  "GD01-084": [],
  "GD01-085": [],
  "GD01-086": [], // blocker keyword only

  // ════════════════════════════════════════════════════════════════════════════
  // GD01 PILOTS (all start with on_burst → move_to_hand)
  // ════════════════════════════════════════════════════════════════════════════

  // ── GD01-087 ─────────────────────────────────────────────────────────────────
  "GD01-087": [
    { id: "a1", display_text: "【Burst】Add this card to your hand.", trigger: { type: "on_burst" }, steps: [{ action: "move_to_hand", target: "$self" }] },
    {
      id: "a2",
      display_text: "While this Unit is blue, it gains <Repair 1>.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While this Unit is blue: it gains <Repair 1>. (At the end of your turn, it recovers 1 HP.)" }],
    },
  ],

  // ── GD01-088 ─────────────────────────────────────────────────────────────────
  "GD01-088": [
    { id: "a1", display_text: "【Burst】Add this card to your hand.", trigger: { type: "on_burst" }, steps: [{ action: "move_to_hand", target: "$self" }] },
    { id: "a2", display_text: "【When Linked】Draw 1.", trigger: { type: "on_link_established" }, steps: [{ action: "draw", side: "friendly", amount: 1 }] },
  ],

  // ── GD01-089 ─────────────────────────────────────────────────────────────────
  "GD01-089": [
    { id: "a1", display_text: "【Burst】Add this card to your hand.", trigger: { type: "on_burst" }, steps: [{ action: "move_to_hand", target: "$self" }] },
    {
      id: "a2",
      display_text: "While this Unit has <Repair>, it gets AP+1.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While this Unit has any <Repair> keyword: it gets AP+1." }],
    },
  ],

  // ── GD01-090 ─────────────────────────────────────────────────────────────────
  "GD01-090": [
    { id: "a1", display_text: "【Burst】Add this card to your hand.", trigger: { type: "on_burst" }, steps: [{ action: "move_to_hand", target: "$self" }] },
    {
      id: "a2",
      display_text: "【During Link】This Unit's AP can't be reduced by enemy effects.",
      trigger: { type: "during_link" },
      steps: [{ action: "manual_resolve", prompt_text: "While linked: this Unit's AP cannot be reduced by enemy effects." }],
    },
  ],

  // ── GD01-091 ─────────────────────────────────────────────────────────────────
  "GD01-091": [
    { id: "a1", display_text: "【Burst】Add this card to your hand.", trigger: { type: "on_burst" }, steps: [{ action: "move_to_hand", target: "$self" }] },
    {
      id: "a2",
      display_text: "During your turn, while this Unit has <Breach>, it can't receive battle damage from enemy Units with 3 or less AP.",
      trigger: { type: "static", qualifiers: { your_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "During your turn, while this Unit has any <Breach> keyword: it cannot receive battle damage from enemy Units with 3 or less AP." }],
    },
  ],

  // ── GD01-092 ─────────────────────────────────────────────────────────────────
  // Breach 1 in keywords is scraper artifact (conditional)
  "GD01-092": [
    { id: "a1", display_text: "【Burst】Add this card to your hand.", trigger: { type: "on_burst" }, steps: [{ action: "move_to_hand", target: "$self" }] },
    {
      id: "a2",
      display_text: "While this Unit is (Zeon), it gains <Breach 1>.",
      trigger: { type: "static" },
      notes: "Breach 1 is conditional; keyword in keywords[] may be a scraper artifact.",
      steps: [{ action: "manual_resolve", prompt_text: "While this Unit is a (Zeon) Unit: it gains <Breach 1>." }],
    },
  ],

  // ── GD01-093 ─────────────────────────────────────────────────────────────────
  "GD01-093": [
    { id: "a1", display_text: "【Burst】Add this card to your hand.", trigger: { type: "on_burst" }, steps: [{ action: "move_to_hand", target: "$self" }] },
    {
      id: "a2",
      display_text: "【During Link】【Attack】Choose 1 enemy Unit whose Lv. is equal to or lower than this Unit. Deal 1 damage to it.",
      trigger: { type: "during_link" },
      steps: [{ action: "manual_resolve", prompt_text: "When attacking (while linked): choose 1 enemy Unit whose Lv. is equal to or lower than this Unit's Lv. Deal 1 damage to it." }],
    },
  ],

  // ── GD01-094 ─────────────────────────────────────────────────────────────────
  "GD01-094": [
    { id: "a1", display_text: "【Burst】Add this card to your hand.", trigger: { type: "on_burst" }, steps: [{ action: "move_to_hand", target: "$self" }] },
    {
      id: "a2",
      display_text: "【Once per Turn】When an enemy Link Unit is destroyed with damage while this Unit is attacking, draw 1.",
      trigger: { type: "on_damage_dealt", qualifiers: { once_per_turn: true } },
      steps: [{ action: "manual_resolve", prompt_text: "Once per turn: when an enemy Link Unit is destroyed with damage while this Unit is attacking, draw 1." }],
    },
  ],

  // ── GD01-095 ─────────────────────────────────────────────────────────────────
  "GD01-095": [
    { id: "a1", display_text: "【Burst】Add this card to your hand.", trigger: { type: "on_burst" }, steps: [{ action: "move_to_hand", target: "$self" }] },
    {
      id: "a2",
      display_text: "【When Linked】Discard 1. If you do, draw 1.",
      trigger: { type: "on_link_established" },
      steps: [
        { action: "manual_resolve", prompt_text: "Discard 1 card from your hand. If you do, draw 1." },
      ],
    },
  ],

  // ── GD01-096 ─────────────────────────────────────────────────────────────────
  // Blocker in keywords (conditional)
  "GD01-096": [
    { id: "a1", display_text: "【Burst】Add this card to your hand.", trigger: { type: "on_burst" }, steps: [{ action: "move_to_hand", target: "$self" }] },
    {
      id: "a2",
      display_text: "While this Unit is white, it gains <Blocker>.",
      trigger: { type: "static" },
      notes: "Blocker is conditional; keyword in keywords[] is a scraper artifact.",
      steps: [{ action: "manual_resolve", prompt_text: "While this Unit is white: it gains <Blocker>." }],
    },
  ],

  // ── GD01-097 ─────────────────────────────────────────────────────────────────
  "GD01-097": [
    { id: "a1", display_text: "【Burst】Add this card to your hand.", trigger: { type: "on_burst" }, steps: [{ action: "move_to_hand", target: "$self" }] },
    {
      id: "a2",
      display_text: "【Activate･Main】【Once per Turn】If your opponent has 8 or more cards in their hand, set this Unit as active. It can't attack during this turn.",
      trigger: { type: "activated_main", qualifiers: { once_per_turn: true } },
      steps: [{ action: "manual_resolve", prompt_text: "If your opponent has 8 or more cards in their hand: set this Unit as active. It cannot attack during this turn." }],
    },
  ],

  // ── GD01-098 ─────────────────────────────────────────────────────────────────
  "GD01-098": [
    { id: "a1", display_text: "【Burst】Add this card to your hand.", trigger: { type: "on_burst" }, steps: [{ action: "move_to_hand", target: "$self" }] },
    {
      id: "a2",
      display_text: "【Activate･Action】【Once per Turn】If an enemy Unit with 1 or less AP is in play, this Unit recovers 1 HP.",
      trigger: { type: "activated_action", qualifiers: { once_per_turn: true } },
      steps: [{ action: "manual_resolve", prompt_text: "If an enemy Unit with 1 or less AP is in play: this Unit recovers 1 HP." }],
    },
  ],

  // ════════════════════════════════════════════════════════════════════════════
  // GD01 COMMANDS
  // ════════════════════════════════════════════════════════════════════════════

  // ── GD01-099 ─────────────────────────────────────────────────────────────────
  "GD01-099": [
    {
      id: "a1",
      display_text: "【Burst】Choose 1 enemy Unit with 5 or less HP. Rest it.",
      trigger: { type: "on_burst" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.hp("<=", 5)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "rest", target: "$target" },
      ],
    },
    {
      id: "a2",
      display_text: "【Main】/【Action】Choose 1 to 2 enemy Units with 3 or less HP. Rest them.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.hp("<=", 3)), selector: "controller_chooses", min: 1, max: 2, store_as: "$targets" },
        { action: "rest", target: "$targets" },
      ],
    },
  ],

  // ── GD01-100 ─────────────────────────────────────────────────────────────────
  "GD01-100": [
    {
      id: "a1",
      display_text: "【Main】Draw 2.",
      trigger: { type: "activated_main" },
      steps: [{ action: "draw", side: "friendly", amount: 2 }],
    },
  ],

  // ── GD01-101 ─────────────────────────────────────────────────────────────────
  "GD01-101": [
    {
      id: "a1",
      display_text: "【Main】Choose 1 friendly Link Unit. It recovers 3 HP.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.friendly, F.linked), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "heal", target: "$target", amount: 3 },
      ],
    },
  ],

  // ── GD01-102 ─────────────────────────────────────────────────────────────────
  "GD01-102": [
    {
      id: "a1",
      display_text: "【Main】All friendly Units that are Lv.4 or lower recover 2 HP.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "all_matching", filter: all_of(F.unit, F.friendly, F.level("<=", 4)), store_as: "$targets" },
        { action: "heal", target: "$targets", amount: 2 },
      ],
    },
  ],

  // ── GD01-103 ─────────────────────────────────────────────────────────────────
  "GD01-103": [
    {
      id: "a1",
      display_text: "【Main】Choose 1 active friendly (Earth Federation) Unit and 1 active enemy Unit. Rest them.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.friendly, F.traits(["Earth Federation"]), F.active), selector: "controller_chooses", min: 1, max: 1, store_as: "$friendly_target" },
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.active), selector: "controller_chooses", min: 1, max: 1, store_as: "$enemy_target" },
        { action: "rest", target: "$friendly_target" },
        { action: "rest", target: "$enemy_target" },
      ],
    },
  ],

  // ── GD01-104 ─────────────────────────────────────────────────────────────────
  "GD01-104": [
    {
      id: "a1",
      display_text: "【Burst】Draw 1.",
      trigger: { type: "on_burst" },
      steps: [{ action: "draw", side: "friendly", amount: 1 }],
    },
    {
      id: "a2",
      display_text: "【Main】Choose 1 rested enemy Unit. Deal 2 damage to it.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.resting), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 2, damage_type: "effect" },
      ],
    },
  ],

  // ── GD01-105 ─────────────────────────────────────────────────────────────────
  "GD01-105": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【Main】All your Units get AP+2 during this turn.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "all_matching", filter: all_of(F.unit, F.friendly), store_as: "$targets" },
        { action: "modify_stat", target: "$targets", stat: "ap", amount: 2, duration: "end_of_turn" },
      ],
    },
  ],

  // ── GD01-106 ─────────────────────────────────────────────────────────────────
  "GD01-106": [
    {
      id: "a1",
      display_text: "【Main】Deploy 2 [Zaku Ⅱ]((Zeon)･AP1･HP1) Unit tokens.",
      trigger: { type: "activated_main" },
      steps: [{ action: "create_token", token_id: "zaku_ii_zeon_ap1_hp1", count: 2, rested: false }],
    },
  ],

  // ── GD01-107 ─────────────────────────────────────────────────────────────────
  "GD01-107": [
    {
      id: "a1",
      display_text: "【Burst】Place 1 EX Resource.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Place 1 EX Resource token into your resource area." }],
    },
    {
      id: "a2",
      display_text: "【Main】Place 1 rested Resource.",
      trigger: { type: "activated_main" },
      steps: [{ action: "manual_resolve", prompt_text: "Place 1 rested Resource into your resource area." }],
    },
  ],

  // ── GD01-108 ─────────────────────────────────────────────────────────────────
  "GD01-108": [
    {
      id: "a1",
      display_text: "【Main】Deal 2 damage to all Units with <Blocker>.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "all_matching", filter: all_of(F.unit, F.blocker), store_as: "$targets" },
        { action: "deal_damage", target: "$targets", amount: 2, damage_type: "effect" },
      ],
    },
  ],

  // ── GD01-109 ─────────────────────────────────────────────────────────────────
  "GD01-109": [
    {
      id: "a1",
      display_text: "【Main】Look at the top 5 cards of your deck. You may reveal 1 (Operation Meteor)/(G Team) Unit card/Pilot card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
      trigger: { type: "activated_main" },
      steps: [{ action: "manual_resolve", prompt_text: "Look at the top 5 cards of your deck. You may reveal 1 (Operation Meteor) or (G Team) Unit or Pilot card and add it to your hand. Return remaining cards randomly to the bottom." }],
    },
  ],

  // ── GD01-110 ─────────────────────────────────────────────────────────────────
  "GD01-110": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 Unit that is Lv.4 or higher. During this turn, it may choose an active enemy Unit with 6 or less AP as its attack target.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.level(">=", 4)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "The chosen Unit (Lv.4+) may target active enemy Units with 6 or less AP as an attack target during this turn." },
      ],
    },
  ],

  // ── GD01-111 ─────────────────────────────────────────────────────────────────
  "GD01-111": [
    {
      id: "a1",
      display_text: "【Burst】Choose 1 enemy Unit. Deal 2 damage to it.",
      trigger: { type: "on_burst" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 2, damage_type: "effect" },
      ],
    },
    {
      id: "a2",
      display_text: "【Main】/【Action】Choose 1 damaged enemy Unit. Deal 3 damage to it.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.damaged), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 3, damage_type: "effect" },
      ],
    },
  ],

  // ── GD01-112 ─────────────────────────────────────────────────────────────────
  "GD01-112": [
    {
      id: "a1",
      display_text: "【Main】Choose 2 of your active Units. Rest them. If you do, choose 1 enemy Unit. Deal 3 damage to it.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.friendly, F.active), selector: "controller_chooses", min: 2, max: 2, store_as: "$friendly_targets" },
        { action: "rest", target: "$friendly_targets" },
        { action: "choose_target", filter: all_of(F.unit, F.enemy), selector: "controller_chooses", min: 1, max: 1, store_as: "$enemy_target" },
        { action: "deal_damage", target: "$enemy_target", amount: 3, damage_type: "effect" },
      ],
    },
  ],

  // ── GD01-113 ─────────────────────────────────────────────────────────────────
  "GD01-113": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 friendly (ZAFT) Unit. It gets AP+3 during this turn.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.friendly, F.traits(["ZAFT"])), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 3, duration: "end_of_turn" },
      ],
    },
  ],

  // ── GD01-114 ─────────────────────────────────────────────────────────────────
  "GD01-114": [
    {
      id: "a1",
      display_text: "【Action】Choose 2 friendly Units. They get AP+1 during this turn.",
      trigger: { type: "activated_action" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.friendly), selector: "controller_chooses", min: 2, max: 2, store_as: "$targets" },
        { action: "modify_stat", target: "$targets", stat: "ap", amount: 1, duration: "end_of_turn" },
      ],
    },
  ],

  // ── GD01-115 ─────────────────────────────────────────────────────────────────
  "GD01-115": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 enemy Unit. Deal 1 damage to it.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
      ],
    },
  ],

  // ── GD01-116 ─────────────────────────────────────────────────────────────────
  "GD01-116": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 enemy Unit with 2 or less AP. Deal 2 damage to it.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.ap("<=", 2)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 2, damage_type: "effect" },
      ],
    },
  ],

  // ── GD01-117 ─────────────────────────────────────────────────────────────────
  "GD01-117": [
    {
      id: "a1",
      display_text: "【Burst】Activate this card's 【Main】 — Choose 1 enemy Unit with 5 or less HP. Return it to its owner's hand.",
      trigger: { type: "on_burst" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.hp("<=", 5)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "move_to_hand", target: "$target" },
      ],
    },
    {
      id: "a2",
      display_text: "【Main】/【Action】Choose 1 enemy Unit with 5 or less HP. Return it to its owner's hand.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.hp("<=", 5)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "move_to_hand", target: "$target" },
      ],
    },
  ],

  // ── GD01-118 ─────────────────────────────────────────────────────────────────
  "GD01-118": [
    {
      id: "a1",
      display_text: "【Main】Draw 2. Then, discard 1.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "draw", side: "friendly", amount: 2 },
        { action: "manual_resolve", prompt_text: "Discard 1 card from your hand." },
      ],
    },
  ],

  // ── GD01-119 ─────────────────────────────────────────────────────────────────
  "GD01-119": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 enemy Unit that is Lv.4 or lower. It gets AP-2 during this turn.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.level("<=", 4)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: -2, duration: "end_of_turn" },
      ],
    },
  ],

  // ── GD01-120 ─────────────────────────────────────────────────────────────────
  "GD01-120": [
    {
      id: "a1",
      display_text: "【Burst】Choose 1 enemy Unit. It gets AP-3 during this turn.",
      trigger: { type: "on_burst" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.enemy), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: -3, duration: "end_of_turn" },
      ],
    },
    {
      id: "a2",
      display_text: "【Action】Choose 1 friendly Unit with <Blocker>. It gets AP+3 during this turn.",
      trigger: { type: "activated_action" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.friendly, F.blocker), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 3, duration: "end_of_turn" },
      ],
    },
  ],

  // ── GD01-121 ─────────────────────────────────────────────────────────────────
  "GD01-121": [
    {
      id: "a1",
      display_text: "【Burst】Activate this card's 【Main】 — Choose 1 rested Unit with <Blocker>. Set it as active. It can't attack during this turn.",
      trigger: { type: "on_burst" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.resting, F.blocker), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "ready", target: "$target" },
        { action: "manual_resolve", prompt_text: "The chosen Unit with <Blocker> is now active but cannot attack this turn." },
      ],
    },
    {
      id: "a2",
      display_text: "【Main】Choose 1 rested Unit with <Blocker>. Set it as active. It can't attack during this turn.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.resting, F.blocker), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "ready", target: "$target" },
        { action: "manual_resolve", prompt_text: "The chosen Unit with <Blocker> is now active but cannot attack this turn." },
      ],
    },
  ],

  // ── GD01-122 ─────────────────────────────────────────────────────────────────
  "GD01-122": [
    {
      id: "a1",
      display_text: "【Main】Choose 1 enemy Unit with 2 or less HP. Return it to its owner's hand. If you have a Link Unit in play, choose 1 enemy Unit with 4 or less HP instead.",
      trigger: { type: "activated_main" },
      steps: [{ action: "manual_resolve", prompt_text: "If you have a Link Unit in play: choose 1 enemy Unit with 4 or less HP and return it to its owner's hand. Otherwise: choose 1 enemy Unit with 2 or less HP and return it to its owner's hand." }],
    },
  ],

  // ════════════════════════════════════════════════════════════════════════════
  // GD01 BASES
  // ════════════════════════════════════════════════════════════════════════════

  // ── GD01-123 ─────────────────────────────────────────────────────────────────
  "GD01-123": [
    { id: "a1", display_text: "【Burst】Deploy this card.", trigger: { type: "on_burst" }, steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }] },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, choose 1 enemy Unit with 3 or less HP. Rest it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all_of(F.shieldArea, F.friendly), selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.hp("<=", 3)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "rest", target: "$target" },
      ],
    },
  ],

  // ── GD01-124 ─────────────────────────────────────────────────────────────────
  "GD01-124": [
    { id: "a1", display_text: "【Burst】Deploy this card.", trigger: { type: "on_burst" }, steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }] },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all_of(F.shieldArea, F.friendly), selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
      ],
    },
    {
      id: "a3",
      display_text: "【Activate･Main】Rest this Base：Choose 1 friendly Unit. It recovers 1 HP.",
      trigger: { type: "activated_main", cost: { rest_self: true } },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.friendly), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "heal", target: "$target", amount: 1 },
      ],
    },
  ],

  // ── GD01-125 ─────────────────────────────────────────────────────────────────
  "GD01-125": [
    { id: "a1", display_text: "【Burst】Deploy this card.", trigger: { type: "on_burst" }, steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }] },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, if it is your turn, you may deploy 1 (Zeon) Unit card that is Lv.4 or lower from your hand.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all_of(F.shieldArea, F.friendly), selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
        { action: "manual_resolve", prompt_text: "If it is your turn: you may deploy 1 (Zeon) Unit card with Lv.4 or lower from your hand." },
      ],
    },
  ],

  // ── GD01-126 ─────────────────────────────────────────────────────────────────
  "GD01-126": [
    { id: "a1", display_text: "【Burst】Deploy this card.", trigger: { type: "on_burst" }, steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }] },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all_of(F.shieldArea, F.friendly), selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
      ],
    },
  ],

  // ── GD01-127 ─────────────────────────────────────────────────────────────────
  // Breach 3 in keywords
  "GD01-127": [
    { id: "a1", display_text: "【Burst】Deploy this card.", trigger: { type: "on_burst" }, steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }] },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all_of(F.shieldArea, F.friendly), selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
      ],
    },
    {
      id: "a3",
      display_text: "【Activate･Action】Rest this Base：Choose 1 friendly (ZAFT) Unit with 5 or more AP. It gains <Breach 3> during this battle.",
      trigger: { type: "activated_action", cost: { rest_self: true } },
      steps: [
        { action: "choose_target", filter: all_of(F.unit, F.friendly, F.traits(["ZAFT"]), F.ap(">=", 5)), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "gain_keyword", target: "$target", keyword: "breach", amount: 3, duration: "end_of_battle" },
      ],
    },
  ],

  // ── GD01-128 ─────────────────────────────────────────────────────────────────
  "GD01-128": [
    { id: "a1", display_text: "【Burst】Deploy this card.", trigger: { type: "on_burst" }, steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }] },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all_of(F.shieldArea, F.friendly), selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
      ],
    },
  ],

  // ── GD01-129 ─────────────────────────────────────────────────────────────────
  "GD01-129": [
    { id: "a1", display_text: "【Burst】Deploy this card.", trigger: { type: "on_burst" }, steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }] },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, choose 1 enemy Unit with 3 or less HP. Return it to its owner's hand.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all_of(F.shieldArea, F.friendly), selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
        { action: "choose_target", filter: all_of(F.unit, F.enemy, F.hp("<=", 3)), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "move_to_hand", target: "$target" },
      ],
    },
  ],

  // ── GD01-130 ─────────────────────────────────────────────────────────────────
  "GD01-130": [
    { id: "a1", display_text: "【Burst】Deploy this card.", trigger: { type: "on_burst" }, steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }] },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: all_of(F.shieldArea, F.friendly), selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
      ],
    },
    {
      id: "a3",
      display_text: "【Activate･Main】Rest this Base：If a friendly (Academy) Unit is in play, choose 1 enemy Unit. It gets AP-1 during this turn.",
      trigger: { type: "activated_main", cost: { rest_self: true } },
      steps: [{ action: "manual_resolve", prompt_text: "If a friendly (Academy) Unit is in play: choose 1 enemy Unit. It gets AP-1 during this turn." }],
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
  log("Seeding GD01 abilities…\n");
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
