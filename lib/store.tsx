"use client"

import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import type {
  Role,
  User,
  Patient,
  Doctor,
  Appointment,
  Treatment,
  Invoice,
  Payment,
  TestCatalogItem,
  AuditLogEntry,
  Permission,
} from "./types"
import {
  MOCK_USERS,
  MOCK_PATIENTS,
  MOCK_DOCTORS,
  MOCK_APPOINTMENTS,
  MOCK_TREATMENTS,
  MOCK_INVOICES,
  MOCK_TEST_CATALOG,
  MOCK_AUDIT_LOG,
} from "./mock-data"
import { ROLE_PERMISSIONS } from "./constants"

interface StoreState {
  // Current user / role
  currentUser: User
  setCurrentRole: (role: Role) => void
  hasPermission: (permission: Permission) => boolean

  // Data
  patients: Patient[]
  doctors: Doctor[]
  addDoctor: (data: Omit<Doctor, "id">) => void
  appointments: Appointment[]
  treatments: Treatment[]
  invoices: Invoice[]
  testCatalog: TestCatalogItem[]
  auditLog: AuditLogEntry[]

  // Helpers
  getPatient: (id: string) => Patient | undefined
  getDoctor: (id: string) => Doctor | undefined
  getAppointment: (id: string) => Appointment | undefined
  getTreatment: (id: string) => Treatment | undefined
  getInvoice: (id: string) => Invoice | undefined
  getPatientAppointments: (patientId: string) => Appointment[]
  getPatientInvoices: (patientId: string) => Invoice[]
  getPatientTreatments: (patientId: string) => Treatment[]
  getDoctorAppointments: (doctorId: string, date?: string) => Appointment[]
  getTodayAppointments: () => Appointment[]
  getUnpaidInvoices: () => Invoice[]
  getTotalRevenue: () => number
  getTreatmentByAppointment: (appointmentId: string) => Treatment | undefined
  createTreatment: (data: Omit<Treatment, "id" | "createdAt" | "updatedAt">) => Treatment
  collectPayment: (invoiceId: string, payment: Omit<Payment, "id">) => void
}

const StoreContext = createContext<StoreState | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USERS[0])
  const [patients] = useState<Patient[]>(MOCK_PATIENTS)
  const [doctors, setDoctors] = useState<Doctor[]>(MOCK_DOCTORS)
  const [appointments] = useState<Appointment[]>(MOCK_APPOINTMENTS)
  const [treatments, setTreatments] = useState<Treatment[]>(MOCK_TREATMENTS)
  const [invoices, setInvoices] = useState<Invoice[]>(MOCK_INVOICES)
  const [testCatalog] = useState<TestCatalogItem[]>(MOCK_TEST_CATALOG)
  const [auditLog] = useState<AuditLogEntry[]>(MOCK_AUDIT_LOG)

  const setCurrentRole = useCallback((role: Role) => {
    const user = MOCK_USERS.find((u) => u.role === role)
    if (user) setCurrentUser(user)
  }, [])

  const hasPermission = useCallback(
    (permission: Permission) => {
      const rolePerm = ROLE_PERMISSIONS.find((rp) => rp.role === currentUser.role)
      return rolePerm?.permissions.includes(permission) ?? false
    },
    [currentUser.role]
  )

  const getPatient = useCallback((id: string) => patients.find((p) => p.id === id), [patients])
  const getDoctor = useCallback((id: string) => doctors.find((d) => d.id === id), [doctors])
  const getAppointment = useCallback((id: string) => appointments.find((a) => a.id === id), [appointments])
  const getTreatment = useCallback((id: string) => treatments.find((t) => t.id === id), [treatments])
  const getInvoice = useCallback((id: string) => invoices.find((i) => i.id === id), [invoices])

  const getPatientAppointments = useCallback(
    (patientId: string) => appointments.filter((a) => a.patientId === patientId),
    [appointments]
  )

  const getPatientInvoices = useCallback(
    (patientId: string) => invoices.filter((i) => i.patientId === patientId),
    [invoices]
  )

  const getPatientTreatments = useCallback(
    (patientId: string) => treatments.filter((t) => t.patientId === patientId),
    [treatments]
  )

  const getDoctorAppointments = useCallback(
    (doctorId: string, date?: string) => {
      return appointments.filter((a) => {
        const matchDoctor = a.doctorId === doctorId
        const matchDate = date ? a.date === date : true
        return matchDoctor && matchDate
      })
    },
    [appointments]
  )

  const getTodayAppointments = useCallback(() => {
    const today = "2026-02-20"
    return appointments
      .filter((a) => a.date === today && a.status !== "cancelled")
      .sort((a, b) => a.time.localeCompare(b.time))
  }, [appointments])

  const getUnpaidInvoices = useCallback(() => {
    return invoices.filter((i) => i.status === "unpaid" || i.status === "partially-paid")
  }, [invoices])

  const getTotalRevenue = useCallback(() => {
    return invoices.reduce((sum, i) => sum + i.paidAmount, 0)
  }, [invoices])

  const getTreatmentByAppointment = useCallback(
    (appointmentId: string) => treatments.find((t) => t.appointmentId === appointmentId),
    [treatments]
  )

  const createTreatment = useCallback(
    (data: Omit<Treatment, "id" | "createdAt" | "updatedAt">): Treatment => {
      const now = new Date().toISOString()
      const newTreatment: Treatment = {
        ...data,
        id: `tr${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      }
      setTreatments((prev) => [...prev, newTreatment])
      return newTreatment
    },
    []
  )

  const addDoctor = useCallback(
    (data: Omit<Doctor, "id">) => {
      const newDoctor: Doctor = { ...data, id: `d${Date.now()}` }
      setDoctors((prev) => [...prev, newDoctor])
    },
    []
  )

  const collectPayment = useCallback(
    (invoiceId: string, payment: Omit<Payment, "id">) => {
      setInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id !== invoiceId) return inv
          const newPayment: Payment = { ...payment, id: `pay${Date.now()}` }
          const newPaid = inv.paidAmount + payment.amount
          const newBalance = inv.totalAmount - newPaid
          const newStatus =
            newBalance <= 0 ? "paid" : newPaid > 0 ? "partially-paid" : "unpaid"
          return {
            ...inv,
            payments: [...inv.payments, newPayment],
            paidAmount: newPaid,
            balance: Math.max(0, newBalance),
            status: newStatus,
            updatedAt: new Date().toISOString(),
          }
        })
      )
    },
    []
  )

  return (
    <StoreContext.Provider
      value={{
        currentUser,
        setCurrentRole,
        hasPermission,
        patients,
        doctors,
        addDoctor,
        appointments,
        treatments,
        invoices,
        testCatalog,
        auditLog,
        getPatient,
        getDoctor,
        getAppointment,
        getTreatment,
        getInvoice,
        getPatientAppointments,
        getPatientInvoices,
        getPatientTreatments,
        getDoctorAppointments,
        getTodayAppointments,
        getUnpaidInvoices,
        getTotalRevenue,
        getTreatmentByAppointment,
        createTreatment,
        collectPayment,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const context = useContext(StoreContext)
  if (!context) throw new Error("useStore must be used within StoreProvider")
  return context
}
