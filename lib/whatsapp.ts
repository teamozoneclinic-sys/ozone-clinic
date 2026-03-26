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

// Send a plain text WhatsApp message
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
