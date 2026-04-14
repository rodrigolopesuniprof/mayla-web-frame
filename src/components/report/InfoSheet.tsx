import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface InfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  details?: { label: string; value: string }[];
}

export function InfoSheet({ open, onOpenChange, title, description, details }: InfoSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] overflow-y-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <SheetHeader>
          <SheetTitle className="text-left text-base">{title}</SheetTitle>
          <SheetDescription className="text-left text-sm leading-relaxed whitespace-pre-line">
            {description}
          </SheetDescription>
        </SheetHeader>
        {details && details.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {details.map((d, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: "var(--rpt-border)" }}>
                <span className="text-xs font-medium" style={{ color: "var(--rpt-text-secondary)" }}>{d.label}</span>
                <span className="text-xs font-semibold font-mono" style={{ color: "var(--rpt-text-primary)" }}>{d.value}</span>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function InfoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rpt-info-btn"
      aria-label="Mais informações"
    >
      ?
    </button>
  );
}
