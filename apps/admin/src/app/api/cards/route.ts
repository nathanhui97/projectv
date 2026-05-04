import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { data: Record<string, unknown>; status?: string };
  const formData = body.data;
  const status = body.status ?? "draft";

  const cardId = formData.id as string;
  if (!cardId) return NextResponse.json({ error: "Card ID is required" }, { status: 400 });

  const now = new Date().toISOString();
  const cardData = {
    ...formData,
    authored_by: user.id,
    created_at: now,
    updated_at: now,
    version: 1,
    status,
    abilities: formData.abilities ?? [],
    keywords: formData.keywords ?? [],
    traits: formData.traits ?? [],
    format_legality: {},
  };

  const { error } = await supabase.from("cards").insert({
    id: cardId,
    data: cardData,
    status,
    set_code: formData.set_code as string,
    version: 1,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A card with this ID already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: cardId }, { status: 201 });
}
