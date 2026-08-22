import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Treatment from "@/lib/models/Treatment"
import Appointment from "@/lib/models/Appointment"
import Invoice from "@/lib/models/Invoice"
import TestCatalog from "@/lib/models/TestCatalog"
import AuditLog from "@/lib/models/AuditLog"
import { getRequestUser, requirePermission } from "@/lib/auth"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { id } = await params
  const treatment = await Treatment.findById(id)
  if (!treatment) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: treatment.toJSON() })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission(request, "treatments.edit")
  if ("response" in gate) return gate.response
  const { user } = gate

  await connectDB()
  const { id } = await params
  const body = await request.json()

  // Separate custom procedures from the treatment fields
  const { customProcedures, newTestIds, ...treatmentFields } = body
  const treatment = await Treatment.findByIdAndUpdate(id, treatmentFields, { returnDocument: "after", runValidators: true })
  if (!treatment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Append new procedures/tests to the invoice if provided
  let updatedInvoice = null
  const testIds: string[] = newTestIds ?? []
  const procedures: { name: string; amount: number }[] = customProcedures ?? []
  if ((testIds.length > 0 || procedures.length > 0) && treatment.appointmentId) {
    try {
      const appointment = await Appointment.findById(treatment.appointmentId)
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
          const procLineItems = procedures.map((p, i) => ({
            id: `li_proc_${Date.now()}_${i}`,
            description: p.name,
            category: "procedure",
            amount: p.amount,
            quantity: 1,
          }))
          const allLineItems = [...(invoice.lineItems ?? []), ...testLineItems, ...procLineItems]
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
            },
            { returnDocument: "after" }
          )
        }
      }
    } catch (err) {
      console.error("Failed to update invoice line items:", err)
    }
  }

  await AuditLog.create({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: "Treatment Edited",
    entity: "Treatment",
    entityId: id,
    details: `Consultation record updated by ${user.name} (${user.role}). Diagnosis: ${treatmentFields.diagnosis || "—"}.`,
    timestamp: new Date().toISOString(),
  })

  return NextResponse.json({ data: treatment.toJSON(), invoice: updatedInvoice?.toJSON() ?? null })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user || !["admin", "manager"].includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()
  const { id } = await params
  await Treatment.findByIdAndDelete(id)
  return NextResponse.json({ success: true })
}
