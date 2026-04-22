"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { Download, Loader2 } from "lucide-react";
import type { Invoice } from "@/lib/types";
import { InvoicePDF } from "./InvoicePDF";
import { saveToHistory } from "@/lib/history";

export default function PDFDownloadButton({ invoice }: { invoice: Invoice }) {
  const filename = `invoice-${invoice.invoiceNo.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  return (
    <PDFDownloadLink
      document={<InvoicePDF invoice={invoice} />}
      fileName={filename}
      onClick={() => {
        try {
          saveToHistory(invoice);
        } catch {
          // localStorage may be unavailable (private mode, quota) — don't block the download
        }
      }}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-black text-white text-sm hover:bg-neutral-800 transition-colors"
    >
      {({ loading }) =>
        loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Preparing...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" /> Download PDF
          </>
        )
      }
    </PDFDownloadLink>
  );
}
