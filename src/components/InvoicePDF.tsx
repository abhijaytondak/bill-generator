"use client";

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Invoice } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { amountInWords, formatDateDMY, formatDateTimeDMY, inrFormat } from "@/lib/invoice";

const colors = {
  ink: "#111111",
  muted: "#555555",
  line: "#222222",
  soft: "#dddddd",
  band: "#f2f2f2",
};

const s = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: colors.ink,
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: colors.line,
    paddingBottom: 12,
    marginBottom: 14,
  },
  invoiceTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    marginBottom: 4,
    textAlign: "right",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  vendorBlock: {
    flexDirection: "column",
    maxWidth: "60%",
  },
  vendorName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  vendorLine: {
    fontSize: 9,
    color: colors.muted,
    marginBottom: 1,
  },
  gstinLine: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
  },
  metaBlock: {
    flexDirection: "column",
    alignItems: "flex-end",
    minWidth: 200,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 9,
    color: colors.muted,
    width: 90,
    textAlign: "right",
    marginRight: 8,
  },
  metaValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    minWidth: 110,
  },
  billToBlock: {
    marginTop: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.soft,
  },
  sectionLabel: {
    fontSize: 8,
    color: colors.muted,
    letterSpacing: 1,
    marginBottom: 3,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 6,
    marginBottom: 8,
  },
  th: {
    flexDirection: "row",
    backgroundColor: colors.band,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  thText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.soft,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  cellDesc: { flex: 3.2 },
  cellHSN: { flex: 1, textAlign: "center" },
  cellQty: { flex: 0.7, textAlign: "center" },
  cellRate: { flex: 1.3, textAlign: "right" },
  cellAmt: { flex: 1.4, textAlign: "right" },
  cellMeta: { flex: 1.5, textAlign: "left" },
  totalsWrap: {
    alignSelf: "flex-end",
    width: "55%",
    marginTop: 4,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  totalsLabel: { fontSize: 10 },
  totalsValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: colors.ink,
    marginTop: 4,
  },
  grandLabel: { fontSize: 11, color: "#ffffff", fontFamily: "Helvetica-Bold" },
  grandValue: { fontSize: 12, color: "#ffffff", fontFamily: "Helvetica-Bold" },
  amountWords: {
    fontSize: 9,
    fontStyle: "italic",
    color: colors.muted,
    marginTop: 14,
    marginBottom: 16,
  },
  footer: {
    marginTop: "auto",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.soft,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  footerBlock: { maxWidth: "55%" },
  footerTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  footerLine: {
    fontSize: 8,
    color: colors.muted,
    marginBottom: 1,
  },
  signBlock: { alignItems: "flex-end" },
  signLine: {
    width: 140,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 30,
    paddingTop: 3,
    textAlign: "center",
    fontSize: 8,
    color: colors.muted,
  },
});

