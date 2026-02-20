"use client"

import React, { useState } from "react"
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
} from "lucide-react"
import { DEFAULT_CLINIC_INFO, DEFAULT_APPOINTMENT_SETTINGS, ROLE_PERMISSIONS, ALL_PERMISSIONS } from "@/lib/constants"
import { MOCK_USERS } from "@/lib/mock-data"
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
}

export default function SettingsPage() {
  const { doctors, testCatalog, hasPermission } = useStore()
  const canEdit = hasPermission("settings.edit")

  // Clinic info state
  const [clinic, setClinic] = useState(DEFAULT_CLINIC_INFO)

  // Appointment defaults state
  const [apptSettings, setApptSettings] = useState(DEFAULT_APPOINTMENT_SETTINGS)

  const handleSaveClinic = () => {
    toast.success("Clinic information saved.")
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
              </div>
              {canEdit && (
                <div className="mt-6 flex justify-end">
                  <Button onClick={handleSaveClinic} size="sm">
                    <Save className="mr-1.5 h-4 w-4" />
                    Save Changes
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
                          {doc.schedule.map((s) => (
                            <Badge
                              key={s.day}
                              variant="secondary"
                              className="text-xs px-1.5"
                            >
                              {s.day.slice(0, 3)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
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
                    {doc.schedule.map((s) => (
                      <div
                        key={s.day}
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
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Booking Defaults</CardTitle>
                <CardDescription>
                  Default values applied when creating new appointments.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="default-duration">Default Duration (minutes)</Label>
                  <Input
                    id="default-duration"
                    type="number"
                    value={apptSettings.defaultDuration}
                    onChange={(e) =>
                      setApptSettings({ ...apptSettings, defaultDuration: Number(e.target.value) })
                    }
                    min={5}
                    step={5}
                    disabled={!canEdit}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="default-charge">Default Consultation Charge (Rs.)</Label>
                  <Input
                    id="default-charge"
                    type="number"
                    value={apptSettings.defaultCharge}
                    onChange={(e) =>
                      setApptSettings({ ...apptSettings, defaultCharge: Number(e.target.value) })
                    }
                    min={0}
                    step={5}
                    disabled={!canEdit}
                  />
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="hours-start">Working Hours Start</Label>
                    <Input
                      id="hours-start"
                      type="time"
                      value={apptSettings.workingHoursStart}
                      onChange={(e) =>
                        setApptSettings({ ...apptSettings, workingHoursStart: e.target.value })
                      }
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="hours-end">Working Hours End</Label>
                    <Input
                      id="hours-end"
                      type="time"
                      value={apptSettings.workingHoursEnd}
                      onChange={(e) =>
                        setApptSettings({ ...apptSettings, workingHoursEnd: e.target.value })
                      }
                      disabled={!canEdit}
                    />
                  </div>
                </div>
                {canEdit && (
                  <div className="flex justify-end">
                    <Button onClick={handleSaveAppt} size="sm">
                      <Save className="mr-1.5 h-4 w-4" />
                      Save Defaults
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

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
    </>
  )
}

/* ─────────────────────────────────────────────────────────────────
   User Management Section
   ───────────────────────────────────────────────────────────────── */

const CREATABLE_ROLES: { value: Role; label: string; description: string }[] = [
  { value: "manager", label: "Manager", description: "Operations & scheduling" },
  { value: "doctor", label: "Doctor", description: "Clinical access & treatments" },
  { value: "accounts", label: "Accountant", description: "Billing & financial reports" },
]

function UserManagementSection() {
  const { currentUser } = useStore()
  const isAdmin = currentUser.role === "admin"
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [users, setUsers] = useState(MOCK_USERS)

  const handleUserCreated = (user: { name: string; email: string; role: Role }) => {
    const newUser = {
      id: `u${Date.now()}`,
      ...user,
    }
    setUsers((prev) => [...prev, newUser])
    toast.success(`User "${user.name}" created as ${user.role}.`)
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">System Users</CardTitle>
            <CardDescription>
              {users.length} user(s) registered in the system.
              {isAdmin ? " You can create new users." : " Only admins can manage users."}
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
  onUserCreated: (user: { name: string; email: string; role: Role }) => void
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<string>("")
  const [password, setPassword] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !role || !password) {
      toast.error("Please fill in all required fields.")
      return
    }
    if (role === "admin") {
      toast.error("You cannot create an admin user.")
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address.")
      return
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.")
      return
    }
    onUserCreated({ name, email, role: role as Role })
    onOpenChange(false)
    setName("")
    setEmail("")
    setRole("")
    setPassword("")
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
            Add a new user to the system. You can create Manager, Doctor, or Accountant users.
            Admin users cannot be created.
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
                placeholder="user@clinic.com"
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              <UserPlus className="mr-1.5 h-4 w-4" />
              Create User
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
