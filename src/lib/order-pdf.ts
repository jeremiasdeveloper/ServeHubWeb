// ServeHub — client-side PDF export for orders (professional receipt style)
//
// This module is loaded lazily (dynamic import) from the orders view so
// jsPDF never bloats the initial bundle. Every order renders as a clean,
// professional receipt page: branded header band, order metadata, an
// items table and a highlighted total block.

import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { OrderInfo } from "./types"
import type { ServeHubConfig } from "./config"
import type { TranslationKey } from "./i18n"

type Vars = Record<string, string | number>
type TFn = (key: TranslationKey, vars?: Vars) => string

interface Rgb {
  r: number
  g: number
  b: number
}

function hexToRgb(hex: string): Rgb {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || "").trim())
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : { r: 232, g: 93, b: 117 }
}

const MARGIN = 48

function headerBand(doc: jsPDF, config: ServeHubConfig | null, rightTitle: string, rightSub: string) {
  const W = doc.internal.pageSize.getWidth()
  const primary = hexToRgb(config?.branding.primaryColor ?? "#E85D75")
  const name = config?.restaurant.name ?? "ServeHub"
  const tagline = config?.restaurant.tagline ?? ""

  doc.setFillColor(primary.r, primary.g, primary.b)
  doc.rect(0, 0, W, 92, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(20)
  doc.text(name, MARGIN, 42)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  if (tagline) doc.text(tagline, MARGIN, 58)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text(rightTitle, W - MARGIN, 42, { align: "right" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(rightSub, W - MARGIN, 58, { align: "right" })
}

function drawReceipt(doc: jsPDF, order: OrderInfo, config: ServeHubConfig | null, t: TFn) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const primary = hexToRgb(config?.branding.primaryColor ?? "#E85D75")
  const tr = (key: string, vars?: Vars) => t(key as never, vars)
  const status = (s: string) => t(`status.${s}` as never)

  headerBand(doc, config, tr("pdf.receiptTitle"), `#${order.number}`)

  // ---- Meta grid -------------------------------------------------------
  let y = 118
  const meta: [string, string][] = [
    [tr("pdf.orderNumber"), `#${order.number}`],
    [tr("pdf.date"), new Date(order.createdAt).toLocaleString()],
    [`${tr("orders.table")}`, order.table.number],
    [tr("orders.createdBy"), order.createdBy.displayName],
    [tr("pdf.status"), status(order.status)],
    ...(order.assignedTo ? ([[tr("pdf.waiter"), order.assignedTo.displayName]] as [string, string][]) : []),
  ]
  const colW = (W - 2 * MARGIN) / 2
  meta.forEach(([label, value], i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = MARGIN + col * colW
    const yy = y + row * 30
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(130, 130, 130)
    doc.text(label.toUpperCase(), x, yy)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10.5)
    doc.setTextColor(35, 35, 35)
    doc.text(value, x, yy + 13)
  })
  y += Math.ceil(meta.length / 2) * 30 + 6

  doc.setDrawColor(232, 232, 232)
  doc.setLineWidth(1)
  doc.line(MARGIN, y, W - MARGIN, y)
  y += 20

  // ---- Items table -----------------------------------------------------
  autoTable(doc, {
    startY: y,
    head: [[tr("pdf.qty"), tr("pdf.description"), tr("pdf.unitPrice"), tr("pdf.amount")]],
    body: order.items.map((it) => [
      String(it.quantity),
      it.notes ? `${it.name}  ·  ${it.notes}` : it.name,
      `$${it.price.toFixed(2)}`,
      `$${(it.price * it.quantity).toFixed(2)}`,
    ]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      cellPadding: 7,
      lineColor: [238, 238, 238],
      textColor: [45, 45, 45],
    },
    headStyles: {
      fillColor: [primary.r, primary.g, primary.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9.5,
    },
    alternateRowStyles: { fillColor: [252, 250, 250] },
    columnStyles: {
      0: { cellWidth: 52, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 84, halign: "right" },
      3: { cellWidth: 84, halign: "right" },
    },
    margin: { left: MARGIN, right: MARGIN },
  })

  const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y = lastY + 22

  // ---- Total block ------------------------------------------------------
  const boxW = 220
  doc.setFillColor(252, 250, 250)
  doc.setDrawColor(primary.r, primary.g, primary.b)
  doc.setLineWidth(1.2)
  doc.roundedRect(W - MARGIN - boxW, y, boxW, 34, 5, 5, "FD")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(35, 35, 35)
  doc.text(tr("orders.total"), W - MARGIN - boxW + 14, y + 22)
  doc.setFontSize(14)
  doc.text(`$${order.total.toFixed(2)}`, W - MARGIN - 14, y + 22, { align: "right" })
  y += 52

  // ---- Notes ------------------------------------------------------------
  if (order.notes) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.setTextColor(110, 110, 110)
    doc.text(`${tr("orders.notes").toUpperCase()}:`, MARGIN, y)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9.5)
    doc.setTextColor(70, 70, 70)
    const lines = doc.splitTextToSize(order.notes, W - 2 * MARGIN)
    doc.text(lines, MARGIN, y + 13)
    y += 16 + lines.length * 12
  }

  // ---- Footer -------------------------------------------------------------
  doc.setDrawColor(232, 232, 232)
  doc.line(MARGIN, H - 60, W - MARGIN, H - 60)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.text(tr("pdf.thanks"), W / 2, H - 42, { align: "center" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(tr("pdf.generated", { date: new Date().toLocaleString() }), W / 2, H - 28, { align: "center" })
}

/** Build the receipt document for a single order (page 1 = receipt). */
export function buildOrderPdfDoc(order: OrderInfo, config: ServeHubConfig | null, t: TFn): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  drawReceipt(doc, order, config, t)
  return doc
}

/** Export a single order as a professional receipt PDF. */
export function exportOrderPdf(order: OrderInfo, config: ServeHubConfig | null, t: TFn) {
  buildOrderPdfDoc(order, config, t).save(`pedido-${order.number}.pdf`)
}

/** Export many orders: one summary page + one receipt page per order. */
export function exportOrdersPdf(orders: OrderInfo[], config: ServeHubConfig | null, t: TFn) {
  const doc = buildOrdersSummaryPdfDoc(orders, config, t)
  for (const order of orders) {
    doc.addPage()
    drawReceipt(doc, order, config, t)
  }
  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`pedidos-${stamp}.pdf`)
}

