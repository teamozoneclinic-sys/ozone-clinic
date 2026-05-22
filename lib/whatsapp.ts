/**
 * WhatsApp helper — Meta Cloud API (graph.facebook.com)
 * Env vars required: META_PHONE_NUMBER_ID, META_WA_TOKEN
 */

const GRAPH_URL = "https://graph.facebook.com/v21.0"

// Format phone to full international digits without leading +
// Pakistani local 03XXXXXXXXX → 923XXXXXXXXX
// International with country code (e.g. +44..., +1..., +971...) → strip non-digits
// Numbers already in international format (e.g. 923XXXXXXXXX, 44XXXXXXXXXX) → pass through
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  // Pakistani local numbers starting with 0 → prepend 92
  if (digits.startsWith("0") && digits.length === 11) {
    return "92" + digits.slice(1)
  }
  return digits
}

async function metaPost(body: object): Promise<void> {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID
  const token = process.env.META_WA_TOKEN

  if (!phoneNumberId || !token) {
    throw new Error("META_PHONE_NUMBER_ID or META_WA_TOKEN env var missing")
  }

  console.log(`[WhatsApp] POST to /${phoneNumberId}/messages — to: ${(body as Record<string, string>).to}`)

  const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  })

  const responseText = await res.text().catch(() => "")
  console.log(`[WhatsApp] Meta API response ${res.status}:`, responseText)

  if (!res.ok) {
    throw new Error(`Meta API ${res.status}: ${responseText}`)
  }
}

// Send a plain text message (only works within 24h of customer-initiated conversation)
export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  try {
    await metaPost({
      to: formatPhone(phone),
      type: "text",
      text: { body: message },
    })
    return true
  } catch (err) {
    console.error("[WhatsApp] Text send failed:", err)
    return false
  }
}

// Send an approved WhatsApp template message with dynamic parameters
// params: array of strings matching {{1}}, {{2}}, ... in the template body
export async function sendWhatsAppTemplate(
  phone: string,
  templateName: string,
  params: string[],
  langCode = "en_US"
): Promise<boolean> {
  try {
    await metaPost({
      to: formatPhone(phone),
      type: "template",
      template: {
        name: templateName,
        language: { code: langCode },
        components: [
          {
            type: "body",
            parameters: params.map((text) => ({ type: "text", text })),
          },
        ],
      },
    })
    return true
  } catch (err) {
    console.error(`[WhatsApp] Template "${templateName}" failed:`, err)
    return false
  }
}

// Send an approved template that has a Document header + body params
// (e.g. payment_receipt template with PDF attached)
export async function sendWhatsAppTemplateWithDocument(
  phone: string,
  templateName: string,
  documentUrl: string,
  documentFilename: string,
  bodyParams: string[],
  langCode = "en_US"
): Promise<boolean> {
  try {
    await metaPost({
      to: formatPhone(phone),
      type: "template",
      template: {
        name: templateName,
        language: { code: langCode },
        components: [
          {
            type: "header",
            parameters: [
              {
                type: "document",
                document: { link: documentUrl, filename: documentFilename },
              },
            ],
          },
          {
            type: "body",
            parameters: bodyParams.map((text) => ({ type: "text", text })),
          },
        ],
      },
    })
    return true
  } catch (err) {
    console.error(`[WhatsApp] Template "${templateName}" with document failed:`, err)
    return false
  }
}

// Send a WhatsApp document (PDF) via a public URL
export async function sendWhatsAppWithFileUrl(
  phone: string,
  fileUrl: string,
  filename: string,
  mimetype: string,
  caption?: string
): Promise<void> {
  const type = mimetype.startsWith("image/") ? "image" : "document"
  await metaPost({
    to: formatPhone(phone),
    type,
    [type]: {
      link: fileUrl,
      ...(caption ? { caption } : {}),
      ...(type === "document" ? { filename } : {}),
    },
  })
}

// Send an interactive list message — a tappable menu (max 10 rows).
// Each row: id (≤200 chars), title (≤24 chars), optional description (≤72 chars).
export async function sendWhatsAppList(
  phone: string,
  bodyText: string,
  buttonLabel: string,
  rows: Array<{ id: string; title: string; description?: string }>,
  headerText?: string,
): Promise<boolean> {
  try {
    await metaPost({
      to: formatPhone(phone),
      type: "interactive",
      interactive: {
        type: "list",
        ...(headerText ? { header: { type: "text", text: headerText.slice(0, 60) } } : {}),
        body: { text: bodyText.slice(0, 1024) },
        action: {
          button: buttonLabel.slice(0, 20),
          sections: [
            {
              rows: rows.slice(0, 10).map((r) => ({
                id: r.id.slice(0, 200),
                title: r.title.slice(0, 24),
                ...(r.description ? { description: r.description.slice(0, 72) } : {}),
              })),
            },
          ],
        },
      },
    })
    return true
  } catch (err) {
    console.error("[WhatsApp] List send failed:", err)
    return false
  }
}

// Send interactive button message (works within 24h session window)
export async function sendWhatsAppInteractiveButtons(
  phone: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
): Promise<boolean> {
  try {
    await metaPost({
      to: formatPhone(phone),
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map((btn) => ({
            type: "reply",
            reply: { id: btn.id, title: btn.title },
          })),
        },
      },
    })
    return true
  } catch (err) {
    console.error("[WhatsApp] Interactive buttons send failed:", err)
    return false
  }
}
