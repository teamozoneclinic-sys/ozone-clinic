# Plan: WhatsApp Automation — Instant Receipts + Follow-up Reminders

## Context
The clinic needs two automated WhatsApp features:
1. **Instant payment receipt** — when admin collects a payment, the patient receives a WhatsApp message immediately with receipt details.
2. **Follow-up reminder cron** — a daily job that runs at a random hour between 7PM–11PM PKT, finds patients whose `treatment.followUpDate` is 1–2 days away, and sends them a WhatsApp reminder.

Provider: **Meta Cloud API (official)**. Hosting: **Vercel** (so Vercel Cron Jobs, not node-cron).

---

## Critical Prerequisite — What the User Must Do First (outside code)

Before any code will work, the following must be set up manually by the user in Meta Developer Console:

1. **Create a Meta Developer App** at [developers.facebook.com](https://developers.facebook.com)
2. **Add the WhatsApp product**, create a WhatsApp Business Account, register a phone number
3. **Create two message templates** (type: MARKETING or UTILITY) in Meta Business Manager:
   - **`payment_receipt`** — body:
     > Dear {{1}}, your payment of *Rs. {{2}}* has been received at {{3}}. Invoice No: {{4}}. Balance due: *Rs. {{5}}*. Thank you for choosing {{6}}!
   - **`followup_reminder`** — body:
     > Dear {{1}}, this is a friendly reminder from {{2}} that your follow-up visit is scheduled for *{{3}}*. Please contact us at {{4}} if you need to reschedule. We look forward to seeing you!
4. **Get your credentials** and add them to `.env.local`:
   ```
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
   WHATSAPP_ACCESS_TOKEN=your_permanent_token
   CRON_SECRET=any_random_secret_string
   ```
5. **International phone format**: Patient phones must be stored as `923001234567` (no `+`, no leading 0). The code will clean common formats automatically.

Templates take ~1–24 hours to get approved by Meta.

---

## Architecture

### Feature 1 — Instant Receipt on Payment
```
Admin clicks "Collect Payment"
  → POST /api/invoices/[id]/payment  (existing)
  → Payment saved to DB              (existing)
  → [NEW] lookup Patient phone from DB
  → [NEW] call sendWhatsAppTemplate("payment_receipt", phone, [name, amount, date, invoiceNo, balance, clinicName])
  → Return response (WhatsApp send is non-blocking — won't fail the payment if WA fails)
```

### Feature 2 — Follow-up Reminder Cron
```
Vercel Cron fires every hour: 7PM, 8PM, 9PM, 10PM PKT
  → GET /api/cron/send-reminders (secured with CRON_SECRET header)
  → Date-seeded "random hour" check — only one hour per day actually proceeds
  → Query DB: treatments where followUpDate = today+1 OR today+2 AND reminderSentAt is null
  → For each treatment: lookup Patient phone
  → sendWhatsAppTemplate("followup_reminder", phone, [patientName, clinicName, followUpDate, clinicPhone])
  → Set treatment.reminderSentAt = now (prevent duplicate sends)
```

---

## Files to Create / Modify

### 1. `lib/whatsapp.ts` ← NEW
Single helper module for Meta Cloud API calls.

```typescript
const GRAPH_URL = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`

export function cleanPhone(raw: string): string {
  // Convert 0300-1234567 → 923001234567, +92... → 92..., etc.
  let p = raw.replace(/[\s\-()]/g, "")
  if (p.startsWith("+")) p = p.slice(1)
  if (p.startsWith("0")) p = "92" + p.slice(1)
  return p
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  params: string[]
): Promise<void>
// Calls POST GRAPH_URL with Authorization: Bearer {ACCESS_TOKEN}
// Body: { messaging_product: "whatsapp", to, type: "template",
//         template: { name: templateName, language: { code: "en" },
//                     components: [{ type: "body", parameters: params.map(p=>({type:"text",text:p})) }] } }
// Throws on non-2xx — caller must handle / ignore
```

### 2. `app/api/invoices/[id]/payment/route.ts` ← MODIFY
After saving the payment and before returning the response, add a non-blocking WhatsApp send:

```typescript
// After invoice.save():
// - import Patient, sendWhatsAppTemplate, cleanPhone from lib
// - fetch patient by invoice.patientId
// - if patient?.phone exists and WHATSAPP_PHONE_NUMBER_ID is set:
//   sendWhatsAppTemplate(cleanPhone(patient.phone), "payment_receipt", [
//     patient.name, payment.amount.toString(),
//     new Date(payment.collectedAt).toLocaleString("en-PK"),
//     invoiceNo, invoice.balance.toString(), clinic.name
//   ]).catch(err => console.error("WA receipt failed:", err))
// Non-blocking: .catch() swallows errors, payment still succeeds
```

Note: also need to fetch `ClinicSettings` from DB in this route to get clinic name. The route currently doesn't import it — add a `ClinicSettings.findOne()` call.

### 3. `lib/models/Treatment.ts` ← MODIFY
Add one optional field to the schema:
```typescript
reminderSentAt: { type: String, default: null }  // ISO timestamp, null = not sent
```
Also add to the TypeScript interface: `reminderSentAt?: string | null`

### 4. `lib/types.ts` ← MODIFY
Add `reminderSentAt?: string | null` to the `Treatment` interface.

### 5. `app/api/cron/send-reminders/route.ts` ← NEW
```typescript
export const dynamic = "force-dynamic"
export async function GET(request: NextRequest) {
  // 1. Verify CRON_SECRET header matches env var (security)
  // 2. Date-seeded random hour check:
  //    seed = parseInt(todayPKT.replace(/-/g,"")) % 4
  //    targetHour = 14 + seed  (UTC 14–17 = PKT 19–22)
  //    if currentUTCHour !== targetHour → return { skipped: true }
  // 3. Query: Treatment.find({ followUpDate: {$in: [tomorrow, dayAfter]}, reminderSentAt: null })
  // 4. For each treatment: lookup Patient, send template, set reminderSentAt
  // 5. Return { sent: N }
}
```
Date arithmetic uses PKT (+5h offset) for consistency with the rest of the app.

### 6. `vercel.json` ← NEW
```json
{
  "crons": [
    { "path": "/api/cron/send-reminders", "schedule": "0 14-18 * * *" }
  ]
}
```
Runs the endpoint at 7PM, 8PM, 9PM, 10PM, 11PM PKT daily (UTC 14–18). The date-seeded logic inside picks only one slot to actually send messages.

The cron request from Vercel includes an `Authorization: Bearer {CRON_SECRET}` header automatically when `CRON_SECRET` is set in Vercel environment variables.

---

## Data Flow Diagram

```
Payment collected                Follow-up date set by doctor
      ↓                                    ↓
POST /api/invoices/[id]/payment      Treatment.followUpDate saved in DB
      ↓                                    ↓
  Fetch Patient                  Vercel Cron (hourly 7–11PM PKT)
      ↓                                    ↓
sendWhatsAppTemplate             GET /api/cron/send-reminders
  "payment_receipt"                         ↓
      ↓                          Find treatments with date D+1 or D+2
Patient receives receipt                    ↓
 message on WhatsApp             sendWhatsAppTemplate "followup_reminder"
                                            ↓
                                Set reminderSentAt = now
```

---

## Phone Number Cleaning Logic
```
"+923001234567" → "923001234567"  ✓
"0300-1234567"  → "923001234567"  ✓
"923001234567"  → "923001234567"  ✓
"03001234567"   → "923001234567"  ✓
```

---

## Verification / Testing

1. **Test WhatsApp helper standalone**: Create a test API route `GET /api/test-wa` (dev only) that calls `sendWhatsAppTemplate` with hardcoded values → check phone receives message.
2. **Test payment receipt**: Collect a test payment via billing UI → patient phone should receive WA message within seconds.
3. **Test cron manually**: Call `GET /api/cron/send-reminders` with the `Authorization: Bearer {CRON_SECRET}` header from Postman/curl → returns `{ sent: N }`. Check treatments DB that `reminderSentAt` is set.
4. **Test duplicate prevention**: Call cron endpoint twice on same day → second call returns `{ sent: 0 }` (reminderSentAt already set).
5. **Test time window skip**: When current UTC hour is not the seeded target, endpoint returns `{ skipped: true }`.
