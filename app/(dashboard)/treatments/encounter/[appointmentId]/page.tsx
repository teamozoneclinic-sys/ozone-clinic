"use client"

import { use, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ClipboardList,
  Stethoscope,
  FileText,
  FlaskConical,
  User,
  Clock,
  CalendarDays,
  Search,
  X,
  CheckCircle2,
  ChevronRight,
  History,
  Pencil,
  Plus,
} from "lucide-react"
import type { Treatment } from "@/lib/types"
import Link from "next/link"
import { toast } from "sonner"

type Section = "notes" | "diagnosis" | "plan" | "tests" | "procedures"

const SECTIONS: { key: Section; label: string; icon: typeof ClipboardList }[] = [
  { key: "notes", label: "Clinical Notes", icon: ClipboardList },
  { key: "diagnosis", label: "Diagnosis", icon: Stethoscope },
  { key: "plan", label: "Treatment Plan", icon: FileText },
  { key: "tests", label: "Tests & Orders", icon: FlaskConical },
  { key: "procedures", label: "Procedures", icon: Pencil },
]

export default function EncounterPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>
}) {
  const { appointmentId } = use(params)
  const router = useRouter()
  const {
    getAppointment,
    getPatient,
    getDoctor,
    getInvoice,
    getTreatmentByAppointment,
    getPatientTreatments,
    createTreatment,
    updateTreatment,
    updateAppointmentStatus,
    testCatalog,
  } = useStore()

  const appointment = getAppointment(appointmentId)

  // ─── Guard: appointment not found ─────────────────────────────
  if (!appointment) {
    return (
      <>
        <PageHeader
          title="Encounter Not Found"
          breadcrumbs={[
            { label: "Dashboard", href: "/" },
            { label: "Treatments", href: "/treatments" },
            { label: "Not Found" },
          ]}
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">This appointment does not exist.</p>
            <Button asChild className="mt-4">
              <Link href="/treatments">Back to Treatments</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  const patient = getPatient(appointment.patientId)
  const doctor = getDoctor(appointment.doctorId)
  const invoice = getInvoice(appointment.invoiceId)
  const existingTreatment = getTreatmentByAppointment(appointmentId)

  // ─── Guard: bill not paid ──────────────────────────────────────
  const billPaid = invoice?.status === "paid"
  if (!billPaid && !existingTreatment) {
    return (
      <>
        <PageHeader
          title="Payment Required"
          breadcrumbs={[
            { label: "Dashboard", href: "/" },
            { label: "Treatments", href: "/treatments" },
            { label: "Payment Required" },
          ]}
        />
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
            <p className="text-sm font-medium text-red-800">
              The appointment invoice must be fully paid before starting a clinical encounter.
            </p>
            {invoice && (
              <p className="text-xs text-red-700">
                Invoice #{invoice.id} — Rs. {invoice.balance.toLocaleString()} outstanding
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/treatments">Back</Link>
              </Button>
              {invoice && (
                <Button asChild>
                  <Link href={`/billing/${invoice.id}`}>Collect Payment</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  const previousTreatments = getPatientTreatments(appointment.patientId)
    .filter((t) => t.id !== existingTreatment?.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  return (
    <EncounterForm
      appointmentId={appointmentId}
      appointment={appointment}
      patient={patient}
      doctor={doctor}
      existingTreatment={existingTreatment ?? null}
      createTreatment={createTreatment}
      updateTreatment={updateTreatment}
      updateAppointmentStatus={updateAppointmentStatus}
      testCatalog={testCatalog}
      previousTreatments={previousTreatments}
      router={router}
    />
  )
}

// ─── Main Encounter Form Component ────────────────────────────────────────────

function EncounterForm({
  appointmentId,
  appointment,
  patient,
  doctor,
  existingTreatment,
  createTreatment,
  updateTreatment,
  updateAppointmentStatus,
  testCatalog,
  previousTreatments,
  router,
}: {
  appointmentId: string
  appointment: ReturnType<ReturnType<typeof useStore>["getAppointment"]> & object
  patient: ReturnType<ReturnType<typeof useStore>["getPatient"]>
  doctor: ReturnType<ReturnType<typeof useStore>["getDoctor"]>
  existingTreatment: Treatment | null
  createTreatment: ReturnType<typeof useStore>["createTreatment"]
  updateTreatment: ReturnType<typeof useStore>["updateTreatment"]
  updateAppointmentStatus: ReturnType<typeof useStore>["updateAppointmentStatus"]
  testCatalog: ReturnType<typeof useStore>["testCatalog"]
  previousTreatments: Treatment[]
  router: ReturnType<typeof useRouter>
}) {
  const isEdit = !!existingTreatment
  const [activeSection, setActiveSection] = useState<Section>("notes")

  // Form state — pre-fill if editing
  const [complaint, setComplaint] = useState(existingTreatment?.complaint ?? "")
  const [clinicalNotes, setClinicalNotes] = useState(existingTreatment?.clinicalNotes ?? "")
  const [diagnosis, setDiagnosis] = useState(existingTreatment?.diagnosis ?? "")
  const [doctorSummary, setDoctorSummary] = useState(existingTreatment?.doctorSummary ?? "")
  const [prescribedInstructions, setPrescribedInstructions] = useState(existingTreatment?.prescribedInstructions ?? "")
  const [followUpDate, setFollowUpDate] = useState(existingTreatment?.followUpDate ?? "")
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([])

  // Custom procedures state
  const [customProcedures, setCustomProcedures] = useState<{ name: string; amount: string }[]>([])
  const addProcedure = () => setCustomProcedures((prev) => [...prev, { name: "", amount: "" }])
  const removeProcedure = (i: number) => setCustomProcedures((prev) => prev.filter((_, idx) => idx !== i))
  const updateProcedure = (i: number, field: "name" | "amount", val: string) =>
    setCustomProcedures((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)))

  // Test selection state
  const [testSearch, setTestSearch] = useState("")
  const [testCategory, setTestCategory] = useState("all")

  const uniqueCategories = useMemo(
    () => Array.from(new Set(testCatalog.map((t) => t.category))),
    [testCatalog]
  )

  const filteredTests = useMemo(() => {
    return testCatalog.filter((t) => {
      const matchSearch =
        testSearch === "" || t.name.toLowerCase().includes(testSearch.toLowerCase())
      const matchCat = testCategory === "all" || t.category === testCategory
      return matchSearch && matchCat && t.isActive
    })
  }, [testCatalog, testSearch, testCategory])

  const selectedTests = testCatalog.filter((t) => selectedTestIds.includes(t.id))
  const totalTestCost = selectedTests.reduce((s, t) => s + t.price, 0)
  const totalProcedureCost = customProcedures.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)

  const toggleTest = (id: string) => {
    setSelectedTestIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const [finalizing, setFinalizing] = useState(false)

  const handleFinalize = async () => {
    // Validate follow-up date format if provided
    let parsedFollowUp: string | undefined
    if (followUpDate) {
      const match = followUpDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      if (!match) {
        toast.error("Follow-up date must be in DD/MM/YYYY format (e.g. 15/04/2026).")
        setActiveSection("plan")
        return
      }
      const [, dd, mm, yyyy] = match
      const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
      if (d.getDate() !== Number(dd) || d.getMonth() !== Number(mm) - 1) {
        toast.error("Invalid follow-up date.")
        setActiveSection("plan")
        return
      }
      parsedFollowUp = `${yyyy}-${mm}-${dd}`
    }

    // Validate custom procedures
    for (const p of customProcedures) {
      if (!p.name.trim() || !p.amount || isNaN(parseFloat(p.amount)) || parseFloat(p.amount) <= 0) {
        toast.error("Each custom procedure needs a name and a valid amount.")
        setActiveSection("procedures")
        return
      }
    }

    const validProcedures = customProcedures.map((p) => ({ name: p.name.trim(), amount: parseFloat(p.amount) }))

    setFinalizing(true)
    try {
      if (isEdit && existingTreatment) {
        await updateTreatment(existingTreatment.id, {
          complaint,
          clinicalNotes,
          diagnosis,
          prescribedInstructions,
          doctorSummary,
          followUpDate: parsedFollowUp,
          customProcedures: validProcedures,
          newTestIds: selectedTestIds,
        })
        toast.success("Consultation record updated.")
      } else {
        await createTreatment({
          patientId: appointment!.patientId,
          doctorId: appointment!.doctorId,
          appointmentId,
          date: appointment!.date,
          complaint,
          clinicalNotes,
          diagnosis,
          prescribedInstructions,
          testsRecommended: selectedTestIds,
          doctorSummary,
          followUpDate: parsedFollowUp,
          attachments: [],
          status: "completed",
          customProcedures: validProcedures,
        } as Parameters<typeof createTreatment>[0] & { customProcedures: { name: string; amount: number }[] })
        await updateAppointmentStatus(appointmentId, "completed")
        toast.success("Consultation finalized and treatment record saved.")
      }
      router.push("/treatments")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save consultation.")
      setFinalizing(false)
    }
  }

  const completionScore = [
    complaint.trim(),
    clinicalNotes.trim(),
    diagnosis.trim(),
    doctorSummary.trim(),
    prescribedInstructions.trim(),
  ].filter(Boolean).length

  return (
    <>
      <PageHeader
        title={isEdit ? `Edit Encounter — ${patient?.name ?? "Patient"}` : `Encounter — ${patient?.name ?? "Patient"}`}
        description={`${appointment!.type} · ${appointment!.date} at ${appointment!.time} · Dr. ${doctor?.name ?? "Unknown"}${isEdit ? " · Editing saved record" : ""}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Treatments", href: "/treatments" },
          { label: isEdit ? "Edit Encounter" : "Clinical Encounter" },
        ]}
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* ── Left: Section Navigator ──────────────────────────────── */}
        <div className="flex shrink-0 flex-row gap-1 lg:w-52 lg:flex-col">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            const isActive = activeSection === s.key
            return (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:flex-none ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden lg:inline">{s.label}</span>
              </button>
            )
          })}

          <Separator className="hidden lg:block my-2" />

          {/* Progress indicator */}
          <div className="hidden lg:block rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Completion</p>
            <div className="h-1.5 w-full rounded-full bg-border">
              <div
                className="h-1.5 rounded-full bg-primary transition-all"
                style={{ width: `${(completionScore / 5) * 100}%` }}
              />
            </div>
            <p className="mt-1">{completionScore}/5 sections filled</p>
          </div>
        </div>

        {/* ── Center: Form Content ─────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          {activeSection === "notes" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-4 w-4" />
                  Clinical Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="complaint">Chief Complaint</Label>
                  <Textarea
                    id="complaint"
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                    placeholder="Describe the patient's primary complaint..."
                    rows={3}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="clinical-notes">
                    HPI / Clinical Notes
                  </Label>
                  <Textarea
                    id="clinical-notes"
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    placeholder="History of present illness, review of systems, physical examination findings..."
                    rows={6}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveSection("diagnosis")}
                  >
                    Next: Diagnosis
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "diagnosis" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Stethoscope className="h-4 w-4" />
                  Diagnosis
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="diagnosis">Primary Diagnosis</Label>
                  <Input
                    id="diagnosis"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="e.g. Type 2 Diabetes Mellitus"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="doctor-summary">Doctor&apos;s Summary</Label>
                  <Textarea
                    id="doctor-summary"
                    value={doctorSummary}
                    onChange={(e) => setDoctorSummary(e.target.value)}
                    placeholder="Overall clinical assessment and summary for record..."
                    rows={5}
                  />
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" size="sm" onClick={() => setActiveSection("notes")}>
                    ← Back
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setActiveSection("plan")}>
                    Next: Plan
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "plan" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Treatment Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="instructions">Prescribed Instructions</Label>
                  <Textarea
                    id="instructions"
                    value={prescribedInstructions}
                    onChange={(e) => setPrescribedInstructions(e.target.value)}
                    placeholder="Medications, dosage, lifestyle advice, restrictions..."
                    rows={6}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="follow-up">Follow-up Date (DD/MM/YYYY)</Label>
                  <Input
                    id="follow-up"
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={followUpDate}
                    onChange={(e) => {
                      // Allow digits and separators, auto-format to DD/MM/YYYY
                      const raw = e.target.value.replace(/[^\d/]/g, "")
                      if (raw.length <= 10) setFollowUpDate(raw)
                    }}
                    maxLength={10}
                  />
                  <p className="text-xs text-muted-foreground">Format: DD/MM/YYYY (e.g. 15/04/2026)</p>
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" size="sm" onClick={() => setActiveSection("diagnosis")}>
                    ← Back
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setActiveSection("tests")}>
                    Next: Tests
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "tests" && (
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FlaskConical className="h-4 w-4" />
                    Order Tests
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {/* Search + category filter */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search tests..."
                        value={testSearch}
                        onChange={(e) => setTestSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={testCategory} onValueChange={setTestCategory}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {uniqueCategories.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Test grid */}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {filteredTests.map((test) => {
                      const isSelected = selectedTestIds.includes(test.id)
                      return (
                        <button
                          key={test.id}
                          onClick={() => toggleTest(test.id)}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                            isSelected
                              ? "border-primary bg-primary/5 text-foreground"
                              : "border-border hover:bg-accent/50"
                          }`}
                        >
                          <div>
                            <p className="font-medium leading-tight">{test.name}</p>
                            <p className="text-xs text-muted-foreground">{test.category}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-xs font-semibold">
                              Rs. {test.price.toLocaleString()}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        </button>
                      )
                    })}
                    {filteredTests.length === 0 && (
                      <p className="col-span-2 py-6 text-center text-sm text-muted-foreground">
                        No tests match your search.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Selected tests summary */}
              {selectedTests.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">
                      Selected Tests ({selectedTests.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {selectedTests.map((test) => (
                      <div
                        key={test.id}
                        className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{test.name}</p>
                          <p className="text-xs text-muted-foreground">{test.category}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            Rs. {test.price.toLocaleString()}
                          </span>
                          <button
                            onClick={() => toggleTest(test.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <Separator className="my-1" />
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Total Test Cost</span>
                      <span>Rs. {totalTestCost.toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-start">
                <Button variant="outline" size="sm" onClick={() => setActiveSection("plan")}>
                  ← Back
                </Button>
              </div>
            </div>
          )}

          {activeSection === "procedures" && (
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Pencil className="h-4 w-4" />
                    Custom Procedures
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-xs text-muted-foreground">
                    Add custom procedures performed during this visit. Each will be added as a line item on the invoice.
                  </p>
                  {customProcedures.map((proc, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        placeholder="Procedure name"
                        value={proc.name}
                        onChange={(e) => updateProcedure(i, "name", e.target.value)}
                        className="flex-1"
                      />
                      <div className="relative w-32">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rs.</span>
                        <Input
                          type="number"
                          placeholder="Amount"
                          value={proc.amount}
                          onChange={(e) => updateProcedure(i, "amount", e.target.value)}
                          className="pl-8"
                          min={0}
                        />
                      </div>
                      <button onClick={() => removeProcedure(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="self-start gap-1.5" onClick={addProcedure}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Procedure
                  </Button>
                  {customProcedures.length > 0 && (
                    <>
                      <Separator className="my-1" />
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Total Procedures Cost</span>
                        <span>Rs. {totalProcedureCost.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
              <div className="flex justify-start">
                <Button variant="outline" size="sm" onClick={() => setActiveSection("tests")}>
                  ← Back
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Patient & Appointment Info ───────────────────── */}
        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-64">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Patient</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {(patient?.name ?? "?")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div>
                  <Link
                    href={`/patients/${appointment!.patientId}`}
                    className="text-sm font-semibold hover:text-primary"
                  >
                    {patient?.name ?? "Unknown"}
                  </Link>
                  <p className="text-xs capitalize text-muted-foreground">
                    {patient?.gender}, {patient?.age} yrs
                  </p>
                </div>
              </div>
              {patient?.tags && patient.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {patient.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              {patient?.notes && (
                <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                  {patient.notes}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Appointment</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                <span>{appointment!.date}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>{appointment!.time} ({appointment!.duration} min)</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span>{doctor?.name ?? "Unknown"}</span>
              </div>
              <Separator className="my-1" />
              <p className="font-medium">{appointment!.type}</p>
              {appointment!.notes && (
                <p className="text-xs text-muted-foreground">{appointment!.notes}</p>
              )}
            </CardContent>
          </Card>

          {/* Previous visits */}
          {previousTreatments.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <History className="h-3.5 w-3.5" />
                  Previous Visits ({previousTreatments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {previousTreatments.map((tr) => (
                  <Link
                    key={tr.id}
                    href={`/treatments/${tr.id}`}
                    className="block rounded-md border border-border/60 px-2.5 py-2 text-xs hover:bg-accent/40 transition-colors"
                  >
                    <p className="font-medium text-foreground leading-tight truncate">
                      {tr.diagnosis}
                    </p>
                    <p className="text-muted-foreground mt-0.5">{tr.date}</p>
                    {tr.complaint && (
                      <p className="text-muted-foreground truncate mt-0.5 italic">
                        {tr.complaint}
                      </p>
                    )}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Finalize actions */}
          <div className="flex flex-col gap-2">
            <Button onClick={handleFinalize} className="w-full" disabled={finalizing}>
              <CheckCircle2 className="mr-1 h-4 w-4" />
              {finalizing ? "Saving…" : isEdit ? "Save Changes" : "Finalize Consultation"}
            </Button>
            <Button variant="outline" className="w-full" asChild disabled={finalizing}>
              <Link href="/treatments">Cancel</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