export function InvoicePDF({ invoice }: { invoice: Invoice }) {
  const v = invoice.vendor;
  const taxTotal = invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount;
  const addressLine = [v.address, v.city, v.state, v.pincode].filter(Boolean).join(", ");
  const isStatement = invoice.sourceType === "expense_statement";

  return (
    <Document title={`${isStatement ? "Expense Statement" : "Tax Invoice"} ${invoice.invoiceNo}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.invoiceTitle}>{isStatement ? "EXPENSE CLAIM STATEMENT" : "TAX INVOICE"}</Text>
          <View style={s.headerRow}>
            <View style={s.vendorBlock}>
              <Text style={s.vendorName}>{v.name}</Text>
              {isStatement ? (
                <Text style={s.vendorLine}>Prepared from uploaded transaction screenshots and receipt OCR.</Text>
              ) : (
                <>
                  {addressLine ? <Text style={s.vendorLine}>{addressLine}</Text> : null}
                  {v.phone ? <Text style={s.vendorLine}>Phone: {v.phone}</Text> : null}
                  {v.gstin ? (
                    <Text style={s.gstinLine}>GSTIN: {v.gstin}</Text>
                  ) : (
                    <Text style={s.vendorLine}>Unregistered under GST</Text>
                  )}
                </>
              )}
            </View>
            <View style={s.metaBlock}>
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>{isStatement ? "Statement No:" : "Invoice No:"}</Text>
                <Text style={s.metaValue}>{invoice.invoiceNo}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>{isStatement ? "Statement Date:" : "Invoice Date:"}</Text>
                <Text style={s.metaValue}>{formatDateDMY(invoice.date)}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Category:</Text>
                <Text style={s.metaValue}>{CATEGORY_LABELS[invoice.category]}</Text>
              </View>
              {invoice.customerState || v.state ? (
                <View style={s.metaRow}>
                  <Text style={s.metaLabel}>Place of Supply:</Text>
                  <Text style={s.metaValue}>{invoice.customerState || v.state}</Text>
                </View>
              ) : null}
              {!isStatement ? (
                <View style={s.metaRow}>
                  <Text style={s.metaLabel}>Supply Type:</Text>
                  <Text style={s.metaValue}>{invoice.interState ? "Inter-state" : "Intra-state"}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={s.billToBlock}>
          <Text style={s.sectionLabel}>{isStatement ? "CLAIMANT" : "BILL TO"}</Text>
          <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold" }}>
            {invoice.customerName || "Walk-in Customer"}
          </Text>
          {invoice.customerGstin ? (
            <Text style={s.vendorLine}>GSTIN: {invoice.customerGstin}</Text>
          ) : null}
          {invoice.customerState ? (
            <Text style={s.vendorLine}>State: {invoice.customerState}</Text>
          ) : null}
        </View>

        <View style={s.table}>
          <View style={s.th}>
            <Text style={[s.thText, s.cellDesc]}>DESCRIPTION</Text>
            {isStatement ? <Text style={[s.thText, s.cellMeta]}>MERCHANT / DATE</Text> : null}
            <Text style={[s.thText, s.cellHSN]}>HSN/SAC</Text>
            <Text style={[s.thText, s.cellQty]}>QTY</Text>
            <Text style={[s.thText, s.cellRate]}>RATE</Text>
            <Text style={[s.thText, s.cellAmt]}>AMOUNT</Text>
          </View>
          {invoice.items.map((it, i) => (
            <View key={i} style={s.tr}>
              <Text style={s.cellDesc}>
                {it.description}
                {it.category ? ` (${CATEGORY_LABELS[it.category]})` : ""}
              </Text>
              {isStatement ? (
                <Text style={s.cellMeta}>
                  {it.merchantName || "-"}
                  {it.transactionDate ? `\n${formatDateTimeDMY(it.transactionDate)}` : ""}
                  {it.txnRef ? `\nRef: ${it.txnRef}` : ""}
                </Text>
              ) : null}
              <Text style={s.cellHSN}>{it.hsn || "-"}</Text>
              <Text style={s.cellQty}>{it.quantity}</Text>
              <Text style={s.cellRate}>{inrFormat(it.rate)}</Text>
              <Text style={s.cellAmt}>{inrFormat(it.total ?? it.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totalsWrap}>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Sub Total</Text>
            <Text style={s.totalsValue}>Rs. {inrFormat(invoice.subtotal)}</Text>
          </View>
          {invoice.igstRate > 0 ? (
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>IGST @ {invoice.igstRate}%</Text>
              <Text style={s.totalsValue}>Rs. {inrFormat(invoice.igstAmount)}</Text>
            </View>
          ) : null}
          {invoice.cgstRate > 0 ? (
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>CGST @ {invoice.cgstRate}%</Text>
              <Text style={s.totalsValue}>Rs. {inrFormat(invoice.cgstAmount)}</Text>
            </View>
          ) : null}
          {invoice.sgstRate > 0 ? (
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>SGST @ {invoice.sgstRate}%</Text>
              <Text style={s.totalsValue}>Rs. {inrFormat(invoice.sgstAmount)}</Text>
            </View>
          ) : null}
          {invoice.cgstRate === 0 && invoice.sgstRate === 0 && invoice.igstRate === 0 ? (
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Tax</Text>
              <Text style={s.totalsValue}>Rs. 0.00</Text>
            </View>
          ) : null}
          <View style={s.grandTotalRow}>
            <Text style={s.grandLabel}>TOTAL</Text>
            <Text style={s.grandValue}>Rs. {inrFormat(invoice.total)}</Text>
          </View>
        </View>

        <Text style={s.amountWords}>Amount in words: {amountInWords(invoice.total)}</Text>

        <View style={s.footer}>
          <View style={s.footerRow}>
            <View style={s.footerBlock}>
              <Text style={s.footerTitle}>{isStatement ? "Claim Notes" : "Payment Details"}</Text>
              <Text style={s.footerLine}>Method: {invoice.paymentMethod}</Text>
              {invoice.txnRef ? (
                <Text style={s.footerLine}>Reference: {invoice.txnRef}</Text>
              ) : null}
              <Text style={s.footerLine}>Tax total: Rs. {inrFormat(taxTotal)}</Text>
              {isStatement ? (
                <Text style={s.footerLine}>Verify against original screenshots before filing with payroll or finance.</Text>
              ) : null}
            </View>
            <View style={s.signBlock}>
              <Text style={s.footerLine}>For {isStatement ? invoice.customerName || "Claimant" : v.name}</Text>
              <Text style={s.signLine}>{isStatement ? "Claimant Signature" : "Authorised Signatory"}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
