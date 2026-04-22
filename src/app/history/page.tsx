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
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5" strokeWidth={2} />
            <div>
              <div className="font-semibold tracking-tight">Flexi Invoice</div>
              <div className="text-xs text-neutral-500">Saved invoice history</div>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-black"
          >
            <ArrowLeft className="w-4 h-4" /> Back to new invoice
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">History</h1>
        <p className="text-sm text-neutral-600 mb-6">
          Invoices are saved in this browser the moment you click download. They never leave your
          machine.
        </p>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center">
            <div className="text-neutral-700 font-medium">No saved invoices yet</div>
            <div className="text-sm text-neutral-500 mt-1">
              Generate and download an invoice to see it here.
            </div>
            <Link
              href="/"
              className="mt-4 inline-block px-3.5 py-2 rounded-md bg-black text-white text-sm hover:bg-neutral-800"
            >
              Create one
            </Link>
          </div>
        ) : null}

        {entries.length > 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Invoice #</th>
                  <th className="text-left px-4 py-3">Vendor</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-right px-4 py-3 w-[1%]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.invoice.invoiceNo} className="border-t border-neutral-100">
                    <td className="px-4 py-3 font-mono text-xs">{e.invoice.invoiceNo}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{e.invoice.vendor.name}</div>
                      <div className="text-xs text-neutral-500">
                        {e.invoice.interState ? "IGST" : "CGST+SGST"}
                        {e.invoice.customerName ? ` · to ${e.invoice.customerName}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDateDMY(e.invoice.date)}
                    </td>
                    <td className="px-4 py-3">{CATEGORY_LABELS[e.invoice.category]}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      Rs. {inrFormat(e.invoice.total)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <PDFDownload invoice={e.invoice} />
                        <button
                          type="button"
                          onClick={() => onDuplicate(e.invoice.invoiceNo)}
                          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-md border border-neutral-300 text-neutral-700 text-sm hover:bg-neutral-50"
                          title="Duplicate as new invoice"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(e.invoice.invoiceNo, e.invoice.vendor.name)}
                          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-md border border-neutral-300 text-neutral-600 text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-300"
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
