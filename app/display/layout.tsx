import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Appointments Board — Ozone Clinic",
  description: "Live waiting-room display of today's appointments.",
}

// The display page is meant to be shown on an LCD/TV in the waiting area.
// It intentionally sits outside the (auth) and (dashboard) route groups so
// it renders without login gates and without the app sidebar/chrome. Full
// viewport, no distractions.
export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
