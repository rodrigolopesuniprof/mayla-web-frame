import { BrandBadge, Avatar } from "./MaylaIcons";

export function TopBar({ title }: { title?: string }) {
  return (
    <div className="px-5 py-4 pb-3 flex items-center justify-between border-b border-border shrink-0">
      {title ? (
        <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
      ) : (
        <BrandBadge height={38} />
      )}
      <Avatar />
    </div>
  );
}
