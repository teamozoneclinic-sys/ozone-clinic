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
import { Plus, Search, ChevronRight } from "lucide-react"
import { AddPatientModal } from "@/components/add-patient-modal"

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

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={genderFilter} onValueChange={setGenderFilter}>
              <SelectTrigger className="w-[140px]">
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
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Doctor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Patients Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden sm:table-cell">Gender</TableHead>
                <TableHead className="hidden sm:table-cell">Age</TableHead>
                <TableHead className="hidden lg:table-cell">Doctor</TableHead>
                <TableHead className="hidden lg:table-cell">Balance</TableHead>
                <TableHead className="hidden xl:table-cell">Tags</TableHead>
                <TableHead className="w-8">
                  <span className="sr-only">View</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    No patients found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPatients.map((patient) => {
                  const doctor = doctors.find((d) => d.id === patient.assignedDoctorId)
                  const balance = getOutstandingBalance(patient.id)
                  return (
                    <TableRow key={patient.id} className="cursor-pointer hover:bg-accent/40">
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {patient.id}
                      </TableCell>
                      <TableCell>
                        <Link href={`/patients/${patient.id}`} className="font-medium text-foreground hover:text-primary">
                          {patient.name}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {patient.phone}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell capitalize text-muted-foreground">
                        {patient.gender}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {patient.age}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {doctor?.name ?? "-"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {balance > 0 ? (
                          <span className="font-medium text-red-600">Rs. {balance}</span>
                        ) : (
                          <span className="text-muted-foreground">$0</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {patient.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {patient.tags.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{patient.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/patients/${patient.id}`}>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
