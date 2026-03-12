export function buildReceiptMessage(params: {
  clinicName: string
  clinicPhone?: string
  clinicAddress?: string
  patientName: string
  invoiceRef: string
  invoiceDate: string
  paymentDate: string
  doctorName: string
  doctorSpecialty?: string
  appointmentDate?: string
  appointmentTime?: string
  services: { description: string; quantity: number; amount: number }[]
  totalAmount: number
  paidAmount: number
  balance: number
  paymentMethod: string
  reference?: string
}): string {
  const divider = "━━━━━━━━━━━━━━━━━━━━━"
  const services = params.services
    .map((s) => `  • ${s.description} x${s.quantity} — Rs. ${(s.amount * s.quantity).toLocaleString()}`)
    .join("\n")

  const contact = [
    params.clinicPhone   ? `📞 ${params.clinicPhone}` : "",
    params.clinicAddress ? `📍 ${params.clinicAddress}` : "",
  ].filter(Boolean).join("  |  ")

  return (
    `🧾 *Payment Receipt*\n` +
    `*${params.clinicName}*\n` +
    (contact ? `${contact}\n` : "") +
    `\n${divider}\n` +
    `✅ *PAYMENT CONFIRMED*\n` +
    `${divider}\n\n` +
    `Dear *${params.patientName}*,\n` +
    `Your payment has been received successfully.\n\n` +
    `📋 *Invoice #:* ${params.invoiceRef}\n` +
    `📅 *Invoice Date:* ${params.invoiceDate}\n` +
    `💳 *Payment Date:* ${params.paymentDate}\n\n` +
    `👨‍⚕️ *Doctor:* ${params.doctorName}` +
    (params.doctorSpecialty ? ` (${params.doctorSpecialty})` : "") + `\n` +
    (params.appointmentDate
      ? `🗓️ *Appointment:* ${params.appointmentDate} at ${params.appointmentTime ?? ""}\n`
      : "") +
    `\n${divider}\n` +
    `🛒 *Services:*\n${services}\n` +
    `${divider}\n\n` +
    `💰 *Total Amount:* Rs. ${params.totalAmount.toLocaleString()}\n` +
    `✅ *Amount Paid:* Rs. ${params.paidAmount.toLocaleString()}\n` +
    `📊 *Balance Due:* Rs. ${params.balance.toLocaleString()}\n` +
    `💳 *Payment Method:* ${params.paymentMethod.replace("-", " ")}\n` +
    (params.reference ? `🔖 *Reference:* ${params.reference}\n` : "") +
    `\n${divider}\n\n` +
    `Thank you for choosing *${params.clinicName}*! 🏥\n` +
    `_We appreciate your trust in us. Stay healthy!_ 💚`
  )
}
