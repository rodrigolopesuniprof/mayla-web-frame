import { MaylaApp } from "@/components/mayla/MaylaApp";
import type { TabId } from "@/lib/mayla-config";

interface IndexProps {
  initialTab?: TabId;
}

const Index = ({ initialTab = "inicio" }: IndexProps) => {
  return <MaylaApp initialTab={initialTab} />;
};

export default Index;
