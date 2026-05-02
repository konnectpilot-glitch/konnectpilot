const COOKIE_NAME = "kp_ref";
const COOKIE_DAYS = 60;
const ATTRIBUTED_KEY = "kp_ref_attributed";

function setCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/; SameSite=Lax${secure}`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(`${name}=`)) {
      return decodeURIComponent(p.slice(name.length + 1));
    }
  }
  return null;
}

export function getStoredReferralCode(): string | null {
  return getCookie(COOKIE_NAME);
}

export function clearReferralCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

export function hasAttributed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ATTRIBUTED_KEY) === "1";
}

export function markAttributed(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ATTRIBUTED_KEY, "1");
}

export function clearAttributed(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ATTRIBUTED_KEY);
}

/**
 * Read ?ref= from the URL, persist it as a cookie for COOKIE_DAYS, and ping
 * the backend to record the click. Idempotent per page-load.
 */
export async function captureReferralFromUrl(apiBase: string): Promise<void> {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const code = params.get("ref");
  if (!code) return;

  setCookie(COOKIE_NAME, code, COOKIE_DAYS);

  // Strip ?ref= from the URL so it isn't re-tracked on subsequent navigations.
  params.delete("ref");
  const search = params.toString();
  const newUrl =
    window.location.pathname + (search ? `?${search}` : "") + window.location.hash;
  window.history.replaceState(null, "", newUrl);

  try {
    await fetch(`${apiBase}/api/affiliate/track-click`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
  } catch {
    // ignore network failures — click tracking is best-effort
  }
}
