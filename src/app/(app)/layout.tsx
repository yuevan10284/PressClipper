// Force dynamic rendering for all routes in this group
export const dynamic = 'force-dynamic'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
