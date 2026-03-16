import { BrandBadge, Avatar } from "./MaylaIcons";

export function TopBar({ title, onBack }: { title?: string; onBack?: () => void }) {
  return (
    <div className="px-5 py-4 pb-3 flex items-center justify-between border-b border-border shrink-0">
      {onBack ? (
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-lg text-muted-foreground bg-transparent border-none cursor-pointer p-1">←</button>
          <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
        </div>
      ) : title ? (
        <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
      ) : (
        <BrandBadge height={38} />
      )}
      <Avatar />
    </div>
  );
}
