"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { GENDERS, BLOOD_GROUPS } from "@/lib/constants"

interface AddPatientModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddPatientModal({ open, onOpenChange }: AddPatientModalProps) {
  const { doctors } = useStore()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [gender, setGender] = useState("")
  const [age, setAge] = useState("")
  const [bloodGroup, setBloodGroup] = useState("")
  const [doctorId, setDoctorId] = useState("")
  const [notes, setNotes] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !phone || !gender || !age) {
      toast.error("Please fill in all required fields.")
      return
    }
    const pkPhone = /^(\+92|0)[0-9]{9,10}$/.test(phone.replace(/[\s\-()]/g, ""))
    if (!pkPhone) {
      toast.error("Enter a valid Pakistani phone number (e.g. 03XX-XXXXXXX or +92XXXXXXXXXX).")
      return
    }
    toast.success(`Patient "${name}" has been registered successfully.`)
    onOpenChange(false)
    setName("")
    setPhone("")
    setGender("")
    setAge("")
    setBloodGroup("")
    setDoctorId("")
    setNotes("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Patient</DialogTitle>
          <DialogDescription>Register a new patient in the system.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="patient-name">Full Name *</Label>
              <Input
                id="patient-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter patient name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="patient-phone">Phone *</Label>
              <Input
                id="patient-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="03XX-XXXXXXX or +92XXXXXXXXXX"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label>Gender *</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="patient-age">Age *</Label>
              <Input
                id="patient-age"
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Age"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Blood Group</Label>
              <Select value={bloodGroup} onValueChange={setBloodGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUPS.map((bg) => (
                    <SelectItem key={bg} value={bg}>
                      {bg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Assigned Doctor</Label>
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} - {d.specialty}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="patient-notes">Notes</Label>
            <Textarea
              id="patient-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Allergies, medical conditions, etc."
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Register Patient</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
