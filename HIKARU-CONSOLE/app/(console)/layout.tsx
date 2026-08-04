import { ConsoleLayout } from '@/components/layouts/ConsoleLayout'

export default function ConsoleRouteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ConsoleLayout>{children}</ConsoleLayout>
}
