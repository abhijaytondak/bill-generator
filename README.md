# Flexi Invoice

Flexi Invoice helps prepare flexi-benefit reimbursement evidence from real payment screenshots. Upload multiple UPI or card transaction screenshots, review the OCR output, and download one expense claim statement with merchant, date, time, transaction reference, category, amount and GST split.

This app is for organizing legitimate reimbursement proofs. Keep the original merchant receipts/screenshots and follow your company payroll or finance policy.

## Features

- Batch upload PNG, JPG, JPEG and WebP screenshots, up to 10MB each.
- Browser-side OCR with Tesseract.js for merchant, amount, date, time, transaction ID and payment mode.
- Editable review table before PDF generation.
- Category-based GST/HSN rules for food, business travel, phone/internet, education, health & fitness, fuel, hostel, driver's salary, books, professional development, uniform, gifts and vehicle maintenance.
- Approval-readiness guidance that checks required fields and proof expectations without fabricating receipt details.
- Downloadable PDF expense statement with original transaction references.
- Local browser history and saved vendor data via `localStorage`.
- Optional AWS Textract validation endpoint for generated PDFs.

## Getting Started

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build And Lint

```bash
npm run lint
npm run build
```

`next/font` fetches Google fonts during production builds, so the build environment needs network access unless the fonts are self-hosted.

## Optional AWS Textract Validation

Create `.env.local` if you want the Validate button to call Textract:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

The validation route accepts PDFs/images up to 10MB and is intended for local or protected deployments.

## Main Files

- `src/app/page.tsx` - batch upload, OCR, review and statement generation workflow.
- `src/lib/ocr.ts` - Tesseract OCR wrapper.
- `src/lib/parsers.ts` - text parsers for amount, date, time, merchant and transaction ID.
- `src/lib/invoice.ts` - GST math, line item calculations and statement construction.
- `src/lib/categoryRules.ts` - flexi-benefit category rules, evidence checklists and approval warnings.
- `src/components/InvoicePDF.tsx` - PDF rendering.
