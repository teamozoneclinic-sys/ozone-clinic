import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** The single email domain every staff/user account must use. */
export const CLINIC_EMAIL_DOMAIN = "ozoneclinic.com"

/**
 * Force an email onto the clinic domain — keeps the local part, swaps the
 * domain. Returns "" when no usable local part can be derived.
 */
export function toClinicEmail(email: string): string {
  const local = String(email ?? "").split("@")[0].trim().toLowerCase()
  return local ? `${local}@${CLINIC_EMAIL_DOMAIN}` : ""
}

/** Calculate age in full years from an ISO date string (YYYY-MM-DD). Returns 0 if dob is empty. */
export function calcAge(dob: string): number {
  if (!dob) return 0
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return Math.max(0, age)
}

/**
 * Derive an approximate ISO date of birth (YYYY-MM-DD) for a patient who is
 * `age` years old today. Used when only the age is captured at registration —
 * storing this anchor date lets `calcAge` keep the displayed age correct as
 * years pass, so the patient ages up automatically on the anniversary.
 */
export function ageToDOB(age: number): string {
  const years = Math.max(0, Math.floor(Number(age) || 0))
  const today = new Date()
  const dob = new Date(today.getFullYear() - years, today.getMonth(), today.getDate())
  const y = dob.getFullYear()
  const m = String(dob.getMonth() + 1).padStart(2, "0")
  const d = String(dob.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
