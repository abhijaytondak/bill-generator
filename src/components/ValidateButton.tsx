"use client";

import { pdf } from "@react-pdf/renderer";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import type { Invoice } from "@/lib/types";
import type { ValidationCheckResult, DocumentAuthenticityResult, CategoryMatchResult } from "@/lib/billValidation";
import { BillValidationType } from "@/lib/billValidation";
import { InvoicePDF } from "./InvoicePDF";

type TextractField = { type: string; value: string | null; confidence: number | null };
type TextractResponse = {
  ok: boolean;
  fields?: TextractField[];
  lineItems?: Array<Record<string, string>>;
  missing?: string[];
  warnings?: string[];
  error?: string;
};

type AiValidateResponse = {
  checks: ValidationCheckResult[];
  error?: string;
};

type FullValidationResult = {
  textract?: TextractResponse;
  ai?: AiValidateResponse;
};

const TIER_LABELS: Record<number, string> = {
  1: "Tier 1 — Critical",
  2: "Tier 2 — Important",
  3: "Tier 3 — Advisory",
  4: "Tier 4 — Informational",
};

const CHECK_LABELS: Record<BillValidationType, string> = {
  [BillValidationType.DOCUMENT_AUTHENTICITY]: "Document Authenticity",
  [BillValidationType.BENEFIT_CATEGORY_MATCH]: "Benefit Category Match",
  [BillValidationType.BILL_DATE]: "Bill Date",
  [BillValidationType.AMOUNT_MATCH]: "Amount Match",
  [BillValidationType.DUPLICATE_BILL]: "Duplicate Bill",
  [BillValidationType.TAX_SANITY]: "Tax Sanity",
  [BillValidationType.BILL_COMPLETENESS]: "Bill Completeness",
  [BillValidationType.AMOUNT_REASONABLENESS]: "Amount Reasonableness",
  [BillValidationType.MERCHANT_MATCH]: "Merchant Match",
};

