/**
 * WhatsApp Cloud API (Meta) helper
 * Requires env vars: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN
 */

const GRAPH_BASE = "https://graph.facebook.com/v21.0"

/**
 * Normalise a Pakistani phone number to the WhatsApp format (no +, country code prefix).
 * Handles: "0300-1234567", "+923001234567", "923001234567", "03001234567"
 */
export function cleanPhone(raw: string): string {
  let p = raw.replace(/[\s\-().]/g, "")
  if (p.startsWith("+")) p = p.slice(1)
  if (p.startsWith("0")) p = "92" + p.slice(1)
  return p
}

/**
 * Send a WhatsApp template message via Meta Cloud API.
 * `params` maps 1-to-1 to the {{1}}, {{2}}, ... placeholders in the template body.
 * Throws if the API returns a non-2xx status — callers should .catch() to keep it non-blocking.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  params: string[]
): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp credentials not configured (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN)")
  }

  const body = {
    messaging_product: "whatsapp",
    to: cleanPhone(to),
    type: "template",
    template: {
      name: templateName,
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: params.map((text) => ({ type: "text", text: String(text) })),
        },
      ],
    },
  }

  const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      `WhatsApp API error ${res.status}: ${JSON.stringify(err)}`
    )
  }
}
