"use client"

import { useState } from "react"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Users,
  CalendarDays,
  Receipt,
  TrendingUp,
  Plus,
  Clock,
  AlertTriangle,
  Eye,
  EyeOff,
  ShieldCheck,
  Bell,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"

// ─── Static mock data ──────────────────────────────────────────────────────

const COMPLIANCES = [
  { id: 1, title: "Medical License Renewal", due: "Feb 28, 2026", daysLeft: 7, status: "urgent" as const },
  { id: 2, title: "Equipment Calibration", due: "Mar 5, 2026", daysLeft: 12, status: "warning" as const },
  { id: 3, title: "HIPAA Compliance Audit", due: "Mar 15, 2026", daysLeft: 22, status: "ok" as const },
  { id: 4, title: "Tax Filing Deadline", due: "Mar 31, 2026", daysLeft: 38, status: "ok" as const },
]

const REMINDERS = [
  { id: 1, text: "Follow up with Ahmad Raza — MRI results pending", priority: "high" as const },
  { id: 2, text: "Submit monthly patient summary report", priority: "medium" as const },
  { id: 3, text: "Schedule staff meeting for next Monday", priority: "medium" as const },
  { id: 4, text: "Restock examination room supplies", priority: "low" as const },
]

// ─── Dashboard page ────────────────────────────────────────────────────────

export default function DashboardPage() {
  const {
    patients,
    getTodayAppointments,
    getUnpaidInvoices,
    getTotalRevenue,
    getPatient,
    getDoctor,
    getInvoice,
  } = useStore()

  const todayAppointments = getTodayAppointments()
  const unpaidInvoices = getUnpaidInvoices()
  const totalRevenue = getTotalRevenue()
  const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + inv.balance, 0)

  const [revenueHidden, setRevenueHidden] = useState(false)

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your clinic operations today."
        breadcrumbs={[{ label: "Dashboard" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/patients?action=add">
                <Plus className="mr-1 h-4 w-4" />
                Add Patient
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/appointments?action=add">
                <CalendarDays className="mr-1 h-4 w-4" />
                Book Appointment
              </Link>
            </Button>
          </div>
        }
      />

      {/* ── Stat Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Patients"
          value={patients.length}
          description="Registered patients"
          icon={Users}
        />
        <StatCard
          title="Today's Appointments"
          value={todayAppointments.length}
          description="Scheduled for today"
          icon={CalendarDays}
        />
        <StatCard
          title="Unpaid Invoices"
          value={unpaidInvoices.length}
          description={`Rs. ${totalUnpaid.toLocaleString()} outstanding`}
          icon={Receipt}
        />

        {/* Revenue card — custom with eye toggle */}
        <Card className="border-border/60">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-muted-foreground">Revenue Collected</p>
                  <button
                    type="button"
                    onClick={() => setRevenueHidden((h) => !h)}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                    title={revenueHidden ? "Show revenue" : "Hide revenue"}
                  >
                    {revenueHidden
                      ? <EyeOff className="h-3.5 w-3.5" />
                      : <Eye className="h-3.5 w-3.5" />
                    }
                  </button>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {revenueHidden ? "Rs. ••••••" : `Rs. ${totalRevenue.toLocaleString()}`}
                </p>
                <p className="text-xs text-muted-foreground">Total payments received</p>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Outstanding Balance Alert ── */}
      {totalUnpaid > 0 && (
        <Card className="mt-6 border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                Outstanding Balance: Rs. {totalUnpaid.toLocaleString()}
              </p>
              <p className="text-xs text-amber-700">
                {unpaidInvoices.length} invoice{unpaidInvoices.length !== 1 ? "s" : ""} pending payment
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="border-amber-300 text-amber-800 hover:bg-amber-100">
              <Link href="/billing">View All</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Main content grid: Schedule (wider) | Compliances + Reminders ── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-5">

        {/* Today's Schedule — col-span-3 */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">{"Today's Schedule"}</CardTitle>
                <CardDescription>
                  {todayAppointments.length} appointment{todayAppointments.length !== 1 ? "s" : ""} today
                </CardDescription>
              </div>
              <Link href="/appointments">
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground">
                  View all <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {todayAppointments.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No appointments scheduled for today.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {todayAppointments.map((apt) => {
                  const patient = getPatient(apt.patientId)
                  const doctor = getDoctor(apt.doctorId)
                  const invoice = apt.invoiceId ? getInvoice(apt.invoiceId) : undefined
                  const isPaid = invoice?.status === "paid"

                  return (
                    <Link
                      key={apt.id}
                      href="/appointments"
                      className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-3 transition-colors hover:bg-accent/40"
                    >
                      {/* Time block */}
                      <div className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/8 border border-primary/10">
                        <span className="text-xs font-bold text-primary leading-tight">{apt.time.slice(0, 5)}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          {apt.duration} min
                        </span>
                      </div>

                      {/* Patient info */}
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {patient?.name?.charAt(0) ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate leading-tight">
                            {patient?.name ?? "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Stethoscope className="h-3 w-3 shrink-0" />
                            {doctor?.name ?? "—"}
                          </p>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusBadge status={apt.status} />
                        {invoice && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0.5 font-medium ${
                              isPaid
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-red-200 bg-red-50 text-red-700"
                            }`}
                          >
                            {isPaid ? "Paid" : "Unpaid"}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column — Compliances + Reminders */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Compliances */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Compliances</CardTitle>
                  <CardDescription className="text-xs">Upcoming deadlines & renewals</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex flex-col gap-2">
              {COMPLIANCES.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border ${
                    item.status === "urgent"
                      ? "border-red-200 bg-red-50"
                      : item.status === "warning"
                      ? "border-amber-200 bg-amber-50"
                      : "border-border/60 bg-background"
                  }`}
                >
                  {item.status === "urgent" ? (
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  ) : item.status === "warning" ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Due {item.due}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 shrink-0 ${
                      item.status === "urgent"
                        ? "border-red-300 text-red-700"
                        : item.status === "warning"
                        ? "border-amber-300 text-amber-700"
                        : "border-emerald-300 text-emerald-700"
                    }`}
                  >
                    {item.daysLeft}d
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Reminders */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
                  <Bell className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Reminders</CardTitle>
                  <CardDescription className="text-xs">{REMINDERS.length} pending tasks</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex flex-col gap-2">
              {REMINDERS.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5 hover:bg-accent/30 transition-colors cursor-pointer"
                >
                  <div
                    className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                      item.priority === "high"
                        ? "bg-red-500"
                        : item.priority === "medium"
                        ? "bg-amber-500"
                        : "bg-muted-foreground/30"
                    }`}
                  />
                  <p className="text-sm text-foreground leading-snug">{item.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>

        </div>
      </div>
    </>
  )
}
