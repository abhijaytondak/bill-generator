export enum BillValidationType {
  DOCUMENT_AUTHENTICITY = "DOCUMENT_AUTHENTICITY",
  BENEFIT_CATEGORY_MATCH = "BENEFIT_CATEGORY_MATCH",
  BILL_DATE = "BILL_DATE",
  AMOUNT_MATCH = "AMOUNT_MATCH",
  DUPLICATE_BILL = "DUPLICATE_BILL",
  TAX_SANITY = "TAX_SANITY",
  BILL_COMPLETENESS = "BILL_COMPLETENESS",
  AMOUNT_REASONABLENESS = "AMOUNT_REASONABLENESS",
  MERCHANT_MATCH = "MERCHANT_MATCH",
}

export type ValidationTier = 1 | 2 | 3 | 4;

export const VALIDATION_TIERS: Record<BillValidationType, ValidationTier> = {
  [BillValidationType.DOCUMENT_AUTHENTICITY]: 1,
  [BillValidationType.BENEFIT_CATEGORY_MATCH]: 1,
  [BillValidationType.BILL_DATE]: 1,
  [BillValidationType.AMOUNT_MATCH]: 2,
  [BillValidationType.DUPLICATE_BILL]: 2,
  [BillValidationType.TAX_SANITY]: 2,
  [BillValidationType.BILL_COMPLETENESS]: 2,
  [BillValidationType.AMOUNT_REASONABLENESS]: 3,
  [BillValidationType.MERCHANT_MATCH]: 4,
};

export type DocumentAuthenticityResult = {
  isGenuineBill: boolean;
  confidence: number;
  documentType: "INVOICE" | "RECEIPT" | "NOT_A_BILL" | "UNCLEAR";
  concerns: string[];
};

export type CategoryMatchResult = {
  result: "VALID" | "INVALID" | "PARTIALLY_VALID";
  reason: string;
  invalidItems: string[];
};

export type ValidationCheckResult = {
  type: BillValidationType;
  tier: ValidationTier;
  passed: boolean;
  details?: string;
  data?: DocumentAuthenticityResult | CategoryMatchResult;
};

export const DOCUMENT_AUTHENTICITY_PROMPT = `You are a document fraud analyst. You will receive the raw OCR text of an uploaded document, its structured parse, and possibly the original image of the document. Determine whether this is a GENUINE bill/invoice/receipt.

Evaluate these dimensions:
1. DOCUMENT TYPE - Is this actually a bill/invoice/receipt? (not a bank statement, chat screenshot, menu, random image, or self-created document)
2. COMPLETENESS - Does it have expected elements of a real bill? (merchant name/address, date, amount, invoice/bill number, items or description of service)
3. COHERENCE - Do line items, taxes, and totals make arithmetic sense? Are items consistent with the merchant type?
4. TAMPERING SIGNALS - Any signs of editing? (inconsistent fonts, alignment issues, pixel artifacts, suspiciously round numbers with no tax, missing standard elements that a POS/billing system would always print)
5. TEMPLATE/FAKE SIGNALS - Does it look like output from a fake bill generator? (generic template, placeholder-like text, no real business identifiers)
6. VISUAL INTEGRITY (if image provided) - Does the document look like a real printed/digital bill? Check for screenshot-of-screenshot, phone photo of screen showing bill, cropped/stitched images, visible editing artifacts, watermarks from bill generator apps.

Return ONLY a JSON object (no markdown, no prose):
{
  "isGenuineBill": boolean,
  "confidence": number (0.0 to 1.0),
  "documentType": "INVOICE" | "RECEIPT" | "NOT_A_BILL" | "UNCLEAR",
  "concerns": ["short string describing each concern"]
}

Rules:
- confidence >= 0.8 with isGenuineBill=true means you are quite sure it is real
- confidence < 0.5 with isGenuineBill=false means you are quite sure it is fake/irrelevant
- When uncertain, set confidence between 0.4-0.7 and isGenuineBill=false
- Be strict: a document missing both merchant identifier AND date is suspicious
- A document with no line items AND no total amount is NOT a bill`;

