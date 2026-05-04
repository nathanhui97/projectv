import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CardEditor from "./CardEditor";

export const dynamic = "force-dynamic";

export default async function CardEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  if (id === "new") {
    const { data: traits } = await supabase
      .from("traits")
      .select("slug, display_name")
      .order("slug");
    return <CardEditor card={null} traits={traits ?? []} />;
  }

  const { data: card } = await supabase
    .from("cards")
    .select("*")
    .eq("id", id)
    .single();

  if (!card) notFound();

  const { data: traits } = await supabase
    .from("traits")
    .select("slug, display_name")
    .order("slug");

  return <CardEditor card={card} traits={traits ?? []} />;
}
