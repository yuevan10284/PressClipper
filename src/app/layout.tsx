import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const openRunde = localFont({
  src: [
    {
      path: './fonts/OpenRunde-Regular.woff',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/OpenRunde-Medium.woff',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/OpenRunde-Semibold.woff',
      weight: '600',
      style: 'normal',
    },
    {
      path: './fonts/OpenRunde-Bold.woff',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-open-runde',
})

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'PressClipper - Media Monitoring',
  description: 'Monitor your media coverage with PressClipper',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${openRunde.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
