"use client"

import { useState, useMemo } from "react"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Plus,
  Search,
  Phone,
  Mail,
  Users,
  Stethoscope,
  Clock,
  BadgeCheck,
  CircleDashed,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react"
import { AddDoctorModal } from "@/components/add-doctor-modal"
import { EditDoctorModal } from "@/components/edit-doctor-modal"
import { DOCTOR_TYPES, SPECIALTIES } from "@/lib/constants"
import type { Doctor } from "@/lib/types"
import { toast } from "sonner"

// ─── Avatar colors cycling by name charCode ──────────────────────────────
const AVATAR_COLORS = [
  "bg-teal-100 text-teal-700",
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-pink-100 text-pink-700",
]
function getAvatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

// ─── Doctor type display config ───────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  consultant:  { label: "Consultant",  className: "border-violet-200 bg-violet-50 text-violet-700" },
  visiting:    { label: "Visiting",    className: "border-blue-200 bg-blue-50 text-blue-700" },
  resident:    { label: "Resident",    className: "border-amber-200 bg-amber-50 text-amber-700" },
  "full-time": { label: "Full-time",   className: "border-teal-200 bg-teal-50 text-teal-700" },
  "part-time": { label: "Part-time",   className: "border-rose-200 bg-rose-50 text-rose-700" },
}

// ─── Day abbreviations ────────────────────────────────────────────────────
const DAY_ABBR: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
  Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
}

