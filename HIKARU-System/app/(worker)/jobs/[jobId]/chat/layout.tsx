// チャット画面レイアウト
// WorkerLayoutは(worker)/layout.tsxで既に適用済みのため、ここでは不要。
// 二重マウントするとSystemVoiceProviderが二重に起動しRealtimeSessionが競合する。
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
