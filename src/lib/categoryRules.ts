import type { ClaimCategory } from "./types";

export type CategoryRule = {
  label: string;
  description: string;
  hsn: string;
  cgst: number;
  sgst: number;
  platforms: string[];
  aliases: string[];
  evidence: string[];
  warnings: string[];
  examples: string[];
  validItems: string[];
  invalidItems: string[];
};

export const CATEGORY_RULES: Record<ClaimCategory, CategoryRule> = {
  food: {
    label: "Food",
    description: "Food & Beverages",
    hsn: "996331",
    cgst: 2.5,
    sgst: 2.5,
    platforms: ["Zomato", "Swiggy", "EatSure", "Domino's", "McDonald's", "KFC", "Pizza Hut", "Behrouz", "Box8"],
    aliases: ["zomato", "swiggy", "eatsure", "domino", "mcdonald", "kfc", "pizza hut", "behrouz", "box8", "restaurant", "cafe", "food", "meal"],
    evidence: ["Restaurant or food merchant name", "Bill/payment date and time", "Total amount", "Payment reference"],
    warnings: ["Use the actual food bill or payment proof. Do not auto-generate menu items that are not on the receipt."],
    examples: ["Meals", "Snacks", "Beverages", "Restaurant bill"],
    validItems: ["Meals", "Groceries", "Snacks", "Non-alcoholic beverages", "Restaurant orders", "Food delivery"],
    invalidItems: ["Beer", "Wine", "Whisky", "Vodka", "Rum", "Cocktails", "Spirits", "Liquor", "Alcoholic drinks"],
  },
  business_travel: {
    label: "Business Travel",
    description: "Business Travel Expense",
    hsn: "9964",
    cgst: 0,
    sgst: 0,
    platforms: ["Uber", "Rapido", "Ola", "MakeMyTrip", "Goibibo", "IRCTC", "IndiGo", "Air India", "Vistara", "Akasa Air"],
    aliases: ["uber", "rapido", "ola", "makemytrip", "mmt", "goibibo", "irctc", "indigo", "air india", "vistara", "akasa", "cab", "taxi", "flight", "train", "hotel"],
    evidence: ["Travel operator or hotel name", "Trip/stay date", "Booking or transaction reference", "Business purpose if required by policy"],
    warnings: ["Flight, train, cab and hotel GST can vary. Verify against the original tax invoice before claiming input tax."],
    examples: ["Flight", "Train", "Cab", "Hotel stay"],
    validItems: ["Flight tickets", "Train tickets", "Hotel stays", "Cab/taxi for business travel", "Business lodging"],
    invalidItems: ["Personal travel bookings", "Leisure packages", "Vacation tours", "Personal cab rides"],
  },
  phone_internet: {
    label: "Phone / Internet",
    description: "Telecom / Internet Services",
    hsn: "998414",
    cgst: 9,
    sgst: 9,
    platforms: ["Airtel", "Jio", "Vi", "BSNL", "ACT Fibernet", "Tata Play Fiber", "Hathway"],
    aliases: ["airtel", "jio", "reliance jio", "vodafone", "idea", " vi ", "bsnl", "act fibernet", "tata play", "hathway", "broadband", "internet", "mobile bill"],
    evidence: ["Provider name", "Billing period", "Mobile/account number if policy requires it", "Payment reference"],
    warnings: ["Monthly telecom invoices usually show 18% GST. Match the amount against the provider invoice."],
    examples: ["Mobile bill", "Broadband bill", "Data recharge"],
    validItems: ["Prepaid recharge", "Postpaid mobile bill", "Broadband bill", "Internet/ISP bill", "WiFi subscription", "Data pack"],
    invalidItems: ["Phone handset purchase", "Earphones", "Phone accessories", "Electronic gadgets"],
  },
  education: {
    label: "Education",
    description: "Education Expense",
    hsn: "9992",
    cgst: 0,
    sgst: 0,
    platforms: ["Coursera", "Udemy", "edX", "UpGrad", "Unacademy", "Byju's", "Simplilearn"],
    aliases: ["coursera", "udemy", "edx", "upgrad", "unacademy", "byju", "simplilearn", "tuition", "school", "college", "university", "course"],
    evidence: ["Institution or platform name", "Course/program name", "Fee receipt date", "Payment reference"],
    warnings: ["Taxability differs by course/provider. Use the tax shown on the original receipt when available."],
    examples: ["Tuition fee", "Online course", "Certification fee"],
    validItems: ["School tuition fees", "College fees", "Coaching class fees", "Education institution fees", "Tuition class fees"],
    invalidItems: ["Stationery", "School supplies", "Uniform purchases", "Electronics for school"],
  },
  health_and_fitness: {
    label: "Health & Fitness",
    description: "Health & Fitness Expense",
    hsn: "9997",
    cgst: 9,
    sgst: 9,
    platforms: ["Cult.fit", "Fitpass", "Healthify", "Practo", "Apollo", "Tata 1mg"],
    aliases: ["cult", "fitpass", "healthify", "practo", "apollo", "1mg", "gym", "fitness", "wellness", "health check"],
    evidence: ["Gym/clinic/provider name", "Service period or visit date", "Receipt or invoice number", "Payment reference"],
    warnings: ["Medical, gym and wellness services can have different tax treatment. Check the original bill."],
    examples: ["Gym membership", "Fitness subscription", "Sports activity"],
    validItems: ["Gym membership", "Fitness subscription", "Badminton court booking", "Swimming", "Tennis", "Cricket", "Yoga classes", "Fitness classes"],
    invalidItems: ["Medicines", "Medical equipment", "Health checkups", "Doctor consultations", "Hospital bills", "Physiotherapy", "Diagnostic tests", "Pharmacy purchases"],
  },
  fuel: {
    label: "Fuel",
    description: "Motor Spirit / Fuel",
    hsn: "27101290",
    cgst: 0,
    sgst: 0,
    platforms: ["IndianOil", "Bharat Petroleum", "HPCL", "Shell", "Nayara"],
    aliases: ["indianoil", "indian oil", "bharat petroleum", "bpcl", "hpcl", "hindustan petroleum", "shell", "nayara", "petrol", "diesel", "fuel", "cng"],
    evidence: ["Fuel station name", "Date and time", "Fuel amount", "Payment reference"],
    warnings: ["Petrol/diesel are outside GST. The statement should show zero GST unless the original receipt says otherwise."],
    examples: ["Petrol", "Diesel", "CNG"],
    validItems: ["Petrol", "Diesel", "CNG", "Fuel for vehicle"],
    invalidItems: ["Lubricants", "Car wash", "Vehicle accessories", "Convenience store items", "Air freshener", "Windshield fluid"],
  },
  hostel: {
    label: "Hostel",
    description: "Hostel Accommodation Expense",
    hsn: "996311",
    cgst: 6,
    sgst: 6,
    platforms: ["Hostel", "PG", "Zolo", "Stanza Living", "Your Space"],
    aliases: ["hostel", "paying guest", " pg ", "zolo", "stanza", "your space", "accommodation", "mess charges"],
    evidence: ["Hostel/property name", "Stay or fee period", "Receipt number", "Payment reference"],
    warnings: ["Accommodation GST depends on provider and tariff. Confirm against the original receipt."],
    examples: ["Hostel fee", "Accommodation charges", "Mess and stay charges"],
    validItems: ["Hostel fees", "PG accommodation rent", "Mess charges", "Dormitory charges"],
    invalidItems: ["General apartment rent", "Home utility bills", "House maintenance", "Furniture purchase"],
  },
  drivers_salary: {
    label: "Driver's Salary",
    description: "Driver Salary Reimbursement",
    hsn: "SALARY",
    cgst: 0,
    sgst: 0,
    platforms: ["Direct bank transfer", "UPI payment"],
    aliases: ["driver", "salary", "chauffeur", "wages"],
    evidence: ["Driver name", "Salary month", "Payment date", "Bank/UPI reference"],
    warnings: ["Salary reimbursement usually needs identity/payment proof rather than GST tax calculation."],
    examples: ["Monthly driver salary", "Driver allowance"],
    validItems: ["Monthly driver salary", "Driver wages", "Personal driver payment"],
    invalidItems: ["Cab service bills", "Taxi fare", "Ola/Uber ride", "Ride-hailing app charges"],
  },
  books: {
    label: "Books",
    description: "Printed Books / Learning Material",
    hsn: "49011010",
    cgst: 0,
    sgst: 0,
    platforms: ["Amazon", "Flipkart", "Bookswagon", "SapnaOnline", "Crossword"],
    aliases: ["book", "books", "bookswagon", "sapna", "crossword", "publication", "periodical", "study material"],
    evidence: ["Seller name", "Book/material title if available", "Purchase date", "Payment reference"],
    warnings: ["Printed books are generally zero-rated, while digital subscriptions may be taxed differently."],
    examples: ["Printed books", "Periodicals", "Study material"],
    validItems: ["Books", "Magazines", "Newspapers", "Journals", "E-book subscriptions", "Periodical subscriptions"],
    invalidItems: ["Stationery", "Pens", "Notebooks", "Office supplies", "Electronics", "Laptop"],
  },
  professional_development: {
    label: "Professional Development",
    description: "Professional Development Expense",
    hsn: "999293",
    cgst: 9,
    sgst: 9,
    platforms: ["Coursera", "Udemy", "LinkedIn Learning", "Pluralsight", "O'Reilly", "NASSCOM"],
    aliases: ["conference", "workshop", "certification", "training", "linkedin learning", "pluralsight", "oreilly", "nasscom", "seminar"],
    evidence: ["Provider name", "Course/event name", "Completion or registration receipt", "Payment reference"],
    warnings: ["Keep proof that the course/event is work-relevant if your company policy asks for it."],
    examples: ["Workshop", "Conference", "Certification", "Training"],
    validItems: ["Course fees", "Certification fees", "Training program", "Workshop fees", "Conference registration", "Skill development program"],
    invalidItems: ["Netflix subscription", "Spotify subscription", "Gaming subscription", "General entertainment"],
  },
  uniform: {
    label: "Uniform",
    description: "Uniform Purchase / Maintenance",
    hsn: "6205",
    cgst: 2.5,
    sgst: 2.5,
    platforms: ["Uniform supplier", "Safety gear seller", "Amazon", "Flipkart"],
    aliases: ["uniform", "safety shoes", "formal shirt", "workwear", "protective gear"],
    evidence: ["Seller name", "Uniform item description", "Purchase date", "Payment reference"],
    warnings: ["Clothing GST can vary by item value and type. Use the original bill tax split when present."],
    examples: ["Uniform shirt", "Uniform trousers", "Safety shoes"],
    validItems: ["Apparel", "Clothing", "Footwear", "Garments", "Uniform shirt", "Trousers", "Safety shoes", "Workwear"],
    invalidItems: [],
  },
  gift: {
    label: "Gift",
    description: "Gift Expense",
    hsn: "GIFT",
    cgst: 0,
    sgst: 0,
    platforms: ["Amazon", "Flipkart", "BigBasket", "Blinkit", "Gift voucher"],
    aliases: ["gift", "voucher", "hamper", "festival", "present"],
    evidence: ["Seller name", "Gift description", "Recipient or occasion if policy requires it", "Payment reference"],
    warnings: ["Gift reimbursements often have strict caps and taxability rules. Check your company policy."],
    examples: ["Festival gift", "Corporate gift", "Gift voucher"],
    validItems: ["Gift items", "Gift hamper", "Gift voucher", "Festival gift", "Corporate gift"],
    invalidItems: ["Personal regular shopping", "Groceries", "Daily essentials", "Personal clothing"],
  },
  vehicle_maintenance: {
    label: "Vehicle Maintenance",
    description: "Vehicle Maintenance Expense",
    hsn: "998714",
    cgst: 9,
    sgst: 9,
    platforms: ["GoMechanic", "Shell Service", "3M Car Care", "Authorized service center"],
    aliases: ["gomechanic", "service center", "garage", "vehicle service", "car service", "bike service", "repair", "spare parts", "maintenance"],
    evidence: ["Garage/service center name", "Vehicle number if policy requires it", "Service date", "Payment reference"],
    warnings: ["Parts and services may have different GST rates. Match original invoice details where available."],
    examples: ["Service labour", "Repair", "Spare parts"],
    validItems: ["Vehicle servicing", "Vehicle repair", "Spare parts", "Maintenance labour", "Oil change", "Tyre replacement"],
    invalidItems: ["Fuel", "Car wash", "Vehicle accessories", "Seat covers", "Music system", "Modifications"],
  },
};

export function ruleFor(category: ClaimCategory): CategoryRule {
  return CATEGORY_RULES[category];
}

export function inferCategoryFromText(text: string): ClaimCategory | null {
  const normalized = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  for (const category of Object.keys(CATEGORY_RULES) as ClaimCategory[]) {
    const rule = CATEGORY_RULES[category];
    if (rule.aliases.some((alias) => normalized.includes(` ${alias.trim().toLowerCase()} `))) {
      return category;
    }
  }
  return null;
}

export function inferPlatformFromText(text: string, category?: ClaimCategory | null): string | null {
  const normalized = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const categories = category ? [category] : (Object.keys(CATEGORY_RULES) as ClaimCategory[]);
  for (const cat of categories) {
    const match = CATEGORY_RULES[cat].platforms.find((platform) =>
      normalized.includes(` ${platform.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `),
    );
    if (match) return match;
  }
  return null;
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
  warnings.push("GSTIN/SGST details should be copied from the original bill if your employer requires them.");
  return [...warnings, ...rule.warnings];
}
