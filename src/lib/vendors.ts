import { z } from "zod";
import { VendorSchema, type Vendor } from "./types";

const KEY = "flexi-invoice:vendors";

export function getVendors(): Vendor[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return z.array(VendorSchema).parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveVendor(v: Vendor) {
  const all = getVendors();
  const idx = all.findIndex((x) => x.id === v.id);
  if (idx >= 0) all[idx] = v;
  else all.push(v);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteVendor(id: string) {
  const remaining = getVendors().filter((x) => x.id !== id);
  localStorage.setItem(KEY, JSON.stringify(remaining));
}

export function generateVendorId(): string {
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
