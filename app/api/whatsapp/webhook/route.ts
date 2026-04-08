import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import WhatsAppSession from "@/lib/models/WhatsAppSession"
import AppointmentRequest from "@/lib/models/AppointmentRequest"
import { sendWhatsApp, sendWhatsAppInteractiveButtons } from "@/lib/whatsapp"

export const dynamic = "force-dynamic"

// ── Bilingual message helper ────────────────────────────────────────────────
type Lang = "en" | "ur"

const MSG: Record<string, Record<Lang, string | ((...args: string[]) => string)>> = {
  greeting: {
    en: "Thank you for contacting *Ozone Clinic*! 🏥\n\nPlease select your preferred language:",
    ur: "Thank you for contacting *Ozone Clinic*! 🏥\n\nPlease select your preferred language:",
  },
  ask_book: {
    en: "We are here to help you. Would you like to book an appointment with one of our doctors?",
    ur: "ہم آپ کی مدد کے لیے حاضر ہیں۔ کیا آپ ہمارے کسی ڈاکٹر سے ملاقات کا وقت بک کروانا چاہیں گے؟",
  },
  yes_book: {
    en: "Yes, Book Now",
    ur: "ہاں، بک کریں",
  },
  no_thanks: {
    en: "No, Thanks",
    ur: "نہیں، شکریہ",
  },
  ask_name: {
    en: "Great! Please reply with your *full name* so we can register your appointment request.",
    ur: "بہت اچھا! براہ کرم اپنا *پورا نام* لکھ کر بھیجیں تاکہ ہم آپ کی ملاقات کی درخواست درج کر سکیں۔",
  },
  ask_dob: {
    en: (name: string) =>
      `Thank you, *${name}*! 👋\n\nPlease share your *date of birth* in DD/MM/YYYY format (e.g. 15/03/1990).`,
    ur: (name: string) =>
      `شکریہ، *${name}*! 👋\n\nبراہ کرم اپنی *تاریخ پیدائش* DD/MM/YYYY فارمیٹ میں لکھیں (مثال: 15/03/1990)۔`,
  },
  dob_invalid: {
    en: "❌ That doesn't look like a valid date. Please enter your date of birth in *DD/MM/YYYY* format.\n\nExample: *15/03/1990*",
    ur: "❌ یہ درست تاریخ نہیں لگ رہی۔ براہ کرم اپنی تاریخ پیدائش *DD/MM/YYYY* فارمیٹ میں لکھیں۔\n\nمثال: *15/03/1990*",
  },
  confirmation: {
    en: (name: string, dob: string) =>
      `✅ *Appointment Request Received!*\n\nThank you, *${name}*. Your request has been submitted successfully.\n\n📋 *Details Registered:*\nName: ${name}\nDate of Birth: ${dob}\n\nOur team will call you shortly to confirm the date, time, and doctor.\n\nThank you for choosing *Ozone Hospital*! 🏥`,
    ur: (name: string, dob: string) =>
      `✅ *ملاقات کی درخواست موصول ہو گئی!*\n\nشکریہ، *${name}*۔ آپ کی درخواست کامیابی سے جمع ہو گئی ہے۔\n\n📋 *درج شدہ تفصیلات:*\nنام: ${name}\nتاریخ پیدائش: ${dob}\n\nہماری ٹیم جلد آپ کو تاریخ، وقت اور ڈاکٹر کی تصدیق کے لیے کال کرے گی۔\n\n*اوزون ہسپتال* کا انتخاب کرنے کا شکریہ! 🏥`,
  },
  goodbye: {
    en: "No problem! Feel free to message us anytime. We are always here to help. 😊\n\n*Ozone Hospital*",
    ur: "کوئی بات نہیں! آپ کسی بھی وقت ہم سے رابطہ کر سکتے ہیں۔ ہم ہمیشہ آپ کی مدد کے لیے موجود ہیں۔ 😊\n\n*اوزون ہسپتال*",
  },
  use_buttons: {
    en: "Please use the buttons below to respond:",
    ur: "براہ کرم جواب دینے کے لیے نیچے دیے گئے بٹن استعمال کریں:",
  },
}

function t(key: string, lang: Lang): string {
  const val = MSG[key]?.[lang] ?? MSG[key]?.["en"] ?? key
  return typeof val === "string" ? val : key
}

function tFn(key: string, lang: Lang): (...args: string[]) => string {
  const val = MSG[key]?.[lang] ?? MSG[key]?.["en"]
  return typeof val === "function" ? val : () => String(val ?? key)
}

