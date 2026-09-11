# ServeHub 1.0 — PDF Export

## Overview

PDF generation is fully client-side using jsPDF + jspdf-autotable.
No server-side rendering or print dialogs are triggered.

## Branded Output

Every PDF includes:

- Restaurant name
- Logo (if configured)
- Primary color (header band, table headers)
- Report title
- Generation date

## Supported Reports

- **Order receipt** — single order with items, totals, status history
- **Order summary** — bulk export of filtered orders

## Usage

- Orders view → PDF icon on any order card → single receipt
- Orders view → "Exportar PDF" button → bulk summary

## No Automatic Printing

PDFs are downloaded/saved to the user's device. Printing is a manual
user operation performed outside the application.
