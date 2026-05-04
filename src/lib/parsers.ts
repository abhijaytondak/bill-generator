export function parseAmount(text: string): number | null {
  const patterns = [
    /₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/,
    /Rs\.?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /INR\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /Amount\s*:?\s*₹?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /Paid\s+[₹Rs\.]*\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  ];
  let best: number | null = null;
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const val = parseFloat(m[1].replace(/,/g, ""));
      if (!isNaN(val) && val > 0 && val < 10_000_000) {
        if (best === null || val > best) best = val;
      }
    }
  }
  return best;
}

const APP_NAMES = new Set([
  "phonepe", "paytm", "gpay", "google pay", "googlepay", "bhim",
  "amazon pay", "amazonpay", "cred", "razorpay", "mobikwik",
]);

const NOISE_LINE_PATTERNS: RegExp[] = [
  /^(paid|sent|received|transaction|payment)\b/i,
  /^(on|via|using|from|at|status|date|time)\b/i,
  /^(success|successful|completed|pending|failed)\b/i,
  /^(₹|Rs\.?|INR)\s*[0-9]/i,
  /^[\+\d][\d\s\-()]{7,}$/,
  /@/,
  /\bUPI\s*(ID|Ref)/i,
  /\b(UTR|IFSC|Txn\s*ID|Order\s*ID|Ref(?:erence)?\s*(No|#))\b/i,
  /\b(bank|a\/c|account\s*number|savings|current)\b/i,
  /^[\W_]+$/,
];

function isNoisyLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 80) return true;
  if (APP_NAMES.has(t.toLowerCase())) return true;
  return NOISE_LINE_PATTERNS.some((p) => p.test(t));
}

function cleanMerchantName(raw: string): string | null {
  const cleaned = raw
    .split("\n")[0]
    .replace(/\s+/g, " ")
    .replace(/\s*(UPI\s*ID\s*:.*|xxxx.*|\*{2,}\s*\d+.*|\+?91[\s-]?\d{10}.*)$/i, "")
    .replace(/\s*[|·•]+.*$/, "")
    .replace(/\s+-\s*(verified|mobile|paytm|phonepe|gpay|google\s*pay|merchant|bank)\s*$/i, "")
    .trim();
  if (cleaned.length < 2 || cleaned.length > 60) return null;
  if (APP_NAMES.has(cleaned.toLowerCase())) return null;
  return cleaned;
}

