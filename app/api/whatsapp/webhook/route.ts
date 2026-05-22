import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import WhatsAppSession from "@/lib/models/WhatsAppSession"
import Patient from "@/lib/models/Patient"
import Appointment from "@/lib/models/Appointment"
import Invoice from "@/lib/models/Invoice"
import TestCatalog from "@/lib/models/TestCatalog"
import { sendWhatsApp, sendWhatsAppInteractiveButtons, sendWhatsAppList } from "@/lib/whatsapp"
import { ageToDOB } from "@/lib/utils"
import { getPKTDateString } from "@/lib/pkt"

export const dynamic = "force-dynamic"

// ── Bilingual messages ──────────────────────────────────────────────────────
type Lang = "en" | "ur"

const MSG: Record<string, Record<Lang, string | ((...args: string[]) => string)>> = {
  greeting: {
    en: "Thank you for contacting *Ozone Clinic*! 🏥\n\nPlease select your preferred language:",
    ur: "*اوزون کلینک* سے رابطہ کرنے کا شکریہ! 🏥\n\nبراہ کرم اپنی پسندیدہ زبان منتخب کریں:",
  },
  ask_book: {
    en: "We are here to help you. Would you like to book an appointment?",
    ur: "ہم آپ کی مدد کے لیے حاضر ہیں۔ کیا آپ ملاقات کا وقت بک کروانا چاہیں گے؟",
  },
  yes_book: { en: "Yes, Book Now", ur: "ہاں، بک کریں" },
  no_thanks: { en: "No, Thanks", ur: "نہیں، شکریہ" },
  ask_name: {
    en: "Let's get you registered. 📝\n\nPlease reply with your *full name*.",
    ur: "آئیے آپ کو رجسٹر کرتے ہیں۔ 📝\n\nبراہ کرم اپنا *پورا نام* لکھ کر بھیجیں۔",
  },
  ask_gender: {
    en: (name: string) => `Thank you, *${name}*! 👋\n\nPlease select your *gender*:`,
    ur: (name: string) => `شکریہ، *${name}*! 👋\n\nبراہ کرم اپنی *جنس* منتخب کریں:`,
  },
  gender_male: { en: "Male", ur: "مرد" },
  gender_female: { en: "Female", ur: "عورت" },
  gender_other: { en: "Other", ur: "دیگر" },
  ask_age: {
    en: "Please reply with your *age in years* (e.g. 35).",
    ur: "براہ کرم اپنی *عمر سالوں میں* لکھیں (مثال: 35)۔",
  },
  age_invalid: {
    en: "❌ That doesn't look right. Please enter your age as a number between *1 and 120*.",
    ur: "❌ یہ درست نہیں لگ رہا۔ براہ کرم اپنی عمر *1 سے 120* کے درمیان ایک نمبر کے طور پر لکھیں۔",
  },
  onboarding: {
    en: (name: string) =>
      `✅ *Welcome to Ozone Clinic, ${name}!*\n\nYou are now registered as our patient. 🏥\n\nLet's book your appointment — please choose a procedure from the menu below.`,
    ur: (name: string) =>
      `✅ *اوزون کلینک میں خوش آمدید، ${name}!*\n\nآپ اب ہمارے مریض کے طور پر رجسٹر ہو چکے ہیں۔ 🏥\n\nآئیے آپ کی ملاقات بک کرتے ہیں — براہ کرم نیچے دیے گئے مینو سے ایک پروسیجر منتخب کریں۔`,
  },
  welcome_back: {
    en: (name: string) => `Welcome back, *${name}*! 👋\n\nLet's book your appointment.`,
    ur: (name: string) => `دوبارہ خوش آمدید، *${name}*! 👋\n\nآئیے آپ کی ملاقات بک کرتے ہیں۔`,
  },
  choose_procedure: {
    en: "Please select the *procedure* you would like to book:",
    ur: "براہ کرم وہ *پروسیجر* منتخب کریں جو آپ بک کرنا چاہتے ہیں:",
  },
  btn_procedures: { en: "View Procedures", ur: "پروسیجرز دیکھیں" },
  no_procedures: {
    en: "We're sorry — no procedures are available for online booking right now. Our team will contact you shortly to assist. 🙏",
    ur: "معذرت — اس وقت آن لائن بکنگ کے لیے کوئی پروسیجر دستیاب نہیں۔ ہماری ٹیم جلد آپ سے رابطہ کرے گی۔ 🙏",
  },
  choose_date: {
    en: (proc: string) => `Great choice — *${proc}*. 📅\n\nPlease select your preferred *date*:`,
    ur: (proc: string) => `بہترین انتخاب — *${proc}*۔ 📅\n\nبراہ کرم اپنی پسندیدہ *تاریخ* منتخب کریں:`,
  },
  btn_date: { en: "Select Date", ur: "تاریخ منتخب کریں" },
  choose_time: {
    en: "Please select your preferred *time slot*: 🕐",
    ur: "براہ کرم اپنا پسندیدہ *وقت* منتخب کریں: 🕐",
  },
  btn_time: { en: "Select Time", ur: "وقت منتخب کریں" },
  confirm_summary: {
    en: (proc: string, price: string, date: string, time: string) =>
      `Please review your appointment: 📋\n\n*Procedure:* ${proc}\n*Fee:* Rs. ${price}\n*Date:* ${date}\n*Time:* ${time}\n\nShall I confirm this booking?`,
    ur: (proc: string, price: string, date: string, time: string) =>
      `براہ کرم اپنی ملاقات کا جائزہ لیں: 📋\n\n*پروسیجر:* ${proc}\n*فیس:* Rs. ${price}\n*تاریخ:* ${date}\n*وقت:* ${time}\n\nکیا میں یہ بکنگ کنفرم کر دوں؟`,
  },
  confirm_yes: { en: "Confirm", ur: "تصدیق کریں" },
  confirm_no: { en: "Cancel", ur: "منسوخ کریں" },
  booked_success: {
    en: (proc: string, date: string, time: string) =>
      `✅ *Appointment Confirmed!*\n\n*Procedure:* ${proc}\n*Date:* ${date}\n*Time:* ${time}\n\nYour appointment has been booked. Our team will assign a doctor and contact you if needed.\n\nThank you for choosing *Ozone Clinic*! 🏥`,
    ur: (proc: string, date: string, time: string) =>
      `✅ *ملاقات کنفرم ہو گئی!*\n\n*پروسیجر:* ${proc}\n*تاریخ:* ${date}\n*وقت:* ${time}\n\nآپ کی ملاقات بک ہو گئی ہے۔ ہماری ٹیم ڈاکٹر تفویض کرے گی اور ضرورت پڑنے پر آپ سے رابطہ کرے گی۔\n\n*اوزون کلینک* کا انتخاب کرنے کا شکریہ! 🏥`,
  },
  booking_failed: {
    en: "⚠️ Sorry, something went wrong while booking. Our team has been notified and will contact you shortly to complete your appointment. 🙏",
    ur: "⚠️ معذرت، بکنگ کے دوران کوئی مسئلہ پیش آیا۔ ہماری ٹیم کو اطلاع دے دی گئی ہے اور وہ جلد آپ سے رابطہ کرے گی۔ 🙏",
  },
  cancelled: {
    en: "Your booking has been cancelled. Message us anytime to start again. 😊\n\n*Ozone Clinic*",
    ur: "آپ کی بکنگ منسوخ کر دی گئی ہے۔ دوبارہ شروع کرنے کے لیے کسی بھی وقت ہمیں پیغام بھیجیں۔ 😊\n\n*اوزون کلینک*",
  },
  goodbye: {
    en: "No problem! Feel free to message us anytime. We are always here to help. 😊\n\n*Ozone Clinic*",
    ur: "کوئی بات نہیں! آپ کسی بھی وقت ہم سے رابطہ کر سکتے ہیں۔ ہم ہمیشہ آپ کی مدد کے لیے موجود ہیں۔ 😊\n\n*اوزون کلینک*",
  },
  use_buttons: {
    en: "Please use the buttons below to respond:",
    ur: "براہ کرم جواب دینے کے لیے نیچے دیے گئے بٹن استعمال کریں:",
  },
  invalid_selection: {
    en: "Please tap one of the options above to continue. 👆",
    ur: "براہ کرم جاری رکھنے کے لیے اوپر دیے گئے اختیارات میں سے ایک منتخب کریں۔ 👆",
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

// ── Helpers ─────────────────────────────────────────────────────────────────

// Canonical phone form so a WhatsApp number ("923360617000") matches a stored
// patient phone ("0336-0617000", "+923360617000", …).
function normalizePhone(phone: string): string {
  const d = String(phone || "").replace(/\D/g, "")
  if (d.startsWith("0") && d.length === 11) return "92" + d.slice(1)
  return d
}

const TIME_SLOTS = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]

function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, "0")} ${period}`
}

// The next `n` days starting today (clinic timezone)
function nextDays(n: number): Array<{ iso: string; label: string }> {
  const base = new Date(getPKTDateString() + "T00:00:00")
  const days: Array<{ iso: string; label: string }> = []
  for (let i = 0; i < n; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const nice = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    days.push({ iso, label: i === 0 ? `Today · ${nice}` : i === 1 ? `Tomorrow · ${nice}` : nice })
  }
  return days
}

function niceDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

// Find an existing patient whose phone matches the WhatsApp sender
async function findPatientByPhone(from: string) {
  const target = normalizePhone(from)
  const patients = await Patient.find({}).select("name phone").lean()
  return patients.find((p) => normalizePhone(String(p.phone)) === target) ?? null
}

// Send the procedure catalogue as an interactive list. Returns false if empty.
async function sendProcedureList(from: string, lang: Lang): Promise<boolean> {
  const procedures = await TestCatalog.find({ isActive: true }).sort({ name: 1 }).limit(10).lean()
  if (procedures.length === 0) return false
  const rows = procedures.map((p) => ({
    id: `proc_${String(p._id)}`,
    title: String(p.name),
    description: `Rs. ${Number(p.price).toLocaleString()} · ${p.category}`,
  }))
  await sendWhatsAppList(from, t("choose_procedure", lang), t("btn_procedures", lang), rows, "🏥 Ozone Clinic")
  return true
}

async function sendDateList(from: string, lang: Lang, procedureName: string) {
  const rows = nextDays(7).map((d) => ({ id: `date_${d.iso}`, title: d.label }))
  await sendWhatsAppList(from, tFn("choose_date", lang)(procedureName), t("btn_date", lang), rows, "📅 Choose a Date")
}

async function sendTimeList(from: string, lang: Lang) {
  const rows = TIME_SLOTS.map((s) => ({ id: `time_${s}`, title: formatTime12h(s) }))
  await sendWhatsAppList(from, t("choose_time", lang), t("btn_time", lang), rows, "🕐 Choose a Time")
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
    if (!message || !message.from) return new NextResponse("OK", { status: 200 })

    const from = message.from // e.g. "923360617000"
    const textBody = message.text?.body?.trim() ?? ""
    const buttonId = message.interactive?.button_reply?.id ?? ""
    const listId = message.interactive?.list_reply?.id ?? ""

    await connectDB()
    const session = await WhatsAppSession.findOne({ phone: from })

    // ── No session → greet + ask for language ────────────────────────────
    if (!session) {
      await sendWhatsAppInteractiveButtons(from, t("greeting", "en"), [
        { id: "lang_en", title: "English" },
        { id: "lang_ur", title: "اردو (Urdu)" },
      ])
      await WhatsAppSession.create({ phone: from, state: "awaiting_language" })
      return new NextResponse("OK", { status: 200 })
    }

    const lang: Lang = (session.language as Lang) || "en"

    // ── awaiting_language ────────────────────────────────────────────────
    if (session.state === "awaiting_language") {
      if (buttonId === "lang_en" || buttonId === "lang_ur") {
        const selectedLang: Lang = buttonId === "lang_ur" ? "ur" : "en"
        await WhatsAppSession.findOneAndUpdate(
          { phone: from },
          { state: "awaiting_response", language: selectedLang }
        )
        await sendWhatsAppInteractiveButtons(from, t("ask_book", selectedLang), [
          { id: "yes_book", title: t("yes_book", selectedLang).slice(0, 20) },
          { id: "no_thanks", title: t("no_thanks", selectedLang).slice(0, 20) },
        ])
      } else {
        await sendWhatsAppInteractiveButtons(from, t("greeting", "en"), [
          { id: "lang_en", title: "English" },
          { id: "lang_ur", title: "اردو (Urdu)" },
        ])
      }
      return new NextResponse("OK", { status: 200 })
    }

    // ── awaiting_response → Book yes/no ──────────────────────────────────
    if (session.state === "awaiting_response") {
      if (buttonId === "yes_book") {
        // Already a patient? → skip registration, go straight to procedures
        const existing = await findPatientByPhone(from)
        if (existing) {
          await sendWhatsApp(from, tFn("welcome_back", lang)(String(existing.name)))
          const hasProcedures = await sendProcedureList(from, lang)
          if (!hasProcedures) {
            await sendWhatsApp(from, t("no_procedures", lang))
            await WhatsAppSession.deleteOne({ phone: from })
            return new NextResponse("OK", { status: 200 })
          }
          await WhatsAppSession.findOneAndUpdate(
            { phone: from },
            { state: "awaiting_procedure", patientId: String(existing._id) }
          )
        } else {
          await sendWhatsApp(from, t("ask_name", lang))
          await WhatsAppSession.findOneAndUpdate({ phone: from }, { state: "awaiting_name" })
        }
      } else if (buttonId === "no_thanks") {
        await sendWhatsApp(from, t("goodbye", lang))
        await WhatsAppSession.deleteOne({ phone: from })
      } else {
        await sendWhatsAppInteractiveButtons(from, t("use_buttons", lang), [
          { id: "yes_book", title: t("yes_book", lang).slice(0, 20) },
          { id: "no_thanks", title: t("no_thanks", lang).slice(0, 20) },
        ])
      }
      return new NextResponse("OK", { status: 200 })
    }

    // ── awaiting_name → collect name, then ask gender ────────────────────
    if (session.state === "awaiting_name") {
      if (!textBody) return new NextResponse("OK", { status: 200 })
      await WhatsAppSession.findOneAndUpdate(
        { phone: from },
        { state: "awaiting_gender", collectedName: textBody }
      )
      await sendWhatsAppInteractiveButtons(from, tFn("ask_gender", lang)(textBody), [
        { id: "gender_male", title: t("gender_male", lang).slice(0, 20) },
        { id: "gender_female", title: t("gender_female", lang).slice(0, 20) },
        { id: "gender_other", title: t("gender_other", lang).slice(0, 20) },
      ])
      return new NextResponse("OK", { status: 200 })
    }

    // ── awaiting_gender → collect gender, then ask age ───────────────────
    if (session.state === "awaiting_gender") {
      const gender = buttonId.startsWith("gender_") ? buttonId.slice(7) : ""
      if (!["male", "female", "other"].includes(gender)) {
        await sendWhatsAppInteractiveButtons(from, t("invalid_selection", lang), [
          { id: "gender_male", title: t("gender_male", lang).slice(0, 20) },
          { id: "gender_female", title: t("gender_female", lang).slice(0, 20) },
          { id: "gender_other", title: t("gender_other", lang).slice(0, 20) },
        ])
        return new NextResponse("OK", { status: 200 })
      }
      await WhatsAppSession.findOneAndUpdate({ phone: from }, { state: "awaiting_age", collectedGender: gender })
      await sendWhatsApp(from, t("ask_age", lang))
      return new NextResponse("OK", { status: 200 })
    }

    // ── awaiting_age → validate, register the patient, show procedures ───
    if (session.state === "awaiting_age") {
      if (!textBody) return new NextResponse("OK", { status: 200 })
      const age = parseInt(textBody.replace(/\D/g, ""), 10)
      if (isNaN(age) || age < 1 || age > 120) {
        await sendWhatsApp(from, t("age_invalid", lang))
        return new NextResponse("OK", { status: 200 })
      }

      const name = session.collectedName || "WhatsApp Patient"
      const gender = session.collectedGender || "other"

      try {
        const patient = await Patient.create({
          name,
          phone: `+${from}`,
          gender,
          age,
          dateOfBirth: ageToDOB(age),
          tags: [],
          notes: "Registered via WhatsApp bot.",
          assignedDoctorId: "",
          medicalHistory: [],
          documents: [],
        })
        await sendWhatsApp(from, tFn("onboarding", lang)(name))

        const hasProcedures = await sendProcedureList(from, lang)
        if (!hasProcedures) {
          await sendWhatsApp(from, t("no_procedures", lang))
          await WhatsAppSession.deleteOne({ phone: from })
          return new NextResponse("OK", { status: 200 })
        }
        await WhatsAppSession.findOneAndUpdate(
          { phone: from },
          { state: "awaiting_procedure", collectedAge: age, patientId: String(patient._id) }
        )
        console.log(`[Bot] ✅ Patient registered via WhatsApp — ${name} (${from})`)
      } catch (err) {
        console.error("[Bot] Patient registration failed:", err)
        await sendWhatsApp(from, t("booking_failed", lang))
        await WhatsAppSession.deleteOne({ phone: from })
      }
      return new NextResponse("OK", { status: 200 })
    }

    // ── awaiting_procedure → select a procedure, then ask date ───────────
    if (session.state === "awaiting_procedure") {
      const procId = listId.startsWith("proc_") ? listId.slice(5) : ""
      let procedure = null
      if (procId) {
        try {
          procedure = await TestCatalog.findById(procId)
        } catch {
          procedure = null
        }
      }
      if (!procedure || !procedure.isActive) {
        await sendWhatsApp(from, t("invalid_selection", lang))
        await sendProcedureList(from, lang)
        return new NextResponse("OK", { status: 200 })
      }
      await WhatsAppSession.findOneAndUpdate(
        { phone: from },
        {
          state: "awaiting_date",
          procedureId: String(procedure._id),
          procedureName: procedure.name,
          procedurePrice: procedure.price,
        }
      )
      await sendDateList(from, lang, String(procedure.name))
      return new NextResponse("OK", { status: 200 })
    }

    // ── awaiting_date → select a date, then ask time ─────────────────────
    if (session.state === "awaiting_date") {
      const date = listId.startsWith("date_") ? listId.slice(5) : ""
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < getPKTDateString()) {
        await sendWhatsApp(from, t("invalid_selection", lang))
        await sendDateList(from, lang, session.procedureName || "")
        return new NextResponse("OK", { status: 200 })
      }
      await WhatsAppSession.findOneAndUpdate({ phone: from }, { state: "awaiting_time", selectedDate: date })
      await sendTimeList(from, lang)
      return new NextResponse("OK", { status: 200 })
    }

    // ── awaiting_time → select a time, then show confirmation ────────────
    if (session.state === "awaiting_time") {
      const time = listId.startsWith("time_") ? listId.slice(5) : ""
      if (!TIME_SLOTS.includes(time)) {
        await sendWhatsApp(from, t("invalid_selection", lang))
        await sendTimeList(from, lang)
        return new NextResponse("OK", { status: 200 })
      }
      await WhatsAppSession.findOneAndUpdate({ phone: from }, { state: "awaiting_confirm", selectedTime: time })
      await sendWhatsAppInteractiveButtons(
        from,
        tFn("confirm_summary", lang)(
          session.procedureName || "Procedure",
          Number(session.procedurePrice ?? 0).toLocaleString(),
          niceDate(session.selectedDate || getPKTDateString()),
          formatTime12h(time)
        ),
        [
          { id: "confirm_yes", title: t("confirm_yes", lang).slice(0, 20) },
          { id: "confirm_no", title: t("confirm_no", lang).slice(0, 20) },
        ]
      )
      return new NextResponse("OK", { status: 200 })
    }

    // ── awaiting_confirm → book the appointment ──────────────────────────
    if (session.state === "awaiting_confirm") {
      if (buttonId === "confirm_no") {
        await sendWhatsApp(from, t("cancelled", lang))
        await WhatsAppSession.deleteOne({ phone: from })
        return new NextResponse("OK", { status: 200 })
      }
      if (buttonId !== "confirm_yes") {
        await sendWhatsAppInteractiveButtons(from, t("use_buttons", lang), [
          { id: "confirm_yes", title: t("confirm_yes", lang).slice(0, 20) },
          { id: "confirm_no", title: t("confirm_no", lang).slice(0, 20) },
        ])
        return new NextResponse("OK", { status: 200 })
      }

      const patientId = session.patientId
      const date = session.selectedDate
      const time = session.selectedTime
      const procedureName = session.procedureName || "Procedure"
      const price = Number(session.procedurePrice ?? 0)

      // Guard against an incomplete / stale session
      if (!patientId || !date || !time || !session.procedureId || date < getPKTDateString()) {
        await sendWhatsApp(from, t("booking_failed", lang))
        await WhatsAppSession.deleteOne({ phone: from })
        return new NextResponse("OK", { status: 200 })
      }

      try {
        // Create the appointment — no doctor assigned (assigned later by staff)
        const appointment = await Appointment.create({
          patientId,
          doctorId: "",
          date,
          time,
          duration: 30,
          status: "scheduled",
          type: "treatment",
          notes: `Booked via WhatsApp bot. Procedure: ${procedureName}.`,
          receptionNotes: "",
          doctorNotes: "",
          referral: "WhatsApp Bot",
          invoiceId: "",
        })

        // Auto-create the invoice with the procedure as a line item
        const invoice = await Invoice.create({
          patientId,
          appointmentId: appointment._id.toString(),
          doctorId: "",
          lineItems: [
            {
              id: `li_proc_${Date.now()}`,
              description: procedureName,
              category: "procedure",
              amount: price,
              quantity: 1,
            },
          ],
          totalAmount: price,
          paidAmount: 0,
          balance: price,
          status: "unpaid",
          payments: [],
        })
        await Appointment.findByIdAndUpdate(appointment._id, { invoiceId: invoice._id.toString() })

        await sendWhatsApp(
          from,
          tFn("booked_success", lang)(procedureName, niceDate(date), formatTime12h(time))
        )
        console.log(`[Bot] ✅ Appointment booked via WhatsApp — patient ${patientId}, ${date} ${time}`)
        await WhatsAppSession.deleteOne({ phone: from })
      } catch (err) {
        console.error("[Bot] Appointment booking failed:", err)
        await sendWhatsApp(from, t("booking_failed", lang))
        await WhatsAppSession.deleteOne({ phone: from })
      }
      return new NextResponse("OK", { status: 200 })
    }

    // ── Unknown / stale state → reset the conversation ───────────────────
    await WhatsAppSession.deleteOne({ phone: from })
    await sendWhatsAppInteractiveButtons(from, t("greeting", "en"), [
      { id: "lang_en", title: "English" },
      { id: "lang_ur", title: "اردو (Urdu)" },
    ])
    await WhatsAppSession.create({ phone: from, state: "awaiting_language" })
  } catch (err) {
    console.error("[Webhook] Error:", err)
  }

  return new NextResponse("OK", { status: 200 })
}
