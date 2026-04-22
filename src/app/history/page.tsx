"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Copy, FileText, Trash2 } from "lucide-react";
import {
  deleteFromHistory,
  duplicateInHistory,
  getHistory,
  getServerHistorySnapshot,
  subscribeHistory,
} from "@/lib/history";
import { formatDateDMY, inrFormat } from "@/lib/invoice";
import { CATEGORY_LABELS } from "@/lib/types";

const PDFDownload = dynamic(() => import("@/components/PDFDownloadButton"), {
  ssr: false,
});

export default function HistoryPage() {
  const entries = useSyncExternalStore(
    subscribeHistory,
    getHistory,
    getServerHistorySnapshot,
  );

  const onDelete = (invoiceNo: string, name: string) => {
    if (!confirm(`Delete invoice ${invoiceNo} for ${name}?`)) return;
    deleteFromHistory(invoiceNo);
  };

  const onDuplicate = (invoiceNo: string) => {
    duplicateInHistory(invoiceNo);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-4 z-30 px-4">
        <header className="nav-pill mx-auto max-w-5xl rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[var(--ink)] text-[var(--cream-0)] flex items-center justify-center">
              <FileText className="w-4 h-4" strokeWidth={2} />
            </div>
            <div className="text-sm font-semibold tracking-tight">Flexi Invoice</div>
          </Link>
          <Link href="/" className="btn-ghost !py-1.5 !px-3 text-sm">
            <ArrowLeft className="w-4 h-4" /> New invoice
          </Link>
        </header>
      </div>

      <main className="flex-1 w-full max-w-5xl mx-auto px-6 pt-12 pb-16">
        <div className="mb-10 max-w-2xl">
          <div className="eyebrow mb-3">Saved in your browser</div>
          <h1 className="text-4xl sm:text-5xl tracking-tight font-medium leading-tight">
            Your{" "}
            <span className="font-serif-italic text-[1.08em]">history</span>
          </h1>
          <p className="mt-4 text-[var(--ink-muted)]">
            Every invoice is stored locally the moment you hit download. Nothing is synced, nothing
            leaves this machine.
          </p>
        </div>

        {entries.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--lavender)] mx-auto flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-[var(--ink)]" strokeWidth={1.5} />
            </div>
            <div className="text-[var(--ink)] font-medium text-lg">No saved invoices yet</div>
            <div className="text-sm text-[var(--ink-muted)] mt-1.5 max-w-sm mx-auto">
              Generate and download an invoice and it will appear here for easy re-download.
            </div>
            <Link href="/" className="btn-ink mt-6 !py-2.5">
              Create one
            </Link>
          </div>
        ) : null}

        {entries.length > 0 ? (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--cream-1)] text-[var(--ink-muted)] text-[10px] uppercase tracking-[0.14em]">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Invoice #</th>
                  <th className="text-left px-4 py-3 font-medium">Vendor</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-right px-4 py-3 w-[1%] font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.invoice.invoiceNo}
                    className="border-t border-[rgba(11,15,30,0.06)] hover:bg-[var(--cream-1)]/60 transition-colors"
                  >
                    <td className="px-4 py-3.5 font-mono text-xs">{e.invoice.invoiceNo}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium">{e.invoice.vendor.name}</div>
                      <div className="text-xs text-[var(--ink-muted)]">
                        {e.invoice.interState ? "IGST" : "CGST+SGST"}
                        {e.invoice.customerName ? ` · to ${e.invoice.customerName}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-[var(--ink-soft)]">
                      {formatDateDMY(e.invoice.date)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded-full bg-[var(--cream-1)] px-2.5 py-0.5 text-xs">
                        {CATEGORY_LABELS[e.invoice.category]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold tabular">
                      ₹{inrFormat(e.invoice.total)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <div className="bg-[var(--ink)] rounded-full">
                          <PDFDownload invoice={e.invoice} />
                        </div>
                        <button
                          type="button"
                          onClick={() => onDuplicate(e.invoice.invoiceNo)}
                          className="inline-flex items-center gap-1 w-9 h-9 justify-center rounded-full border border-[rgba(11,15,30,0.14)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--cream-1)] transition-colors"
                          title="Duplicate as new invoice"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(e.invoice.invoiceNo, e.invoice.vendor.name)}
                          className="inline-flex items-center gap-1 w-9 h-9 justify-center rounded-full border border-[rgba(11,15,30,0.14)] text-[var(--ink-muted)] hover:text-[var(--rust)] hover:bg-[rgba(180,84,58,0.08)] hover:border-[rgba(180,84,58,0.25)] transition-colors"
                          title="Delete from history"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </div>
  );
}