// Validate DD/MM/YYYY format and return true if valid date
function isValidDOB(input: string): boolean {
  const match = input.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (!match) return false
  const day = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const year = parseInt(match[3], 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  if (year < 1900 || year > new Date().getFullYear()) return false
  // Check actual valid date
  const d = new Date(year, month - 1, day)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
}

// Normalize DOB to DD/MM/YYYY
function normalizeDOB(input: string): string {
  const match = input.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)!
  const day = match[1].padStart(2, "0")
  const month = match[2].padStart(2, "0")
  return `${day}/${month}/${match[3]}`
}

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

    // ── No session → ask for language selection ─────────────────────
    if (!session) {
      await sendWhatsAppInteractiveButtons(
        from,
        t("greeting", "en"),
        [
          { id: "lang_en", title: "English" },
          { id: "lang_ur", title: "اردو (Urdu)" },
        ]
      )
      await WhatsAppSession.create({ phone: from, state: "awaiting_language" })
      return new NextResponse("OK", { status: 200 })
    }

    const lang: Lang = (session.language as Lang) || "en"

    // ── awaiting_language → handle language button click ─────────────
    if (session.state === "awaiting_language") {
      if (buttonId === "lang_en" || buttonId === "lang_ur") {
        const selectedLang: Lang = buttonId === "lang_ur" ? "ur" : "en"
        await WhatsAppSession.findOneAndUpdate(
          { phone: from },
          { state: "awaiting_response", language: selectedLang }
        )
        await sendWhatsAppInteractiveButtons(
          from,
          t("ask_book", selectedLang),
          [
            { id: "yes_book", title: (t("yes_book", selectedLang)).slice(0, 20) },
            { id: "no_thanks", title: (t("no_thanks", selectedLang)).slice(0, 20) },
          ]
        )
      } else {
        // Re-send language buttons
        await sendWhatsAppInteractiveButtons(
          from,
          t("greeting", "en"),
          [
            { id: "lang_en", title: "English" },
            { id: "lang_ur", title: "اردو (Urdu)" },
          ]
        )
      }
      return new NextResponse("OK", { status: 200 })
    }

    // ── awaiting_response → handle Yes/No button click ───────────────────
    if (session.state === "awaiting_response") {
      if (buttonId === "yes_book") {
        await sendWhatsApp(from, t("ask_name", lang))
        await WhatsAppSession.findOneAndUpdate({ phone: from }, { state: "awaiting_name" })
      } else if (buttonId === "no_thanks") {
        await sendWhatsApp(from, t("goodbye", lang))
        await WhatsAppSession.deleteOne({ phone: from })
      } else {
        // They typed instead of clicking — re-send buttons
        await sendWhatsAppInteractiveButtons(
          from,
          t("use_buttons", lang),
          [
            { id: "yes_book", title: (t("yes_book", lang)).slice(0, 20) },
            { id: "no_thanks", title: (t("no_thanks", lang)).slice(0, 20) },
          ]
        )
      }
      return new NextResponse("OK", { status: 200 })
    }

    // ── awaiting_name → collect name ─────────────────────────────────
    if (session.state === "awaiting_name") {
      if (!textBody) return new NextResponse("OK", { status: 200 })
      await sendWhatsApp(from, tFn("ask_dob", lang)(textBody))
      await WhatsAppSession.findOneAndUpdate({ phone: from }, { state: "awaiting_dob", collectedName: textBody })
      return new NextResponse("OK", { status: 200 })
    }

    // ── awaiting_dob → validate DD/MM/YYYY, retry until correct ─────
    if (session.state === "awaiting_dob") {
      if (!textBody) return new NextResponse("OK", { status: 200 })

      // Validate DOB format
      if (!isValidDOB(textBody)) {
        await sendWhatsApp(from, t("dob_invalid", lang))
        return new NextResponse("OK", { status: 200 })
      }

      const name = session.collectedName || "Patient"
      const dob = normalizeDOB(textBody)

      // Save appointment request to DB
      await AppointmentRequest.create({ name, dateOfBirth: dob, phone: from })

      // Confirm to patient
      await sendWhatsApp(from, tFn("confirmation", lang)(name, dob))

      console.log(`[Bot] ✅ Appointment request created — ${name} (${from}), DOB: ${dob}, lang: ${lang}`)

      // Clear session
      await WhatsAppSession.deleteOne({ phone: from })
      return new NextResponse("OK", { status: 200 })
    }
  } catch (err) {
    console.error("[Webhook] Error:", err)
  }

  return new NextResponse("OK", { status: 200 })
}
