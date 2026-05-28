import { useLevelUpNotifier } from "@/hooks/useLevelUpNotifier";
import { LevelUpDialog } from "./LevelUpDialog";

export function LevelUpNotifier() {
  const { info, dismiss } = useLevelUpNotifier();
  return <LevelUpDialog open={!!info} info={info} onClose={dismiss} />;
}
