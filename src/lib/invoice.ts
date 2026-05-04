import type { Category, ClaimCategory, Invoice, LineItem, Vendor } from "./types";
import { isValidGSTIN, stateFromGSTIN } from "./gstin";
import { ruleFor } from "./categoryRules";

export function gstRatesFor(cat: Category): { cgst: number; sgst: number } {
  if (cat === "mixed") return { cgst: 0, sgst: 0 };
  const rule = ruleFor(cat);
  return { cgst: rule.cgst, sgst: rule.sgst };
}

export function defaultHSN(cat: Category): string {
  if (cat === "mixed") return "EXPENSE";
  return ruleFor(cat).hsn;
}

export function defaultDescription(cat: Category): string {
  if (cat === "mixed") return "Flexi Benefit Expenses";
  return ruleFor(cat).description;
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
  const vendorRegistered = Boolean(params.vendor.gstin && isValidGSTIN(params.vendor.gstin));
  const { cgst, sgst } = vendorRegistered ? gstRatesFor(params.category) : { cgst: 0, sgst: 0 };
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
    sourceType: "tax_invoice",
  };
}

export type BatchExpenseInput = {
  category: ClaimCategory;
  merchantName: string;
  totalAmount: number;
  date: string;
  time?: string;
  txnRef?: string;
  paymentMethod?: string;
  description?: string;
};

export function calculateLineItem(params: BatchExpenseInput): LineItem {
  const { cgst, sgst } = gstRatesFor(params.category);
  const totalRate = cgst + sgst;
  const subtotal = params.totalAmount / (1 + totalRate / 100);
  const cgstAmount = (subtotal * cgst) / 100;
  const sgstAmount = (subtotal * sgst) / 100;
  const transactionDate = params.time ? withTime(params.date, params.time) : params.date;

  return {
    description: params.description || defaultDescription(params.category),
    hsn: defaultHSN(params.category),
    category: params.category,
    merchantName: params.merchantName || "Unknown Merchant",
    transactionDate,
    txnRef: params.txnRef,
    paymentMethod: params.paymentMethod || "UPI",
    quantity: 1,
    rate: round2(subtotal),
    amount: round2(subtotal),
    total: round2(params.totalAmount),
    cgstRate: cgst,
    sgstRate: sgst,
    igstRate: 0,
    cgstAmount: round2(cgstAmount),
    sgstAmount: round2(sgstAmount),
    igstAmount: 0,
  };
}

export function buildExpenseStatement(params: {
  expenses: BatchExpenseInput[];
  customerName?: string;
  customerGstin?: string;
  invoiceNo?: string;
  date?: string;
}): Invoice {
  const now = new Date().toISOString();
  const statementVendor: Vendor = {
    id: "flexi-benefit-claim",
    name: "Flexi Benefit Expense Claim",
    category: "mixed",
  };
  const items = params.expenses.map(calculateLineItem);
  const subtotal = round2(items.reduce((sum, item) => sum + item.amount, 0));
  const cgstAmount = round2(items.reduce((sum, item) => sum + (item.cgstAmount ?? 0), 0));
  const sgstAmount = round2(items.reduce((sum, item) => sum + (item.sgstAmount ?? 0), 0));
  const total = round2(items.reduce((sum, item) => sum + (item.total ?? item.amount), 0));
  const refs = items.map((item) => item.txnRef).filter(Boolean).join(", ");

  return {
    vendor: statementVendor,
    category: "mixed",
    invoiceNo: params.invoiceNo || generateInvoiceNo(params.date || now),
    date: params.date || now,
    items,
    subtotal,
    cgstRate: 0,
    sgstRate: 0,
    cgstAmount,
    sgstAmount,
    igstRate: 0,
    igstAmount: 0,
    interState: false,
    total,
    paymentMethod: "Multiple",
    txnRef: refs || undefined,
    customerName: params.customerName,
    customerGstin: params.customerGstin?.trim().toUpperCase() || undefined,
    customerState: params.customerGstin
      ? stateFromGSTIN(params.customerGstin.trim().toUpperCase()) ?? undefined
      : undefined,
    sourceType: "expense_statement",
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

export function formatDateTimeDMY(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${formatDateDMY(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function inrFormat(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function amountInWords(num: number): string {
  const totalPaise = Math.round(num * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;
  if (rupees === 0 && paise === 0) return "Zero Rupees Only";
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
  let s = rupees > 0 ? `${inWords(rupees)} Rupees` : "Zero Rupees";
  if (paise > 0) s += ` and ${inWords(paise)} Paise`;
  return s + " Only";
}

function withTime(iso: string, time: string): string {
  const datePart = new Date(iso);
  const base = isNaN(datePart.getTime()) ? new Date() : datePart;
  const [hours, minutes] = time.split(":").map((n) => parseInt(n, 10));
  base.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return base.toISOString();
}
