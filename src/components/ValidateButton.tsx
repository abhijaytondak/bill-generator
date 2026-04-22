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
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-white/20 text-[var(--cream-0)] text-sm hover:bg-white/10 disabled:opacity-60 transition-colors"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ShieldCheck className="w-4 h-4" />
        )}
        Validate
      </button>

      {open && (result || loading) ? (
        <div
          className="fixed inset-0 bg-[rgba(11,15,30,0.45)] backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="bg-[var(--cream-0)] rounded-[24px] max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-[rgba(11,15,30,0.08)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[rgba(11,15,30,0.08)] flex items-center justify-between">
              <div>
                <div className="eyebrow mb-0.5">AWS Textract</div>
                <div className="font-semibold tracking-tight">Validation result</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] text-sm px-2"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {loading ? (
                <div className="text-center py-10 text-[var(--ink-muted)]">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin" />
                  <div className="mt-3 text-sm">Running AnalyzeExpense...</div>
                </div>
              ) : result?.error ? (
                <div className="rounded-xl border border-[rgba(180,84,58,0.3)] bg-[rgba(246,217,192,0.4)] p-4 text-sm text-[var(--rust)]">
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
        className={`flex items-center gap-2 rounded-xl p-3.5 ${
          result.ok
            ? "bg-[var(--mint)] text-[var(--emerald)]"
            : "bg-[var(--peach)] text-[var(--rust)]"
        }`}
      >
        {result.ok ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
        <div className="font-medium">
          {result.ok
            ? "All expected fields were detected by AWS Textract."
            : `Textract missed: ${result.missing?.join(", ")}`}
        </div>
      </div>

      {result.warnings && result.warnings.length > 0 ? (
        <div className="rounded-xl bg-[var(--peach)] p-3.5 text-[var(--rust)]">
          {result.warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      ) : null}

      <div>
        <div className="eyebrow mb-2">Detected fields</div>
        <div className="rounded-xl border border-[rgba(11,15,30,0.08)] divide-y divide-[rgba(11,15,30,0.06)] bg-[#FBF9F4]">
          {result.fields && result.fields.length > 0 ? (
            result.fields.map((f, i) => (
              <div key={i} className="flex justify-between gap-3 px-4 py-2">
                <div className="text-[var(--ink-muted)] text-xs">{f.type}</div>
                <div className="text-right">
                  <div className="font-mono text-[13px]">{f.value || "-"}</div>
                  {f.confidence ? (
                    <div className="text-[10px] text-[var(--ink-faint)]">
                      {f.confidence.toFixed(1)}%
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-[var(--ink-muted)]">No fields returned.</div>
          )}
        </div>
      </div>

      {result.lineItems && result.lineItems.length > 0 ? (
        <div>
          <div className="eyebrow mb-2">Line items</div>
          <div className="rounded-xl border border-[rgba(11,15,30,0.08)] divide-y divide-[rgba(11,15,30,0.06)] bg-[#FBF9F4]">
            {result.lineItems.map((li, i) => (
              <div key={i} className="px-4 py-2.5">
                {Object.entries(li).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-[var(--ink-muted)]">{k}</span>
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
