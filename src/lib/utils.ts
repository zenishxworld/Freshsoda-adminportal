import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Add a 12-hour auth grace period based on the device's last successful login time
export function isWithinAuthGracePeriod(): boolean {
  try {
    const ts = localStorage.getItem("lastLoginAt");
    if (!ts) return false;
    const lastLoginAt = Number(ts);
    if (Number.isNaN(lastLoginAt)) return false;
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    return Date.now() - lastLoginAt < TWELVE_HOURS_MS;
  } catch {
    return false;
  }
}

export function nameMatchesQueryByWordPrefix(name: string, query: string): boolean {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  const words = (name || "").toLowerCase().match(/[a-z0-9]+/gi) || [];
  return words.some((w) => w.startsWith(q));
}
