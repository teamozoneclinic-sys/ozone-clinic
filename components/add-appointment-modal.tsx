"use client"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useStore } from "@/lib/store"
import { useState, useRef, useEffect, useMemo } from "react"
import { toast } from "sonner"
import {
  CalendarDays,
  Search,
  ChevronDown,
  X,
  Stethoscope,
  UserPlus,
  Phone,
  Loader2,
  Clock,
  AlertCircle,
  Plus,
  Percent,
  Receipt,
} from "lucide-react"
import type { Appointment, TestCatalogItem } from "@/lib/types"
import { getPKTDateString } from "@/lib/pkt"
import { AddPatientModal } from "@/components/add-patient-modal"

interface ProcedureEntry {
  name: string
  amount: number
}

interface AddAppointmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ─── Time slot helpers ─────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`
}

function generateSlots(startTime: string, endTime: string, step = 30): string[] {
  const slots: string[] = []
  const start = timeToMinutes(startTime)
  let end = timeToMinutes(endTime)
  // Handle overnight shifts (e.g., 21:00 to 05:00 next day)
  if (end <= start) end += 24 * 60
  let cur = start
  while (cur + step <= end) {
    const wrapped = cur % (24 * 60)
    const h = Math.floor(wrapped / 60).toString().padStart(2, "0")
    const m = (wrapped % 60).toString().padStart(2, "0")
    slots.push(`${h}:${m}`)
    cur += step
  }
  return slots
}

function isSlotBooked(slotTime: string, slotDuration: number, existing: Appointment[]): boolean {
  const slotStart = timeToMinutes(slotTime)
  const slotEnd = slotStart + slotDuration
  return existing.some((apt) => {
    const aptStart = timeToMinutes(apt.time)
    const aptEnd = aptStart + apt.duration
    return slotStart < aptEnd && slotEnd > aptStart
  })
}

function getDayName(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" })
}

// ─── Time Slot Picker ──────────────────────────────────────────────────────

function TimeSlotPicker({
  doctorId,
  date,
  duration,
  value,
  onChange,
}: {
  doctorId: string
  date: string
  duration: number
  value: string
  onChange: (t: string) => void
}) {
  const { doctors, appointments } = useStore()
  const doctor = doctors.find((d) => d.id === doctorId)

  const { slots, bookedSlots, schedules } = useMemo(() => {
    if (!doctor || !date) return { slots: [], bookedSlots: new Set<string>(), schedules: [] }

    const dayName = getDayName(date)
    const daySchedules = doctor.schedule.filter((s) => s.day === dayName)
    if (daySchedules.length === 0) return { slots: [], bookedSlots: new Set<string>(), schedules: [] }

    // All schedules are valid (includes overnight shifts where endTime < startTime)
    const validSchedules = daySchedules

    // Generate slots for every valid time range, deduplicate and sort
    const allSlotsSet = new Set<string>()
    for (const sched of validSchedules) {
      for (const slot of generateSlots(sched.startTime, sched.endTime, duration)) {
        allSlotsSet.add(slot)
      }
    }
    const allSlots = Array.from(allSlotsSet).sort((a, b) => timeToMinutes(a) - timeToMinutes(b))

    const existing = appointments.filter(
      (a) => a.doctorId === doctorId && a.date === date && a.status !== "cancelled"
    )

    const booked = new Set<string>()
    for (const slot of allSlots) {
      if (isSlotBooked(slot, duration, existing)) booked.add(slot)
    }

    return { slots: allSlots, bookedSlots: booked, schedules: validSchedules }
  }, [doctor, date, duration, doctorId, appointments])

  if (!doctorId || !date) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5 text-center text-sm text-muted-foreground">
        Select a doctor and date to see available time slots.
      </div>
    )
  }

  if (schedules.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Doctor is not available on {getDayName(date)}s. Please choose another date.
      </div>
    )
  }

  const available = slots.filter((s) => !bookedSlots.has(s))

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-muted-foreground">
        {schedules.map((s) => `${formatTime12h(s.startTime)}–${formatTime12h(s.endTime)}`).join(", ")} &nbsp;·&nbsp;
        <span className="text-emerald-600 font-medium">{available.length} slots free</span>
        {bookedSlots.size > 0 && (
          <span className="text-red-500"> · {bookedSlots.size} booked</span>
        )}
      </div>
      {slots.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">No slots available for this schedule.</p>
      ) : (
        <div className="grid grid-cols-4 gap-1.5 max-h-[150px] overflow-y-auto pr-1">
          {slots.map((slot) => {
            const booked = bookedSlots.has(slot)
            const selected = value === slot
            return (
              <button
                key={slot}
                type="button"
                disabled={booked}
                onClick={() => !booked && onChange(slot)}
                className={`rounded-md border text-xs font-medium py-1.5 transition-all ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : booked
                    ? "border-red-200 bg-red-50 text-red-400 cursor-not-allowed line-through"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300"
                }`}
              >
                {formatTime12h(slot)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Searchable Doctor Combobox ────────────────────────────────────────────

interface DoctorItem {
  id: string
  label: string
  sub: string
}

function DoctorCombobox({
  items,
  value,
  onChange,
}: {
  items: DoctorItem[]
  value: string
  onChange: (id: string) => void
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = items.find((i) => i.id === value)
  const filtered =
    query.trim() === ""
      ? items
      : items.filter(
          (i) =>
            i.label.toLowerCase().includes(query.toLowerCase()) ||
            i.sub.toLowerCase().includes(query.toLowerCase())
        )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleSelect = (item: DoctorItem) => {
    onChange(item.id)
    setQuery("")
    setOpen(false)
  }

  const displayValue = open ? query : selected?.label ?? query

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={displayValue}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search by name or specialty…"
          className={`h-10 pl-9 pr-8 ${selected && !open ? "font-medium" : ""}`}
        />
        {selected && !open ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); setQuery("") }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-[200px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground text-center">No doctors found.</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(item)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors ${item.id === value ? "bg-accent/70" : ""}`}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Stethoscope className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Procedure Picker ──────────────────────────────────────────────────────
