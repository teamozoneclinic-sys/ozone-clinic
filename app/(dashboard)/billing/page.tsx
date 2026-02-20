"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Input } from "@/components/ui/input"
import { ChevronRight, Search } from "lucide-react"

export default function BillingPage() {
  const { invoices, getPatient, getDoctor, doctors } = useStore()
  const [search, setSearch] = useState("")
  const [doctorFilter, setDoctorFilter] = useState("all")

  const unpaidInvoices = useMemo(() => {
    return invoices.filter((i) => {
      const isUnpaid = i.status === "unpaid" || i.status === "partially-paid"
      const patient = getPatient(i.patientId)
      const matchSearch =
        search === "" ||
        patient?.name.toLowerCase().includes(search.toLowerCase()) ||
        i.id.toLowerCase().includes(search.toLowerCase())
      const matchDoctor = doctorFilter === "all" || i.doctorId === doctorFilter
      return isUnpaid && matchSearch && matchDoctor
    })
  }, [invoices, search, doctorFilter, getPatient])

  const paidInvoices = useMemo(() => {
    return invoices.filter((i) => {
      const isPaid = i.status === "paid" || i.status === "voided"
      const patient = getPatient(i.patientId)
      const matchSearch =
        search === "" ||
        patient?.name.toLowerCase().includes(search.toLowerCase()) ||
        i.id.toLowerCase().includes(search.toLowerCase())
      const matchDoctor = doctorFilter === "all" || i.doctorId === doctorFilter
      return isPaid && matchSearch && matchDoctor
    })
  }, [invoices, search, doctorFilter, getPatient])

  const totalUnpaid = unpaidInvoices.reduce((sum, i) => sum + i.balance, 0)

  return (
    <>
      <PageHeader
        title="Billing"
        description={`${unpaidInvoices.length} unpaid invoices - Rs. {totalUnpaid.toLocaleString()} outstanding`}
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Billing" }]}
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by patient or invoice ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={doctorFilter} onValueChange={setDoctorFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Doctors" />
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

      <Tabs defaultValue="unpaid">
        <TabsList className="mb-4">
          <TabsTrigger value="unpaid">
            Unpaid ({unpaidInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="paid">
            Paid / Voided ({paidInvoices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unpaid">
          <InvoiceTable invoices={unpaidInvoices} getPatient={getPatient} getDoctor={getDoctor} />
        </TabsContent>

        <TabsContent value="paid">
          <InvoiceTable invoices={paidInvoices} getPatient={getPatient} getDoctor={getDoctor} />
        </TabsContent>
      </Tabs>
    </>
  )
}

function InvoiceTable({
  invoices,
  getPatient,
  getDoctor,
}: {
  invoices: ReturnType<ReturnType<typeof useStore>["getUnpaidInvoices"]>
  getPatient: ReturnType<typeof useStore>["getPatient"]
  getDoctor: ReturnType<typeof useStore>["getDoctor"]
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead className="hidden md:table-cell">Doctor</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Date</TableHead>
              <TableHead className="w-8"><span className="sr-only">View</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  No invoices found.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => {
                const patient = getPatient(inv.patientId)
                const doctor = getDoctor(inv.doctorId)
                return (
                  <TableRow key={inv.id} className="cursor-pointer hover:bg-accent/40">
                    <TableCell>
                      <Link href={`/billing/${inv.id}`} className="font-medium font-mono text-xs hover:text-primary">
                        #{inv.id}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/patients/${inv.patientId}`} className="font-medium hover:text-primary">
                        {patient?.name ?? "Unknown"}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {doctor?.name ?? "-"}
                    </TableCell>
                    <TableCell>Rs. {inv.totalAmount}</TableCell>
                    <TableCell className="text-emerald-600">Rs. {inv.paidAmount}</TableCell>
                    <TableCell className={inv.balance > 0 ? "text-red-600 font-medium" : ""}>
                      Rs. {inv.balance}
                    </TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                      {inv.createdAt}
                    </TableCell>
                    <TableCell>
                      <Link href={`/billing/${inv.id}`}>
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
  )
}
