import { setImpersonationGetter } from "@workspace/api-client-react";

const KEY = "postpilot.impersonateUserId";
const EMAIL_KEY = "postpilot.impersonateEmail";

export type ImpersonationListener = (userId: string | null) => void;
const listeners = new Set<ImpersonationListener>();

function notify() {
  const id = getImpersonatedUserId();
  for (const l of listeners) l(id);
}

export function getImpersonatedUserId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function getImpersonatedEmail(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(EMAIL_KEY);
}

export function startImpersonation(userId: number | string, email: string): void {
  window.localStorage.setItem(KEY, String(userId));
  window.localStorage.setItem(EMAIL_KEY, email);
  notify();
}

export function stopImpersonation(): void {
  window.localStorage.removeItem(KEY);
  window.localStorage.removeItem(EMAIL_KEY);
  notify();
}

export function subscribeImpersonation(l: ImpersonationListener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function installImpersonationHeader(): void {
  setImpersonationGetter(() => getImpersonatedUserId());
}