export const CATEGORY_MATCH_PROMPT = `You are a bill category validator for an employee tax benefits platform. You will receive a parsed bill (merchant info + line items) and raw OCR text. Your job is to determine whether the bill legitimately belongs to the claimed benefit category.

Rules per benefit category:
FOOD_ALLOWANCE:
- VALID: Bill contains edible and drinkable items (meals, groceries, snacks, beverages)
- INVALID items: Alcoholic beverages (beer, wine, whisky, vodka, rum, cocktails, spirits, liquor, any alcoholic drink). Flag each alcoholic item individually in invalidItems.
- If bill has a mix of food + alcohol, return PARTIALLY_VALID with alcohol items listed

PHONE_INTERNET:
- VALID: Prepaid/postpaid mobile recharge, mobile phone bill, broadband bill, internet/ISP bill, WiFi subscription, data pack
- INVALID: Device purchases, accessories, electronics

FUEL:
- VALID: Petrol, diesel, CNG, fuel for vehicle
- INVALID: Lubricants, car wash, vehicle accessories, convenience store purchases at fuel stations

HEALTH_AND_FITNESS:
- VALID: Gym membership, fitness subscription, sports activity booking (badminton, swimming, tennis, cricket, etc.), yoga classes, fitness classes
- INVALID: Medicines, medications, medical equipment, health checkups, doctor consultations, hospital bills, physiotherapy, diagnostic tests, pharmacy purchases

UNIFORM:
- VALID: Any apparel, clothing, footwear, garments purchase

BOOKS_AND_PERIODICALS:
- VALID: Books, magazines, newspapers, journals, e-book subscriptions, periodical subscriptions
- INVALID: Stationery, office supplies, electronics

CHILDREN_EDUCATION:
- VALID: School/college tuition fees, education institution fees, coaching/tuition class fees

PROFESSIONAL_DEVELOPMENT:
- VALID: Courses, certifications, training programs, workshops, conference fees, skill development programs
- INVALID: General subscriptions unrelated to professional growth

BUSINESS_TRAVEL:
- VALID: Flight tickets, train tickets, hotel stays, cab/taxi for business travel
- INVALID: Personal travel, leisure bookings, vacation packages

HOSTEL_EXPENDITURE:
- VALID: Hostel fees, PG accommodation rent, mess charges
- INVALID: General rent, home expenses

DRIVERS_SALARY:
- VALID: Salary payment to a personal/household driver
- INVALID: Cab/taxi service bills, ride-hailing app bills

VEHICLE_MAINTENANCE:
- VALID: Vehicle servicing, repair, spare parts, maintenance bills
- INVALID: Fuel, car wash, accessories, modifications

GIFT:
- VALID: Gift item purchases
- INVALID: Personal regular shopping disguised as gifts

Return ONLY a JSON object (no markdown, no prose):
{
  "result": "VALID" | "INVALID" | "PARTIALLY_VALID",
  "reason": "brief explanation of why the bill does or does not match",
  "invalidItems": ["item1", "item2"]
}

Rules:
- invalidItems should only contain specific item names from the bill that don't belong
- invalidItems should be empty for VALID and INVALID results
- PARTIALLY_VALID means the bill mostly belongs but has some items that don't qualify
- When unsure whether an item belongs, lean towards VALID - let manual review catch edge cases
- Look at both the line items AND the merchant name/type to make your judgment`;

export const CATEGORY_TO_PROMPT_LABEL: Record<string, string> = {
  food: "FOOD_ALLOWANCE",
  phone_internet: "PHONE_INTERNET",
  fuel: "FUEL",
  health_and_fitness: "HEALTH_AND_FITNESS",
  uniform: "UNIFORM",
  books: "BOOKS_AND_PERIODICALS",
  education: "CHILDREN_EDUCATION",
  professional_development: "PROFESSIONAL_DEVELOPMENT",
  business_travel: "BUSINESS_TRAVEL",
  hostel: "HOSTEL_EXPENDITURE",
  drivers_salary: "DRIVERS_SALARY",
  vehicle_maintenance: "VEHICLE_MAINTENANCE",
  gift: "GIFT",
};
