"use client"

import { use } from "react"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Stethoscope,
  User,
  CalendarDays,
  ClipboardList,
  FileText,
  TestTube,
  AlertTriangle,
  Receipt,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export default function TreatmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { getTreatment, getPatient, getDoctor, getInvoice, testCatalog } = useStore()
  const [showPaymentGate, setShowPaymentGate] = useState(false)

  const treatment = getTreatment(id)

  if (!treatment) {
    return (
      <>
        <PageHeader
          title="Treatment Not Found"
          breadcrumbs={[
            { label: "Dashboard", href: "/" },
            { label: "Treatments", href: "/treatments" },
            { label: "Not Found" },
          ]}
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">This treatment record does not exist.</p>
            <Button asChild className="mt-4">
              <Link href="/treatments">Back to Treatments</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  const patient = getPatient(treatment.patientId)
  const doctor = getDoctor(treatment.doctorId)
  const invoice = getInvoice(treatment.appointmentId ? `inv${treatment.appointmentId.slice(1)}` : "")
  const isUnpaid = invoice && (invoice.status === "unpaid" || invoice.status === "partially-paid")
  const recommendedTests = treatment.testsRecommended.map((tid) => testCatalog.find((t) => t.id === tid)).filter(Boolean)

  return (
    <>
      <PageHeader
        title={`Treatment - ${treatment.diagnosis}`}
        description={`${treatment.date} - ${patient?.name ?? "Unknown"}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Treatments", href: "/treatments" },
          { label: treatment.diagnosis },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {treatment.followUpDate && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/appointments?action=add">
                  <CalendarDays className="mr-1 h-4 w-4" />
                  Create Follow-up
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {/* Payment Gate Warning */}
      {isUnpaid && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                Payment Required - Invoice #{invoice.id} (Rs. {invoice.balance} outstanding)
              </p>
              <p className="text-xs text-red-700">
                Treatment access may be restricted until payment is collected.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-red-300 text-red-800 hover:bg-red-100"
              asChild
            >
              <Link href={`/billing/${invoice.id}`}>
                <Receipt className="mr-1 h-4 w-4" />
                Collect Payment
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Complaint & Clinical Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Clinical Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Chief Complaint</p>
                <p className="text-sm text-foreground rounded-lg bg-muted p-3">{treatment.complaint}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Clinical Notes</p>
                <p className="text-sm text-foreground rounded-lg bg-muted p-3">{treatment.clinicalNotes}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Diagnosis</p>
                <p className="text-sm font-medium text-foreground rounded-lg bg-primary/10 p-3">{treatment.diagnosis}</p>
              </div>
            </CardContent>
          </Card>

          {/* Instructions & Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Prescribed Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-foreground rounded-lg bg-muted p-3">
                {treatment.prescribedInstructions}
              </p>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Doctor Summary</p>
                <p className="text-sm text-foreground rounded-lg bg-muted p-3">{treatment.doctorSummary}</p>
              </div>
            </CardContent>
          </Card>

          {/* Recommended Tests */}
          {recommendedTests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TestTube className="h-4 w-4" />
                  Recommended Tests
                </CardTitle>
                <CardDescription>{recommendedTests.length} tests recommended</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {recommendedTests.map((test) =>
                    test ? (
                      <div
                        key={test.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{test.name}</p>
                          <p className="text-xs text-muted-foreground">{test.category}</p>
                        </div>
                        <Badge variant="outline">Rs. {test.price}</Badge>
                      </div>
                    ) : null
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Total Test Cost</span>
                    <span className="font-semibold">
                      Rs. {recommendedTests.reduce((sum, t) => sum + (t?.price ?? 0), 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status</span>
                <StatusBadge status={treatment.status} />
              </div>
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Patient</p>
                  <Link href={`/patients/${treatment.patientId}`} className="text-sm font-medium hover:text-primary">
                    {patient?.name ?? "Unknown"}
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Doctor</p>
                  <p className="text-sm font-medium">{doctor?.name ?? "Unknown"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm font-medium">{treatment.date}</p>
                </div>
              </div>
              {treatment.followUpDate && (
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-xs font-medium text-blue-800">Follow-up Date</p>
                  <p className="text-sm font-semibold text-blue-900">{treatment.followUpDate}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {invoice && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Billing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Invoice</span>
                    <Link href={`/billing/${invoice.id}`} className="font-medium hover:text-primary">
                      #{invoice.id}
                    </Link>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span>Rs. {invoice.totalAmount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="text-emerald-600">Rs. {invoice.paidAmount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Balance</span>
                    <span className={invoice.balance > 0 ? "text-red-600 font-medium" : ""}>
                      Rs. {invoice.balance}
                    </span>
                  </div>
                  <StatusBadge status={invoice.status} className="mt-1" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Payment Gate Modal */}
      <Dialog open={showPaymentGate} onOpenChange={setShowPaymentGate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Required</DialogTitle>
            <DialogDescription>
              This treatment requires payment before access. Please collect the outstanding balance.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowPaymentGate(false)}>
              Close
            </Button>
            <Button asChild>
              <Link href={invoice ? `/billing/${invoice.id}` : "/billing"}>
                Go to Billing
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
