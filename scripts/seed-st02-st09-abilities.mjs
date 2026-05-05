/**
 * Seeds structured abilities for ST02–ST09 cards directly into Supabase.
 * Usage: node scripts/seed-st02-st09-abilities.mjs
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

// ─── Filter shorthands ────────────────────────────────────────────────────────
// Helpers so the ability data below stays readable.
// All filters use formal FilterSchema (single-key discriminated union objects,
// combined with all_of). Never use shorthand multi-key objects.

const f = {
  // ── Side + type basics ──────────────────────────────────────────────────────
  friendlyUnit:              { all_of: [{ side: "friendly" }, { type: "unit" }] },
  enemyUnit:                 { all_of: [{ side: "enemy" },   { type: "unit" }] },
  friendlyShield:            { all_of: [{ zone: "shield_area" }, { side: "friendly" }] },
  friendlyLinked:            { all_of: [{ side: "friendly" }, { type: "unit" }, { is_linked: true }] },
  friendlyUnitDamaged:       { all_of: [{ side: "friendly" }, { type: "unit" }, { is_damaged: true }] },
  friendlyUnitNotSelf:       { all_of: [{ side: "friendly" }, { type: "unit" }, { exclude_self: true }] },

  // ── Parametric helpers ───────────────────────────────────────────────────────
  /** Enemy unit with HP ≤ n */
  enemyUnitMaxHp:            (n) => ({ all_of: [{ side: "enemy" },   { type: "unit" }, { hp:    { op: "<=", value: n } }] }),
  /** Enemy unit with level ≤ n */
  enemyUnitMaxLv:            (n) => ({ all_of: [{ side: "enemy" },   { type: "unit" }, { level: { op: "<=", value: n } }] }),
  /** Enemy unit with AP ≤ n */
  enemyUnitMaxAp:            (n) => ({ all_of: [{ side: "enemy" },   { type: "unit" }, { ap:    { op: "<=", value: n } }] }),
  /** Enemy unit that is resting with level ≤ n */
  enemyUnitRestedMaxLv:      (n) => ({ all_of: [{ side: "enemy" },   { type: "unit" }, { is_resting: true }, { level: { op: "<=", value: n } }] }),
  /** Enemy unit that is active (not resting) with AP ≤ n */
  enemyUnitActiveMaxAp:      (n) => ({ all_of: [{ side: "enemy" },   { type: "unit" }, { is_resting: false }, { ap: { op: "<=", value: n } }] }),
  /** Friendly unit with level ≤ n */
  friendlyUnitMaxLv:         (n) => ({ all_of: [{ side: "friendly" }, { type: "unit" }, { level: { op: "<=", value: n } }] }),
  /** Friendly unit with a given keyword */
  friendlyUnitWithKeyword:   (kw) => ({ all_of: [{ side: "friendly" }, { type: "unit" }, { has_keyword: kw }] }),
  /** Friendly unit bearing a specific trait */
  friendlyUnitWithTrait:     (tr) => ({ all_of: [{ side: "friendly" }, { type: "unit" }, { traits_include: [tr] }] }),
  /** Friendly unit bearing a specific trait, excluding self */
  friendlyUnitWithTraitNotSelf: (tr) => ({ all_of: [{ side: "friendly" }, { type: "unit" }, { traits_include: [tr] }, { exclude_self: true }] }),
  /** Friendly resting unit bearing a specific trait */
  friendlyUnitRestedWithTrait:  (tr) => ({ all_of: [{ side: "friendly" }, { type: "unit" }, { is_resting: true }, { traits_include: [tr] }] }),
};

// ─── ST02–ST09 abilities ──────────────────────────────────────────────────────

