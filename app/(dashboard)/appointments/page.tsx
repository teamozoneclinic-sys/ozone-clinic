"use client"

import { useState, useMemo } from "react"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Stethoscope,
  Receipt,
  FileText,
  FlaskConical,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
} from "lucide-react"
import { AddAppointmentModal } from "@/components/add-appointment-modal"
import { toast } from "sonner"
import type { Appointment, Doctor } from "@/lib/types"
import Link from "next/link"
import { getPKTDateString, toPKTDateString } from "@/lib/pkt"

type ViewMode = "day" | "week" | "month"

const HOURS = Array.from({ length: 24 }, (_, i) => i) // 12am to 11pm

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM"
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return "12 PM"
  return `${hour - 12} PM`
}

// Status → calendar-button color scheme. Soft tinted background + matching
// coloured left border + readable text. Same palette as STATUS_LEGEND below
// so the legend stays in sync.
function getStatusStyle(status: Appointment["status"]) {
  switch (status) {
    case "scheduled":
      return "bg-blue-50 border-l-4 border-l-blue-500 text-blue-900 hover:bg-blue-100"
    case "checked-in":
      return "bg-amber-50 border-l-4 border-l-amber-500 text-amber-900 hover:bg-amber-100"
    case "in-progress":
      return "bg-teal-50 border-l-4 border-l-teal-500 text-teal-900 hover:bg-teal-100"
    case "completed":
      return "bg-emerald-50 border-l-4 border-l-emerald-500 text-emerald-900 hover:bg-emerald-100"
    case "cancelled":
      return "bg-red-50 border-l-4 border-l-red-500 text-red-900 hover:bg-red-100"
    case "no-show":
      return "bg-gray-100 border-l-4 border-l-gray-400 text-gray-700 hover:bg-gray-200"
    default:
      return "bg-primary/10 border-l-4 border-l-primary text-foreground hover:bg-primary/20"
  }
}

// Legend rows — single source of truth for the swatch + label shown above
// the calendar. Keep the dot colours in sync with getStatusStyle().
const STATUS_LEGEND: { status: Appointment["status"]; label: string; dot: string }[] = [
  { status: "scheduled",   label: "Scheduled",   dot: "bg-blue-500" },
  { status: "checked-in",  label: "Checked In",  dot: "bg-amber-500" },
  { status: "in-progress", label: "In Progress", dot: "bg-teal-500" },
  { status: "completed",   label: "Completed",   dot: "bg-emerald-500" },
  { status: "cancelled",   label: "Cancelled",   dot: "bg-red-500" },
  { status: "no-show",     label: "No Show",     dot: "bg-gray-400" },
]

