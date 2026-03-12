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
// Uses application/x-www-form-urlencoded so the WordPress REST API on WAWP
// correctly parses bracket-notation keys: file[data], file[filename], etc.
export async function sendWhatsAppWithImage(
  phone: string,
  caption: string,
  imageBase64: string,
  filename = "receipt.jpg"
): Promise<boolean> {
  try {
    const params = new URLSearchParams()
    params.set("instance_id", process.env.WAWP_INSTANCE_ID!)
    params.set("access_token", process.env.WAWP_ACCESS_TOKEN!)
    params.set("chatId", formatChatId(phone))
    params.set("text", caption)
    params.set("file[data]", imageBase64)
    params.set("file[filename]", filename)
    params.set("file[mimetype]", "image/jpeg")

    const res = await fetch(process.env.WAWP_API_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error(`[WhatsApp] Image send failed (${res.status}):`, body)
    }
    return res.ok
  } catch (err) {
    console.error("[WhatsApp] Image send exception:", err)
    return false
  }
}

// Backwards-compat alias used in existing routes
export const sendWhatsAppWithPDF = sendWhatsAppWithImage
