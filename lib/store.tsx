"use client"

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
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
import { ROLE_PERMISSIONS } from "./constants"

// ─── helpers ────────────────────────────────────────────────────────────────

async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

// ─── Store interface ─────────────────────────────────────────────────────────

interface StoreState {
  // Auth
  currentUser: User | null
  isLoading: boolean
  hasPermission: (permission: Permission) => boolean
  setCurrentRole: (role: Role) => void // legacy compat

  // Data
  patients: Patient[]
  doctors: Doctor[]
  appointments: Appointment[]
  treatments: Treatment[]
  invoices: Invoice[]
  testCatalog: TestCatalogItem[]
  auditLog: AuditLogEntry[]

  // Mutations
  addPatient: (data: Omit<Patient, "id" | "createdAt" | "updatedAt" | "medicalHistory" | "documents">) => Promise<void>
  updatePatient: (id: string, data: Partial<Patient>) => Promise<void>
  deletePatient: (id: string) => Promise<void>
  deleteTestCatalogItem: (id: string) => Promise<void>
  addDoctor: (data: Omit<Doctor, "id">) => Promise<void>
  addAppointment: (data: {
    patientId: string
    doctorId: string
    date: string
    time: string
    duration: number
    type: string
    notes: string
    status?: string
  }) => Promise<void>
  collectPayment: (invoiceId: string, payment: Omit<Payment, "id">) => Promise<void>
  createTreatment: (data: Omit<Treatment, "id" | "createdAt" | "updatedAt">) => Promise<Treatment>
  updateAppointmentStatus: (appointmentId: string, status: Appointment["status"]) => Promise<void>
  refetch: () => Promise<void>

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
}

