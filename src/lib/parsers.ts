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

export function parseMerchant(text: string): string | null {
  const patterns = [
    /Paid\s+to\s+([A-Za-z][A-Za-z0-9\s&.'()-]{2,60})/,
    /To\s*:\s*([A-Za-z][A-Za-z0-9\s&.'()-]{2,60})/,
    /Sent\s+to\s+([A-Za-z][A-Za-z0-9\s&.'()-]{2,60})/,
    /Merchant\s*:?\s*([A-Za-z][A-Za-z0-9\s&.'()-]{2,60})/i,
    /Recipient\s*:?\s*([A-Za-z][A-Za-z0-9\s&.'()-]{2,60})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      return m[1].trim().split("\n")[0].replace(/\s+/g, " ").trim();
    }
  }
  return null;
}

export function parseDate(text: string): string | null {
  const months = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
  const patterns = [
    new RegExp(`(\\d{1,2})\\s+(${months})[a-z]*\\s+(\\d{4})`, "i"),
    new RegExp(`(${months})[a-z]*\\s+(\\d{1,2}),?\\s+(\\d{4})`, "i"),
    /(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/,
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const d = new Date(m[0]);
      if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100) {
        return d.toISOString();
      }
    }
  }
  return null;
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
