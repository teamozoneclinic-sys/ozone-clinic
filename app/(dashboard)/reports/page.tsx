"use client"

import { useState, useEffect, useMemo } from "react"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import { DollarSign, Download, Eye, EyeOff, Receipt, TrendingUp, Users } from "lucide-react"
import Link from "next/link"
import { getPKTDateString } from "@/lib/pkt"

const TODAY = getPKTDateString()
const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16"]

// ── Date helpers ──────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split("T")[0]
}

function getDateRange(
  filter: "today" | "week" | "month" | "custom",
  customFrom: string,
  customTo: string
): { from: string; to: string } {
  if (filter === "today") return { from: TODAY, to: TODAY }
  if (filter === "week") return { from: addDays(TODAY, -6), to: TODAY }
  if (filter === "month") return { from: addDays(TODAY, -29), to: TODAY }
  return { from: customFrom || TODAY, to: customTo || TODAY }
}

function inRange(dateStr: string, from: string, to: string): boolean {
  const d = dateStr.split("T")[0]
  return d >= from && d <= to
}

function daysBetween(dateStr: string): number {
  const from = new Date(dateStr.split("T")[0])
  const to = new Date(TODAY)
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

function agingBucket(days: number): "0-7" | "8-30" | "31+" {
  if (days <= 7) return "0-7"
  if (days <= 30) return "8-30"
  return "31+"
}

// ── CSV helper ────────────────────────────────────────────────────────────────

function downloadCSV(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>
) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const lines = [
    headers.map(esc).join(","),
    ...rows.map((row) => row.map(esc).join(",")),
  ]
  const blob = new Blob([lines.join("\n")], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { invoices, doctors, patients, getPatient, getDoctor, currentUser } = useStore()

  // ── Filters ──────────────────────────────────────────────────────────────
  const [period, setPeriod] = useState<"today" | "week" | "month" | "custom">("today")
  const [customFrom, setCustomFrom] = useState(TODAY)
  const [customTo, setCustomTo] = useState(TODAY)
  const [staffFilter, setStaffFilter] = useState("all")
  const [doctorFilter, setDoctorFilter] = useState("all")

  // Dynamic staff list from users API
  const [staffUsers, setStaffUsers] = useState<{ name: string; role: string }[]>([])
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setStaffUsers(d.data ?? []))
      .catch(() => {})
  }, [])

  const { from, to } = getDateRange(period, customFrom, customTo)
  const periodLabel = period === "today" ? TODAY : `${from} → ${to}`

  // ── Payments in selected date range ──────────────────────────────────────
  // Voided invoices are skipped — their payments don't count toward
  // collections, doctor revenue, or any chart on this page.
  const allPayments = useMemo(
    () =>
      invoices
        .filter((inv) => inv.status !== "voided")
        .flatMap((inv) =>
          inv.payments
            .filter((p) => inRange(p.collectedAt, from, to))
            .map((p) => ({
              ...p,
              doctorId: inv.doctorId,
              patientId: inv.patientId,
            }))
        ),
    [invoices, from, to]
  )

  // Further filter by staff
  const filteredPayments = useMemo(
    () =>
      staffFilter === "all"
        ? allPayments
        : allPayments.filter((p) => p.collectedBy === staffFilter),
    [allPayments, staffFilter]
  )

  const totalCollected = filteredPayments.reduce((s, p) => s + p.amount, 0)

  // ── Point-in-time stats (no date filter) ──────────────────────────────────
  const unpaidInvoices = invoices.filter(
    (inv) => inv.status === "unpaid" || inv.status === "partially-paid"
  )
  const totalOutstanding = unpaidInvoices.reduce((s, i) => s + i.balance, 0)

  // Monthly revenue — sum of payments collected within the current calendar
  // month (resets on the 1st). Replaces the old "all-time total revenue" KPI.
  // Voided invoices are excluded — their payments are tracked as refundDue and
  // must not inflate revenue.
  const monthlyRevenue = useMemo(() => {
    const today = new Date(TODAY)
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, "0")
    const monthPrefix = `${yyyy}-${mm}`
    return invoices
      .filter((inv) => inv.status !== "voided")
      .reduce((sum, inv) => {
        return (
          sum +
          inv.payments
            .filter((p) => (p.collectedAt ?? "").startsWith(monthPrefix))
            .reduce((s, p) => s + p.amount, 0)
        )
      }, 0)
  }, [invoices])

  const monthLabel = new Date(TODAY).toLocaleDateString("en-PK", {
    month: "long",
    year: "numeric",
  })

  // Hide-amounts toggle — masks every currency display on this page until
  // the user clicks the eye icon to reveal again.
  const [amountsHidden, setAmountsHidden] = useState(false)
  const MASKED = "••••••"
  const fmt = (n: number) => (amountsHidden ? `Rs. ${MASKED}` : `Rs. ${n.toLocaleString()}`)

  // ── Collections by staff ──────────────────────────────────────────────────
  const byCollector = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {}
    for (const p of filteredPayments) {
      if (!map[p.collectedBy])
        map[p.collectedBy] = { name: p.collectedBy, total: 0, count: 0 }
      map[p.collectedBy].total += p.amount
      map[p.collectedBy].count++
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [filteredPayments])

  // ── Payment methods breakdown ─────────────────────────────────────────────
  const byMethod = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of filteredPayments) {
      map[p.method] = (map[p.method] || 0) + p.amount
    }
    return Object.entries(map).map(([name, value]) => ({
      name: name.replace(/-/g, " "),
      value,
    }))
  }, [filteredPayments])

  // ── Daily collections chart ───────────────────────────────────────────────
  const dailyChartData = useMemo(() => {
    if (period === "today") return []
    const map: Record<string, number> = {}
    let cur = from
    while (cur <= to) {
      map[cur] = 0
      const d = new Date(cur)
      d.setDate(d.getDate() + 1)
      cur = d.toISOString().split("T")[0]
    }
    for (const p of filteredPayments) {
      const d = p.collectedAt.split("T")[0]
      if (d in map) map[d] = (map[d] || 0) + p.amount
    }
    return Object.entries(map).map(([date, amount]) => ({
      date: new Date(date).toLocaleDateString("en-PK", {
        month: "short",
        day: "numeric",
      }),
      amount,
    }))
  }, [filteredPayments, from, to, period])

  // ── Doctor Revenue ────────────────────────────────────────────────────────
  const doctorRevenue = useMemo(() => {
    return doctors
      .filter((doc) => doctorFilter === "all" || doc.id === doctorFilter)
      .map((doc) => {
        const docPayments = filteredPayments.filter((p) => p.doctorId === doc.id)
        const docInvoices = invoices.filter(
          (inv) =>
            inv.doctorId === doc.id &&
            inv.status !== "voided" &&
            inRange(inv.createdAt, from, to)
        )
        return {
          doc,
          invoiceCount: docInvoices.length,
          totalBilled: docInvoices.reduce((s, i) => s + i.totalAmount, 0),
          totalCollected: docPayments.reduce((s, p) => s + p.amount, 0),
          outstanding: docInvoices.reduce((s, i) => s + i.balance, 0),
        }
      })
      .filter((d) => d.invoiceCount > 0 || d.totalCollected > 0)
      .sort((a, b) => b.totalCollected - a.totalCollected)
  }, [doctors, invoices, filteredPayments, from, to, doctorFilter])

  const doctorChartData = doctorRevenue.map((d) => ({
    name: d.doc.name,
    Billed: d.totalBilled,
    Collected: d.totalCollected,
    Outstanding: d.outstanding,
  }))

  // ── Aging ─────────────────────────────────────────────────────────────────
  const aging: Record<"0-7" | "8-30" | "31+", typeof unpaidInvoices> = {
    "0-7": [],
    "8-30": [],
    "31+": [],
  }
  for (const inv of unpaidInvoices) {
    aging[agingBucket(daysBetween(inv.createdAt))].push(inv)
  }
  const agingTotals = {
    "0-7": aging["0-7"].reduce((s, i) => s + i.balance, 0),
    "8-30": aging["8-30"].reduce((s, i) => s + i.balance, 0),
    "31+": aging["31+"].reduce((s, i) => s + i.balance, 0),
  }

  // ── Patient Balances ──────────────────────────────────────────────────────
  const patientBalances = patients
    .map((patient) => {
      const open = invoices.filter(
        (inv) =>
          inv.patientId === patient.id &&
          (inv.status === "unpaid" || inv.status === "partially-paid")
      )
      const outstanding = open.reduce((s, i) => s + i.balance, 0)
      const oldestDate = open.length
        ? open.reduce(
            (oldest, inv) => (inv.createdAt < oldest ? inv.createdAt : oldest),
            open[0].createdAt
          )
        : null
      return { patient, outstanding, invoiceCount: open.length, oldestDate }
    })
    .filter((x) => x.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)

  // ── CSV downloads ─────────────────────────────────────────────────────────
  const downloadPaymentsCSV = () =>
    downloadCSV(
      `payments-${from}-to-${to}.csv`,
      ["Invoice ID", "Date", "Time", "Method", "Reference", "Collected By", "Amount (Rs)"],
      filteredPayments.map((p) => [
        p.invoiceId,
        p.collectedAt.split("T")[0],
        new Date(p.collectedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        p.method,
        p.reference || "",
        p.collectedBy,
        p.amount,
      ])
    )

  const downloadStaffCSV = () =>
    downloadCSV(
      `staff-collections-${from}-to-${to}.csv`,
      ["Staff Member", "Payments", "Amount (Rs)"],
      byCollector.map((c) => [c.name, c.count, c.total])
    )

  const downloadDoctorCSV = () =>
    downloadCSV(
      `doctor-revenue-${from}-to-${to}.csv`,
      ["Doctor", "Specialty", "Invoices", "Billed (Rs)", "Collected (Rs)", "Outstanding (Rs)", "Collection %"],
      doctorRevenue.map((d) => {
        const pct =
          d.totalBilled > 0
            ? Math.round((d.totalCollected / d.totalBilled) * 100)
            : 0
        return [
          d.doc.name,
          d.doc.specialty,
          d.invoiceCount,
          d.totalBilled,
          d.totalCollected,
          d.outstanding,
          `${pct}%`,
        ]
      })
    )

  const downloadAgingCSV = () =>
    downloadCSV(
      `unpaid-aging-${TODAY}.csv`,
      ["Invoice ID", "Patient", "Doctor", "Created", "Days Overdue", "Status", "Balance (Rs)"],
      unpaidInvoices.map((inv) => {
        const patient = getPatient(inv.patientId)
        const doctor = getDoctor(inv.doctorId)
        return [
          inv.id,
          patient?.name || "",
          doctor?.name || "",
          inv.createdAt,
          daysBetween(inv.createdAt),
          inv.status,
          inv.balance,
        ]
      })
    )

  const downloadBalancesCSV = () =>
    downloadCSV(
      `patient-balances-${TODAY}.csv`,
      ["Patient", "Phone", "Doctor", "Open Invoices", "Oldest Invoice", "Days Overdue", "Outstanding (Rs)"],
      patientBalances.map(({ patient, outstanding, invoiceCount, oldestDate }) => {
        const doctor = getDoctor(patient.assignedDoctorId)
        const days = oldestDate ? daysBetween(oldestDate) : 0
        return [
          patient.name,
          patient.phone,
          doctor?.name || "",
          invoiceCount,
          oldestDate || "",
          days,
          outstanding,
        ]
      })
    )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Reports"
        description="Financial summaries and operational analytics."
        breadcrumbs={[{ label: "Reports" }]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAmountsHidden((h) => !h)}
            className="gap-1.5"
            title={amountsHidden ? "Show amounts" : "Hide amounts"}
          >
            {amountsHidden ? (
              <>
                <Eye className="h-3.5 w-3.5" /> Show Amounts
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5" /> Hide Amounts
              </>
            )}
          </Button>
        }
      />

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap gap-3 items-end rounded-xl border bg-card p-4 shadow-sm mb-4">
        {/* Period buttons */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Period</Label>
          <div className="flex gap-1">
            {(["today", "week", "month", "custom"] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={period === p ? "default" : "outline"}
                onClick={() => setPeriod(p)}
                className="text-xs"
              >
                {p === "today" ? "Today" : p === "week" ? "7 Days" : p === "month" ? "30 Days" : "Custom"}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom range inputs */}
        {period === "custom" && (
          <>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 text-sm w-36"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={customTo}
                min={customFrom}
                max={TODAY}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 text-sm w-36"
              />
            </div>
          </>
        )}

        {/* Staff filter */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Staff</Label>
          <Select value={staffFilter} onValueChange={setStaffFilter}>
            <SelectTrigger className="h-9 w-44 text-sm">
              <SelectValue placeholder="All Staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staffUsers.map((u) => (
                <SelectItem key={u.name} value={u.name}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Doctor filter */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Doctor</Label>
          <Select value={doctorFilter} onValueChange={setDoctorFilter}>
            <SelectTrigger className="h-9 w-44 text-sm">
              <SelectValue placeholder="All Doctors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Doctors</SelectItem>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="ml-auto text-xs text-muted-foreground self-end pb-1">
          {periodLabel}
        </span>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          title={period === "today" ? "Today's Collections" : "Period Collections"}
          value={fmt(totalCollected)}
          description={`${filteredPayments.length} payment${filteredPayments.length !== 1 ? "s" : ""} in period`}
          icon={DollarSign}
        />
        {currentUser?.role === "admin" && (
          <StatCard
            title="Monthly Revenue"
            value={fmt(monthlyRevenue)}
            description={`Payments collected in ${monthLabel}`}
            icon={TrendingUp}
          />
        )}
        <StatCard
          title="Outstanding Balance"
          value={fmt(totalOutstanding)}
          description={`${unpaidInvoices.length} unpaid invoice${unpaidInvoices.length !== 1 ? "s" : ""}`}
          icon={Receipt}
        />
        <StatCard
          title="Patients with Balance"
          value={patientBalances.length}
          description="Patients with unpaid invoices"
          icon={Users}
        />
      </div>

      <Tabs defaultValue="collections">
        <TabsList>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="aging">Unpaid Aging</TabsTrigger>
          <TabsTrigger value="doctor-revenue">Doctor Revenue</TabsTrigger>
          <TabsTrigger value="outstanding">Patient Balances</TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════
            TAB 1 — Collections
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="collections" className="mt-4 space-y-4">

          {/* Daily trend chart (hidden for "today") */}
          {dailyChartData.length > 1 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Collections Trend</CardTitle>
                <CardDescription>Daily totals — {from} → {to}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={dailyChartData}
                    margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(v) => (amountsHidden ? "Rs.•••" : `Rs.${(v / 1000).toFixed(0)}k`)}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v: number) => [fmt(v), "Collected"]}
                    />
                    <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* By Staff */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">Collections by Staff</CardTitle>
                  <CardDescription>{periodLabel}</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadStaffCSV}
                  disabled={byCollector.length === 0}
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                {byCollector.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No collections in period.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Collector</TableHead>
                        <TableHead className="text-center">Payments</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byCollector.map((c) => (
                        <TableRow key={c.name}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-center">{c.count}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {fmt(c.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2 font-semibold bg-muted/30">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-center">{filteredPayments.length}</TableCell>
                        <TableCell className="text-right">
                          {fmt(totalCollected)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Payment Methods Pie */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Payment Methods</CardTitle>
                <CardDescription>Breakdown by method — {periodLabel}</CardDescription>
              </CardHeader>
              <CardContent>
                {byMethod.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No payments in period.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie
                        data={byMethod}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {byMethod.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => fmt(v)}
                      />
                      <Legend
                        formatter={(value) => (
                          <span className="capitalize text-xs">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment detail table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Payment Details</CardTitle>
                <CardDescription>All individual payments — {periodLabel}</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={downloadPaymentsCSV}
                disabled={filteredPayments.length === 0}
              >
                <Download className="h-3.5 w-3.5 mr-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              {filteredPayments.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No payments in selected period.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Collected By</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Link
                            href={`/billing/${p.invoiceId}`}
                            className="text-primary hover:underline font-medium"
                          >
                            #{p.invoiceId.slice(-6)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {p.collectedAt.split("T")[0]}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(p.collectedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {p.method.replace("-", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {p.reference || "—"}
                        </TableCell>
                        <TableCell>{p.collectedBy}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {fmt(p.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════
            TAB 2 — Unpaid Aging
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="aging" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Point-in-time view — not filtered by date period.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={downloadAgingCSV}
              disabled={unpaidInvoices.length === 0}
            >
              <Download className="h-3.5 w-3.5 mr-1" /> Download All (CSV)
            </Button>
          </div>

          {/* Aging summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
                  0–7 Days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">
                  {fmt(agingTotals["0-7"])}
                </p>
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-500">
                  {aging["0-7"].length} invoice{aging["0-7"].length !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-800 dark:text-amber-400">
                  8–30 Days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-300">
                  {fmt(agingTotals["8-30"])}
                </p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">
                  {aging["8-30"].length} invoice{aging["8-30"].length !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-800 dark:text-red-400">
                  31+ Days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-900 dark:text-red-300">
                  {fmt(agingTotals["31+"])}
                </p>
                <p className="mt-1 text-xs text-red-700 dark:text-red-500">
                  {aging["31+"].length} invoice{aging["31+"].length !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Aging stacked bar chart */}
          {unpaidInvoices.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Aging Breakdown</CardTitle>
                <CardDescription>Outstanding balance by age bucket</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart
                    data={[
                      {
                        name: "Outstanding",
                        "0-7 Days": agingTotals["0-7"],
                        "8-30 Days": agingTotals["8-30"],
                        "31+ Days": agingTotals["31+"],
                      },
                    ]}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => (amountsHidden ? "Rs.•••" : `Rs.${(v / 1000).toFixed(0)}k`)}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="0-7 Days" fill="#10b981" stackId="a" />
                    <Bar dataKey="8-30 Days" fill="#f59e0b" stackId="a" />
                    <Bar dataKey="31+ Days" fill="#ef4444" stackId="a" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {(["0-7", "8-30", "31+"] as const).map((bucket) =>
            aging[bucket].length > 0 ? (
              <Card key={bucket}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {bucket === "0-7"
                      ? "0–7 Days"
                      : bucket === "8-30"
                      ? "8–30 Days"
                      : "31+ Days"}{" "}
                    Overdue
                  </CardTitle>
                  <CardDescription>
                    {aging[bucket].length} invoice{aging[bucket].length !== 1 ? "s" : ""} —{" "}
                    {fmt(agingTotals[bucket])} outstanding
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aging[bucket].map((inv) => {
                        const patient = getPatient(inv.patientId)
                        const doctor = getDoctor(inv.doctorId)
                        const days = daysBetween(inv.createdAt)
                        return (
                          <TableRow key={inv.id}>
                            <TableCell>
                              <Link
                                href={`/billing/${inv.id}`}
                                className="text-primary hover:underline font-medium"
                              >
                                #{inv.id.slice(-6)}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Link
                                href={`/patients/${inv.patientId}`}
                                className="hover:underline"
                              >
                                {patient?.name ?? "—"}
                              </Link>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {doctor?.name ?? "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {inv.createdAt}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  bucket === "31+"
                                    ? "border-red-300 text-red-700"
                                    : bucket === "8-30"
                                    ? "border-amber-300 text-amber-700"
                                    : "border-emerald-300 text-emerald-700"
                                }
                              >
                                {days}d
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={inv.status} />
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {fmt(inv.balance)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════
            TAB 3 — Doctor Revenue
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="doctor-revenue" className="mt-4 space-y-4">

          {/* Doctor revenue grouped bar chart */}
          {doctorChartData.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Doctor Revenue Chart</CardTitle>
                <CardDescription>Billed vs. Collected vs. Outstanding — {periodLabel}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={doctorChartData}
                    margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(v) => (amountsHidden ? "Rs.•••" : `Rs.${(v / 1000).toFixed(0)}k`)}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="Billed" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Outstanding" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Doctor-wise Revenue</CardTitle>
                <CardDescription>Billed vs. collected — {periodLabel}</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={downloadDoctorCSV}
                disabled={doctorRevenue.length === 0}
              >
                <Download className="h-3.5 w-3.5 mr-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              {doctorRevenue.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No data for selected period or doctor.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Specialty</TableHead>
                      <TableHead className="text-center">Invoices</TableHead>
                      <TableHead className="text-right">Total Billed</TableHead>
                      <TableHead className="text-right">Collected</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Collection %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doctorRevenue.map(
                      ({ doc, invoiceCount, totalBilled, totalCollected, outstanding }) => {
                        const pct =
                          totalBilled > 0
                            ? Math.round((totalCollected / totalBilled) * 100)
                            : 0
                        return (
                          <TableRow key={doc.id}>
                            <TableCell className="font-medium">{doc.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {doc.specialty}
                            </TableCell>
                            <TableCell className="text-center">{invoiceCount}</TableCell>
                            <TableCell className="text-right">
                              {fmt(totalBilled)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-emerald-700">
                              {fmt(totalCollected)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-red-600">
                              {fmt(outstanding)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant="outline"
                                className={
                                  pct >= 80
                                    ? "border-emerald-300 text-emerald-700"
                                    : pct >= 50
                                    ? "border-amber-300 text-amber-700"
                                    : "border-red-300 text-red-700"
                                }
                              >
                                {pct}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      }
                    )}
                    <TableRow className="border-t-2 font-semibold bg-muted/30">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-center">
                        {doctorRevenue.reduce((s, d) => s + d.invoiceCount, 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmt(doctorRevenue.reduce((s, d) => s + d.totalBilled, 0))}
                      </TableCell>
                      <TableCell className="text-right text-emerald-700">
                        {fmt(doctorRevenue.reduce((s, d) => s + d.totalCollected, 0))}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {fmt(doctorRevenue.reduce((s, d) => s + d.outstanding, 0))}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════
            TAB 4 — Patient Balances
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="outstanding" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Patient Outstanding Balances</CardTitle>
                <CardDescription>
                  {patientBalances.length} patient{patientBalances.length !== 1 ? "s" : ""} with
                  unpaid invoices — {fmt(totalOutstanding)} total outstanding
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={downloadBalancesCSV}
                disabled={patientBalances.length === 0}
              >
                <Download className="h-3.5 w-3.5 mr-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              {patientBalances.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No outstanding balances. All patients are paid up!
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Assigned Doctor</TableHead>
                      <TableHead className="text-center">Open Invoices</TableHead>
                      <TableHead>Oldest Invoice</TableHead>
                      <TableHead>Days Overdue</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patientBalances.map(({ patient, outstanding, invoiceCount, oldestDate }) => {
                      const doctor = getDoctor(patient.assignedDoctorId)
                      const days = oldestDate ? daysBetween(oldestDate) : 0
                      return (
                        <TableRow key={patient.id}>
                          <TableCell>
                            <Link
                              href={`/patients/${patient.id}`}
                              className="text-primary hover:underline font-medium"
                            >
                              {patient.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {patient.phone}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {doctor?.name ?? "—"}
                          </TableCell>
                          <TableCell className="text-center">{invoiceCount}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {oldestDate ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                days > 30
                                  ? "border-red-300 text-red-700"
                                  : days > 7
                                  ? "border-amber-300 text-amber-700"
                                  : "border-emerald-300 text-emerald-700"
                              }
                            >
                              {days}d
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-red-600">
                            {fmt(outstanding)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
