import { z } from "zod";

export const CategorySchema = z.enum(["meals", "fuel", "books", "telecom", "mixed"]);
export type Category = z.infer<typeof CategorySchema>;

export const CATEGORY_LABELS: Record<Category, string> = {
  meals: "Meals / Food",
  fuel: "Fuel",
  books: "Books & Periodicals",
  telecom: "Telecom / Internet",
  mixed: "Mixed Expenses",
};

export const CLAIM_CATEGORIES = ["meals", "fuel", "books", "telecom"] as const;
export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number];

export const VendorSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  gstin: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  category: CategorySchema,
  phone: z.string().optional(),
  hsnCode: z.string().optional(),
});
export type Vendor = z.infer<typeof VendorSchema>;

export const ExtractedDataSchema = z.object({
  amount: z.number().nullable(),
  merchantName: z.string().nullable(),
  date: z.string().nullable(),
  time: z.string().nullable().optional(),
  txnId: z.string().nullable(),
  paymentMethod: z.enum(["upi", "card", "unknown"]).default("unknown"),
  rawText: z.string(),
});
export type ExtractedData = z.infer<typeof ExtractedDataSchema>;

export const LineItemSchema = z.object({
  description: z.string(),
  hsn: z.string().optional(),
  category: CategorySchema.optional(),
  merchantName: z.string().optional(),
  transactionDate: z.string().optional(),
  txnRef: z.string().optional(),
  paymentMethod: z.string().optional(),
  quantity: z.number(),
  rate: z.number(),
  amount: z.number(),
  total: z.number().optional(),
  cgstRate: z.number().optional(),
  sgstRate: z.number().optional(),
  igstRate: z.number().optional(),
  cgstAmount: z.number().optional(),
  sgstAmount: z.number().optional(),
  igstAmount: z.number().optional(),
});
export type LineItem = z.infer<typeof LineItemSchema>;

export const InvoiceSchema = z.object({
  vendor: VendorSchema,
  category: CategorySchema,
  invoiceNo: z.string(),
  date: z.string(),
  items: z.array(LineItemSchema),
  subtotal: z.number(),
  cgstRate: z.number(),
  sgstRate: z.number(),
  cgstAmount: z.number(),
  sgstAmount: z.number(),
  igstRate: z.number(),
  igstAmount: z.number(),
  interState: z.boolean(),
  total: z.number(),
  paymentMethod: z.string(),
  txnRef: z.string().optional(),
  customerName: z.string().optional(),
  customerGstin: z.string().optional(),
  customerState: z.string().optional(),
  sourceType: z.enum(["tax_invoice", "expense_statement"]).default("tax_invoice").optional(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;
