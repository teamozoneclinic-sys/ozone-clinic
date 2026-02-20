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
import { useState, useRef, useEffect } from "react"
import { toast } from "sonner"
import {
  CalendarDays,
  Search,
  ChevronDown,
  X,
  Stethoscope,
  UserPlus,
  Phone,
} from "lucide-react"

interface AddAppointmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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

// ─── Main Modal ────────────────────────────────────────────────────────────

export function AddAppointmentModal({ open, onOpenChange }: AddAppointmentModalProps) {
  const { patients, doctors } = useStore()
  const [patientSearch, setPatientSearch] = useState("")
  const [patientId, setPatientId] = useState("")
  const [doctorId, setDoctorId] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [duration, setDuration] = useState("30")
  const [type, setType] = useState("")
  const [notes, setNotes] = useState("")

  const doctorItems: DoctorItem[] = doctors
    .filter((d) => d.isActive)
    .map((d) => ({
      id: d.id,
      label: d.name,
      sub: `${d.specialty} · Rs. ${d.consultationFee.toLocaleString()}`,
    }))

  const selectedDoctor = doctors.find((d) => d.id === doctorId)

  const filteredPatients = patientSearch.trim()
    ? patients.filter(
        (p) =>
          p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
          p.phone.includes(patientSearch)
      )
    : patients

  const reset = () => {
    setPatientSearch(""); setPatientId(""); setDoctorId(""); setDate("")
    setTime(""); setDuration("30"); setType(""); setNotes("")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!patientId || !doctorId || !date || !time) {
      toast.error("Please select a patient, doctor, date and time.")
      return
    }
    const patient = patients.find((p) => p.id === patientId)
    toast.success(`Appointment booked for ${patient?.name ?? "patient"}.`)
    onOpenChange(false)
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[880px] p-0 gap-0 overflow-hidden h-[580px] flex flex-col"
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
        <div className="flex flex-1 min-h-0">

          {/* Left: Patient list */}
          <div className="w-[260px] shrink-0 border-r border-border flex flex-col bg-muted/20">
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
                className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add New Patient
              </button>
            </div>
          </div>

          {/* Right: Form fields */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

              {/* Doctor */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium">
                  Doctor <span className="text-red-500">*</span>
                </Label>
                <DoctorCombobox
                  items={doctorItems}
                  value={doctorId}
                  onChange={setDoctorId}
                />
              </div>

              {/* Date | Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="apt-date" className="text-sm font-medium">
                    Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="apt-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="apt-time" className="text-sm font-medium">
                    Time <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="apt-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>

              {/* Duration | Type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-medium">Duration</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="45">45 min</SelectItem>
                      <SelectItem value="60">60 min</SelectItem>
                      <SelectItem value="90">90 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-medium">Appointment Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultation">Consultation</SelectItem>
                      <SelectItem value="follow-up">Follow-up</SelectItem>
                      <SelectItem value="treatment">Treatment</SelectItem>
                      <SelectItem value="annual-checkup">Annual Check-up</SelectItem>
                      <SelectItem value="post-surgery">Post-Surgery</SelectItem>
                      <SelectItem value="ecg-review">ECG Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="apt-notes" className="text-sm font-medium">Notes</Label>
                <Textarea
                  id="apt-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Symptoms, reason for visit, special instructions…"
                  rows={3}
                  className="resize-none text-sm"
                />
              </div>

              {/* Fee preview */}
              {selectedDoctor && (
                <div className="flex items-center justify-between rounded-lg bg-muted/60 border border-border px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <Stethoscope className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-tight">{selectedDoctor.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedDoctor.specialty}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Consultation Fee</p>
                    <p className="text-base font-bold">Rs. {selectedDoctor.consultationFee.toLocaleString()}</p>
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
              >
                Discard
              </Button>
              <Button type="submit" className="px-5 gap-1.5">
                <CalendarDays className="h-4 w-4" />
                Book Appointment
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