const StoreContext = createContext<StoreState | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [testCatalog, setTestCatalog] = useState<TestCatalogItem[]>([])
  const [auditLog] = useState<AuditLogEntry[]>([])

  // ── Fetch all data ────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const [meRes, patientsRes, doctorsRes, appointmentsRes, treatmentsRes, invoicesRes, catalogRes] =
        await Promise.all([
          apiFetch<{ user: User }>("/api/auth/me"),
          apiFetch<{ data: Patient[] }>("/api/patients"),
          apiFetch<{ data: Doctor[] }>("/api/doctors"),
          apiFetch<{ data: Appointment[] }>("/api/appointments"),
          apiFetch<{ data: Treatment[] }>("/api/treatments"),
          apiFetch<{ data: Invoice[] }>("/api/invoices"),
          apiFetch<{ data: TestCatalogItem[] }>("/api/catalog"),
        ])
      setCurrentUser(meRes.user)
      setPatients(patientsRes.data)
      setDoctors(doctorsRes.data)
      setAppointments(appointmentsRes.data)
      setTreatments(treatmentsRes.data)
      setInvoices(invoicesRes.data)
      setTestCatalog(catalogRes.data)
    } catch (err) {
      console.error("Store fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── Permissions ───────────────────────────────────────────────────────
  const hasPermission = useCallback(
    (permission: Permission) => {
      if (!currentUser) return false
      const rolePerm = ROLE_PERMISSIONS.find((rp) => rp.role === currentUser.role)
      return rolePerm?.permissions.includes(permission) ?? false
    },
    [currentUser]
  )

  // Legacy compat — role comes from JWT; kept so RoleSwitcher compiles
  const setCurrentRole = useCallback((_role: Role) => {}, [])

  // ── Mutations ─────────────────────────────────────────────────────────

  const addPatient = useCallback(
    async (data: Omit<Patient, "id" | "createdAt" | "updatedAt" | "medicalHistory" | "documents">) => {
      const res = await apiFetch<{ data: Patient }>("/api/patients", {
        method: "POST",
        body: JSON.stringify({ ...data, medicalHistory: [], documents: [] }),
      })
      setPatients((prev) => [res.data, ...prev])
    },
    []
  )

  const updatePatient = useCallback(async (id: string, data: Partial<Patient>) => {
    const res = await apiFetch<{ data: Patient }>(`/api/patients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
    setPatients((prev) => prev.map((p) => (p.id === id ? res.data : p)))
  }, [])

  const deletePatient = useCallback(async (id: string) => {
    await apiFetch(`/api/patients/${id}`, { method: "DELETE" })
    setPatients((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const deleteTestCatalogItem = useCallback(async (id: string) => {
    await apiFetch(`/api/catalog/${id}`, { method: "DELETE" })
    setTestCatalog((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addDoctor = useCallback(async (data: Omit<Doctor, "id">) => {
    const res = await apiFetch<{ data: Doctor }>("/api/doctors", {
      method: "POST",
      body: JSON.stringify(data),
    })
    setDoctors((prev) => [...prev, res.data])
  }, [])

  const addAppointment = useCallback(
    async (data: {
      patientId: string
      doctorId: string
      date: string
      time: string
      duration: number
      type: string
      notes: string
      status?: string
    }) => {
      const res = await apiFetch<{ data: Appointment }>("/api/appointments", {
        method: "POST",
        body: JSON.stringify(data),
      })
      setAppointments((prev) => [res.data, ...prev])
      // Refresh invoices to capture the auto-created one
      const invRes = await apiFetch<{ data: Invoice[] }>("/api/invoices")
      setInvoices(invRes.data)
    },
    []
  )

  const collectPayment = useCallback(
    async (invoiceId: string, payment: Omit<Payment, "id">) => {
      const res = await apiFetch<{ data: Invoice }>(`/api/invoices/${invoiceId}/payment`, {
        method: "POST",
        body: JSON.stringify(payment),
      })
      setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? res.data : inv)))
    },
    []
  )

  const createTreatment = useCallback(
    async (data: Omit<Treatment, "id" | "createdAt" | "updatedAt">): Promise<Treatment> => {
      const res = await apiFetch<{ data: Treatment }>("/api/treatments", {
        method: "POST",
        body: JSON.stringify(data),
      })
      setTreatments((prev) => [res.data, ...prev])
      return res.data
    },
    []
  )

  const updateAppointmentStatus = useCallback(
    async (appointmentId: string, status: Appointment["status"]) => {
      const res = await apiFetch<{ data: Appointment }>(`/api/appointments/${appointmentId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      })
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? res.data : a)))
    },
    []
  )

  // ── Helpers ───────────────────────────────────────────────────────────

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
    (doctorId: string, date?: string) =>
      appointments.filter((a) => {
        const matchDoctor = a.doctorId === doctorId
        const matchDate = date ? a.date === date : true
        return matchDoctor && matchDate
      }),
    [appointments]
  )

  const getTodayAppointments = useCallback(() => {
    const today = new Date().toISOString().split("T")[0]
    return appointments
      .filter((a) => a.date === today && a.status !== "cancelled")
      .sort((a, b) => a.time.localeCompare(b.time))
  }, [appointments])

  const getUnpaidInvoices = useCallback(
    () => invoices.filter((i) => i.status === "unpaid" || i.status === "partially-paid"),
    [invoices]
  )

  const getTotalRevenue = useCallback(
    () => invoices.reduce((sum, i) => sum + i.paidAmount, 0),
    [invoices]
  )

  const getTreatmentByAppointment = useCallback(
    (appointmentId: string) => treatments.find((t) => t.appointmentId === appointmentId),
    [treatments]
  )

  return (
    <StoreContext.Provider
      value={{
        currentUser,
        isLoading,
        hasPermission,
        setCurrentRole,
        patients,
        doctors,
        appointments,
        treatments,
        invoices,
        testCatalog,
        auditLog,
        addPatient,
        updatePatient,
        deletePatient,
        deleteTestCatalogItem,
        addDoctor,
        addAppointment,
        collectPayment,
        createTreatment,
        updateAppointmentStatus,
        refetch: fetchAll,
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