const ABILITIES = {

  // ── ST02-001 Wing Gundam Zero ────────────────────────────────────────────────
  // Breach 5 in keywords. Extra: may target active enemy Lv.4-or-lower.
  "ST02-001": [
    {
      id: "a1",
      display_text: "This Unit may choose an active enemy Unit that is Lv.4 or lower as its attack target.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "This Unit may target active enemy Units with Lv.4 or lower as an attack target." }],
    },
  ],

  // ── ST02-002 Heavyarms ───────────────────────────────────────────────────────
  "ST02-002": [
    {
      id: "a1",
      display_text: "【Deploy】Place 1 EX Resource.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "Place 1 EX Resource token into your resource area." }],
    },
  ],

  // ── ST02-003 Sandrock ────────────────────────────────────────────────────────
  "ST02-003": [
    {
      id: "a1",
      display_text: "【During Pair】During your turn, when this Unit destroys an enemy Unit with battle damage, deal 1 damage to all enemy Units that are Lv.3 or lower.",
      trigger: { type: "during_pair", qualifiers: { your_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "When this Unit destroys an enemy Unit with battle damage during your turn: deal 1 damage to all enemy Units that are Lv.3 or lower." }],
    },
  ],

  "ST02-004": [],
  "ST02-005": [],

  // ── ST02-006 Virgo II ────────────────────────────────────────────────────────
  "ST02-006": [
    {
      id: "a1",
      display_text: "【Activate･Main】【Once per Turn】④：Set this Unit as active.",
      trigger: { type: "activated_main", qualifiers: { once_per_turn: true }, cost: { pay_resources: 4 } },
      steps: [{ action: "ready", target: "$self" }],
    },
  ],

  "ST02-007": [],
  "ST02-008": [], // Blocker in keywords
  "ST02-009": [], // Blocker in keywords

  // ── ST02-010 Lucrezia Noin ───────────────────────────────────────────────────
  "ST02-010": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【During Link】This Unit gets AP+1 and HP+1.",
      trigger: { type: "during_link" },
      steps: [
        { action: "modify_stat", target: "$self", stat: "ap", amount: 1, duration: "while_paired" },
        { action: "modify_stat", target: "$self", stat: "hp", amount: 1, duration: "while_paired" },
      ],
    },
  ],

  // ── ST02-011 Dorothy Catalonia ───────────────────────────────────────────────
  "ST02-011": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【During Link】During your turn, when this Unit destroys an enemy Unit with battle damage, draw 1.",
      trigger: { type: "during_link", qualifiers: { your_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "When this Unit destroys an enemy Unit with battle damage during your turn: draw 1." }],
    },
  ],

  // ── ST02-012 Command ─────────────────────────────────────────────────────────
  "ST02-012": [
    {
      id: "a1",
      display_text: "【Main】Choose 1 of your Units. It gains <Breach 3> during this turn.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: f.friendlyUnit, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "gain_keyword", target: "$target", keyword: "breach", amount: 3, duration: "end_of_turn" },
      ],
    },
  ],

  // ── ST02-013 Command ─────────────────────────────────────────────────────────
  "ST02-013": [
    {
      id: "a1",
      display_text: "【Action】During this battle, your shield area cards can't receive damage from enemy Units that are Lv.4 or lower.",
      trigger: { type: "activated_action" },
      steps: [{ action: "manual_resolve", prompt_text: "During this battle, your shield area cards cannot receive damage from enemy Units that are Lv.4 or lower." }],
    },
  ],

  // ── ST02-014 Command ─────────────────────────────────────────────────────────
  "ST02-014": [
    {
      id: "a1",
      display_text: "【Burst】Activate this card's 【Main】 — Choose 1 enemy Unit with 5 or less HP. Rest it.",
      trigger: { type: "on_burst" },
      steps: [
        { action: "choose_target", filter: f.enemyUnitMaxHp(5), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "rest", target: "$target" },
      ],
    },
    {
      id: "a2",
      display_text: "【Main】/【Action】Choose 1 enemy Unit with 5 or less HP. Rest it.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: f.enemyUnitMaxHp(5), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "rest", target: "$target" },
      ],
    },
  ],

  // ── ST02-015 Sanc Kingdom (Base) ─────────────────────────────────────────────
  "ST02-015": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, look at the top 2 cards of your deck and return 1 to the top and 1 to the bottom.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: f.friendlyShield, selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
        { action: "manual_resolve", prompt_text: "Look at the top 2 cards of your deck. Return 1 to the top and the other to the bottom." },
      ],
    },
  ],

  // ── ST02-016 Corsica Base (Base) ─────────────────────────────────────────────
  "ST02-016": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, if it is your turn, deploy 1 [Tallgeese] token. If 'Corsica Base' is in your trash, deploy 2 [Leo] tokens instead.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: f.friendlyShield, selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
        { action: "manual_resolve", prompt_text: "If it is your turn: check if 'Corsica Base' is in your trash. If yes, deploy 2 [Leo] ((OZ)·AP1·HP1) Unit tokens. Otherwise, deploy 1 [Tallgeese] ((OZ)·AP4·HP2) Unit token." },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // ST03 — Sazabi / CCA
  // ═══════════════════════════════════════════════════════════════════════════

  // ── ST03-001 Nu Gundam ───────────────────────────────────────────────────────
  "ST03-001": [
    {
      id: "a1",
      display_text: "【During Pair】This Unit gains <High-Maneuver>. During your turn, when this Unit destroys an enemy shield area card with battle damage, choose 1 enemy Unit. Deal 2 damage to it.",
      trigger: { type: "during_pair" },
      steps: [
        { action: "gain_keyword", target: "$self", keyword: "high_maneuver", duration: "while_paired" },
        { action: "manual_resolve", prompt_text: "During your turn, when this Unit destroys an enemy shield area card with battle damage: choose 1 enemy Unit and deal 2 damage to it." },
      ],
    },
  ],

  "ST03-002": [], // Support 2 keyword only
  "ST03-003": [],
  "ST03-004": [], // Support 2 keyword only
  "ST03-005": [],

  // ── ST03-006 Geara Doga ──────────────────────────────────────────────────────
  "ST03-006": [
    {
      id: "a1",
      display_text: "【Destroyed】Look at the top 3 cards of your deck. You may reveal 1 (Zeon)/(Neo Zeon) Unit card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
      trigger: { type: "on_destroyed" },
      steps: [{ action: "manual_resolve", prompt_text: "Look at the top 3 cards of your deck. You may reveal 1 (Zeon) or (Neo Zeon) Unit card and add it to your hand. Return remaining cards randomly to the bottom." }],
    },
  ],

  "ST03-007": [],

  // ── ST03-008 Jagd Doga ───────────────────────────────────────────────────────
  "ST03-008": [
    {
      id: "a1",
      display_text: "【Attack】This Unit gets AP+2 during this turn.",
      trigger: { type: "on_attack" },
      steps: [{ action: "modify_stat", target: "$self", stat: "ap", amount: 2, duration: "end_of_turn" }],
    },
  ],

  // ── ST03-009 Zaku I ──────────────────────────────────────────────────────────
  "ST03-009": [
    {
      id: "a1",
      display_text: "【Deploy】Deploy 1 rested [Zaku Ⅱ]((Zeon)･AP1･HP1) Unit token.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "create_token", token_id: "zaku_ii_zeon_ap1_hp1", count: 1, rested: true }],
    },
  ],

  // ── ST03-010 Full Frontal ────────────────────────────────────────────────────
  "ST03-010": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【When Paired】You may deploy 1 (Neo Zeon)/(Zeon) Unit card that is Lv.4 or lower from your hand.",
      trigger: { type: "on_pair" },
      steps: [{ action: "manual_resolve", prompt_text: "You may deploy 1 (Neo Zeon) or (Zeon) Unit card with Lv.4 or lower from your hand." }],
    },
  ],

  // ── ST03-011 Angelo Sauper ───────────────────────────────────────────────────
  "ST03-011": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【Attack】During this turn, this Unit gets AP+1 and, if it is a Link Unit, it gains <High-Maneuver>.",
      trigger: { type: "on_attack" },
      steps: [
        { action: "modify_stat", target: "$self", stat: "ap", amount: 1, duration: "end_of_turn" },
        { action: "manual_resolve", prompt_text: "If this is a Link Unit: it also gains <High-Maneuver> during this turn." },
      ],
    },
  ],

  // ── ST03-012 Command ─────────────────────────────────────────────────────────
  "ST03-012": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 friendly Unit. It gets AP+2 during this turn.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: f.friendlyUnit, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 2, duration: "end_of_turn" },
      ],
    },
  ],

  // ── ST03-013 Command ─────────────────────────────────────────────────────────
  "ST03-013": [
    {
      id: "a1",
      display_text: "【Burst】Activate this card's 【Main】 — Choose 1 enemy Unit. Deal 2 damage to it.",
      trigger: { type: "on_burst" },
      steps: [
        { action: "choose_target", filter: f.enemyUnit, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 2, damage_type: "effect" },
      ],
    },
    {
      id: "a2",
      display_text: "【Main】/【Action】Choose 1 enemy Unit. Deal 2 damage to it.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: f.enemyUnit, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 2, damage_type: "effect" },
      ],
    },
  ],

  // ── ST03-014 Command ─────────────────────────────────────────────────────────
  "ST03-014": [
    {
      id: "a1",
      display_text: "【Action】Choose 1 friendly Unit. It can't receive battle damage from enemy Units with 2 or less AP during this battle.",
      trigger: { type: "activated_action" },
      steps: [
        { action: "choose_target", filter: f.friendlyUnit, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "The chosen Unit cannot receive battle damage from enemy Units with 2 or less AP during this battle." },
      ],
    },
  ],

  // ── ST03-015 Axis Asteroid Base ──────────────────────────────────────────────
  "ST03-015": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, choose 1 enemy Unit with 5 or less AP. Deal 1 damage to it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: f.friendlyShield, selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
        { action: "choose_target", filter: f.enemyUnitMaxAp(5), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
      ],
    },
  ],

  // ── ST03-016 Londenion Space Colony Base ─────────────────────────────────────
  "ST03-016": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, if it is your turn, deploy 1 rested [Char's Zaku Ⅱ]((Zeon)･AP3･HP1) Unit token.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: f.friendlyShield, selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
        { action: "manual_resolve", prompt_text: "If it is your turn: deploy 1 rested [Char's Zaku II] ((Zeon)·AP3·HP1) Unit token." },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // ST04 — Freedom / Earth Alliance
  // ═══════════════════════════════════════════════════════════════════════════

  // ── ST04-001 Freedom Gundam ──────────────────────────────────────────────────
  // Blocker in keywords. Extra: on_pair with Lv.4+ pilot condition.
  "ST04-001": [
    {
      id: "a1",
      display_text: "【When Paired･Lv.4 or Higher Pilot】Choose 1 enemy Unit with 4 or less HP. Return it to its owner's hand.",
      trigger: { type: "on_pair" },
      steps: [{ action: "manual_resolve", prompt_text: "Only if the paired pilot is Lv.4 or higher: choose 1 enemy Unit with 4 or less HP and return it to its owner's hand." }],
    },
  ],

  // ── ST04-002 Strike Freedom ──────────────────────────────────────────────────
  "ST04-002": [
    {
      id: "a1",
      display_text: "【Deploy】Draw 1. Then, discard 1.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "draw", side: "friendly", amount: 1 },
        { action: "manual_resolve", prompt_text: "Discard 1 card from your hand." },
      ],
    },
  ],

  "ST04-003": [],
  "ST04-004": [], // Blocker in keywords
  "ST04-005": [],

  // ── ST04-006 Calamity Gundam ─────────────────────────────────────────────────
  "ST04-006": [
    {
      id: "a1",
      display_text: "【Attack】If this Unit has 5 or more AP, choose 1 enemy Unit that is Lv.5 or higher. Deal 3 damage to it.",
      trigger: { type: "on_attack" },
      steps: [{ action: "manual_resolve", prompt_text: "If this Unit has 5 or more AP: choose 1 enemy Unit that is Lv.5 or higher and deal 3 damage to it." }],
    },
  ],

  "ST04-007": [], // Breach 3 in keywords
  "ST04-008": [],

  // ── ST04-009 Buster Gundam ───────────────────────────────────────────────────
  "ST04-009": [
    {
      id: "a1",
      display_text: "【During Pair】【Destroyed】If you have another Link Unit in play, draw 1.",
      trigger: { type: "on_destroyed" },
      notes: "Only triggers if a pilot is paired at time of destruction.",
      steps: [{ action: "manual_resolve", prompt_text: "If a pilot is paired and you have another Link Unit in play when this Unit is destroyed: draw 1." }],
    },
  ],

  // ── ST04-010 Mu La Flaga ─────────────────────────────────────────────────────
  "ST04-010": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【Attack】Choose 1 enemy Unit. It gets AP-2 during this battle.",
      trigger: { type: "on_attack" },
      steps: [
        { action: "choose_target", filter: f.enemyUnit, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: -2, duration: "end_of_turn" },
      ],
    },
  ],

  // ── ST04-011 Dearka Elsman ───────────────────────────────────────────────────
  "ST04-011": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【When Linked】During this turn, this Unit may choose an active enemy Unit that is Lv.5 or lower as its attack target.",
      trigger: { type: "on_link_established" },
      steps: [{ action: "manual_resolve", prompt_text: "During this turn, this Unit may target active enemy Units with Lv.5 or lower as an attack target." }],
    },
  ],

  // ── ST04-012 Command (Strike tokens) ────────────────────────────────────────
  "ST04-012": [
    {
      id: "a1",
      display_text: "【Burst】If you have no (Earth Alliance) Unit tokens in play, deploy 1 [Aile Strike Gundam]((Earth Alliance)･AP3･HP3･<Blocker>) Unit token.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "If you have no (Earth Alliance) Unit tokens in play: deploy 1 [Aile Strike Gundam] ((Earth Alliance)·AP3·HP3·<Blocker>) Unit token." }],
    },
    {
      id: "a2",
      display_text: "【Main】If you have no (Earth Alliance) Unit tokens in play, deploy 1 [Sword Strike Gundam] or 1 [Launcher Strike Gundam] Unit token.",
      trigger: { type: "activated_main" },
      steps: [{ action: "manual_resolve", prompt_text: "If you have no (Earth Alliance) Unit tokens in play: deploy 1 [Sword Strike Gundam] ((Earth Alliance)·AP4·HP2·<Blocker>) or 1 [Launcher Strike Gundam] ((Earth Alliance)·AP2·HP4·<Blocker>) Unit token." }],
    },
  ],

  // ── ST04-013 Command ─────────────────────────────────────────────────────────
  "ST04-013": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 enemy Unit with 3 or less HP. Return it to its owner's hand.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: f.enemyUnitMaxHp(3), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "move_to_hand", target: "$target" },
      ],
    },
  ],

  // ── ST04-014 Command (First Strike) ─────────────────────────────────────────
  "ST04-014": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 friendly Unit that is Lv.2 or lower. It gains <First Strike> during this turn.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: f.friendlyUnitMaxLv(2), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "gain_keyword", target: "$target", keyword: "first_strike", duration: "end_of_turn" },
      ],
    },
  ],

  // ── ST04-015 Archangel (Base) ────────────────────────────────────────────────
  "ST04-015": [
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
        { action: "choose_target", filter: f.friendlyShield, selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
      ],
    },
    {
      id: "a3",
      display_text: "【Activate･Main】【Once per Turn】②：Choose 1 friendly Unit with <Blocker>. Set it as active. It can't attack during this turn.",
      trigger: { type: "activated_main", qualifiers: { once_per_turn: true }, cost: { pay_resources: 2 } },
      steps: [
        { action: "choose_target", filter: f.friendlyUnitWithKeyword("blocker"), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "ready", target: "$target" },
        { action: "manual_resolve", prompt_text: "The chosen Unit with <Blocker> is now active but cannot attack this turn." },
      ],
    },
  ],

  // ── ST04-016 Mendel Colony (Base) ────────────────────────────────────────────
  "ST04-016": [
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
        { action: "choose_target", filter: f.friendlyShield, selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
      ],
    },
    {
      id: "a3",
      display_text: "【Activate･Main】Rest this Base：Choose 1 friendly Unit. It gets AP+1 during this turn.",
      trigger: { type: "activated_main", cost: { rest_self: true } },
      steps: [
        { action: "choose_target", filter: f.friendlyUnit, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 1, duration: "end_of_turn" },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // ST05 — Gundam Barbatos / IBO
  // ═══════════════════════════════════════════════════════════════════════════

  // ── ST05-001 Gundam Barbatos ─────────────────────────────────────────────────
  "ST05-001": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 of your other Units. Deal 1 damage to it. It gets AP+1 during this turn.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: f.friendlyUnitNotSelf, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 1, duration: "end_of_turn" },
      ],
    },
    {
      id: "a2",
      display_text: "While this is damaged, it gains <Suppression>.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While this Unit is damaged, it gains <Suppression>. (Damage to Shields by an attack is dealt to the first 2 cards simultaneously.)" }],
    },
  ],

  // ── ST05-002 Gundam Gusion Rebake ────────────────────────────────────────────
  "ST05-002": [
    {
      id: "a1",
      display_text: "While this Unit is damaged, it gets AP+2.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While this Unit is damaged (has less than max HP), it gets AP+2." }],
    },
  ],

  // ── ST05-003 Gundam Flauros ──────────────────────────────────────────────────
  "ST05-003": [
    {
      id: "a1",
      display_text: "【Activate･Main】Rest this Unit：Choose 1 of your Units. Deal 1 damage to it. It gets AP+1 during this turn.",
      trigger: { type: "activated_main", cost: { rest_self: true } },
      steps: [
        { action: "choose_target", filter: f.friendlyUnit, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 1, duration: "end_of_turn" },
      ],
    },
  ],

  "ST05-004": [],

  // ── ST05-005 Graze ───────────────────────────────────────────────────────────
  "ST05-005": [
    {
      id: "a1",
      display_text: "【Destroyed】Choose 1 enemy Unit with 4 or less AP. Rest it.",
      trigger: { type: "on_destroyed" },
      steps: [
        { action: "choose_target", filter: f.enemyUnitMaxAp(4), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "rest", target: "$target" },
      ],
    },
  ],

  "ST05-006": [],

  // ── ST05-007 Graze Ein ───────────────────────────────────────────────────────
  // Blocker in keywords. Extra: on_pair AP-2 to enemy Lv.3-or-lower.
  "ST05-007": [
    {
      id: "a1",
      display_text: "【When Paired】Choose 1 enemy Unit that is Lv.3 or lower. It gets AP-2 during this turn.",
      trigger: { type: "on_pair" },
      steps: [
        { action: "choose_target", filter: f.enemyUnitMaxLv(3), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "modify_stat", target: "$target", stat: "ap", amount: -2, duration: "end_of_turn" },
      ],
    },
  ],

  "ST05-008": [], // Blocker in keywords
  "ST05-009": [],

  // ── ST05-010 Mikazuki Augus ──────────────────────────────────────────────────
  "ST05-010": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【When Paired】Choose 1 of your Units and 1 enemy Unit. Deal 1 damage to them.",
      trigger: { type: "on_pair" },
      steps: [
        { action: "choose_target", filter: f.friendlyUnit, selector: "controller_chooses", min: 1, max: 1, store_as: "$friendly_target" },
        { action: "choose_target", filter: f.enemyUnit, selector: "controller_chooses", min: 1, max: 1, store_as: "$enemy_target" },
        { action: "deal_damage", target: "$friendly_target", amount: 1, damage_type: "effect" },
        { action: "deal_damage", target: "$enemy_target", amount: 1, damage_type: "effect" },
      ],
    },
  ],

  // ── ST05-011 Eugene ──────────────────────────────────────────────────────────
  "ST05-011": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【During Link】During your turn, when this Unit destroys an enemy Unit with battle damage, choose 1 (Tekkadan) Unit card that is Lv.2 or lower from your trash. Add it to your hand.",
      trigger: { type: "during_link", qualifiers: { your_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "When this Unit destroys an enemy Unit with battle damage during your turn: choose 1 (Tekkadan) Unit card with Lv.2 or lower from your trash and add it to your hand." }],
    },
  ],

  // ── ST05-012 Orga Itsuka ─────────────────────────────────────────────────────
  "ST05-012": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【When Paired】If you have 2 or more other (Gjallarhorn)/(Tekkadan) Units in play, choose 1 enemy Unit with 3 or less HP. Rest it.",
      trigger: { type: "on_pair" },
      steps: [{ action: "manual_resolve", prompt_text: "If you have 2 or more other (Gjallarhorn) or (Tekkadan) Units in play: choose 1 enemy Unit with 3 or less HP and rest it." }],
    },
  ],

  // ── ST05-013 Command ─────────────────────────────────────────────────────────
  "ST05-013": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 of your Units. Deal 1 damage to it. It gets AP+3 during this turn.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: f.friendlyUnit, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 3, duration: "end_of_turn" },
      ],
    },
  ],

  // ── ST05-014 Command ─────────────────────────────────────────────────────────
  "ST05-014": [
    {
      id: "a1",
      display_text: "【Burst】Choose 1 enemy Unit. Deal 1 damage to it.",
      trigger: { type: "on_burst" },
      steps: [
        { action: "choose_target", filter: f.enemyUnit, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
      ],
    },
    {
      id: "a2",
      display_text: "【Main】Choose 1 enemy Unit that is Lv.3 or lower. Destroy it.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: f.enemyUnitMaxLv(3), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "destroy", target: "$target" },
      ],
    },
  ],

  // ── ST05-015 CGS Mobile Worker (Base) ────────────────────────────────────────
  "ST05-015": [
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
        { action: "choose_target", filter: f.friendlyShield, selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
      ],
    },
    {
      id: "a3",
      display_text: "【Activate･Main】Rest this Base：Choose 1 of your damaged Units. It gets AP+2 during this turn.",
      trigger: { type: "activated_main", cost: { rest_self: true } },
      steps: [
        { action: "choose_target", filter: f.friendlyUnitDamaged, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 2, duration: "end_of_turn" },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // ST06 — Shining Gundam / G Gundam
  // ═══════════════════════════════════════════════════════════════════════════

  // ── ST06-001 Shining Gundam ──────────────────────────────────────────────────
  "ST06-001": [
    {
      id: "a1",
      display_text: "【When Linked】If another friendly (Clan) Unit is in play, this gains <First Strike> during this turn.",
      trigger: { type: "on_link_established" },
      notes: "First Strike here is conditional on link + having another (Clan) Unit. Keyword in keywords[] is a scraper artifact.",
      steps: [{ action: "manual_resolve", prompt_text: "If another friendly (Clan) Unit is in play: this Unit gains <First Strike> during this turn. (This Unit can't be blocked.)" }],
    },
  ],

  // ── ST06-002 Maxter Gundam ───────────────────────────────────────────────────
  "ST06-002": [
    {
      id: "a1",
      display_text: "【Deploy】If another friendly (Clan) Unit is in play, choose 1 enemy Unit. Deal 1 damage to it.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "If another friendly (Clan) Unit is in play: choose 1 enemy Unit and deal 1 damage to it." }],
    },
  ],

  "ST06-003": [], // Support 1 keyword only
  "ST06-004": [],

  // ── ST06-005 Dragon Gundam ───────────────────────────────────────────────────
  // Breach 1 in keywords. Extra: Attack AP+2 to 1-2 friendly Clan Units.
  "ST06-005": [
    {
      id: "a1",
      display_text: "【Attack】Choose 1 to 2 friendly (Clan) Units. They get AP+2 during this turn.",
      trigger: { type: "on_attack" },
      steps: [
        { action: "choose_target", filter: f.friendlyUnitWithTrait("Clan"), selector: "controller_chooses", min: 1, max: 2, store_as: "$targets" },
        { action: "modify_stat", target: "$targets", stat: "ap", amount: 2, duration: "end_of_turn" },
      ],
    },
  ],

  "ST06-006": [],

  // ── ST06-007 Bolt Gundam ─────────────────────────────────────────────────────
  "ST06-007": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 of your other (Clan) Units. During this turn, it may choose an active enemy Unit with 3 or less AP as its attack target.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: f.friendlyUnitWithTraitNotSelf("Clan"), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "The chosen (Clan) Unit may target active enemy Units with 3 or less AP as an attack target during this turn." },
      ],
    },
  ],

  "ST06-008": [],

  // ── ST06-009 Domon Kasshu ────────────────────────────────────────────────────
  "ST06-009": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【When Linked】Look at the top card of your deck. If it is a (Clan) card, you may reveal it and add it to your hand. Return any remaining card to the bottom of your deck.",
      trigger: { type: "on_link_established" },
      steps: [{ action: "manual_resolve", prompt_text: "Look at the top card of your deck. If it is a (Clan) card, you may reveal it and add it to your hand. Return any remaining card to the bottom." }],
    },
  ],

  // ── ST06-010 Sai Saici ───────────────────────────────────────────────────────
  "ST06-010": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【During Link】【Attack】If you have a (Clan) Unit in play, look at the top card of your deck. Return it to the top or bottom of your deck.",
      trigger: { type: "during_link" },
      steps: [{ action: "manual_resolve", prompt_text: "When attacking: if you have a (Clan) Unit in play, look at the top card of your deck and return it to the top or bottom." }],
    },
  ],

  // ── ST06-011 Command ─────────────────────────────────────────────────────────
  "ST06-011": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 to 2 friendly (Clan) Units. They get AP+2 during this turn.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: f.friendlyUnitWithTrait("Clan"), selector: "controller_chooses", min: 1, max: 2, store_as: "$targets" },
        { action: "modify_stat", target: "$targets", stat: "ap", amount: 2, duration: "end_of_turn" },
      ],
    },
  ],

  // ── ST06-012 Command ─────────────────────────────────────────────────────────
  "ST06-012": [
    {
      id: "a1",
      display_text: "【Main】Look at the top 3 cards of your deck. You may reveal 1 (Clan) Unit card/Pilot card among them and add it to your hand. Return the remaining cards randomly to the bottom.",
      trigger: { type: "activated_main" },
      steps: [{ action: "manual_resolve", prompt_text: "Look at the top 3 cards of your deck. You may reveal 1 (Clan) Unit or Pilot card and add it to your hand. Return remaining cards randomly to the bottom." }],
    },
  ],

  // ── ST06-013 Command ─────────────────────────────────────────────────────────
  "ST06-013": [
    {
      id: "a1",
      display_text: "【Action】Choose 1 to 2 friendly (Clan) Units. They can't receive battle damage from enemy Units that are Lv.2 or lower during this turn.",
      trigger: { type: "activated_action" },
      steps: [
        { action: "choose_target", filter: f.friendlyUnitWithTrait("Clan"), selector: "controller_chooses", min: 1, max: 2, store_as: "$targets" },
        { action: "manual_resolve", prompt_text: "The chosen (Clan) Units cannot receive battle damage from enemy Units with Lv.2 or lower during this turn." },
      ],
    },
  ],

  // ── ST06-014 Neo Hong Kong Base ──────────────────────────────────────────────
  "ST06-014": [
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
        { action: "choose_target", filter: f.friendlyShield, selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
      ],
    },
    {
      id: "a3",
      display_text: "【Activate･Main】Rest this Base：If a friendly (Clan) Link Unit is in play, choose 1 friendly Unit. It gets AP+2 during this turn.",
      trigger: { type: "activated_main", cost: { rest_self: true } },
      steps: [{ action: "manual_resolve", prompt_text: "If a friendly (Clan) Link Unit is in play: choose 1 friendly Unit. It gets AP+2 during this turn." }],
    },
  ],

  // ── ST06-015 Gundam Fight Stadium (Base) ─────────────────────────────────────
  "ST06-015": [
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
        { action: "choose_target", filter: f.friendlyShield, selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
      ],
    },
    {
      id: "a3",
      display_text: "【Once per Turn】When a friendly (Clan) Unit links, it gains <Breach 3> during this turn.",
      trigger: { type: "on_link_established", qualifiers: { once_per_turn: true } },
      steps: [{ action: "manual_resolve", prompt_text: "When a friendly (Clan) Unit establishes a link (once per turn): it gains <Breach 3> during this turn." }],
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // ST07 — 00 Gundam / CB
  // ═══════════════════════════════════════════════════════════════════════════

  // ── ST07-001 00 Gundam ───────────────────────────────────────────────────────
  "ST07-001": [
    {
      id: "a1",
      display_text: "At the end of your turn, if there are 7 or more (CB) cards in your trash, choose 1 of your Resources. Set it as active.",
      trigger: { type: "on_end_phase" },
      steps: [{ action: "manual_resolve", prompt_text: "At the end of your turn: if there are 7 or more (CB) cards in your trash, choose 1 of your Resources and set it as active." }],
    },
    {
      id: "a2",
      display_text: "【When Paired】Place the top 2 cards of your deck into your trash. If you place a (CB) card with this effect, draw 1.",
      trigger: { type: "on_pair" },
      steps: [{ action: "manual_resolve", prompt_text: "Place the top 2 cards of your deck into your trash. For each (CB) card placed this way, draw 1." }],
    },
  ],

  "ST07-002": [],
  "ST07-003": [],

  // ── ST07-004 GN-X ────────────────────────────────────────────────────────────
  // Blocker in keywords but it's conditional.
  "ST07-004": [
    {
      id: "a1",
      display_text: "While you have a (CB) Pilot in play, this Unit gains <Blocker>.",
      trigger: { type: "static" },
      notes: "Blocker is conditional; keyword in keywords[] is a scraper artifact.",
      steps: [{ action: "manual_resolve", prompt_text: "While you have a (CB) Pilot in play: this Unit gains <Blocker>." }],
    },
  ],

  // ── ST07-005 Cherudim Gundam ─────────────────────────────────────────────────
  "ST07-005": [
    {
      id: "a1",
      display_text: "During your turn, when this Unit destroys an enemy Unit with battle damage, this Unit recovers 2 HP.",
      trigger: { type: "on_damage_dealt", qualifiers: { your_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "When this Unit destroys an enemy Unit with battle damage during your turn: this Unit recovers 2 HP." }],
    },
    {
      id: "a2",
      display_text: "【During Link】This Unit gets AP+2.",
      trigger: { type: "during_link" },
      steps: [{ action: "modify_stat", target: "$self", stat: "ap", amount: 2, duration: "while_paired" }],
    },
  ],

  "ST07-006": [],

  // ── ST07-007 Ahead ───────────────────────────────────────────────────────────
  "ST07-007": [
    {
      id: "a1",
      display_text: "During your turn, while you have a (CB) Pilot in play, this Unit gets AP+2.",
      trigger: { type: "static", qualifiers: { your_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "During your turn, while you have a (CB) Pilot in play: this Unit gets AP+2." }],
    },
  ],

  "ST07-008": [],

  // ── ST07-009 Setsuna F. Seiei ────────────────────────────────────────────────
  "ST07-009": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【Attack】This Unit gets AP+1 during this turn. If there are 7 or more (CB) cards in your trash, all your (CB) Units get AP+1 instead.",
      trigger: { type: "on_attack" },
      steps: [{ action: "manual_resolve", prompt_text: "This Unit gets AP+1 during this turn. If there are 7 or more (CB) cards in your trash: instead, all your (CB) Units get AP+1 during this turn." }],
    },
  ],

  // ── ST07-010 Allelujah Haptism ───────────────────────────────────────────────
  "ST07-010": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【Destroyed】If it is your opponent's turn and this is a (CB) Unit, draw 1.",
      trigger: { type: "on_destroyed", qualifiers: { opponent_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "If this is a (CB) Unit: draw 1." }],
    },
  ],

  // ── ST07-011 Lockon Stratos ──────────────────────────────────────────────────
  "ST07-011": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【When Paired】If this is a (CB) Unit, it may choose an active enemy Unit whose Lv. is equal to or lower than this Unit as its attack target during this turn.",
      trigger: { type: "on_pair" },
      steps: [{ action: "manual_resolve", prompt_text: "If this is a (CB) Unit: during this turn, it may target active enemy Units whose Lv. is equal to or lower than this Unit's Lv." }],
    },
  ],

  // ── ST07-012 Tieria Erde ─────────────────────────────────────────────────────
  "ST07-012": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "During your turn, while you have a (CB) Link Unit in play, this Unit can't receive battle damage from enemy Units with 3 or less AP.",
      trigger: { type: "static", qualifiers: { your_turn_only: true } },
      steps: [{ action: "manual_resolve", prompt_text: "During your turn, while you have a (CB) Link Unit in play: this Unit cannot receive battle damage from enemy Units with 3 or less AP." }],
    },
  ],

  // ── ST07-013 Command ─────────────────────────────────────────────────────────
  "ST07-013": [
    {
      id: "a1",
      display_text: "【Burst】Draw 1.",
      trigger: { type: "on_burst" },
      steps: [{ action: "draw", side: "friendly", amount: 1 }],
    },
    {
      id: "a2",
      display_text: "【Action】Choose 1 rested friendly (CB) Unit. Change the attack target of the battling enemy Unit to it.",
      trigger: { type: "activated_action" },
      steps: [
        { action: "choose_target", filter: f.friendlyUnitRestedWithTrait("CB"), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "Change the battling enemy Unit's attack target to the chosen rested (CB) Unit." },
      ],
    },
  ],

  // ── ST07-014 Command ─────────────────────────────────────────────────────────
  "ST07-014": [
    {
      id: "a1",
      display_text: "【Main】Look at the top 3 cards of your deck. You may reveal 1 (CB) Unit card/Pilot card among them and add it to your hand. Return the remaining cards randomly to the bottom.",
      trigger: { type: "activated_main" },
      steps: [{ action: "manual_resolve", prompt_text: "Look at the top 3 cards of your deck. You may reveal 1 (CB) Unit or Pilot card and add it to your hand. Return remaining cards randomly to the bottom." }],
    },
  ],

  // ── ST07-015 Celestial Being (Base) ─────────────────────────────────────────
  "ST07-015": [
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
        { action: "choose_target", filter: f.friendlyShield, selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
      ],
    },
    {
      id: "a3",
      display_text: "While a rested friendly (CB) Unit is in play, this Base can't receive damage from enemy Units that are Lv.3 or lower, other than Unit tokens.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While a rested friendly (CB) Unit is in play: this Base cannot receive damage from enemy Units that are Lv.3 or lower, other than Unit tokens." }],
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // ST08 — Xi Gundam / Mafty
  // ═══════════════════════════════════════════════════════════════════════════

  // ── ST08-001 Xi Gundam ───────────────────────────────────────────────────────
  "ST08-001": [
    {
      id: "a1",
      display_text: "While you have no Units that are Lv.6 or higher in play, this card in your hand gets Lv.-1 and cost-1 for each enemy Unit in play.",
      trigger: { type: "static" },
      steps: [{ action: "manual_resolve", prompt_text: "While you have no friendly Units Lv.6+ in play: this card in your hand gets Lv.-1 and cost-1 for each enemy Unit in play." }],
    },
    {
      id: "a2",
      display_text: "【When Paired】Choose 1 enemy Unit with the highest Lv. Deal 3 damage to it.",
      trigger: { type: "on_pair" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 enemy Unit with the highest Level and deal 3 damage to it." }],
    },
  ],

  // ── ST08-002 Penelope ────────────────────────────────────────────────────────
  "ST08-002": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 enemy Unit. Deal 1 damage to it.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: f.enemyUnit, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "deal_damage", target: "$target", amount: 1, damage_type: "effect" },
      ],
    },
  ],

  "ST08-003": [],

  // ── ST08-004 Stark Jegan ─────────────────────────────────────────────────────
  "ST08-004": [
    {
      id: "a1",
      display_text: "【Attack】If this Unit is attacking an enemy Unit, choose 1 enemy Unit. Deal 1 damage to it.",
      trigger: { type: "on_attack" },
      steps: [{ action: "manual_resolve", prompt_text: "If this Unit is attacking an enemy Unit (not the player): choose 1 enemy Unit and deal 1 damage to it." }],
    },
  ],

  "ST08-005": [],

  // ── ST08-006 Perune ──────────────────────────────────────────────────────────
  "ST08-006": [
    {
      id: "a1",
      display_text: "【During Pair】【Attack】【Once per Turn】If this Unit is attacking the enemy player, reveal 1 (Earth Federation) Unit card from your hand. Return it to the bottom of your deck. If you do, draw 2.",
      trigger: { type: "during_pair", qualifiers: { once_per_turn: true } },
      steps: [{ action: "manual_resolve", prompt_text: "When attacking the enemy player (once per turn while paired): you may reveal 1 (Earth Federation) Unit card from your hand and return it to the bottom of your deck. If you do, draw 2." }],
    },
  ],

  "ST08-007": [],

  // ── ST08-008 Jegan ───────────────────────────────────────────────────────────
  // Blocker in keywords but conditional.
  "ST08-008": [
    {
      id: "a1",
      display_text: "While 3 or more enemy Units are in play, this Unit gains <Blocker>.",
      trigger: { type: "static" },
      notes: "Blocker is conditional; keyword in keywords[] is a scraper artifact.",
      steps: [{ action: "manual_resolve", prompt_text: "While 3 or more enemy Units are in play: this Unit gains <Blocker>." }],
    },
  ],

  // ── ST08-009 Loto ────────────────────────────────────────────────────────────
  "ST08-009": [
    {
      id: "a1",
      display_text: "【Deploy】Choose 1 rested enemy Unit that is Lv.2 or lower. It won't be set as active during the start phase of your opponent's next turn.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: f.enemyUnitRestedMaxLv(2), selector: "controller_chooses", min: 0, max: 1, store_as: "$target", optional: true },
        { action: "manual_resolve", prompt_text: "The chosen rested enemy Unit won't be set as active during the start phase of your opponent's next turn." },
      ],
    },
  ],

  // ── ST08-010 Hathaway Noa ────────────────────────────────────────────────────
  "ST08-010": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【When Paired】If this is a (Mafty) Unit, choose 1 of your (Mafty) Units. During this turn, it may choose a damaged active enemy Unit as its attack target.",
      trigger: { type: "on_pair" },
      steps: [{ action: "manual_resolve", prompt_text: "If this is a (Mafty) Unit: choose 1 of your (Mafty) Units. During this turn, it may target damaged active enemy Units as an attack target." }],
    },
  ],

  // ── ST08-011 Gawman Nobile ───────────────────────────────────────────────────
  "ST08-011": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "When you draw with an effect, if this is a blue Unit, it gains <High-Maneuver> during this turn.",
      trigger: { type: "on_card_drawn" },
      steps: [{ action: "manual_resolve", prompt_text: "If this Unit is blue: it gains <High-Maneuver> during this turn. (This Unit can't be blocked.)" }],
    },
  ],

  // ── ST08-012 Command ─────────────────────────────────────────────────────────
  "ST08-012": [
    {
      id: "a1",
      display_text: "【Main】Choose 1 friendly Link Unit. It gains <Breach 1> during this turn.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: f.friendlyLinked, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "gain_keyword", target: "$target", keyword: "breach", amount: 1, duration: "end_of_turn" },
      ],
    },
  ],

  // ── ST08-013 Command ─────────────────────────────────────────────────────────
  "ST08-013": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 enemy Unit. Deal 1 damage to it. If a friendly (Mafty) Link Unit is in play, deal 2 damage instead.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: f.enemyUnit, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "manual_resolve", prompt_text: "Deal 1 damage to the chosen enemy Unit. If a friendly (Mafty) Link Unit is in play, deal 2 damage instead." },
      ],
    },
  ],

  // ── ST08-014 Luna II (Base) ──────────────────────────────────────────────────
  "ST08-014": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, choose 1 of your Units. It gets AP+2 during this turn.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: f.friendlyShield, selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
        { action: "choose_target", filter: f.friendlyUnit, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "modify_stat", target: "$target", stat: "ap", amount: 2, duration: "end_of_turn" },
      ],
    },
  ],

  // ── ST08-015 Von Braun City (Base) ───────────────────────────────────────────
  "ST08-015": [
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
        { action: "choose_target", filter: f.friendlyShield, selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
      ],
    },
    {
      id: "a3",
      display_text: "【Activate･Main】【Once per Turn】②：Choose 1 of your Units. It recovers 2 HP.",
      trigger: { type: "activated_main", qualifiers: { once_per_turn: true }, cost: { pay_resources: 2 } },
      steps: [
        { action: "choose_target", filter: f.friendlyUnit, selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "heal", target: "$target", amount: 2 },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // ST09 — Force Impulse Gundam / SEED Destiny
  // ═══════════════════════════════════════════════════════════════════════════

  // ── ST09-001 Impulse Gundam ──────────────────────────────────────────────────
  "ST09-001": [
    {
      id: "a1",
      display_text: "【Activate･Main】②, return this Unit to the bottom of its owner's deck：Choose 1 Unit card with \"Impulse Gundam\" in its card name that is Lv.4 or higher from your trash. Deploy it.",
      trigger: { type: "activated_main", cost: { pay_resources: 2, return_self_to_deck: true } },
      steps: [{ action: "manual_resolve", prompt_text: "Return this Unit to the bottom of your deck, then choose 1 Unit card with 'Impulse Gundam' in its name that is Lv.4+ from your trash and deploy it." }],
    },
  ],

  // ── ST09-002 Force Impulse Gundam ────────────────────────────────────────────
  "ST09-002": [
    {
      id: "a1",
      display_text: "【Destroyed】Choose 1 (Minerva Squad) Unit card without \"Force Impulse Gundam\" in its card name from your trash. Add it to your hand.",
      trigger: { type: "on_destroyed" },
      steps: [{ action: "manual_resolve", prompt_text: "Choose 1 (Minerva Squad) Unit card without 'Force Impulse Gundam' in its name from your trash and add it to your hand." }],
    },
  ],

  // ── ST09-003 Impulse Gundam Lux ──────────────────────────────────────────────
  // Breach 3 in keywords. Extra: on_link_established conditional AOE.
  "ST09-003": [
    {
      id: "a1",
      display_text: "【When Linked】If there are 5 or more purple cards in your trash, deal 2 damage to all Units with 5 or less AP.",
      trigger: { type: "on_link_established" },
      steps: [{ action: "manual_resolve", prompt_text: "If there are 5 or more purple cards in your trash: deal 2 damage to all Units (friendly and enemy) with 5 or less AP." }],
    },
  ],

  // ── ST09-004 Gaia Gundam ─────────────────────────────────────────────────────
  // Blocker in keywords (always-on). Suppression in keywords but conditional.
  "ST09-004": [
    {
      id: "a1",
      display_text: "While a friendly Base is in play, this Unit gains <Suppression>.",
      trigger: { type: "static" },
      notes: "Suppression is conditional; keyword in keywords[] is a scraper artifact.",
      steps: [{ action: "manual_resolve", prompt_text: "While you have a friendly Base in play: this Unit gains <Suppression>. (Damage to Shields by an attack is dealt to the first 2 cards simultaneously.)" }],
    },
  ],

  "ST09-005": [],

  // ── ST09-006 Windham ─────────────────────────────────────────────────────────
  "ST09-006": [
    {
      id: "a1",
      display_text: "【Deploy】If you deploy this Unit from your trash, choose 1 enemy Unit that is Lv.3 or lower. Destroy it.",
      trigger: { type: "on_deploy" },
      steps: [{ action: "manual_resolve", prompt_text: "If this Unit was deployed from your trash: choose 1 enemy Unit that is Lv.3 or lower and destroy it." }],
    },
  ],

  "ST09-007": [], // Blocker in keywords

  // ── ST09-008 Lunamaria Hawke ─────────────────────────────────────────────────
  "ST09-008": [
    {
      id: "a1",
      display_text: "【Burst】Add this card to your hand.",
      trigger: { type: "on_burst" },
      steps: [{ action: "move_to_hand", target: "$self" }],
    },
    {
      id: "a2",
      display_text: "【Attack】If this is a (Minerva Squad) Unit, choose 1 of your Resources. Set it as active.",
      trigger: { type: "on_attack" },
      steps: [{ action: "manual_resolve", prompt_text: "If this is a (Minerva Squad) Unit: choose 1 of your Resources and set it as active." }],
    },
  ],

  // ── ST09-009 Command ─────────────────────────────────────────────────────────
  "ST09-009": [
    {
      id: "a1",
      display_text: "【Main】/【Action】Choose 1 active enemy Unit with 4 or less AP. Destroy it.",
      trigger: { type: "activated_main" },
      steps: [
        { action: "choose_target", filter: f.enemyUnitActiveMaxAp(4), selector: "controller_chooses", min: 1, max: 1, store_as: "$target" },
        { action: "destroy", target: "$target" },
      ],
    },
  ],

  // ── ST09-010 Minerva (Base) ──────────────────────────────────────────────────
  "ST09-010": [
    {
      id: "a1",
      display_text: "【Burst】Deploy this card.",
      trigger: { type: "on_burst" },
      steps: [{ action: "manual_resolve", prompt_text: "Deploy this Base card from your shield area onto the field." }],
    },
    {
      id: "a2",
      display_text: "【Deploy】Add 1 of your Shields to your hand. Then, if it is your turn, look at the top 2 cards of your deck and return 1 to the top. Place the remaining card into your trash.",
      trigger: { type: "on_deploy" },
      steps: [
        { action: "choose_target", filter: f.friendlyShield, selector: "controller_chooses", min: 1, max: 1, store_as: "$shield" },
        { action: "move_to_hand", target: "$shield" },
        { action: "manual_resolve", prompt_text: "If it is your turn: look at the top 2 cards of your deck. Return 1 to the top and place the other into your trash." },
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
  log("Seeding ST02–ST09 abilities…\n");
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
