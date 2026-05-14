import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are an expert OCR and receipt parsing assistant for an Indian expense management platform. You will receive a photo or screenshot of a payment receipt, bill, invoice, food delivery KOT, fuel slip, UPI payment confirmation, or similar expense document.

Your job is to:
1. Extract EVERY piece of text visible in the image, exactly as it appears (rawText)
2. Parse the key structured fields

For rawText: transcribe ALL text you can see — every line, number, label, reference, barcode text, footer, disclaimer, stamp, etc. Preserve line breaks. Do not summarize or skip any text.

For structured fields:
- merchantName: The store, restaurant, service provider, or payee name. For UPI payments, use the merchant/payee name (not the payment app name).
- amount: The final total amount paid as a number (no currency symbol, no commas). Use the grand total / total paid / amount debited.
- date: ISO 8601 date string like "2026-05-08T00:00:00.000Z". Extract from the bill date/transaction date.
- time: 24-hour time string like "19:16" if visible on the receipt.
- txnId: Transaction reference, UTR number, UPI reference, order ID, bill number, or any unique reference code.
- paymentMethod: "upi" if UPI/PhonePe/GPay/Paytm/BHIM, "card" if debit/credit card, "cash" if cash, "unknown" otherwise.
- suggestedCategory: Pick the best match from: food | fuel | phone_internet | health_and_fitness | uniform | books | education | professional_development | business_travel | hostel | drivers_salary | vehicle_maintenance | gift | mixed

Category hints:
- food: restaurants, food delivery (Zomato/Swiggy), groceries, cafes — but NOT alcohol-only bills
- fuel: petrol/diesel/CNG pumps
- phone_internet: telecom bills, mobile recharges, broadband
- health_and_fitness: gym, sports bookings, fitness apps (NOT pharmacies or hospitals)
- business_travel: flights, trains, hotels, cab bookings for work
- vehicle_maintenance: car/bike service, repair, spare parts
- professional_development: courses, certifications, conferences

Return ONLY a JSON object with no markdown, no prose, no explanation:
{
  "rawText": "full verbatim text from the image",
  "merchantName": "string or null",
  "amount": number or null,
  "date": "ISO string or null",
  "time": "HH:MM or null",
  "txnId": "string or null",
  "paymentMethod": "upi" | "card" | "cash" | "unknown",
  "suggestedCategory": "category string or null"
}`;

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const base64 = Buffer.from(bytes).toString("base64");
  const mediaType = file.type as "image/png" | "image/jpeg" | "image/webp" | "image/gif";

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: "Extract all text and parse the structured fields from this receipt/bill image.",
          },
        ],
      },
    ],
  });

  const responseText = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");

  // Strip markdown fences if model wraps in ```json
  const jsonStr = responseText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "Failed to parse OCR response" }, { status: 500 });
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return NextResponse.json({
    rawText: String(parsed.rawText ?? ""),
    merchantName: parsed.merchantName ?? null,
    amount: typeof parsed.amount === "number" ? parsed.amount : null,
    date: parsed.date ?? null,
    time: parsed.time ?? null,
    txnId: parsed.txnId ?? null,
    paymentMethod: parsed.paymentMethod ?? "unknown",
    suggestedCategory: parsed.suggestedCategory ?? null,
  });
}
