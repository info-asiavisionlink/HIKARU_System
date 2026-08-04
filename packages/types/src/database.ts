// ============================================================
// Supabase データベース型定義
// 本番では `supabase gen types typescript` で自動生成に置き換える
// コマンド: npx supabase gen types typescript --project-id <id> > src/database.types.ts
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'cancelled'

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string | null
        }
        Update: {
          name?: string
          logo_url?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          company_id: string
          email: string
          name: string
          role: 'admin' | 'worker' | 'client'
          avatar_url: string | null
          entity_type: 'employee' | 'partner' | null
          entity_id: string | null
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          company_id: string
          email: string
          name: string
          role: 'admin' | 'worker' | 'client'
          avatar_url?: string | null
          entity_type?: 'employee' | 'partner' | null
          entity_id?: string | null
        }
        Update: {
          name?: string
          role?: 'admin' | 'worker' | 'client'
          avatar_url?: string | null
          entity_type?: 'employee' | 'partner' | null
          entity_id?: string | null
        }
      }
      employees: {
        Row: {
          id: string
          employee_number: string | null
          company_id: string
          name: string
          name_kana: string | null
          birth_date: string | null
          gender: 'male' | 'female' | 'other' | null
          phone: string | null
          email: string | null
          address: string | null
          emergency_contact: string | null
          hire_date: string | null
          department: string | null
          position: string | null
          qualifications: string[]
          notes: string | null
          status: 'active' | 'on_leave' | 'resigned' | 'suspended' | 'deleted'
          auth_user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_number?: string | null
          company_id: string
          name: string
          name_kana?: string | null
          birth_date?: string | null
          gender?: 'male' | 'female' | 'other' | null
          phone?: string | null
          email?: string | null
          address?: string | null
          emergency_contact?: string | null
          hire_date?: string | null
          department?: string | null
          position?: string | null
          qualifications?: string[]
          notes?: string | null
          status?: 'active' | 'on_leave' | 'resigned' | 'suspended' | 'deleted'
          auth_user_id?: string | null
        }
        Update: {
          name?: string
          name_kana?: string | null
          birth_date?: string | null
          gender?: 'male' | 'female' | 'other' | null
          phone?: string | null
          email?: string | null
          address?: string | null
          emergency_contact?: string | null
          hire_date?: string | null
          department?: string | null
          position?: string | null
          qualifications?: string[]
          notes?: string | null
          status?: 'active' | 'on_leave' | 'resigned' | 'suspended' | 'deleted'
          auth_user_id?: string | null
        }
      }
      partners: {
        Row: {
          id: string
          company_id: string
          company_name: string
          company_name_kana: string | null
          contact_person_name: string | null
          contact_person_kana: string | null
          phone: string | null
          email: string | null
          address: string | null
          billing_info: Record<string, unknown> | null
          contract_start_date: string | null
          contract_end_date: string | null
          service_areas: string[]
          service_types: string[]
          qualifications: string[]
          notes: string | null
          status: 'active' | 'suspended' | 'terminated' | 'deleted'
          auth_user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          company_name: string
          company_name_kana?: string | null
          contact_person_name?: string | null
          contact_person_kana?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          billing_info?: Record<string, unknown> | null
          contract_start_date?: string | null
          contract_end_date?: string | null
          service_areas?: string[]
          service_types?: string[]
          qualifications?: string[]
          notes?: string | null
          status?: 'active' | 'suspended' | 'terminated' | 'deleted'
          auth_user_id?: string | null
        }
        Update: {
          company_name?: string
          company_name_kana?: string | null
          contact_person_name?: string | null
          contact_person_kana?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          billing_info?: Record<string, unknown> | null
          contract_start_date?: string | null
          contract_end_date?: string | null
          service_areas?: string[]
          service_types?: string[]
          qualifications?: string[]
          notes?: string | null
          status?: 'active' | 'suspended' | 'terminated' | 'deleted'
          auth_user_id?: string | null
        }
      }
      project_assignments: {
        Row: {
          id: string
          project_id: string
          assignee_type: 'employee' | 'partner'
          assignee_id: string
          assigned_at: string
        }
        Insert: {
          id?: string
          project_id: string
          assignee_type: 'employee' | 'partner'
          assignee_id: string
          assigned_at?: string
        }
        Update: never
      }
      clients: {
        Row: {
          id: string
          company_id: string
          name: string
          code: string | null
          email: string | null
          phone: string | null
          address: string | null
          contact_name: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          code?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          contact_name?: string | null
          notes?: string | null
          is_active?: boolean
        }
        Update: {
          name?: string
          code?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          contact_name?: string | null
          notes?: string | null
          is_active?: boolean
        }
      }
      stores: {
        Row: {
          id: string
          client_id: string
          company_id: string
          name: string
          code: string | null
          address: string | null
          phone: string | null
          business_hours: string | null
          manager_name: string | null
          emergency_contact: string | null
          contract_info: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          company_id: string
          name: string
          code?: string | null
          address?: string | null
          phone?: string | null
          business_hours?: string | null
          manager_name?: string | null
          emergency_contact?: string | null
          contract_info?: string | null
          notes?: string | null
          is_active?: boolean
        }
        Update: {
          name?: string
          code?: string | null
          address?: string | null
          phone?: string | null
          business_hours?: string | null
          manager_name?: string | null
          emergency_contact?: string | null
          contract_info?: string | null
          notes?: string | null
          is_active?: boolean
        }
      }
      projects: {
        Row: {
          id: string
          company_id: string
          store_id: string | null   // nullable since migration 008
          name: string
          code: string | null
          status: ProjectStatus
          start_date: string | null
          end_date: string | null
          contract_info: string | null
          notes: string | null
          // migration 008: 案件中心設計フィールド
          location_name: string | null
          phone: string | null
          emergency_contact: string | null
          business_hours: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          store_id?: string | null
          name: string
          code?: string | null
          status?: ProjectStatus
          start_date?: string | null
          end_date?: string | null
          contract_info?: string | null
          notes?: string | null
          location_name?: string | null
          phone?: string | null
          emergency_contact?: string | null
          business_hours?: string | null
        }
        Update: {
          store_id?: string | null
          name?: string
          code?: string | null
          status?: ProjectStatus
          start_date?: string | null
          end_date?: string | null
          contract_info?: string | null
          notes?: string | null
          location_name?: string | null
          phone?: string | null
          emergency_contact?: string | null
          business_hours?: string | null
        }
      }
      project_workers: {
        Row: {
          project_id: string
          worker_id: string
          assigned_at: string
        }
        Insert: {
          project_id: string
          worker_id: string
          assigned_at?: string
        }
        Update: never
      }
      photo_spots: {
        Row: {
          id: string
          store_id: string | null
          project_id: string | null  // migration 008 で追加
          name: string
          description: string | null
          order_num: number
          is_required: boolean
          ref_image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id?: string | null
          project_id?: string | null
          name: string
          description?: string | null
          order_num?: number
          is_required?: boolean
          ref_image_url?: string | null
        }
        Update: {
          store_id?: string | null
          project_id?: string | null
          name?: string
          description?: string | null
          order_num?: number
          is_required?: boolean
          ref_image_url?: string | null
        }
      }
      jobs: {
        Row: {
          id: string
          project_id: string
          worker_id: string
          company_id: string
          status: 'in_progress' | 'completed' | 'cancelled'
          work_date: string
          started_at: string
          completed_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          worker_id: string
          company_id: string
          status?: 'in_progress' | 'completed' | 'cancelled'
          work_date?: string
          started_at?: string
          completed_at?: string | null
          notes?: string | null
        }
        Update: {
          status?: 'in_progress' | 'completed' | 'cancelled'
          completed_at?: string | null
          notes?: string | null
        }
      }
      photos: {
        Row: {
          id: string
          job_id: string
          spot_id: string | null
          photo_type: 'before' | 'after'
          storage_path: string
          url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          spot_id?: string | null
          photo_type: 'before' | 'after'
          storage_path: string
          url?: string | null
        }
        Update: {
          url?: string | null
        }
      }
      manuals: {
        Row: {
          id: string
          project_id: string
          type: 'pdf' | 'image' | 'video' | 'text' | 'faq' | 'note'
          title: string
          content: string | null
          file_url: string | null
          order_num: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          type?: 'pdf' | 'image' | 'video' | 'text' | 'faq' | 'note'
          title: string
          content?: string | null
          file_url?: string | null
          order_num?: number
        }
        Update: {
          type?: 'pdf' | 'image' | 'video' | 'text' | 'faq' | 'note'
          title?: string
          content?: string | null
          file_url?: string | null
          order_num?: number
        }
      }
      reports: {
        Row: {
          id: string
          job_id: string
          project_id: string
          worker_id: string
          company_id: string
          version: number
          content: Json
          overall_score: number | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          project_id: string
          worker_id: string
          company_id: string
          version: number
          content: Json
          overall_score?: number | null
        }
        Update: never
      }
    }
    Views: Record<string, never>
    Functions: {
      get_my_assigned_project_ids: {
        Args: Record<string, never>
        Returns: string[]
      }
      get_my_admin_project_ids: {
        Args: Record<string, never>
        Returns: string[]
      }
    }
    Enums: {
      project_status: ProjectStatus
    }
  }
}
