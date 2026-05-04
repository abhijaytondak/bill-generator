import { createWorker } from "tesseract.js";
import { parseAmount, parseDate, parseMerchant, parseTime, parseTxnId, detectPaymentMethod } from "./parsers";
import type { ExtractedData } from "./types";
import { inferCategoryFromText, inferPlatformFromText } from "./categoryRules";

export async function extractFromImage(
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
      amount: parseAmount(text),
      merchantName: parseMerchant(text),
      suggestedCategory,
      platformName: inferPlatformFromText(text, suggestedCategory),
      date: parseDate(text) ?? new Date().toISOString(),
      time: parseTime(text),
      txnId: parseTxnId(text),
      paymentMethod: detectPaymentMethod(text),
      rawText: text,
    };
  } finally {
    await worker.terminate();
  }
}
