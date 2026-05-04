import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const ABILITY_SCHEMA = {
  type: "object",
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
                amount: { type: "integer" },
                stat: { type: "string", enum: ["ap", "hp", "cost"] },
                keyword: { type: "string" },
                prompt_text: { type: "string" },
                store_as: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
  required: ["abilities"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a card data encoder for the Gundam Card Game (GCG).
Your task is to parse printed card rules text into structured ability data.

Rules:
- "When Deployed" → trigger: on_deploy
- "When this unit is destroyed" → trigger: on_destroyed
- "When this unit attacks" → trigger: on_attack
- "[Action]" cost cards → trigger: activated_action, cost: {rest_self: true}
- "[Main]" cost cards → trigger: activated_main, cost: {rest_self: true}
- "Once per turn" → qualifiers: {once_per_turn: true}
- "During your turn" → qualifiers: {your_turn_only: true}
- "Draw N cards" → action: draw, amount: N
- "Deal N damage" → action: deal_damage, amount: N
- "Destroy target" → action: destroy
- "Gain [keyword]" → action: gain_keyword, keyword: <keyword_slug>
- "Return to hand" → action: move_to_hand
- "Send to trash" → action: move_to_trash
- Continuous/static effects → trigger: static or during_pair

Always generate a unique UUID-like id for each ability.
If the effect is too complex to encode, use action: manual_resolve with a prompt_text.
Return only valid JSON matching the schema.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { rules_text?: string };
  const rulesText = body.rules_text?.trim();

  if (!rulesText) {
    return NextResponse.json({ error: "rules_text is required" }, { status: 400 });
  }

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    output_config: {
      format: {
        type: "json_schema",
        schema: ABILITY_SCHEMA,
      },
    },
    messages: [
      {
        role: "user",
        content: `Parse this card's rules text into structured ability data:\n\n${rulesText}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json({ error: "No response from AI" }, { status: 500 });
  }

  const parsed = JSON.parse(textBlock.text) as { abilities: unknown[] };
  return NextResponse.json({ abilities: parsed.abilities });
}
