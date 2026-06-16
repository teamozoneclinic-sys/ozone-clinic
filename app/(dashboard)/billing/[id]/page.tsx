"use client"

import { use, useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { User, Stethoscope, CalendarDays, CreditCard, Trash2, Download, Receipt, MessageCircle, Plus, Pencil, AlertTriangle, Loader2 } from "lucide-react"
import { PAYMENT_METHODS } from "@/lib/constants"
import { toast } from "sonner"
import Link from "next/link"
import type { Payment, Invoice } from "@/lib/types"
import { InvoiceReceiptDialog } from "@/components/invoice-receipt-dialog"

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { getInvoice, getPatient, getDoctor, getAppointment, hasPermission, currentUser, clinicSettings, voidInvoice } = useStore()
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showVoidModal, setShowVoidModal] = useState(false)
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null)
  const [sendingWA, setSendingWA] = useState(false)

  const handleSendWhatsApp = async () => {
    if (!invoice) return
    setSendingWA(true)
    try {
      const res = await fetch("/api/whatsapp/send-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id }),
      })
      if (res.ok) {
        toast.success("Receipt sent via WhatsApp!")
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? "Failed to send WhatsApp message.")
      }
    } catch {
      toast.error("Failed to send WhatsApp message.")
    } finally {
      setSendingWA(false)
    }
  }

  const invoice = getInvoice(id)
  const appointment = invoice ? getAppointment(invoice.appointmentId) : undefined

  if (!invoice) {
    return (
      <>
        <PageHeader
          title="Invoice Not Found"
          breadcrumbs={[
            { label: "Dashboard", href: "/" },
            { label: "Billing", href: "/billing" },
            { label: "Not Found" },
          ]}
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">This invoice does not exist.</p>
            <Button asChild className="mt-4">
              <Link href="/billing">Back to Billing</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  const patient = getPatient(invoice.patientId)
  const doctor = getDoctor(invoice.doctorId)
  const canCollect = hasPermission("billing.collect")
  const canVoid = hasPermission("billing.void")
  const canDiscount = hasPermission("billing.discount")
  const canEditInvoice = currentUser?.role === "admin" || currentUser?.role === "manager"

  // Last collected payment — show receipt button
  const lastPayment = invoice.payments.length > 0
    ? invoice.payments[invoice.payments.length - 1]
    : null

  return (
    <>
      <PageHeader
        title={`Invoice #${invoice.id}`}
        description={`${patient?.name ?? "Unknown"} — ${invoice.createdAt}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Billing", href: "/billing" },
          { label: `#${invoice.id}` },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {lastPayment && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setReceiptPayment(lastPayment)}
              >
                <Receipt className="h-4 w-4" />
                View Receipt
              </Button>
            )}
            {lastPayment && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-green-600 border-green-600 hover:bg-green-50"
                onClick={handleSendWhatsApp}
                disabled={sendingWA}
              >
                <MessageCircle className="h-4 w-4" />
                {sendingWA ? "Sending…" : "Send via WhatsApp"}
              </Button>
            )}
            {canEditInvoice && invoice.status !== "voided" && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowEditModal(true)}>
                <Pencil className="h-4 w-4" />
                Edit Invoice
              </Button>
            )}
            {canDiscount && invoice.status !== "voided" && invoice.status !== "paid" && (
              <Button variant="outline" size="sm" onClick={() => setShowDiscountModal(true)}>
                Add Discount
              </Button>
            )}
            {canCollect && invoice.status !== "voided" && invoice.status !== "paid" && (
              <Button size="sm" onClick={() => setShowPaymentModal(true)}>
                <CreditCard className="mr-1 h-4 w-4" />
                Collect Payment
              </Button>
            )}
            {canVoid && invoice.status !== "voided" && (
              <Button variant="destructive" size="sm" onClick={() => setShowVoidModal(true)}>
                <Trash2 className="mr-1 h-4 w-4" />
                Void
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Line Items & Payments */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{item.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">Rs. {item.amount * item.quantity}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-semibold">Total</TableCell>
                    <TableCell className="text-right font-bold text-lg">Rs. {invoice.totalAmount}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment History</CardTitle>
              <CardDescription>{invoice.payments.length} payment(s)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="hidden sm:table-cell">Reference</TableHead>
                    <TableHead className="hidden md:table-cell">Collected By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                        No payments collected yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoice.payments.map((pay) => (
                      <TableRow key={pay.id}>
                        <TableCell className="font-medium text-emerald-600">Rs. {pay.amount}</TableCell>
                        <TableCell className="capitalize">{pay.method.replace("-", " ")}</TableCell>
                        <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground">
                          {pay.reference}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {pay.collectedBy}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(pay.collectedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => setReceiptPayment(pay)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                            title="View receipt"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right: Summary */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <StatusBadge status={invoice.status} />
              <div className="flex flex-col gap-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-medium">Rs. {invoice.totalAmount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium text-emerald-600">Rs. {invoice.paidAmount}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Balance Due</span>
                  <span className={`font-bold text-lg ${invoice.balance > 0 ? "text-red-600" : "text-foreground"}`}>
                    Rs. {invoice.balance}
                  </span>
                </div>
                {(invoice.refundDue ?? 0) > 0 && (
                  <div className="flex justify-between text-sm rounded-md bg-amber-50 border border-amber-200 px-2.5 py-2">
                    <span className="font-medium text-amber-700">Refund Due to Patient</span>
                    <span className="font-bold text-lg text-amber-600">
                      Rs. {(invoice.refundDue ?? 0).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Patient</p>
                  <Link href={`/patients/${invoice.patientId}`} className="text-sm font-medium hover:text-primary">
                    {patient?.name ?? "Unknown"}
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Doctor</p>
                  <p className="text-sm font-medium">{doctor?.name ?? "Unknown"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Appointment</p>
                  <Link href="/appointments" className="text-sm font-medium hover:text-primary">
                    {invoice.appointmentId}
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Collect Payment Modal */}
      <CollectPaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        invoiceId={invoice.id}
        balance={invoice.balance}
        collectedByName={currentUser?.name ?? "Staff"}
        onPaymentCollected={(payment) => setReceiptPayment(payment)}
      />

      {/* Discount Modal */}
      <DiscountModal
        open={showDiscountModal}
        onOpenChange={setShowDiscountModal}
        invoiceId={invoice.id}
        appliedBy={currentUser?.name ?? "Staff"}
      />

      {/* Edit Invoice Modal */}
      <EditInvoiceModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        invoice={invoice}
      />

      {/* Receipt Dialog */}
      {receiptPayment && (
        <InvoiceReceiptDialog
          open={!!receiptPayment}
          onOpenChange={(v) => { if (!v) setReceiptPayment(null) }}
          invoice={invoice}
          patient={patient}
          doctor={doctor}
          latestPayment={receiptPayment}
          clinicSettings={clinicSettings}
          appointment={appointment ? { date: appointment.date, time: appointment.time } : undefined}
        />
      )}

      {/* Void Invoice Modal */}
      <VoidInvoiceModal
        open={showVoidModal}
        onOpenChange={setShowVoidModal}
        invoice={invoice}
        patientName={patient?.name ?? "Unknown"}
        onConfirm={async (reason) => {
          await voidInvoice(invoice.id, reason)
          toast.success(
            invoice.paidAmount > 0
              ? `Invoice voided. Rs. ${invoice.paidAmount.toLocaleString()} marked as refund due to patient.`
              : "Invoice voided."
          )
          setShowVoidModal(false)
        }}
      />
    </>
  )
}

// ─── Void Invoice Modal ────────────────────────────────────────────────────
function VoidInvoiceModal({
  open,
  onOpenChange,
  invoice,
  patientName,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  invoice: Invoice
  patientName: string
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const wasPaid = invoice.paidAmount > 0

  // Reset form when the dialog opens
  useEffect(() => {
    if (open) {
      setReason("")
      setSubmitting(false)
    }
  }, [open])

  const handleSubmit = async () => {
    const r = reason.trim()
    if (!r) {
      toast.error("Please provide a reason for voiding this invoice.")
      return
    }
    setSubmitting(true)
    try {
      await onConfirm(r)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to void invoice.")
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v) }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Void Invoice
          </DialogTitle>
          <DialogDescription>
            Mark this invoice as voided. It will be removed from revenue and outstanding totals
            but remain on record for audit purposes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Summary of what's being voided */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Patient</span>
              <span className="font-medium">{patientName}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-muted-foreground">Invoice total</span>
              <span className="font-medium">Rs. {invoice.totalAmount.toLocaleString()}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-muted-foreground">Already paid</span>
              <span className={`font-medium ${wasPaid ? "text-emerald-700" : ""}`}>
                Rs. {invoice.paidAmount.toLocaleString()}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-muted-foreground">Outstanding</span>
              <span className="font-medium">Rs. {invoice.balance.toLocaleString()}</span>
            </div>
          </div>

          {wasPaid && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <strong>Refund warning:</strong> Rs. {invoice.paidAmount.toLocaleString()} has
              already been collected. Voiding will mark this amount as <strong>refund due</strong> to
              the patient — please process the refund separately.
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="void-reason" className="text-sm font-medium">
              Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="void-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate invoice, billing error, patient cancelled service…"
              rows={3}
              maxLength={500}
              disabled={submitting}
              className="resize-none"
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {reason.length}/500
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={submitting || !reason.trim()}
            className="gap-1.5"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {submitting ? "Voiding…" : "Void Invoice"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CollectPaymentModal({
  open,
  onOpenChange,
  invoiceId,
  balance,
  collectedByName,
  onPaymentCollected,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  balance: number
  collectedByName: string
  onPaymentCollected: (payment: Payment) => void
}) {
  const { collectPayment } = useStore()
  const [amount, setAmount] = useState(balance.toString())
  const [method, setMethod] = useState("")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const reset = () => { setAmount(balance.toString()); setMethod(""); setReference(""); setNotes("") }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !method) {
      toast.error("Please fill in amount and payment method.")
      return
    }
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount.")
      return
    }
    setSaving(true)
    try {
      const payment: Omit<Payment, "id"> = {
        invoiceId,
        amount: numAmount,
        method: method as Payment["method"],
        reference: reference.trim(),
        notes: notes.trim(),
        collectedBy: collectedByName,
        collectedAt: new Date().toISOString(),
      }
      const collectedPayment: Payment = { ...payment, id: Date.now().toString() }
      await collectPayment(invoiceId, payment)
      toast.success(`Rs. ${numAmount} collected successfully.`)
      onOpenChange(false)
      reset()
      // Pass a snapshot of the payment for the receipt dialog
      // (the store will have the real one after re-render, but fields match)
      onPaymentCollected(collectedPayment)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to collect payment.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onOpenChange(false); reset() } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Collect Payment</DialogTitle>
          <DialogDescription>
            Outstanding balance: Rs. {balance}. Collecting as {collectedByName}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pay-amount">Amount *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">Rs.</span>
              <Input
                id="pay-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10"
                min={0}
                max={balance}
                step={0.01}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Payment Method *</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((pm) => (
                  <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pay-ref">Reference Number</Label>
            <Input
              id="pay-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transaction reference..."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pay-notes">Notes</Label>
            <Textarea
              id="pay-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { onOpenChange(false); reset() }} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Processing…" : `Collect Rs. ${amount || "0"}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Discount Modal ─────────────────────────────────────────────────────────

function DiscountModal({
  open,
  onOpenChange,
  invoiceId,
  appliedBy,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  appliedBy: string
}) {
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [saving, setSaving] = useState(false)

  const reset = () => { setDescription(""); setAmount("") }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseFloat(amount)
    if (!description.trim() || isNaN(num) || num <= 0) {
      toast.error("Enter a description and a valid discount amount.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/discount`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), amount: num, appliedBy }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to apply discount")
      }
      toast.success(`Discount of Rs. ${num} applied.`)
      onOpenChange(false)
      reset()
      // Refresh the page to show updated invoice
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply discount.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onOpenChange(false); reset() } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Discount</DialogTitle>
          <DialogDescription>Apply a discount line item to this invoice.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="disc-desc">Reason / Description *</Label>
            <Input
              id="disc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Loyalty discount, Referral discount…"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="disc-amount">Discount Amount (Rs.) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">Rs.</span>
              <Input
                id="disc-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10"
                min={0.01}
                step={0.01}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { onOpenChange(false); reset() }} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Applying…" : "Apply Discount"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Invoice Modal ─────────────────────────────────────────────────────

interface EditRow {
  key: string
  id?: string
  description: string
  amount: string
  quantity: number
  category?: string
}

function EditInvoiceModal({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice
}) {
  const { editInvoice, getPatient } = useStore()
  const patient = getPatient(invoice.patientId)
  const [rows, setRows] = useState<EditRow[]>([])
  const [sendWA, setSendWA] = useState(true)
  const [saving, setSaving] = useState(false)

  // Reload the editor from the invoice each time the dialog opens
  useEffect(() => {
    if (open) {
      setRows(
        invoice.lineItems.map((li, i) => ({
          key: `row_${i}_${li.id}`,
          id: li.id,
          description: li.description,
          amount: String(li.amount),
          quantity: li.quantity ?? 1,
          category: li.category,
        }))
      )
      setSendWA(true)
    }
  }, [open, invoice])

  const updateRow = (key: string, patch: Partial<EditRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key))
  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { key: `row_new_${Date.now()}`, description: "", amount: "", quantity: 1 },
    ])

  const total = Math.max(
    0,
    rows.reduce((s, r) => s + (parseFloat(r.amount) || 0) * (r.quantity || 1), 0)
  )
  const paid = invoice.paidAmount
  const balance = Math.max(0, total - paid)
  const refundDue = Math.max(0, paid - total)

  const handleSave = async () => {
    const lineItems = rows
      .map((r) => ({
        id: r.id,
        description: r.description.trim(),
        amount: parseFloat(r.amount) || 0,
        quantity: r.quantity || 1,
        category: r.category,
      }))
      .filter((r) => r.description !== "")
    if (lineItems.length === 0) {
      toast.error("Add at least one line item with a description.")
      return
    }
    setSaving(true)
    try {
      await editInvoice(invoice.id, lineItems)
      if (sendWA) {
        try {
          const res = await fetch("/api/whatsapp/send-receipt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoiceId: invoice.id }),
          })
          if (res.ok) {
            toast.success("Invoice updated and sent to the patient on WhatsApp.")
          } else {
            const err = await res.json().catch(() => ({}))
            toast.success("Invoice updated.")
            toast.error(`Could not send to patient: ${err.error ?? "WhatsApp send failed"}`)
          }
        } catch {
          toast.success("Invoice updated.")
          toast.error("Could not send the updated invoice on WhatsApp.")
        }
      } else {
        toast.success("Invoice updated.")
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update invoice.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v) }}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Edit Invoice
          </DialogTitle>
          <DialogDescription>
            #{invoice.id.slice(-8)} — {patient?.name ?? "Patient"}. Adjust line items;
            the total, balance and status recalculate automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* Column headers */}
          <div className="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
            <span className="flex-1">Description</span>
            <span className="w-32 text-right">Amount (Rs.)</span>
            <span className="w-7" />
          </div>

          {/* Line item rows */}
          <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
            {rows.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">
                No line items — add one below.
              </p>
            ) : (
              rows.map((r) => (
                <div key={r.key} className="flex items-center gap-2">
                  <Input
                    value={r.description}
                    onChange={(e) => updateRow(r.key, { description: e.target.value })}
                    placeholder="Line item description"
                    className="h-9 flex-1"
                  />
                  <Input
                    type="number"
                    value={r.amount}
                    onChange={(e) => updateRow(r.key, { amount: e.target.value })}
                    placeholder="0"
                    step="0.01"
                    className="h-9 w-32 text-right"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(r.key)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Remove line item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start gap-1.5"
            onClick={addRow}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Line Item
          </Button>

          {/* Live summary */}
          <div className="mt-1 flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">New Total</span>
              <span className="font-semibold">Rs. {total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Already Paid</span>
              <span className="font-medium text-emerald-600">Rs. {paid.toLocaleString()}</span>
            </div>
            {balance > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Balance Due</span>
                <span className="font-semibold text-red-600">Rs. {balance.toLocaleString()}</span>
              </div>
            )}
            {refundDue > 0 && (
              <div className="flex justify-between border-t border-amber-200 pt-1.5">
                <span className="font-medium text-amber-700">Refund Due to Patient</span>
                <span className="font-bold text-amber-600">Rs. {refundDue.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Send option */}
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendWA}
              onChange={(e) => setSendWA(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Regenerate &amp; send the updated invoice to the patient on WhatsApp
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
