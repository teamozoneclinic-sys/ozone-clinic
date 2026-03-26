/**
 * WhatsApp helper — Meta Cloud API (graph.facebook.com)
 * Env vars required: META_PHONE_NUMBER_ID, META_WA_TOKEN
 */

const GRAPH_URL = "https://graph.facebook.com/v21.0"

// Format phone to international digits (e.g. 03001234567 → 923001234567)
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return digits.startsWith("0") ? "92" + digits.slice(1) : digits
}

async function metaPost(body: object): Promise<void> {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID
  const token = process.env.META_WA_TOKEN

  if (!phoneNumberId || !token) {
    throw new Error("META_PHONE_NUMBER_ID or META_WA_TOKEN env var missing")
  }

  const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Meta API ${res.status}: ${text}`)
  }
}

// Send an approved WhatsApp template message with dynamic parameters
// params: array of strings matching {{1}}, {{2}}, ... in the template body
export async function sendWhatsAppTemplate(
  phone: string,
  templateName: string,
  params: string[]
): Promise<boolean> {
  try {
    await metaPost({
      to: formatPhone(phone),
      type: "template",
      template: {
        name: templateName,
        language: { code: "en_US" },
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
  bodyParams: string[]
): Promise<boolean> {
  try {
    await metaPost({
      to: formatPhone(phone),
      type: "template",
      template: {
        name: templateName,
        language: { code: "en_US" },
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
