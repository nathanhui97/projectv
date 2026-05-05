import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { normalizeAbilityFilters } from "@project-v/schemas";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createAdminClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { data: Record<string, unknown>; status?: string };
  const formData = body.data;
  const status = body.status ?? "draft";

  // Get current version to increment
  const { data: existing } = await supabase
    .from("cards")
    .select("version")
    .eq("id", id)
    .single();

  const now = new Date().toISOString();
  const cardData = {
    ...formData,
    abilities: (formData.abilities as unknown[] ?? []).map(normalizeAbilityFilters),
    updated_at: now,
    version: (existing?.version ?? 1) + 1,
  };

  const { error } = await supabase
    .from("cards")
    .update({
      data: cardData,
      status,
      set_code: formData.set_code as string,
      version: cardData.version as number,
      updated_at: now,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id }, { status: 200 });
}
