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

export const DOCUMENT_AUTHENTICITY_PROMPT = `You are a document fraud analyst for an employee expense reimbursement platform in India. You will receive OCR text extracted from an uploaded document (typically a UPI payment screenshot, food delivery receipt, fuel slip, telecom bill, or similar expense proof). Determine whether this is a GENUINE payment proof or bill.

Context: Employees upload screenshots from apps like Zomato, Swiggy, Uber, Ola, PhonePe, Google Pay, Paytm, IRCTC, MakeMyTrip, Airtel, Jio, petrol stations, gyms, etc. A valid proof does NOT need itemized line items — a UPI payment confirmation with merchant name, amount, date, and UTR/reference number is sufficient.

Evaluate these dimensions:
1. DOCUMENT TYPE — Is this a payment confirmation, app receipt, tax invoice, or fuel slip? Or is it something entirely unrelated (chat screenshot, random photo, meme, blank page)?
2. COMPLETENESS — Does it have the minimum elements for a valid expense proof?
   - Payment confirmation needs: merchant/payee name, amount, date, transaction reference (UTR/UPI ID/order ID)
   - Tax invoice needs: merchant name, date, amount, at least one line item or service description
3. COHERENCE — Is the amount consistent with the merchant type? (₹500 at a petrol pump is plausible; ₹50,000 at a restaurant is suspicious)
4. TAMPERING SIGNALS — Look for: amount or date that looks edited, mismatched fonts in key fields, suspicious alignment of numbers, round numbers like ₹10000 with no paise where the app always shows paise
5. TEMPLATE/FAKE SIGNALS — Generic placeholder text, fake bill generator watermarks, obviously copy-pasted layout, missing app UI elements that are always present (like app logo, reference IDs, UPI handles)
6. VISUAL INTEGRITY (if image provided) — Screenshot-of-screenshot artifacts, phone photographed from a screen, visible editing, watermarks, cropped/stitched content

Return ONLY a JSON object (no markdown, no prose):
{
  "isGenuineBill": boolean,
  "confidence": number (0.0 to 1.0),
  "documentType": "INVOICE" | "RECEIPT" | "NOT_A_BILL" | "UNCLEAR",
  "concerns": ["concise specific concern about THIS document"]
}

Rules:
- UPI payment confirmation IS a valid receipt — do not penalize for lack of itemized list
- confidence >= 0.8 with isGenuineBill=true → you are quite confident it is real
- confidence < 0.5 with isGenuineBill=false → you are quite confident it is fake/irrelevant
- confidence 0.5–0.79 → uncertain, set isGenuineBill based on balance of evidence
- concerns must be specific to what you actually see in the text — do not list generic warnings
- If no OCR text is provided, set confidence=0.4 and documentType="UNCLEAR"
- A document with ONLY a merchant name and amount (no date, no reference) is suspicious but not definitively fake`;

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
