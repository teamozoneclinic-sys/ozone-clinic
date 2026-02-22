"use client"

import { use } from "react"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  CalendarDays,
  Receipt,
  Stethoscope,
  FileText,
  Phone,
  Mail,
  MapPin,
  Droplets,
  User,
  AlertTriangle,
} from "lucide-react"
import Link from "next/link"

export default function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const {
    getPatient,
    getDoctor,
    getPatientAppointments,
    getPatientInvoices,
    getPatientTreatments,
  } = useStore()

  const patient = getPatient(id)

  if (!patient) {
    return (
      <>
        <PageHeader
          title="Patient Not Found"
          breadcrumbs={[
            { label: "Dashboard", href: "/" },
            { label: "Patients", href: "/patients" },
            { label: "Not Found" },
          ]}
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">This patient record does not exist.</p>
            <Button asChild className="mt-4">
              <Link href="/patients">Back to Patients</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  const doctor = getDoctor(patient.assignedDoctorId)
  const appointments = getPatientAppointments(patient.id)
  const invoices = getPatientInvoices(patient.id)
  const treatments = getPatientTreatments(patient.id)

  const upcomingAppointments = appointments
    .filter((a) => a.status === "scheduled" || a.status === "checked-in")
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
  const pastAppointments = appointments
    .filter((a) => a.status === "completed" || a.status === "cancelled" || a.status === "no-show")
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))

  const unpaidTotal = invoices.reduce((sum, inv) => sum + inv.balance, 0)

  return (
    <>
      <PageHeader
        title={patient.name}
        description={`Patient ID: ${patient.id}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Patients", href: "/patients" },
          { label: patient.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/appointments?action=add">
                <CalendarDays className="mr-1 h-4 w-4" />
                Book Appointment
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/treatments">
                <Stethoscope className="mr-1 h-4 w-4" />
                Start Treatment
              </Link>
            </Button>
          </div>
        }
      />

      {/* Outstanding Balance Banner */}
      {unpaidTotal > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                Outstanding Balance: Rs. {unpaidTotal.toLocaleString()}
              </p>
              <p className="text-xs text-amber-700">
                {invoices.filter((i) => i.status === "unpaid" || i.status === "partially-paid").length} unpaid invoice(s)
              </p>
            </div>
            <Button variant="outline" size="sm" className="border-amber-300 text-amber-800 hover:bg-amber-100">
              Collect Payment
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Medical History</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="treatments">Treatments</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Demographics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Gender / Age / DOB</p>
                      <p className="text-sm font-medium capitalize">{patient.gender}, {patient.age} years old</p>
                      {patient.dateOfBirth && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(patient.dateOfBirth).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="text-sm font-medium">{patient.phone}</p>
                    </div>
                  </div>
                  {patient.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="text-sm font-medium">{patient.email}</p>
                      </div>
                    </div>
                  )}
                  {patient.address && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Address</p>
                        <p className="text-sm font-medium">{patient.address}</p>
                      </div>
                    </div>
                  )}
                  {patient.bloodGroup && (
                    <div className="flex items-center gap-3">
                      <Droplets className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Blood Group</p>
                        <p className="text-sm font-medium">{patient.bloodGroup}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assigned Doctor</CardTitle>
                </CardHeader>
                <CardContent>
                  {doctor ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Stethoscope className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{doctor.name}</p>
                        <p className="text-xs text-muted-foreground">{doctor.specialty}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No doctor assigned</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tags & Notes</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-1">
                    {patient.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                    {patient.tags.length === 0 && (
                      <p className="text-sm text-muted-foreground">No tags</p>
                    )}
                  </div>
                  {patient.notes && (
                    <p className="text-sm text-muted-foreground rounded-lg bg-muted p-3">
                      {patient.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Medical History Tab */}
        <TabsContent value="history">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">History Entries</CardTitle>
                <CardDescription>{patient.medicalHistory.length} entries</CardDescription>
              </CardHeader>
              <CardContent>
                {patient.medicalHistory.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No medical history entries.</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {patient.medicalHistory.map((entry) => (
                      <div key={entry.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{entry.type}</Badge>
                          <span className="text-xs text-muted-foreground">{entry.date}</span>
                        </div>
                        <p className="mt-2 text-sm text-foreground">{entry.description}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Added by {entry.addedBy}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Documents</CardTitle>
                <CardDescription>{patient.documents.length} files</CardDescription>
              </CardHeader>
              <CardContent>
                {patient.documents.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No documents uploaded.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {patient.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-3 rounded-lg border p-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Uploaded {doc.uploadedAt} by {doc.uploadedBy}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments">
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upcoming Appointments</CardTitle>
                <CardDescription>{upcomingAppointments.length} upcoming</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingAppointments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">
                          No upcoming appointments.
                        </TableCell>
                      </TableRow>
                    ) : (
                      upcomingAppointments.map((apt) => (
                        <TableRow key={apt.id}>
                          <TableCell>{apt.date}</TableCell>
                          <TableCell>{apt.time}</TableCell>
                          <TableCell>{apt.type}</TableCell>
                          <TableCell><StatusBadge status={apt.status} /></TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Past Appointments</CardTitle>
                <CardDescription>{pastAppointments.length} past</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pastAppointments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">
                          No past appointments.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pastAppointments.map((apt) => (
                        <TableRow key={apt.id}>
                          <TableCell>{apt.date}</TableCell>
                          <TableCell>{apt.time}</TableCell>
                          <TableCell>{apt.type}</TableCell>
                          <TableCell><StatusBadge status={apt.status} /></TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Treatments Tab */}
        <TabsContent value="treatments">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Treatment Records</CardTitle>
              <CardDescription>{treatments.length} treatments</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead className="hidden md:table-cell">Complaint</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Follow-up</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {treatments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                        No treatment records.
                      </TableCell>
                    </TableRow>
                  ) : (
                    treatments.map((tr) => (
                      <TableRow key={tr.id} className="cursor-pointer hover:bg-accent/40">
                        <TableCell>{tr.date}</TableCell>
                        <TableCell className="font-medium">
                          <Link href={`/treatments/${tr.id}`} className="hover:text-primary">
                            {tr.diagnosis}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground max-w-[200px] truncate">
                          {tr.complaint}
                        </TableCell>
                        <TableCell><StatusBadge status={tr.status} /></TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {tr.followUpDate ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoices</CardTitle>
              <CardDescription>{invoices.length} invoices - Rs. {unpaidTotal} outstanding</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                        No invoices.
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((inv) => (
                      <TableRow key={inv.id} className="cursor-pointer hover:bg-accent/40">
                        <TableCell>
                          <Link href={`/billing/${inv.id}`} className="font-medium hover:text-primary">
                            #{inv.id}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{inv.createdAt}</TableCell>
                        <TableCell>Rs. {inv.totalAmount}</TableCell>
                        <TableCell className="text-emerald-600">Rs. {inv.paidAmount}</TableCell>
                        <TableCell className={inv.balance > 0 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                          Rs. {inv.balance}
                        </TableCell>
                        <TableCell><StatusBadge status={inv.status} /></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