export function parseMerchant(text: string): string | null {
  const explicitPatterns: RegExp[] = [
    /Paid\s+to\s+([A-Za-z][A-Za-z0-9\s&.'()-]{2,60})/i,
    /To\s*:\s*([A-Za-z][A-Za-z0-9\s&.'()-]{2,60})/i,
    /Sent\s+to\s+([A-Za-z][A-Za-z0-9\s&.'()-]{2,60})/i,
    /Merchant\s*:?\s*([A-Za-z][A-Za-z0-9\s&.'()-]{2,60})/i,
    /Recipient\s*:?\s*([A-Za-z][A-Za-z0-9\s&.'()-]{2,60})/i,
    /Payee(?:\s*name)?\s*:?\s*([A-Za-z][A-Za-z0-9\s&.'()-]{2,60})/i,
    /Beneficiary\s*:?\s*([A-Za-z][A-Za-z0-9\s&.'()-]{2,60})/i,
  ];
  for (const p of explicitPatterns) {
    const m = text.match(p);
    if (m) {
      const cleaned = cleanMerchantName(m[1]);
      if (cleaned) return cleaned;
    }
  }

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const amountLineIdx = lines.findIndex((l) =>
    /(?:₹|Rs\.?|INR)\s*[0-9,]+(?:\.[0-9]{1,2})?/i.test(l),
  );
  if (amountLineIdx > 0) {
    for (let i = amountLineIdx - 1; i >= Math.max(0, amountLineIdx - 4); i--) {
      const line = lines[i];
      if (isNoisyLine(line)) continue;
      if (/^[A-Z]/.test(line) && /[A-Za-z]{3,}/.test(line)) {
        const cleaned = cleanMerchantName(line);
        if (cleaned) return cleaned;
      }
    }
  }

  for (const line of lines.slice(0, 8)) {
    if (isNoisyLine(line)) continue;
    if (/^[A-Z]/.test(line) && /[A-Za-z]{3,}/.test(line)) {
      const cleaned = cleanMerchantName(line);
      if (cleaned) return cleaned;
    }
  }

  return null;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function buildDate(y: number, mZero: number, d: number): string | null {
  if (mZero < 0 || mZero > 11 || d < 1 || d > 31) return null;
  if (y < 100) y += y < 70 ? 2000 : 1900;
  if (y < 2000 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, mZero, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mZero || dt.getUTCDate() !== d) return null;
  return dt.toISOString();
}

export function parseDate(text: string): string | null {
  const months = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";

  const dMonY = new RegExp(`\\b(\\d{1,2})\\s+(${months})[a-z]*\\.?,?\\s+(\\d{2,4})\\b`, "i");
  const m1 = text.match(dMonY);
  if (m1) {
    const r = buildDate(parseInt(m1[3], 10), MONTH_MAP[m1[2].toLowerCase().slice(0, 3)], parseInt(m1[1], 10));
    if (r) return r;
  }

  const monDY = new RegExp(`\\b(${months})[a-z]*\\.?\\s+(\\d{1,2}),?\\s+(\\d{2,4})\\b`, "i");
  const m2 = text.match(monDY);
  if (m2) {
    const r = buildDate(parseInt(m2[3], 10), MONTH_MAP[m2[1].toLowerCase().slice(0, 3)], parseInt(m2[2], 10));
    if (r) return r;
  }

  const ymd = text.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (ymd) {
    const r = buildDate(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
    if (r) return r;
  }

  const numeric = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (numeric) {
    const a = parseInt(numeric[1], 10);
    const b = parseInt(numeric[2], 10);
    const y = parseInt(numeric[3], 10);
    const dmy = buildDate(y, b - 1, a);
    if (dmy) return dmy;
    const mdy = buildDate(y, a - 1, b);
    if (mdy) return mdy;
  }

  return null;
}

export function parseTime(text: string): string | null {
  const meridiem = text.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)\b/i);
  if (meridiem) {
    let hour = parseInt(meridiem[1], 10);
    const minute = parseInt(meridiem[2], 10);
    const ampm = meridiem[3].toUpperCase();
    if (hour < 1 || hour > 12 || minute > 59) return null;
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  const clock = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/);
  if (!clock) return null;
  return `${String(parseInt(clock[1], 10)).padStart(2, "0")}:${clock[2]}`;
}

export function parseTxnId(text: string): string | null {
  const patterns = [
    /UPI\s*(?:transaction\s*ID|Ref(?:erence)?\s*(?:No|#)?|ID)\s*:?\s*([A-Za-z0-9]{8,30})/i,
    /Transaction\s*(?:ID|#|Ref)\s*:?\s*([A-Za-z0-9]{8,30})/i,
    /UTR\s*:?\s*([A-Za-z0-9]{8,30})/i,
    /Ref(?:erence)?\s*(?:No|#)\s*:?\s*([A-Za-z0-9]{8,30})/i,
    /Order\s*ID\s*:?\s*([A-Za-z0-9]{8,30})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

export function detectPaymentMethod(text: string): "upi" | "card" | "unknown" {
  if (/UPI|PhonePe|Paytm|GPay|Google\s*Pay|BHIM|@ok(?:axis|hdfc|icici|sbi)/i.test(text)) return "upi";
  if (/\bcard\b|debit|credit|Visa|MasterCard|RuPay|\*\*\*\*\s*\d{4}/i.test(text)) return "card";
  return "unknown";
}
