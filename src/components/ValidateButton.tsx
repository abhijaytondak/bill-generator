"use client";

import { pdf } from "@react-pdf/renderer";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import type { Invoice } from "@/lib/types";
import { InvoicePDF } from "./InvoicePDF";

type Field = { type: string; value: string | null; confidence: number | null };
type ValidateResponse = {
  ok: boolean;
  fields?: Field[];
  lineItems?: Array<Record<string, string>>;
  missing?: string[];
  warnings?: string[];
  error?: string;
};

export default function ValidateButton({ invoice }: { invoice: Invoice }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidateResponse | null>(null);
  const [open, setOpen] = useState(false);

  const run = async () => {
    setLoading(true);
    setResult(null);
    setOpen(true);
    try {
      const blob = await pdf(<InvoicePDF invoice={invoice} />).toBlob();
      const form = new FormData();
      form.append("file", blob, "invoice.pdf");
      const res = await fetch("/api/validate", { method: "POST", body: form });
      const json: ValidateResponse = await res.json();
      setResult(json);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-neutral-300 text-sm hover:bg-neutral-50 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ShieldCheck className="w-4 h-4" />
        )}
        Test with AWS OCR
      </button>

      {open && (result || loading) ? (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between">
              <div className="font-semibold">AWS Textract validation</div>
              <button
                onClick={() => setOpen(false)}
                className="text-neutral-500 hover:text-black text-sm"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {loading ? (
                <div className="text-center py-10 text-neutral-500">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin" />
                  <div className="mt-3 text-sm">Running AnalyzeExpense...</div>
                </div>
              ) : result?.error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {result.error}
                </div>
              ) : result ? (
                <ValidateResult result={result} />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ValidateResult({ result }: { result: ValidateResponse }) {
  return (
    <div className="space-y-4 text-sm">
      <div
        className={`flex items-center gap-2 rounded-lg p-3 ${result.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-amber-50 border border-amber-200 text-amber-800"}`}
      >
        {result.ok ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <XCircle className="w-5 h-5" />
        )}
        <div>
          {result.ok
            ? "All expected fields were detected by AWS Textract."
            : `Textract missed: ${result.missing?.join(", ")}`}
        </div>
      </div>

      {result.warnings && result.warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
          {result.warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      ) : null}

      <div>
        <div className="text-xs font-medium text-neutral-500 uppercase mb-2">
          Detected fields
        </div>
        <div className="rounded-lg border border-neutral-200 divide-y divide-neutral-100">
          {result.fields && result.fields.length > 0 ? (
            result.fields.map((f, i) => (
              <div key={i} className="flex justify-between gap-3 px-3 py-1.5">
                <div className="text-neutral-500 text-xs">{f.type}</div>
                <div className="text-right">
                  <div className="font-mono">{f.value || "-"}</div>
                  {f.confidence ? (
                    <div className="text-[10px] text-neutral-400">
                      {f.confidence.toFixed(1)}%
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="px-3 py-3 text-neutral-500">No fields returned.</div>
          )}
        </div>
      </div>

      {result.lineItems && result.lineItems.length > 0 ? (
        <div>
          <div className="text-xs font-medium text-neutral-500 uppercase mb-2">
            Line items
          </div>
          <div className="rounded-lg border border-neutral-200 divide-y divide-neutral-100">
            {result.lineItems.map((li, i) => (
              <div key={i} className="px-3 py-2">
                {Object.entries(li).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-neutral-500">{k}</span>
                    <span className="font-mono">{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
