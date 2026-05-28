export type FirstStepKey = "campaigns-viewed" | "ranking-viewed";

export const FIRST_STEPS_REFRESH_EVENT = "first-steps-refresh";

const storageKey = (userId: string, key: FirstStepKey) =>
  `mayla:first-steps:${key}:${userId}`;

export function markFirstStep(userId: string | undefined, key: FirstStepKey) {
  if (!userId || typeof window === "undefined") return;
  try {
    const k = storageKey(userId, key);
    if (localStorage.getItem(k) === "1") return;
    localStorage.setItem(k, "1");
    window.dispatchEvent(new Event(FIRST_STEPS_REFRESH_EVENT));
  } catch {
    /* ignore */
  }
}

export function hasFirstStep(userId: string | undefined, key: FirstStepKey): boolean {
  if (!userId || typeof window === "undefined") return false;
  try {
    return localStorage.getItem(storageKey(userId, key)) === "1";
  } catch {
    return false;
  }
}
