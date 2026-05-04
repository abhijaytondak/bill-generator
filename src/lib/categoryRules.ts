import type { ClaimCategory } from "./types";

export type CategoryRule = {
  label: string;
  description: string;
  hsn: string;
  cgst: number;
  sgst: number;
  evidence: string[];
  warnings: string[];
  examples: string[];
};

export const CATEGORY_RULES: Record<ClaimCategory, CategoryRule> = {
  food: {
    label: "Food",
    description: "Food & Beverages",
    hsn: "996331",
    cgst: 2.5,
    sgst: 2.5,
    evidence: ["Restaurant or food merchant name", "Bill/payment date and time", "Total amount", "Payment reference"],
    warnings: ["Use the actual food bill or payment proof. Do not auto-generate menu items that are not on the receipt."],
    examples: ["Meals", "Snacks", "Beverages", "Restaurant bill"],
  },
  business_travel: {
    label: "Business Travel",
    description: "Business Travel Expense",
    hsn: "9964",
    cgst: 0,
    sgst: 0,
    evidence: ["Travel operator or hotel name", "Trip/stay date", "Booking or transaction reference", "Business purpose if required by policy"],
    warnings: ["Flight, train, cab and hotel GST can vary. Verify against the original tax invoice before claiming input tax."],
    examples: ["Flight", "Train", "Cab", "Hotel stay"],
  },
  phone_internet: {
    label: "Phone / Internet",
    description: "Telecom / Internet Services",
    hsn: "998414",
    cgst: 9,
    sgst: 9,
    evidence: ["Provider name", "Billing period", "Mobile/account number if policy requires it", "Payment reference"],
    warnings: ["Monthly telecom invoices usually show 18% GST. Match the amount against the provider invoice."],
    examples: ["Mobile bill", "Broadband bill", "Data recharge"],
  },
  education: {
    label: "Education",
    description: "Education Expense",
    hsn: "9992",
    cgst: 0,
    sgst: 0,
    evidence: ["Institution or platform name", "Course/program name", "Fee receipt date", "Payment reference"],
    warnings: ["Taxability differs by course/provider. Use the tax shown on the original receipt when available."],
    examples: ["Tuition fee", "Online course", "Certification fee"],
  },
  health_and_fitness: {
    label: "Health & Fitness",
    description: "Health & Fitness Expense",
    hsn: "9997",
    cgst: 9,
    sgst: 9,
    evidence: ["Gym/clinic/provider name", "Service period or visit date", "Receipt or invoice number", "Payment reference"],
    warnings: ["Medical, gym and wellness services can have different tax treatment. Check the original bill."],
    examples: ["Gym membership", "Health checkup", "Wellness program"],
  },
  fuel: {
    label: "Fuel",
    description: "Motor Spirit / Fuel",
    hsn: "27101290",
    cgst: 0,
    sgst: 0,
    evidence: ["Fuel station name", "Date and time", "Fuel amount", "Payment reference"],
    warnings: ["Petrol/diesel are outside GST. The statement should show zero GST unless the original receipt says otherwise."],
    examples: ["Petrol", "Diesel", "CNG"],
  },
  hostel: {
    label: "Hostel",
    description: "Hostel Accommodation Expense",
    hsn: "996311",
    cgst: 6,
    sgst: 6,
    evidence: ["Hostel/property name", "Stay or fee period", "Receipt number", "Payment reference"],
    warnings: ["Accommodation GST depends on provider and tariff. Confirm against the original receipt."],
    examples: ["Hostel fee", "Accommodation charges", "Mess and stay charges"],
  },
  drivers_salary: {
    label: "Driver's Salary",
    description: "Driver Salary Reimbursement",
    hsn: "SALARY",
    cgst: 0,
    sgst: 0,
    evidence: ["Driver name", "Salary month", "Payment date", "Bank/UPI reference"],
    warnings: ["Salary reimbursement usually needs identity/payment proof rather than GST tax calculation."],
    examples: ["Monthly driver salary", "Driver allowance"],
  },
  books: {
    label: "Books",
    description: "Printed Books / Learning Material",
    hsn: "49011010",
    cgst: 0,
    sgst: 0,
    evidence: ["Seller name", "Book/material title if available", "Purchase date", "Payment reference"],
    warnings: ["Printed books are generally zero-rated, while digital subscriptions may be taxed differently."],
    examples: ["Printed books", "Periodicals", "Study material"],
  },
  professional_development: {
    label: "Professional Development",
    description: "Professional Development Expense",
    hsn: "999293",
    cgst: 9,
    sgst: 9,
    evidence: ["Provider name", "Course/event name", "Completion or registration receipt", "Payment reference"],
    warnings: ["Keep proof that the course/event is work-relevant if your company policy asks for it."],
    examples: ["Workshop", "Conference", "Certification", "Training"],
  },
  uniform: {
    label: "Uniform",
    description: "Uniform Purchase / Maintenance",
    hsn: "6205",
    cgst: 2.5,
    sgst: 2.5,
    evidence: ["Seller name", "Uniform item description", "Purchase date", "Payment reference"],
    warnings: ["Clothing GST can vary by item value and type. Use the original bill tax split when present."],
    examples: ["Uniform shirt", "Uniform trousers", "Safety shoes"],
  },
  gift: {
    label: "Gift",
    description: "Gift Expense",
    hsn: "GIFT",
    cgst: 0,
    sgst: 0,
    evidence: ["Seller name", "Gift description", "Recipient or occasion if policy requires it", "Payment reference"],
    warnings: ["Gift reimbursements often have strict caps and taxability rules. Check your company policy."],
    examples: ["Festival gift", "Corporate gift", "Gift voucher"],
  },
  vehicle_maintenance: {
    label: "Vehicle Maintenance",
    description: "Vehicle Maintenance Expense",
    hsn: "998714",
    cgst: 9,
    sgst: 9,
    evidence: ["Garage/service center name", "Vehicle number if policy requires it", "Service date", "Payment reference"],
    warnings: ["Parts and services may have different GST rates. Match original invoice details where available."],
    examples: ["Service labour", "Repair", "Spare parts", "Washing"],
  },
};

export function ruleFor(category: ClaimCategory): CategoryRule {
  return CATEGORY_RULES[category];
}

export function approvalWarnings(input: {
  category: ClaimCategory;
  merchantName: string;
  amount: string;
  date: string;
  time: string;
  txnId: string;
}): string[] {
  const rule = ruleFor(input.category);
  const warnings: string[] = [];
  if (!input.merchantName.trim()) warnings.push("Merchant/provider name is missing.");
  if (!Number(input.amount) || Number(input.amount) <= 0) warnings.push("Amount must be greater than zero.");
  if (!input.date) warnings.push("Transaction date is missing.");
  if (!input.time) warnings.push("Transaction time is missing; add it if visible on the proof.");
  if (!input.txnId.trim()) warnings.push("Payment or invoice reference is missing.");
  return [...warnings, ...rule.warnings];
}
