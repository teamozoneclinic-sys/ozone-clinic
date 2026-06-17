"use client"

import { use, useEffect, useRef, useState } from "react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CalendarDays,
  Stethoscope,
  FileText,
  Phone,
  Mail,
  MapPin,
  Droplets,
  User,
  AlertTriangle,
  Upload,
  Eye,
  Download,
  Trash2,
  ClipboardList,
  Loader2,
  UserCog,
  ArrowRight,
  MessageCircle,
} from "lucide-react"
import Link from "next/link"
import type { PatientDocument } from "@/lib/types"
import { toast } from "sonner"

export default function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { getPatient } = useStore()

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

  return <PatientProfileContent patientId={id} />
}

// ─── Inner component (has hooks that depend on patient existing) ──────────────

function PatientProfileContent({ patientId }: { patientId: string }) {
  const {
    getPatient,
    getDoctor,
    getPatientAppointments,
    getPatientInvoices,
    getPatientTreatments,
    refreshLiveData,
    currentUser,
    doctors,
    updatePatient,
  } = useStore()

  const isAdmin = currentUser?.role === "admin"
  // Spec: admin, manager & receptionist may reassign a patient's doctor.
  const canReassignDoctor = ["admin", "manager", "receptionist"].includes(currentUser?.role ?? "")
  const [showReassignModal, setShowReassignModal] = useState(false)

  const patient = getPatient(patientId)!
  const doctor = getDoctor(patient.assignedDoctorId)
  const appointments = getPatientAppointments(patient.id)
  const invoices = getPatientInvoices(patient.id)
  const treatments = getPatientTreatments(patient.id).sort((a, b) =>
    b.date.localeCompare(a.date)
  )

  const upcomingAppointments = appointments
    .filter((a) => a.status === "scheduled" || a.status === "checked-in")
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
  const pastAppointments = appointments
    .filter(
      (a) => a.status === "completed" || a.status === "cancelled" || a.status === "no-show"
    )
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))

  const unpaidTotal = invoices.reduce((sum, inv) => sum + inv.balance, 0)

  // ── Documents local state ─────────────────────────────────────────────────
  const [documents, setDocuments] = useState<PatientDocument[]>(patient.documents ?? [])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [sendingDocId, setSendingDocId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Send a stored document to the patient on WhatsApp (greeting + file)
  const handleSendDocOnWhatsApp = async (docId: string, docName: string) => {
    setSendingDocId(docId)
    try {
      const res = await fetch(
        `/api/patients/${patientId}/documents/${docId}/send-whatsapp`,
        { method: "POST" }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Send failed (${res.status})`)
      toast.success(`"${docName}" sent to ${patient.name} on WhatsApp.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send on WhatsApp.")
    } finally {
      setSendingDocId(null)
    }
  }

  // Fetch the freshest copy of the patient on mount — newly uploaded documents
  // (added in an encounter) may not be in the store snapshot yet. Also kick a
  // background refresh of appointments / treatments / invoices.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/patients/${patientId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.data) return
        setDocuments(data.data.documents ?? [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingDocs(false)
      })
    refreshLiveData().catch(() => {})
    return () => { cancelled = true }
  }, [patientId, refreshLiveData])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 10 MB.")
      return
    }
    setUploading(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(",")[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch(`/api/patients/${patient.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, data: base64 }),
      })
      let data
      try {
        data = await res.json()
      } catch {
        throw new Error(
          res.status === 413
            ? "File too large. Try a smaller file (under 4 MB)."
            : `Server error (${res.status}). Try a smaller file.`
        )
      }
      if (!res.ok) throw new Error(data.error || "Upload failed")
      setDocuments(data.data.documents ?? [])
      toast.success(`"${file.name}" uploaded.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDeleteDoc = async (docId: string, docName: string) => {
    setDeletingDocId(docId)
    try {
      const res = await fetch(
        `/api/patients/${patient.id}/documents?docId=${docId}`,
        { method: "DELETE" }
      )
      let data
      try {
        data = await res.json()
      } catch {
        throw new Error(`Server error (${res.status}).`)
      }
      if (!res.ok) throw new Error(data.error || "Delete failed")
      setDocuments(data.data.documents ?? [])
      toast.success(`"${docName}" removed.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeletingDocId(null)
    }
  }

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
                {invoices.filter((i) => i.status === "unpaid" || i.status === "partially-paid")
                  .length}{" "}
                unpaid invoice(s)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-800 hover:bg-amber-100"
              asChild
            >
              <Link href={`/billing`}>Collect Payment</Link>
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

        {/* ── Overview Tab ── */}
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
                      <p className="text-sm font-medium capitalize">
                        {patient.gender}, {patient.age} years old
                      </p>
                      {patient.dateOfBirth && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(patient.dateOfBirth).toLocaleDateString("en-PK", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
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
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Assigned Doctor</CardTitle>
                  {canReassignDoctor && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => setShowReassignModal(true)}
                      title={doctor ? "Change assigned doctor" : "Assign a doctor"}
                    >
                      <UserCog className="h-3.5 w-3.5" />
                      {doctor ? "Change" : "Assign"}
                    </Button>
                  )}
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
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
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

        {/* ── Medical History Tab ── */}
        <TabsContent value="history">
          <div className="grid gap-6 lg:grid-cols-2">

            {/* History Entries — real treatments */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <div>
                    <CardTitle className="text-base">Treatment History</CardTitle>
                    <CardDescription>
                      {treatments.length} treatment record{treatments.length !== 1 ? "s" : ""} at
                      this hospital
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {treatments.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No treatment records found.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {treatments.map((tr) => {
                      const treatingDoctor = getDoctor(tr.doctorId)
                      const trDocs = documents.filter((d) => d.treatmentId === tr.id)
                      return (
                        <div
                          key={tr.id}
                          className="overflow-hidden rounded-lg border border-border/70 transition-colors hover:border-border"
                        >
                          <Link
                            href={`/treatments/${tr.id}`}
                            className="flex flex-col gap-2 p-3 transition-colors hover:bg-accent/30"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-foreground">
                                {tr.diagnosis || "—"}
                              </span>
                              <StatusBadge status={tr.status} />
                            </div>
                            {tr.complaint && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {tr.complaint}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Stethoscope className="h-3 w-3" />
                                {treatingDoctor?.name ?? "—"}
                              </span>
                              <span>{tr.date}</span>
                            </div>
                            {tr.followUpDate && (
                              <p className="text-xs text-amber-600">
                                Follow-up: {tr.followUpDate}
                              </p>
                            )}
                          </Link>
                          {trDocs.length > 0 && (
                            <div className="flex flex-col gap-1 border-t border-border/60 bg-muted/30 px-3 py-2">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Attachments ({trDocs.length})
                              </p>
                              {trDocs.map((d) => (
                                <div
                                  key={d.id}
                                  className="flex items-center gap-1.5 text-xs"
                                >
                                  <a
                                    href={d.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex flex-1 min-w-0 items-center gap-1.5 text-foreground transition-colors hover:text-primary"
                                  >
                                    <FileText className="h-3 w-3 shrink-0 text-primary/60" />
                                    <span className="truncate">{d.name}</span>
                                  </a>
                                  <button
                                    type="button"
                                    title={
                                      patient.phone
                                        ? `Send to ${patient.name} on WhatsApp`
                                        : "Patient has no phone on file"
                                    }
                                    disabled={sendingDocId === d.id || !patient.phone}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      e.preventDefault()
                                      handleSendDocOnWhatsApp(d.id, d.name)
                                    }}
                                    className="flex h-6 w-6 items-center justify-center rounded text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40"
                                  >
                                    {sendingDocId === d.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <MessageCircle className="h-3 w-3" />
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Documents & Reports</CardTitle>
                    <CardDescription>
                      {documents.length} file{documents.length !== 1 ? "s" : ""} attached
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    {uploading ? "Uploading…" : "Attach File"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loadingDocs && documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Loader2 className="h-6 w-6 animate-spin text-primary/70" />
                    <p className="text-sm">Loading documents…</p>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground border-2 border-dashed rounded-lg">
                    <FileText className="h-8 w-8 opacity-40" />
                    <p className="text-sm">No documents uploaded yet.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" />
                      Upload First Document
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {documents.map((doc) => {
                      const linkedTreatment = doc.treatmentId
                        ? treatments.find((t) => t.id === doc.treatmentId)
                        : null
                      return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2.5"
                      >
                        <FileText className="h-5 w-5 shrink-0 text-primary/60" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.uploadedAt} · {doc.uploadedBy}
                            {linkedTreatment && (
                              <>
                                {" · "}
                                <Link
                                  href={`/treatments/${linkedTreatment.id}`}
                                  className="text-primary hover:underline"
                                >
                                  From treatment · {linkedTreatment.date}
                                </Link>
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="View"
                            onClick={() => window.open(doc.url, "_blank")}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Download"
                            onClick={() => {
                              const a = document.createElement("a")
                              a.href = `${doc.url}?download=1`
                              a.download = doc.name
                              a.click()
                            }}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title={
                              patient.phone
                                ? `Send to ${patient.name} on WhatsApp`
                                : "Patient has no phone on file"
                            }
                            disabled={sendingDocId === doc.id || !patient.phone}
                            onClick={() => handleSendDocOnWhatsApp(doc.id, doc.name)}
                          >
                            {sendingDocId === doc.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <MessageCircle className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                              title="Delete"
                              disabled={deletingDocId === doc.id}
                              onClick={() => handleDeleteDoc(doc.id, doc.name)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Appointments Tab ── */}
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
                          <TableCell className="capitalize">{apt.type}</TableCell>
                          <TableCell>
                            <StatusBadge status={apt.status} />
                          </TableCell>
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
                          <TableCell className="capitalize">{apt.type}</TableCell>
                          <TableCell>
                            <StatusBadge status={apt.status} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Treatments Tab ── */}
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
                    <TableHead>Doctor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Follow-up</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {treatments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                        No treatment records.
                      </TableCell>
                    </TableRow>
                  ) : (
                    treatments.map((tr) => {
                      const treatingDoctor = getDoctor(tr.doctorId)
                      return (
                        <TableRow key={tr.id} className="cursor-pointer hover:bg-accent/40">
                          <TableCell>{tr.date}</TableCell>
                          <TableCell className="font-medium">
                            <Link href={`/treatments/${tr.id}`} className="hover:text-primary">
                              {tr.diagnosis}
                            </Link>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground max-w-[180px] truncate">
                            {tr.complaint}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {treatingDoctor?.name ?? "—"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={tr.status} />
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">
                            {tr.followUpDate ?? "—"}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Billing Tab ── */}
        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoices</CardTitle>
              <CardDescription>
                {invoices.length} invoices — Rs. {unpaidTotal.toLocaleString()} outstanding
              </CardDescription>
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
                          <Link
                            href={`/billing/${inv.id}`}
                            className="font-medium hover:text-primary"
                          >
                            #{inv.id.slice(-6)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{inv.createdAt}</TableCell>
                        <TableCell>Rs. {inv.totalAmount.toLocaleString()}</TableCell>
                        <TableCell className="text-emerald-600">
                          Rs. {inv.paidAmount.toLocaleString()}
                        </TableCell>
                        <TableCell
                          className={
                            inv.balance > 0
                              ? "text-red-600 font-medium"
                              : "text-muted-foreground"
                          }
                        >
                          Rs. {inv.balance.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={inv.status} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showReassignModal && (
        <ChangeAssignedDoctorModal
          patientName={patient.name}
          currentDoctorId={patient.assignedDoctorId}
          doctors={doctors}
          onClose={() => setShowReassignModal(false)}
          onSave={async (newDoctorId) => {
            await updatePatient(patient.id, { assignedDoctorId: newDoctorId })
            toast.success("Assigned doctor updated.")
            setShowReassignModal(false)
          }}
        />
      )}
    </>
  )
}

// ─── Change Assigned Doctor Modal ────────────────────────────────────────────
function ChangeAssignedDoctorModal({
  patientName,
  currentDoctorId,
  doctors,
  onClose,
  onSave,
}: {
  patientName: string
  currentDoctorId: string
  doctors: ReturnType<typeof useStore>["doctors"]
  onClose: () => void
  onSave: (newDoctorId: string) => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState(currentDoctorId || "")
  const [saving, setSaving] = useState(false)
  const currentDoctor = doctors.find((d) => d.id === currentDoctorId)
  const nextDoctor = doctors.find((d) => d.id === selectedId)
  const isUnchanged = selectedId === (currentDoctorId || "")

  const handleSave = async () => {
    if (isUnchanged) {
      toast.info("No change — select a different doctor or cancel.")
      return
    }
    setSaving(true)
    try {
      await onSave(selectedId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reassign.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !saving) onClose() }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            Change Assigned Doctor
          </DialogTitle>
          <DialogDescription>
            Reassign <span className="font-medium text-foreground">{patientName}</span> to a different doctor.
            All prior appointments, treatments and invoices remain linked to their original doctor.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Current → next preview */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Current</p>
              <p className="text-sm font-medium truncate">
                {currentDoctor?.name ?? <span className="text-muted-foreground">No doctor assigned</span>}
              </p>
              {currentDoctor && (
                <p className="text-xs text-muted-foreground truncate">{currentDoctor.specialty}</p>
              )}
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-primary uppercase tracking-wide">New</p>
              <p className="text-sm font-medium truncate">
                {nextDoctor?.name ?? <span className="text-muted-foreground">Choose below</span>}
              </p>
              {nextDoctor && (
                <p className="text-xs text-muted-foreground truncate">{nextDoctor.specialty}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Select new doctor</label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Pick a doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors
                  .filter((d) => d.isActive)
                  .map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} <span className="text-xs text-muted-foreground">· {d.specialty}</span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <p className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
            <strong>Note:</strong> The new doctor will gain access to this patient&apos;s full history
            (past appointments, treatments, and uploaded documents). The previous doctor still keeps
            access to records they personally created.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || isUnchanged} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCog className="h-4 w-4" />}
            {saving ? "Saving…" : "Reassign Doctor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
