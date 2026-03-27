import { Heart, Shield, Lock, Eye, Database, UserCheck, Mail, Phone } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "Privacy Policy — Ozone Hospital",
  description: "How Ozone Hospital collects, uses, and protects your personal and medical information.",
}

export default function PrivacyPolicyPage() {
  const lastUpdated = "March 27, 2026"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow">
              <Heart className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900 leading-tight">Ozone Hospital</p>
              <p className="text-xs text-slate-500">Healthcare Management System</p>
            </div>
          </div>
          <Link
            href="/login"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            ← Back to Login
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-blue-600 text-white py-14 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
              <Shield className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-3">Privacy Policy</h1>
          <p className="text-blue-100 text-base max-w-xl mx-auto">
            Your privacy and the security of your medical information are our highest priority.
          </p>
          <p className="text-blue-200 text-sm mt-3">Last updated: {lastUpdated}</p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">

        {/* Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Lock, title: "Fully Encrypted", desc: "All data is encrypted at rest and in transit using industry-standard protocols." },
            { icon: Eye, title: "Never Sold", desc: "Your personal and medical data is never sold, rented, or shared with third parties." },
            { icon: UserCheck, title: "You're in Control", desc: "You have the right to access, update, or request deletion of your data at any time." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 mb-3">
                <Icon className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
              <p className="text-sm text-slate-500">{desc}</p>
            </div>
          ))}
        </div>

        {/* Sections */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">

          <Section title="1. Information We Collect">
            <p>We collect the following types of information solely for the purpose of providing healthcare services:</p>
            <ul>
              <li><strong>Personal Identification:</strong> Full name, date of birth, gender, national ID, contact number, and address.</li>
              <li><strong>Medical Information:</strong> Diagnoses, treatment records, prescriptions, lab results, appointment history, and follow-up schedules.</li>
              <li><strong>Billing Information:</strong> Invoice records, payment history, and payment method details.</li>
              <li><strong>Communication Data:</strong> WhatsApp notifications and SMS alerts sent for appointment reminders and payment receipts.</li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>Your information is used exclusively for:</p>
            <ul>
              <li>Providing and managing medical care and treatment.</li>
              <li>Scheduling and confirming appointments.</li>
              <li>Sending payment receipts and follow-up reminders via WhatsApp.</li>
              <li>Maintaining accurate medical and billing records.</li>
              <li>Improving the quality of our healthcare services.</li>
              <li>Complying with legal and regulatory healthcare obligations.</li>
            </ul>
          </Section>

          <Section title="3. Data Protection & Security">
            <p>We implement strict technical and organizational measures to protect your data:</p>
            <ul>
              <li>All data is stored in encrypted, access-controlled databases hosted on secure cloud infrastructure.</li>
              <li>Data transmission is protected using TLS/SSL encryption.</li>
              <li>Access to patient records is restricted to authorized hospital staff only.</li>
              <li>Regular security audits and access reviews are conducted.</li>
              <li>Staff are trained on data privacy and confidentiality obligations.</li>
            </ul>
          </Section>

          <Section title="4. Data Sharing Policy">
            <p className="font-semibold text-slate-800">We do NOT sell, rent, trade, or share your personal or medical information with any third party for commercial purposes.</p>
            <p className="mt-2">Limited data sharing may occur only in the following circumstances:</p>
            <ul>
              <li><strong>Referrals:</strong> When referring you to another healthcare provider, only medically relevant information is shared with your consent.</li>
              <li><strong>Legal Obligations:</strong> When required by applicable law, court order, or regulatory authority.</li>
              <li><strong>Emergency Situations:</strong> In life-threatening situations where sharing information is necessary to protect your health or safety.</li>
            </ul>
            <p className="mt-2 font-medium text-blue-700">Your data is never shared with advertisers, data brokers, or any commercial entities.</p>
          </Section>

          <Section title="5. WhatsApp Communications">
            <p>We use WhatsApp Business API (provided by Meta) to send you:</p>
            <ul>
              <li>Payment receipts after a transaction is completed.</li>
              <li>Follow-up appointment reminders.</li>
              <li>Registration confirmation upon enrollment.</li>
            </ul>
            <p className="mt-2">Your phone number is used solely for these clinical communications. We do not send marketing messages. You may request to opt out of WhatsApp notifications at any time by contacting us.</p>
          </Section>

          <Section title="6. Data Retention">
            <p>We retain your medical and personal records for as long as required by healthcare regulations and for the purpose of providing continuity of care. Billing records are retained for a minimum of 5 years as required by financial regulations.</p>
            <p className="mt-2">Temporary files (such as PDF receipts generated for WhatsApp delivery) are automatically deleted from our systems within 1 hour of generation.</p>
          </Section>

          <Section title="7. Your Rights">
            <p>You have the following rights regarding your personal data:</p>
            <ul>
              <li><strong>Right to Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Right to Correction:</strong> Request correction of inaccurate or incomplete information.</li>
              <li><strong>Right to Deletion:</strong> Request deletion of your data where it is no longer necessary for us to retain it.</li>
              <li><strong>Right to Restriction:</strong> Request that we restrict the processing of your data in certain circumstances.</li>
              <li><strong>Right to Withdraw Consent:</strong> Withdraw consent for communications such as WhatsApp notifications at any time.</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, please contact us using the details provided below.</p>
          </Section>

          <Section title="8. Cookies & System Access">
            <p>Our management system uses secure session tokens (JWT) stored in your browser to maintain your login session. These are not used for tracking or advertising purposes. No third-party tracking cookies are used within the hospital management portal.</p>
          </Section>

          <Section title="9. Children's Privacy">
            <p>We provide healthcare services to patients of all ages. For patients under the age of 18, medical records and personal information are managed under the authority of a parent or legal guardian. We take additional care to protect the privacy of minor patients.</p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>We may update this Privacy Policy periodically to reflect changes in our practices or legal requirements. Any significant changes will be communicated through our system or at our reception desk. The date of the most recent revision is displayed at the top of this page.</p>
          </Section>

        </div>

        {/* Contact */}
        <div className="bg-blue-600 rounded-2xl p-8 text-white">
          <div className="flex items-center gap-3 mb-4">
            <Database className="h-6 w-6 text-blue-200" />
            <h2 className="text-xl font-bold">Contact Our Data Protection Officer</h2>
          </div>
          <p className="text-blue-100 mb-6 text-sm">
            If you have any questions, concerns, or requests regarding this Privacy Policy or how we handle your data, please contact us:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
              <Mail className="h-5 w-5 text-blue-200 shrink-0" />
              <div>
                <p className="text-xs text-blue-200">Email</p>
                <p className="text-sm font-medium">privacy@ozonehospital.com</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
              <Phone className="h-5 w-5 text-blue-200 shrink-0" />
              <div>
                <p className="text-xs text-blue-200">Phone</p>
                <p className="text-sm font-medium">+92 300 1583655</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-slate-400 pb-6">
          <p>© {new Date().getFullYear()} Ozone Hospital. All rights reserved.</p>
          <p className="mt-1">This policy is effective as of {lastUpdated}.</p>
        </div>

      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-8 py-7">
      <h2 className="text-base font-bold text-slate-900 mb-3">{title}</h2>
      <div className="text-sm text-slate-600 space-y-2 [&_ul]:mt-2 [&_ul]:space-y-1.5 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </div>
  )
}
