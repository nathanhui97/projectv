import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Plus, Search } from "lucide-react";

export const dynamic = "force-dynamic";

const ALL_SETS = [
  "ST01","ST02","ST03","ST04","ST05","ST06","ST07","ST08","ST09",
  "GD01","GD02","GD03","GD04",
];

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; set?: string }>;
}) {
  const { q, status, set } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("cards")
    .select("id, data, status, set_code, updated_at");

  if (status) query = query.eq("status", status);
  if (set) {
    query = query.eq("set_code", set).order("id", { ascending: true });
  } else {
    query = query.order("set_code", { ascending: true }).order("id", { ascending: true });
  }

  const { data: cards } = await query;

  const filtered = q
    ? cards?.filter((c) => {
        const name: string = c.data?.name ?? "";
        const id: string = c.id ?? "";
        const search = q.toLowerCase();
        return name.toLowerCase().includes(search) || id.toLowerCase().includes(search);
      })
    : cards;

  // Build href preserving other params
  function setHref(params: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    if (set) p.set("set", set);
    for (const [k, v] of Object.entries(params)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return s ? `/cards?${s}` : "/cards";
  }

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

      {/* Set picker */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <Link
          href={setHref({ set: undefined })}
          className={`px-3 py-1 rounded-md text-xs font-medium border ${
            !set ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground border-border hover:bg-accent"
          }`}
        >
          All Sets
        </Link>
        {ALL_SETS.map((s) => (
          <Link
            key={s}
            href={setHref({ set: s })}
            className={`px-3 py-1 rounded-md text-xs font-medium border ${
              set === s
                ? "bg-primary text-primary-foreground border-primary"
                : "text-muted-foreground border-border hover:bg-accent"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="flex gap-3 mb-6">
        <form className="flex-1 flex items-center gap-2 border rounded-md px-3 bg-background">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name or card ID…"
            className="flex-1 py-2 text-sm bg-transparent focus:outline-none"
          />
          {set && <input type="hidden" name="set" value={set} />}
          {status && <input type="hidden" name="status" value={status} />}
        </form>
        <div className="flex gap-1 border rounded-md overflow-hidden text-sm">
          {(["", "draft", "published", "archived"] as const).map((s) => (
            <Link
              key={s}
              href={setHref({ status: s || undefined })}
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

      <div className="text-xs text-muted-foreground mb-2">
        {filtered?.length ?? 0} card{filtered?.length !== 1 ? "s" : ""}
        {set ? ` in ${set}` : ""}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b">
            <tr>
              <th className="w-16 px-3 py-3" />
              <th className="text-left px-4 py-3 font-medium w-28">ID</th>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Color</th>
              <th className="text-left px-4 py-3 font-medium">Link</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No cards found.
                </td>
              </tr>
            )}
            {filtered?.map((card) => {
              const artUrl: string | undefined = card.data?.art_url;
              return (
                <tr key={card.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-3 py-1.5">
                    <Link href={`/cards/${card.id}`}>
                      {artUrl ? (
                        <Image
                          src={artUrl}
                          alt={card.data?.name ?? card.id}
                          width={44}
                          height={62}
                          className="rounded object-cover shadow-sm hover:scale-110 transition-transform"
                        />
                      ) : (
                        <div className="w-11 h-16 rounded bg-muted border flex items-center justify-center text-[10px] text-muted-foreground">
                          No art
                        </div>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {card.id}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/cards/${card.id}`} className="font-medium hover:underline">
                      {card.data?.name ?? "Untitled"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {card.data?.type ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {card.data?.color ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {card.data?.type === "unit" ? (card.data?.link_text ?? "—") : ""}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={card.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(card.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
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
