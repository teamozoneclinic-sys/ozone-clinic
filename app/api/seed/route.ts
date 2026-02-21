import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/mongodb"
import User from "@/lib/models/User"
import Doctor from "@/lib/models/Doctor"
import Patient from "@/lib/models/Patient"
import Appointment from "@/lib/models/Appointment"
import Treatment from "@/lib/models/Treatment"
import Invoice from "@/lib/models/Invoice"
import TestCatalog from "@/lib/models/TestCatalog"

export async function POST() {
  try {
    await connectDB()

    // ── Clear existing data ──────────────────────────────────────────────
    await Promise.all([
      User.deleteMany({}),
      Doctor.deleteMany({}),
      Patient.deleteMany({}),
      Appointment.deleteMany({}),
      Treatment.deleteMany({}),
      Invoice.deleteMany({}),
      TestCatalog.deleteMany({}),
    ])

    // ── Doctors ───────────────────────────────────────────────────────────
    const [d1, d2, d3, d4] = await Doctor.insertMany([
      {
        name: "Dr. Sarah Chen",
        specialty: "General Medicine",
        type: "full-time",
        phone: "0300-1230001",
        email: "sarah@clinic.com",
        consultationFee: 1500,
        schedule: [
          { day: "Monday", startTime: "09:00", endTime: "17:00" },
          { day: "Tuesday", startTime: "09:00", endTime: "17:00" },
          { day: "Wednesday", startTime: "09:00", endTime: "13:00" },
          { day: "Thursday", startTime: "09:00", endTime: "17:00" },
          { day: "Friday", startTime: "09:00", endTime: "17:00" },
        ],
        isActive: true,
      },
      {
        name: "Dr. Michael Park",
        specialty: "Cardiology",
        type: "consultant",
        phone: "0321-1230002",
        email: "michael@clinic.com",
        consultationFee: 2500,
        schedule: [
          { day: "Monday", startTime: "10:00", endTime: "18:00" },
          { day: "Wednesday", startTime: "10:00", endTime: "18:00" },
          { day: "Friday", startTime: "10:00", endTime: "16:00" },
        ],
        isActive: true,
      },
      {
        name: "Dr. Lisa Patel",
        specialty: "Dermatology",
        type: "visiting",
        phone: "0333-1230003",
        email: "lisa@clinic.com",
        consultationFee: 2000,
        schedule: [
          { day: "Tuesday", startTime: "09:00", endTime: "17:00" },
          { day: "Thursday", startTime: "09:00", endTime: "17:00" },
          { day: "Saturday", startTime: "09:00", endTime: "13:00" },
        ],
        isActive: true,
      },
      {
        name: "Dr. James Rodriguez",
        specialty: "Orthopedics",
        type: "consultant",
        phone: "0311-1230004",
        email: "james.r@clinic.com",
        consultationFee: 3000,
        schedule: [
          { day: "Monday", startTime: "08:00", endTime: "16:00" },
          { day: "Wednesday", startTime: "08:00", endTime: "16:00" },
          { day: "Thursday", startTime: "08:00", endTime: "16:00" },
        ],
        isActive: true,
      },
    ])

    // ── Users (use create() so the pre-save bcrypt hook runs) ────────────
    const hash = (pw: string) => bcrypt.hash(pw, 12)
    await User.insertMany([
      { name: "Dr. Admin",      email: "admin@clinic.com",    password: await hash("admin123"),    role: "admin",    isActive: true },
      { name: "Dr. Sarah Chen", email: "sarah@clinic.com",    password: await hash("doctor123"),   role: "doctor",   doctorId: d1._id.toString(), isActive: true },
      { name: "James Wilson",   email: "manager@clinic.com",  password: await hash("manager123"),  role: "manager",  isActive: true },
      { name: "Emily Davis",    email: "accounts@clinic.com", password: await hash("accounts123"), role: "accounts", isActive: true },
    ])

    // ── Patients ──────────────────────────────────────────────────────────
    const [p1, p2, p3, p4, p5, p6, p7, p8] = await Patient.insertMany([
      {
        name: "Alice Johnson",
        phone: "0300-1234001",
        email: "alice.j@email.com",
        gender: "female",
        age: 34,
        dateOfBirth: "1991-06-15",
        address: "456 Oak Street, Apt 2B",
        bloodGroup: "A+",
        tags: ["diabetes", "regular"],
        notes: "Allergic to penicillin. Requires insulin management.",
        assignedDoctorId: d1._id.toString(),
        medicalHistory: [
          { id: "mh1", date: "2025-01-15", type: "Diagnosis", description: "Type 2 Diabetes diagnosed. Started metformin 500mg.", addedBy: "Dr. Sarah Chen" },
          { id: "mh2", date: "2025-06-20", type: "Lab Result", description: "HbA1c: 7.2% - slightly above target.", addedBy: "Dr. Sarah Chen" },
        ],
        documents: [],
      },
      {
        name: "Robert Smith",
        phone: "0321-1234002",
        email: "robert.s@email.com",
        gender: "male",
        age: 58,
        dateOfBirth: "1967-11-28",
        address: "789 Elm Avenue",
        bloodGroup: "O+",
        tags: ["cardiac", "hypertension"],
        notes: "History of hypertension. On beta-blockers.",
        assignedDoctorId: d2._id.toString(),
        medicalHistory: [
          { id: "mh3", date: "2024-08-10", type: "Diagnosis", description: "Hypertension Stage 2. Started atenolol 50mg.", addedBy: "Dr. Michael Park" },
        ],
        documents: [],
      },
      {
        name: "Maria Garcia",
        phone: "0333-1234003",
        email: "maria.g@email.com",
        gender: "female",
        age: 27,
        dateOfBirth: "1998-03-22",
        address: "321 Pine Road, Unit 5",
        bloodGroup: "B+",
        tags: ["dermatology"],
        notes: "Sensitive skin. History of eczema.",
        assignedDoctorId: d3._id.toString(),
        medicalHistory: [],
        documents: [],
      },
      {
        name: "David Lee",
        phone: "0311-1234004",
        gender: "male",
        age: 45,
        dateOfBirth: "1980-07-08",
        address: "567 Maple Drive",
        bloodGroup: "AB+",
        tags: ["orthopedic", "sports-injury"],
        notes: "Active runner. Previous ACL surgery (2019).",
        assignedDoctorId: d4._id.toString(),
        medicalHistory: [],
        documents: [],
      },
      {
        name: "Sarah Williams",
        phone: "0345-1234005",
        email: "sarah.w@email.com",
        gender: "female",
        age: 42,
        dateOfBirth: "1983-12-03",
        bloodGroup: "A-",
        tags: ["regular", "thyroid"],
        notes: "Hypothyroidism. Annual check-ups.",
        assignedDoctorId: d1._id.toString(),
        medicalHistory: [],
        documents: [],
      },
      {
        name: "James Brown",
        phone: "0301-1234006",
        gender: "male",
        age: 65,
        dateOfBirth: "1960-09-17",
        address: "890 Cedar Lane",
        bloodGroup: "O-",
        tags: ["cardiac", "diabetes", "senior"],
        notes: "Multiple comorbidities. Requires careful medication management.",
        assignedDoctorId: d2._id.toString(),
        medicalHistory: [],
        documents: [],
      },
      {
        name: "Emma Wilson",
        phone: "0322-1234007",
        email: "emma.w@email.com",
        gender: "female",
        age: 31,
        dateOfBirth: "1994-04-25",
        bloodGroup: "B-",
        tags: ["dermatology", "cosmetic"],
        notes: "Acne treatment plan in progress.",
        assignedDoctorId: d3._id.toString(),
        medicalHistory: [],
        documents: [],
      },
      {
        name: "Thomas Anderson",
        phone: "0312-1234008",
        gender: "male",
        age: 52,
        dateOfBirth: "1973-08-14",
        address: "234 Birch Street",
        bloodGroup: "AB-",
        tags: ["orthopedic"],
        notes: "Chronic lower back pain. Physical therapy recommended.",
        assignedDoctorId: d4._id.toString(),
        medicalHistory: [],
        documents: [],
      },
    ])

    // ── Appointments (today = current date) ───────────────────────────────
    const today = new Date().toISOString().split("T")[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0]

    const [a1, a2, a3, a4, a5] = await Appointment.insertMany([
      { patientId: p1._id.toString(), doctorId: d1._id.toString(), date: today, time: "09:00", duration: 30, status: "scheduled", type: "consultation", notes: "Regular diabetes check", receptionNotes: "", doctorNotes: "", invoiceId: "" },
      { patientId: p2._id.toString(), doctorId: d2._id.toString(), date: today, time: "10:30", duration: 45, status: "checked-in", type: "follow-up", notes: "BP monitoring", receptionNotes: "", doctorNotes: "", invoiceId: "" },
      { patientId: p3._id.toString(), doctorId: d3._id.toString(), date: today, time: "11:00", duration: 30, status: "completed", type: "treatment", notes: "Eczema review", receptionNotes: "", doctorNotes: "", invoiceId: "" },
      { patientId: p4._id.toString(), doctorId: d4._id.toString(), date: yesterday, time: "09:00", duration: 60, status: "completed", type: "post-surgery", notes: "Post-ACL check", receptionNotes: "", doctorNotes: "", invoiceId: "" },
      { patientId: p5._id.toString(), doctorId: d1._id.toString(), date: tomorrow, time: "14:00", duration: 30, status: "scheduled", type: "annual-checkup", notes: "Annual thyroid check", receptionNotes: "", doctorNotes: "", invoiceId: "" },
    ])

    // ── Invoices ──────────────────────────────────────────────────────────
    const inv1 = await Invoice.create({
      patientId: p1._id.toString(),
      appointmentId: a1._id.toString(),
      doctorId: d1._id.toString(),
      lineItems: [
        { id: "li1", description: "Consultation - General Medicine", category: "consultation", amount: 1500, quantity: 1 },
      ],
      totalAmount: 1500,
      paidAmount: 0,
      balance: 1500,
      status: "unpaid",
      payments: [],
    })

    const inv2 = await Invoice.create({
      patientId: p2._id.toString(),
      appointmentId: a2._id.toString(),
      doctorId: d2._id.toString(),
      lineItems: [
        { id: "li2", description: "Consultation - Cardiology", category: "consultation", amount: 2500, quantity: 1 },
        { id: "li3", description: "ECG / EKG", category: "test", amount: 800, quantity: 1 },
      ],
      totalAmount: 3300,
      paidAmount: 1000,
      balance: 2300,
      status: "partially-paid",
      payments: [
        { id: "pay1", invoiceId: "", amount: 1000, method: "cash", reference: "", notes: "", collectedBy: "Emily Davis", collectedAt: new Date().toISOString() },
      ],
    })

    const inv3 = await Invoice.create({
      patientId: p3._id.toString(),
      appointmentId: a3._id.toString(),
      doctorId: d3._id.toString(),
      lineItems: [
        { id: "li4", description: "Consultation - Dermatology", category: "consultation", amount: 2000, quantity: 1 },
      ],
      totalAmount: 2000,
      paidAmount: 2000,
      balance: 0,
      status: "paid",
      payments: [
        { id: "pay2", invoiceId: "", amount: 2000, method: "card", reference: "TXN123", notes: "", collectedBy: "Emily Davis", collectedAt: new Date().toISOString() },
      ],
    })

    // Link invoiceIds to appointments
    await Appointment.findByIdAndUpdate(a1._id, { invoiceId: inv1._id.toString() })
    await Appointment.findByIdAndUpdate(a2._id, { invoiceId: inv2._id.toString() })
    await Appointment.findByIdAndUpdate(a3._id, { invoiceId: inv3._id.toString() })

    // ── Treatments ────────────────────────────────────────────────────────
    await Treatment.insertMany([
      {
        patientId: p3._id.toString(),
        doctorId: d3._id.toString(),
        appointmentId: a3._id.toString(),
        date: today,
        complaint: "Skin rash and itching",
        clinicalNotes: "Moderate atopic dermatitis. Dry patches on arms.",
        diagnosis: "Atopic Dermatitis - Moderate",
        prescribedInstructions: "Hydrocortisone cream 1% twice daily. Moisturise regularly.",
        testsRecommended: [],
        doctorSummary: "Patient responding to topical treatment. Follow-up in 4 weeks.",
        status: "completed",
        attachments: [],
      },
      {
        patientId: p4._id.toString(),
        doctorId: d4._id.toString(),
        appointmentId: a4._id.toString(),
        date: yesterday,
        complaint: "Post-operative knee pain",
        clinicalNotes: "ACL reconstruction site healing well. Mild swelling.",
        diagnosis: "Post-ACL Reconstruction Recovery",
        prescribedInstructions: "Continue physiotherapy. Ibuprofen 400mg PRN for pain.",
        testsRecommended: ["MRI - Right Knee"],
        doctorSummary: "Good progress. Continue PT for 6 more weeks.",
        followUpDate: tomorrow,
        status: "follow-up-needed",
        attachments: [],
      },
    ])

    // ── Test Catalog ──────────────────────────────────────────────────────
    await TestCatalog.insertMany([
      { name: "Complete Blood Count (CBC)", category: "Blood Test", price: 800, urgencyOptions: ["routine", "urgent"], isActive: true },
      { name: "Lipid Panel", category: "Blood Test", price: 1500, urgencyOptions: ["routine"], isActive: true },
      { name: "Blood Glucose (Fasting)", category: "Blood Test", price: 300, urgencyOptions: ["routine", "urgent"], isActive: true },
      { name: "HbA1c", category: "Blood Test", price: 1200, urgencyOptions: ["routine"], isActive: true },
      { name: "Thyroid Panel (TSH, T3, T4)", category: "Biochemistry", price: 2500, urgencyOptions: ["routine"], isActive: true },
      { name: "Liver Function Test (LFT)", category: "Biochemistry", price: 2000, urgencyOptions: ["routine"], isActive: true },
      { name: "Kidney Function Test (KFT)", category: "Biochemistry", price: 2000, urgencyOptions: ["routine"], isActive: true },
      { name: "Vitamin D Level", category: "Biochemistry", price: 3000, urgencyOptions: ["routine"], isActive: true },
      { name: "Urinalysis (Complete)", category: "Urine Test", price: 400, urgencyOptions: ["routine", "urgent"], isActive: true },
      { name: "Skin Biopsy", category: "Pathology", price: 5000, urgencyOptions: ["routine", "urgent"], isActive: true },
      { name: "ECG / EKG", category: "Cardiac", price: 800, urgencyOptions: ["routine", "urgent"], isActive: true },
      { name: "Chest X-Ray", category: "Imaging", price: 1500, urgencyOptions: ["routine", "urgent", "stat"], isActive: true },
      { name: "Ultrasound - Normal Abdomen", category: "Ultrasound", price: 2500, urgencyOptions: ["routine", "urgent"], isActive: true },
      { name: "Ultrasound - Obstetric (Obs)", category: "Ultrasound", price: 2500, urgencyOptions: ["routine", "urgent"], isActive: true },
      { name: "Ultrasound - Pelvic", category: "Ultrasound", price: 2500, urgencyOptions: ["routine", "urgent"], isActive: true },
      { name: "Ultrasound - Breast", category: "Ultrasound", price: 4000, urgencyOptions: ["routine"], isActive: true },
      { name: "Ultrasound - Thyroid", category: "Ultrasound", price: 4000, urgencyOptions: ["routine"], isActive: true },
      { name: "TVS (Transvaginal Scan)", category: "Ultrasound", price: 3500, urgencyOptions: ["routine", "urgent"], isActive: true },
      { name: "Doppler - Obstetric", category: "Doppler", price: 3500, urgencyOptions: ["routine", "urgent"], isActive: true },
      { name: "Doppler - Abdomen", category: "Doppler", price: 3500, urgencyOptions: ["routine", "urgent"], isActive: true },
      { name: "Doppler - Neck / Carotid", category: "Doppler", price: 4000, urgencyOptions: ["routine", "urgent"], isActive: true },
      { name: "Doppler - Both Legs", category: "Doppler", price: 7000, urgencyOptions: ["routine", "urgent"], isActive: true },
    ])

    return NextResponse.json({
      success: true,
      message: "Database seeded successfully. Login credentials: admin@clinic.com / admin123 | sarah@clinic.com / doctor123 | manager@clinic.com / manager123 | accounts@clinic.com / accounts123",
    })
  } catch (err) {
    console.error("Seed error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
