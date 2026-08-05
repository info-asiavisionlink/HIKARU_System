// TODO: クライアント専用レイアウト（報告書閲覧用ナビ）の実装
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh">
      {/* TODO: クライアント向けナビゲーション */}
      <main>{children}</main>
    </div>
  )
}
