import { createWorker } from "tesseract.js";
import { parseAmount, parseDate, parseMerchant, parseTime, parseTxnId, detectPaymentMethod } from "./parsers";
import type { ExtractedData } from "./types";

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
    return {
      amount: parseAmount(text),
      merchantName: parseMerchant(text),
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
