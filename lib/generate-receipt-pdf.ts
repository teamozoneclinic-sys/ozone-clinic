/**
 * Server-side receipt PDF generator using jsPDF (Node.js compatible).
 * Returns a Buffer of the PDF bytes.
 */
export async function generateReceiptPDF(data: {
  clinicName: string
  invoiceRef: string
  patientName: string
  patientPhone?: string
  doctorName: string
  doctorSpecialty?: string
  invoiceDate: string
  paymentDate: string
  appointmentDate?: string
  appointmentTime?: string
  services: { description: string; quantity: number; amount: number }[]
  totalAmount: number
  paidAmount: number
  balance: number
  paymentMethod: string
}): Promise<Buffer> {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF("p", "mm", "a4")
  const W = pdf.internal.pageSize.getWidth()
  let y = 18

  const line = () => {
    pdf.setDrawColor(200)
    pdf.line(14, y, W - 14, y)
    y += 4
  }

  // Header
  pdf.setFontSize(20)
  pdf.setFont("helvetica", "bold")
  pdf.text(data.clinicName, 14, y)
  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(100)
  pdf.text("RECEIPT", W - 14, y, { align: "right" })
  y += 5
  pdf.text(`#${data.invoiceRef}`, W - 14, y, { align: "right" })
  pdf.setTextColor(0)
  y += 8
  line()

  // Status
  pdf.setFontSize(11)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(22, 163, 74) // green
  pdf.text(data.balance <= 0 ? "FULLY PAID" : "PARTIALLY PAID", 14, y)
  pdf.setTextColor(0)
  y += 8
  line()

  // Patient & Doctor row
  pdf.setFontSize(8)
  pdf.setTextColor(120)
  pdf.text("PATIENT", 14, y)
  pdf.text("DOCTOR", W / 2, y)
  y += 4
  pdf.setFontSize(10)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(0)
  pdf.text(data.patientName, 14, y)
  pdf.text(data.doctorName, W / 2, y)
  y += 4
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(9)
  pdf.setTextColor(100)
  if (data.patientPhone) pdf.text(data.patientPhone, 14, y)
  if (data.doctorSpecialty) pdf.text(data.doctorSpecialty, W / 2, y)
  pdf.setTextColor(0)
  y += 8

  // Dates row
  pdf.setFontSize(8)
  pdf.setTextColor(120)
  pdf.text("APPOINTMENT", 14, y)
  pdf.text("INVOICE DATE", W / 2, y)
  y += 4
  pdf.setFontSize(10)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(0)
  const apptText = data.appointmentDate
    ? `${data.appointmentDate}${data.appointmentTime ? " " + data.appointmentTime : ""}`
    : "—"
  pdf.text(apptText, 14, y)
  pdf.text(data.invoiceDate, W / 2, y)
  y += 8

  pdf.setFontSize(8)
  pdf.setTextColor(120)
  pdf.text("PAYMENT DATE", 14, y)
  y += 4
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(10)
  pdf.setTextColor(0)
  pdf.text(data.paymentDate, 14, y)
  y += 8
  line()

  // Services table
  pdf.setFontSize(8)
  pdf.setTextColor(120)
  pdf.setFont("helvetica", "bold")
  pdf.text("DESCRIPTION", 14, y)
  pdf.text("QTY", W - 50, y, { align: "right" })
  pdf.text("AMOUNT", W - 14, y, { align: "right" })
  y += 5
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(0)
  for (const svc of data.services) {
    pdf.setFontSize(9)
    pdf.text(svc.description, 14, y)
    pdf.text(String(svc.quantity), W - 50, y, { align: "right" })
    pdf.text(`Rs. ${svc.amount.toLocaleString()}`, W - 14, y, { align: "right" })
    y += 6
  }
  y += 2
  line()

  // Totals
  const totalRow = (label: string, value: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal")
    pdf.setFontSize(10)
    pdf.text(label, W - 70, y)
    pdf.text(value, W - 14, y, { align: "right" })
    y += 6
  }
  totalRow("Total Amount:", `Rs. ${data.totalAmount.toLocaleString()}`)
  totalRow("Amount Paid:", `Rs. ${data.paidAmount.toLocaleString()}`)
  totalRow("Balance Due:", `Rs. ${data.balance.toLocaleString()}`, true)
  totalRow("Payment Method:", data.paymentMethod)
  y += 4
  line()

  // Footer
  pdf.setFontSize(9)
  pdf.setTextColor(100)
  pdf.setFont("helvetica", "italic")
  pdf.text(`Thank you for choosing ${data.clinicName}!`, W / 2, y, { align: "center" })

  return Buffer.from(pdf.output("arraybuffer"))
}
