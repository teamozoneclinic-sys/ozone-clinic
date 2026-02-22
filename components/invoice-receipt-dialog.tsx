"use client"

import { useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Download, MessageCircle, Heart, CheckCircle2 } from "lucide-react"
import type { Invoice, Patient, Doctor, Payment } from "@/lib/types"
import type { ClinicInfo } from "@/lib/types"

interface InvoiceReceiptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice
  patient: Patient | undefined
  doctor: Doctor | undefined
  latestPayment: Payment
  clinicSettings: ClinicInfo
}

// ─── Build WhatsApp message text ─────────────────────────────────────────────
function buildWhatsAppText(
  invoice: Invoice,
  patient: Patient | undefined,
  doctor: Doctor | undefined,
  payment: Payment,
  clinic: ClinicInfo
): string {
  const lines = [
    `*${clinic.name} — Payment Receipt*`,
    `Invoice #: ${invoice.id.slice(-8).toUpperCase()}`,
    `Date: ${new Date(payment.collectedAt).toLocaleString("en-PK")}`,
    ``,
    `*Patient:* ${patient?.name ?? "—"}`,
    `*Doctor:* ${doctor?.name ?? "—"} (${doctor?.specialty ?? ""})`,
    ``,
    `*Bill Summary:*`,
    ...invoice.lineItems.map((item) => `  • ${item.description}: Rs. ${item.amount * item.quantity}`),
    ``,
    `*Total:* Rs. ${invoice.totalAmount}`,
    `*Paid Now:* Rs. ${payment.amount}`,
    `*Balance:* Rs. ${invoice.balance}`,
    ``,
    `Payment Method: ${payment.method.replace("-", " ")}`,
    payment.reference ? `Reference: ${payment.reference}` : "",
    ``,
    `Thank you for choosing ${clinic.name}!`,
    clinic.phone ? `Contact: ${clinic.phone}` : "",
  ]
    .filter(Boolean)
    .join("%0A")
  return lines
}

