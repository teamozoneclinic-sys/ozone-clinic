"use client"

import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CalendarDays, Receipt, DollarSign, Plus, Clock, AlertTriangle } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  const {
    patients,
    getTodayAppointments,
    getUnpaidInvoices,
    getTotalRevenue,
    getPatient,
    getDoctor,
  } = useStore()

  const todayAppointments = getTodayAppointments()
  const unpaidInvoices = getUnpaidInvoices()
  const totalRevenue = getTotalRevenue()
  const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + inv.balance, 0)

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

      {/* Stat Cards */}
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
        <StatCard
          title="Revenue Collected"
          value={`Rs. ${totalRevenue.toLocaleString()}`}
          description="Total payments received"
          icon={DollarSign}
        />
      </div>

      {/* Outstanding Balance Alert */}
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

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Today's Schedule */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{"Today's Schedule"}</CardTitle>
            <CardDescription>
              {todayAppointments.length} appointment{todayAppointments.length !== 1 ? "s" : ""} today
            </CardDescription>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No appointments scheduled for today.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {todayAppointments.map((apt) => {
                  const patient = getPatient(apt.patientId)
                  const doctor = getDoctor(apt.doctorId)
                  return (
                    <Link
                      key={apt.id}
                      href={`/appointments`}
                      className="flex items-center gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:bg-accent/50"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {patient?.name ?? "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {apt.time} - {doctor?.name} - {apt.type}
                        </p>
                      </div>
                      <StatusBadge status={apt.status} />
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Unpaid Invoices */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Unpaid Invoices</CardTitle>
            <CardDescription>Invoices requiring payment</CardDescription>
          </CardHeader>
          <CardContent>
            {unpaidInvoices.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">All invoices are paid. Great job!</p>
            ) : (
              <div className="flex flex-col gap-3">
                {unpaidInvoices.slice(0, 5).map((inv) => {
                  const patient = getPatient(inv.patientId)
                  const doctor = getDoctor(inv.doctorId)
                  return (
                    <Link
                      key={inv.id}
                      href={`/billing/${inv.id}`}
                      className="flex items-center gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:bg-accent/50"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                        <Receipt className="h-4 w-4 text-destructive" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {patient?.name ?? "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {doctor?.name} - #{inv.id}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-foreground">Rs. {inv.balance}</p>
                        <StatusBadge status={inv.status} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
