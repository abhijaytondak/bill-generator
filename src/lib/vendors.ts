import { z } from "zod";
import { VendorSchema, type Vendor } from "./types";

const KEY = "flexi-invoice:vendors";

const listeners = new Set<() => void>();
let cachedSnapshot: Vendor[] | null = null;
const EMPTY: Vendor[] = [];

function readRaw(): Vendor[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return z.array(VendorSchema).parse(JSON.parse(raw));
  } catch {
    return EMPTY;
  }
}

function invalidate() {
  cachedSnapshot = null;
  listeners.forEach((l) => l());
}

export function getVendors(): Vendor[] {
  if (typeof window === "undefined") return EMPTY;
  if (cachedSnapshot === null) cachedSnapshot = readRaw();
  return cachedSnapshot;
}

export function subscribeVendors(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getServerVendorsSnapshot(): Vendor[] {
  return EMPTY;
}

export function saveVendor(v: Vendor) {
  const all = [...readRaw()];
  const idx = all.findIndex((x) => x.id === v.id);
  if (idx >= 0) all[idx] = v;
  else all.push(v);
  localStorage.setItem(KEY, JSON.stringify(all));
  invalidate();
}

export function deleteVendor(id: string) {
  const remaining = readRaw().filter((x) => x.id !== id);
  localStorage.setItem(KEY, JSON.stringify(remaining));
  invalidate();
}

export function generateVendorId(): string {
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) invalidate();
  });
}