export default function DoctorsPage() {
  const { doctors, getDoctorAppointments, hasPermission, updateDoctor, deleteDoctor, currentUser } = useStore()
  const [search, setSearch] = useState("")
  const [specialtyFilter, setSpecialtyFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null)
  const [deletingDoctor, setDeletingDoctor] = useState<Doctor | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  const canAdd = hasPermission("doctors.create")
  const isAdmin = currentUser?.role === "admin"

  const filteredDoctors = useMemo(() => {
    return doctors.filter((d) => {
      const matchSearch =
        search === "" ||
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.email.toLowerCase().includes(search.toLowerCase()) ||
        d.phone.includes(search) ||
        d.specialty.toLowerCase().includes(search.toLowerCase())
      const matchSpecialty = specialtyFilter === "all" || d.specialty === specialtyFilter
      const matchType = typeFilter === "all" || d.type === typeFilter
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? d.isActive : !d.isActive)
      return matchSearch && matchSpecialty && matchType && matchStatus
    })
  }, [doctors, search, specialtyFilter, typeFilter, statusFilter])

  const activeCount = doctors.filter((d) => d.isActive).length
  const specialtiesCount = new Set(doctors.map((d) => d.specialty)).size

  const handleSaveDoctor = async (data: Partial<Doctor>) => {
    if (!editingDoctor) return
    await updateDoctor(editingDoctor.id, data)
    toast.success("Doctor updated successfully.")
    setEditingDoctor(null)
  }

  const handleDeleteDoctor = async () => {
    if (!deletingDoctor) return
    setDeletingBusy(true)
    try {
      await deleteDoctor(deletingDoctor.id)
      toast.success(`${deletingDoctor.name} has been removed.`)
      setDeletingDoctor(null)
    } catch {
      toast.error("Failed to delete doctor.")
    } finally {
      setDeletingBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Doctors"
        description="Manage your clinical team and schedules."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Doctors" }]}
        actions={
          canAdd ? (
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Add Doctor
            </Button>
          ) : undefined
        }
      />

      {/* ── Summary chips ── */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex items-center gap-1.5 rounded-full bg-muted/60 border border-border px-3 py-1.5">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{doctors.length}</span>
          <span className="text-xs text-muted-foreground">Total</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-3 py-1.5">
          <BadgeCheck className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-sm font-medium text-teal-700">{activeCount}</span>
          <span className="text-xs text-teal-600">Active</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-muted/60 border border-border px-3 py-1.5">
          <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{specialtiesCount}</span>
          <span className="text-xs text-muted-foreground">Specialties</span>
        </div>
        {filteredDoctors.length !== doctors.length && (
          <div className="flex items-center gap-1.5 rounded-full bg-primary/5 border border-primary/20 px-3 py-1.5">
            <Search className="h-3 w-3 text-primary" />
            <span className="text-xs text-primary font-medium">
              {filteredDoctors.length} result{filteredDoctors.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <Card className="mb-5">
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone or specialty…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Specialty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Specialties</SelectItem>
                {SPECIALTIES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {DOCTOR_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Doctor Cards ── */}
      {filteredDoctors.length === 0 ? (
        <Card>
          <CardContent className="h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Users className="h-8 w-8 opacity-30" />
            <p className="text-sm">No doctors found.</p>
            <p className="text-xs">Try adjusting your search or filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredDoctors.map((doctor) => {
            const avatarColor = getAvatarColor(doctor.name)
            const typeConfig = TYPE_CONFIG[doctor.type] ?? { label: doctor.type, className: "border-border bg-muted text-foreground" }
            const totalAppointments = getDoctorAppointments(doctor.id).length

            return (
              <Card
                key={doctor.id}
                className="group border-border/60 hover:border-primary/30 hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                <CardContent className="p-0">

                  {/* ── Card top strip ── */}
                  <div className="h-1.5 w-full bg-gradient-to-r from-primary/60 to-primary/20" />

                  <div className="p-5 flex flex-col gap-4">

                    {/* ── Header: avatar + name + badges + actions ── */}
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold ${avatarColor}`}
                      >
                        {doctor.name.replace("Dr. ", "").charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-foreground truncate leading-tight">
                          {doctor.name}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">{doctor.specialty}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <Badge
                            variant="outline"
                            className={`text-[11px] px-2 py-0.5 font-medium ${typeConfig.className}`}
                          >
                            {typeConfig.label}
                          </Badge>
                          {doctor.isActive ? (
                            <Badge
                              variant="outline"
                              className="text-[11px] px-2 py-0.5 font-medium border-emerald-200 bg-emerald-50 text-emerald-700"
                            >
                              <BadgeCheck className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[11px] px-2 py-0.5 font-medium border-border bg-muted text-muted-foreground"
                            >
                              <CircleDashed className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>
                      {/* ── Admin action buttons ── */}
                      {isAdmin && (
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => setEditingDoctor(doctor)}
                            title="Edit doctor"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeletingDoctor(doctor)}
                            title="Delete doctor"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* ── Divider ── */}
                    <div className="h-px bg-border/50" />

                    {/* ── Contact info ── */}
                    <div className="flex flex-col gap-1.5">
                      {doctor.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-mono tracking-wide">{doctor.phone}</span>
                        </div>
                      )}
                      {doctor.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{doctor.email}</span>
                        </div>
                      )}
                    </div>

                    {/* ── Schedule days (grouped, multi-slot aware) ── */}
                    {doctor.schedule.length > 0 && (() => {
                      const grouped: Record<string, { startTime: string; endTime: string }[]> = {}
                      doctor.schedule.forEach((s) => {
                        if (!grouped[s.day]) grouped[s.day] = []
                        grouped[s.day].push({ startTime: s.startTime, endTime: s.endTime })
                      })
                      const uniqueDays = Object.keys(grouped)
                      return (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            <Clock className="h-3 w-3" />
                            Schedule
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {uniqueDays.map((day) => {
                              const slots = grouped[day]
                              return (
                                <div
                                  key={day}
                                  className="flex flex-col items-center rounded-md bg-muted/60 border border-border/60 px-2 py-1 min-w-[44px] relative"
                                >
                                  <span className="text-[11px] font-semibold text-foreground">
                                    {DAY_ABBR[day] ?? day.slice(0, 3)}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground leading-tight">
                                    {slots[0].startTime}
                                  </span>
                                  {slots.length > 1 && (
                                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                                      {slots.length}
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}

                    {/* ── Footer: fee + appointments ── */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          Consultation Fee
                        </span>
                        <span className="text-base font-bold text-foreground">
                          Rs. {doctor.consultationFee.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          Appointments
                        </span>
                        <span className="text-base font-bold text-foreground">
                          {totalAppointments}
                        </span>
                      </div>
                    </div>

                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AddDoctorModal open={showAddModal} onOpenChange={setShowAddModal} />

      {editingDoctor && (
        <EditDoctorModal
          doctor={editingDoctor}
          onClose={() => setEditingDoctor(null)}
          onSave={handleSaveDoctor}
        />
      )}

      <AlertDialog open={!!deletingDoctor} onOpenChange={(v) => { if (!v) setDeletingDoctor(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Doctor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deletingDoctor?.name}</strong>? This action cannot be undone and will delete all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDoctor}
              disabled={deletingBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
