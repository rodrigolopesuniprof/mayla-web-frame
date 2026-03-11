import { BrandBadge, Avatar } from "./MaylaIcons";

export function TopBar({ title }: { title?: string }) {
  return (
    <div className="px-[22px] py-[14px] pb-2.5 flex items-center justify-between border-b border-border shrink-0">
      {title ? (
        <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
      ) : (
        <BrandBadge height={34} />
      )}
      <Avatar />
    </div>
  );
}
