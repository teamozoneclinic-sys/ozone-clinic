// ============================================================
// Clinic Management System - Core Type Definitions
// ============================================================

export type Role = "admin" | "doctor" | "manager" | "accounts"

export interface User {
  id: string
  name: string
  role: Role
  email: string
  avatar?: string
}

export type Gender = "male" | "female" | "other"

export interface Patient {
  id: string
  name: string
  phone: string
  email?: string
  gender: Gender
  age: number
  dateOfBirth: string
  address?: string
  bloodGroup?: string
  tags: string[]
  notes: string
  assignedDoctorId: string
  medicalHistory: MedicalHistoryEntry[]
  documents: PatientDocument[]
  createdAt: string
  updatedAt: string
}

export interface MedicalHistoryEntry {
  id: string
  date: string
  type: string
  description: string
  addedBy: string
}

export interface PatientDocument {
  id: string
  name: string
  type: string
  uploadedAt: string
  uploadedBy: string
  url: string
}

export type AppointmentStatus =
  | "scheduled"
  | "checked-in"
  | "in-progress"
  | "completed"
  | "cancelled"
  | "no-show"

export interface Appointment {
  id: string
  patientId: string
  doctorId: string
  date: string
  time: string
  duration: number // minutes
  status: AppointmentStatus
  type: string
  notes: string
  receptionNotes: string
  doctorNotes: string
  invoiceId: string
  createdAt: string
  updatedAt: string
}

export type TreatmentStatus = "pending" | "in-progress" | "completed" | "follow-up-needed"

export interface Treatment {
  id: string
  patientId: string
  doctorId: string
  appointmentId: string
  date: string
  complaint: string
  clinicalNotes: string
  diagnosis: string
  prescribedInstructions: string
  testsRecommended: string[]
  doctorSummary: string
  followUpDate?: string
  attachments: string[]
  status: TreatmentStatus
  createdAt: string
  updatedAt: string
}

export type InvoiceStatus = "unpaid" | "partially-paid" | "paid" | "voided"

export interface InvoiceLineItem {
  id: string
  description: string
  category: "consultation" | "test" | "procedure" | "discount" | "waiver"
  amount: number
  quantity: number
}

export interface Invoice {
  id: string
  patientId: string
  appointmentId: string
  doctorId: string
  lineItems: InvoiceLineItem[]
  totalAmount: number
  paidAmount: number
  balance: number
  status: InvoiceStatus
  payments: Payment[]
  createdAt: string
  updatedAt: string
}

export type PaymentMethod = "cash" | "card" | "bank-transfer" | "upi" | "insurance"

export interface Payment {
  id: string
  invoiceId: string
  amount: number
  method: PaymentMethod
  reference: string
  notes: string
  collectedBy: string
  collectedAt: string
}

export interface Doctor {
  id: string
  name: string
  specialty: string
  type: string
  phone: string
  email: string
  consultationFee: number
  schedule: DoctorSchedule[]
  isActive: boolean
  avatar?: string
}

export interface DoctorSchedule {
  day: string
  startTime: string
  endTime: string
}

export interface TestCatalogItem {
  id: string
  name: string
  category: string
  price: number
  urgencyOptions: string[]
  isActive: boolean
}

export interface ClinicInfo {
  name: string
  address: string
  phone: string
  email: string
  website?: string
  logo?: string
}

export interface AppointmentDefaults {
  defaultDuration: number
  defaultCharge: number
  workingHoursStart: string
  workingHoursEnd: string
  workingDays: string[]
}

export interface AuditLogEntry {
  id: string
  userId: string
  userName: string
  userRole: Role
  action: string
  entity: string
  entityId: string
  details: string
  timestamp: string
}

export type Permission =
  | "patients.view"
  | "patients.create"
  | "patients.edit"
  | "patients.delete"
  | "appointments.view"
  | "appointments.create"
  | "appointments.edit"
  | "appointments.cancel"
  | "treatments.view"
  | "treatments.create"
  | "treatments.edit"
  | "billing.view"
  | "billing.collect"
  | "billing.void"
  | "billing.discount"
  | "reports.view"
  | "settings.view"
  | "settings.edit"
  | "audit.view"
  | "doctors.view"
  | "doctors.create"
  | "doctors.edit"

export interface RolePermissions {
  role: Role
  label: string
  description: string
  permissions: Permission[]
}
