"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MessageCircle, BadgeCheck, CheckCircle2, Phone, Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function WhatsAppBookingsPage() {
  const { appointments, getPatient, getDoctor, getInvoice, acknowledgeAppointment } = useStore()
  const [busyId, setBusyId] = useState<string | null>(null)

  // Appointments booked through the WhatsApp bot, newest first
  const bookings = useMemo(
    () =>
      appointments
        .filter((a) => a.referral === "WhatsApp Bot")
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
    [appointments]
  )
  const pendingCount = bookings.filter((b) => !b.whatsappAcknowledgedBy).length

  const handleAcknowledge = async (id: string) => {
    setBusyId(id)
    try {
      await acknowledgeAppointment(id)
      toast.success("Booking acknowledged.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to acknowledge.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="WhatsApp Bookings"
        description="Appointments booked by patients through the WhatsApp bot."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "WhatsApp Bookings" }]}
      />

      {/* Summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total WhatsApp Bookings
              </p>
              <p className="mt-1 text-2xl font-bold">{bookings.length}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
              <MessageCircle className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Awaiting Acknowledgement
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-600">{pendingCount}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <BadgeCheck className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Patient</TableHead>
                <TableHead className="hidden md:table-cell">Procedure</TableHead>
                <TableHead className="hidden sm:table-cell">Date &amp; Time</TableHead>
                <TableHead className="hidden lg:table-cell">Doctor</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Acknowledgement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <MessageCircle className="h-8 w-8 opacity-40" />
                      <p className="text-sm">No WhatsApp bookings yet.</p>
                      <p className="text-xs">
                        Appointments booked by patients via the WhatsApp bot will appear here.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                bookings.map((apt) => {
                  const patient = getPatient(apt.patientId)
                  const doctor = getDoctor(apt.doctorId)
                  const invoice = getInvoice(apt.invoiceId)
                  const procedure =
                    invoice?.lineItems.find((li) => li.category === "procedure")?.description ?? "—"
                  const acknowledged = !!apt.whatsappAcknowledgedBy
                  return (
                    <TableRow key={apt.id} className={acknowledged ? "" : "bg-amber-50/40"}>
                      <TableCell>
                        {patient ? (
                          <Link href={`/patients/${apt.patientId}`} className="group flex flex-col">
                            <span className="font-medium transition-colors group-hover:text-primary">
                              {patient.name}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {patient.phone}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Unknown patient</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{procedure}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm whitespace-nowrap">
                        {apt.date} · {apt.time}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {doctor?.name ?? <span className="text-amber-600">Unassigned</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status={apt.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {acknowledged ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600"
                            title={
                              apt.whatsappAcknowledgedAt
                                ? `Acknowledged ${new Date(apt.whatsappAcknowledgedAt).toLocaleString()}`
                                : undefined
                            }
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Seen by {apt.whatsappAcknowledgedBy}
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                            disabled={busyId === apt.id}
                            onClick={() => handleAcknowledge(apt.id)}
                          >
                            {busyId === apt.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <BadgeCheck className="h-3.5 w-3.5" />
                            )}
                            Acknowledge
                          </Button>
                        )}
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
