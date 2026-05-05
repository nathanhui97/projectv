/**
 * Batch AI ability fill for a set of cards.
 * Reads rules_text from Supabase, calls Claude to parse into structured abilities,
 * and upserts the result back into the card's data.
 *
 * Usage:
 *   node scripts/batch-fill-abilities.mjs --set=ST01
 *   node scripts/batch-fill-abilities.mjs --id=GD01-042
 *   node scripts/batch-fill-abilities.mjs --set=ST01 --dry-run   # print without saving
 *   node scripts/batch-fill-abilities.mjs --set=ST01 --force     # re-fill even if abilities exist
 */

import { readFileSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import process from "process";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __dir = dirname(fileURLToPath(import.meta.url));

// Load SDK from admin app's node_modules
const require = createRequire(import.meta.url);
const Anthropic = require(join(__dir, "../apps/admin/node_modules/@anthropic-ai/sdk")).default;

// Load env
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

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const REST = `${SUPABASE_URL}/rest/v1`;

const args = process.argv.slice(2);
const SET_FILTER = (args.find((a) => a.startsWith("--set=")) ?? "").slice(6) || null;
const ID_FILTER = (args.find((a) => a.startsWith("--id=")) ?? "").slice(5) || null;
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const DELAY_MS = 1500; // between API calls

function log(...a) { process.stderr.write(a.join(" ") + "\n"); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ─── Anthropic client ─────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ─── Ability JSON schema (matches the route's schema) ────────────────────────

const ABILITY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["abilities"],
  properties: {
    abilities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "display_text", "trigger", "steps"],
        properties: {
          id: { type: "string" },
          display_text: { type: "string" },
          notes: { type: "string" },
          trigger: {
            type: "object",
            additionalProperties: false,
            required: ["type"],
            properties: {
              type: {
                type: "string",
                enum: [
                  "on_deploy", "on_destroyed", "on_attack", "on_attacked",
                  "on_damage_dealt", "on_damage_taken", "on_burst",
                  "on_pair", "on_unpair", "on_link_established",
                  "on_played_command", "on_resource_placed",
                  "on_shield_destroyed", "on_card_drawn", "on_card_discarded",
                  "on_start_phase", "on_draw_phase", "on_resource_phase",
                  "on_main_phase_start", "on_main_phase_end", "on_end_phase",
                  "on_turn_start", "on_turn_end",
                  "on_opponent_turn_start", "on_opponent_turn_end",
                  "activated_main", "activated_action",
                  "during_pair", "during_link", "static",
                ],
              },
              qualifiers: {
                type: "object",
                additionalProperties: false,
                properties: {
                  once_per_turn: { type: "boolean" },
                  your_turn_only: { type: "boolean" },
                  opponent_turn_only: { type: "boolean" },
                  pilot_traits_include: { type: "array", items: { type: "string" } },
                  pilot_name_is: { type: "string" },
                  target_traits_include: { type: "array", items: { type: "string" } },
                },
              },
              cost: {
                type: "object",
                additionalProperties: false,
                properties: {
                  rest_self: { type: "boolean" },
                  pay_resources: { type: "integer" },
                },
              },
            },
          },
          steps: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: true,
              required: ["action"],
              properties: {
                action: {
                  type: "string",
                  enum: [
                    "draw", "deal_damage", "destroy", "heal", "rest", "ready",
                    "move_to_hand", "move_to_trash", "move_to_deck",
                    "modify_stat", "gain_keyword", "choose_target", "all_matching",
                    "search_deck", "shuffle", "create_token", "prompt_choice",
                    "manual_resolve", "noop",
                  ],
                },
                target: { type: "string" },
                side: { type: "string", enum: ["friendly", "enemy", "any"] },
                amount: { type: "integer" },
                stat: { type: "string", enum: ["ap", "hp", "cost"] },
                duration: { type: "string" },
                keyword: { type: "string" },
                keywords: { type: "array" },
                token_id: { type: "string" },
                count: { type: "integer" },
                prompt_text: { type: "string" },
                store_as: { type: "string" },
                filter: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You are a card data encoder for the Gundam Card Game (GCG).
Parse printed card rules text into structured ability data JSON.

## Trigger mappings
- 【Deploy】 → on_deploy
- 【When Deployed】 → on_deploy
- 【Burst】 → on_burst  (ability fires when shield containing this card is destroyed)
- 【When Paired】 → on_pair
- 【When Paired･(TraitName) Pilot】 → on_pair with qualifiers.pilot_traits_include: ["TraitName"]
- 【When Paired】[PilotName] → on_pair with qualifiers.pilot_name_is: "PilotName"
- 【During Pair】 → during_pair  (continuous while a pilot is paired)
- 【During Link】 → during_link  (continuous while linked — pilot satisfies link condition)
- 【Attack】 → on_attack
- 【Main】 → activated_main, cost: {rest_self: true} (only if card says "Rest" or "②" or similar resource cost)
- 【Activate･Main】 or 【Activate・Main】 → activated_main, cost: {rest_self: true}
- 【Action】 or 【Activate･Action】 → activated_action, cost: {rest_self: true}
- 【Once per Turn】 after trigger → qualifiers.once_per_turn: true
- "During your turn" → qualifiers.your_turn_only: true

## Cost notation
- ②：or ②: means pay 2 resources (pay_resources: 2)
- Rest this [Unit/Base/Pilot]: means rest_self: true
- Multiple costs combine in cost object

## Step mappings
- "Draw N" / "Draw N card(s)" → {action:"draw", side:"friendly", amount:N}
- "Choose 1 enemy Unit [condition]. Rest it." → choose_target then rest
- "Choose 1 [friendly/enemy] Unit. It gets AP+N / AP-N during this turn." → choose_target then modify_stat
- "Choose 1 [friendly/enemy] Unit. Deal N damage to it." → choose_target then deal_damage
- "Deal N damage to [target]" → deal_damage with target
- "[target] recovers N HP" / "It recovers N HP" → heal
- "Destroy [target]" → destroy
- "Return [target] to hand" → move_to_hand
- "Add this card to your hand" → move_to_hand with target:"$self"
- "Deploy 1 [Name](traits·AP·HP) Unit token" → create_token
- "Set it as active" / "Set [resource] as active" → ready

## Filter shorthand (use in choose_target step)
Use a simple filter object: {type:"unit", side:"enemy", max_hp:N, max_level:N, traits:[...]}
Examples:
- "enemy Unit with 2 or less HP" → filter:{type:"unit",side:"enemy",max_hp:2}
- "enemy Unit that is Lv.5 or lower" → filter:{type:"unit",side:"enemy",max_level:5}
- "rested enemy Unit" → filter:{type:"unit",side:"enemy",rested:true}
- "friendly Unit" → filter:{type:"unit",side:"friendly"}
- "Link Unit" → filter:{type:"unit",side:"friendly",is_linked:true}

## Special rules
- Keywords in angle brackets like <Repair 2>, <Blocker>, <Breach> are already stored in the keywords field.
  DO NOT create abilities for these — the engine handles them via the keyword registry.
  However, if a keyword has an ADDITIONAL conditional effect beyond the base keyword (like "This Unit can't choose the enemy player as its attack target"), encode that as a static ability.
- 【Pilot】[Name] at the end of a Command card is a pilot requirement, NOT an ability — skip it.
- If an effect is too complex to encode precisely, use manual_resolve with a clear prompt_text quoting the original rule.
- Generate a short unique ID for each ability like "a1", "a2", "a3" etc. per card.
- display_text should be a clean copy of just that ability's text from the card.

Return ONLY valid JSON. No markdown. No explanation.`;

// ─── Fetch cards from Supabase ────────────────────────────────────────────────

async function fetchCards() {
  let url = `${REST}/cards?select=id,data,set_code&order=id.asc`;
  if (SET_FILTER) url += `&set_code=eq.${SET_FILTER}`;
  if (ID_FILTER) url += `&id=eq.${encodeURIComponent(ID_FILTER)}`;

  const resp = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!resp.ok) throw new Error(`Fetch failed: ${await resp.text()}`);
  return resp.json();
}

// ─── Call Claude ──────────────────────────────────────────────────────────────

async function fillAbilities(card) {
  const rulesText = card.data?.rules_text ?? "";

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    output_config: {
      format: { type: "json_schema", schema: ABILITY_SCHEMA },
    },
    messages: [{
      role: "user",
      content: `Card: ${card.id}
Type: ${card.data?.type ?? "unknown"}
Keywords already stored (DO NOT re-encode): ${JSON.stringify(card.data?.keywords ?? [])}
Rules text to parse:
${rulesText}`,
    }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text in response");

  const parsed = JSON.parse(textBlock.text);
  return parsed.abilities ?? [];
}

// ─── Save to Supabase ─────────────────────────────────────────────────────────

async function saveAbilities(card, abilities) {
  const merged = { ...(card.data ?? {}), abilities };

  const resp = await fetch(`${REST}/cards?id=eq.${encodeURIComponent(card.id)}`, {
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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) { log("Missing Supabase config"); process.exit(1); }
  if (!ANTHROPIC_KEY) { log("Missing ANTHROPIC_API_KEY in .env.local"); process.exit(1); }
  if (!SET_FILTER && !ID_FILTER) { log("Provide --set=ST01 or --id=ST01-001"); process.exit(1); }

  const allCards = await fetchCards();
  log(`Found ${allCards.length} cards`);

  // Filter: skip no-ability cards and already-filled unless --force
  const todo = allCards.filter((c) => {
    const rules = (c.data?.rules_text ?? "").trim();
    if (!rules || rules === "-") return false;
    const hasAbilities = (c.data?.abilities ?? []).length > 0;
    if (hasAbilities && !FORCE) return false;
    return true;
  });

  const skipped = allCards.length - todo.length;
  log(`Processing ${todo.length} cards (skipping ${skipped} with no text or already filled)`);
  if (DRY_RUN) log("DRY RUN — no saves\n");

  let ok = 0, errors = 0;

  for (let i = 0; i < todo.length; i++) {
    const card = todo[i];
    log(`\n[${i + 1}/${todo.length}] ${card.id} — ${card.data?.name}`);
    log(`  rules_text: ${card.data?.rules_text?.replace(/\n/g, " / ")}`);

    try {
      const abilities = await fillAbilities(card);
      log(`  → ${abilities.length} abilities parsed`);
      abilities.forEach((a) => log(`     • [${a.trigger?.type}] ${a.display_text?.slice(0, 80)}`));

      if (!DRY_RUN) {
        await saveAbilities(card, abilities);
        log(`  ✓ saved`);
      }
      ok++;
    } catch (err) {
      log(`  ✗ ERROR: ${err.message}`);
      errors++;
    }

    if (i < todo.length - 1) await sleep(DELAY_MS);
  }

  log(`\n═══ Done ═══`);
  log(`OK: ${ok}  Errors: ${errors}  Skipped: ${skipped}`);
}

main().catch((err) => { log(`Fatal: ${err.message}`); process.exit(1); });
