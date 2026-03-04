import { Link, useLocation } from "react-router-dom";
import { FolderKanban, FileText, GitBranch, Activity, Settings, Server, Database, FlaskConical } from "lucide-react";
import { cn } from "../../lib/utils";

const navItems = [
  { name: "Projects", href: "/", icon: FolderKanban },
  { name: "Prompts", href: "/prompts", icon: FileText },
  { name: "Models", href: "/models", icon: Server },
  { name: "Flows", href: "/flows", icon: GitBranch },
  { name: "Traces", href: "/traces", icon: Activity },
  { name: "Datasets", href: "/datasets", icon: Database },
  { name: "Evaluations", href: "/evaluations", icon: FlaskConical },
  { name: "Settings", href: "/settings", icon: Settings, disabled: true },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-56 border-r bg-background">
      <nav className="flex flex-col gap-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              to={item.disabled ? "#" : item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                item.disabled && "pointer-events-none opacity-50"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.name}
              {item.disabled && (
                <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">Soon</span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
