import { NextResponse } from 'next/server'

// Supabase Management API 経由でマイグレーションを実行する
// 事前に SUPABASE_ACCESS_TOKEN を .env.local に設定してください
// 取得先: https://supabase.com/dashboard/account/tokens

const PROJECT_REF = 'cgdrrowxfraykeyyafxg'

const MIGRATION_SQL = `
-- ============================================================
-- 011: 従業員・協力業者管理テーブル
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.employee_status AS ENUM ('active', 'on_leave', 'resigned', 'suspended', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.partner_status AS ENUM ('active', 'suspended', 'terminated', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.employees (
  id                UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number   TEXT                   UNIQUE,
  company_id        UUID                   NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name              TEXT                   NOT NULL,
  name_kana         TEXT,
  birth_date        DATE,
  gender            TEXT                   CHECK (gender IN ('male', 'female', 'other')),
  phone             TEXT,
  email             TEXT,
  address           TEXT,
  emergency_contact TEXT,
  hire_date         DATE,
  department        TEXT,
  position          TEXT,
  qualifications    TEXT[]                 NOT NULL DEFAULT '{}',
  notes             TEXT,
  status            public.employee_status NOT NULL DEFAULT 'active',
  auth_user_id      UUID                   UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.partners (
  id                  UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID                  NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_name        TEXT                  NOT NULL,
  company_name_kana   TEXT,
  contact_person_name TEXT,
  contact_person_kana TEXT,
  phone               TEXT,
  email               TEXT,
  address             TEXT,
  billing_info        JSONB,
  contract_start_date DATE,
  contract_end_date   DATE,
  service_areas       TEXT[]                NOT NULL DEFAULT '{}',
  service_types       TEXT[]                NOT NULL DEFAULT '{}',
  qualifications      TEXT[]                NOT NULL DEFAULT '{}',
  notes               TEXT,
  status              public.partner_status NOT NULL DEFAULT 'active',
  auth_user_id        UUID                  UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_assignments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  assignee_type TEXT        NOT NULL CHECK (assignee_type IN ('employee', 'partner')),
  assignee_id   UUID        NOT NULL,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, assignee_type, assignee_id)
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS entity_type TEXT CHECK (entity_type IN ('employee', 'partner')),
  ADD COLUMN IF NOT EXISTS entity_id   UUID;

-- インデックス
CREATE INDEX IF NOT EXISTS employees_company_id_idx   ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS employees_status_idx       ON public.employees(status);
CREATE INDEX IF NOT EXISTS employees_auth_user_id_idx ON public.employees(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS partners_company_id_idx    ON public.partners(company_id);
CREATE INDEX IF NOT EXISTS partners_status_idx        ON public.partners(status);
CREATE INDEX IF NOT EXISTS partners_auth_user_id_idx  ON public.partners(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS project_assignments_project_id_idx ON public.project_assignments(project_id);
CREATE INDEX IF NOT EXISTS project_assignments_assignee_idx   ON public.project_assignments(assignee_type, assignee_id);

-- 社員番号自動採番
CREATE SEQUENCE IF NOT EXISTS public.employee_number_seq START 1;

CREATE OR REPLACE FUNCTION public.set_employee_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.employee_number IS NULL THEN
    NEW.employee_number = 'EMP-' || LPAD(nextval('employee_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_set_number ON public.employees;
CREATE TRIGGER employees_set_number
  BEFORE INSERT ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_employee_number();

DROP TRIGGER IF EXISTS employees_updated_at ON public.employees;
CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS partners_updated_at ON public.partners;
CREATE TRIGGER partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.employees           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

-- ヘルパー関数
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_entity_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT entity_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_entity_type()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT entity_type FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_assigned_project_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pa.project_id
  FROM public.project_assignments pa
  WHERE pa.assignee_id   = public.get_my_entity_id()
    AND pa.assignee_type = public.get_my_entity_type()
$$;

CREATE OR REPLACE FUNCTION public.get_my_admin_project_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id FROM public.projects p
  INNER JOIN public.profiles prof ON prof.company_id = p.company_id
  WHERE prof.id = auth.uid() AND prof.role = 'admin'
$$;

-- RLS ポリシー
DROP POLICY IF EXISTS "employees: admin manage" ON public.employees;
CREATE POLICY "employees: admin manage" ON public.employees FOR ALL TO authenticated
  USING   (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "employees: self read" ON public.employees;
CREATE POLICY "employees: self read" ON public.employees FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "partners: admin manage" ON public.partners;
CREATE POLICY "partners: admin manage" ON public.partners FOR ALL TO authenticated
  USING   (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "partners: self read" ON public.partners;
CREATE POLICY "partners: self read" ON public.partners FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "project_assignments: admin manage" ON public.project_assignments;
CREATE POLICY "project_assignments: admin manage" ON public.project_assignments FOR ALL TO authenticated
  USING   (project_id IN (SELECT public.get_my_admin_project_ids()))
  WITH CHECK (project_id IN (SELECT public.get_my_admin_project_ids()));

DROP POLICY IF EXISTS "project_assignments: self read" ON public.project_assignments;
CREATE POLICY "project_assignments: self read" ON public.project_assignments FOR SELECT TO authenticated
  USING (
    assignee_id   = public.get_my_entity_id()
    AND assignee_type = public.get_my_entity_type()
  );

DROP POLICY IF EXISTS "projects: assigned workers read" ON public.projects;
CREATE POLICY "projects: assigned workers read" ON public.projects FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_my_assigned_project_ids()));

DROP POLICY IF EXISTS "jobs: assigned workers read" ON public.jobs;
CREATE POLICY "jobs: assigned workers read" ON public.jobs FOR SELECT TO authenticated
  USING (project_id IN (SELECT public.get_my_assigned_project_ids()));

-- ============================================================
-- 012: テストデータ（従業員10名 / 協力業者10社）
-- ============================================================

DO $$
DECLARE
  cid UUID := '00000000-0000-0000-0000-000000000001';
BEGIN

INSERT INTO public.employees
  (company_id, name, name_kana, birth_date, gender, phone, email, address,
   emergency_contact, hire_date, department, position, qualifications, notes, status)
VALUES
  (cid,'田中 太郎','タナカ タロウ','1985-04-12','male','090-1111-2222','tanaka@hikaru.example','東京都新宿区西新宿1-1-1','田中 花子（妻）/ 090-3333-4444','2018-04-01','清掃部','チーフ',ARRAY['ビルクリーニング技能士1級','清掃作業主任者'],'リーダーシップ優秀','active'),
  (cid,'佐藤 次郎','サトウ ジロウ','1990-07-25','male','090-2222-3333','sato@hikaru.example','東京都渋谷区渋谷2-2-2','佐藤 恵（母）/ 03-5555-6666','2020-06-01','清掃部','作業員',ARRAY['ビルクリーニング技能士2級'],NULL,'active'),
  (cid,'鈴木 三郎','スズキ サブロウ','1988-11-03','male','090-3333-4444','suzuki@hikaru.example','神奈川県横浜市中区山下町3-3','鈴木 美恵（妻）/ 045-777-8888','2019-09-01','清掃部','サブリーダー',ARRAY['清掃作業主任者','防火管理者'],'横浜エリア担当','active'),
  (cid,'高橋 恵子','タカハシ ケイコ','1993-02-14','female','080-4444-5555','takahashi@hikaru.example','東京都品川区大崎4-4-4','高橋 一郎（父）/ 090-8888-9999','2021-03-15','品質管理部','品質検査員',ARRAY['ビルクリーニング技能士2級','ISO9001内部監査員'],'写真管理が丁寧','active'),
  (cid,'渡辺 健一','ワタナベ ケンイチ','1982-09-30','male','090-5555-6666','watanabe@hikaru.example','埼玉県さいたま市大宮区5-5-5','渡辺 良子（妻）/ 048-111-2222','2017-07-01','清掃部','チーフ',ARRAY['ビルクリーニング技能士1級','清掃作業主任者','特殊建築物調査員'],'埼玉エリア統括','active'),
  (cid,'伊藤 由美','イトウ ユミ','1995-05-20','female','080-6666-7777','ito@hikaru.example','東京都目黒区自由が丘6-6-6','伊藤 正夫（父）/ 03-3333-4444','2022-04-01','清掃部','作業員',ARRAY[]::TEXT[],'研修中','active'),
  (cid,'中村 浩二','ナカムラ コウジ','1978-12-08','male','090-7777-8888','nakamura@hikaru.example','千葉県千葉市中央区7-7-7','中村 幸子（妻）/ 043-555-6666','2015-01-10','管理部','マネージャー',ARRAY['ビルクリーニング技能士1級','清掃作業主任者','施設管理士'],'千葉エリア管理責任者','active'),
  (cid,'小林 美咲','コバヤシ ミサキ','1997-08-16','female','080-8888-9999','kobayashi@hikaru.example','東京都世田谷区三軒茶屋8-8-8','小林 信也（兄）/ 090-2222-1111','2022-10-01','清掃部','作業員',ARRAY['ビルクリーニング技能士2級'],'接客スキル高い','active'),
  (cid,'加藤 誠','カトウ マコト','1987-03-27','male','090-9999-0000','kato@hikaru.example','東京都板橋区成増9-9-9','加藤 順子（妻）/ 03-6666-7777','2016-08-01','清掃部','チーフ',ARRAY['ビルクリーニング技能士1級','防火管理者'],NULL,'on_leave'),
  (cid,'吉田 光子','ヨシダ ミツコ','1965-06-11','female','080-0000-1111','yoshida@hikaru.example','東京都練馬区石神井町10-10-10','吉田 博（夫）/ 03-7777-8888','2010-04-01','清掃部','作業員',ARRAY['ビルクリーニング技能士1級','清掃作業主任者','ホテル清掃技能士'],'ベテラン','resigned')
ON CONFLICT DO NOTHING;

INSERT INTO public.partners
  (company_id, company_name, company_name_kana, contact_person_name, contact_person_kana,
   phone, email, address, contract_start_date, contract_end_date,
   service_areas, service_types, qualifications, notes, status)
VALUES
  (cid,'株式会社クリーンプロ','カブシキカイシャクリーンプロ','山田 一朗','ヤマダ イチロウ','03-1234-5678','info@cleanpro.example','東京都千代田区丸の内1-1-1','2023-04-01','2025-03-31',ARRAY['東京都','神奈川県'],ARRAY['ビル清掃','オフィス清掃','定期清掃'],ARRAY['ビルクリーニング技能士1級','ISO14001'],'信頼性が高い','active'),
  (cid,'東京ビルサービス株式会社','トウキョウビルサービスカブシキカイシャ','松本 健司','マツモト ケンジ','03-2345-6789','info@tbs.example','東京都港区芝公園2-2-2','2022-01-01','2024-12-31',ARRAY['東京都','埼玉県','千葉県'],ARRAY['ビル清掃','病院清掃','定期清掃','特殊清掃'],ARRAY['ビルクリーニング技能士1級','ISO9001','医療施設清掃認定'],'大型病院案件に強い','active'),
  (cid,'株式会社グリーンクリーン','カブシキカイシャグリーンクリーン','中島 美穂','ナカジマ ミホ','045-3456-7890','info@greenclean.example','神奈川県横浜市西区みなとみらい3-3-3','2023-07-01','2025-06-30',ARRAY['神奈川県','東京都'],ARRAY['ビル清掃','マンション清掃','外壁洗浄'],ARRAY['ビルクリーニング技能士2級','高所作業主任者'],'外壁・高所作業が得意','active'),
  (cid,'関東メンテナンスサービス株式会社','カントウメンテナンスサービスカブシキカイシャ','橋本 隆志','ハシモト タカシ','048-4567-8901','info@kanto-ms.example','埼玉県さいたま市浦和区高砂4-4-4','2021-10-01','2024-09-30',ARRAY['埼玉県','東京都','群馬県'],ARRAY['工場清掃','ビル清掃','産業廃棄物収集'],ARRAY['ビルクリーニング技能士1級','産業廃棄物収集運搬業許可'],'工場・倉庫案件に強い','active'),
  (cid,'千葉クリーンサービス有限会社','チバクリーンサービスユウゲンカイシャ','原田 守','ハラダ マモル','043-5678-9012','info@chiba-cs.example','千葉県千葉市稲毛区長沼5-5-5','2024-01-01','2025-12-31',ARRAY['千葉県'],ARRAY['マンション清掃','学校清掃','定期清掃'],ARRAY['ビルクリーニング技能士2級'],'千葉エリア専門','active'),
  (cid,'ホワイトグローブ株式会社','ホワイトグローブカブシキカイシャ','坂本 淳子','サカモト ジュンコ','03-6789-0123','info@whitegrove.example','東京都渋谷区恵比寿6-6-6','2023-09-01','2025-08-31',ARRAY['東京都'],ARRAY['ホテル清掃','レストラン清掃','高級マンション清掃'],ARRAY['ビルクリーニング技能士1級','ホテル清掃技能士','ISO9001'],'高品質・ホテル特化','active'),
  (cid,'株式会社エコクリーン','カブシキカイシャエコクリーン','村田 浩','ムラタ ヒロシ','042-7890-1234','info@eco-clean.example','東京都八王子市南新町7-7-7','2022-06-01','2024-05-31',ARRAY['東京都','神奈川県'],ARRAY['工場清掃','倉庫清掃','エアコン清掃'],ARRAY['高所作業主任者','エアコン清掃技術者'],'多摩エリア専門','suspended'),
  (cid,'日本ビルメン株式会社','ニホンビルメンカブシキカイシャ','石井 誠一','イシイ セイイチ','03-8901-2345','info@nihon-bm.example','東京都江東区木場8-8-8','2020-04-01','2023-03-31',ARRAY['東京都','神奈川県','埼玉県','千葉県'],ARRAY['ビル清掃','マンション清掃','病院清掃'],ARRAY['ビルクリーニング技能士1級','ISO9001','ISO14001'],'大手。契約終了済み','terminated'),
  (cid,'サンシャインクリーン有限会社','サンシャインクリーンユウゲンカイシャ','木村 洋子','キムラ ヨウコ','03-9012-3456','info@sunshine.example','東京都豊島区池袋9-9-9','2024-04-01','2026-03-31',ARRAY['東京都'],ARRAY['オフィス清掃','定期清掃','ガラス清掃'],ARRAY['ビルクリーニング技能士2級','ガラス清掃技術者'],'都心オフィスビル専門','active'),
  (cid,'株式会社ネクストクリーン','カブシキカイシャネクストクリーン','岡田 拓也','オカダ タクヤ','03-0123-4567','info@next-clean.example','東京都台東区上野10-10-10','2023-12-01','2025-11-30',ARRAY['東京都','埼玉県'],ARRAY['ビル清掃','マンション清掃','エアコン清掃'],ARRAY['ビルクリーニング技能士2級','エアコン清掃技術者'],'フットワーク軽い中堅業者','active')
ON CONFLICT DO NOTHING;

END $$;
`

export async function POST() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN

  if (!accessToken) {
    return NextResponse.json({
      error: 'SUPABASE_ACCESS_TOKEN が .env.local に設定されていません。',
      hint: 'https://supabase.com/dashboard/account/tokens でトークンを取得して SUPABASE_ACCESS_TOKEN=xxx を .env.local に追加してください。',
    }, { status: 400 })
  }

  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: MIGRATION_SQL }),
  })

  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json({ error: 'Migration API failed', detail: body }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'マイグレーション適用完了' })
}
