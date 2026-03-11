import { BrandBadge, Avatar } from "./MaylaIcons";

export function TopBar() {
  return (
    <div className="px-[22px] py-[14px] pb-2.5 flex items-center justify-between border-b border-border shrink-0">
      <BrandBadge height={34} />
      <Avatar />
    </div>
  );
}
