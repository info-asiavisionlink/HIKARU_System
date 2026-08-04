'use client'

import * as React from 'react'
import { Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@hikaru/ui'
import { Plus, X, UserCheck, Handshake } from 'lucide-react'

export interface Assignee {
  assignee_type: 'employee' | 'partner'
  assignee_id: string
  label: string
}

interface AssigneeSelectorProps {
  value: Assignee[]
  onChange: (value: Assignee[]) => void
}

interface EmployeeOption { id: string; name: string; employee_number: string | null }
interface PartnerOption  { id: string; company_name: string; contact_person_name: string | null }

export function AssigneeSelector({ value, onChange }: AssigneeSelectorProps) {
  const [addType, setAddType]       = React.useState<'employee' | 'partner'>('employee')
  const [addId, setAddId]           = React.useState('')
  const [employees, setEmployees]   = React.useState<EmployeeOption[]>([])
  const [partners, setPartners]     = React.useState<PartnerOption[]>([])
  const [loadingEmp, setLoadingEmp] = React.useState(false)
  const [loadingPar, setLoadingPar] = React.useState(false)

  React.useEffect(() => {
    loadEmployees()
    loadPartners()
  }, [])

  async function loadEmployees() {
    setLoadingEmp(true)
    try {
      const res = await fetch('/api/employees?pageSize=200&status=active', { credentials: 'include', cache: 'no-store' })
      if (res.ok) {
        const { data } = await res.json()
        setEmployees(data ?? [])
      }
    } finally {
      setLoadingEmp(false)
    }
  }

  async function loadPartners() {
    setLoadingPar(true)
    try {
      const res = await fetch('/api/partners?pageSize=200&status=active', { credentials: 'include', cache: 'no-store' })
      if (res.ok) {
        const { data } = await res.json()
        setPartners(data ?? [])
      }
    } finally {
      setLoadingPar(false)
    }
  }

  function getLabel(type: 'employee' | 'partner', id: string): string {
    if (type === 'employee') {
      const emp = employees.find((e) => e.id === id)
      return emp ? `${emp.name}${emp.employee_number ? ` (${emp.employee_number})` : ''}` : id
    }
    const par = partners.find((p) => p.id === id)
    return par ? `${par.company_name}${par.contact_person_name ? ` / ${par.contact_person_name}` : ''}` : id
  }

  function handleAdd() {
    if (!addId) return
    const already = value.some((a) => a.assignee_type === addType && a.assignee_id === addId)
    if (already) return

    const label = getLabel(addType, addId)
    onChange([...value, { assignee_type: addType, assignee_id: addId, label }])
    setAddId('')
  }

  function handleRemove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }

  const options = addType === 'employee' ? employees : partners
  const loading = addType === 'employee' ? loadingEmp : loadingPar

  // 既に追加済みの ID を除外
  const alreadyIds = new Set(value.filter((a) => a.assignee_type === addType).map((a) => a.assignee_id))

  return (
    <div className="space-y-3">
      {/* 追加済み一覧 */}
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((a, idx) => (
            <li
              key={`${a.assignee_type}-${a.assignee_id}`}
              className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2"
            >
              <div className="flex items-center gap-2 text-sm">
                {a.assignee_type === 'employee'
                  ? <UserCheck className="h-3.5 w-3.5 text-[var(--color-muted-foreground)]" />
                  : <Handshake  className="h-3.5 w-3.5 text-[var(--color-muted-foreground)]" />
                }
                <span>{a.label}</span>
                <span className="text-[10px] text-[var(--color-muted-foreground)]">
                  {a.assignee_type === 'employee' ? '従業員' : '協力業者'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 追加フォーム */}
      <div className="flex gap-2">
        <Select value={addType} onValueChange={(v) => { setAddType(v as any); setAddId('') }}>
          <SelectTrigger className="w-32 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="employee">従業員</SelectItem>
            <SelectItem value="partner">協力業者</SelectItem>
          </SelectContent>
        </Select>

        <Select value={addId} onValueChange={setAddId} disabled={loading || options.length === 0}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={loading ? '読み込み中...' : options.length === 0 ? '登録なし' : '選択してください'} />
          </SelectTrigger>
          <SelectContent>
            {addType === 'employee'
              ? employees
                  .filter((e) => !alreadyIds.has(e.id))
                  .map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}{e.employee_number ? ` (${e.employee_number})` : ''}
                    </SelectItem>
                  ))
              : partners
                  .filter((p) => !alreadyIds.has(p.id))
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.company_name}{p.contact_person_name ? ` / ${p.contact_person_name}` : ''}
                    </SelectItem>
                  ))
            }
          </SelectContent>
        </Select>

        <Button type="button" variant="outline" size="sm" onClick={handleAdd} disabled={!addId}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
