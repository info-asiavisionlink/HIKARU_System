'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  PageHeader, Button, Input, Card, CardContent, CardHeader, CardTitle, toast, Skeleton,
} from '@hikaru/ui'
import { Save, Building2 } from 'lucide-react'

export default function SettingsPage() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [companyId, setCompanyId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState({ name: '' })

  React.useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) { setLoading(false); return }
      setCompanyId(profile.company_id)
      const { data: company } = await supabase.from('companies').select('name').eq('id', profile.company_id).single()
      if (company) setForm({ name: company.name })
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !companyId) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('companies').update({ name: form.name.trim() }).eq('id', companyId)
    if (error) { toast.error('保存に失敗しました') }
    else { toast.success('設定を保存しました') }
    setSaving(false)
  }

  return (
    <div>
      <PageHeader title="設定" description="システム設定・会社情報の管理" />

      {loading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" /> 会社情報
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <Input
                  label="会社名"
                  value={form.name}
                  onChange={(e) => setForm({ name: e.target.value })}
                  placeholder="株式会社HIKARU"
                />
                <Button type="submit" disabled={saving}>
                  <Save className="h-4 w-4" /> {saving ? '保存中...' : '変更を保存'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">バージョン情報</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-[var(--color-muted-foreground)]">
                <div className="flex justify-between">
                  <span>HIKARU-CONSOLE</span>
                  <span>v0.4.0</span>
                </div>
                <div className="flex justify-between">
                  <span>第4回リリース</span>
                  <span>2026年8月</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
