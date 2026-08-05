import { WorkerLayout } from '@/components/layouts/WorkerLayout'

export default function WorkerRouteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <WorkerLayout>{children}</WorkerLayout>
}
