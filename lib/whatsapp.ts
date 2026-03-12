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
