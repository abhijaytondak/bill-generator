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
    text: `Raw OCR text of the document:\n\n${ocrText || "(no OCR text available)"}`,
  });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
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
    confidence: Number(parsed.confidence ?? 0.5),
    documentType: parsed.documentType ?? "UNCLEAR",
    concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
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
  const itemList = lineItems?.length ? lineItems.join(", ") : "(not available)";

  const userMessage = [
    `Claimed benefit category: ${categoryLabel}`,
    `Merchant name: ${merchantName || "(not available)"}`,
    `Line items: ${itemList}`,
    ``,
    `Raw OCR text:`,
    ocrText || "(no OCR text available)",
  ].join("\n");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
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

  // --- TIER 1: DOCUMENT_AUTHENTICITY ---
  try {
    const authResult = await runDocumentAuthenticity(client, ocrText, imageBase64, imageMediaType);
    checks.push({
      type: BillValidationType.DOCUMENT_AUTHENTICITY,
      tier: VALIDATION_TIERS[BillValidationType.DOCUMENT_AUTHENTICITY],
      passed: authResult.isGenuineBill && authResult.confidence >= 0.5,
      data: authResult,
    });
  } catch (e) {
    checks.push({
      type: BillValidationType.DOCUMENT_AUTHENTICITY,
      tier: VALIDATION_TIERS[BillValidationType.DOCUMENT_AUTHENTICITY],
      passed: false,
      details: e instanceof Error ? e.message : "Document authenticity check failed",
    });
  }

  // --- TIER 1: BENEFIT_CATEGORY_MATCH ---
  try {
    const matchResult = await runCategoryMatch(client, ocrText, category, merchantName, lineItems);
    checks.push({
      type: BillValidationType.BENEFIT_CATEGORY_MATCH,
      tier: VALIDATION_TIERS[BillValidationType.BENEFIT_CATEGORY_MATCH],
      passed: matchResult.result !== "INVALID",
      data: matchResult,
    });
  } catch (e) {
    checks.push({
      type: BillValidationType.BENEFIT_CATEGORY_MATCH,
      tier: VALIDATION_TIERS[BillValidationType.BENEFIT_CATEGORY_MATCH],
      passed: false,
      details: e instanceof Error ? e.message : "Category match check failed",
    });
  }

  // --- TIER 1: BILL_DATE ---
  checks.push({
    type: BillValidationType.BILL_DATE,
    tier: VALIDATION_TIERS[BillValidationType.BILL_DATE],
    passed: Boolean(date?.trim()),
    details: date?.trim() ? `Bill date: ${date}` : "Bill date is missing",
  });

  // --- TIER 2: BILL_COMPLETENESS ---
  const hasOcr = Boolean(ocrText?.trim());
  const hasMerchant = Boolean(merchantName?.trim());
  const hasAmount = Boolean(amount && Number(amount) > 0);
  const completenessScore = [hasOcr, hasMerchant, hasAmount, Boolean(date?.trim())].filter(Boolean).length;
  checks.push({
    type: BillValidationType.BILL_COMPLETENESS,
    tier: VALIDATION_TIERS[BillValidationType.BILL_COMPLETENESS],
    passed: completenessScore >= 3,
    details: completenessScore >= 3
      ? "Bill has merchant, amount, and date"
      : `Missing: ${[!hasMerchant && "merchant", !hasAmount && "amount", !date?.trim() && "date"].filter(Boolean).join(", ")}`,
  });

  // --- TIER 2: AMOUNT_MATCH ---
  checks.push({
    type: BillValidationType.AMOUNT_MATCH,
    tier: VALIDATION_TIERS[BillValidationType.AMOUNT_MATCH],
    passed: hasAmount,
    details: hasAmount ? `Amount: ₹${amount}` : "Amount is missing or zero",
  });

  // --- TIER 2: TAX_SANITY ---
  const taxPattern = /(?:gst|cgst|sgst|igst|tax)[^\d]*(\d+(?:\.\d+)?)/i;
  const totalPattern = /(?:total|grand total|amount)[^\d]*(\d+(?:\.\d+)?)/i;
  const taxMatch = ocrText?.match(taxPattern);
  const totalMatch = ocrText?.match(totalPattern);
  let taxSanityPassed = true;
  let taxSanityDetails = "Tax figures not found in OCR text (skipped)";
  if (taxMatch && totalMatch) {
    const tax = parseFloat(taxMatch[1]);
    const total = parseFloat(totalMatch[1]);
    const taxRatio = total > 0 ? tax / total : 0;
    taxSanityPassed = taxRatio <= 0.4;
    taxSanityDetails = taxSanityPassed
      ? `Tax ₹${tax} on total ₹${total} (${(taxRatio * 100).toFixed(1)}%)`
      : `Tax ₹${tax} is unusually high relative to total ₹${total}`;
  }
  checks.push({
    type: BillValidationType.TAX_SANITY,
    tier: VALIDATION_TIERS[BillValidationType.TAX_SANITY],
    passed: taxSanityPassed,
    details: taxSanityDetails,
  });

  // --- TIER 2: DUPLICATE_BILL ---
  checks.push({
    type: BillValidationType.DUPLICATE_BILL,
    tier: VALIDATION_TIERS[BillValidationType.DUPLICATE_BILL],
    passed: true,
    details: "Duplicate detection requires cross-bill database (not available in this check)",
  });

  // --- TIER 3: AMOUNT_REASONABLENESS ---
  const amountNum = amount ? Number(amount) : 0;
  const isReasonable = amountNum > 0 && amountNum <= 500000;
  checks.push({
    type: BillValidationType.AMOUNT_REASONABLENESS,
    tier: VALIDATION_TIERS[BillValidationType.AMOUNT_REASONABLENESS],
    passed: isReasonable,
    details: isReasonable ? `₹${amountNum} is within expected range` : `₹${amountNum} is outside expected range (0–5,00,000)`,
  });

  // --- TIER 4: MERCHANT_MATCH ---
  const merchantInOcr = merchantName
    ? ocrText?.toLowerCase().includes(merchantName.toLowerCase().slice(0, 5))
    : false;
  checks.push({
    type: BillValidationType.MERCHANT_MATCH,
    tier: VALIDATION_TIERS[BillValidationType.MERCHANT_MATCH],
    passed: !merchantName || merchantInOcr,
    details: merchantName
      ? merchantInOcr
        ? `Merchant "${merchantName}" found in OCR text`
        : `Merchant "${merchantName}" not found in OCR text`
      : "No merchant name provided",
  });

  const response: AiValidateResponse = { checks };
  return NextResponse.json(response);
}
