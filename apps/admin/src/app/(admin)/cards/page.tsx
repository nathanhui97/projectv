import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Plus, Search } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("cards")
    .select("id, data, status, updated_at")
    .order("updated_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data: cards } = await query;

  const filtered = q
    ? cards?.filter((c) => {
        const name: string = c.data?.name ?? "";
        return name.toLowerCase().includes(q.toLowerCase());
      })
    : cards;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Cards</h1>
        <Link
          href="/cards/new"
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          New Card
        </Link>
      </div>

      <div className="flex gap-3 mb-6">
        <form className="flex-1 flex items-center gap-2 border rounded-md px-3 bg-background">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search cards…"
            className="flex-1 py-2 text-sm bg-transparent focus:outline-none"
          />
        </form>
        <div className="flex gap-1 border rounded-md overflow-hidden text-sm">
          {["", "draft", "published", "archived"].map((s) => (
            <Link
              key={s}
              href={s ? `?status=${s}` : "/cards"}
              className={`px-3 py-2 capitalize ${
                (status ?? "") === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {s || "All"}
            </Link>
          ))}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Color</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No cards found.
                </td>
              </tr>
            )}
            {filtered?.map((card) => (
              <tr key={card.id} className="border-b last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3">
                  <Link
                    href={`/cards/${card.id}`}
                    className="font-medium hover:underline"
                  >
                    {card.data?.name ?? "Untitled"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground capitalize">
                  {card.data?.card_type ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground capitalize">
                  {card.data?.color ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={card.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(card.updated_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-yellow-100 text-yellow-800",
    published: "bg-green-100 text-green-800",
    archived: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${styles[status] ?? ""}`}>
      {status}
    </span>
  );
}
