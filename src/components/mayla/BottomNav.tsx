import type { TabId } from "@/lib/mayla-config";
import { TABS } from "@/lib/mayla-config";

export function BottomNav({ active, setActive }: { active: TabId; setActive: (id: TabId) => void }) {
  return (
    <div className="flex border-t border-border bg-background/97 backdrop-blur-sm pb-4 pt-2.5 shrink-0">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActive(tab.id)}
          className="flex-1 bg-transparent border-none cursor-pointer flex flex-col items-center gap-1 py-1"
        >
          <span
            className="text-xl"
            style={{ filter: active === tab.id ? "none" : "grayscale(1) opacity(.5)" }}
          >
            {tab.emoji}
          </span>
          <span
            className="text-[11px] tracking-[.04em]"
            style={{
              fontWeight: active === tab.id ? 600 : 400,
              color: active === tab.id ? "hsl(var(--mayla-rose))" : "hsl(var(--muted-foreground))",
            }}
          >
            {tab.label}
          </span>
          {active === tab.id && (
            <div className="w-5 h-[3px] rounded-sm bg-accent mt-0.5" />
          )}
        </button>
      ))}
    </div>
  );
}
