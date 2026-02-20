"use client"

import { useState, useMemo } from "react"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  CreditCard,
  CalendarDays,
  Stethoscope,
  Users,
  FileText,
  Receipt,
  TestTube,
  Search,
  ShieldCheck,
  Activity,
} from "lucide-react"
import Link from "next/link"
import type { Role } from "@/lib/types"

const ACTION_CONFIG: Record<
  string,
  { icon: typeof Activity; color: string; bg: string }
> = {
  "Payment Collected": {
    icon: CreditCard,
    color: "text-emerald-700",
    bg: "bg-emerald-100",
  },
  "Appointment Created": {
    icon: CalendarDays,
    color: "text-blue-700",
    bg: "bg-blue-100",
  },
  "Appointment Cancelled": {
    icon: CalendarDays,
    color: "text-red-700",
    bg: "bg-red-100",
  },
  "Treatment Created": {
    icon: Stethoscope,
    color: "text-teal-700",
    bg: "bg-teal-100",
  },
  "Treatment Updated": {
    icon: Stethoscope,
    color: "text-teal-600",
    bg: "bg-teal-50",
  },
  "Patient Created": {
    icon: Users,
    color: "text-violet-700",
    bg: "bg-violet-100",
  },
  "Invoice Voided": {
    icon: Receipt,
    color: "text-red-700",
    bg: "bg-red-100",
  },
  "Test Added": {
    icon: TestTube,
    color: "text-amber-700",
    bg: "bg-amber-100",
  },
}

const ROLE_COLORS: Record<Role, string> = {
  admin: "bg-red-100 text-red-800 border-red-200",
  doctor: "bg-teal-100 text-teal-800 border-teal-200",
  manager: "bg-blue-100 text-blue-800 border-blue-200",
  accounts: "bg-amber-100 text-amber-800 border-amber-200",
}

const ENTITY_LINK: Record<string, (id: string) => string> = {
  Invoice: (id) => `/billing/${id}`,
  Appointment: () => `/appointments`,
  Treatment: (id) => `/treatments/${id}`,
  Patient: (id) => `/patients/${id}`,
}

function formatTimestamp(ts: string) {
  const d = new Date(ts)
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }
}

export default function AuditLogPage() {
  const { auditLog } = useStore()
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [actionFilter, setActionFilter] = useState("all")
  const [entityFilter, setEntityFilter] = useState("all")

  const uniqueActions = Array.from(new Set(auditLog.map((e) => e.action)))
  const uniqueEntities = Array.from(new Set(auditLog.map((e) => e.entity)))

  const filtered = useMemo(() => {
    return auditLog
      .filter((entry) => {
        const matchSearch =
          search === "" ||
          entry.userName.toLowerCase().includes(search.toLowerCase()) ||
          entry.action.toLowerCase().includes(search.toLowerCase()) ||
          entry.details.toLowerCase().includes(search.toLowerCase()) ||
          entry.entityId.toLowerCase().includes(search.toLowerCase())
        const matchRole = roleFilter === "all" || entry.userRole === roleFilter
        const matchAction = actionFilter === "all" || entry.action === actionFilter
        const matchEntity = entityFilter === "all" || entry.entity === entityFilter
        return matchSearch && matchRole && matchAction && matchEntity
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  }, [auditLog, search, roleFilter, actionFilter, entityFilter])

  // Summary counts
  const paymentCount = auditLog.filter((e) => e.action === "Payment Collected").length
  const appointmentCount = auditLog.filter(
    (e) => e.action === "Appointment Created" || e.action === "Appointment Cancelled"
  ).length
  const treatmentCount = auditLog.filter(
    (e) => e.action === "Treatment Created" || e.action === "Treatment Updated"
  ).length
  const patientCount = auditLog.filter((e) => e.action === "Patient Created").length

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Full trail of all user actions and system events."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Audit Log" }]}
      />

      {/* Summary cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={CreditCard}
          label="Payments Recorded"
          value={paymentCount}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-700"
        />
        <SummaryCard
          icon={CalendarDays}
          label="Appointment Events"
          value={appointmentCount}
          iconBg="bg-blue-100"
          iconColor="text-blue-700"
        />
        <SummaryCard
          icon={Stethoscope}
          label="Treatment Events"
          value={treatmentCount}
          iconBg="bg-teal-100"
          iconColor="text-teal-700"
        />
        <SummaryCard
          icon={Users}
          label="Patients Registered"
          value={patientCount}
          iconBg="bg-violet-100"
          iconColor="text-violet-700"
        />
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by user, action, or details..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="doctor">Doctor</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="accounts">Accounts</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {uniqueEntities.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
          {auditLog.length} entries
        </p>
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShieldCheck className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No audit entries match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[27px] top-0 bottom-0 w-px bg-border" />

          <div className="flex flex-col gap-0">
            {filtered.map((entry, idx) => {
              const config = ACTION_CONFIG[entry.action] ?? {
                icon: FileText,
                color: "text-muted-foreground",
                bg: "bg-muted",
              }
              const Icon = config.icon
              const { date, time } = formatTimestamp(entry.timestamp)
              const entityHref = ENTITY_LINK[entry.entity]?.(entry.entityId)
              const showDateDivider =
                idx === 0 ||
                formatTimestamp(filtered[idx - 1].timestamp).date !== date

              return (
                <div key={entry.id}>
                  {showDateDivider && (
                    <div className="relative mb-2 mt-4 flex items-center gap-3 pl-14 first:mt-0">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {date}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}

                  <div className="relative flex gap-4 pb-4">
                    {/* Icon dot */}
                    <div
                      className={`relative z-10 flex h-[54px] w-[54px] shrink-0 items-center justify-center`}
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full ${config.bg} ring-2 ring-background`}
                      >
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                    </div>

                    {/* Content card */}
                    <Card className="flex-1 shadow-none transition-shadow hover:shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">
                                {entry.action}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-xs capitalize ${ROLE_COLORS[entry.userRole]}`}
                              >
                                {entry.userRole}
                              </Badge>
                              {entityHref ? (
                                <Link
                                  href={entityHref}
                                  className="text-xs text-primary hover:underline font-medium"
                                >
                                  {entry.entity} #{entry.entityId}
                                </Link>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {entry.entity} #{entry.entityId}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{entry.details}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1 sm:text-right">
                            <span className="text-xs font-medium text-foreground">
                              {entry.userName}
                            </span>
                            <span className="text-xs text-muted-foreground">{time}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  iconBg,
  iconColor,
}: {
  icon: typeof Activity
  label: string
  value: number
  iconBg: string
  iconColor: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