// Lets the user pick a procedure from the Procedure Catalog or type a custom
// one, set its price, and add it to the appointment's billing.

function ProcedurePicker({ onAdd }: { onAdd: (p: ProcedureEntry) => void }) {
  const { testCatalog } = useStore()
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const activeCatalog = useMemo(
    () => testCatalog.filter((t) => t.isActive),
    [testCatalog]
  )

  const filtered = useMemo(() => {
    const q = name.trim().toLowerCase()
    if (!q) return activeCatalog
    return activeCatalog.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
    )
  }, [activeCatalog, name])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const pickCatalog = (item: TestCatalogItem) => {
    setName(item.name)
    setPrice(item.price.toString())
    setOpen(false)
  }

  const handleAdd = () => {
    const amount = parseFloat(price)
    if (!name.trim()) {
      toast.error("Enter a procedure name or pick one from the catalog.")
      return
    }
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid procedure price.")
      return
    }
    onAdd({ name: name.trim(), amount })
    setName("")
    setPrice("")
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="flex gap-2">
      {/* Name — catalog search / custom entry */}
      <div ref={ref} className="relative flex-1">
        <Input
          value={name}
          onChange={(e) => { setName(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search catalog or type a custom procedure…"
          className="h-9"
        />
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-[180px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-muted-foreground">
                {name.trim()
                  ? `No catalog match — "${name.trim()}" will be added as a custom procedure.`
                  : "No procedures in the catalog yet."}
              </p>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickCatalog(item)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">{item.category}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold">Rs. {item.price.toLocaleString()}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Price */}
      <div className="relative w-28 shrink-0">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rs.</span>
        <Input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="0"
          min={0}
          className="h-9 pl-9"
        />
      </div>

      {/* Add */}
      <Button
        type="button"
        variant="outline"
        onClick={handleAdd}
        className="h-9 shrink-0 gap-1 px-3"
      >
        <Plus className="h-3.5 w-3.5" />
        Add
      </Button>
    </div>
  )
}

// ─── Main Modal ────────────────────────────────────────────────────────────

export function AddAppointmentModal({ open, onOpenChange }: AddAppointmentModalProps) {
  const { patients, doctors, addAppointment, hasPermission, referenceDoctors } = useStore()
  const [patientSearch, setPatientSearch] = useState("")
  const [patientId, setPatientId] = useState("")
  const [doctorId, setDoctorId] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [duration, setDuration] = useState("30")
  const [type, setType] = useState("")
  const [referral, setReferral] = useState("")
  const [notes, setNotes] = useState("")
  const [procedures, setProcedures] = useState<ProcedureEntry[]>([])
  const [discountEnabled, setDiscountEnabled] = useState(false)
  const [discountDesc, setDiscountDesc] = useState("")
  const [discountAmount, setDiscountAmount] = useState("")
  const [saving, setSaving] = useState(false)
  // Nested "Add New Patient" flyout — opens inline so the user doesn't lose
  // the appointment form state they've already filled in.
  const [showAddPatient, setShowAddPatient] = useState(false)

  // Discounts may only be applied by admin & manager (billing.discount permission)
  const canDiscount = hasPermission("billing.discount")

  const doctorItems: DoctorItem[] = doctors
    .filter((d) => d.isActive)
    .map((d) => ({
      id: d.id,
      label: d.name,
      sub: `${d.specialty} · Rs. ${d.consultationFee.toLocaleString()}`,
    }))

  const selectedDoctor = doctors.find((d) => d.id === doctorId)

  // Today's date (clinic timezone) — appointments cannot be booked in the past
  const todayStr = getPKTDateString()

  // ── Billing preview ──────────────────────────────────────────────────────
  const consultationFee = selectedDoctor?.consultationFee ?? 0
  const proceduresTotal = procedures.reduce((sum, p) => sum + p.amount, 0)
  const parsedDiscount =
    canDiscount && discountEnabled ? Math.max(0, parseFloat(discountAmount) || 0) : 0
  const invoiceTotal = Math.max(0, consultationFee + proceduresTotal - parsedDiscount)

  const filteredPatients = patientSearch.trim()
    ? patients.filter(
        (p) =>
          p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
          p.phone.includes(patientSearch)
      )
    : patients

  const reset = () => {
    setPatientSearch(""); setPatientId(""); setDoctorId(""); setDate("")
    setTime(""); setDuration("30"); setType(""); setReferral(""); setNotes("")
    setProcedures([]); setDiscountEnabled(false); setDiscountDesc(""); setDiscountAmount("")
  }

  // Reset time whenever doctor or date changes
  useEffect(() => { setTime("") }, [doctorId, date])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!patientId || !date || !time) {
      toast.error("Please select a patient, date and time.")
      return
    }
    if (date < todayStr) {
      toast.error("Appointment date cannot be in the past.")
      return
    }
    if (canDiscount && discountEnabled && parsedDiscount > 0 && !discountDesc.trim()) {
      toast.error("Please enter a reason for the discount.")
      return
    }
    const patient = patients.find((p) => p.id === patientId)
    setSaving(true)
    try {
      await addAppointment({
        patientId,
        doctorId,
        date,
        time,
        duration: parseInt(duration),
        type: type || "consultation",
        referral: referral.trim(),
        notes: notes.trim(),
        status: "scheduled",
        procedures: procedures.length > 0 ? procedures : undefined,
        discount:
          canDiscount && discountEnabled && parsedDiscount > 0
            ? { description: discountDesc.trim(), amount: parsedDiscount }
            : undefined,
      })
      toast.success(`Appointment booked for ${patient?.name ?? "patient"}.`)
      onOpenChange(false)
      reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to book appointment.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[880px] p-0 gap-0 overflow-hidden max-h-[90svh] md:h-[640px] flex flex-col"
      >
        {/* ── Full-width Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <CalendarDays className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold leading-tight">
                New Appointment
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Select a patient, then fill in the appointment details.
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { onOpenChange(false); reset() }}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Two-panel body ── */}
        <div className="flex flex-1 min-h-0 flex-col md:flex-row overflow-auto md:overflow-hidden">

          {/* Left: Patient list */}
          <div className="w-full md:w-[260px] shrink-0 border-b md:border-b-0 md:border-r border-border flex flex-col bg-muted/20 max-h-[200px] md:max-h-none">
            <div className="px-3 pt-3 pb-2 shrink-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                Select Patient <span className="text-red-500">*</span>
              </p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search name or phone…"
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            {/* Scrollable patient list */}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {filteredPatients.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No patients found.</p>
              ) : (
                filteredPatients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPatientId(p.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg mb-0.5 text-left transition-all ${
                      patientId === p.id
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-background/80"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        patientId === p.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {p.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate leading-tight ${patientId === p.id ? "text-primary" : "text-foreground"}`}>
                        {p.name}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-2.5 w-2.5 shrink-0" />
                        {p.phone}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Add new patient */}
            <div className="px-3 py-2.5 border-t border-border shrink-0">
              <button
                type="button"
                onClick={() => setShowAddPatient(true)}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add New Patient
              </button>
            </div>
          </div>

          {/* Right: Form fields */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

              {/* Doctor */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium">
                  Doctor <span className="text-xs font-normal text-muted-foreground">(Optional — can be assigned later)</span>
                </Label>
                <DoctorCombobox
                  items={doctorItems}
                  value={doctorId}
                  onChange={setDoctorId}
                />
              </div>

              {/* Date | Duration | Type */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="apt-date" className="text-sm font-medium">
                    Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="apt-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={todayStr}
                    className="h-10"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-medium">Duration</Label>
                  <Select value={duration} onValueChange={(v) => { setDuration(v); setTime("") }}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 min</SelectItem>
                      <SelectItem value="10">10 min</SelectItem>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="20">20 min</SelectItem>
                      <SelectItem value="25">25 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="35">35 min</SelectItem>
                      <SelectItem value="40">40 min</SelectItem>
                      <SelectItem value="45">45 min</SelectItem>
                      <SelectItem value="50">50 min</SelectItem>
                      <SelectItem value="55">55 min</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-medium">Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultation">Consultation</SelectItem>
                      <SelectItem value="online-consultation">Online Consultation</SelectItem>
                      <SelectItem value="follow-up">Follow-up</SelectItem>
                      <SelectItem value="scan">Scan</SelectItem>
                      <SelectItem value="procedure">Procedure</SelectItem>
                      <SelectItem value="post-procedure">Post-Procedure</SelectItem>
                      <SelectItem value="patient-reports">Patient Reports</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Time Slot Picker */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Time Slot <span className="text-red-500">*</span>
                  {time && (
                    <span className="ml-auto text-xs font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Selected: {time}
                    </span>
                  )}
                </Label>
                {doctorId ? (
                  <TimeSlotPicker
                    doctorId={doctorId}
                    date={date}
                    duration={parseInt(duration)}
                    value={time}
                    onChange={setTime}
                  />
                ) : (
                  <>
                    <Input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="h-10"
                    />
                    <p className="text-xs text-muted-foreground">
                      No doctor selected — enter any time. Schedule-checked slots appear once a doctor is assigned.
                    </p>
                  </>
                )}
              </div>

              {/* Referral | Notes */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="apt-referral" className="text-sm font-medium">
                    Referred By <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                  </Label>
                  {/* Native <datalist> — offers the saved Reference Doctors as
                      suggestions while still accepting any free-text entry.
                      The submitted value is unchanged (whatever the user
                      typed / picked), so downstream storage stays identical. */}
                  <Input
                    id="apt-referral"
                    value={referral}
                    onChange={(e) => setReferral(e.target.value)}
                    placeholder="Who referred the patient?"
                    className="h-10"
                    list="reference-doctors-suggestions"
                    autoComplete="off"
                  />
                  <datalist id="reference-doctors-suggestions">
                    {referenceDoctors.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.specialty || r.hospital
                          ? `${r.specialty}${r.specialty && r.hospital ? " · " : ""}${r.hospital}`
                          : undefined}
                      </option>
                    ))}
                  </datalist>
                  {referenceDoctors.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Suggestions from {referenceDoctors.length} saved reference doctor
                      {referenceDoctors.length !== 1 ? "s" : ""} — or type a new name.
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="apt-notes" className="text-sm font-medium">Notes</Label>
                  <Textarea
                    id="apt-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Symptoms, reason for visit, special instructions…"
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>
              </div>

              {/* Procedures (optional) */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                  Procedures
                  <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                </Label>
                <ProcedurePicker
                  onAdd={(p) => setProcedures((prev) => [...prev, p])}
                />
                {procedures.length > 0 && (
                  <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-2">
                    {procedures.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 rounded-md bg-background px-2.5 py-1.5 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium">{p.name}</span>
                        <span className="flex shrink-0 items-center gap-2.5">
                          <span className="font-semibold">Rs. {p.amount.toLocaleString()}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setProcedures((prev) => prev.filter((_, idx) => idx !== i))
                            }
                            className="text-muted-foreground hover:text-red-600 transition-colors"
                            title="Remove procedure"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Discount (admin & manager only) */}
              {canDiscount && (
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={discountEnabled}
                      onChange={(e) => setDiscountEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                    Apply Discount
                  </label>
                  {discountEnabled && (
                    <div className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-muted/30 p-2.5 sm:grid-cols-[1fr_auto]">
                      <Input
                        value={discountDesc}
                        onChange={(e) => setDiscountDesc(e.target.value)}
                        placeholder="Reason — e.g. Loyalty discount"
                        className="h-9"
                      />
                      <div className="relative sm:w-32">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rs.</span>
                        <Input
                          type="number"
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(e.target.value)}
                          placeholder="0"
                          min={0}
                          className="h-9 pl-9"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Billing summary */}
              {(selectedDoctor || procedures.length > 0 || parsedDiscount > 0) && (
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/60 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <Receipt className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm font-semibold">Billing Summary</p>
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    {selectedDoctor ? (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Consultation — {selectedDoctor.specialty}
                        </span>
                        <span className="font-medium">Rs. {consultationFee.toLocaleString()}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No doctor selected — the consultation fee is added when a doctor is assigned.
                      </p>
                    )}
                    {procedures.map((p, i) => (
                      <div key={i} className="flex justify-between gap-2">
                        <span className="min-w-0 truncate text-muted-foreground">{p.name}</span>
                        <span className="shrink-0 font-medium">Rs. {p.amount.toLocaleString()}</span>
                      </div>
                    ))}
                    {parsedDiscount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount</span>
                        <span className="font-medium">− Rs. {parsedDiscount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="mt-1 flex justify-between border-t border-border pt-1.5">
                      <span className="font-semibold">Invoice Total</span>
                      <span className="text-base font-bold">Rs. {invoiceTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => { onOpenChange(false); reset() }}
                className="px-5"
                disabled={saving}
              >
                Discard
              </Button>
              <Button type="submit" className="px-5 gap-1.5" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CalendarDays className="h-4 w-4" />
                )}
                {saving ? "Booking…" : "Book Appointment"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>

    {/* Nested Add-Patient modal — opens inline so the appointment form
        stays populated. After the patient is added the store's `patients`
        array updates automatically; user finds them via the search box. */}
    <AddPatientModal open={showAddPatient} onOpenChange={setShowAddPatient} />
    </>
  )
}
