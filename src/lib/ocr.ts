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

// ── Image preprocessing for Tesseract ────────────────────────────────────────

// Dark-background screenshots (PhonePe, CRED, Google Pay night mode) confuse
// Tesseract which expects black-on-white. Invert if the image is mostly dark.
async function prepareForTesseract(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { URL.revokeObjectURL(url); resolve(file); return; }

        ctx.drawImage(img, 0, 0);
        const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Sample every 8th pixel for speed
        let brightness = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 32) {
          brightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
          count++;
        }
        brightness /= count;

        // Grayscale + binary threshold for clean Tesseract input
        const full = ctx.getImageData(0, 0, width, height);
        const d = full.data;
        for (let i = 0; i < d.length; i += 4) {
          let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          if (brightness < 100) gray = 255 - gray; // invert dark backgrounds
          gray = gray > 128 ? 255 : 0;             // hard threshold → pure B&W
          d[i] = d[i + 1] = d[i + 2] = gray;
        }
        ctx.putImageData(full, 0, 0);

        URL.revokeObjectURL(url);
        canvas.toBlob(
          (blob) => resolve(blob ? new File([blob], file.name, { type: "image/png" }) : file),
          "image/png",
        );
      } catch {
        URL.revokeObjectURL(url);
        resolve(file);
      }
    };

    img.src = url;
  });
}

// ── Tesseract fallback ────────────────────────────────────────────────────────

async function extractWithTesseract(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<ExtractedData> {
  const processed = await prepareForTesseract(file);
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(Math.round(m.progress * 100));
      }
    },
  });
  try {
    const { data } = await worker.recognize(processed);
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
