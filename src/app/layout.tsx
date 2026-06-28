import type { Metadata } from 'next'
import { DM_Serif_Display, Inter } from 'next/font/google'
import '@/styles/globals.css'

const dmSerifDisplay = DM_Serif_Display({
  weight: ['400'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-display-var',
  display: 'swap',
})
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body-var',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'CogniPrep — AI-Powered Exam Preparation',
    template: '%s | CogniPrep',
  },
  description:
    'Adaptive exam preparation powered by AI. Personalized diagnostics, spaced repetition, and Socratic tutoring for any exam worldwide.',
  metadataBase: new URL(
    process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'
  ),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${dmSerifDisplay.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  )
}
