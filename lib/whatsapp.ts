/**
 * WAWP WhatsApp API helper (wawp.net)
 * Requires env vars: WAWP_API_URL, WAWP_INSTANCE_ID, WAWP_ACCESS_TOKEN
 */

// Format phone to WAWP chatId (e.g. 03001234567 -> 923001234567@c.us)
export function formatChatId(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  const withCountry = digits.startsWith("0") ? "92" + digits.slice(1) : digits
  return `${withCountry}@c.us`
}

// Send a plain text WhatsApp message
export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  try {
    const url = new URL(process.env.WAWP_API_URL!)
    url.searchParams.set("instance_id", process.env.WAWP_INSTANCE_ID!)
    url.searchParams.set("access_token", process.env.WAWP_ACCESS_TOKEN!)
    url.searchParams.set("chatId", formatChatId(phone))
    url.searchParams.set("message", message)

    const res = await fetch(url.toString(), { method: "POST" })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error(`[WhatsApp] Text send failed (${res.status}):`, body)
    }
    return res.ok
  } catch (err) {
    console.error("[WhatsApp] Text send exception:", err)
    return false
  }
}

// Send a WhatsApp message with a JPEG image attachment (base64 encoded).
// Uses JSON body with nested file object as documented at docs.wawp.net/send-messages
// Endpoint: /wp-json/awp/v1/sendMessage
export async function sendWhatsAppWithImage(
  phone: string,
  caption: string,
  imageBase64: string,
  filename = "receipt.jpg"
): Promise<boolean> {
  try {
    const body = {
      instance_id: process.env.WAWP_INSTANCE_ID!,
      access_token: process.env.WAWP_ACCESS_TOKEN!,
      chatId: formatChatId(phone),
      text: caption,
      file: {
        data: imageBase64,
        filename,
        mimetype: "image/jpeg",
      },
    }

    const res = await fetch(process.env.WAWP_IMAGE_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const resBody = await res.text().catch(() => "")
      console.error(`[WhatsApp] Image send failed (${res.status}):`, resBody)
    }
    return res.ok
  } catch (err) {
    console.error("[WhatsApp] Image send exception:", err)
    return false
  }
}

// Backwards-compat alias used in existing routes
export const sendWhatsAppWithPDF = sendWhatsAppWithImage
