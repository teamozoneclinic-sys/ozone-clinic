import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import WhatsAppSession from "@/lib/models/WhatsAppSession"
import AppointmentRequest from "@/lib/models/AppointmentRequest"
import { sendWhatsApp, sendWhatsAppInteractiveButtons } from "@/lib/whatsapp"

export const dynamic = "force-dynamic"

// ── Meta webhook verification ────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("[Webhook] ✅ Verified by Meta")
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse("Forbidden", { status: 403 })
}

// ── Incoming message handler ─────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
    if (!message) return new NextResponse("OK", { status: 200 })

    // Ignore status updates (delivered, read, etc.)
    if (!message.from) return new NextResponse("OK", { status: 200 })

    const from = message.from // e.g. "923360617000"
    const textBody = message.text?.body?.trim() ?? ""
    const buttonId = message.interactive?.button_reply?.id ?? ""

    await connectDB()

    const session = await WhatsAppSession.findOne({ phone: from })

    // ── No session → greet and show Yes/No buttons ───────────────────────
    if (!session) {
      await sendWhatsAppInteractiveButtons(
        from,
        "Thank you for contacting *Ozone Hospital*! 🏥\n\nWe are here to help you. Would you like to book an appointment with one of our doctors?",
        [
          { id: "yes_book", title: "Yes, Book Now" },
          { id: "no_thanks", title: "No, Thanks" },
        ]
      )
      await WhatsAppSession.create({ phone: from, state: "awaiting_response" })
      return new NextResponse("OK", { status: 200 })
    }

    // ── awaiting_response → handle Yes/No button click ───────────────────
    if (session.state === "awaiting_response") {
      if (buttonId === "yes_book") {
        await sendWhatsApp(from, "Great! Please reply with your *full name* so we can register your appointment request.")
        await WhatsAppSession.findOneAndUpdate({ phone: from }, { state: "awaiting_name" })
      } else if (buttonId === "no_thanks") {
        await sendWhatsApp(from, "No problem! Feel free to message us anytime. We are always here to help. 😊\n\n*Ozone Hospital*")
        await WhatsAppSession.deleteOne({ phone: from })
      } else {
        // They typed instead of clicking — re-send buttons
        await sendWhatsAppInteractiveButtons(
          from,
          "Please use the buttons below to respond:",
          [
            { id: "yes_book", title: "Yes, Book Now" },
            { id: "no_thanks", title: "No, Thanks" },
          ]
        )
      }
      return new NextResponse("OK", { status: 200 })
    }

    // ── awaiting_name → collect name ─────────────────────────────────────
    if (session.state === "awaiting_name") {
      if (!textBody) return new NextResponse("OK", { status: 200 })
      await sendWhatsApp(from, `Thank you, *${textBody}*! 👋\n\nPlease share your *date of birth* (e.g. 15/03/1990) so we can complete your registration.`)
      await WhatsAppSession.findOneAndUpdate({ phone: from }, { state: "awaiting_dob", collectedName: textBody })
      return new NextResponse("OK", { status: 200 })
    }

    // ── awaiting_dob → collect DOB, create request, notify ───────────────
    if (session.state === "awaiting_dob") {
      if (!textBody) return new NextResponse("OK", { status: 200 })

      const name = session.collectedName || "Patient"
      const dob = textBody

      // Save appointment request to DB
      await AppointmentRequest.create({ name, dateOfBirth: dob, phone: from })

      // Confirm to patient
      await sendWhatsApp(
        from,
        `✅ *Appointment Request Received!*\n\nThank you, *${name}*. Your request has been submitted successfully.\n\n📋 *Details Registered:*\nName: ${name}\nDate of Birth: ${dob}\n\nOur team will call you shortly to confirm the date, time, and doctor.\n\nThank you for choosing *Ozone Hospital*! 🏥`
      )

      console.log(`[Bot] ✅ Appointment request created — ${name} (${from}), DOB: ${dob}`)

      // Clear session
      await WhatsAppSession.deleteOne({ phone: from })
      return new NextResponse("OK", { status: 200 })
    }
  } catch (err) {
    console.error("[Webhook] Error:", err)
  }

  return new NextResponse("OK", { status: 200 })
}
