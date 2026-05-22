"use client"

import React, { useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
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
  Building2,
  Stethoscope,
  TestTube,
  Clock,
  Shield,
  Check,
  X,
  Phone,
  Mail,
  Globe,
  MapPin,
  Save,
  CalendarDays,
  Users,
  Plus,
  UserPlus,
  Trash2,
  Loader2,
  Pencil,
  Heart,
} from "lucide-react"
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
import type { TestCatalogItem, Doctor } from "@/lib/types"
import { DEFAULT_APPOINTMENT_SETTINGS, ROLE_PERMISSIONS, ALL_PERMISSIONS, SPECIALTIES, DOCTOR_TYPES } from "@/lib/constants"
import type { Role } from "@/lib/types"
import { toast } from "sonner"

const PERMISSION_LABELS: Record<string, { label: string; group: string }> = {
  "patients.view": { label: "View Patients", group: "Patients" },
  "patients.create": { label: "Create Patients", group: "Patients" },
  "patients.edit": { label: "Edit Patients", group: "Patients" },
  "patients.delete": { label: "Delete Patients", group: "Patients" },
  "appointments.view": { label: "View Appointments", group: "Appointments" },
  "appointments.create": { label: "Create Appointments", group: "Appointments" },
  "appointments.edit": { label: "Edit Appointments", group: "Appointments" },
  "appointments.cancel": { label: "Cancel Appointments", group: "Appointments" },
  "treatments.view": { label: "View Treatments", group: "Treatments" },
  "treatments.create": { label: "Create Treatments", group: "Treatments" },
  "treatments.edit": { label: "Edit Treatments", group: "Treatments" },
  "billing.view": { label: "View Billing", group: "Billing" },
  "billing.collect": { label: "Collect Payments", group: "Billing" },
  "billing.void": { label: "Void Invoices", group: "Billing" },
  "billing.discount": { label: "Apply Discounts", group: "Billing" },
  "reports.view": { label: "View Reports", group: "System" },
  "settings.view": { label: "View Settings", group: "System" },
  "settings.edit": { label: "Edit Settings", group: "System" },
  "audit.view": { label: "View Audit Log", group: "System" },
}

const PERMISSION_GROUPS = ["Patients", "Appointments", "Treatments", "Billing", "System"]

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800 border-red-200",
  doctor: "bg-teal-100 text-teal-800 border-teal-200",
  manager: "bg-blue-100 text-blue-800 border-blue-200",
  accounts: "bg-amber-100 text-amber-800 border-amber-200",
  receptionist: "bg-purple-100 text-purple-800 border-purple-200",
}

