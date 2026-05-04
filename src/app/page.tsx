"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { UploadDropzone } from "@/components/UploadDropzone";
import { extractFromImage } from "@/lib/ocr";
import {
  buildExpenseStatement,
  calculateLineItem,
  defaultDescription,
  formatDateDMY,
  generateInvoiceNo,
} from "@/lib/invoice";
import { isValidGSTIN } from "@/lib/gstin";
import type { ClaimCategory, ExtractedData } from "@/lib/types";
import { CATEGORY_LABELS, CLAIM_CATEGORIES } from "@/lib/types";

const PDFPreview = dynamic(() => import("@/components/PDFPreview"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-[var(--ink-faint)] text-sm">
      Loading preview...
    </div>
  ),
});

const PDFDownload = dynamic(() => import("@/components/PDFDownloadButton"), {
  ssr: false,
});

const ValidateBtn = dynamic(() => import("@/components/ValidateButton"), {
  ssr: false,
});

type Step = "upload" | "processing" | "review";

type TransactionDraft = {
  id: string;
  fileName: string;
  imageUrl?: string;
  status: "processing" | "ready" | "error";
  error?: string;
  extracted?: ExtractedData;
  category: ClaimCategory;
  merchantName: string;
  amount: string;
  date: string;
  time: string;
  txnId: string;
  paymentMethod: string;
  description: string;
};

