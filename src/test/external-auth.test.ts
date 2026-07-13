import { describe, expect, it } from "vitest";
import {
  readExternalAuthAttempt,
  removeSsidFromUrl,
  resolveExternalAuthTarget,
} from "@/lib/external-auth";

describe("external authentication URL", () => {
  it("captures source, ssid and maps desafios to campanhas", () => {
    expect(readExternalAuthAttempt(
      "?source=maylaapp&target=desafios&ssid=019ecb3b-c3c0-728e-9614-89b44853777a",
    )).toEqual({
      source: "maylaapp",
      ssid: "019ecb3b-c3c0-728e-9614-89b44853777a",
      target: "campanhas",
    });
  });

  it("temporarily accepts the misspelled souce parameter", () => {
    expect(readExternalAuthAttempt("?souce=maylaapp&ssid=abc")?.source).toBe("maylaapp");
  });

  it("does not start external auth without both source and ssid", () => {
    expect(readExternalAuthAttempt("?source=maylaapp")).toBeNull();
    expect(readExternalAuthAttempt("?ssid=abc")).toBeNull();
  });

  it.each([
    ["desafios", "campanhas"],
    ["bemestar", "bemestar"],
    ["servicos", "servicos"],
    ["perfil", "perfil"],
    ["unknown", "inicio"],
    [null, "inicio"],
  ])("maps target %s to %s", (target, expected) => {
    expect(resolveExternalAuthTarget(target)).toBe(expected);
  });

  it("removes only the sensitive ssid from the browser URL", () => {
    const url = new URL("https://app.example/?source=maylaapp&ssid=secret&target=desafios#top");
    expect(removeSsidFromUrl(url)).toBe("/?source=maylaapp&target=desafios#top");
  });
});
