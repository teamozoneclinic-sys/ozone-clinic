"use client"

import { use, useState } from "react"
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
import { User, Stethoscope, CalendarDays, CreditCard, Trash2, Download, Receipt } from "lucide-react"
import { PAYMENT_METHODS } from "@/lib/constants"
import { toast } from "sonner"
import Link from "next/link"
import type { Payment } from "@/lib/types"
import { InvoiceReceiptDialog } from "@/components/invoice-receipt-dialog"

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { getInvoice, getPatient, getDoctor, getAppointment, hasPermission, currentUser, clinicSettings } = useStore()
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  // receiptPayment: any past payment row OR freshly collected one
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null)

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
            {canDiscount && invoice.status !== "voided" && invoice.status !== "paid" && (
              <Button variant="outline" size="sm" onClick={() => toast.info("Discount feature coming soon.")}>
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
              <Button variant="destructive" size="sm" onClick={() => toast.info("Void feature coming soon.")}>
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
    </>
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