const paymentMethods = ["UPI", "Card", "Cash", "Net Banking", "Wallet"];

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [transactions, setTransactions] = useState<TransactionDraft[]>([]);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");
  const [invoiceNo, setInvoiceNo] = useState(generateInvoiceNo(new Date().toISOString()));

  const handleFiles = async (files: File[]) => {
    const accepted = files.filter((file) => file.size <= 10 * 1024 * 1024);
    if (accepted.length === 0) return;
    const drafts = accepted.map((file) => makeDraft(file));
    setTransactions(drafts);
    setStep("processing");
    setProcessingIndex(0);
    setOcrProgress(0);

    for (let i = 0; i < drafts.length; i += 1) {
      setProcessingIndex(i);
      setOcrProgress(0);
      try {
        const data = await extractFromImage(accepted[i], setOcrProgress);
        setTransactions((prev) =>
          prev.map((tx) =>
            tx.id === drafts[i].id
              ? {
                  ...tx,
                  status: "ready",
                  extracted: data,
                  merchantName: data.merchantName || tx.merchantName,
                  amount: data.amount ? String(data.amount) : tx.amount,
                  date: data.date ? isoToDateInput(data.date) : tx.date,
                  time: data.time || tx.time,
                  txnId: data.txnId || tx.txnId,
                  paymentMethod: data.paymentMethod === "card" ? "Card" : data.paymentMethod === "upi" ? "UPI" : tx.paymentMethod,
                }
              : tx,
          ),
        );
      } catch (e) {
        setTransactions((prev) =>
          prev.map((tx) =>
            tx.id === drafts[i].id
              ? { ...tx, status: "error", error: e instanceof Error ? e.message : "OCR failed" }
              : tx,
          ),
        );
      }
    }

    setStep("review");
  };

  const validTransactions = transactions.filter((tx) => {
    const amount = Number(tx.amount);
    return tx.status !== "processing" && tx.merchantName.trim() && amount > 0 && tx.date;
  });

  const invoice = useMemo(() => {
    if (validTransactions.length === 0) return null;
    const gstin = customerGstin.trim().toUpperCase();
    return buildExpenseStatement({
      invoiceNo,
      customerName: customerName || undefined,
      customerGstin: gstin && isValidGSTIN(gstin) ? gstin : undefined,
      expenses: validTransactions.map((tx) => ({
        category: tx.category,
        merchantName: tx.merchantName,
        totalAmount: Number(tx.amount),
        date: dateInputToIso(tx.date),
        time: tx.time || undefined,
        txnRef: tx.txnId || undefined,
        paymentMethod: tx.paymentMethod,
        description: tx.description || defaultDescription(tx.category),
      })),
    });
  }, [validTransactions, invoiceNo, customerName, customerGstin]);

  const totals = useMemo(() => {
    return validTransactions.reduce(
      (acc, tx) => {
        const line = calculateLineItem({
          category: tx.category,
          merchantName: tx.merchantName,
          totalAmount: Number(tx.amount),
          date: dateInputToIso(tx.date),
          time: tx.time || undefined,
        });
        acc.subtotal += line.amount;
        acc.tax += (line.cgstAmount ?? 0) + (line.sgstAmount ?? 0) + (line.igstAmount ?? 0);
        acc.total += line.total ?? line.amount;
        return acc;
      },
      { subtotal: 0, tax: 0, total: 0 },
    );
  }, [validTransactions]);

  const reset = () => {
    transactions.forEach((tx) => {
      if (tx.imageUrl) URL.revokeObjectURL(tx.imageUrl);
    });
    setTransactions([]);
    setStep("upload");
    setProcessingIndex(0);
    setOcrProgress(0);
    setInvoiceNo(generateInvoiceNo(new Date().toISOString()));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-4 z-30 px-4">
        <header className="nav-pill mx-auto max-w-6xl rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[var(--ink)] text-[var(--cream-0)] flex items-center justify-center">
              <FileText className="w-4 h-4" strokeWidth={2} />
            </div>
            <div className="text-sm font-semibold tracking-tight truncate">Flexi Invoice</div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/history" className="hidden sm:inline-flex items-center gap-1.5 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)] px-3 py-1.5">
              <Clock className="w-4 h-4" /> History
            </Link>
            {step !== "upload" ? (
              <button onClick={reset} className="btn-ghost !py-1.5 !px-3 text-sm">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Start over</span>
              </button>
            ) : null}
          </div>
        </header>
      </div>

      <main className="flex-1 w-full">
        {step === "upload" ? (
          <section className="max-w-5xl mx-auto px-6 pt-16 pb-24">
            <div className="text-center mb-14 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(11,15,30,0.14)] bg-white/60 px-3 py-1 text-[11px] tracking-wider uppercase text-[var(--ink-muted)] backdrop-blur mb-6">
                <Sparkles className="w-3 h-3" /> Batch OCR · Expense statement
              </div>
              <h1 className="text-4xl sm:text-[56px] leading-[1.05] tracking-tight font-medium text-[var(--ink)]">
                Upload all flexi-benefit screenshots and generate one{" "}
                <span className="font-serif-italic text-[1.08em] text-[var(--ink-soft)]">
                  claim-ready statement.
                </span>
              </h1>
              <p className="mt-5 text-[var(--ink-muted)] text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
                We extract merchant, date, time, amount, transaction reference and payment mode in your browser. You review everything before PDF generation.
              </p>
            </div>
            <UploadDropzone onFiles={handleFiles} />
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-[var(--ink-muted)]">
              <InfoTile icon={<Upload className="w-4 h-4" />} title="Bulk upload" body="Select many PNG, JPG or WebP receipts at once." />
              <InfoTile icon={<CheckCircle2 className="w-4 h-4" />} title="Editable review" body="Correct OCR misses before creating the PDF." />
              <InfoTile icon={<Download className="w-4 h-4" />} title="Tax split" body="GST is calculated from category defaults for transparency." />
            </div>
          </section>
        ) : step === "processing" ? (
          <section className="max-w-xl mx-auto px-6 py-24 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--sky)] mb-6">
              <Loader2 className="w-7 h-7 animate-spin text-[var(--ink)]" />
            </div>
            <h2 className="text-3xl tracking-tight font-medium">
              Reading screenshots{" "}
              <span className="font-serif-italic text-[1.08em]">one by one</span>
            </h2>
            <div className="mt-3 text-sm text-[var(--ink-muted)]">
              File {Math.min(processingIndex + 1, transactions.length)} of {transactions.length} ·{" "}
              <span className="tabular">{ocrProgress}%</span>
            </div>
            <div className="mt-8 max-w-sm mx-auto h-1.5 bg-[var(--cream-2)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--ink)] transition-all duration-300" style={{ width: `${ocrProgress}%` }} />
            </div>
          </section>
        ) : (
          <ReviewScreen
            transactions={transactions}
            setTransactions={setTransactions}
            customerName={customerName}
            setCustomerName={setCustomerName}
            customerGstin={customerGstin}
            setCustomerGstin={setCustomerGstin}
            invoiceNo={invoiceNo}
            setInvoiceNo={setInvoiceNo}
            invoice={invoice}
            totals={totals}
          />
        )}
      </main>
    </div>
  );
}