// ─── Print helper — opens a new window with styled receipt HTML ───────────────
function printReceipt(html: string) {
  const win = window.open("", "_blank", "width=800,height=900")
  if (!win) return
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice Receipt</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; }
    .page { max-width: 700px; margin: 0 auto; padding: 32px 40px; }
    .header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #0f766e; }
    .logo-box { width: 56px; height: 56px; border-radius: 12px; background: #0f766e; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
    .logo-box img { width: 100%; height: 100%; object-fit: cover; }
    .logo-box svg { width: 28px; height: 28px; color: #fff; }
    .clinic-name { font-size: 20px; font-weight: 700; color: #0f766e; }
    .clinic-sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .receipt-title { text-align: right; margin-left: auto; }
    .receipt-title h1 { font-size: 22px; font-weight: 800; color: #0f766e; letter-spacing: 2px; }
    .receipt-title p { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .status-badge { display: inline-block; background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; border-radius: 20px; padding: 4px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .meta-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
    .meta-box .label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
    .meta-box .value { font-size: 13px; font-weight: 600; color: #111827; }
    .meta-box .sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .section-title { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; text-align: left; font-size: 11px; color: #6b7280; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
    th.right { text-align: right; }
    td { padding: 9px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
    td.right { text-align: right; }
    td.cap { text-transform: capitalize; font-size: 11px; }
    .total-row td { font-weight: 700; font-size: 14px; background: #f9fafb; }
    .payment-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 10px; }
    .payment-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 14px; }
    .payment-box.red { background: #fff7ed; border-color: #fed7aa; }
    .payment-box .label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
    .payment-box .amount { font-size: 18px; font-weight: 800; color: #065f46; }
    .payment-box.red .amount { color: #c2410c; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }
    .footer { text-align: center; font-size: 11px; color: #9ca3af; margin-top: 24px; padding-top: 16px; border-top: 1px dashed #d1d5db; }
    .footer strong { color: #0f766e; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${html}
  </div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`)
  win.document.close()
}

// ─── Receipt HTML builder ─────────────────────────────────────────────────────
function buildReceiptHTML(
  invoice: Invoice,
  patient: Patient | undefined,
  doctor: Doctor | undefined,
  payment: Payment,
  clinic: ClinicInfo
): string {
  const invoiceNo = invoice.id.slice(-8).toUpperCase()
  const payDate = new Date(payment.collectedAt).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  })
  const createdDate = new Date(invoice.createdAt).toLocaleDateString("en-PK", {
    dateStyle: "medium",
  })

  const logoHTML = clinic.logo
    ? `<img src="${clinic.logo}" alt="logo" />`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`

  const lineItemsRows = invoice.lineItems
    .map(
      (item) => `
    <tr>
      <td>${item.description}</td>
      <td class="cap">${item.category}</td>
      <td class="right">${item.quantity}</td>
      <td class="right">Rs. ${(item.amount * item.quantity).toLocaleString()}</td>
    </tr>`
    )
    .join("")

  const balanceZero = invoice.balance <= 0

  return `
  <div class="header">
    <div class="logo-box">${logoHTML}</div>
    <div>
      <div class="clinic-name">${clinic.name}</div>
      <div class="clinic-sub">${[clinic.address, clinic.phone, clinic.email].filter(Boolean).join(" · ")}</div>
    </div>
    <div class="receipt-title">
      <h1>RECEIPT</h1>
      <p>#${invoiceNo}</p>
    </div>
  </div>

  <div class="status-badge">${balanceZero ? "✓ FULLY PAID" : "⚡ PARTIALLY PAID"}</div>

  <div class="meta-grid">
    <div class="meta-box">
      <div class="label">Patient</div>
      <div class="value">${patient?.name ?? "—"}</div>
      <div class="sub">${[patient?.phone, patient?.age ? `Age ${patient.age}` : ""].filter(Boolean).join(" · ")}</div>
    </div>
    <div class="meta-box">
      <div class="label">Doctor</div>
      <div class="value">${doctor?.name ?? "—"}</div>
      <div class="sub">${doctor?.specialty ?? ""}</div>
    </div>
    <div class="meta-box">
      <div class="label">Invoice Date</div>
      <div class="value">${createdDate}</div>
    </div>
    <div class="meta-box">
      <div class="label">Payment Date</div>
      <div class="value">${payDate}</div>
      <div class="sub">Collected by: ${payment.collectedBy}</div>
    </div>
  </div>

  <div class="section-title">Bill Items</div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Category</th>
        <th class="right">Qty</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsRows}
      <tr class="total-row">
        <td colspan="3" style="text-align:right; padding-right: 12px;">Grand Total</td>
        <td class="right">Rs. ${invoice.totalAmount.toLocaleString()}</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title" style="margin-top: 24px;">Payment Details</div>
  <table>
    <thead>
      <tr>
        <th>Method</th>
        <th>Reference</th>
        <th>Collected By</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="cap">${payment.method.replace("-", " ")}</td>
        <td style="font-family: monospace; font-size: 11px;">${payment.reference || "—"}</td>
        <td>${payment.collectedBy}</td>
        <td class="right" style="font-weight: 700; color: #065f46;">Rs. ${payment.amount.toLocaleString()}</td>
      </tr>
    </tbody>
  </table>

  <div class="payment-grid" style="margin-top: 20px;">
    <div class="payment-box">
      <div class="label">Total Bill</div>
      <div class="amount">Rs. ${invoice.totalAmount.toLocaleString()}</div>
    </div>
    <div class="payment-box">
      <div class="label">Total Paid</div>
      <div class="amount">Rs. ${invoice.paidAmount.toLocaleString()}</div>
    </div>
    <div class="payment-box ${balanceZero ? "" : "red"}">
      <div class="label">Balance Due</div>
      <div class="amount">Rs. ${invoice.balance.toLocaleString()}</div>
    </div>
  </div>

  ${payment.notes ? `<div style="margin-top: 16px; font-size: 12px; color: #6b7280;"><strong>Notes:</strong> ${payment.notes}</div>` : ""}

  <div class="footer">
    <strong>Thank you for choosing ${clinic.name}!</strong><br/>
    ${clinic.address ? clinic.address + "<br/>" : ""}
    ${[clinic.phone, clinic.email, clinic.website].filter(Boolean).join(" · ")}
  </div>`
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────
export function InvoiceReceiptDialog({
  open,
  onOpenChange,
  invoice,
  patient,
  doctor,
  latestPayment,
  clinicSettings,
}: InvoiceReceiptDialogProps) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const balanceZero = invoice.balance <= 0

  const handlePrint = () => {
    const html = buildReceiptHTML(invoice, patient, doctor, latestPayment, clinicSettings)
    printReceipt(html)
  }

  const handleWhatsApp = () => {
    if (!patient?.phone) return
    const text = buildWhatsAppText(invoice, patient, doctor, latestPayment, clinicSettings)
    window.open(`https://wa.me/?text=${text}`, "_blank")
  }

  const payDate = new Date(latestPayment.collectedAt).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] p-0 gap-0 overflow-hidden">
        {/* Action bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
          <div>
            <DialogTitle className="text-sm font-semibold">Payment Collected</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Receipt for Invoice #{invoice.id.slice(-8).toUpperCase()}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-[#25D366] border-[#25D366]/40 hover:bg-[#25D366]/5"
              onClick={handleWhatsApp}
              title="Share on WhatsApp (non-functional demo)"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handlePrint}>
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </div>

        {/* Receipt preview */}
        <div
          ref={receiptRef}
          className="overflow-y-auto max-h-[70vh] p-5 bg-white"
        >
          {/* Header */}
          <div className="flex items-start gap-4 pb-4 border-b border-gray-200">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary overflow-hidden">
              {clinicSettings.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={clinicSettings.logo} alt="logo" className="h-full w-full object-cover" />
              ) : (
                <Heart className="h-6 w-6 text-primary-foreground" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-base font-bold text-primary">{clinicSettings.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {[clinicSettings.address, clinicSettings.phone, clinicSettings.email]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-primary tracking-widest">RECEIPT</p>
              <p className="text-xs text-gray-500">#{invoice.id.slice(-8).toUpperCase()}</p>
            </div>
          </div>

          {/* Status */}
          <div className="mt-3 mb-4">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                balanceZero
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {balanceZero ? "Fully Paid" : "Partially Paid"}
            </span>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: "Patient", value: patient?.name ?? "—", sub: [patient?.phone, patient?.age ? `Age ${patient.age}` : ""].filter(Boolean).join(" · ") },
              { label: "Doctor", value: doctor?.name ?? "—", sub: doctor?.specialty ?? "" },
              { label: "Invoice Date", value: new Date(invoice.createdAt).toLocaleDateString("en-PK", { dateStyle: "medium" }), sub: "" },
              { label: "Payment Date", value: payDate, sub: `By: ${latestPayment.collectedBy}` },
            ].map(({ label, value, sub }) => (
              <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-gray-900">{value}</p>
                {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>

          {/* Line items */}
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-2">Bill Items</p>
          <div className="rounded-lg border border-gray-100 overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2 text-xs capitalize text-gray-500">{item.category}</td>
                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-right font-medium">Rs. {(item.amount * item.quantity).toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={3} className="px-3 py-2 text-right font-bold text-sm">Grand Total</td>
                  <td className="px-3 py-2 text-right font-black text-base">Rs. {invoice.totalAmount.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payment details */}
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-2">Payment Details</p>
          <div className="rounded-lg border border-gray-100 overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2 text-left">Method</th>
                  <th className="px-3 py-2 text-left">Reference</th>
                  <th className="px-3 py-2 text-left">Collected By</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 capitalize">{latestPayment.method.replace("-", " ")}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{latestPayment.reference || "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{latestPayment.collectedBy}</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-600">Rs. {latestPayment.amount.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {latestPayment.notes && (
            <p className="text-xs text-gray-500 mb-4"><span className="font-semibold">Notes:</span> {latestPayment.notes}</p>
          )}

          {/* Totals */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Total Bill</p>
              <p className="text-lg font-black text-gray-900">Rs. {invoice.totalAmount.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-emerald-500 mb-1">Total Paid</p>
              <p className="text-lg font-black text-emerald-700">Rs. {invoice.paidAmount.toLocaleString()}</p>
            </div>
            <div className={`rounded-lg border px-3 py-3 text-center ${
              balanceZero
                ? "border-emerald-100 bg-emerald-50"
                : "border-orange-100 bg-orange-50"
            }`}>
              <p className={`text-[10px] uppercase tracking-wide mb-1 ${balanceZero ? "text-emerald-500" : "text-orange-500"}`}>
                Balance Due
              </p>
              <p className={`text-lg font-black ${balanceZero ? "text-emerald-700" : "text-orange-700"}`}>
                Rs. {invoice.balance.toLocaleString()}
              </p>
            </div>
          </div>

          <Separator className="mb-3" />

          {/* Footer */}
          <div className="text-center text-xs text-gray-400">
            <p className="font-semibold text-primary text-sm">Thank you for choosing {clinicSettings.name}!</p>
            {clinicSettings.address && <p className="mt-0.5">{clinicSettings.address}</p>}
            <p className="mt-0.5">
              {[clinicSettings.phone, clinicSettings.email, clinicSettings.website]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
