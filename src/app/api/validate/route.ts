import { NextRequest, NextResponse } from "next/server";
import {
  TextractClient,
  AnalyzeExpenseCommand,
  ExpenseField,
} from "@aws-sdk/client-textract";

export const runtime = "nodejs";

type ExtractedField = {
  type: string;
  value: string | null;
  confidence: number | null;
};

type ValidateResponse = {
  ok: boolean;
  fields: ExtractedField[];
  lineItems: Array<Record<string, string>>;
  missing: string[];
  warnings: string[];
  rawText: string;
};

const EXPECTED_FIELDS = [
  "VENDOR_NAME",
  "INVOICE_RECEIPT_ID",
  "INVOICE_RECEIPT_DATE",
  "TOTAL",
  "SUBTOTAL",
  "TAX",
];

function fieldToJson(f: ExpenseField): ExtractedField {
  return {
    type: f.Type?.Text ?? "UNKNOWN",
    value: f.ValueDetection?.Text ?? null,
    confidence: f.ValueDetection?.Confidence ?? null,
  };
}

export async function POST(req: NextRequest) {
  const region = process.env.AWS_REGION || "us-east-1";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "AWS credentials not configured. Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to .env.local.",
      },
      { status: 400 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "No file uploaded" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  const client = new TextractClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    const res = await client.send(
      new AnalyzeExpenseCommand({ Document: { Bytes: bytes } }),
    );

    const fields: ExtractedField[] = [];
    const lineItems: Array<Record<string, string>> = [];
    let rawText = "";

    for (const doc of res.ExpenseDocuments ?? []) {
      for (const f of doc.SummaryFields ?? []) {
        fields.push(fieldToJson(f));
        if (f.ValueDetection?.Text) rawText += f.ValueDetection.Text + "\n";
      }
      for (const group of doc.LineItemGroups ?? []) {
        for (const li of group.LineItems ?? []) {
          const row: Record<string, string> = {};
          for (const f of li.LineItemExpenseFields ?? []) {
            const k = f.Type?.Text;
            const v = f.ValueDetection?.Text;
            if (k && v) row[k] = v;
          }
          if (Object.keys(row).length > 0) lineItems.push(row);
        }
      }
    }

    const presentTypes = new Set(fields.map((f) => f.type));
    const missing = EXPECTED_FIELDS.filter((t) => !presentTypes.has(t));

    const warnings: string[] = [];
    const total = fields.find((f) => f.type === "TOTAL")?.value;
    const subtotal = fields.find((f) => f.type === "SUBTOTAL")?.value;
    const tax = fields.find((f) => f.type === "TAX")?.value;
    if (total && subtotal && tax) {
      const n = (s: string) => parseFloat(s.replace(/[^\d.]/g, ""));
      const diff = Math.abs(n(total) - (n(subtotal) + n(tax)));
      if (diff > 0.05) {
        warnings.push(
          `Total (${total}) does not match Sub Total + Tax (${(n(subtotal) + n(tax)).toFixed(2)})`,
        );
      }
    }

    const response: ValidateResponse = {
      ok: missing.length === 0,
      fields,
      lineItems,
      missing,
      warnings,
      rawText: rawText.trim(),
    };
    return NextResponse.json(response);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Textract call failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
