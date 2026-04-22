"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Clock,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  Wand2,
  CheckCircle2,
} from "lucide-react";
import { UploadDropzone } from "@/components/UploadDropzone";
import { VendorPicker } from "@/components/VendorPicker";
import { extractFromImage } from "@/lib/ocr";
import {
  buildInvoice,
  defaultDescription,
  formatDateDMY,
  generateInvoiceNo,
} from "@/lib/invoice";
import { isValidGSTIN, stateFromGSTIN } from "@/lib/gstin";
import type { Category, ExtractedData, Vendor } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";

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

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState<string | null>(null);

  const [category, setCategory] = useState<Category>("meals");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [txnId, setTxnId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("UPI");
  const [description, setDescription] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerGstin, setCustomerGstin] = useState<string>("");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [invoiceNo, setInvoiceNo] = useState<string>("");

  const changeCategory = (c: Category) => {
    setCategory(c);
    const allDefaults = new Set<string>([
      "Food & Beverages",
      "Motor Spirit (Petrol)",
      "Printed Books / Periodicals",
      "Telecom / Internet Services",
      ...Object.values(CATEGORY_LABELS),
    ]);
    setDescription((prev) => (!prev || allDefaults.has(prev) ? defaultDescription(c) : prev));
  };

  const handleFile = async (f: File) => {
    setFile(f);
    const url = URL.createObjectURL(f);
    setImageUrl(url);
    setStep("processing");
    setOcrProgress(0);
    setOcrError(null);
    try {
      const data = await extractFromImage(f, setOcrProgress);
      setExtracted(data);
      if (data.amount) setAmount(String(data.amount));
      setDate(data.date ? isoToDateInput(data.date) : todayDateInput());
      if (data.txnId) setTxnId(data.txnId);
      if (data.paymentMethod === "upi") setPaymentMethod("UPI");
      else if (data.paymentMethod === "card") setPaymentMethod("Card");
      setDescription(defaultDescription(category));
      setInvoiceNo(generateInvoiceNo(data.date ?? new Date().toISOString()));
      setStep("review");
    } catch (e) {
      setOcrError(e instanceof Error ? e.message : "OCR failed");
      setStep("upload");
    }
  };

  const reset = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setStep("upload");
    setFile(null);
    setImageUrl(null);
    setExtracted(null);
    setOcrProgress(0);
    setOcrError(null);
    setAmount("");
    setDate("");
    setTxnId("");
    setDescription("");
    setSelectedVendor(null);
    setInvoiceNo("");
    setCustomerGstin("");
  };

  const amountNum = Number(amount);
  const invoice = useMemo(() => {
    if (!selectedVendor) return null;
    if (!amountNum || amountNum <= 0) return null;
    const iso = date ? new Date(date).toISOString() : new Date().toISOString();
    const gstinTrim = customerGstin.trim().toUpperCase();
    return buildInvoice({
      vendor: selectedVendor,
      category,
      totalAmount: amountNum,
      description: description || defaultDescription(category),
      date: iso,
      txnRef: txnId || undefined,
      paymentMethod,
      customerName: customerName || undefined,
      customerGstin: gstinTrim && isValidGSTIN(gstinTrim) ? gstinTrim : undefined,
      invoiceNo: invoiceNo || undefined,
    });
  }, [selectedVendor, amountNum, date, category, description, txnId, paymentMethod, customerName, customerGstin, invoiceNo]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Floating frosted-glass nav (shot 03 pattern) */}
      <div className="sticky top-4 z-30 px-4">
        <header className="nav-pill mx-auto max-w-5xl rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[var(--ink)] text-[var(--cream-0)] flex items-center justify-center">
              <FileText className="w-4 h-4" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight truncate">Flexi Invoice</div>
            </div>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <Link
              href="/history"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors px-3 py-1.5"
            >
              <Clock className="w-4 h-4" /> History
            </Link>
            {step !== "upload" ? (
              <button onClick={reset} className="btn-ghost !py-1.5 !px-3 text-sm">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Start over</span>
              </button>
            ) : (
              <Link href="/history" className="sm:hidden text-sm text-[var(--ink-muted)] px-2">
                <Clock className="w-4 h-4" />
              </Link>
            )}
          </div>
        </header>
      </div>

      <main className="flex-1 w-full">
        {step === "upload" ? (
          <section className="max-w-5xl mx-auto px-6 pt-16 pb-24">
            {/* Hero — sans + italic serif flourish */}
            <div className="text-center mb-14 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(11,15,30,0.14)] bg-white/60 px-3 py-1 text-[11px] tracking-wider uppercase text-[var(--ink-muted)] backdrop-blur mb-6">
                <Sparkles className="w-3 h-3" /> On-device OCR · No uploads
              </div>
              <h1 className="text-4xl sm:text-[56px] leading-[1.05] tracking-tight font-medium text-[var(--ink)]">
                Turn a payment screenshot into a{" "}
                <span className="font-serif-italic text-[1.08em] text-[var(--ink-soft)]">
                  GST-ready invoice.
                </span>
              </h1>
              <p className="mt-5 text-[var(--ink-muted)] text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
                Drop any UPI or card receipt. We read it in your browser, match the vendor,
                and render a downloadable PDF you can hand to finance.
              </p>
            </div>

            {/* Upload dropzone */}
            <UploadDropzone onFile={handleFile} />

            {ocrError ? (
              <div className="mt-4 max-w-xl mx-auto rounded-2xl border border-[rgba(180,84,58,0.3)] bg-[rgba(246,217,192,0.35)] p-3 text-sm text-[var(--rust)]">
                {ocrError}
              </div>
            ) : null}

            {/* Pastel bento — how it works (shot 09 — Prokta) */}
            <div className="mt-16">
              <div className="eyebrow text-center mb-6">How it works</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <BentoTile
                  tone="sky"
                  step="01"
                  icon={<Upload className="w-5 h-5" />}
                  title="Drop a screenshot"
                  body="GPay, PhonePe, Paytm, or a card receipt. PNG, JPG, WebP."
                />
                <BentoTile
                  tone="mint"
                  step="02"
                  icon={<Wand2 className="w-5 h-5" />}
                  title="OCR in your browser"
                  body="Amount, date, merchant, UTR — extracted on-device. Nothing leaves."
                />
                <BentoTile
                  tone="lavender"
                  step="03"
                  icon={<CheckCircle2 className="w-5 h-5" />}
                  title="Review & match vendor"
                  body="Pick category, confirm GSTIN, autofill defaults from your vendor list."
                />
                <BentoTile
                  tone="peach"
                  step="04"
                  icon={<Download className="w-5 h-5" />}
                  title="Download PDF"
                  body="GST-compliant invoice with CGST/SGST or IGST split, ready for finance."
                />
              </div>
            </div>
          </section>
        ) : step === "processing" ? (
          <section className="max-w-xl mx-auto px-6 py-24 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--sky)] mb-6">
              <Loader2 className="w-7 h-7 animate-spin text-[var(--ink)]" />
            </div>
            <h2 className="text-3xl tracking-tight font-medium">
              Reading your{" "}
              <span className="font-serif-italic text-[1.08em]">screenshot</span>
            </h2>
            <div className="mt-3 text-sm text-[var(--ink-muted)]">
              Running on-device OCR · <span className="tabular">{ocrProgress}%</span>
            </div>
            <div className="mt-8 max-w-sm mx-auto h-1.5 bg-[var(--cream-2)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--ink)] transition-all duration-300"
                style={{ width: `${ocrProgress}%` }}
              />
            </div>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Uploaded"
                className="mt-10 max-w-[220px] mx-auto rounded-2xl border border-[rgba(11,15,30,0.08)]"
              />
            ) : null}
          </section>
        ) : (
          <section className="max-w-7xl mx-auto px-6 py-10">
            {/* Stat strip — shot 05 HR pattern */}
            {invoice ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <StatTile label="Subtotal" value={`₹${invoice.subtotal.toFixed(2)}`} />
                <StatTile
                  label={invoice.interState ? "IGST" : "CGST"}
                  value={`₹${(invoice.interState ? invoice.igstAmount : invoice.cgstAmount).toFixed(2)}`}
                />
                <StatTile
                  label={invoice.interState ? "—" : "SGST"}
                  value={`₹${(invoice.interState ? 0 : invoice.sgstAmount).toFixed(2)}`}
                />
                <StatTile label="Total" value={`₹${invoice.total.toFixed(2)}`} highlight />
              </div>
            ) : (
              <div className="mb-6 card px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--peach)] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[var(--ink)]" />
                </div>
                <div className="text-sm text-[var(--ink-muted)]">
                  Pick a vendor and enter an amount — the live invoice preview will appear on the right.
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[480px_1fr] gap-6">
              <div className="space-y-5">
                <section className="card p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Extracted details</div>
                    {extracted ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--emerald)] bg-[var(--mint)] rounded-full px-2 py-0.5">
                        <Sparkles className="w-3 h-3" /> OCR done
                      </span>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <LabeledInput
                      label="Amount (incl. tax)"
                      value={amount}
                      onChange={setAmount}
                      type="number"
                      prefix="₹"
                    />
                    <LabeledInput
                      label="Date"
                      value={date}
                      onChange={setDate}
                      type="date"
                    />
                    <LabeledInput
                      label="Transaction / UTR reference"
                      value={txnId}
                      onChange={setTxnId}
                      className="col-span-2"
                    />
                    <LabeledSelect
                      label="Payment method"
                      value={paymentMethod}
                      onChange={setPaymentMethod}
                      options={["UPI", "Card", "Cash", "Net Banking", "Wallet"]}
                    />
                    <LabeledInput
                      label="Customer name (Bill To)"
                      value={customerName}
                      onChange={setCustomerName}
                      placeholder="Optional"
                    />
                    <LabeledInput
                      label="Customer GSTIN"
                      value={customerGstin}
                      onChange={(v) => setCustomerGstin(v.toUpperCase())}
                      placeholder="Optional · triggers IGST if inter-state"
                      className="col-span-2"
                    />
                  </div>
                  <GstTreatment
                    vendorGstin={selectedVendor?.gstin}
                    customerGstin={customerGstin}
                  />
                </section>

                <section className="card p-6 space-y-4">
                  <div className="text-sm font-semibold">Category &amp; description</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => changeCategory(c)}
                        className={`text-left p-3 rounded-xl border text-sm transition-all
                          ${category === c
                            ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--cream-0)] font-medium"
                            : "border-[rgba(11,15,30,0.08)] bg-white/50 hover:border-[rgba(11,15,30,0.25)]"}`}
                      >
                        {CATEGORY_LABELS[c]}
                      </button>
                    ))}
                  </div>
                  <LabeledInput
                    label="Description on invoice"
                    value={description}
                    onChange={setDescription}
                  />
                  <GstHint category={category} />
                </section>

                <section className="card p-6">
                  <VendorPicker
                    category={category}
                    selectedId={selectedVendor?.id ?? null}
                    onSelect={setSelectedVendor}
                    suggestedName={extracted?.merchantName ?? undefined}
                  />
                </section>

                {/* Download CTA — dark ink card (shot 11 pattern) */}
                <section className="card-ink p-6 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">Download invoice</div>
                    <div className="text-xs text-[var(--ink-faint)] mt-1">
                      {invoice
                        ? `₹${invoice.total.toFixed(2)} · ${formatDateDMY(invoice.date)}`
                        : "Fill the required fields to enable download."}
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

              <div className="space-y-4">
                <div className="card overflow-hidden flex flex-col h-[calc(100vh-140px)] sticky top-24">
                  <div className="px-5 py-3 border-b border-[rgba(11,15,30,0.08)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[var(--emerald)]" />
                      <div className="text-sm font-medium">Live invoice preview</div>
                    </div>
                    {invoice ? (
                      <div className="text-[11px] text-[var(--ink-muted)] tabular tracking-wide">
                        {invoice.invoiceNo}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex-1 min-h-0 bg-[var(--cream-1)]">
                    {invoice ? (
                      <PDFPreview invoice={invoice} />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-[var(--ink-muted)] text-sm p-8 text-center">
                        <div className="w-14 h-14 rounded-full bg-white/60 flex items-center justify-center mb-4">
                          <FileText className="w-6 h-6" strokeWidth={1.5} />
                        </div>
                        <div className="font-serif-italic text-xl text-[var(--ink-soft)] mb-1">
                          Nothing to preview yet
                        </div>
                        <div className="text-xs max-w-[220px]">
                          Pick a vendor and set an amount to see the invoice come alive.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {imageUrl ? (
                  <details className="card">
                    <summary className="cursor-pointer text-sm px-5 py-3 text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center gap-2 list-none">
                      <RefreshCw className="w-3.5 h-3.5" />
                      View uploaded screenshot
                      <ArrowUpRight className="w-3.5 h-3.5 ml-auto" />
                    </summary>
                    <div className="p-5 pt-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl}
                        alt="Uploaded"
                        className="max-w-full max-h-96 rounded-xl border border-[rgba(11,15,30,0.08)]"
                      />
                    </div>
                  </details>
                ) : null}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="mt-auto text-xs text-[var(--ink-muted)]">
        <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between border-t border-[rgba(11,15,30,0.08)]">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--emerald)]" />
            OCR runs locally. No screenshots leave your browser.
          </div>
          <div className="tabular">v0.1.0</div>
        </div>
      </footer>
    </div>
  );
}

function BentoTile({
  tone,
  step,
  icon,
  title,
  body,
}: {
  tone: "sky" | "mint" | "peach" | "lavender";
  step: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  const tones: Record<string, string> = {
    sky: "bg-[var(--sky)]",
    mint: "bg-[var(--mint)]",
    peach: "bg-[var(--peach)]",
    lavender: "bg-[var(--lavender)]",
  };
  return (
    <div
      className={`${tones[tone]} rounded-2xl p-5 h-full flex flex-col justify-between min-h-[160px] border border-[rgba(11,15,30,0.04)]`}
    >
      <div className="flex items-center justify-between text-[var(--ink-soft)]">
        <div className="w-9 h-9 rounded-full bg-white/70 flex items-center justify-center">
          {icon}
        </div>
        <div className="font-serif-italic text-2xl text-[var(--ink-muted)] tabular">
          {step}
        </div>
      </div>
      <div>
        <div className="mt-6 text-base font-semibold text-[var(--ink)] leading-tight">
          {title}
        </div>
        <div className="mt-1.5 text-[13px] text-[var(--ink-soft)] leading-snug">
          {body}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 border transition-colors ${
        highlight
          ? "bg-[var(--ink)] text-[var(--cream-0)] border-[var(--ink)]"
          : "card !p-4"
      }`}
    >
      <div
        className={`text-[10px] uppercase tracking-[0.14em] font-medium ${
          highlight ? "text-[var(--cream-2)]" : "text-[var(--ink-muted)]"
        }`}
      >
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
  type = "text",
  placeholder,
  prefix,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  prefix?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="input-label">{label}</label>
      <div className="mt-1.5 flex items-stretch">
        {prefix ? (
          <span className="px-3 inline-flex items-center border border-r-0 border-[rgba(11,15,30,0.12)] rounded-l-[10px] bg-[var(--cream-1)] text-sm text-[var(--ink-muted)]">
            {prefix}
          </span>
        ) : null}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`input flex-1 min-w-0 ${prefix ? "!rounded-l-none" : ""}`}
        />
      </div>
    </div>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="input-label">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input mt-1.5"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function GstTreatment({
  vendorGstin,
  customerGstin,
}: {
  vendorGstin?: string;
  customerGstin: string;
}) {
  const cust = customerGstin.trim().toUpperCase();
  if (!cust) return null;
  if (!isValidGSTIN(cust)) {
    return (
      <div className="text-[11px] text-[var(--rust)]">Customer GSTIN format looks wrong.</div>
    );
  }
  const custState = stateFromGSTIN(cust);
  const vendState = vendorGstin ? stateFromGSTIN(vendorGstin.trim().toUpperCase()) : null;
  if (!vendState) {
    return (
      <div className="text-[11px] text-[var(--ink-muted)]">
        Customer state: <span className="font-medium text-[var(--ink)]">{custState}</span>. Vendor has no GSTIN on file, so CGST+SGST is assumed.
      </div>
    );
  }
  const interState = custState !== vendState;
  return (
    <div
      className={`text-[11px] rounded-lg px-3 py-2 ${
        interState
          ? "bg-[var(--sky)] text-[var(--ink)]"
          : "bg-[var(--mint)] text-[var(--ink)]"
      }`}
    >
      {interState ? (
        <>
          Inter-state supply ({vendState} → {custState}). <span className="font-medium">IGST</span> will apply.
        </>
      ) : (
        <>
          Intra-state supply ({custState}). <span className="font-medium">CGST+SGST</span> will apply.
        </>
      )}
    </div>
  );
}

function GstHint({ category }: { category: Category }) {
  const map = {
    meals: "CGST 2.5% + SGST 2.5% (5% total, standard for restaurant service)",
    fuel: "No GST shown; fuel is outside GST and included in per-litre price",
    books: "0% GST on printed books & periodicals",
    telecom: "CGST 9% + SGST 9% (18% total)",
  };
  return <div className="text-[11px] text-[var(--ink-muted)]">{map[category]}</div>;
}

function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return todayDateInput();
  return d.toISOString().slice(0, 10);
}

function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}
