import type { Category, Invoice, LineItem, Vendor } from "./types";
import { isValidGSTIN, stateFromGSTIN } from "./gstin";

export function gstRatesFor(cat: Category): { cgst: number; sgst: number } {
  switch (cat) {
    case "meals": return { cgst: 2.5, sgst: 2.5 };
    case "fuel": return { cgst: 0, sgst: 0 };
    case "books": return { cgst: 0, sgst: 0 };
    case "telecom": return { cgst: 9, sgst: 9 };
  }
}

export function defaultHSN(cat: Category): string {
  switch (cat) {
    case "meals": return "996331";
    case "fuel": return "27101290";
    case "books": return "49011010";
    case "telecom": return "998414";
  }
}

export function defaultDescription(cat: Category): string {
  switch (cat) {
    case "meals": return "Food & Beverages";
    case "fuel": return "Motor Spirit (Petrol)";
    case "books": return "Printed Books / Periodicals";
    case "telecom": return "Telecom / Internet Services";
  }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function stateCode(gstin?: string): string | null {
  if (!gstin) return null;
  const g = gstin.trim().toUpperCase();
  if (!isValidGSTIN(g)) return null;
  return g.slice(0, 2);
}

export function buildInvoice(params: {
  vendor: Vendor;
  category: Category;
  totalAmount: number;
  description: string;
  date: string;
  txnRef?: string;
  paymentMethod?: string;
  invoiceNo?: string;
  customerName?: string;
  customerGstin?: string;
}): Invoice {
  const { cgst, sgst } = gstRatesFor(params.category);
  const totalRate = cgst + sgst;
  const subtotal = params.totalAmount / (1 + totalRate / 100);
  const hsn = params.vendor.hsnCode || defaultHSN(params.category);

  const vendorStateCode = stateCode(params.vendor.gstin);
  const customerStateCode = stateCode(params.customerGstin);
  const interState =
    vendorStateCode !== null &&
    customerStateCode !== null &&
    vendorStateCode !== customerStateCode;

  const cgstAmount = interState ? 0 : (subtotal * cgst) / 100;
  const sgstAmount = interState ? 0 : (subtotal * sgst) / 100;
  const igstRate = interState ? totalRate : 0;
  const igstAmount = interState ? (subtotal * totalRate) / 100 : 0;
  const customerState = params.customerGstin
    ? stateFromGSTIN(params.customerGstin.trim().toUpperCase()) ?? undefined
    : undefined;

  const items: LineItem[] = [
    {
      description: params.description,
      hsn,
      quantity: 1,
      rate: round2(subtotal),
      amount: round2(subtotal),
    },
  ];

  return {
    vendor: params.vendor,
    category: params.category,
    invoiceNo: params.invoiceNo || generateInvoiceNo(params.date),
    date: params.date,
    items,
    subtotal: round2(subtotal),
    cgstRate: interState ? 0 : cgst,
    sgstRate: interState ? 0 : sgst,
    cgstAmount: round2(cgstAmount),
    sgstAmount: round2(sgstAmount),
    igstRate,
    igstAmount: round2(igstAmount),
    interState,
    total: round2(params.totalAmount),
    paymentMethod: params.paymentMethod || "UPI",
    txnRef: params.txnRef,
    customerName: params.customerName,
    customerGstin: params.customerGstin?.trim().toUpperCase() || undefined,
    customerState,
  };
}

export function generateInvoiceNo(iso: string): string {
  const d = new Date(iso);
  const year = (isNaN(d.getTime()) ? new Date() : d).getFullYear();
  const month = String((isNaN(d.getTime()) ? new Date() : d).getMonth() + 1).padStart(2, "0");
  const rnd = Math.floor(Math.random() * 90000) + 10000;
  return `INV/${year}${month}/${rnd}`;
}

export function formatDateDMY(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function inrFormat(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function amountInWords(num: number): string {
  const n = Math.round(num);
  if (n === 0) return "Zero Rupees Only";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const inWords = (x: number): string => {
    if (x < 20) return a[x];
    if (x < 100) return `${b[Math.floor(x / 10)]}${x % 10 ? " " + a[x % 10] : ""}`;
    if (x < 1000) return `${a[Math.floor(x / 100)]} Hundred${x % 100 ? " " + inWords(x % 100) : ""}`;
    if (x < 100000) return `${inWords(Math.floor(x / 1000))} Thousand${x % 1000 ? " " + inWords(x % 1000) : ""}`;
    if (x < 10000000) return `${inWords(Math.floor(x / 100000))} Lakh${x % 100000 ? " " + inWords(x % 100000) : ""}`;
    return `${inWords(Math.floor(x / 10000000))} Crore${x % 10000000 ? " " + inWords(x % 10000000) : ""}`;
  };
  const paise = Math.round((num - n) * 100);
  let s = `${inWords(n)} Rupees`;
  if (paise > 0) s += ` and ${inWords(paise)} Paise`;
  return s + " Only";
}
