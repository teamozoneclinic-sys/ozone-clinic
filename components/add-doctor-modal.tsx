"use client"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useStore } from "@/lib/store"
import { useState } from "react"
import { toast } from "sonner"
import { UserRound, X, Clock, Plus, Trash2 } from "lucide-react"
import { DAYS_OF_WEEK, DOCTOR_TYPES, SPECIALTIES } from "@/lib/constants"
import type { DoctorSchedule } from "@/lib/types"

interface AddDoctorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ─── Day abbreviations ─────────────────────────────────────────────────────
const DAY_ABBR: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
  Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
}

// ─── Schedule types — multiple slots per day ───────────────────────────────
interface SlotRow {
  startTime: string
  endTime: string
}

interface DayRow {
  enabled: boolean
  slots: SlotRow[]
}

type ScheduleMap = Record<string, DayRow>

const makeDefaultSchedule = (): ScheduleMap =>
  Object.fromEntries(
    DAYS_OF_WEEK.map((d) => [d, { enabled: false, slots: [{ startTime: "09:00", endTime: "17:00" }] }])
  )

// ─── Main Modal ────────────────────────────────────────────────────────────

export function AddDoctorModal({ open, onOpenChange }: AddDoctorModalProps) {
  const { addDoctor } = useStore()

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [specialty, setSpecialty] = useState("")
  const [type, setType] = useState("")
  const [fee, setFee] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [schedule, setSchedule] = useState<ScheduleMap>(makeDefaultSchedule())

  const reset = () => {
    setName(""); setPhone(""); setEmail(""); setSpecialty("")
    setType(""); setFee(""); setIsActive(true)
    setSchedule(makeDefaultSchedule())
  }

  // Pakistani phone format: 03XX-XXXXXXX
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 11)
    setPhone(digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits)
  }

  // ── Schedule helpers ──────────────────────────────────────────────────────
  const toggleDay = (day: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }))
  }

  const addSlot = (day: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: [...prev[day].slots, { startTime: "09:00", endTime: "17:00" }],
      },
    }))
  }

  const removeSlot = (day: string, slotIdx: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: prev[day].slots.filter((_, i) => i !== slotIdx),
      },
    }))
  }

  const updateSlot = (
    day: string,
    slotIdx: number,
    field: "startTime" | "endTime",
    value: string
  ) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: prev[day].slots.map((s, i) =>
          i === slotIdx ? { ...s, [field]: value } : s
        ),
      },
    }))
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) { toast.error("Doctor name is required."); return }
    const digits = phone.replace(/\D/g, "")
    if (phone && !/^03\d{9}$/.test(digits)) {
      toast.error("Phone must be in 03XX-XXXXXXX format."); return
    }
    if (!specialty) { toast.error("Please select a specialty."); return }
    if (!type) { toast.error("Please select a doctor type."); return }
    if (email.trim() && !email.trim().toLowerCase().endsWith("@ozonehospital.com")) {
      toast.error("Email must end with @ozonehospital.com"); return
    }

    // Validate schedule: endTime must be after startTime
    for (const day of DAYS_OF_WEEK) {
      if (!schedule[day].enabled) continue
      for (let i = 0; i < schedule[day].slots.length; i++) {
        const slot = schedule[day].slots[i]
        const [sh, sm] = slot.startTime.split(":").map(Number)
        const [eh, em] = slot.endTime.split(":").map(Number)
        if (sh * 60 + sm >= eh * 60 + em) {
          toast.error(`${day} slot ${i + 1}: End time must be after start time.`)
          return
        }
      }
    }

    // Flatten: one DoctorSchedule entry per slot per enabled day
    const doctorSchedule: DoctorSchedule[] = DAYS_OF_WEEK
      .filter((d) => schedule[d].enabled && schedule[d].slots.length > 0)
      .flatMap((d) =>
        schedule[d].slots.map((slot) => ({
          day: d,
          startTime: slot.startTime,
          endTime: slot.endTime,
        }))
      )

    addDoctor({
      name: name.trim(),
      phone,
      email: email.trim(),
      specialty,
      type,
      consultationFee: parseFloat(fee) || 0,
      schedule: doctorSchedule,
      isActive,
    })

    toast.success(`${name.trim()} has been added successfully.`)
    onOpenChange(false)
    reset()
  }

  const enabledDays = DAYS_OF_WEEK.filter((d) => schedule[d].enabled)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[740px] p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <UserRound className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold leading-tight">Add Doctor</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Fill in the details to register a new doctor.
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

        {/* ── Body ── */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

            {/* Row 1: Name | Phone */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="doc-name" className="text-sm font-medium">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="doc-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Ahmed Khan"
                  className="h-10"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="doc-phone" className="text-sm font-medium">Phone</Label>
                <Input
                  id="doc-phone"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="03XX-XXXXXXX"
                  className="h-10 font-mono"
                  inputMode="numeric"
                />
              </div>
            </div>

            {/* Row 2: Email | Specialty */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="doc-email" className="text-sm font-medium">Email</Label>
                <Input
                  id="doc-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@ozonehospital.com"
                  className="h-10"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium">
                  Specialty <span className="text-red-500">*</span>
                </Label>
                <Select value={specialty} onValueChange={setSpecialty}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select specialty" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3: Type | Consultation Fee */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium">
                  Doctor Type <span className="text-red-500">*</span>
                </Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCTOR_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="doc-fee" className="text-sm font-medium">Consultation Fee (Rs.)</Label>
                <Input
                  id="doc-fee"
                  type="number"
                  min="0"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder="1500"
                  className="h-10"
                />
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Active Status</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Active doctors can be assigned to appointments
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            {/* ── Schedule Section ── */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Clinic Schedule</p>
                <span className="text-xs text-muted-foreground">
                  — select days, then add one or more time slots per day
                </span>
              </div>

              {/* Day toggle pills */}
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      schedule[day].enabled
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
                    }`}
                  >
                    {DAY_ABBR[day]}
                    {schedule[day].enabled && schedule[day].slots.length > 1 && (
                      <span className="ml-1 opacity-80">×{schedule[day].slots.length}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Slots panel for enabled days */}
              {enabledDays.length > 0 ? (
                <div className="rounded-lg border border-border overflow-hidden">
                  {/* Column header */}
                  <div className="grid grid-cols-[120px_1fr_1fr_32px] bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border gap-3">
                    <span>Day</span>
                    <span>Start</span>
                    <span>End</span>
                    <span />
                  </div>

                  {enabledDays.map((day, dayIdx) => (
                    <div
                      key={day}
                      className={dayIdx < enabledDays.length - 1 ? "border-b border-border/60" : ""}
                    >
                      {/* Slot rows */}
                      {schedule[day].slots.map((slot, slotIdx) => (
                        <div
                          key={slotIdx}
                          className="grid grid-cols-[120px_1fr_1fr_32px] items-center gap-3 px-4 py-2"
                        >
                          {/* Day label — only on first slot row */}
                          {slotIdx === 0 ? (
                            <span className="text-sm font-semibold text-foreground">{day}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground pl-1">↳ Slot {slotIdx + 1}</span>
                          )}

                          <Input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) => updateSlot(day, slotIdx, "startTime", e.target.value)}
                            className="h-8 text-sm"
                          />
                          <Input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) => updateSlot(day, slotIdx, "endTime", e.target.value)}
                            className="h-8 text-sm"
                          />

                          {/* Remove slot — only shown when more than one slot */}
                          {schedule[day].slots.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeSlot(day, slotIdx)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Remove slot"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <div />
                          )}
                        </div>
                      ))}

                      {/* Add slot button */}
                      <div className="px-4 pb-2.5">
                        <button
                          type="button"
                          onClick={() => addSlot(day)}
                          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                        >
                          <Plus className="h-3 w-3" />
                          Add time slot
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4 rounded-lg border border-dashed border-border">
                  Select days above to configure working hours.
                </p>
              )}
            </div>

          </div>

          {/* ── Footer ── */}
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
              <UserRound className="h-4 w-4" />
              Add Doctor
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