// "17:00" → "5:00 PM"
function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  if (Number.isNaN(h)) return hhmm
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m || 0).padStart(2, "0")} ${period}`
}

// "2026-06-15" → "Monday, 15 June 2026"
function formatDateLong(iso: string): string {
  const d = new Date(iso + "T00:00:00")
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

// "Hafiz Abubakar" → "HA"
function initials(name?: string): string {
  return (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

const TODAY = getPKTDateString()

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function getWeekDates(baseDate: string): string[] {
  const d = new Date(baseDate + "T00:00:00")
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((day + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    return toPKTDateString(date)
  })
}

function getMonthDates(baseDate: string): string[][] {
  const d = new Date(baseDate + "T00:00:00")
  const year = d.getFullYear()
  const month = d.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDay = (firstDay.getDay() + 6) % 7
  const weeks: string[][] = []
  let current = new Date(firstDay)
  current.setDate(current.getDate() - startDay)
  while (current <= lastDay || weeks.length < 6) {
    const week: string[] = []
    for (let i = 0; i < 7; i++) {
      week.push(toPKTDateString(current))
      current.setDate(current.getDate() + 1)
    }
    weeks.push(week)
    if (current > lastDay && weeks.length >= 4) break
  }
  return weeks
}

function navigateDate(dateStr: string, view: ViewMode, dir: number): string {
  const d = new Date(dateStr + "T00:00:00")
  if (view === "day") d.setDate(d.getDate() + dir)
  else if (view === "week") d.setDate(d.getDate() + dir * 7)
  else d.setMonth(d.getMonth() + dir)
  return toPKTDateString(d)
}

export default function AppointmentsPage() {
  const {
    appointments,
    doctors,
    currentUser,
    getPatient,
    getDoctor,
    getInvoice,
    updateAppointmentStatus,
    deleteAppointment,
    updateAppointment,
    assignDoctor,
    hasPermission,
  } = useStore()

  // For doctor role, lock the filter to their own doctor record
  const isDoctor = currentUser?.role === "doctor"
  const isAdmin = currentUser?.role === "admin"
  // `canManage` retained for actions that must stay admin/manager-only
  // (Assign Doctor — API also restricts to admin/manager). Date/Time editing
  // and Cancel button use matrix permissions instead.
  const canManage = isAdmin || currentUser?.role === "manager"
  const canEditAppointment = hasPermission("appointments.edit")
  const canCancelAppointment = hasPermission("appointments.cancel")

  const myDoctorId = useMemo(() => {
    if (!isDoctor) return null
    if (currentUser?.doctorId) return currentUser.doctorId
    return doctors.find((d) => d.email.toLowerCase() === currentUser?.email?.toLowerCase())?.id ?? null
  }, [isDoctor, doctors, currentUser])

  const [view, setView] = useState<ViewMode>("week")
  const [currentDate, setCurrentDate] = useState(TODAY)
  const [doctorFilter, setDoctorFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showAddModal, setShowAddModal] = useState(false)

  // Use ID-based selection so the Sheet always reflects the latest store data
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const selectedAppointment = useMemo(
    () => appointments.find((a) => a.id === selectedAppointmentId) ?? null,
    [appointments, selectedAppointmentId]
  )

  const [busyAction, setBusyAction] = useState(false)

  const closeSheet = () => setSelectedAppointmentId(null)

  const handleCancel = async () => {
    if (!selectedAppointmentId) return
    setBusyAction(true)
    try {
      await updateAppointmentStatus(selectedAppointmentId, "cancelled")
      toast.success("Appointment cancelled.")
      closeSheet()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel.")
    } finally {
      setBusyAction(false)
    }
  }

  const handleComplete = async () => {
    if (!selectedAppointmentId) return
    setBusyAction(true)
    try {
      await updateAppointmentStatus(selectedAppointmentId, "completed")
      toast.success("Appointment marked as completed.")
      closeSheet()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update.")
    } finally {
      setBusyAction(false)
    }
  }

  const handleDelete = async (reason: string) => {
    if (!selectedAppointmentId) return
    setBusyAction(true)
    try {
      await deleteAppointment(selectedAppointmentId, reason)
      toast.success("Appointment deleted.")
      closeSheet()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.")
    } finally {
      setBusyAction(false)
    }
  }

  const handleUpdateTime = async (date: string, time: string, duration: number) => {
    if (!selectedAppointmentId) return
    setBusyAction(true)
    try {
      await updateAppointment(selectedAppointmentId, { date, time, duration })
      toast.success("Appointment rescheduled.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reschedule.")
      throw err // re-throw so the form can stay open
    } finally {
      setBusyAction(false)
    }
  }

  const handleAssignDoctor = async (doctorId: string) => {
    if (!selectedAppointmentId) return
    setBusyAction(true)
    try {
      await assignDoctor(selectedAppointmentId, doctorId)
      toast.success("Doctor assigned to appointment.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign doctor.")
      throw err // re-throw so the form can stay open
    } finally {
      setBusyAction(false)
    }
  }

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      // Doctor role: always restrict to their own appointments
      if (myDoctorId) return a.doctorId === myDoctorId && (statusFilter === "all" || a.status === statusFilter)
      const matchDoctor = doctorFilter === "all" || a.doctorId === doctorFilter
      const matchStatus = statusFilter === "all" || a.status === statusFilter
      return matchDoctor && matchStatus
    })
  }, [appointments, doctorFilter, statusFilter, myDoctorId])

  const getAppointmentsForDate = (date: string) =>
    filteredAppointments.filter((a) => a.date === date)

  const dateLabel = (() => {
    const d = new Date(currentDate + "T00:00:00")
    if (view === "day") return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    if (view === "week") {
      const week = getWeekDates(currentDate)
      const start = new Date(week[0] + "T00:00:00")
      const end = new Date(week[6] + "T00:00:00")
      return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    }
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  })()

  return (
    <>
      <PageHeader
        title="Appointments"
        description={isDoctor ? "Your scheduled patient appointments." : "Schedule and manage patient appointments."}
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Appointments" }]}
        actions={
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Appointment
          </Button>
        }
      />

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(navigateDate(currentDate, view, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[160px] text-center text-sm font-medium sm:min-w-[200px]">{dateLabel}</span>
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(navigateDate(currentDate, view, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCurrentDate(TODAY)}>
                Today
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!isDoctor && (
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
              )}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="checked-in">Checked In</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex rounded-lg border border-border">
                {(["day", "week", "month"] as ViewMode[]).map((v) => (
                  <Button
                    key={v}
                    variant={view === v ? "default" : "ghost"}
                    size="sm"
                    className="rounded-none first:rounded-l-lg last:rounded-r-lg capitalize"
                    onClick={() => setView(v)}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status legend — mirrors getStatusStyle() colours */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-border/60 bg-card px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Legend
        </span>
        {STATUS_LEGEND.map((s) => (
          <span key={s.status} className="flex items-center gap-1.5 text-xs text-foreground">
            <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        ))}
      </div>

      {/* Calendar Views */}
      {view === "day" && (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-col">
              {HOURS.map((hour) => {
                const hourAppts = getAppointmentsForDate(currentDate).filter(
                  (a) => parseInt(a.time.split(":")[0]) === hour
                )
                return (
                  <div key={hour} className="flex min-h-[72px] border-b border-border/60 last:border-b-0">
                    <div className="flex w-20 shrink-0 items-start justify-end border-r border-border/60 p-2">
                      <span className="text-xs text-muted-foreground">{formatHour(hour)}</span>
                    </div>
                    <div className="flex flex-1 flex-wrap gap-2 p-2">
                      {hourAppts.map((apt) => {
                        const patient = getPatient(apt.patientId)
                        const doctor = getDoctor(apt.doctorId)
                        return (
                          <button
                            key={apt.id}
                            onClick={() => setSelectedAppointmentId(apt.id)}
                            className={`flex flex-col rounded-lg p-2 text-left transition-colors w-full sm:w-auto sm:min-w-[200px] ${getStatusStyle(apt.status)}`}
                          >
                            <span className="text-sm font-medium">{patient?.name}</span>
                            <span className="text-xs opacity-80">
                              {formatTime12h(apt.time)} - {doctor?.name ?? "Unassigned"}
                            </span>
                            <div className="mt-1">
                              <StatusBadge status={apt.status} />
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {view === "week" && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Week Header */}
              <div className="grid grid-cols-7 border-b border-border/60">
                {getWeekDates(currentDate).map((date) => {
                  const isToday = date === TODAY
                  return (
                    <div
                      key={date}
                      className={`p-2 text-center text-xs font-medium border-r border-border/60 last:border-r-0 ${
                        isToday ? "bg-primary/10 text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {formatDate(date)}
                    </div>
                  )
                })}
              </div>
              {/* Week Body */}
              <div className="grid grid-cols-7">
                {getWeekDates(currentDate).map((date) => {
                  const dayAppts = getAppointmentsForDate(date).sort((a, b) =>
                    a.time.localeCompare(b.time)
                  )
                  return (
                    <div key={date} className="min-h-[200px] border-r border-border/60 last:border-r-0 p-1.5">
                      <div className="flex flex-col gap-1">
                        {dayAppts.map((apt) => {
                          const patient = getPatient(apt.patientId)
                          return (
                            <button
                              key={apt.id}
                              onClick={() => setSelectedAppointmentId(apt.id)}
                              className={`flex flex-col rounded-md p-1.5 text-left text-xs transition-colors ${getStatusStyle(apt.status)}`}
                            >
                              <span className="font-medium truncate">{patient?.name}</span>
                              <span className="opacity-80">{formatTime12h(apt.time)}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {view === "month" && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Month header */}
              <div className="grid grid-cols-7 border-b border-border/60">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground border-r border-border/60 last:border-r-0">
                    {d}
                  </div>
                ))}
              </div>
              {/* Month weeks */}
              {getMonthDates(currentDate).map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b border-border/60 last:border-b-0">
                  {week.map((date) => {
                    const isCurrentMonth = new Date(date + "T00:00:00").getMonth() === new Date(currentDate + "T00:00:00").getMonth()
                    const isToday = date === TODAY
                    const dayAppts = getAppointmentsForDate(date)
                    return (
                      <div
                        key={date}
                        className={`min-h-[80px] border-r border-border/60 last:border-r-0 p-1 ${
                          !isCurrentMonth ? "bg-muted/30" : ""
                        }`}
                      >
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                            isToday ? "bg-primary text-primary-foreground font-bold" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {new Date(date + "T00:00:00").getDate()}
                        </span>
                        <div className="mt-0.5 flex flex-col gap-0.5">
                          {dayAppts.slice(0, 2).map((apt) => {
                            const patient = getPatient(apt.patientId)
                            return (
                              <button
                                key={apt.id}
                                onClick={() => setSelectedAppointmentId(apt.id)}
                                className={`rounded px-1 py-0.5 text-left text-[10px] font-medium truncate ${getStatusStyle(apt.status)}`}
                              >
                                {apt.time} {patient?.name?.split(" ")[0]}
                              </button>
                            )
                          })}
                          {dayAppts.length > 2 && (
                            <span className="px-1 text-[10px] text-muted-foreground">+{dayAppts.length - 2} more</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appointment Detail Sheet */}
      <Sheet open={!!selectedAppointmentId} onOpenChange={(open) => { if (!open) closeSheet() }}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {selectedAppointment && (
            <AppointmentDetailContent
              appointment={selectedAppointment}
              doctors={doctors}
              getPatient={getPatient}
              getDoctor={getDoctor}
              getInvoice={getInvoice}
              onCancel={handleCancel}
              onComplete={handleComplete}
              onDelete={handleDelete}
              onUpdateTime={handleUpdateTime}
              onAssignDoctor={handleAssignDoctor}
              isAdmin={isAdmin}
              canManage={canManage}
              canEditAppointment={canEditAppointment}
              canCancelAppointment={canCancelAppointment}
              isBusy={busyAction}
            />
          )}
        </SheetContent>
      </Sheet>

      <AddAppointmentModal open={showAddModal} onOpenChange={setShowAddModal} />
    </>
  )
}

function AppointmentDetailContent({
  appointment,
  doctors,
  getPatient,
  getDoctor,
  getInvoice,
  onCancel,
  onComplete,
  onDelete,
  onUpdateTime,
  onAssignDoctor,
  isAdmin,
  canManage,
  canEditAppointment,
  canCancelAppointment,
  isBusy,
}: {
  appointment: Appointment
  doctors: Doctor[]
  getPatient: (id: string) => ReturnType<ReturnType<typeof useStore>["getPatient"]>
  getDoctor: (id: string) => ReturnType<ReturnType<typeof useStore>["getDoctor"]>
  getInvoice: (id: string) => ReturnType<ReturnType<typeof useStore>["getInvoice"]>
  onCancel: () => Promise<void>
  onComplete: () => Promise<void>
  onDelete: (reason: string) => Promise<void>
  onUpdateTime: (date: string, time: string, duration: number) => Promise<void>
  onAssignDoctor: (doctorId: string) => Promise<void>
  isAdmin: boolean
  canManage: boolean
  canEditAppointment: boolean
  canCancelAppointment: boolean
  isBusy: boolean
}) {
  const patient = getPatient(appointment.patientId)
  const doctor = getDoctor(appointment.doctorId)
  const invoice = getInvoice(appointment.invoiceId)

  const [showModifyTime, setShowModifyTime] = useState(false)
  const [newDate, setNewDate] = useState(appointment.date)
  const [newTime, setNewTime] = useState(appointment.time)
  const [newDuration, setNewDuration] = useState(appointment.duration)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteReason, setDeleteReason] = useState("")
  const [showAssignDoctor, setShowAssignDoctor] = useState(false)
  const [assignDoctorId, setAssignDoctorId] = useState("")
  const assignDoctorFee = doctors.find((d) => d.id === assignDoctorId)?.consultationFee ?? null

  // Reset form when appointment changes (e.g. external update)
  const resetModifyForm = () => {
    setNewDate(appointment.date)
    setNewTime(appointment.time)
    setNewDuration(appointment.duration)
    setShowModifyTime(false)
  }

  const isScheduled = appointment.status === "scheduled"
  const isCheckedIn = appointment.status === "checked-in"
  const isInProgress = appointment.status === "in-progress"
  const isCancelled = appointment.status === "cancelled"
  const isNoShow = appointment.status === "no-show"
  const isActive = isScheduled || isCheckedIn || isInProgress
  // Admin may hard-delete anything that isn't actively in the treatment
  // pipeline OR already linked to a completed treatment record:
  //   - scheduled / cancelled / no-show → safe to purge
  //   - checked-in / in-progress        → patient is physically here
  //   - completed                       → has a Treatment record; deleting
  //     would orphan clinical data
  const isDeletable = isScheduled || isCancelled || isNoShow

  return (
    <>
      <SheetHeader>
        <SheetTitle>Appointment Details</SheetTitle>
        <SheetDescription>
          {formatDateLong(appointment.date)} at {formatTime12h(appointment.time)}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 flex flex-col gap-4">
        {/* Status + type */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={appointment.status} />
          <Badge variant="outline" className="capitalize">
            {appointment.type.replace(/-/g, " ")}
          </Badge>
        </div>

        {/* Patient — prominent card with avatar + quick contact */}
        <Link
          href={`/patients/${appointment.patientId}`}
          className="group flex items-center gap-3 rounded-lg border border-border/60 bg-card p-3 transition-colors hover:bg-accent/50"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {initials(patient?.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Patient
            </p>
            <p className="truncate text-sm font-semibold transition-colors group-hover:text-primary">
              {patient?.name ?? "Unknown"}
            </p>
            {patient?.phone && (
              <p className="truncate text-xs text-muted-foreground">{patient.phone}</p>
            )}
          </div>
        </Link>

        {/* When + Doctor — grouped card with subtle dividers */}
        <div className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
          <div className="flex items-start gap-3 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                When
              </p>
              <p className="text-sm font-medium">{formatDateLong(appointment.date)}</p>
              <p className="text-xs text-muted-foreground">
                {formatTime12h(appointment.time)} · {appointment.duration} min
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-100">
              <Stethoscope className="h-4 w-4 text-teal-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Doctor
              </p>
              <p
                className={`text-sm font-medium ${!appointment.doctorId ? "text-amber-600" : ""}`}
              >
                {doctor?.name ?? (appointment.doctorId ? "Unknown" : "Not assigned yet")}
              </p>
              {doctor?.specialty && (
                <p className="text-xs text-muted-foreground">{doctor.specialty}</p>
              )}
            </div>
          </div>
        </div>

        {/* Procedures (if any) — distinct card */}
        {(() => {
          const procedures = (invoice?.lineItems ?? []).filter((li) => li.category === "procedure")
          if (procedures.length === 0) return null
          return (
            <div className="rounded-lg border border-border/60 bg-card p-3">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100">
                  <FlaskConical className="h-3.5 w-3.5 text-purple-600" />
                </div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Procedure{procedures.length > 1 ? "s" : ""}
                </p>
              </div>
              <ul className="flex flex-col gap-1">
                {procedures.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm"
                  >
                    <span className="min-w-0 truncate font-medium">{p.description}</span>
                    <span className="shrink-0 font-semibold text-muted-foreground">
                      Rs. {(p.amount * p.quantity).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })()}

        {/* Invoice — financial card */}
        {invoice && (
          <Link
            href={`/billing/${invoice.id}`}
            className="group flex items-center gap-3 rounded-lg border border-border/60 bg-card p-3 transition-colors hover:bg-accent/50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
              <Receipt className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Invoice
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold transition-colors group-hover:text-primary">
                  Rs. {invoice.totalAmount.toLocaleString()}
                </span>
                <StatusBadge status={invoice.status} />
              </div>
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                #{invoice.id.slice(-8)}
              </p>
            </div>
          </Link>
        )}

        {/* Notes */}
        {(appointment.notes || appointment.receptionNotes || appointment.doctorNotes) && (
          <div className="flex flex-col gap-2">
            {appointment.notes && (
              <div className="rounded-lg border border-border/60 bg-card p-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Notes
                  </p>
                </div>
                <p className="text-sm whitespace-pre-wrap">{appointment.notes}</p>
              </div>
            )}
            {appointment.receptionNotes && (
              <div className="rounded-lg border border-border/60 bg-card p-3">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Reception Notes
                </p>
                <p className="text-sm whitespace-pre-wrap">{appointment.receptionNotes}</p>
              </div>
            )}
            {appointment.doctorNotes && (
              <div className="rounded-lg border border-border/60 bg-card p-3">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Doctor Notes
                </p>
                <p className="text-sm whitespace-pre-wrap">{appointment.doctorNotes}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Actions ── */}
        {/* Wrapper opens for any non-completed appointment so cancelled/no-show
            entries can still surface the admin-only Delete action. Each inner
            button retains its own status gate. */}
        {(isActive || isCancelled || isNoShow) && (
          <>
            <Separator />

            {/* Assign Doctor — active appointments only (no point on a cancelled one) */}
            {canManage && !appointment.doctorId && isActive && (
              <div>
                {!showAssignDoctor ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                    onClick={() => setShowAssignDoctor(true)}
                    disabled={isBusy}
                  >
                    <Stethoscope className="h-3.5 w-3.5" />
                    Assign Doctor
                  </Button>
                ) : (
                  <div className="rounded-lg border border-border p-3 flex flex-col gap-3 bg-muted/30">
                    <p className="text-sm font-semibold">Assign Doctor</p>
                    <Select value={assignDoctorId} onValueChange={setAssignDoctorId}>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue placeholder="Select a doctor" />
                      </SelectTrigger>
                      <SelectContent>
                        {doctors.filter((d) => d.isActive).map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name} — {d.specialty}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {assignDoctorFee != null && (
                      <p className="text-xs text-muted-foreground">
                        A consultation charge of Rs. {assignDoctorFee.toLocaleString()} will be added to the invoice.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5"
                        disabled={isBusy || !assignDoctorId}
                        onClick={() =>
                          onAssignDoctor(assignDoctorId)
                            .then(() => { setShowAssignDoctor(false); setAssignDoctorId("") })
                            .catch(() => {/* error toasted in parent */})
                        }
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Assign
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        onClick={() => { setShowAssignDoctor(false); setAssignDoctorId("") }}
                        disabled={isBusy}
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modify Date / Time — anyone with appointments.edit, scheduled only */}
            {canEditAppointment && isScheduled && (
              <div>
                {!showModifyTime ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => setShowModifyTime(true)}
                    disabled={isBusy}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Modify Date / Time
                  </Button>
                ) : (
                  <div className="rounded-lg border border-border p-3 flex flex-col gap-3 bg-muted/30">
                    <p className="text-sm font-semibold">Reschedule Appointment</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">Date</label>
                        <input
                          type="date"
                          value={newDate}
                          onChange={(e) => setNewDate(e.target.value)}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">Time</label>
                        <input
                          type="time"
                          value={newTime}
                          onChange={(e) => setNewTime(e.target.value)}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Duration</label>
                      <Select value={String(newDuration)} onValueChange={(v) => setNewDuration(Number(v))}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map((d) => (
                            <SelectItem key={d} value={String(d)}>
                              {d === 60 ? "1 hour" : `${d} min`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5"
                        disabled={isBusy || !newDate || !newTime}
                        onClick={() =>
                          onUpdateTime(newDate, newTime, newDuration)
                            .then(() => setShowModifyTime(false))
                            .catch(() => {/* error toasted in parent */})
                        }
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Save Changes
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1" onClick={resetModifyForm} disabled={isBusy}>
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Status actions */}
            <div className="flex flex-col gap-2">
              {(isCheckedIn || isInProgress) && (
                <Button variant="outline" size="sm" className="gap-1.5" disabled={isBusy} onClick={onComplete}>
                  {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Mark Completed
                </Button>
              )}
              {canCancelAppointment && (isScheduled || isCheckedIn) && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  disabled={isBusy}
                  onClick={onCancel}
                >
                  {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Cancel Appointment
                </Button>
              )}

              {/* Delete — admin only, scheduled / cancelled / no-show */}
              {isAdmin && isDeletable && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                  disabled={isBusy}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Appointment
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={(open) => { setShowDeleteConfirm(open); if (!open) setDeleteReason("") }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the appointment for{" "}
              <strong>{patient?.name ?? "this patient"}</strong> on{" "}
              <strong>{appointment.date} at {appointment.time}</strong>.
              Any unpaid invoice will be voided. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 pb-2 flex flex-col gap-1.5">
            <Label htmlFor="delete-reason" className="text-sm font-medium">
              Reason for deletion <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="delete-reason"
              placeholder="e.g. Patient requested cancellation, duplicate booking..."
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy} onClick={() => setDeleteReason("")}>Keep It</AlertDialogCancel>
            <AlertDialogAction
              disabled={isBusy || !deleteReason.trim()}
              onClick={() => onDelete(deleteReason.trim())}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              {isBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
