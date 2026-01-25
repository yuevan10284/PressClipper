// Force dynamic rendering for auth routes
export const dynamic = 'force-dynamic'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
