"use client"

import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DollarSign, Receipt, TrendingUp, Users } from "lucide-react"
import Link from "next/link"
import { getPKTDateString } from "@/lib/pkt"

const TODAY = getPKTDateString()

function daysBetween(dateStr: string): number {
  const from = new Date(dateStr)
  const to = new Date(TODAY)
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

function agingBucket(days: number): "0-7" | "8-30" | "31+" {
  if (days <= 7) return "0-7"
  if (days <= 30) return "8-30"
  return "31+"
}

export default function ReportsPage() {
  const { invoices, doctors, patients, getPatient, getDoctor } = useStore()

  // ── Daily Collections ──────────────────────────────────────
  const allPayments = invoices.flatMap((inv) =>
    inv.payments.map((p) => ({ ...p, doctorId: inv.doctorId }))
  )
  const todayPayments = allPayments.filter((p) => p.collectedAt.startsWith(TODAY))
  const totalCollectedToday = todayPayments.reduce((s, p) => s + p.amount, 0)

  const byCollector: Record<string, { name: string; total: number; count: number }> = {}
  for (const p of todayPayments) {
    if (!byCollector[p.collectedBy]) {
      byCollector[p.collectedBy] = { name: p.collectedBy, total: 0, count: 0 }
    }
    byCollector[p.collectedBy].total += p.amount
    byCollector[p.collectedBy].count += 1
  }

  const byDoctorToday: Record<string, { doctorId: string; total: number; count: number }> = {}
  for (const p of todayPayments) {
    if (!byDoctorToday[p.doctorId]) {
      byDoctorToday[p.doctorId] = { doctorId: p.doctorId, total: 0, count: 0 }
    }
    byDoctorToday[p.doctorId].total += p.amount
    byDoctorToday[p.doctorId].count += 1
  }

  // ── Unpaid Aging ───────────────────────────────────────────
  const unpaidInvoices = invoices.filter(
    (inv) => inv.status === "unpaid" || inv.status === "partially-paid"
  )
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

  // ── Doctor Revenue ─────────────────────────────────────────
  const doctorRevenue = doctors.map((doc) => {
    const docInvoices = invoices.filter(
      (inv) => inv.doctorId === doc.id && inv.status !== "voided"
    )
    return {
      doc,
      invoiceCount: docInvoices.length,
      totalBilled: docInvoices.reduce((s, i) => s + i.totalAmount, 0),
      totalCollected: docInvoices.reduce((s, i) => s + i.paidAmount, 0),
      outstanding: docInvoices.reduce((s, i) => s + i.balance, 0),
    }
  })

  // ── Patient Outstanding Balances ───────────────────────────
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

  const totalOutstanding = unpaidInvoices.reduce((s, i) => s + i.balance, 0)
  const totalRevenue = invoices.reduce((s, i) => s + i.paidAmount, 0)

  return (
    <>
      <PageHeader
        title="Reports"
        description="Financial summaries and operational analytics."
        breadcrumbs={[{ label: "Reports" }]}
      />

      {/* Summary stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Collections"
          value={`Rs. ${totalCollectedToday.toLocaleString()}`}
          description={`${todayPayments.length} payment${todayPayments.length !== 1 ? "s" : ""} today`}
          icon={DollarSign}
        />
        <StatCard
          title="Total Revenue"
          value={`Rs. ${totalRevenue.toLocaleString()}`}
          description="All-time payments received"
          icon={TrendingUp}
        />
        <StatCard
          title="Outstanding Balance"
          value={`Rs. ${totalOutstanding.toLocaleString()}`}
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

      <Tabs defaultValue="collections" className="mt-6">
        <TabsList>
          <TabsTrigger value="collections">Daily Collections</TabsTrigger>
          <TabsTrigger value="aging">Unpaid Aging</TabsTrigger>
          <TabsTrigger value="doctor-revenue">Doctor Revenue</TabsTrigger>
          <TabsTrigger value="outstanding">Patient Balances</TabsTrigger>
        </TabsList>

        {/* ── Daily Collections ── */}
        <TabsContent value="collections" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Collections by Staff</CardTitle>
                <CardDescription>Payments collected today by each staff member</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(byCollector).length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No collections recorded today.
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
                      {Object.values(byCollector).map((c) => (
                        <TableRow key={c.name}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-center">{c.count}</TableCell>
                          <TableCell className="text-right font-semibold">
                            Rs. {c.total.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2 font-semibold bg-muted/30">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-center">{todayPayments.length}</TableCell>
                        <TableCell className="text-right">
                          Rs. {totalCollectedToday.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Collections by Doctor</CardTitle>
                <CardDescription>Payments collected today per doctor</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(byDoctorToday).length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No collections recorded today.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Doctor</TableHead>
                        <TableHead className="text-center">Payments</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.values(byDoctorToday).map((d) => {
                        const doctor = getDoctor(d.doctorId)
                        return (
                          <TableRow key={d.doctorId}>
                            <TableCell className="font-medium">
                              {doctor?.name ?? d.doctorId}
                            </TableCell>
                            <TableCell className="text-center">{d.count}</TableCell>
                            <TableCell className="text-right font-semibold">
                              Rs. {d.total.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment Details</CardTitle>
              <CardDescription>All individual payments received on {TODAY} (PKT)</CardDescription>
            </CardHeader>
            <CardContent>
              {todayPayments.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No payments recorded today.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Collected By</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Link
                            href={`/billing/${p.invoiceId}`}
                            className="text-primary hover:underline font-medium"
                          >
                            #{p.invoiceId}
                          </Link>
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
                          Rs. {p.amount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Unpaid Aging ── */}
        <TabsContent value="aging" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
                  0–7 Days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">
                  Rs. {agingTotals["0-7"].toLocaleString()}
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
                  Rs. {agingTotals["8-30"].toLocaleString()}
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
                  Rs. {agingTotals["31+"].toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-red-700 dark:text-red-500">
                  {aging["31+"].length} invoice{aging["31+"].length !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>
          </div>

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
                    Rs. {agingTotals[bucket].toLocaleString()} outstanding
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
                                #{inv.id}
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
                              Rs. {inv.balance.toLocaleString()}
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

        {/* ── Doctor Revenue ── */}
        <TabsContent value="doctor-revenue" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Doctor-wise Revenue Summary</CardTitle>
              <CardDescription>Billed vs. collected breakdown per doctor</CardDescription>
            </CardHeader>
            <CardContent>
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
                            Rs. {totalBilled.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-medium text-emerald-700">
                            Rs. {totalCollected.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            Rs. {outstanding.toLocaleString()}
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
                      Rs. {doctorRevenue.reduce((s, d) => s + d.totalBilled, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-emerald-700">
                      Rs. {doctorRevenue.reduce((s, d) => s + d.totalCollected, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      Rs. {doctorRevenue.reduce((s, d) => s + d.outstanding, 0).toLocaleString()}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Patient Outstanding Balances ── */}
        <TabsContent value="outstanding" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Patient Outstanding Balances</CardTitle>
              <CardDescription>
                {patientBalances.length} patient
                {patientBalances.length !== 1 ? "s" : ""} with unpaid invoices —{" "}
                Rs. {totalOutstanding.toLocaleString()} total outstanding
              </CardDescription>
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
                            Rs. {outstanding.toLocaleString()}
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
