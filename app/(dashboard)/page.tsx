"use client"

import { useState, useMemo } from "react"
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
  AlertTriangle,
  Eye,
  EyeOff,
  MessageCircle,
  Stethoscope,
  ChevronRight,
  Phone,
} from "lucide-react"
import Link from "next/link"
import { getPKTDateString } from "@/lib/pkt"

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

type ScheduleView = "today" | "tomorrow" | "week"

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00")
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

function formatScheduleDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
}

// ─── Dashboard page ────────────────────────────────────────────────────────

export default function DashboardPage() {
  const {
    patients,
    doctors,
    appointments,
    currentUser,
    hasPermission,
    getTodayAppointments,
    getUnpaidInvoices,
    getTotalRevenue,
    getPatient,
    getDoctor,
    getInvoice,
  } = useStore()

  const isDoctor = currentUser?.role === "doctor"
  const canSeeBilling = hasPermission("billing.view")

  const today = getPKTDateString()

  // For doctor role, find their doctor record and filter to their appointments
  const myDoctorId = useMemo(() => {
    if (!isDoctor) return null
    if (currentUser?.doctorId) return currentUser.doctorId
    return doctors.find((d) => d.email.toLowerCase() === currentUser?.email?.toLowerCase())?.id ?? null
  }, [isDoctor, doctors, currentUser])

  const allTodayAppointments = getTodayAppointments()
  const todayAppointments = useMemo(() => {
    const ACTIVE = ["scheduled", "checked-in", "in-progress"]
    return myDoctorId
      ? allTodayAppointments.filter((a) => a.doctorId === myDoctorId && ACTIVE.includes(a.status))
      : allTodayAppointments.filter((a) => ACTIVE.includes(a.status))
  }, [allTodayAppointments, myDoctorId])

  const unpaidInvoices = getUnpaidInvoices()
  const totalRevenue = getTotalRevenue()
  const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + inv.balance, 0)

  const [revenueHidden, setRevenueHidden] = useState(true)

  // WhatsApp-bot bookings, newest first (live from the store)
  const waBookings = useMemo(
    () =>
      appointments
        .filter((a) => a.referral === "WhatsApp Bot")
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
    [appointments]
  )

  // ── Doctor schedule view (Today / Tomorrow / Next 7 Days) ──────────────
  const [scheduleView, setScheduleView] = useState<ScheduleView>("today")

  const scheduleAppointments = useMemo(() => {
    if (!isDoctor || !myDoctorId) return todayAppointments

    const ACTIVE_TODAY = ["scheduled", "checked-in", "in-progress"]
    const CONFIRMED = ["scheduled"]

    if (scheduleView === "today") {
      return appointments
        .filter((a) => a.doctorId === myDoctorId && a.date === today && ACTIVE_TODAY.includes(a.status))
        .sort((a, b) => a.time.localeCompare(b.time))
    }
    if (scheduleView === "tomorrow") {
      const tomorrow = addDaysToDate(today, 1)
      return appointments
        .filter((a) => a.doctorId === myDoctorId && a.date === tomorrow && CONFIRMED.includes(a.status))
        .sort((a, b) => a.time.localeCompare(b.time))
    }
    // "week" — next 7 days (days 1–7 from today)
    const weekDates = Array.from({ length: 7 }, (_, i) => addDaysToDate(today, i + 1))
    return appointments
      .filter((a) => a.doctorId === myDoctorId && weekDates.includes(a.date) && CONFIRMED.includes(a.status))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  }, [isDoctor, myDoctorId, scheduleView, appointments, todayAppointments, today])

  // Group by date for the week view
  const groupedSchedule = useMemo(() => {
    if (scheduleView !== "week" || !isDoctor) return null
    const groups = new Map<string, typeof scheduleAppointments>()
    for (const apt of scheduleAppointments) {
      if (!groups.has(apt.date)) groups.set(apt.date, [])
      groups.get(apt.date)!.push(apt)
    }
    return Array.from(groups.entries())
  }, [scheduleView, isDoctor, scheduleAppointments])

  const scheduleTitle =
    !isDoctor ? "Today's Schedule"
    : scheduleView === "today" ? "Today's Schedule"
    : scheduleView === "tomorrow" ? "Tomorrow's Schedule"
    : "Upcoming 7-Day Schedule"

  const pageDescription = isDoctor
    ? "Your patient schedule and clinical overview."
    : "Overview of your clinic operations today."

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={pageDescription}
        breadcrumbs={[{ label: "Dashboard" }]}
        actions={
          <div className="flex items-center gap-2">
            {hasPermission("patients.create") && (
              <Button asChild variant="outline" size="sm">
                <Link href="/patients?action=add">
                  <Plus className="mr-1 h-4 w-4" />
                  Add Patient
                </Link>
              </Button>
            )}
            {hasPermission("appointments.create") && (
              <Button asChild size="sm">
                <Link href="/appointments?action=add">
                  <CalendarDays className="mr-1 h-4 w-4" />
                  Book Appointment
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {/* ── Stat Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={isDoctor ? "My Patients Today" : "Total Patients"}
          value={isDoctor ? todayAppointments.length : patients.length}
          description={isDoctor ? "Appointments scheduled" : "Registered patients"}
          icon={Users}
        />
        <StatCard
          title="Today's Appointments"
          value={todayAppointments.length}
          description="Scheduled for today"
          icon={CalendarDays}
        />
        {canSeeBilling && (
          <StatCard
            title="Unpaid Invoices"
            value={unpaidInvoices.length}
            description={revenueHidden ? "Rs. •••••• outstanding" : `Rs. ${totalUnpaid.toLocaleString()} outstanding`}
            icon={Receipt}
          />
        )}

        {/* Revenue card — admin only */}
        {canSeeBilling && currentUser?.role === "admin" && (
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
        )}
      </div>

      {/* ── Outstanding Balance Alert (billing roles only) ── */}
      {canSeeBilling && totalUnpaid > 0 && (
        <Card className="mt-6 border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                Outstanding Balance: {revenueHidden ? "Rs. ••••••" : `Rs. ${totalUnpaid.toLocaleString()}`}
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

      {/* ── Main content grid: Schedule (wider) | Reminders ── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-5">

        {/* Schedule card — col-span-3 */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">{scheduleTitle}</CardTitle>
                <CardDescription>
                  {scheduleAppointments.length} appointment{scheduleAppointments.length !== 1 ? "s" : ""}
                  {scheduleView === "today" ? " today" : scheduleView === "tomorrow" ? " tomorrow" : " in the next 7 days"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* View tabs — only for doctor */}
                {isDoctor && (
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    {(["today", "tomorrow", "week"] as ScheduleView[]).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setScheduleView(v)}
                        className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                          scheduleView === v
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                      >
                        {v === "today" ? "Today" : v === "tomorrow" ? "Tomorrow" : "7 Days"}
                      </button>
                    ))}
                  </div>
                )}
                <Link href="/appointments">
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground">
                    View all <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {scheduleAppointments.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {scheduleView === "today"
                  ? "No appointments scheduled for today."
                  : scheduleView === "tomorrow"
                  ? "No appointments scheduled for tomorrow."
                  : "No upcoming appointments in the next 7 days."}
              </p>
            ) : groupedSchedule ? (
              /* Week grouped view */
              <div className="flex flex-col gap-5">
                {groupedSchedule.map(([date, apts]) => (
                  <div key={date}>
                    <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {formatScheduleDate(date)}
                    </p>
                    <div className="flex flex-col gap-2">
                      {apts.map((apt) => (
                        <AppointmentRow key={apt.id} apt={apt} getPatient={getPatient} getDoctor={getDoctor} getInvoice={getInvoice} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Today / Tomorrow flat list */
              <div className="flex flex-col gap-2">
                {scheduleAppointments.map((apt) => (
                  <AppointmentRow key={apt.id} apt={apt} getPatient={getPatient} getDoctor={getDoctor} getInvoice={getInvoice} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column — WA Requests */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-100">
                    <MessageCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">WhatsApp Bookings</CardTitle>
                    <CardDescription className="text-xs">
                      {waBookings.filter((b) => !b.whatsappAcknowledgedBy).length} awaiting acknowledgement
                    </CardDescription>
                  </div>
                </div>
                <Link href="/appointment-requests">
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground">
                    View all <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex flex-col gap-2">
              {waBookings.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No WhatsApp bookings yet.
                </p>
              ) : (
                waBookings.slice(0, 5).map((apt) => {
                  const patient = getPatient(apt.patientId)
                  const acknowledged = !!apt.whatsappAcknowledgedBy
                  return (
                    <Link
                      key={apt.id}
                      href="/appointment-requests"
                      className="flex items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5 hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
                        {(patient?.name ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {patient?.name ?? "Unknown patient"}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {patient?.phone ?? "—"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            acknowledged ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {acknowledged ? "Acknowledged" : "New"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(apt.createdAt)}</span>
                      </div>
                    </Link>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </>
  )
}

// ─── Shared appointment row component ─────────────────────────────────────

function AppointmentRow({
  apt,
  getPatient,
  getDoctor,
  getInvoice,
}: {
  apt: ReturnType<ReturnType<typeof useStore>["getTodayAppointments"]>[0]
  getPatient: ReturnType<typeof useStore>["getPatient"]
  getDoctor: ReturnType<typeof useStore>["getDoctor"]
  getInvoice: ReturnType<typeof useStore>["getInvoice"]
}) {
  const patient = getPatient(apt.patientId)
  const doctor = getDoctor(apt.doctorId)
  const invoice = apt.invoiceId ? getInvoice(apt.invoiceId) : undefined
  const isPaid = invoice?.status === "paid"

  return (
    <Link
      href="/appointments"
      className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-3 transition-colors hover:bg-accent/40"
    >
      {/* Time block */}
      <div className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-primary/10 bg-primary/8">
        <span className="text-xs font-bold text-primary leading-tight">{apt.time.slice(0, 5)}</span>
        <span className="mt-0.5 text-[10px] text-muted-foreground">{apt.duration} min</span>
      </div>

      {/* Patient info */}
      <div className="flex flex-1 min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {patient?.name?.charAt(0) ?? "?"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground leading-tight">
            {patient?.name ?? "Unknown"}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Stethoscope className="h-3 w-3 shrink-0" />
            {doctor?.name ?? "—"}
          </p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex shrink-0 items-center gap-1.5">
        <StatusBadge status={apt.status} />
        {invoice && (
          <Badge
            variant="outline"
            className={`px-1.5 py-0.5 text-[10px] font-medium ${
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
}
