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
    return res.ok
  } catch {
    return false
  }
}

// Send a WhatsApp message with a file attachment (base64 encoded)
export async function sendWhatsAppWithPDF(
  phone: string,
  caption: string,
  fileBase64: string,
  filename: string,
  mimetype = "image/jpeg"
): Promise<boolean> {
  try {
    const formData = new FormData()
    formData.append("instance_id", process.env.WAWP_INSTANCE_ID!)
    formData.append("access_token", process.env.WAWP_ACCESS_TOKEN!)
    formData.append("chatId", formatChatId(phone))
    formData.append("text", caption)
    formData.append("file[data]", fileBase64)
    formData.append("file[filename]", filename)
    formData.append("file[mimetype]", mimetype)

    const res = await fetch(process.env.WAWP_API_URL!, { method: "POST", body: formData })
    return res.ok
  } catch {
    return false
  }
}
