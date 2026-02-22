/**
 * Pakistan Standard Time (PKT) = UTC+5
 * Timezone: Asia/Karachi
 */

/** Returns current date as "YYYY-MM-DD" in PKT */
export function getPKTDateString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" })
}

/**
 * Converts a Date object to "YYYY-MM-DD" in PKT.
 * Use this instead of d.toISOString().split("T")[0] to avoid UTC offset issues.
 */
export function toPKTDateString(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" })
}

/** Formats a date string for display using PKT */
export function formatPKTDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { timeZone: "Asia/Karachi", ...options })
}