export default function ValidateButton({
  invoice,
  rawTexts = [],
}: {
  invoice: Invoice;
  rawTexts?: string[];
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FullValidationResult | null>(null);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"ai" | "textract">("ai");

  const run = async () => {
    setLoading(true);
    setResult(null);
    setOpen(true);

    try {
      const blob = await pdf(<InvoicePDF invoice={invoice} />).toBlob();

      // Combine real OCR texts from uploaded screenshots; fall back to invoice line item details
      const combinedOcrText = rawTexts.filter(Boolean).join("\n\n---\n\n") ||
        invoice.items
          .map((item) =>
            [item.merchantName, item.description, item.txnRef, item.transactionDate]
              .filter(Boolean)
              .join(" | "),
          )
          .join("\n");

      const lineItems = invoice.items.map((item) => item.description);

      const aiForm = new FormData();
      const meta = {
        ocrText: combinedOcrText,
        category: invoice.category,
        merchantName: invoice.vendor.name,
        amount: String(invoice.total),
        date: invoice.date,
        lineItems,
        receiptCount: invoice.items.length,
      };
      aiForm.append("meta", JSON.stringify(meta));

      const [aiRes, textractRes] = await Promise.allSettled([
        fetch("/api/validate/ai", { method: "POST", body: aiForm }).then(
          (r) => r.json() as Promise<AiValidateResponse>,
        ),
        (() => {
          const form = new FormData();
          form.append("file", blob, "invoice.pdf");
          return fetch("/api/validate", { method: "POST", body: form }).then(
            (r) => r.json() as Promise<TextractResponse>,
          );
        })(),
      ]);

      setResult({
        ai:
          aiRes.status === "fulfilled"
            ? aiRes.value
            : { checks: [], error: (aiRes.reason as Error)?.message },
        textract:
          textractRes.status === "fulfilled"
            ? textractRes.value
            : { ok: false, error: (textractRes.reason as Error)?.message },
      });
    } catch (e) {
      setResult({ ai: { checks: [], error: e instanceof Error ? e.message : "Failed" } });
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
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
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
                <div className="eyebrow mb-0.5">Bill Validation</div>
                <div className="font-semibold tracking-tight">Validation results</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] text-sm px-2"
              >
                Close
              </button>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center py-16 text-[var(--ink-muted)]">
                <div className="text-center">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin" />
                  <div className="mt-3 text-sm">Running AI validation checks…</div>
                  <div className="mt-1 text-xs text-[var(--ink-faint)]">
                    Document authenticity · Category match · {invoice.items.length} receipt
                    {invoice.items.length !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            ) : result ? (
              <>
                <div className="px-6 pt-4 flex gap-2">
                  <TabButton
                    active={activeTab === "ai"}
                    onClick={() => setActiveTab("ai")}
                    label="AI Checks"
                  />
                  <TabButton
                    active={activeTab === "textract"}
                    onClick={() => setActiveTab("textract")}
                    label="AWS Textract"
                  />
                </div>
                <div className="flex-1 overflow-auto px-6 py-4">
                  {activeTab === "ai" ? (
                    <AiChecksPanel checks={result.ai} />
                  ) : (
                    <TextractPanel result={result.textract} />
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--ink)] text-[var(--cream-0)]"
          : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
      }`}
    >
      {label}
    </button>
  );
}

function AiChecksPanel({ checks }: { checks?: AiValidateResponse }) {
  if (!checks) return <div className="text-sm text-[var(--ink-muted)]">No AI validation data.</div>;
  if (checks.error) {
    return (
      <div className="rounded-xl border border-[rgba(180,84,58,0.3)] bg-[rgba(246,217,192,0.4)] p-4 text-sm text-[var(--rust)]">
        {checks.error}
      </div>
    );
  }

  const byTier = checks.checks.reduce<Record<number, ValidationCheckResult[]>>((acc, c) => {
    (acc[c.tier] ??= []).push(c);
    return acc;
  }, {});

  const criticalFails = checks.checks.filter((c) => c.tier === 1 && !c.passed).length;
  const totalFails = checks.checks.filter((c) => !c.passed).length;
  const allPassed = totalFails === 0;

  return (
    <div className="space-y-4">
      <div
        className={`flex items-center gap-2 rounded-xl p-3.5 text-sm ${
          allPassed
            ? "bg-[var(--mint)] text-[var(--emerald)]"
            : criticalFails > 0
              ? "bg-[var(--peach)] text-[var(--rust)]"
              : "bg-amber-50 text-amber-700"
        }`}
      >
        {allPassed ? (
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 flex-shrink-0" />
        )}
        <span className="font-medium">
          {allPassed
            ? "All validation checks passed."
            : criticalFails > 0
              ? `${criticalFails} critical check${criticalFails > 1 ? "s" : ""} failed — review before submitting.`
              : `${totalFails} advisory check${totalFails > 1 ? "s" : ""} — review recommended.`}
        </span>
      </div>

      {([1, 2, 3, 4] as const).map((tier) => {
        const tierChecks = byTier[tier];
        if (!tierChecks?.length) return null;
        return (
          <div key={tier}>
            <div className="text-[10px] uppercase tracking-[0.14em] font-medium text-[var(--ink-muted)] mb-2">
              {TIER_LABELS[tier]}
            </div>
            <div className="rounded-xl border border-[rgba(11,15,30,0.08)] divide-y divide-[rgba(11,15,30,0.06)] bg-[#FBF9F4]">
              {tierChecks.map((check) => (
                <CheckRow key={check.type} check={check} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CheckRow({ check }: { check: ValidationCheckResult }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = check.data || check.details;

  return (
    <div>
      <button
        onClick={() => hasDetail && setExpanded((e) => !e)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left ${hasDetail ? "cursor-pointer hover:bg-black/[0.02]" : ""}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {check.passed ? (
            <CheckCircle2 className="w-4 h-4 text-[var(--emerald)] flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-[var(--rust)] flex-shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{CHECK_LABELS[check.type]}</span>
        </div>
        {hasDetail ? (
          expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--ink-muted)] flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[var(--ink-muted)] flex-shrink-0" />
          )
        ) : null}
      </button>

      {expanded && hasDetail ? (
        <div className="px-4 pb-3 border-t border-[rgba(11,15,30,0.04)]">
          {check.details ? (
            <p className="text-xs text-[var(--ink-muted)] mt-2 mb-2">{check.details}</p>
          ) : null}
          {check.data ? (
            check.type === BillValidationType.DOCUMENT_AUTHENTICITY ? (
              <DocumentAuthenticityDetail data={check.data as DocumentAuthenticityResult} />
            ) : check.type === BillValidationType.BENEFIT_CATEGORY_MATCH ? (
              <CategoryMatchDetail data={check.data as CategoryMatchResult} />
            ) : null
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DocumentAuthenticityDetail({ data }: { data: DocumentAuthenticityResult }) {
  const confidencePct = Math.round(data.confidence * 100);
  const barColor =
    confidencePct >= 80
      ? "bg-[var(--emerald)]"
      : confidencePct >= 50
        ? "bg-amber-400"
        : "bg-[var(--rust)]";

  return (
    <div className="space-y-3 text-xs pt-1">
      <div className="flex items-center gap-3">
        <span className="text-[var(--ink-muted)] w-20 flex-shrink-0">Doc type</span>
        <span className="font-medium">{data.documentType}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[var(--ink-muted)] w-20 flex-shrink-0">Confidence</span>
        <div className="flex items-center gap-2">
          <div className="w-28 h-1.5 rounded-full bg-[var(--cream-2)]">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${confidencePct}%` }}
            />
          </div>
          <span className={`tabular font-semibold ${confidencePct >= 80 ? "text-[var(--emerald)]" : confidencePct >= 50 ? "text-amber-600" : "text-[var(--rust)]"}`}>
            {confidencePct}%
          </span>
        </div>
      </div>
      {data.concerns.length > 0 ? (
        <div>
          <div className="text-[var(--ink-muted)] mb-1.5 font-medium">Concerns</div>
          <ul className="space-y-1.5">
            {data.concerns.map((c, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[var(--ink-muted)]">
                <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-[var(--emerald)] text-xs">No authenticity concerns found.</div>
      )}
    </div>
  );
}

function CategoryMatchDetail({ data }: { data: CategoryMatchResult }) {
  const badgeStyle =
    data.result === "VALID"
      ? "bg-[var(--mint)] text-[var(--emerald)]"
      : data.result === "PARTIALLY_VALID"
        ? "bg-amber-50 text-amber-700 border border-amber-200"
        : "bg-[var(--peach)] text-[var(--rust)]";

  return (
    <div className="space-y-2.5 text-xs pt-1">
      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${badgeStyle}`}>
        {data.result}
      </span>
      <p className="text-[var(--ink-muted)] leading-relaxed">{data.reason}</p>
      {data.invalidItems.length > 0 ? (
        <div>
          <div className="text-[var(--ink-muted)] mb-1.5 font-medium">Flagged items</div>
          <div className="flex flex-wrap gap-1">
            {data.invalidItems.map((item, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full bg-[var(--peach)] text-[var(--rust)] text-[11px] font-medium"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TextractPanel({ result }: { result?: TextractResponse }) {
  if (!result)
    return <div className="text-sm text-[var(--ink-muted)]">AWS Textract not available.</div>;
  if (result.error) {
    return (
      <div className="rounded-xl border border-[rgba(180,84,58,0.3)] bg-[rgba(246,217,192,0.4)] p-4 text-sm text-[var(--rust)]">
        {result.error}
      </div>
    );
  }

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
