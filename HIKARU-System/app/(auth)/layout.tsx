export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-12 relative">
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 50% 0%, oklch(0.73 0.12 78 / 0.08) 0%, transparent 50%),
            radial-gradient(ellipse 40% 35% at 80% 90%, oklch(0.60 0.28 260 / 0.05) 0%, transparent 50%)
          `,
        }}
      />
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true"
        style={{
          backgroundImage: `radial-gradient(circle, oklch(0.73 0.12 78 / 0.06) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      <div className="w-full max-w-sm relative">{children}</div>
    </div>
  )
}
