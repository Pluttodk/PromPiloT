import { Sparkles } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">Prom-Pilot</span>
        </div>
        <div className="flex-1" />
        <nav className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">LLMOps Platform</span>
        </nav>
      </div>
    </header>
  );
}
