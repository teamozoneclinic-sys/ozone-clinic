"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Stethoscope, Save, Loader2, Phone, Clock, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { SPECIALTIES, DOCTOR_TYPES, DAYS_OF_WEEK } from "@/lib/constants"
import type { Doctor, DoctorSchedule } from "@/lib/types"

// ─── Day abbreviations ─────────────────────────────────────────────────────
const DAY_ABBR: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
  Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
}

// ─── Schedule state types ──────────────────────────────────────────────────
interface SlotRow { startTime: string; endTime: string }
interface DayRow { enabled: boolean; slots: SlotRow[] }
type ScheduleMap = Record<string, DayRow>

/** Build ScheduleMap from flat DoctorSchedule[] */
function buildScheduleMap(schedule: DoctorSchedule[]): ScheduleMap {
  const base: ScheduleMap = Object.fromEntries(
    DAYS_OF_WEEK.map((d) => [d, { enabled: false, slots: [{ startTime: "09:00", endTime: "17:00" }] }])
  )
  schedule.forEach((s) => {
    if (!base[s.day]) base[s.day] = { enabled: true, slots: [] }
    if (!base[s.day].enabled) {
      base[s.day].enabled = true
      base[s.day].slots = []
    }
    base[s.day].slots.push({ startTime: s.startTime, endTime: s.endTime })
  })
  return base
}

/** Flatten ScheduleMap back to DoctorSchedule[] */
function flattenSchedule(map: ScheduleMap): DoctorSchedule[] {
  return DAYS_OF_WEEK.filter((d) => map[d].enabled && map[d].slots.length > 0).flatMap((d) =>
    map[d].slots.map((slot) => ({ day: d, startTime: slot.startTime, endTime: slot.endTime }))
  )
}

interface EditDoctorModalProps {
  doctor: Doctor
  onClose: () => void
  onSave: (data: Partial<Doctor>) => Promise<void>
}

export function EditDoctorModal({ doctor, onClose, onSave }: EditDoctorModalProps) {
  const [name, setName] = useState(doctor.name)
  const [specialty, setSpecialty] = useState(doctor.specialty)
  const [type, setType] = useState(doctor.type)
  const [phone, setPhone] = useState(doctor.phone)
  const [email, setEmail] = useState(doctor.email)
  const [fee, setFee] = useState(String(doctor.consultationFee))
  const [isActive, setIsActive] = useState(doctor.isActive)
  const [schedule, setSchedule] = useState<ScheduleMap>(() => buildScheduleMap(doctor.schedule))
  const [saving, setSaving] = useState(false)

  // ── Schedule helpers ─────────────────────────────────────────────────────
  const toggleDay = (day: string) =>
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], enabled: !prev[day].enabled } }))

  const addSlot = (day: string) =>
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], slots: [...prev[day].slots, { startTime: "09:00", endTime: "17:00" }] },
    }))

  const removeSlot = (day: string, idx: number) =>
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], slots: prev[day].slots.filter((_, i) => i !== idx) },
    }))

  const updateSlot = (day: string, idx: number, field: "startTime" | "endTime", value: string) =>
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: prev[day].slots.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
      },
    }))

  const enabledDays = DAYS_OF_WEEK.filter((d) => schedule[d].enabled)

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name || !specialty || !type) {
      toast.error("Name, specialty and type are required.")
      return
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
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        specialty,
        type,
        phone: phone.trim(),
        email: email.trim(),
        consultationFee: Number(fee) || 0,
        isActive,
        schedule: flattenSchedule(schedule),
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update doctor.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-[680px] p-0 gap-0 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-5 border-b border-border shrink-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Stethoscope className="h-5 w-5 text-primary" />
          </div>
          <div>
            <DialogTitle className="text-base font-semibold leading-tight">Edit Doctor</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-0.5">
              Update details for {doctor.name}
            </DialogDescription>
          </div>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

            {/* Name & Email */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ed-name">Full Name *</Label>
                <Input id="ed-name" value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ed-email">Email</Label>
                <Input id="ed-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
              </div>
            </div>

            {/* Specialty & Type */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Specialty *</Label>
                <Select value={specialty} onValueChange={setSpecialty}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Type *</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOCTOR_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Phone & Fee */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ed-phone">
                  <Phone className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />Phone
                </Label>
                <Input id="ed-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-10" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ed-fee">Consultation Fee (Rs.)</Label>
                <Input id="ed-fee" type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} className="h-10" />
              </div>
            </div>

            {/* Active status */}
            <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
              <Switch id="ed-active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="ed-active" className="cursor-pointer">
                {isActive ? "Active — accepting patients" : "Inactive — not available"}
              </Label>
            </div>

            {/* ── Schedule Section ── */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Clinic Schedule</p>
                <span className="text-xs text-muted-foreground">
                  — toggle days, add or remove time slots
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

              {/* Slots panel */}
              {enabledDays.length > 0 ? (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="grid grid-cols-[120px_1fr_1fr_32px] bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border gap-3">
                    <span>Day</span><span>Start</span><span>End</span><span />
                  </div>
                  {enabledDays.map((day, dayIdx) => (
                    <div key={day} className={dayIdx < enabledDays.length - 1 ? "border-b border-border/60" : ""}>
                      {schedule[day].slots.map((slot, slotIdx) => (
                        <div
                          key={slotIdx}
                          className="grid grid-cols-[120px_1fr_1fr_32px] items-center gap-3 px-4 py-2"
                        >
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

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
