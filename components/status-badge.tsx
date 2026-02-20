"use client"

import { cn } from "@/lib/utils"
import {
  APPOINTMENT_STATUSES,
  INVOICE_STATUSES,
  TREATMENT_STATUSES,
} from "@/lib/constants"
import type { AppointmentStatus, InvoiceStatus, TreatmentStatus } from "@/lib/types"

const allStatuses = [
  ...APPOINTMENT_STATUSES,
  ...INVOICE_STATUSES,
  ...TREATMENT_STATUSES,
]

export function StatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus | InvoiceStatus | TreatmentStatus
  className?: string
}) {
  const config = allStatuses.find((s) => s.value === status)
  if (!config) return null

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  )
}
