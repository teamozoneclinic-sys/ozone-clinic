"use client"

import { useEffect, useMemo, useState } from "react"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Users2,
  Phone,
  Mail,
  Building2,
  Pencil,
  Trash2,
  Loader2,
  UserRound,
  CalendarRange,
} from "lucide-react"
import { toast } from "sonner"
import type { ReferenceDoctor } from "@/lib/types"

type DateFilter = "total" | "month" | "custom"

// Local "today" in YYYY-MM-DD (browser TZ — fine for a date-only filter)
function todayYMD(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

function monthLabel(): string {
  return new Date().toLocaleDateString("en-PK", { month: "long", year: "numeric" })
}

export default function ReferenceDoctorsPage() {
  const {
    referenceDoctors,
    fetchReferenceDoctors,
    addReferenceDoctor,
    updateReferenceDoctor,
    deleteReferenceDoctor,
    appointments,
    currentUser,
  } = useStore()

  const canManage = currentUser?.role === "admin" || currentUser?.role === "manager"

  const [search, setSearch] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [editing, setEditing] = useState<ReferenceDoctor | null>(null)
  const [deleting, setDeleting] = useState<ReferenceDoctor | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  // ── Date-range filter for referral counts ────────────────────────────
  const [dateFilter, setDateFilter] = useState<DateFilter>("total")
  const [customFrom, setCustomFrom] = useState(todayYMD())
  const [customTo, setCustomTo] = useState(todayYMD())

  // Resolve the active range → null means "all-time"
  const dateRange = useMemo(() => {
    if (dateFilter === "total") return null
    if (dateFilter === "month") {
      const d = new Date()
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, "0")
      const daysInMonth = new Date(y, d.getMonth() + 1, 0).getDate()
      return {
        from: `${y}-${m}-01`,
        to: `${y}-${m}-${String(daysInMonth).padStart(2, "0")}`,
      }
    }
    // custom
    if (!customFrom || !customTo) return null
    return { from: customFrom, to: customTo }
  }, [dateFilter, customFrom, customTo])

  // Compute per-referrer counts from the appointments store (case-insensitive
  // match on the free-text `referral` field). Falls back to the API's
  // all-time `referralCount` when no date filter is applied AND the local
  // store hasn't loaded yet — keeps the initial render populated.
  const countsByName = useMemo(() => {
    const map = new Map<string, number>()
    const inRange = (dateStr: string) => {
      if (!dateRange) return true
      return dateStr >= dateRange.from && dateStr <= dateRange.to
    }
    for (const a of appointments) {
      const key = (a.referral ?? "").trim().toLowerCase()
      if (!key) continue
      if (!inRange(a.date)) continue
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [appointments, dateRange])

  // Enrich each ref doctor with the filtered count
  const enrichedRefs = useMemo(() => {
    return referenceDoctors.map((r) => {
      const localCount = countsByName.get(r.name.toLowerCase())
      // For total mode with an empty local store, keep the API value; otherwise use local
      const referralCount =
        localCount !== undefined
          ? localCount
          : dateFilter === "total"
          ? r.referralCount ?? 0
          : 0
      return { ...r, referralCount }
    })
  }, [referenceDoctors, countsByName, dateFilter])

  // Refresh once on mount so referral counts are up-to-date after new bookings
  useEffect(() => {
    fetchReferenceDoctors().catch(() => {/* boot fetch already handled it */})
  }, [fetchReferenceDoctors])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return enrichedRefs
    return enrichedRefs.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.specialty.toLowerCase().includes(q) ||
        r.hospital.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        r.email.toLowerCase().includes(q)
    )
  }, [enrichedRefs, search])

  const totalReferrals = enrichedRefs.reduce((s, r) => s + r.referralCount, 0)
  const rangeLabel =
    dateFilter === "total"
      ? "all-time"
      : dateFilter === "month"
      ? monthLabel()
      : dateRange
      ? `${dateRange.from} → ${dateRange.to}`
      : "custom range"

  const handleDelete = async () => {
    if (!deleting) return
    setDeletingBusy(true)
    try {
      await deleteReferenceDoctor(deleting.id)
      toast.success(`Removed ${deleting.name}.`)
      setDeleting(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove.")
    } finally {
      setDeletingBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Reference Doctors"
        description="External doctors who refer patients to the clinic."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Reference Doctors" }]}
        actions={
          canManage && (
            <Button onClick={() => setShowAddModal(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Reference Doctor
            </Button>
          )
        }
      />

      {/* Summary strip */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant="secondary" className="gap-1.5 py-1 px-2.5">
          <Users2 className="h-3.5 w-3.5" />
          {referenceDoctors.length} Reference Doctor{referenceDoctors.length !== 1 ? "s" : ""}
        </Badge>
        <Badge
          variant="secondary"
          className="gap-1.5 py-1 px-2.5 bg-emerald-50 text-emerald-800 border-emerald-200"
        >
          <UserRound className="h-3.5 w-3.5" />
          {totalReferrals} Patient{totalReferrals !== 1 ? "s" : ""} referred · {rangeLabel}
        </Badge>
      </div>

      {/* Filters — date range + text search */}
      <Card className="mb-4">
        <CardContent className="p-3 flex flex-col gap-3">
          {/* Date range chips + custom inputs */}
          <div className="flex flex-wrap items-center gap-2">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mr-1">
              Referrals in
            </span>
            {(["total", "month", "custom"] as const).map((mode) => {
              const label =
                mode === "total" ? "Total (all-time)"
                : mode === "month" ? "This Month"
                : "Custom Range"
              const active = dateFilter === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDateFilter(mode)}
                  className={`h-7 rounded-full border px-3 text-xs font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-background text-foreground hover:bg-accent"
                  }`}
                >
                  {label}
                </button>
              )
            })}

            {dateFilter === "custom" && (
              <>
                <div className="flex items-center gap-1 ml-auto">
                  <Label htmlFor="rd-from" className="text-xs text-muted-foreground">From</Label>
                  <Input
                    id="rd-from"
                    type="date"
                    value={customFrom}
                    max={customTo}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-8 w-36 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Label htmlFor="rd-to" className="text-xs text-muted-foreground">To</Label>
                  <Input
                    id="rd-to"
                    type="date"
                    value={customTo}
                    min={customFrom}
                    max={todayYMD()}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-8 w-36 text-xs"
                  />
                </div>
              </>
            )}
          </div>

          {/* Text search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, specialty, hospital, phone or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Users2 className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {referenceDoctors.length === 0
                ? "No reference doctors yet."
                : "No reference doctors match your search."}
            </p>
            {canManage && referenceDoctors.length === 0 && (
              <Button size="sm" onClick={() => setShowAddModal(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add the first reference doctor
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ref) => (
            <RefDoctorCard
              key={ref.id}
              ref={ref}
              canManage={canManage}
              rangeLabel={rangeLabel}
              onEdit={() => setEditing(ref)}
              onDelete={() => setDeleting(ref)}
            />
          ))}
        </div>
      )}

      {/* Add modal */}
      {showAddModal && (
        <RefDoctorFormModal
          onClose={() => setShowAddModal(false)}
          onSubmit={async (data) => {
            await addReferenceDoctor(data)
            toast.success(`Added ${data.name}.`)
            setShowAddModal(false)
          }}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <RefDoctorFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (data) => {
            await updateReferenceDoctor(editing.id, data)
            toast.success(`Updated ${data.name}.`)
            setEditing(null)
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(v) => { if (!v && !deletingBusy) setDeleting(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove reference doctor?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <strong>{deleting?.name}</strong> from the reference doctor list.
              Existing appointments that were referred by this doctor are NOT affected — their
              referral field is stored as free text and remains intact on those records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete() }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
              disabled={deletingBusy}
            >
              {deletingBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Card component ────────────────────────────────────────────────────────
function RefDoctorCard({
  ref,
  canManage,
  rangeLabel,
  onEdit,
  onDelete,
}: {
  ref: ReferenceDoctor
  canManage: boolean
  rangeLabel: string
  onEdit: () => void
  onDelete: () => void
}) {
  const count = ref.referralCount ?? 0
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardContent className="flex-1 p-4 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
            {ref.name.charAt(0).toUpperCase() || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground truncate">{ref.name}</p>
            {ref.specialty && (
              <p className="text-xs text-muted-foreground truncate">{ref.specialty}</p>
            )}
          </div>
          {canManage && (
            <div className="shrink-0 flex flex-col gap-1">
              <button
                type="button"
                onClick={onEdit}
                title="Edit"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                title="Remove"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Contact + hospital */}
        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          {ref.hospital && (
            <p className="flex items-center gap-1.5 truncate">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              {ref.hospital}
            </p>
          )}
          {ref.phone && (
            <a
              href={`tel:${ref.phone}`}
              className="flex items-center gap-1.5 truncate hover:text-primary"
            >
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {ref.phone}
            </a>
          )}
          {ref.email && (
            <a
              href={`mailto:${ref.email}`}
              className="flex items-center gap-1.5 truncate hover:text-primary"
            >
              <Mail className="h-3.5 w-3.5 shrink-0" />
              {ref.email}
            </a>
          )}
        </div>

        {ref.notes && (
          <p className="text-xs text-muted-foreground rounded-md bg-muted/40 border border-border/60 px-2.5 py-1.5 line-clamp-2">
            {ref.notes}
          </p>
        )}
      </CardContent>

      {/* Footer — referral count for the active filter */}
      <div className="border-t border-border/60 bg-muted/30 px-4 py-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground truncate">
          Referred · <span className="normal-case font-normal">{rangeLabel}</span>
        </span>
        <span
          className={`text-sm font-bold tabular-nums shrink-0 ${
            count > 0 ? "text-emerald-700" : "text-muted-foreground"
          }`}
        >
          {count}
        </span>
      </div>
    </Card>
  )
}

// ─── Add / Edit modal ──────────────────────────────────────────────────────
function RefDoctorFormModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: ReferenceDoctor
  onClose: () => void
  onSubmit: (data: Partial<Omit<ReferenceDoctor, "id" | "createdAt" | "updatedAt" | "referralCount">>) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [specialty, setSpecialty] = useState(initial?.specialty ?? "")
  const [hospital, setHospital] = useState(initial?.hospital ?? "")
  const [phone, setPhone] = useState(initial?.phone ?? "")
  const [email, setEmail] = useState(initial?.email ?? "")
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error("Name is required.")
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        name: trimmedName,
        specialty: specialty.trim(),
        hospital: hospital.trim(),
        phone: phone.trim(),
        email: email.trim(),
        notes: notes.trim(),
        isActive: true,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.")
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !submitting) onClose() }}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            {initial ? "Edit Reference Doctor" : "Add Reference Doctor"}
          </DialogTitle>
          <DialogDescription>
            External doctors who refer patients to the clinic. Their names will appear as
            suggestions in the &ldquo;Referred By&rdquo; field when booking appointments.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="rd-name">Name <span className="text-red-500">*</span></Label>
              <Input
                id="rd-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Ahmed Khan"
                required
                maxLength={120}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rd-specialty">Specialty</Label>
              <Input
                id="rd-specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Cardiology"
                maxLength={80}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rd-hospital">Hospital / Clinic</Label>
              <Input
                id="rd-hospital"
                value={hospital}
                onChange={(e) => setHospital(e.target.value)}
                placeholder="Aga Khan Hospital"
                maxLength={120}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rd-phone">Phone</Label>
              <Input
                id="rd-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0300-1234567"
                maxLength={30}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rd-email">Email</Label>
              <Input
                id="rd-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@hospital.com"
                maxLength={120}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="rd-notes">Notes</Label>
              <Textarea
                id="rd-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any relevant notes about this referring doctor…"
                rows={2}
                maxLength={500}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()} className="gap-1.5">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {submitting ? "Saving…" : initial ? "Save Changes" : "Add Reference Doctor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
