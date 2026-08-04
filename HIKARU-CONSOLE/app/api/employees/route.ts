import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

async function getAdminCompanyId() {
  const cookieStore = await cookies()
  const uid = cookieStore.get('hk_c_uid')?.value
  if (!uid) return null
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('company_id, role').eq('id', uid).single()
  if (!data || data.role !== 'admin') return null
  return data.company_id as string
}

// GET /api/employees  - 従業員一覧
export async function GET(req: NextRequest) {
  const companyId = await getAdminCompanyId()
  if (!companyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search   = searchParams.get('search') ?? ''
  const status   = searchParams.get('status') ?? ''
  const page     = parseInt(searchParams.get('page') ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20')

  const admin = createAdminClient()
  let query = admin
    .from('employees')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (search) {
    query = query.or(`name.ilike.%${search}%,name_kana.ilike.%${search}%,email.ilike.%${search}%,employee_number.ilike.%${search}%`)
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, count: count ?? 0 })
}

// POST /api/employees  - 従業員登録
export async function POST(req: NextRequest) {
  const companyId = await getAdminCompanyId()
  if (!companyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { loginPassword, role, ...employeeFields } = body

  const admin = createAdminClient()

  // ① まず employees レコードを作成（employee_number はDBトリガーで自動採番）
  const { data: employee, error: empError } = await admin
    .from('employees')
    .insert({ company_id: companyId, ...employeeFields })
    .select()
    .single()

  if (empError) {
    return NextResponse.json({ error: empError.message }, { status: 500 })
  }

  // ② ログイン設定がある場合、社員番号からAuth用メールを生成して登録
  if (loginPassword) {
    const empNumber: string = (employee as any).employee_number ?? ''
    // 社員番号を内部メールに変換: EMP-0001 → emp-0001@hikaru.internal
    const internalEmail = `${empNumber.toLowerCase()}@hikaru.internal`

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: internalEmail,
      password: loginPassword,
      email_confirm: true,
      user_metadata: { name: employeeFields.name, role: role ?? 'worker', company_id: companyId },
    })

    if (authError) {
      // Auth作成失敗時は employee レコードも削除してロールバック
      await admin.from('employees').delete().eq('id', (employee as any).id)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const authUserId = authUser.user.id

    // profiles 更新
    await admin.from('profiles').update({
      company_id: companyId,
      role: role ?? 'worker',
      entity_type: 'employee',
      entity_id: (employee as any).id,
    }).eq('id', authUserId)

    // employee に auth_user_id を紐付け
    await admin.from('employees').update({ auth_user_id: authUserId }).eq('id', (employee as any).id)
  }

  return NextResponse.json({ data: employee }, { status: 201 })
}
