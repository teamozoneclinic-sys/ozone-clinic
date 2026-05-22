import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Treatment from "@/lib/models/Treatment"
import Patient from "@/lib/models/Patient"
import Appointment from "@/lib/models/Appointment"
import Invoice from "@/lib/models/Invoice"
import TestCatalog from "@/lib/models/TestCatalog"
import AuditLog from "@/lib/models/AuditLog"
import { getRequestUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()

  let query = {}
  // Doctors only see their own treatments
  if (user.role === "doctor" && user.doctorId) {
    query = { doctorId: user.doctorId }
  }

  const treatments = await Treatment.find(query).sort({ createdAt: -1 })
  return NextResponse.json({ data: treatments.map((t) => t.toJSON()) })
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    await connectDB()
    const body = await request.json()
    const treatment = await Treatment.create(body)

    // Append a medical history entry — non-critical, don't block the response
    try {
      await Patient.findByIdAndUpdate(body.patientId, {
        $push: {
          medicalHistory: {
            id: treatment._id.toString(),
            date: body.date,
            type: "Visit",
            description: `Diagnosis: ${body.diagnosis}${body.complaint ? `. Complaint: ${body.complaint}` : ""}`,
            addedBy: user.name,
          },
        },
      })
    } catch (historyErr) {
      console.error("Failed to append medical history:", historyErr)
    }

    // Auto-add recommended tests + custom procedures as line items on the invoice
    let updatedInvoice = null
    const testIds: string[] = body.testsRecommended ?? []
    const customProcedures: { name: string; amount: number }[] = body.customProcedures ?? []
    if ((testIds.length > 0 || customProcedures.length > 0) && body.appointmentId) {
      try {
        const appointment = await Appointment.findById(body.appointmentId)
        if (appointment?.invoiceId) {
          const [invoice, tests] = await Promise.all([
            Invoice.findById(appointment.invoiceId),
            testIds.length > 0 ? TestCatalog.find({ _id: { $in: testIds } }) : Promise.resolve([]),
          ])
          if (invoice) {
            const testLineItems = tests.map((t: { _id: { toString(): string }; name: string; price: number }) => ({
              id: `li_test_${Date.now()}_${t._id.toString().slice(-6)}`,
              description: `Procedure: ${t.name}`,
              category: "procedure",
              amount: t.price,
              quantity: 1,
            }))
            const procedureLineItems = customProcedures.map((p, i) => ({
              id: `li_proc_${Date.now()}_${i}`,
              description: p.name,
              category: "procedure",
              amount: p.amount,
              quantity: 1,
            }))
            const allLineItems = [...(invoice.lineItems ?? []), ...testLineItems, ...procedureLineItems]
            const newTotal = allLineItems.reduce(
              (sum: number, li: { amount: number; quantity: number }) => sum + li.amount * li.quantity,
              0
            )
            updatedInvoice = await Invoice.findByIdAndUpdate(
              appointment.invoiceId,
              {
                lineItems: allLineItems,
                totalAmount: newTotal,
                balance: newTotal - (invoice.paidAmount ?? 0),
                status: (invoice.paidAmount ?? 0) > 0 ? "partially-paid" : "unpaid",
              },
              { new: true }
            )
          }
        }
      } catch (invoiceErr) {
        console.error("Failed to add line items to invoice:", invoiceErr)
      }
    }

    await AuditLog.create({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "Treatment Created",
      entity: "Treatment",
      entityId: treatment._id.toString(),
      details: `Consultation finalized. Diagnosis: ${body.diagnosis || "—"}. Procedures: ${customProcedures.length}, Tests: ${testIds.length}.`,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json(
      { data: treatment.toJSON(), invoice: updatedInvoice?.toJSON() ?? null },
      { status: 201 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create treatment"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