/** Build the bulk-export document: summary page (receipts added by caller). */
export function buildOrdersSummaryPdfDoc(orders: OrderInfo[], config: ServeHubConfig | null, t: TFn): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const primary = hexToRgb(config?.branding.primaryColor ?? "#E85D75")
  const tr = (key: string, vars?: Vars) => t(key as never, vars)

  headerBand(doc, config, tr("pdf.summaryTitle"), new Date().toLocaleDateString())

  autoTable(doc, {
    startY: 118,
    head: [[tr("pdf.orderNumber"), tr("orders.table"), tr("pdf.date"), tr("pdf.status"), tr("orders.total")]],
    body: orders.map((o) => [
      `#${o.number}`,
      o.table.number,
      new Date(o.createdAt).toLocaleDateString(),
      t(`status.${o.status}` as never),
      `$${o.total.toFixed(2)}`,
    ]),
    foot: [
      [
        "",
        "",
        "",
        tr("pdf.grandTotal"),
        `$${orders.reduce((s, o) => s + o.total, 0).toFixed(2)}`,
      ],
    ],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      cellPadding: 6,
      lineColor: [238, 238, 238],
      textColor: [45, 45, 45],
    },
    headStyles: { fillColor: [primary.r, primary.g, primary.b], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [245, 243, 243], textColor: [35, 35, 35], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 60, halign: "center" },
      2: { cellWidth: 90, halign: "center" },
      3: { cellWidth: "auto" },
      4: { cellWidth: 80, halign: "right" },
    },
    margin: { left: MARGIN, right: MARGIN },
  })

  // Footer note on the summary page
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(tr("pdf.generated", { date: new Date().toLocaleString() }), W / 2, H - 28, { align: "center" })

  return doc
}
