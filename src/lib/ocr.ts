import { createWorker } from "tesseract.js";
import { parseAmount, parseDate, parseMerchant, parseTime, parseTxnId, detectPaymentMethod } from "./parsers";
import type { ExtractedData } from "./types";
import { inferCategoryFromText, inferPlatformFromText } from "./categoryRules";

// ── Claude Vision OCR (primary) ───────────────────────────────────────────────

async function extractWithClaude(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<ExtractedData | null> {
  try {
    onProgress?.(10);
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/ocr", { method: "POST", body: form });
    if (!res.ok) return null;

    onProgress?.(80);
    const data = await res.json();

    if (!data.rawText) return null;

    const rawText: string = data.rawText;
    const suggestedCategory = data.suggestedCategory ?? inferCategoryFromText(rawText);

    onProgress?.(100);
    return {
      rawText,
      merchantName: data.merchantName ?? parseMerchant(rawText),
      amount: data.amount ?? parseAmount(rawText),
      date: data.date ?? parseDate(rawText) ?? new Date().toISOString(),
      time: data.time ?? parseTime(rawText),
      txnId: data.txnId ?? parseTxnId(rawText),
      paymentMethod: data.paymentMethod ?? detectPaymentMethod(rawText),
      suggestedCategory,
      platformName: inferPlatformFromText(rawText, suggestedCategory ?? undefined),
    };
  } catch {
    return null;
  }
}

// ── Tesseract fallback ────────────────────────────────────────────────────────

async function extractWithTesseract(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<ExtractedData> {
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(Math.round(m.progress * 100));
      }
    },
  });
  try {
    const { data } = await worker.recognize(file);
    const text = data.text || "";
    const suggestedCategory = inferCategoryFromText(text);
    return {
      rawText: text,
      amount: parseAmount(text),
      merchantName: parseMerchant(text),
      suggestedCategory,
      platformName: inferPlatformFromText(text, suggestedCategory ?? undefined),
      date: parseDate(text) ?? new Date().toISOString(),
      time: parseTime(text),
      txnId: parseTxnId(text),
      paymentMethod: detectPaymentMethod(text),
    };
  } finally {
    await worker.terminate();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function extractFromImage(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<ExtractedData> {
  // Try Claude Vision first — handles tilted photos, low-res, mixed languages
  const claudeResult = await extractWithClaude(file, onProgress);
  if (claudeResult) return claudeResult;

  // Tesseract fallback (no API key or network error)
  return extractWithTesseract(file, onProgress);
}
