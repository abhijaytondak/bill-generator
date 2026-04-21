"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { UploadDropzone } from "@/components/UploadDropzone";
import { VendorPicker } from "@/components/VendorPicker";
import { extractFromImage } from "@/lib/ocr";
import {
  buildInvoice,
  defaultDescription,
  formatDateDMY,
} from "@/lib/invoice";
import type { Category, ExtractedData, Vendor } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";

const PDFPreview = dynamic(() => import("@/components/PDFPreview"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-neutral-400 text-sm">
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
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  useEffect(() => {
    setDescription((prev) => {
      const defaults = Object.values(CATEGORY_LABELS).concat(
        ["Food & Beverages", "Motor Spirit (Petrol)", "Printed Books / Periodicals", "Telecom / Internet Services"],
      );
      if (!prev || defaults.includes(prev)) return defaultDescription(category);
      return prev;
    });
  }, [category]);

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
  };

  const amountNum = Number(amount);
  const invoice = useMemo(() => {
    if (!selectedVendor) return null;
    if (!amountNum || amountNum <= 0) return null;
    const iso = date ? new Date(date).toISOString() : new Date().toISOString();
    return buildInvoice({
      vendor: selectedVendor,
      category,
      totalAmount: amountNum,
      description: description || defaultDescription(category),
      date: iso,
      txnRef: txnId || undefined,
      paymentMethod,
      customerName: customerName || undefined,
    });
  }, [selectedVendor, amountNum, date, category, description, txnId, paymentMethod, customerName]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5" strokeWidth={2} />
            <div>
              <div className="font-semibold tracking-tight">Flexi Invoice</div>
              <div className="text-xs text-neutral-500">
                Screenshot to GST-compliant invoice
              </div>
            </div>
          </div>
          {step !== "upload" ? (
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-black"
            >
              <ArrowLeft className="w-4 h-4" /> Start over
            </button>
          ) : null}
        </div>
      </header>

      <main className="flex-1 w-full">
        {step === "upload" ? (
          <div className="max-w-2xl mx-auto px-6 py-16">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold tracking-tight mb-2">
                Turn a transaction screenshot into a bill
              </h1>
              <p className="text-neutral-600">
                Upload your UPI or card receipt. We&apos;ll extract the details and build a
                GST-compliant invoice you can download.
              </p>
            </div>
            <UploadDropzone onFile={handleFile} />
            {ocrError ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {ocrError}
              </div>
            ) : null}
            <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-4 text-xs text-neutral-600 space-y-1">
              <div className="font-medium text-neutral-900">How this works</div>
              <p>1. Drop a payment screenshot (GPay, PhonePe, Paytm, card receipt).</p>
              <p>2. We run OCR in your browser &mdash; nothing is uploaded.</p>
              <p>3. Review extracted fields, pick vendor &amp; category.</p>
              <p>4. Download the PDF invoice.</p>
            </div>
          </div>
        ) : step === "processing" ? (
          <div className="max-w-2xl mx-auto px-6 py-20 text-center">
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-neutral-700" />
            <div className="mt-4 text-lg font-medium">Reading your screenshot</div>
            <div className="mt-2 text-sm text-neutral-500">
              Running on-device OCR... {ocrProgress}%
            </div>
            <div className="mt-6 max-w-sm mx-auto h-1.5 bg-neutral-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-black transition-all"
                style={{ width: `${ocrProgress}%` }}
              />
            </div>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Uploaded"
                className="mt-8 max-w-xs mx-auto rounded-lg border border-neutral-200 shadow-sm"
              />
            ) : null}
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[480px_1fr] gap-6">
            <div className="space-y-5">
              <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Extracted details</div>
                  {extracted ? (
                    <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
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
                    prefix="Rs."
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
                </div>
              </section>

              <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
                <div className="text-sm font-semibold">Category &amp; description</div>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`text-left p-2.5 rounded-lg border text-sm transition-colors
                        ${category === c ? "border-black bg-neutral-50 font-medium" : "border-neutral-200 hover:border-neutral-400"}`}
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

              <section className="rounded-xl border border-neutral-200 bg-white p-5">
                <VendorPicker
                  category={category}
                  selectedId={selectedVendor?.id ?? null}
                  onSelect={setSelectedVendor}
                  suggestedName={extracted?.merchantName ?? undefined}
                />
              </section>

              <section className="rounded-xl border border-neutral-200 bg-white p-5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Download invoice</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {invoice
                      ? `Rs. ${invoice.total.toFixed(2)} · ${formatDateDMY(invoice.date)}`
                      : "Fill all required fields to enable download."}
                  </div>
                </div>
                {invoice ? (
                  <div className="flex items-center gap-2">
                    <ValidateBtn invoice={invoice} />
                    <PDFDownload invoice={invoice} />
                  </div>
                ) : (
                  <button
                    disabled
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-neutral-200 text-neutral-500 text-sm cursor-not-allowed"
                  >
                    <Download className="w-4 h-4" /> Download PDF
                  </button>
                )}
              </section>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden flex flex-col h-[85vh] sticky top-6">
                <div className="px-4 py-2.5 border-b border-neutral-200 flex items-center justify-between">
                  <div className="text-sm font-medium">Invoice preview</div>
                  {invoice ? (
                    <div className="text-xs text-neutral-500">{invoice.invoiceNo}</div>
                  ) : null}
                </div>
                <div className="flex-1 min-h-0">
                  {invoice ? (
                    <PDFPreview invoice={invoice} />
                  ) : (
                    <div className="h-full flex items-center justify-center text-neutral-400 text-sm p-6 text-center">
                      Pick a vendor and enter an amount to see the invoice here.
                    </div>
                  )}
                </div>
              </div>
              {imageUrl ? (
                <details className="rounded-xl border border-neutral-200 bg-white">
                  <summary className="cursor-pointer text-sm px-4 py-2.5 text-neutral-600 hover:text-black flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5" />
                    View uploaded screenshot
                  </summary>
                  <div className="p-4 pt-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Uploaded"
                      className="max-w-full max-h-96 rounded border border-neutral-200"
                    />
                  </div>
                </details>
              ) : null}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-neutral-200 bg-white text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>OCR runs locally in your browser. No screenshots leave your machine.</div>
          <div>v0.1.0</div>
        </div>
      </footer>
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
      <label className="text-xs text-neutral-600 font-medium">{label}</label>
      <div className="mt-1 flex items-stretch">
        {prefix ? (
          <span className="px-2 inline-flex items-center border border-r-0 border-neutral-300 rounded-l-md bg-neutral-50 text-xs text-neutral-500">
            {prefix}
          </span>
        ) : null}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`flex-1 min-w-0 rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm outline-none focus:border-black ${prefix ? "rounded-l-none" : ""}`}
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
      <label className="text-xs text-neutral-600 font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm outline-none focus:border-black bg-white"
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

function GstHint({ category }: { category: Category }) {
  const map = {
    meals: "CGST 2.5% + SGST 2.5% (5% total, standard for restaurant service)",
    fuel: "No GST shown; fuel is outside GST and included in per-litre price",
    books: "0% GST on printed books & periodicals",
    telecom: "CGST 9% + SGST 9% (18% total)",
  };
  return <div className="text-[11px] text-neutral-500">{map[category]}</div>;
}

function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return todayDateInput();
  return d.toISOString().slice(0, 10);
}

function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}
