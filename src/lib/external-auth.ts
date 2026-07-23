import type { TabId } from "@/lib/mayla-config";

export interface ExternalAuthAttempt {
  source: string;
  ssid: string;
  target: TabId;
}

const targetMap: Readonly<Record<string, TabId>> = {
  desafios: "campanhas",
  inicio: "inicio",
  bemestar: "bemestar",
  servicos: "servicos",
  perfil: "perfil",
};

export function resolveExternalAuthTarget(target: string | null): TabId {
  return targetMap[target?.trim().toLowerCase() ?? ""] ?? "inicio";
}

export function readExternalAuthAttempt(search: string): ExternalAuthAttempt | null {
  const params = new URLSearchParams(search);
  const source = params.get("source");
  const ssid = params.get("ssid");

  if (!source || !ssid) return null;

  return {
    source: source.trim().toLowerCase(),
    ssid: ssid.trim(),
    target: resolveExternalAuthTarget(params.get("target")),
  };
}

export function removeSsidFromUrl(url: URL): string {
  url.searchParams.delete("ssid");
  return `${url.pathname}${url.search}${url.hash}`;
}
