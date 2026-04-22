import { z } from "zod";
import { InvoiceSchema, type Invoice } from "./types";

const KEY = "flexi-invoice:history";

const HistoryEntrySchema = z.object({
  invoice: InvoiceSchema,
  savedAt: z.string(),
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

const listeners = new Set<() => void>();
let cachedSnapshot: HistoryEntry[] | null = null;
const EMPTY: HistoryEntry[] = [];

function readRaw(): HistoryEntry[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = z.array(HistoryEntrySchema).parse(JSON.parse(raw));
    return parsed.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    return EMPTY;
  }
}

function invalidate() {
  cachedSnapshot = null;
  listeners.forEach((l) => l());
}

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return EMPTY;
  if (cachedSnapshot === null) cachedSnapshot = readRaw();
  return cachedSnapshot;
}

export function subscribeHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getServerHistorySnapshot(): HistoryEntry[] {
  return EMPTY;
}

export function saveToHistory(invoice: Invoice): void {
  if (typeof window === "undefined") return;
  const all = [...readRaw()];
  const idx = all.findIndex((e) => e.invoice.invoiceNo === invoice.invoiceNo);
  const entry: HistoryEntry = { invoice, savedAt: new Date().toISOString() };
  if (idx >= 0) all[idx] = entry;
  else all.unshift(entry);
  localStorage.setItem(KEY, JSON.stringify(all));
  invalidate();
}

export function deleteFromHistory(invoiceNo: string): void {
  const remaining = readRaw().filter((e) => e.invoice.invoiceNo !== invoiceNo);
  localStorage.setItem(KEY, JSON.stringify(remaining));
  invalidate();
}

export function duplicateInHistory(invoiceNo: string): Invoice | null {
  const entry = readRaw().find((e) => e.invoice.invoiceNo === invoiceNo);
  if (!entry) return null;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const rnd = Math.floor(Math.random() * 90000) + 10000;
  const copy: Invoice = {
    ...entry.invoice,
    invoiceNo: `INV/${y}${m}/${rnd}`,
    date: now.toISOString(),
  };
  saveToHistory(copy);
  return copy;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) invalidate();
  });
}
