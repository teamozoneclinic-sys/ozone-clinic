"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import {
  Plus,
  Search,
  ChevronRight,
  Phone,
  Users,
  Stethoscope,
} from "lucide-react"
import { AddPatientModal } from "@/components/add-patient-modal"

// Avatar color palette — cycles through based on first char code
const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-teal-100 text-teal-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
  "bg-pink-100 text-pink-700",
]

function getAvatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

export default function PatientsPage() {
  const { patients, doctors, getPatientInvoices } = useStore()
  const [search, setSearch] = useState("")
  const [genderFilter, setGenderFilter] = useState<string>("all")
  const [doctorFilter, setDoctorFilter] = useState<string>("all")
  const [showAddModal, setShowAddModal] = useState(false)

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchSearch =
        search === "" ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.phone.includes(search) ||
        p.id.toLowerCase().includes(search.toLowerCase())
      const matchGender = genderFilter === "all" || p.gender === genderFilter
      const matchDoctor = doctorFilter === "all" || p.assignedDoctorId === doctorFilter
      return matchSearch && matchGender && matchDoctor
    })
  }, [patients, search, genderFilter, doctorFilter])

  const getOutstandingBalance = (patientId: string) => {
    const invoices = getPatientInvoices(patientId)
    return invoices.reduce((sum, inv) => sum + inv.balance, 0)
  }

  const maleCount = patients.filter((p) => p.gender === "male").length
  const femaleCount = patients.filter((p) => p.gender === "female").length

  return (
    <>
      <PageHeader
        title="Patients"
        description="Manage patient records and profiles."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Patients" }]}
        actions={
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Patient
          </Button>
        }
      />

      {/* ── Summary chips ── */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex items-center gap-1.5 rounded-full bg-muted/60 border border-border px-3 py-1.5">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{patients.length}</span>
          <span className="text-xs text-muted-foreground">Total</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5">
          <span className="text-xs text-blue-600">♂</span>
          <span className="text-sm font-medium text-blue-700">{maleCount}</span>
          <span className="text-xs text-blue-600">Male</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-pink-50 border border-pink-200 px-3 py-1.5">
          <span className="text-xs text-pink-600">♀</span>
          <span className="text-sm font-medium text-pink-700">{femaleCount}</span>
          <span className="text-xs text-pink-600">Female</span>
        </div>
        {filteredPatients.length !== patients.length && (
          <div className="flex items-center gap-1.5 rounded-full bg-primary/5 border border-primary/20 px-3 py-1.5">
            <Search className="h-3 w-3 text-primary" />
            <span className="text-xs text-primary font-medium">
              {filteredPatients.length} result{filteredPatients.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <Card className="mb-5">
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone or ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={genderFilter} onValueChange={setGenderFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={doctorFilter} onValueChange={setDoctorFilter}>
              <SelectTrigger className="w-[190px] h-9">
                <SelectValue placeholder="Doctor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Patients Table ── */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4 w-[260px]">Patient</TableHead>
                <TableHead className="hidden sm:table-cell">Gender / Age</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden sm:table-cell">Blood</TableHead>
                <TableHead className="hidden lg:table-cell">Assigned Doctor</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Balance</TableHead>
                <TableHead className="hidden xl:table-cell">Tags</TableHead>
                <TableHead className="w-10 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Users className="h-8 w-8 opacity-30" />
                      <p className="text-sm">No patients found.</p>
                      <p className="text-xs">Try adjusting your search or filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPatients.map((patient) => {
                  const doctor = doctors.find((d) => d.id === patient.assignedDoctorId)
                  const balance = getOutstandingBalance(patient.id)
                  const avatarColor = getAvatarColor(patient.name)

                  return (
                    <TableRow
                      key={patient.id}
                      className="group hover:bg-accent/30 transition-colors border-b border-border/50"
                    >
                      {/* Patient: avatar + name + ID */}
                      <TableCell className="pl-4 py-3">
                        <Link href={`/patients/${patient.id}`} className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarColor}`}>
                            {patient.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate leading-tight">
                              {patient.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                              #{patient.id}
                            </p>
                          </div>
                        </Link>
                      </TableCell>

                      {/* Gender + Age */}
                      <TableCell className="hidden sm:table-cell py-3">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`text-[11px] px-2 py-0.5 font-medium ${
                              patient.gender === "male"
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : patient.gender === "female"
                                ? "border-pink-200 bg-pink-50 text-pink-700"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {patient.gender === "male" ? "♂ M" : patient.gender === "female" ? "♀ F" : "Other"}
                          </Badge>
                          <span className="text-sm font-medium text-foreground">{patient.age}</span>
                          <span className="text-xs text-muted-foreground">yr</span>
                        </div>
                      </TableCell>

                      {/* Phone */}
                      <TableCell className="hidden md:table-cell py-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span className="text-sm font-mono tracking-wide">{patient.phone}</span>
                        </div>
                      </TableCell>

                      {/* Blood Group */}
                      <TableCell className="hidden sm:table-cell py-3">
                        {patient.bloodGroup ? (
                          <Badge
                            variant="outline"
                            className="border-red-200 bg-red-50 text-red-700 text-xs font-semibold px-2"
                          >
                            {patient.bloodGroup}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>

                      {/* Assigned Doctor */}
                      <TableCell className="hidden lg:table-cell py-3">
                        {doctor ? (
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100">
                              <Stethoscope className="h-3.5 w-3.5 text-teal-700" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate leading-tight">{doctor.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{doctor.specialty}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">Unassigned</span>
                        )}
                      </TableCell>

                      {/* Balance */}
                      <TableCell className="hidden lg:table-cell py-3 text-right">
                        {balance > 0 ? (
                          <div className="inline-flex items-center gap-1 rounded-md bg-red-50 border border-red-200 px-2 py-1">
                            <span className="text-xs font-bold text-red-700">Rs. {balance.toLocaleString()}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1">
                            <span className="text-xs font-semibold text-emerald-700">Clear</span>
                          </div>
                        )}
                      </TableCell>

                      {/* Tags */}
                      <TableCell className="hidden xl:table-cell py-3">
                        <div className="flex flex-wrap gap-1">
                          {patient.tags.slice(0, 2).map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-[11px] px-1.5 py-0.5 bg-muted/70 text-muted-foreground"
                            >
                              {tag}
                            </Badge>
                          ))}
                          {patient.tags.length > 2 && (
                            <Badge variant="secondary" className="text-[11px] px-1.5 py-0.5 bg-muted/70 text-muted-foreground">
                              +{patient.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* View */}
                      <TableCell className="pr-4 py-3">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddPatientModal open={showAddModal} onOpenChange={setShowAddModal} />
    </>
  )
}
