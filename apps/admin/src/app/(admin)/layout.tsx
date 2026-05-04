import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LogOut, LayoutGrid, Tag, BookOpen, Beaker } from "lucide-react";

const navItems = [
  { href: "/cards", label: "Cards", icon: LayoutGrid },
  { href: "/traits", label: "Traits", icon: Tag },
  { href: "/sets", label: "Sets", icon: BookOpen },
  { href: "/sandbox", label: "Sandbox", icon: Beaker },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex h-screen">
      <aside className="w-56 border-r bg-card flex flex-col">
        <div className="px-4 py-5 border-b">
          <span className="font-semibold text-sm">Admin Portal</span>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-2 py-4 border-t">
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-full"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
