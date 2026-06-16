"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ChevronRight,
  Search,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Receipt,
  Eye,
  EyeOff,
  CreditCard,
  Banknote,
  Ban,
} from "lucide-react"
import { toast } from "sonner"
import type { Invoice, PaymentMethod } from "@/lib/types"

const MASKED = "••••••"

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Credit / Debit Card" },
  { value: "bank-transfer", label: "Bank Transfer" },
  { value: "upi", label: "EasyPaisa / JazzCash" },
  { value: "insurance", label: "Insurance" },
]

export default function BillingPage() {
  const { invoices, getPatient, getDoctor, doctors, currentUser, collectPayment, hasPermission } = useStore()
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [doctorFilter, setDoctorFilter] = useState("all")
  const [amountsHidden, setAmountsHidden] = useState(() => {
    if (typeof window === "undefined") return true
    const stored = localStorage.getItem("billing-amounts-hidden")
    return stored === null ? true : stored === "true"
  })

  const toggleAmountsHidden = () =>
    setAmountsHidden((prev) => {
      const next = !prev
      localStorage.setItem("billing-amounts-hidden", String(next))
      return next
    })
  const [collectingInvoice, setCollectingInvoice] = useState<Invoice | null>(null)

  const canCollect = hasPermission("billing.collect")

  const unpaidInvoices = useMemo(() => {
    return invoices.filter((i) => {
      const isUnpaid = i.status === "unpaid" || i.status === "partially-paid"
      const patient = getPatient(i.patientId)
      const matchSearch =
        search === "" ||
        patient?.name.toLowerCase().includes(search.toLowerCase()) ||
        i.id.toLowerCase().includes(search.toLowerCase())
      const matchDoctor = doctorFilter === "all" || i.doctorId === doctorFilter
      return isUnpaid && matchSearch && matchDoctor
    })
  }, [invoices, search, doctorFilter, getPatient])

  const paidInvoices = useMemo(() => {
    return invoices.filter((i) => {
      const isPaid = i.status === "paid"
      const patient = getPatient(i.patientId)
      const matchSearch =
        search === "" ||
        patient?.name.toLowerCase().includes(search.toLowerCase()) ||
        i.id.toLowerCase().includes(search.toLowerCase())
      const matchDoctor = doctorFilter === "all" || i.doctorId === doctorFilter
      return isPaid && matchSearch && matchDoctor
    })
  }, [invoices, search, doctorFilter, getPatient])

  const voidedInvoices = useMemo(() => {
    return invoices.filter((i) => {
      const isVoided = i.status === "voided"
      const patient = getPatient(i.patientId)
      const matchSearch =
        search === "" ||
        patient?.name.toLowerCase().includes(search.toLowerCase()) ||
        i.id.toLowerCase().includes(search.toLowerCase())
      const matchDoctor = doctorFilter === "all" || i.doctorId === doctorFilter
      return isVoided && matchSearch && matchDoctor
    })
  }, [invoices, search, doctorFilter, getPatient])

  // Voided invoices are excluded from BOTH outstanding and revenue. Their
  // balance is forced to 0 server-side already, but the filter is kept as a
  // safety net so a stale snapshot can't double-count voided balances.
  const liveInvoices = invoices.filter((i) => i.status !== "voided")

  const totalOutstanding = liveInvoices.reduce((sum, i) => sum + i.balance, 0)

  // Today's collection — sum payments collected today (voided invoices excluded)
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayCollection = liveInvoices.reduce((sum, inv) => {
    return sum + inv.payments
      .filter((p) => p.collectedAt.startsWith(todayStr))
      .reduce((s, p) => s + p.amount, 0)
  }, 0)

  // Monthly revenue — payments collected within the current calendar month.
  // Replaces the legacy all-time "Total Revenue" KPI; resets on the 1st.
  const monthPrefix = todayStr.slice(0, 7) // YYYY-MM
  const monthlyRevenue = liveInvoices.reduce((sum, inv) => {
    return sum + inv.payments
      .filter((p) => (p.collectedAt ?? "").startsWith(monthPrefix))
      .reduce((s, p) => s + p.amount, 0)
  }, 0)
  const monthLabel = new Date(todayStr).toLocaleDateString("en-PK", {
    month: "long",
    year: "numeric",
  })

  const handleCollect = async (invoiceId: string, amount: number, method: PaymentMethod, reference: string, notes: string) => {
    await collectPayment(invoiceId, {
      invoiceId,
      amount,
      method,
      reference,
      notes,
      collectedBy: currentUser.name,
      collectedAt: new Date().toISOString(),
    })
    toast.success(`Rs. ${amount.toLocaleString()} collected successfully.`)
    setCollectingInvoice(null)
    router.push(`/billing/${invoiceId}`)
  }

  return (
    <>
      <PageHeader
        title="Billing & Invoices"
        description={`Financial overview for ${currentUser.role === "admin" || currentUser.role === "manager" ? "all departments" : "your access level"}`}
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Billing" }]}
        actions={
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAmountsHidden}
                  className="gap-2"
                >
                  {amountsHidden ? (
                    <><EyeOff className="h-4 w-4" /> Show Amounts</>
                  ) : (
                    <><Eye className="h-4 w-4" /> Hide Amounts</>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{amountsHidden ? "Click to reveal all financial amounts" : "Click to hide all financial amounts for privacy"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
      />

      {/* ── Summary Stat Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {currentUser?.role === "admin" && (
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monthly Revenue</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{amountsHidden ? `Rs. ${MASKED}` : `Rs. ${monthlyRevenue.toLocaleString()}`}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{monthLabel}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Today's Collection</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{amountsHidden ? `Rs. ${MASKED}` : `Rs. ${todayCollection.toLocaleString()}`}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                <Banknote className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Unpaid Invoices</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{unpaidInvoices.length}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Receipt className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Outstanding</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{amountsHidden ? `Rs. ${MASKED}` : `Rs. ${totalOutstanding.toLocaleString()}`}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters ── */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by patient name or invoice ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={doctorFilter} onValueChange={setDoctorFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Doctors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Invoice Tabs ── */}
      <Tabs defaultValue="outstanding">
        <TabsList className="mb-4">
          <TabsTrigger value="outstanding" className="gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Outstanding ({unpaidInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Paid History ({paidInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="voided" className="gap-1.5">
            <Ban className="h-3.5 w-3.5" />
            Cancelled ({voidedInvoices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="outstanding">
          <InvoiceTable
            invoices={unpaidInvoices}
            getPatient={getPatient}
            getDoctor={getDoctor}
            variant="unpaid"
            amountsHidden={amountsHidden}
            canCollect={canCollect}
            onCollect={setCollectingInvoice}
          />
        </TabsContent>

        <TabsContent value="history">
          <InvoiceTable
            invoices={paidInvoices}
            getPatient={getPatient}
            getDoctor={getDoctor}
            variant="paid"
            amountsHidden={amountsHidden}
            canCollect={false}
            onCollect={() => {}}
          />
        </TabsContent>

        <TabsContent value="voided">
          <VoidedInvoiceTable
            invoices={voidedInvoices}
            getPatient={getPatient}
            getDoctor={getDoctor}
          />
        </TabsContent>
      </Tabs>

      {/* ── Collect Payment Modal ── */}
      {collectingInvoice && (
        <CollectPaymentModal
          invoice={collectingInvoice}
          collectedBy={currentUser.name}
          amountsHidden={amountsHidden}
          getPatient={getPatient}
          onConfirm={handleCollect}
          onClose={() => setCollectingInvoice(null)}
        />
      )}
    </>
  )
}

// ─── Invoice Table ──────────────────────────────────────────────────────────

function InvoiceTable({
  invoices,
  getPatient,
  getDoctor,
  variant,
  amountsHidden,
  canCollect,
  onCollect,
}: {
  invoices: Invoice[]
  getPatient: ReturnType<typeof useStore>["getPatient"]
  getDoctor: ReturnType<typeof useStore>["getDoctor"]
  variant: "unpaid" | "paid"
  amountsHidden: boolean
  canCollect: boolean
  onCollect: (invoice: Invoice) => void
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[100px]">Invoice</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead className="hidden md:table-cell">Doctor</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Total</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="hidden lg:table-cell">Date</TableHead>
              {canCollect && variant === "unpaid" && (
                <TableHead className="w-24 text-center">Action</TableHead>
              )}
              <TableHead className="w-8"><span className="sr-only">View</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canCollect && variant === "unpaid" ? 10 : 9} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Receipt className="h-8 w-8 opacity-40" />
                    <p className="text-sm">No {variant === "unpaid" ? "outstanding" : "paid"} invoices found.</p>
                    <p className="text-xs">Try adjusting your search or filters.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => {
                const patient = getPatient(inv.patientId)
                const doctor = getDoctor(inv.doctorId)
                return (
                  <TableRow key={inv.id} className="hover:bg-accent/40 transition-colors">
                    <TableCell>
                      <Link href={`/billing/${inv.id}`} className="font-medium font-mono text-xs hover:text-primary transition-colors">
                        #{inv.id}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/patients/${inv.patientId}`} className="flex items-center gap-2.5 group">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {patient?.name?.charAt(0) ?? "?"}
                        </div>
                        <span className="font-medium group-hover:text-primary transition-colors">
                          {patient?.name ?? "Unknown"}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {doctor?.name ?? "-"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right font-medium">
                      {amountsHidden ? <span className="text-muted-foreground">Rs. {MASKED}</span> : `Rs. ${inv.totalAmount.toLocaleString()}`}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right text-emerald-600 font-medium">
                      {amountsHidden ? <span className="text-muted-foreground">Rs. {MASKED}</span> : `Rs. ${inv.paidAmount.toLocaleString()}`}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${inv.balance > 0 ? "text-red-600" : "text-foreground"}`}>
                      {amountsHidden ? <span className="text-muted-foreground">Rs. {MASKED}</span> : `Rs. ${inv.balance.toLocaleString()}`}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                      {inv.createdAt}
                    </TableCell>
                    {canCollect && variant === "unpaid" && (
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => onCollect(inv)}
                        >
                          <CreditCard className="h-3 w-3" />
                          Collect
                        </Button>
                      </TableCell>
                    )}
                    <TableCell>
                      <Link href={`/billing/${inv.id}`}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ─── Voided Invoice Table ───────────────────────────────────────────────────

function VoidedInvoiceTable({
  invoices,
  getPatient,
  getDoctor,
}: {
  invoices: Invoice[]
  getPatient: ReturnType<typeof useStore>["getPatient"]
  getDoctor: ReturnType<typeof useStore>["getDoctor"]
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[100px]">Invoice</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead className="hidden md:table-cell">Doctor</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Amount</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="hidden lg:table-cell">Voided On</TableHead>
              <TableHead className="w-8"><span className="sr-only">View</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Ban className="h-8 w-8 opacity-40" />
                    <p className="text-sm">No cancelled invoices found.</p>
                    <p className="text-xs">Invoices voided due to appointment cancellation will appear here.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => {
                const patient = getPatient(inv.patientId)
                const doctor = getDoctor(inv.doctorId)
                return (
                  <TableRow key={inv.id} className="hover:bg-accent/40 transition-colors">
                    <TableCell>
                      <Link href={`/billing/${inv.id}`} className="font-medium font-mono text-xs hover:text-primary transition-colors">
                        #{inv.id}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/patients/${inv.patientId}`} className="flex items-center gap-2.5 group">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {patient?.name?.charAt(0) ?? "?"}
                        </div>
                        <span className="font-medium group-hover:text-primary transition-colors">
                          {patient?.name ?? "Unknown"}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {doctor?.name ?? "-"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right font-medium text-muted-foreground line-through">
                      Rs. {inv.totalAmount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[220px] truncate">
                      {inv.voidedReason || "Appointment cancelled"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                      {inv.updatedAt}
                    </TableCell>
                    <TableCell>
                      <Link href={`/billing/${inv.id}`}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ─── Collect Payment Modal ──────────────────────────────────────────────────

function CollectPaymentModal({
  invoice,
  collectedBy,
  amountsHidden,
  getPatient,
  onConfirm,
  onClose,
}: {
  invoice: Invoice
  collectedBy: string
  amountsHidden: boolean
  getPatient: ReturnType<typeof useStore>["getPatient"]
  onConfirm: (invoiceId: string, amount: number, method: PaymentMethod, reference: string, notes: string) => Promise<void>
  onClose: () => void
}) {
  const patient = getPatient(invoice.patientId)
  const [amount, setAmount] = useState(invoice.balance.toString())
  const [method, setMethod] = useState<PaymentMethod>("cash")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) {
      toast.error("Enter a valid payment amount.")
      return
    }
    if (parsed > invoice.balance) {
      toast.error(`Amount cannot exceed the outstanding balance of Rs. ${invoice.balance.toLocaleString()}.`)
      return
    }
    setSaving(true)
    try {
      await onConfirm(invoice.id, parsed, method, reference, notes)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to collect payment.")
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
              <CreditCard className="h-4 w-4 text-emerald-600" />
            </div>
            Collect Payment
          </DialogTitle>
          <DialogDescription>
            Invoice #{invoice.id} — {patient?.name ?? "Unknown Patient"}
          </DialogDescription>
        </DialogHeader>

        {/* Balance summary */}
        <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between text-sm mb-1">
          <span className="text-muted-foreground">Outstanding Balance</span>
          <span className="font-bold text-red-600 text-base">
            {amountsHidden ? `Rs. ${MASKED}` : `Rs. ${invoice.balance.toLocaleString()}`}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="collect-amount">
              Amount (Rs.) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="collect-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={1}
              max={invoice.balance}
              step="0.01"
              className="h-10"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Payment Method <span className="text-red-500">*</span></Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="collect-ref">Reference / Transaction ID</Label>
            <Input
              id="collect-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Optional — e.g. cheque no. or TxID"
              className="h-10"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="collect-notes">Notes</Label>
            <Textarea
              id="collect-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Collected By</Label>
            <Badge variant="outline" className="self-start px-3 py-1 text-sm font-medium">
              {collectedBy}
            </Badge>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} className="px-5" disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" className="px-5 gap-1.5 bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
              <CreditCard className="h-4 w-4" />
              {saving ? "Processing…" : "Confirm Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
