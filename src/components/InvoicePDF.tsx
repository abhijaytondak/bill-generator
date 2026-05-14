"use client";

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Invoice } from "@/lib/types";
import { inrFormat } from "@/lib/invoice";

// 80mm thermal receipt width in points
const W = 227;
const PAD = 12;

const s = StyleSheet.create({
  page: {
    width: W,
    paddingHorizontal: PAD,
    paddingTop: 16,
    paddingBottom: 16,
    fontSize: 8,
    fontFamily: "Courier",
    color: "#111111",
    backgroundColor: "#ffffff",
  },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
  bold: { fontFamily: "Courier-Bold" },
  heading: { fontSize: 11, fontFamily: "Courier-Bold", textAlign: "center" },
  subheading: { fontSize: 9, fontFamily: "Courier-Bold", textAlign: "center" },
  small: { fontSize: 7 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  mb1: { marginBottom: 1 },
  mb2: { marginBottom: 2 },
  mb3: { marginBottom: 3 },
  mb5: { marginBottom: 5 },
  dash: { borderTopWidth: 1, borderTopStyle: "dashed", borderTopColor: "#111", marginVertical: 6 },
  // Table columns
  colItem: { flex: 1 },
  colQty: { width: 22, textAlign: "center" },
  colRate: { width: 40, textAlign: "right" },
  colAmt: { width: 44, textAlign: "right" },
});

function receiptDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "pm" : "am";
    const h12 = h % 12 || 12;
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")} ${d.getFullYear()} at ${h12}:${m}${ampm}`;
  } catch {
    return iso;
  }
}

export function InvoicePDF({ invoice }: { invoice: Invoice }) {
  const v = invoice.vendor;
  const itemCount = invoice.items.reduce((sum, it) => sum + (it.quantity || 1), 0);
  const taxTotal = invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount;

  // Header name: prefer vendor name, fall back to claimant name
  const headerName = v.name || invoice.customerName || "Receipt";

  return (
    <Document title={`Receipt ${invoice.invoiceNo}`}>
      <Page size={[W, 900]} style={s.page}>

        {/* Store / vendor name */}
        <Text style={[s.heading, s.mb2]}>{headerName}</Text>
        <Text style={[s.center, s.mb1]}>Thanks For Your Visit!</Text>

        <View style={s.dash} />

        {/* Customer + bill number */}
        <View style={[s.row, s.mb1]}>
          <Text>Customer Name:</Text>
          <Text style={s.bold}>{invoice.customerName || "Walk in Customer"}</Text>
        </View>
        <View style={s.row}>
          <Text>Bill No:</Text>
          <Text style={s.bold}>{invoice.invoiceNo}</Text>
        </View>

        <View style={s.dash} />

        {/* Order heading + date */}
        <Text style={[s.subheading, s.mb1]}>Your Order</Text>
        <Text style={[s.center, s.small, s.mb1]}>{receiptDate(invoice.date)}</Text>

        <View style={s.dash} />

        {/* Column headers */}
        <View style={[{ flexDirection: "row" }, s.mb2]}>
          <Text style={[s.bold, s.colItem]}>Item</Text>
          <Text style={[s.bold, s.colQty]}>Qty</Text>
          <Text style={[s.bold, s.colRate]}>Rate</Text>
          <Text style={[s.bold, s.colAmt]}>Amt</Text>
        </View>
        <View style={s.dash} />

        {/* Line items */}
        {invoice.items.map((it, i) => (
          <View key={i} style={s.mb3}>
            {/* Item name on its own line */}
            <Text style={[s.bold, s.mb1]}>
              {(it.merchantName || it.description || "").toUpperCase()}
            </Text>
            {/* Description sub-line when different from merchant */}
            {it.merchantName && it.description && it.description !== it.merchantName ? (
              <Text style={[s.small, s.mb1, { color: "#555" }]}>{it.description}</Text>
            ) : null}
            {/* Date / ref sub-line */}
            {it.transactionDate ? (
              <Text style={[s.small, s.mb1, { color: "#555" }]}>
                {receiptDate(it.transactionDate)}
              </Text>
            ) : null}
            {it.txnRef ? (
              <Text style={[s.small, s.mb1, { color: "#555" }]}>Ref: {it.txnRef}</Text>
            ) : null}
            {/* Qty / rate / amount row */}
            <View style={{ flexDirection: "row" }}>
              <Text style={s.colItem} />
              <Text style={s.colQty}>{it.quantity}</Text>
              <Text style={s.colRate}>{inrFormat(it.rate)}</Text>
              <Text style={[s.colAmt, s.bold]}>{inrFormat(it.total ?? it.amount)}</Text>
            </View>
          </View>
        ))}

        <View style={s.dash} />

        {/* Totals */}
        <View style={s.row}>
          <Text>Subtotal</Text>
          <Text>{inrFormat(invoice.subtotal)}</Text>
        </View>
        {taxTotal > 0 ? (
          <>
            {invoice.cgstAmount > 0 ? (
              <View style={s.row}>
                <Text>CGST @ {invoice.cgstRate}%</Text>
                <Text>{inrFormat(invoice.cgstAmount)}</Text>
              </View>
            ) : null}
            {invoice.sgstAmount > 0 ? (
              <View style={s.row}>
                <Text>SGST @ {invoice.sgstRate}%</Text>
                <Text>{inrFormat(invoice.sgstAmount)}</Text>
              </View>
            ) : null}
            {invoice.igstAmount > 0 ? (
              <View style={s.row}>
                <Text>IGST @ {invoice.igstRate}%</Text>
                <Text>{inrFormat(invoice.igstAmount)}</Text>
              </View>
            ) : null}
          </>
        ) : null}
        <View style={[s.row, s.mb1]}>
          <Text style={s.bold}>
            Total ({itemCount} {itemCount === 1 ? "item" : "items"})
          </Text>
          <Text style={s.bold}>{inrFormat(invoice.total)}</Text>
        </View>

        <View style={s.dash} />

        {/* Payment */}
        <View style={[s.row, s.mb1]}>
          <Text>Paid Via</Text>
          <Text />
        </View>
        <View style={s.row}>
          <Text style={s.bold}>{invoice.paymentMethod || "UPI"}</Text>
          <Text style={s.bold}>{inrFormat(invoice.total)}</Text>
        </View>
        {invoice.txnRef ? (
          <Text style={[s.small, { color: "#555", marginTop: 2 }]}>Ref: {invoice.txnRef}</Text>
        ) : null}

        <View style={s.dash} />

        {/* Footer */}
        <Text style={[s.center, s.small, s.mb1]}>
          NO REFUND | NO RETURN | NO EXCHANGE
        </Text>
        <Text style={[s.center, s.small, s.bold]}>{headerName}</Text>

      </Page>
    </Document>
  );
}
