"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  Stethoscope,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  CalendarDays,
  Users,
  Receipt,
} from "lucide-react"
import { getPKTDateString } from "@/lib/pkt"

const TODAY = getPKTDateString()

export default function TreatmentsPage() {
  const { currentUser } = useStore()
  if (currentUser.role === "doctor") return <TreatmentDashboard />
  return <TreatmentList />
}

// ─── Doctor Treatment Dashboard ────────────────────────────────────────────────

function TreatmentDashboard() {
  const {
    currentUser,
    doctors,
    getDoctorAppointments,
    getPatient,
    getInvoice,
    getTreatmentByAppointment,
  } = useStore()

  const myDoctor = currentUser.doctorId
    ? doctors.find((d) => d.id === currentUser.doctorId)
    : doctors.find((d) => d.email.toLowerCase() === currentUser.email.toLowerCase())

  const todayAppointments = useMemo(() => {
    if (!myDoctor) return []
    return getDoctorAppointments(myDoctor.id, TODAY)
      .filter((a) => a.status !== "cancelled" && a.status !== "no-show")
      .sort((a, b) => a.time.localeCompare(b.time))
  }, [myDoctor, getDoctorAppointments])

  const clearedCount = todayAppointments.filter((a) => getInvoice(a.invoiceId)?.status === "paid").length
  const unpaidCount = todayAppointments.filter((a) => {
    const s = getInvoice(a.invoiceId)?.status
    return s === "unpaid" || s === "partially-paid"
  }).length

  return (
    <>
      <PageHeader
        title="Treatment Dashboard"
        description={`${TODAY} — Your patients for today`}
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Treatments" }]}
      />

      {/* Summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
              <Users className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{todayAppointments.length}</p>
              <p className="text-xs text-muted-foreground">Patients Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{clearedCount}</p>
              <p className="text-xs text-muted-foreground">Cleared (Bill Paid)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <Receipt className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{unpaidCount}</p>
              <p className="text-xs text-muted-foreground">Awaiting Payment</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Patient Cards */}
      {todayAppointments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No appointments scheduled for today.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {todayAppointments.map((apt) => {
            const patient = getPatient(apt.patientId)
            const invoice = getInvoice(apt.invoiceId)
            const existingTreatment = getTreatmentByAppointment(apt.id)

            const isCleared = invoice?.status === "paid"
            const isUnpaid = invoice?.status === "unpaid" || invoice?.status === "partially-paid"
            const isFinalized = !!existingTreatment

            const initials = (patient?.name ?? "?")
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)

            return (
              <Card
                key={apt.id}
                className={`flex flex-col transition-shadow hover:shadow-md ${isFinalized ? "opacity-70" : ""}`}
              >
                <CardContent className="flex flex-col gap-4 p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {initials}
                      </div>
                      <div>
                        <Link
                          href={`/patients/${apt.patientId}`}
                          className="text-sm font-semibold leading-tight hover:text-primary"
                        >
                          {patient?.name ?? "Unknown"}
                        </Link>
                        <p className="text-xs capitalize text-muted-foreground">
                          {patient?.gender}, {patient?.age} yrs
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      <Clock className="mr-1 h-3 w-3" />
                      {apt.time}
                    </Badge>
                  </div>

                  {/* Payment status + type */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{apt.type}</span>
                    {isFinalized ? (
                      <Badge className="border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-100">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Encounter Finalized
                      </Badge>
                    ) : isCleared ? (
                      <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Cleared
                      </Badge>
                    ) : (
                      <Badge className="border-red-200 bg-red-100 text-red-800 hover:bg-red-100">
                        <XCircle className="mr-1 h-3 w-3" />
                        Unpaid
                      </Badge>
                    )}
                  </div>

                  {/* Appointment notes preview */}
                  {apt.notes && (
                    <p className="line-clamp-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                      {apt.notes}
                    </p>
                  )}

                  {/* Action */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    {isFinalized ? (
                      <Button size="sm" disabled className="w-full">
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Encounter Finalized
                      </Button>
                    ) : isCleared ? (
                      <Button size="sm" className="w-full" asChild>
                        <Link href={`/treatments/encounter/${apt.id}`}>
                          <Stethoscope className="mr-1 h-4 w-4" />
                          Start Treatment
                        </Link>
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" disabled className="w-full">
                          <Stethoscope className="mr-1 h-4 w-4" />
                          Start Treatment
                        </Button>
                        <p className="text-center text-xs text-red-600">
                          Collect payment before starting treatment
                        </p>
                        {invoice && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full border-red-200 text-red-700 hover:bg-red-50"
                            asChild
                          >
                            <Link href={`/billing/${invoice.id}`}>
                              <Receipt className="mr-1 h-4 w-4" />
                              Rs. {invoice.balance.toLocaleString()} — Collect
                            </Link>
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─── Admin / Manager Treatment List ────────────────────────────────────────────

function TreatmentList() {
  const { treatments, doctors, getPatient, getDoctor } = useStore()
  const [search, setSearch] = useState("")
  const [doctorFilter, setDoctorFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const filtered = useMemo(() => {
    return treatments
      .filter((t) => {
        const patient = getPatient(t.patientId)
        const matchSearch =
          search === "" ||
          patient?.name.toLowerCase().includes(search.toLowerCase()) ||
          t.diagnosis.toLowerCase().includes(search.toLowerCase()) ||
          t.id.toLowerCase().includes(search.toLowerCase())
        const matchDoctor = doctorFilter === "all" || t.doctorId === doctorFilter
        const matchStatus = statusFilter === "all" || t.status === statusFilter
        return matchSearch && matchDoctor && matchStatus
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [treatments, search, doctorFilter, statusFilter, getPatient])

  return (
    <>
      <PageHeader
        title="Treatments"
        description="Clinical treatment records across all doctors."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Treatments" }]}
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by patient, diagnosis..."
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="follow-up-needed">Follow-up Needed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead className="hidden md:table-cell">Doctor</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Diagnosis</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Follow-up</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No treatment records found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((tr) => {
                  const patient = getPatient(tr.patientId)
                  const doctor = getDoctor(tr.doctorId)
                  return (
                    <TableRow key={tr.id} className="hover:bg-accent/40">
                      <TableCell>
                        <Link href={`/patients/${tr.patientId}`} className="font-medium hover:text-primary">
                          {patient?.name ?? "Unknown"}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {doctor?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{tr.date}</TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/treatments/${tr.id}`} className="hover:text-primary">
                          {tr.diagnosis}
                        </Link>
                      </TableCell>
                      <TableCell><StatusBadge status={tr.status} /></TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                        {tr.followUpDate ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Link href={`/treatments/${tr.id}`}>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
    </>
  )
}
