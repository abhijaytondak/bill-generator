"use client";

import { PDFViewer } from "@react-pdf/renderer";
import type { Invoice } from "@/lib/types";
import { InvoicePDF } from "./InvoicePDF";

export default function PDFPreview({ invoice }: { invoice: Invoice }) {
  return (
    <PDFViewer
      width="100%"
      height="100%"
      showToolbar={false}
      style={{ border: "none", backgroundColor: "#f5f5f5" }}
    >
      <InvoicePDF invoice={invoice} />
    </PDFViewer>
  );
}
