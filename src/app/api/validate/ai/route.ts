import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  BillValidationType,
  VALIDATION_TIERS,
  DOCUMENT_AUTHENTICITY_PROMPT,
  CATEGORY_MATCH_PROMPT,
  CATEGORY_TO_PROMPT_LABEL,
  type DocumentAuthenticityResult,
  type CategoryMatchResult,
  type ValidationCheckResult,
} from "@/lib/billValidation";

export const runtime = "nodejs";

type AiValidateRequest = {
  ocrText: string;
  category: string;
  merchantName?: string;
  amount?: string;
  date?: string;
  lineItems?: string[];
  receiptCount?: number;
};

type AiValidateResponse = {
  checks: ValidationCheckResult[];
  error?: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function parseJsonFromResponse(text: string): unknown {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON object found in response");
  return JSON.parse(jsonMatch[0]);
}

async function runDocumentAuthenticity(
  client: Anthropic,
  ocrText: string,
  imageBase64?: string,
  imageMediaType?: string,
): Promise<DocumentAuthenticityResult> {
  const userContent: Anthropic.MessageParam["content"] = [];

  if (imageBase64 && imageMediaType && ALLOWED_IMAGE_TYPES.has(imageMediaType)) {
    userContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: imageMediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: imageBase64,
      },
    });
  }

  userContent.push({
    type: "text",
    text: `OCR text extracted from the uploaded expense proof:\n\n${ocrText || "(no OCR text available — document could not be read)"}`,
  });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: DOCUMENT_AUTHENTICITY_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const responseText = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");

  const parsed = parseJsonFromResponse(responseText) as DocumentAuthenticityResult;
  return {
    isGenuineBill: Boolean(parsed.isGenuineBill),
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.5))),
    documentType: parsed.documentType ?? "UNCLEAR",
    concerns: Array.isArray(parsed.concerns) ? parsed.concerns.slice(0, 6) : [],
  };
}

async function runCategoryMatch(
  client: Anthropic,
  ocrText: string,
  category: string,
  merchantName?: string,
  lineItems?: string[],
): Promise<CategoryMatchResult> {
  const categoryLabel = CATEGORY_TO_PROMPT_LABEL[category] ?? category.toUpperCase();
  const itemList = lineItems?.filter(Boolean).length
    ? lineItems.join(", ")
    : "(line items not available)";

  const userMessage = [
    `Claimed benefit category: ${categoryLabel}`,
    `Merchant / payee name: ${merchantName || "(not provided)"}`,
    `Expense description(s): ${itemList}`,
    "",
    "Full OCR text from the uploaded expense proof:",
    ocrText || "(no OCR text available)",
  ].join("\n");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: CATEGORY_MATCH_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const responseText = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");

  const parsed = parseJsonFromResponse(responseText) as CategoryMatchResult;
  return {
    result: parsed.result ?? "INVALID",
    reason: String(parsed.reason ?? ""),
    invalidItems: Array.isArray(parsed.invalidItems) ? parsed.invalidItems : [],
  };
}

// ── Heuristic helpers ──────────────────────────────────────────────────────────

