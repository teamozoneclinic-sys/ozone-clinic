import type { RolePermissions, Permission, ClinicInfo, AppointmentDefaults } from "./types"

export const APPOINTMENT_STATUSES = [
  { value: "scheduled", label: "Scheduled", color: "bg-blue-100 text-blue-800" },
  { value: "seated", label: "Seated", color: "bg-amber-100 text-amber-800" },
  { value: "checked-in", label: "Check In Now", color: "bg-purple-100 text-purple-800" },
  { value: "in-progress", label: "In Progress", color: "bg-orange-100 text-orange-800" },
  { value: "completed", label: "Completed", color: "bg-emerald-100 text-emerald-800" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800" },
  { value: "no-show", label: "No Show", color: "bg-gray-100 text-gray-800" },
] as const

export const INVOICE_STATUSES = [
  { value: "unpaid", label: "Unpaid", color: "bg-red-100 text-red-800" },
  { value: "partially-paid", label: "Partially Paid", color: "bg-amber-100 text-amber-800" },
  { value: "paid", label: "Paid", color: "bg-emerald-100 text-emerald-800" },
  { value: "voided", label: "Voided", color: "bg-gray-100 text-gray-800" },
] as const

export const TREATMENT_STATUSES = [
  { value: "pending", label: "Pending", color: "bg-amber-100 text-amber-800" },
  { value: "in-progress", label: "In Progress", color: "bg-teal-100 text-teal-800" },
  { value: "completed", label: "Completed", color: "bg-emerald-100 text-emerald-800" },
  { value: "follow-up-needed", label: "Follow-up Needed", color: "bg-blue-100 text-blue-800" },
] as const

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank-transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "insurance", label: "Insurance" },
] as const

export const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
] as const

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const

export const TEST_CATEGORIES = [
  "Blood Test",
  "Urine Test",
  "Imaging",
  "Cardiac",
  "Pathology",
  "Microbiology",
  "Biochemistry",
  "Hormonal",
] as const

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

export const ALL_PERMISSIONS: Permission[] = [
  "patients.view",
  "patients.create",
  "patients.edit",
  "patients.delete",
  "appointments.view",
  "appointments.create",
  "appointments.edit",
  "appointments.cancel",
  "treatments.view",
  "treatments.create",
  "treatments.edit",
  "billing.view",
  "billing.collect",
  "billing.void",
  "billing.discount",
  "reports.view",
  "settings.view",
  "settings.edit",
  "audit.view",
  "doctors.view",
  "doctors.create",
  "doctors.edit",
]

export const DOCTOR_TYPES = [
  { value: "consultant", label: "Consultant" },
  { value: "visiting", label: "Visiting" },
  { value: "resident", label: "Resident" },
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
] as const

export const SPECIALTIES = [
  "General Medicine",
  "Cardiology",
  "Dermatology",
  "Orthopedics",
  "Pediatrics",
  "Gynecology",
  "Neurology",
  "ENT",
  "Ophthalmology",
  "Psychiatry",
  "Oncology",
  "Urology",
  "Nephrology",
  "Endocrinology",
  "Pulmonology",
  "Gastroenterology",
  "Rheumatology",
  "Infectious Disease",
  "Radiology",
  "Pain Management",
] as const

export const ROLE_PERMISSIONS: RolePermissions[] = [
  {
    role: "admin",
    label: "Admin",
    description: "Full access to all system features and settings",
    permissions: [...ALL_PERMISSIONS],
  },
  {
    role: "doctor",
    label: "Doctor",
    description: "Clinical access for patient treatment and records",
    permissions: [
      "patients.view",
      "patients.create",
      "patients.edit",
      "appointments.view",
      "appointments.create",
      "appointments.edit",
      "appointments.cancel",
      "treatments.view",
      "treatments.create",
      "treatments.edit",
    ],
  },
  {
    role: "manager",
    label: "Manager",
    description: "Operational oversight, scheduling, and reports",
    permissions: [
      "patients.view",
      "patients.create",
      "patients.edit",
      "patients.delete",
      "appointments.view",
      "appointments.create",
      "appointments.edit",
      "appointments.cancel",
      "treatments.view",
      "billing.view",
      "billing.collect",
      "billing.void",
      "billing.discount",
      "settings.view",
      "doctors.view",
    ],
  },
  {
    role: "accounts",
    label: "Accounts",
    description: "Billing and payment collection",
    permissions: [
      "patients.view",
      "appointments.view",
      "billing.view",
      "billing.collect",
    ],
  },
  {
    role: "receptionist",
    label: "Receptionist",
    description: "Front desk — patient registration, appointment scheduling and billing",
    permissions: [
      "patients.view",
      "patients.create",
      "patients.edit",
      "appointments.view",
      "appointments.create",
      "appointments.edit",
      "appointments.cancel",
      "treatments.view",
      "billing.view",
      "billing.discount",
      "reports.view",
    ],
  },
]

export const DEFAULT_CLINIC_INFO: ClinicInfo = {
  name: "HealthCare Clinic",
  address: "123 Medical Drive, Suite 100, Healthcare City, HC 10001",
  phone: "+1 (555) 123-4567",
  email: "info@healthcareclinic.com",
  website: "https://healthcareclinic.com",
}

export const DEFAULT_APPOINTMENT_SETTINGS: AppointmentDefaults = {
  defaultDuration: 30,
  defaultCharge: 150,
  workingHoursStart: "09:00",
  workingHoursEnd: "18:00",
  workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
}