function ReviewScreen({
  transactions,
  setTransactions,
  customerName,
  setCustomerName,
  customerGstin,
  setCustomerGstin,
  invoiceNo,
  setInvoiceNo,
  invoice,
  totals,
}: {
  transactions: TransactionDraft[];
  setTransactions: (updater: (prev: TransactionDraft[]) => TransactionDraft[]) => void;
  customerName: string;
  setCustomerName: (value: string) => void;
  customerGstin: string;
  setCustomerGstin: (value: string) => void;
  invoiceNo: string;
  setInvoiceNo: (value: string) => void;
  invoice: ReturnType<typeof buildExpenseStatement> | null;
  totals: { subtotal: number; tax: number; total: number };
}) {
  const updateTx = (id: string, patch: Partial<TransactionDraft>) => {
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === id
          ? { ...tx, ...patch, status: tx.status === "error" ? "ready" : patch.status ?? tx.status, error: tx.status === "error" ? undefined : tx.error }
          : tx,
      ),
    );
  };
  const removeTx = (id: string) => {
    setTransactions((prev) => {
      const removed = prev.find((tx) => tx.id === id);
      if (removed?.imageUrl) URL.revokeObjectURL(removed.imageUrl);
      return prev.filter((tx) => tx.id !== id);
    });
  };
  const addManualRow = () => {
    setTransactions((prev) => [...prev, makeManualDraft()]);
  };

  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatTile label="Receipts" value={String(transactions.length)} />
        <StatTile label="Subtotal" value={`₹${totals.subtotal.toFixed(2)}`} />
        <StatTile label="Tax split" value={`₹${totals.tax.toFixed(2)}`} />
        <StatTile label="Claim total" value={`₹${totals.total.toFixed(2)}`} highlight />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_520px] gap-6">
        <div className="space-y-5">
          <section className="card p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <LabeledInput label="Employee / claimant name" value={customerName} onChange={setCustomerName} placeholder="Optional" />
              <LabeledInput label="Customer GSTIN" value={customerGstin} onChange={(v) => setCustomerGstin(v.toUpperCase())} placeholder="Optional" />
              <LabeledInput label="Statement no." value={invoiceNo} onChange={setInvoiceNo} />
            </div>
            <div className="mt-3 text-xs text-[var(--ink-muted)]">
              This PDF is an expense statement based on real payment proofs. Keep the original screenshots for audit or finance review.
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-[rgba(11,15,30,0.08)] flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Review extracted transactions</div>
                <div className="text-xs text-[var(--ink-muted)] mt-0.5">Edit OCR mistakes before downloading.</div>
              </div>
              <button type="button" onClick={addManualRow} className="btn-ghost !py-2 !px-3 text-sm">
                <Plus className="w-4 h-4" /> Add row
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-[var(--cream-1)] text-[var(--ink-muted)] text-[10px] uppercase tracking-[0.14em]">
                  <tr>
                    <th className="text-left px-3 py-3 font-medium">Proof</th>
                    <th className="text-left px-3 py-3 font-medium">Merchant</th>
                    <th className="text-left px-3 py-3 font-medium">Category</th>
                    <th className="text-left px-3 py-3 font-medium">Date</th>
                    <th className="text-left px-3 py-3 font-medium">Time</th>
                    <th className="text-left px-3 py-3 font-medium">Amount</th>
                    <th className="text-left px-3 py-3 font-medium">Reference</th>
                    <th className="text-left px-3 py-3 font-medium">Method</th>
                    <th className="px-3 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-t border-[rgba(11,15,30,0.06)] align-top">
                      <td className="px-3 py-3">
                        {tx.imageUrl ? (
                          <a href={tx.imageUrl} target="_blank" className="font-mono text-xs underline underline-offset-2">
                            {tx.fileName.slice(0, 18)}
                          </a>
                        ) : (
                          <span className="font-mono text-xs text-[var(--ink-muted)]">{tx.fileName}</span>
                        )}
                        {tx.status === "error" ? <div className="text-[11px] text-[var(--rust)] mt-1">{tx.error}</div> : null}
                      </td>
                      <td className="px-3 py-3">
                        <input className="input !py-2" value={tx.merchantName} onChange={(e) => updateTx(tx.id, { merchantName: e.target.value })} />
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className="input !py-2"
                          value={tx.category}
                          onChange={(e) => {
                            const category = e.target.value as ClaimCategory;
                            updateTx(tx.id, { category, description: defaultDescription(category) });
                          }}
                        >
                          {CLAIM_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {CATEGORY_LABELS[cat]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <input type="date" className="input !py-2" value={tx.date} onChange={(e) => updateTx(tx.id, { date: e.target.value })} />
                      </td>
                      <td className="px-3 py-3">
                        <input type="time" className="input !py-2" value={tx.time} onChange={(e) => updateTx(tx.id, { time: e.target.value })} />
                      </td>
                      <td className="px-3 py-3">
                        <input type="number" className="input !py-2 w-28" value={tx.amount} onChange={(e) => updateTx(tx.id, { amount: e.target.value })} />
                      </td>
                      <td className="px-3 py-3">
                        <input className="input !py-2" value={tx.txnId} onChange={(e) => updateTx(tx.id, { txnId: e.target.value })} />
                      </td>
                      <td className="px-3 py-3">
                        <select className="input !py-2" value={tx.paymentMethod} onChange={(e) => updateTx(tx.id, { paymentMethod: e.target.value })}>
                          {paymentMethods.map((method) => (
                            <option key={method} value={method}>
                              {method}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => removeTx(tx.id)}
                          className="w-9 h-9 inline-flex items-center justify-center rounded-full border border-[rgba(11,15,30,0.14)] text-[var(--ink-muted)] hover:text-[var(--rust)]"
                          title="Remove transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card-ink p-6 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Download statement</div>
              <div className="text-xs text-[var(--ink-faint)] mt-1">
                {invoice ? `₹${invoice.total.toFixed(2)} · ${formatDateDMY(invoice.date)} · ${invoice.items.length} receipts` : "Add at least one valid transaction."}
              </div>
            </div>
            {invoice ? (
              <div className="flex items-center gap-2 flex-shrink-0">
                <ValidateBtn invoice={invoice} />
                <PDFDownload invoice={invoice} />
              </div>
            ) : (
              <button disabled className="btn-ink">
                <Download className="w-4 h-4" /> PDF
              </button>
            )}
          </section>
        </div>

        <div className="card overflow-hidden flex flex-col h-[calc(100vh-140px)] sticky top-24">
          <div className="px-5 py-3 border-b border-[rgba(11,15,30,0.08)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--emerald)]" />
              <div className="text-sm font-medium">Live statement preview</div>
            </div>
            {invoice ? <div className="text-[11px] text-[var(--ink-muted)] tabular tracking-wide">{invoice.invoiceNo}</div> : null}
          </div>
          <div className="flex-1 min-h-0 bg-[var(--cream-1)]">
            {invoice ? (
              <PDFPreview invoice={invoice} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[var(--ink-muted)] text-sm p-8 text-center">
                Fix the transaction rows to enable preview.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function makeDraft(file: File): TransactionDraft {
  const category: ClaimCategory = "meals";
  return {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    fileName: file.name,
    imageUrl: URL.createObjectURL(file),
    status: "processing",
    category,
    merchantName: "",
    amount: "",
    date: todayDateInput(),
    time: "",
    txnId: "",
    paymentMethod: "UPI",
    description: defaultDescription(category),
  };
}

function makeManualDraft(): TransactionDraft {
  const category: ClaimCategory = "meals";
  return {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    fileName: "Manual entry",
    status: "ready",
    category,
    merchantName: "",
    amount: "",
    date: todayDateInput(),
    time: "",
    txnId: "",
    paymentMethod: "UPI",
    description: defaultDescription(category),
  };
}

function InfoTile({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card !rounded-2xl p-4">
      <div className="w-8 h-8 rounded-full bg-[var(--sky)] flex items-center justify-center text-[var(--ink)]">{icon}</div>
      <div className="mt-3 text-sm font-semibold text-[var(--ink)]">{title}</div>
      <div className="mt-1 text-xs leading-relaxed">{body}</div>
    </div>
  );
}

function StatTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 border ${highlight ? "bg-[var(--ink)] text-[var(--cream-0)] border-[var(--ink)]" : "card !p-4"}`}>
      <div className={`text-[10px] uppercase tracking-[0.14em] font-medium ${highlight ? "text-[var(--cream-2)]" : "text-[var(--ink-muted)]"}`}>
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight tabular">{value}</div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="input-label">{label}</label>
      <input className="input mt-1.5" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return todayDateInput();
  return d.toISOString().slice(0, 10);
}

function dateInputToIso(value: string): string {
  const d = new Date(`${value}T00:00:00`);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}
