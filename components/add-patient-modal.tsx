"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { BLOOD_GROUPS } from "@/lib/constants"
import { UserPlus } from "lucide-react"
import { calcAge } from "@/lib/utils"

interface AddPatientModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddPatientModal({ open, onOpenChange }: AddPatientModalProps) {
  const { doctors, addPatient } = useStore()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [gender, setGender] = useState<"male" | "female" | "">("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [bloodGroup, setBloodGroup] = useState("")
  const [doctorId, setDoctorId] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  // Phone: digits only, auto-format 03XX-XXXXXXX, max 11 digits
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 11)
    setPhone(digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits)
  }

  const reset = () => {
    setName(""); setPhone(""); setGender(""); setDateOfBirth("")
    setBloodGroup(""); setDoctorId(""); setEmail(""); setAddress(""); setNotes("")
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name || !phone || !gender || !dateOfBirth) {
      toast.error("Please fill in all required fields.")
      return
    }
    const digits = phone.replace(/\D/g, "")
    if (!/^03\d{9}$/.test(digits)) {
      toast.error("Phone must be 11 digits starting with 03 (e.g. 0300-1234567).")
      return
    }
    setSaving(true)
    try {
      await addPatient({
        name: name.trim(),
        phone,
        email: email.trim(),
        gender: gender as "male" | "female",
        dateOfBirth,
        age: calcAge(dateOfBirth),
        address: address.trim(),
        bloodGroup: bloodGroup || undefined,
        tags: [],
        notes: notes.trim(),
        assignedDoctorId: doctorId,
      })
      toast.success(`Patient "${name}" registered successfully.`)
      onOpenChange(false)
      reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to register patient.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-[740px] p-0 gap-0">

        {/* ── Header ── */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-5 border-b border-border">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <UserPlus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <DialogTitle className="text-base font-semibold leading-tight">
              Register New Patient
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-0.5">
              Fields marked <span className="text-red-500 font-medium">*</span> are required.
            </DialogDescription>
          </div>
        </div>

        {/* ── Form body ── */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">

          {/* ── Row 1: Full Name | Phone ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-name" className="text-sm font-medium">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter patient full name"
                className="h-10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-phone" className="text-sm font-medium">
                Phone Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="p-phone"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="0300-1234567"
                inputMode="numeric"
                maxLength={12}
                className="h-10 font-mono tracking-wider"
              />
            </div>
          </div>

          {/* ── Row 2: Gender (×2) | DOB (×1) | Blood Group (×1) ── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label className="text-sm font-medium">
                Gender <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-2 h-10">
                <button
                  type="button"
                  onClick={() => setGender("male")}
                  className={`rounded-md border text-sm font-medium transition-all h-full ${
                    gender === "male"
                      ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500/30"
                      : "border-input bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  ♂&nbsp;&nbsp;Male
                </button>
                <button
                  type="button"
                  onClick={() => setGender("female")}
                  className={`rounded-md border text-sm font-medium transition-all h-full ${
                    gender === "female"
                      ? "border-pink-500 bg-pink-50 text-pink-700 ring-1 ring-pink-500/30"
                      : "border-input bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  ♀&nbsp;&nbsp;Female
                </button>
              </div>
            </div>

            <div className="col-span-1 flex flex-col gap-1.5">
              <Label htmlFor="p-dob" className="text-sm font-medium">
                Date of Birth <span className="text-red-500">*</span>
              </Label>
              <Input
                id="p-dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="h-10"
                max={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="col-span-1 flex flex-col gap-1.5">
              <Label className="text-sm font-medium">Blood Group</Label>
              <Select value={bloodGroup} onValueChange={setBloodGroup}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUPS.map((bg) => (
                    <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Row 3: Email | Address ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-email" className="text-sm font-medium">Email</Label>
              <Input
                id="p-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="patient@email.com"
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-address" className="text-sm font-medium">Address</Label>
              <Input
                id="p-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="City / Full address"
                className="h-10"
              />
            </div>
          </div>

          {/* ── Row 4: Assign Doctor | Additional Notes ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">Assign a Doctor</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select a doctor (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span>{d.name}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">· {d.specialty}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Can be assigned or changed later.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-notes" className="text-sm font-medium">
                Additional Notes
              </Label>
              <Textarea
                id="p-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Allergies, chronic conditions, special requirements..."
                rows={3}
                className="resize-none text-sm"
              />
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="flex items-center justify-end gap-3 pt-3 mt-1 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => { onOpenChange(false); reset() }}
              className="px-6"
            >
              Cancel
            </Button>
            <Button type="submit" className="px-6 gap-1.5" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {saving ? "Registering…" : "Register Patient"}
            </Button>
          </div>
        </form>

      </DialogContent>
    </Dialog>
  )
}
