"use client"

import { useState, useMemo } from "react"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Separator } from "@/components/ui/separator"
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Stethoscope,
  Receipt,
  FileText,
} from "lucide-react"
import { AddAppointmentModal } from "@/components/add-appointment-modal"
import type { Appointment } from "@/lib/types"
import Link from "next/link"
import { getPKTDateString, toPKTDateString } from "@/lib/pkt"

type ViewMode = "day" | "week" | "month"

const HOURS = Array.from({ length: 10 }, (_, i) => i + 8) // 8am to 5pm

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
  const { appointments, doctors, currentUser, getPatient, getDoctor, getInvoice } = useStore()

  // For doctor role, lock the filter to their own doctor record
  const isDoctor = currentUser?.role === "doctor"
  const myDoctorId = useMemo(() => {
    if (!isDoctor) return null
    return doctors.find((d) => d.email === currentUser?.email)?.id ?? null
  }, [isDoctor, doctors, currentUser])

  const [view, setView] = useState<ViewMode>("week")
  const [currentDate, setCurrentDate] = useState(TODAY)
  const [doctorFilter, setDoctorFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)

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
              <span className="min-w-[200px] text-center text-sm font-medium">{dateLabel}</span>
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(navigateDate(currentDate, view, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCurrentDate(TODAY)}>
                Today
              </Button>
            </div>
            <div className="flex items-center gap-2">
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

      {/* Calendar Views */}
      {view === "day" && (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-col">
              {HOURS.map((hour) => {
                const hourStr = `${hour.toString().padStart(2, "0")}:00`
                const hourAppts = getAppointmentsForDate(currentDate).filter(
                  (a) => parseInt(a.time.split(":")[0]) === hour
                )
                return (
                  <div key={hour} className="flex min-h-[72px] border-b border-border/60 last:border-b-0">
                    <div className="flex w-20 shrink-0 items-start justify-end border-r border-border/60 p-2">
                      <span className="text-xs text-muted-foreground">{hourStr}</span>
                    </div>
                    <div className="flex flex-1 flex-wrap gap-2 p-2">
                      {hourAppts.map((apt) => {
                        const patient = getPatient(apt.patientId)
                        const doctor = getDoctor(apt.doctorId)
                        return (
                          <button
                            key={apt.id}
                            onClick={() => setSelectedAppointment(apt)}
                            className="flex flex-col rounded-lg bg-primary/10 p-2 text-left transition-colors hover:bg-primary/20 w-full sm:w-auto sm:min-w-[200px]"
                          >
                            <span className="text-sm font-medium text-foreground">{patient?.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {apt.time} - {doctor?.name}
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
                              onClick={() => setSelectedAppointment(apt)}
                              className="flex flex-col rounded-md bg-primary/10 p-1.5 text-left text-xs transition-colors hover:bg-primary/20"
                            >
                              <span className="font-medium text-foreground truncate">{patient?.name}</span>
                              <span className="text-muted-foreground">{apt.time}</span>
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
                                onClick={() => setSelectedAppointment(apt)}
                                className="rounded bg-primary/10 px-1 py-0.5 text-left text-[10px] font-medium text-foreground truncate hover:bg-primary/20"
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
      <Sheet open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {selectedAppointment && (
            <AppointmentDetailContent
              appointment={selectedAppointment}
              getPatient={getPatient}
              getDoctor={getDoctor}
              getInvoice={getInvoice}
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
  getPatient,
  getDoctor,
  getInvoice,
}: {
  appointment: Appointment
  getPatient: (id: string) => ReturnType<ReturnType<typeof useStore>["getPatient"]>
  getDoctor: (id: string) => ReturnType<ReturnType<typeof useStore>["getDoctor"]>
  getInvoice: (id: string) => ReturnType<ReturnType<typeof useStore>["getInvoice"]>
}) {
  const patient = getPatient(appointment.patientId)
  const doctor = getDoctor(appointment.doctorId)
  const invoice = getInvoice(appointment.invoiceId)

  return (
    <>
      <SheetHeader>
        <SheetTitle>Appointment Details</SheetTitle>
        <SheetDescription>
          {appointment.date} at {appointment.time}
        </SheetDescription>
      </SheetHeader>
      <div className="mt-6 flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <StatusBadge status={appointment.status} />
          <Badge variant="outline">{appointment.type}</Badge>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Patient</p>
              <Link href={`/patients/${appointment.patientId}`} className="text-sm font-medium hover:text-primary">
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
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-sm font-medium">{appointment.duration} minutes</p>
            </div>
          </div>
          {invoice && (
            <div className="flex items-center gap-3">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Invoice</p>
                <Link href={`/billing/${invoice.id}`} className="text-sm font-medium hover:text-primary">
                  #{invoice.id} - Rs. {invoice.totalAmount} (<StatusBadge status={invoice.status} />)
                </Link>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {appointment.notes && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Notes</p>
            </div>
            <p className="text-sm text-muted-foreground rounded-lg bg-muted p-3">{appointment.notes}</p>
          </div>
        )}

        {appointment.receptionNotes && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Reception Notes</p>
            <p className="text-sm text-muted-foreground rounded-lg bg-muted p-3">{appointment.receptionNotes}</p>
          </div>
        )}

        {appointment.doctorNotes && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Doctor Notes</p>
            <p className="text-sm text-muted-foreground rounded-lg bg-muted p-3">{appointment.doctorNotes}</p>
          </div>
        )}

        <Separator />

        <div className="flex flex-col gap-2">
          <Button variant="outline" size="sm">Reschedule</Button>
          <Button variant="outline" size="sm">Mark Completed</Button>
          <Button variant="destructive" size="sm">Cancel Appointment</Button>
        </div>
      </div>
    </>
  )
}
