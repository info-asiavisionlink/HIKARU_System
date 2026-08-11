'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronLeft, Zap, RefreshCw, Hotel } from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'

const TYPES = [
  {
    href: '/sales/new/spot',
    icon: Zap,
    label: '単発案件',
    desc: '1回限りの清掃・作業案件',
    color: GOLD,
  },
  {
    href: '/sales/new/recurring',
    icon: RefreshCw,
    label: '定期案件',
    desc: '週次・月次など定期的な清掃案件',
    color: 'oklch(0.85 0.18 198)',
  },
  {
    href: '/sales/new/hotel',
    icon: Hotel,
    label: 'ホテル案件',
    desc: '客室・共用部の日常清掃案件',
    color: 'oklch(0.75 0.15 290)',
  },
]

export default function NewProposalSelectPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/sales" className="p-1.5 rounded-lg" style={{ color: `${GOLD}80` }}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'oklch(0.92 0.008 75)' }}>案件提案</h1>
          <p className="text-xs mt-0.5" style={{ color: 'oklch(0.50 0.007 75)' }}>案件の種別を選択してください</p>
        </div>
      </div>

      <div className="space-y-3">
        {TYPES.map(({ href, icon: Icon, label, desc, color }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-2xl p-5 transition-all active:scale-[0.98]"
            style={{ background: 'oklch(0.09 0.005 255 / 0.85)', border: `1px solid ${color}25` }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
              style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
              <Icon className="h-6 w-6" style={{ color }} />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: 'oklch(0.90 0.008 75)' }}>{label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'oklch(0.55 0.007 75)' }}>{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