export default function SettingsPage() {
  const { doctors, testCatalog, hasPermission, currentUser, deleteTestCatalogItem, updateDoctor, deleteDoctor, clinicSettings, updateClinicSettings } = useStore()
  const canEdit = hasPermission("settings.edit")
  const isAdmin = currentUser?.role === "admin"

  // Doctor CRUD state
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null)
  const [deletingDoctor, setDeletingDoctor] = useState<Doctor | null>(null)
  const [deletingDoctorBusy, setDeletingDoctorBusy] = useState(false)

  const handleDeleteDoctor = async () => {
    if (!deletingDoctor) return
    setDeletingDoctorBusy(true)
    try {
      await deleteDoctor(deletingDoctor.id)
      toast.success(`Dr. ${deletingDoctor.name} removed.`)
      setDeletingDoctor(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete doctor.")
    } finally {
      setDeletingDoctorBusy(false)
    }
  }

  // Test CRUD state
  const [deletingTest, setDeletingTest] = useState<TestCatalogItem | null>(null)
  const [deletingTestBusy, setDeletingTestBusy] = useState(false)

  const handleDeleteTest = async () => {
    if (!deletingTest) return
    setDeletingTestBusy(true)
    try {
      await deleteTestCatalogItem(deletingTest.id)
      toast.success(`Test "${deletingTest.name}" deleted.`)
      setDeletingTest(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete test.")
    } finally {
      setDeletingTestBusy(false)
    }
  }

  // Clinic info state — mirror from store so edits are local until saved
  const [clinic, setClinic] = useState(clinicSettings)
  const [savingClinic, setSavingClinic] = useState(false)

  // Sync if store loads after component mounts
  React.useEffect(() => { setClinic(clinicSettings) }, [clinicSettings])

  // Appointment defaults state
  const [apptSettings, setApptSettings] = useState(DEFAULT_APPOINTMENT_SETTINGS)

  const handleSaveClinic = async () => {
    setSavingClinic(true)
    try {
      await updateClinicSettings(clinic)
      toast.success("Clinic information saved.")
    } catch {
      toast.error("Failed to save clinic information.")
    } finally {
      setSavingClinic(false)
    }
  }

  const handleSaveAppt = () => {
    toast.success("Appointment defaults saved.")
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage clinic configuration, roles, and system preferences."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Settings" }]}
      />

      <Tabs defaultValue="clinic">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="clinic" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Clinic Info
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Roles & Permissions
          </TabsTrigger>
          <TabsTrigger value="doctors" className="gap-1.5">
            <Stethoscope className="h-3.5 w-3.5" />
            Doctors
          </TabsTrigger>
          <TabsTrigger value="tests" className="gap-1.5">
            <TestTube className="h-3.5 w-3.5" />
            Test Catalog
          </TabsTrigger>
          <TabsTrigger value="appointments" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Appointment Defaults
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            User Management
          </TabsTrigger>
        </TabsList>

        {/* ── Clinic Info ── */}
        <TabsContent value="clinic">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clinic Information</CardTitle>
              <CardDescription>
                Basic details displayed across invoices, reports, and the system.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor="clinic-name">Clinic Name</Label>
                  <Input
                    id="clinic-name"
                    value={clinic.name}
                    onChange={(e) => setClinic({ ...clinic, name: e.target.value })}
                    disabled={!canEdit}
                  />
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor="clinic-address">
                    <MapPin className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />
                    Address
                  </Label>
                  <Input
                    id="clinic-address"
                    value={clinic.address}
                    onChange={(e) => setClinic({ ...clinic, address: e.target.value })}
                    disabled={!canEdit}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="clinic-phone">
                    <Phone className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />
                    Phone
                  </Label>
                  <Input
                    id="clinic-phone"
                    value={clinic.phone}
                    onChange={(e) => setClinic({ ...clinic, phone: e.target.value })}
                    disabled={!canEdit}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="clinic-email">
                    <Mail className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />
                    Email
                  </Label>
                  <Input
                    id="clinic-email"
                    type="email"
                    value={clinic.email}
                    onChange={(e) => setClinic({ ...clinic, email: e.target.value })}
                    disabled={!canEdit}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="clinic-website">
                    <Globe className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />
                    Website
                  </Label>
                  <Input
                    id="clinic-website"
                    value={clinic.website ?? ""}
                    onChange={(e) => setClinic({ ...clinic, website: e.target.value })}
                    placeholder="https://..."
                    disabled={!canEdit}
                  />
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <Label>Clinic Logo</Label>
                  <div className="flex items-center gap-4">
                    {clinic.logo ? (
                      <div className="relative h-16 w-16 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={clinic.logo}
                          alt="Clinic logo"
                          className="h-16 w-16 rounded-lg object-cover border border-border"
                        />
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => setClinic({ ...clinic, logo: "" })}
                            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs"
                            title="Remove logo"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground">
                        <Heart className="h-6 w-6 opacity-40" />
                      </div>
                    )}
                    {canEdit && (
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="clinic-logo-upload"
                          className="cursor-pointer inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {clinic.logo ? "Change Logo" : "Upload Logo"}
                        </label>
                        <input
                          id="clinic-logo-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            if (file.size > 500 * 1024) {
                              toast.error("Logo must be under 500 KB.")
                              return
                            }
                            const reader = new FileReader()
                            reader.onload = () => setClinic({ ...clinic, logo: reader.result as string })
                            reader.readAsDataURL(file)
                          }}
                        />
                        <p className="text-xs text-muted-foreground">PNG, JPG · max 500 KB</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {canEdit && (
                <div className="mt-6 flex justify-end">
                  <Button onClick={handleSaveClinic} size="sm" disabled={savingClinic}>
                    {savingClinic ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                    {savingClinic ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Roles & Permissions ── */}
        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Role Permissions Matrix</CardTitle>
              <CardDescription>
                What each role can do across the system. Contact your system administrator to modify permissions.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground w-52">Permission</th>
                    {ROLE_PERMISSIONS.map((rp) => (
                      <th key={rp.role} className="px-4 py-3 text-center font-medium">
                        <Badge
                          variant="outline"
                          className={`capitalize ${ROLE_COLORS[rp.role]}`}
                        >
                          {rp.label}
                        </Badge>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_GROUPS.map((group) => {
                    const groupPerms = ALL_PERMISSIONS.filter(
                      (p) => PERMISSION_LABELS[p]?.group === group
                    )
                    return (
                      <React.Fragment key={group}>
                        <tr className="bg-muted/20 border-t border-border">
                          <td
                            colSpan={ROLE_PERMISSIONS.length + 1}
                            className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                          >
                            {group}
                          </td>
                        </tr>
                        {groupPerms.map((perm) => (
                          <tr
                            key={perm}
                            className="border-b border-border/60 last:border-0 hover:bg-accent/30 transition-colors"
                          >
                            <td className="px-4 py-2.5 text-sm text-foreground">
                              {PERMISSION_LABELS[perm]?.label ?? perm}
                            </td>
                            {ROLE_PERMISSIONS.map((rp) => (
                              <td key={rp.role} className="px-4 py-2.5 text-center">
                                {rp.permissions.includes(perm as typeof ALL_PERMISSIONS[number]) ? (
                                  <Check className="mx-auto h-4 w-4 text-emerald-600" />
                                ) : (
                                  <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Role descriptions */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLE_PERMISSIONS.map((rp) => (
              <Card key={rp.role} className="border-l-4" style={{ borderLeftColor: "var(--primary)" }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge variant="outline" className={`capitalize ${ROLE_COLORS[rp.role]}`}>
                      {rp.label}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{rp.description}</p>
                  <p className="mt-2 text-xs font-medium text-foreground">
                    {rp.permissions.length} permissions
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Doctors ── */}
        <TabsContent value="doctors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active Doctors</CardTitle>
              <CardDescription>
                {doctors.filter((d) => d.isActive).length} active doctors registered in the system.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Specialty</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Schedule Days</TableHead>
                    {isAdmin && <TableHead className="w-16" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doctors.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <Stethoscope className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{doc.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{doc.specialty}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-muted-foreground">{doc.phone}</span>
                          <span className="text-xs text-muted-foreground">{doc.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        Rs. {doc.consultationFee}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            doc.isActive
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-gray-200 bg-gray-50 text-gray-500"
                          }
                        >
                          {doc.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {doc.schedule.map((s, i) => (
                            <Badge
                              key={`${s.day}-${i}`}
                              variant="secondary"
                              className="text-xs px-1.5"
                            >
                              {s.day.slice(0, 3)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingDoctor(doc)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                              title="Edit doctor"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingDoctor(doc)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-all"
                              title="Delete doctor"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Doctor schedules detail */}
          <div className="grid gap-4 sm:grid-cols-2">
            {doctors.map((doc) => (
              <Card key={doc.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">{doc.name}</CardTitle>
                  <CardDescription className="text-xs">{doc.specialty}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-1.5">
                    {doc.schedule.map((s, i) => (
                      <div
                        key={`${s.day}-${i}`}
                        className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{s.day}</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          {s.startTime} – {s.endTime}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Test Catalog ── */}
        <TabsContent value="tests">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Test Catalog</CardTitle>
              <CardDescription>
                {testCatalog.filter((t) => t.isActive).length} active tests available for recommendation.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Urgency Options</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    {isAdmin && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testCatalog.map((test) => (
                    <TableRow key={test.id}>
                      <TableCell className="font-medium">{test.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {test.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {test.urgencyOptions.map((u) => (
                            <Badge
                              key={u}
                              variant="secondary"
                              className={`text-xs capitalize ${u === "stat"
                                ? "bg-red-100 text-red-700 border-red-200"
                                : u === "urgent"
                                  ? "bg-amber-100 text-amber-700 border-amber-200"
                                  : "bg-muted text-muted-foreground"
                                }`}
                            >
                              {u}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        Rs. {test.price}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={test.isActive}
                          disabled={!canEdit}
                          onCheckedChange={() =>
                            toast.info("Test catalog editing coming soon.")
                          }
                        />
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => setDeletingTest(test)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-all"
                            title="Delete test"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Category breakdown */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from(new Set(testCatalog.map((t) => t.category))).map((cat) => {
              const catTests = testCatalog.filter((t) => t.category === cat)
              const avgPrice = Math.round(catTests.reduce((s, t) => s + t.price, 0) / catTests.length)
              return (
                <Card key={cat} className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold">{cat}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {catTests.length} test{catTests.length !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg: Rs. {avgPrice}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* ── Appointment Defaults ── */}
        <TabsContent value="appointments">
          <div className="max-w-lg">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Working Days</CardTitle>
                <CardDescription>Days the clinic is open for appointments.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
                    (day) => {
                      const isActive = apptSettings.workingDays.includes(day)
                      return (
                        <div
                          key={day}
                          className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5"
                        >
                          <span className="text-sm font-medium">{day}</span>
                          <Switch
                            checked={isActive}
                            disabled={!canEdit}
                            onCheckedChange={(checked) => {
                              const days = checked
                                ? [...apptSettings.workingDays, day]
                                : apptSettings.workingDays.filter((d) => d !== day)
                              setApptSettings({ ...apptSettings, workingDays: days })
                            }}
                          />
                        </div>
                      )
                    }
                  )}
                </div>
                {canEdit && (
                  <div className="mt-4 flex justify-end">
                    <Button onClick={handleSaveAppt} size="sm">
                      <Save className="mr-1.5 h-4 w-4" />
                      Save Days
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        {/* ── User Management ── */}

        <TabsContent value="users">
          <UserManagementSection />
        </TabsContent>
      </Tabs>

      {/* ── Delete Test Confirmation ── */}
      <AlertDialog open={!!deletingTest} onOpenChange={(open) => { if (!open) setDeletingTest(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete Test
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-foreground">{deletingTest?.name}</span>?
              This test will be removed from the catalog. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingTestBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTest}
              disabled={deletingTestBusy}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deletingTestBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {deletingTestBusy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Edit Doctor Modal ── */}
      {editingDoctor && (
        <EditDoctorModal
          doctor={editingDoctor}
          onClose={() => setEditingDoctor(null)}
          onSave={async (data) => {
            await updateDoctor(editingDoctor.id, data)
            toast.success(`Dr. ${data.name ?? editingDoctor.name} updated.`)
            setEditingDoctor(null)
          }}
        />
      )}

      {/* ── Delete Doctor Confirmation ── */}
      <AlertDialog open={!!deletingDoctor} onOpenChange={(open) => { if (!open) setDeletingDoctor(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Remove Doctor
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently remove{" "}
              <span className="font-semibold text-foreground">Dr. {deletingDoctor?.name}</span>?
              This will remove the doctor record. Past appointments and treatments will remain.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDoctorBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDoctor}
              disabled={deletingDoctorBusy}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deletingDoctorBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {deletingDoctorBusy ? "Removing…" : "Remove Doctor"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Edit Doctor Modal
   ───────────────────────────────────────────────────────────────── */

function EditDoctorModal({
  doctor,
  onClose,
  onSave,
}: {
  doctor: Doctor
  onClose: () => void
  onSave: (data: Partial<Doctor>) => Promise<void>
}) {
  const [name, setName] = useState(doctor.name)
  const [specialty, setSpecialty] = useState(doctor.specialty)
  const [type, setType] = useState(doctor.type)
  const [phone, setPhone] = useState(doctor.phone)
  const [email, setEmail] = useState(doctor.email)
  const [fee, setFee] = useState(String(doctor.consultationFee))
  const [isActive, setIsActive] = useState(doctor.isActive)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name || !specialty || !type) {
      toast.error("Name, specialty and type are required.")
      return
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
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update doctor.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0">
        <div className="flex items-start gap-3 px-6 pt-6 pb-5 border-b border-border">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Stethoscope className="h-5 w-5 text-primary" />
          </div>
          <div>
            <DialogTitle className="text-base font-semibold leading-tight">Edit Doctor</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-0.5">
              Update details for Dr. {doctor.name}
            </DialogDescription>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
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

          <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
            <Switch id="ed-active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="ed-active" className="cursor-pointer">
              {isActive ? "Active — accepting patients" : "Inactive — not available"}
            </Label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
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

/* ─────────────────────────────────────────────────────────────────
   User Management Section
   ───────────────────────────────────────────────────────────────── */

const CREATABLE_ROLES: { value: Role; label: string; description: string }[] = [
  { value: "receptionist", label: "Receptionist", description: "Front desk — patients, appointments & billing" },
  { value: "manager", label: "Manager", description: "Operations & scheduling" },
  { value: "accounts", label: "Accountant", description: "Billing & financial reports" },
]

type UserRow = { id: string; name: string; email: string; role: Role }

function UserManagementSection() {
  const { currentUser } = useStore()
  const isAdmin = currentUser?.role === "admin"
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null)
  const [deletingUserBusy, setDeletingUserBusy] = useState(false)
  const [users, setUsers] = useState<UserRow[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.data ?? []))
      .catch(() => toast.error("Failed to load users."))
      .finally(() => setLoadingUsers(false))
  }, [])

  const handleUserCreated = (user: UserRow) => {
    setUsers((prev) => [...prev, user])
    toast.success(`User "${user.name}" created as ${user.role}.`)
  }

  const handleUserUpdated = (user: UserRow) => {
    setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)))
    toast.success(`Credentials updated for ${user.name}.`)
    setEditingUser(null)
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return
    setDeletingUserBusy(true)
    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete user.")
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id))
      toast.success(`User "${deletingUser.name}" deleted.`)
      setDeletingUser(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user.")
    } finally {
      setDeletingUserBusy(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">System Users</CardTitle>
            <CardDescription>
              {loadingUsers ? "Loading users…" : `${users.length} user(s) registered in the system.`}
              {!loadingUsers && (isAdmin ? " You can create and edit users." : " Only admins can manage users.")}
            </CardDescription>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add User
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-center">Status</TableHead>
                {isAdmin && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-sm text-primary">
                        {u.name.charAt(0)}
                      </div>
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`capitalize ${ROLE_COLORS[u.role] ?? ""}`}
                    >
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                      Active
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingUser(u)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                          title="Edit credentials"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {u.id !== currentUser?.id && (
                          <button
                            type="button"
                            onClick={() => setDeletingUser(u)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-all"
                            title="Delete user"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Role summary cards */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {["admin", "doctor", "manager", "accounts"].map((role) => {
          const count = users.filter((u) => u.role === role).length
          return (
            <Card key={role} className="bg-muted/30">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold capitalize">{role}</p>
                  <p className="text-xs text-muted-foreground">
                    {count} user{count !== 1 ? "s" : ""}
                  </p>
                </div>
                <Badge variant="outline" className={`capitalize ${ROLE_COLORS[role] ?? ""}`}>
                  {count}
                </Badge>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {isAdmin && (
        <CreateUserModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          onUserCreated={handleUserCreated}
        />
      )}

      {isAdmin && editingUser && (
        <EditUserCredentialsModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={handleUserUpdated}
        />
      )}

      <AlertDialog open={!!deletingUser} onOpenChange={(open) => { if (!open) setDeletingUser(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingUser?.name}</strong>? This action cannot be undone and
              will permanently remove their account from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUserBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deletingUserBusy}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              {deletingUserBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Create User Modal
   ───────────────────────────────────────────────────────────────── */
function CreateUserModal({
  open,
  onOpenChange,
  onUserCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUserCreated: (user: UserRow) => void
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<string>("")
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)

  const reset = () => { setName(""); setEmail(""); setRole(""); setPassword("") }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name || !email || !role || !password) {
      toast.error("Please fill in all required fields.")
      return
    }
    if (!email.toLowerCase().endsWith("@ozoneclinic.com")) {
      toast.error("Email must end with @ozoneclinic.com")
      return
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create user.")
      onUserCreated(data.data as UserRow)
      onOpenChange(false)
      reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Create New User
          </DialogTitle>
          <DialogDescription>
            Add a new Manager or Accountant user. Doctor accounts are created automatically when a doctor is added from the Doctors module.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-name">Full Name *</Label>
              <Input
                id="user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter full name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-email">Email *</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@ozoneclinic.com"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Role *</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {CREATABLE_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex flex-col">
                        <span>{r.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {role && (
                <p className="text-xs text-muted-foreground">
                  {CREATABLE_ROLES.find((r) => r.value === role)?.description}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-password">Password *</Label>
              <Input
                id="user-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
              />
            </div>
          </div>

          {/* Info callout - no admin creation */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
            <Shield className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Admin restriction</p>
              <p>For security, new admin accounts cannot be created from this interface. Contact your system administrator if you need a new admin.</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => { onOpenChange(false); reset() }} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              {saving ? "Creating…" : "Create User"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Edit User Credentials Modal
   ───────────────────────────────────────────────────────────────── */
function EditUserCredentialsModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow
  onClose: () => void
  onSaved: (updated: UserRow) => void
}) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name || !email) {
      toast.error("Name and email are required.")
      return
    }
    if (!email.toLowerCase().endsWith("@ozoneclinic.com")) {
      toast.error("Email must end with @ozoneclinic.com")
      return
    }
    if (password && password.length < 6) {
      toast.error("Password must be at least 6 characters.")
      return
    }
    setSaving(true)
    try {
      const body: Record<string, string> = { name, email }
      if (password) body.password = password
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update credentials.")
      onSaved(data.data as UserRow)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update credentials.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            Edit Credentials — {user.name}
          </DialogTitle>
          <DialogDescription>
            Update login details for this user. Leave password blank to keep existing.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ec-name">Full Name *</Label>
            <Input id="ec-name" value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ec-email">Email *</Label>
            <Input id="ec-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ec-password">New Password</Label>
            <Input
              id="ec-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              className="h-10"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
