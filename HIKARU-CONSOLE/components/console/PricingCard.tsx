'use client'

import * as React from 'react'
import { Card, CardContent, Input, Textarea, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@hikaru/ui'
import { DollarSign, FileText } from 'lucide-react'

/* ─── 型定義 ─── */

export interface PriceEntry {
  period_month?:  number | null
  amount_ex_tax:  number
  tax_rate:       number
  tax_amount:     number
  amount_inc_tax: number
  unit_price?:    number | null
  quantity?:      number | null
}

export interface BillingEntry {
  billing_status:      string
  quote_number:        string
  contract_date:       string
  billing_date:        string
  payment_due_date:    string
  actual_payment_date: string
  notes:               string
}

export const BILLING_STATUSES = [
  { value: 'unbilled',         label: '未請求' },
  { value: 'billed',           label: '請求済' },
  { value: 'awaiting_payment', label: '入金待ち' },
  { value: 'paid',             label: '入金済' },
  { value: 'on_hold',          label: '保留' },
  { value: 'cancelled',        label: 'キャンセル' },
]

export const TAX_RATES = [
  { value: 0.10, label: '10%（標準税率）' },
  { value: 0.08, label: '8%（軽減税率）' },
  { value: 0.00, label: '0%（非課税）' },
]

/* ─── ユーティリティ ─── */

export function calcTax(amountExTax: number, taxRate: number) {
  const taxAmount    = Math.floor(amountExTax * taxRate)
  const amountIncTax = amountExTax + taxAmount
  return { taxAmount, amountIncTax }
}

export function fmtJPY(n: number): string {
  return n.toLocaleString('ja-JP') + '円'
}

export function emptyBilling(): BillingEntry {
  return {
    billing_status: 'unbilled', quote_number: '', contract_date: '',
    billing_date: '', payment_due_date: '', actual_payment_date: '', notes: '',
  }
}

export function emptyPrice(taxRate = 0.10): PriceEntry {
  return { amount_ex_tax: 0, tax_rate: taxRate, tax_amount: 0, amount_inc_tax: 0 }
}

/* ─── 請求情報カード（共通） ─── */

interface BillingCardProps {
  value: BillingEntry
  onChange: (v: BillingEntry) => void
}

export function BillingInfoCard({ value, onChange }: BillingCardProps) {
  function upd(k: keyof BillingEntry, v: string) { onChange({ ...value, [k]: v }) }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
          <FileText className="h-4 w-4" /> 請求情報
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">請求状況</label>
            <Select value={value.billing_status} onValueChange={(v) => upd('billing_status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BILLING_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input label="見積番号" value={value.quote_number} onChange={(e) => upd('quote_number', e.target.value)} placeholder="M-2026-001" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="契約日"     type="date" value={value.contract_date}       onChange={(e) => upd('contract_date', e.target.value)} />
          <Input label="請求予定日" type="date" value={value.billing_date}        onChange={(e) => upd('billing_date', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="入金予定日" type="date" value={value.payment_due_date}    onChange={(e) => upd('payment_due_date', e.target.value)} />
          <Input label="入金日"     type="date" value={value.actual_payment_date} onChange={(e) => upd('actual_payment_date', e.target.value)} />
        </div>
        <Textarea label="備考" value={value.notes} onChange={(e) => upd('notes', e.target.value)} rows={2} />
      </CardContent>
    </Card>
  )
}

/* ─── 単発/ホテル 単価カード ─── */

interface SinglePriceCardProps {
  value: PriceEntry
  onChange: (v: PriceEntry) => void
  title?: string
  hotelMode?: boolean          // ホテル: unit_price × quantity を表示
  totalRooms?: number          // ホテル: フロア合計部屋数
}

export function SinglePriceCard({ value, onChange, title = '金額', hotelMode = false, totalRooms }: SinglePriceCardProps) {
  function handleExTax(raw: string) {
    const ex = parseInt(raw.replace(/,/g, ''), 10) || 0
    const { taxAmount, amountIncTax } = calcTax(ex, value.tax_rate)
    onChange({ ...value, amount_ex_tax: ex, tax_amount: taxAmount, amount_inc_tax: amountIncTax })
  }

  function handleUnitPrice(raw: string) {
    const unit = parseInt(raw.replace(/,/g, ''), 10) || 0
    const qty  = value.quantity ?? totalRooms ?? 0
    const ex   = unit * qty
    const { taxAmount, amountIncTax } = calcTax(ex, value.tax_rate)
    onChange({ ...value, unit_price: unit, amount_ex_tax: ex, tax_amount: taxAmount, amount_inc_tax: amountIncTax })
  }

  function handleQty(raw: string) {
    const qty  = parseInt(raw, 10) || 0
    const unit = value.unit_price ?? 0
    const ex   = unit * qty
    const { taxAmount, amountIncTax } = calcTax(ex, value.tax_rate)
    onChange({ ...value, quantity: qty, amount_ex_tax: ex, tax_amount: taxAmount, amount_inc_tax: amountIncTax })
  }

  function handleTaxRate(raw: string) {
    const rate = parseFloat(raw)
    const { taxAmount, amountIncTax } = calcTax(value.amount_ex_tax, rate)
    onChange({ ...value, tax_rate: rate, tax_amount: taxAmount, amount_inc_tax: amountIncTax })
  }

  const gold = 'oklch(0.73 0.12 78)'

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> {title}
        </h2>

        {hotelMode && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">1室単価（税抜）</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={value.unit_price ? value.unit_price.toLocaleString('ja-JP') : ''}
                  onChange={(e) => handleUnitPrice(e.target.value)}
                  placeholder="1,500"
                  className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm pr-8"
                />
                <span className="absolute right-3 top-2.5 text-xs text-[var(--color-muted-foreground)]">円</span>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">
                客室数 {totalRooms ? <span className="text-xs text-[var(--color-muted-foreground)]">（フロア合計: {totalRooms}室）</span> : ''}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={value.quantity ?? totalRooms ?? ''}
                  onChange={(e) => handleQty(e.target.value)}
                  className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm pr-8"
                />
                <span className="absolute right-3 top-2.5 text-xs text-[var(--color-muted-foreground)]">室</span>
              </div>
            </div>
          </div>
        )}

        {!hotelMode && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">税抜金額</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={value.amount_ex_tax ? value.amount_ex_tax.toLocaleString('ja-JP') : ''}
                onChange={(e) => handleExTax(e.target.value)}
                placeholder="100,000"
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm pr-8"
              />
              <span className="absolute right-3 top-2.5 text-xs text-[var(--color-muted-foreground)]">円</span>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">消費税率</label>
          <Select value={String(value.tax_rate)} onValueChange={handleTaxRate}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TAX_RATES.map((t) => <SelectItem key={t.value} value={String(t.value)}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* 計算結果表示 */}
        <div className="rounded-[var(--radius)] p-4 space-y-2 text-sm"
          style={{ background: 'oklch(0.09 0.005 255 / 0.80)', border: `1px solid ${gold}26` }}>
          <div className="flex justify-between">
            <span style={{ color: 'oklch(0.55 0.007 75)' }}>税抜金額</span>
            <span className="font-mono">{fmtJPY(value.amount_ex_tax)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'oklch(0.55 0.007 75)' }}>消費税（{Math.round(value.tax_rate * 100)}%）</span>
            <span className="font-mono">{fmtJPY(value.tax_amount)}</span>
          </div>
          <div className="flex justify-between border-t pt-2" style={{ borderColor: `${gold}26` }}>
            <span className="font-semibold" style={{ color: gold }}>税込合計</span>
            <span className="font-mono font-bold text-base" style={{ color: gold }}>
              {fmtJPY(value.amount_inc_tax)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── 定期案件 月次単価テーブル ─── */

const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

interface RecurringPriceCardProps {
  value:    PriceEntry[]   // 12要素 (index 0=1月 ... 11=12月)
  onChange: (v: PriceEntry[]) => void
}

export function RecurringPriceCard({ value, onChange }: RecurringPriceCardProps) {
  const [bulkExTax, setBulkExTax]   = React.useState('')
  const [bulkTaxRate, setBulkTaxRate] = React.useState('0.1')

  function updateMonth(monthIdx: number, exTaxRaw: string, taxRateRaw?: string) {
    const ex      = parseInt(exTaxRaw.replace(/,/g, ''), 10) || 0
    const rate    = taxRateRaw !== undefined ? parseFloat(taxRateRaw) : value[monthIdx].tax_rate
    const { taxAmount, amountIncTax } = calcTax(ex, rate)
    const next = [...value]
    next[monthIdx] = { ...next[monthIdx], amount_ex_tax: ex, tax_rate: rate, tax_amount: taxAmount, amount_inc_tax: amountIncTax }
    onChange(next)
  }

  function updateTaxRate(monthIdx: number, rate: string) {
    const ex = value[monthIdx].amount_ex_tax
    const r  = parseFloat(rate)
    const { taxAmount, amountIncTax } = calcTax(ex, r)
    const next = [...value]
    next[monthIdx] = { ...next[monthIdx], tax_rate: r, tax_amount: taxAmount, amount_inc_tax: amountIncTax }
    onChange(next)
  }

  function applyBulk() {
    const ex   = parseInt(bulkExTax.replace(/,/g, ''), 10) || 0
    const rate = parseFloat(bulkTaxRate) || 0.10
    const { taxAmount, amountIncTax } = calcTax(ex, rate)
    onChange(value.map((v, i) => ({ ...v, period_month: i + 1, amount_ex_tax: ex, tax_rate: rate, tax_amount: taxAmount, amount_inc_tax: amountIncTax })))
  }

  const yearTotal = value.reduce((s, v) => s + v.amount_inc_tax, 0)
  const yearExTax = value.reduce((s, v) => s + v.amount_ex_tax, 0)
  const gold = 'oklch(0.73 0.12 78)'

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> 年間単価管理
        </h2>

        {/* 一括入力 */}
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] p-4 space-y-3">
          <p className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">毎月同じ金額を一括反映</p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-[var(--color-muted-foreground)]">税抜金額</label>
              <div className="relative">
                <input type="text" inputMode="numeric" value={bulkExTax} onChange={(e) => setBulkExTax(e.target.value)}
                  placeholder="80,000"
                  className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm pr-8" />
                <span className="absolute right-3 top-2.5 text-xs text-[var(--color-muted-foreground)]">円</span>
              </div>
            </div>
            <div className="w-40">
              <label className="mb-1 block text-xs text-[var(--color-muted-foreground)]">消費税率</label>
              <Select value={bulkTaxRate} onValueChange={setBulkTaxRate}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAX_RATES.map((t) => <SelectItem key={t.value} value={String(t.value)}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <button type="button" onClick={applyBulk}
              className="shrink-0 rounded-[var(--radius)] px-4 py-2 text-sm font-bold transition-all"
              style={{ background: `${gold}20`, border: `1px solid ${gold}50`, color: gold }}>
              1〜12月へ反映
            </button>
          </div>
        </div>

        {/* 月次テーブル */}
        <div className="space-y-2">
          {MONTHS.map((label, idx) => {
            const v = value[idx]
            return (
              <div key={idx} className="grid grid-cols-[60px_1fr_120px_auto] items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2">
                <span className="text-sm font-bold" style={{ color: gold }}>{label}</span>
                <div className="relative">
                  <input
                    type="text" inputMode="numeric"
                    value={v.amount_ex_tax ? v.amount_ex_tax.toLocaleString('ja-JP') : ''}
                    onChange={(e) => updateMonth(idx, e.target.value)}
                    placeholder="0"
                    className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-1.5 text-sm pr-8"
                  />
                  <span className="absolute right-2 top-2 text-xs text-[var(--color-muted-foreground)]">円</span>
                </div>
                <Select value={String(v.tax_rate)} onValueChange={(r) => updateTaxRate(idx, r)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TAX_RATES.map((t) => <SelectItem key={t.value} value={String(t.value)}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-xs font-mono whitespace-nowrap text-right" style={{ color: 'oklch(0.70 0.008 75)', minWidth: 90 }}>
                  税込 {fmtJPY(v.amount_inc_tax)}
                </span>
              </div>
            )
          })}
        </div>

        {/* 年間合計 */}
        <div className="rounded-[var(--radius)] p-4 space-y-2 text-sm"
          style={{ background: `${gold}0d`, border: `1px solid ${gold}30` }}>
          <div className="flex justify-between">
            <span style={{ color: 'oklch(0.55 0.007 75)' }}>年間税抜合計</span>
            <span className="font-mono">{fmtJPY(yearExTax)}</span>
          </div>
          <div className="flex justify-between font-bold text-base">
            <span style={{ color: gold }}>年間税込合計</span>
            <span className="font-mono" style={{ color: gold }}>{fmtJPY(yearTotal)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
