import { WorkerLayout } from '@/components/layouts/WorkerLayout'

// チャット画面ではBottomNavを非表示にする（入力欄と干渉するため）
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <WorkerLayout hideBottomNav>{children}</WorkerLayout>
}