function extractNumber(text: string, pattern: RegExp): number | null {
  const m = text.match(pattern);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

function hasTxnRef(ocrText: string): boolean {
  return /\b(?:utr|upi|ref|txn|order|transaction|receipt|invoice|bill)\s*[:#\s]?\s*[a-z0-9]{6,}/i.test(
    ocrText,
  );
}

function hasDate(ocrText: string): boolean {
  return /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/i.test(
    ocrText,
  );
}

function hasAmount(ocrText: string): boolean {
  return /(?:₹|rs\.?|inr)\s*[\d,]+(?:\.\d{1,2})?|\b[\d,]+(?:\.\d{2})?\s*(?:₹|rs\.?|inr)\b/i.test(
    ocrText,
  );
}

function merchantFoundInOcr(merchantName: string, ocrText: string): boolean {
  if (!merchantName || !ocrText) return false;
  const normalized = ocrText.toLowerCase();
  // Try progressively shorter prefixes of the merchant name
  const words = merchantName.toLowerCase().split(/\s+/);
  // Match if the longest word (≥4 chars) from the merchant name appears in OCR
  return words.some((w) => w.length >= 4 && normalized.includes(w));
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured. Add it to .env.local." },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });
  const checks: ValidationCheckResult[] = [];

  let body: AiValidateRequest;
  let imageBase64: string | undefined;
  let imageMediaType: string | undefined;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const meta = form.get("meta");

    if (meta && typeof meta === "string") {
      body = JSON.parse(meta) as AiValidateRequest;
    } else {
      body = {
        ocrText: String(form.get("ocrText") ?? ""),
        category: String(form.get("category") ?? "food"),
        merchantName: form.get("merchantName") ? String(form.get("merchantName")) : undefined,
        amount: form.get("amount") ? String(form.get("amount")) : undefined,
        date: form.get("date") ? String(form.get("date")) : undefined,
      };
    }

    if (file instanceof Blob && file.size <= MAX_FILE_SIZE && ALLOWED_IMAGE_TYPES.has(file.type)) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      imageBase64 = Buffer.from(bytes).toString("base64");
      imageMediaType = file.type;
    }
  } else {
    body = (await req.json()) as AiValidateRequest;
  }

  const { ocrText, category, merchantName, amount, date, lineItems } = body;
  const amountNum = amount ? Number(amount) : 0;
  const hasOcrText = Boolean(ocrText?.trim());

  // Run AI checks concurrently
  const [authResult, matchResult] = await Promise.allSettled([
    runDocumentAuthenticity(client, ocrText, imageBase64, imageMediaType),
    runCategoryMatch(client, ocrText, category, merchantName, lineItems),
  ]);

  // ── TIER 1: DOCUMENT_AUTHENTICITY ────────────────────────────────────────────
  if (authResult.status === "fulfilled") {
    const d = authResult.value;
    checks.push({
      type: BillValidationType.DOCUMENT_AUTHENTICITY,
      tier: VALIDATION_TIERS[BillValidationType.DOCUMENT_AUTHENTICITY],
      passed: d.isGenuineBill && d.confidence >= 0.5,
      data: d,
    });
  } else {
    checks.push({
      type: BillValidationType.DOCUMENT_AUTHENTICITY,
      tier: VALIDATION_TIERS[BillValidationType.DOCUMENT_AUTHENTICITY],
      passed: false,
      details: authResult.reason instanceof Error ? authResult.reason.message : "Check failed",
    });
  }

  // ── TIER 1: BENEFIT_CATEGORY_MATCH ───────────────────────────────────────────
  if (matchResult.status === "fulfilled") {
    const m = matchResult.value;
    checks.push({
      type: BillValidationType.BENEFIT_CATEGORY_MATCH,
      tier: VALIDATION_TIERS[BillValidationType.BENEFIT_CATEGORY_MATCH],
      passed: m.result !== "INVALID",
      data: m,
    });
  } else {
    checks.push({
      type: BillValidationType.BENEFIT_CATEGORY_MATCH,
      tier: VALIDATION_TIERS[BillValidationType.BENEFIT_CATEGORY_MATCH],
      passed: false,
      details: matchResult.reason instanceof Error ? matchResult.reason.message : "Check failed",
    });
  }

  // ── TIER 1: BILL_DATE ────────────────────────────────────────────────────────
  const dateInInvoice = Boolean(date?.trim());
  const dateInOcr = hasOcrText && hasDate(ocrText);
  const datePassed = dateInInvoice;
  let billDateDetails: string;
  if (!datePassed) {
    billDateDetails = "Bill date is missing — add the transaction date";
  } else if (dateInOcr) {
    billDateDetails = `Date recorded: ${date} — confirmed in OCR text`;
  } else if (hasOcrText) {
    billDateDetails = `Date recorded: ${date} — not found in OCR text, verify date against the original proof`;
  } else {
    billDateDetails = `Date recorded: ${date} — no OCR text available to cross-check`;
  }
  checks.push({
    type: BillValidationType.BILL_DATE,
    tier: VALIDATION_TIERS[BillValidationType.BILL_DATE],
    passed: datePassed,
    details: billDateDetails,
  });

  // ── TIER 2: BILL_COMPLETENESS ────────────────────────────────────────────────
  const hasMerchant = Boolean(merchantName?.trim());
  const hasAmountVal = amountNum > 0;
  const hasRef = hasOcrText && hasTxnRef(ocrText);
  const hasAmtInOcr = hasOcrText && hasAmount(ocrText);

  const completenessItems = [
    { label: "merchant name", ok: hasMerchant },
    { label: "amount", ok: hasAmountVal },
    { label: "date", ok: dateInInvoice },
    { label: "transaction reference in OCR", ok: hasRef },
    { label: "amount in OCR", ok: hasAmtInOcr },
  ];
  const completenessScore = completenessItems.filter((i) => i.ok).length;
  const completenessPassed = hasMerchant && hasAmountVal && dateInInvoice;
  const missing = completenessItems.filter((i) => !i.ok).map((i) => i.label);

  checks.push({
    type: BillValidationType.BILL_COMPLETENESS,
    tier: VALIDATION_TIERS[BillValidationType.BILL_COMPLETENESS],
    passed: completenessPassed,
    details: completenessPassed
      ? `${completenessScore}/5 fields present${hasRef ? " including transaction reference" : " — transaction reference not detected in OCR"}`
      : `Missing required fields: ${missing.slice(0, 3).join(", ")}`,
  });

  // ── TIER 2: AMOUNT_MATCH ─────────────────────────────────────────────────────
  let amountMatchDetails: string;
  let amountMatchPassed: boolean;

  if (!hasAmountVal) {
    amountMatchPassed = false;
    amountMatchDetails = "Claim amount is missing or zero";
  } else if (hasAmtInOcr) {
    // Try to extract amount from OCR and compare
    const ocrAmount = extractNumber(
      ocrText,
      /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i,
    ) ?? extractNumber(ocrText, /([\d,]+(?:\.\d{2}))\s*(?:₹|rs\.?|inr)/i);

    if (ocrAmount !== null) {
      const diff = Math.abs(ocrAmount - amountNum);
      const pct = (diff / amountNum) * 100;
      amountMatchPassed = pct <= 5; // allow 5% rounding tolerance
      amountMatchDetails = amountMatchPassed
        ? `Claim ₹${amountNum} matches OCR amount ₹${ocrAmount}`
        : `Claim ₹${amountNum} differs from OCR amount ₹${ocrAmount} (${pct.toFixed(1)}% difference)`;
    } else {
      amountMatchPassed = true;
      amountMatchDetails = `Claim amount ₹${amountNum} — could not parse exact figure from OCR for comparison`;
    }
  } else {
    amountMatchPassed = true;
    amountMatchDetails = `Claim amount ₹${amountNum} — no amount pattern found in OCR text to cross-check`;
  }

  checks.push({
    type: BillValidationType.AMOUNT_MATCH,
    tier: VALIDATION_TIERS[BillValidationType.AMOUNT_MATCH],
    passed: amountMatchPassed,
    details: amountMatchDetails,
  });

  // ── TIER 2: TAX_SANITY ───────────────────────────────────────────────────────
  const taxAmount =
    extractNumber(ocrText, /(?:cgst|sgst|igst|gst|tax)\s*(?:@[\d.]+%\s*)?[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/i);
  const totalAmount =
    extractNumber(ocrText, /(?:grand\s*total|total\s*amount|total|amount\s*paid)[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/i) ??
    amountNum;

  let taxSanityPassed = true;
  let taxSanityDetails: string;

  if (taxAmount !== null && totalAmount > 0) {
    const taxPct = (taxAmount / totalAmount) * 100;
    if (taxPct > 40) {
      taxSanityPassed = false;
      taxSanityDetails = `Tax ₹${taxAmount} is ${taxPct.toFixed(1)}% of total ₹${totalAmount} — unusually high (max expected ~28%)`;
    } else if (taxPct > 0) {
      taxSanityDetails = `Tax ₹${taxAmount} (${taxPct.toFixed(1)}% of ₹${totalAmount}) — within expected range`;
    } else {
      taxSanityDetails = `Tax figure found in OCR but appears to be zero — consistent with zero-rated category`;
    }
  } else {
    taxSanityDetails = "No tax breakdown detected in OCR — not required for UPI payment proofs";
  }

  checks.push({
    type: BillValidationType.TAX_SANITY,
    tier: VALIDATION_TIERS[BillValidationType.TAX_SANITY],
    passed: taxSanityPassed,
    details: taxSanityDetails,
  });

  // ── TIER 2: DUPLICATE_BILL ───────────────────────────────────────────────────
  checks.push({
    type: BillValidationType.DUPLICATE_BILL,
    tier: VALIDATION_TIERS[BillValidationType.DUPLICATE_BILL],
    passed: true,
    details:
      "Duplicate check requires cross-claim database — verify manually: same merchant + amount + date combination submitted before?",
  });

  // ── TIER 3: AMOUNT_REASONABLENESS ────────────────────────────────────────────
  const CATEGORY_MAX: Record<string, number> = {
    food: 5000,
    fuel: 10000,
    phone_internet: 3000,
    health_and_fitness: 15000,
    business_travel: 100000,
    education: 200000,
    professional_development: 50000,
    hostel: 30000,
    drivers_salary: 30000,
    vehicle_maintenance: 50000,
    books: 10000,
    uniform: 20000,
    gift: 10000,
  };
  const categoryMax = CATEGORY_MAX[category] ?? 500000;
  const isReasonable = amountNum > 0 && amountNum <= categoryMax;
  checks.push({
    type: BillValidationType.AMOUNT_REASONABLENESS,
    tier: VALIDATION_TIERS[BillValidationType.AMOUNT_REASONABLENESS],
    passed: isReasonable,
    details: isReasonable
      ? `₹${amountNum.toLocaleString("en-IN")} is within the typical range for ${category.replace(/_/g, " ")} (up to ₹${categoryMax.toLocaleString("en-IN")})`
      : `₹${amountNum.toLocaleString("en-IN")} exceeds the typical single-claim limit for ${category.replace(/_/g, " ")} (₹${categoryMax.toLocaleString("en-IN")}) — may need additional approval`,
  });

  // ── TIER 4: MERCHANT_MATCH ───────────────────────────────────────────────────
  const merchantFound = hasOcrText && merchantName ? merchantFoundInOcr(merchantName, ocrText) : null;
  checks.push({
    type: BillValidationType.MERCHANT_MATCH,
    tier: VALIDATION_TIERS[BillValidationType.MERCHANT_MATCH],
    passed: merchantFound !== false,
    details: !merchantName
      ? "No merchant name provided to cross-check against OCR"
      : !hasOcrText
        ? "No OCR text available to check merchant name against"
        : merchantFound
          ? `"${merchantName}" found in OCR text`
          : `"${merchantName}" not found in OCR text — verify the merchant name matches the uploaded proof`,
  });

  const response: AiValidateResponse = { checks };
  return NextResponse.json(response);
}
