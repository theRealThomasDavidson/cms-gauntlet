export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          auth_id: string
          org_id: string | null
          username: string | null
          name: string | null
          role: 'customer' | 'agent' | 'admin'
          email: string
          teams: string[]
          created_at: string
          last_active: string | null
          preferences: Json
        }
        Insert: {
          id?: string
          auth_id: string
          org_id?: string | null
          username?: string | null
          name?: string | null
          role?: 'customer' | 'agent' | 'admin'
          email: string
          teams?: string[]
          created_at?: string
          last_active?: string | null
          preferences?: Json
        }
        Update: {
          id?: string
          auth_id?: string
          org_id?: string | null
          username?: string | null
          name?: string | null
          role?: 'customer' | 'agent' | 'admin'
          email?: string
          teams?: string[]
          created_at?: string
          last_active?: string | null
          preferences?: Json
        }
      }
      workflows: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean
          org_id: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_active?: boolean
          org_id: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_active?: boolean
          org_id?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Functions: {
      get_visible_profiles: {
        Args: Record<string, never>
        Returns: Database['public']['Tables']['profiles']['Row'][]
      }
      update_profile: {
        Args: {
          profile_id: string
          new_username: string | null
          new_name: string | null
          new_email: string | null
        }
        Returns: void
      }
      delete_user: {
        Args: {
          target_email: string
        }
        Returns: {
          success: boolean
          message: string
        }
      }
    }
  }
} 