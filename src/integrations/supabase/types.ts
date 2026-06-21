export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      allowances: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          is_active: boolean
          kind: string
          name: string
          taxable: boolean
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          kind: string
          name: string
          taxable?: boolean
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          taxable?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          branch: string | null
          city: string | null
          created_at: string
          date: string
          district: string | null
          employee_id: string
          free_check: boolean
          id: string
          in_time: string | null
          lat: number | null
          lng: number | null
          network_ok: boolean | null
          note: string | null
          out_city: string | null
          out_district: string | null
          out_lat: number | null
          out_lng: number | null
          out_street: string | null
          out_time: string | null
          status: string
          street: string | null
          updated_at: string
          verified_face: boolean
          verified_fp: boolean
        }
        Insert: {
          branch?: string | null
          city?: string | null
          created_at?: string
          date?: string
          district?: string | null
          employee_id: string
          free_check?: boolean
          id?: string
          in_time?: string | null
          lat?: number | null
          lng?: number | null
          network_ok?: boolean | null
          note?: string | null
          out_city?: string | null
          out_district?: string | null
          out_lat?: number | null
          out_lng?: number | null
          out_street?: string | null
          out_time?: string | null
          status?: string
          street?: string | null
          updated_at?: string
          verified_face?: boolean
          verified_fp?: boolean
        }
        Update: {
          branch?: string | null
          city?: string | null
          created_at?: string
          date?: string
          district?: string | null
          employee_id?: string
          free_check?: boolean
          id?: string
          in_time?: string | null
          lat?: number | null
          lng?: number | null
          network_ok?: boolean | null
          note?: string | null
          out_city?: string | null
          out_district?: string | null
          out_lat?: number | null
          out_lng?: number | null
          out_street?: string | null
          out_time?: string | null
          status?: string
          street?: string | null
          updated_at?: string
          verified_face?: boolean
          verified_fp?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          created_at: string
          id: string
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_ar?: string
          name_en: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_end_date: string | null
          performed_by: string | null
          previous_end_date: string | null
          profile_id: string
          reason: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_end_date?: string | null
          performed_by?: string | null
          previous_end_date?: string | null
          profile_id: string
          reason?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_end_date?: string | null
          performed_by?: string | null
          previous_end_date?: string | null
          profile_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_audit_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_audit_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          active: boolean
          body: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name_ar: string
          name_en: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name_ar?: string
          name_en: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      districts: {
        Row: {
          city_id: string
          created_at: string
          id: string
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          city_id: string
          created_at?: string
          id?: string
          name_ar?: string
          name_en: string
          updated_at?: string
        }
        Update: {
          city_id?: string
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "districts_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_allowances: {
        Row: {
          allowance_id: string
          created_at: string
          employee_id: string
          id: string
        }
        Insert: {
          allowance_id: string
          created_at?: string
          employee_id: string
          id?: string
        }
        Update: {
          allowance_id?: string
          created_at?: string
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_allowances_allowance_id_fkey"
            columns: ["allowance_id"]
            isOneToOne: false
            referencedRelation: "allowances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_allowances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_devices: {
        Row: {
          created_at: string
          id: string
          label: string
          last_seen_at: string | null
          status: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          label?: string
          last_seen_at?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          last_seen_at?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_kpis: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          kpi_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          kpi_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          kpi_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_kpis_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_kpis_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_shifts: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          shift_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          shift_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shifts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_targets_overtime: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          targets_overtime_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          targets_overtime_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          targets_overtime_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_targets_overtime_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_targets_overtime_targets_overtime_id_fkey"
            columns: ["targets_overtime_id"]
            isOneToOne: false
            referencedRelation: "targets_overtime"
            referencedColumns: ["id"]
          },
        ]
      }
      export_runs: {
        Row: {
          error: string | null
          file_size_bytes: number | null
          finished_at: string | null
          id: string
          recipients_failed: string[]
          recipients_sent: string[]
          row_count: number | null
          run_date: string
          schedule_id: string
          started_at: string
          status: string
        }
        Insert: {
          error?: string | null
          file_size_bytes?: number | null
          finished_at?: string | null
          id?: string
          recipients_failed?: string[]
          recipients_sent?: string[]
          row_count?: number | null
          run_date: string
          schedule_id: string
          started_at?: string
          status?: string
        }
        Update: {
          error?: string | null
          file_size_bytes?: number | null
          finished_at?: string | null
          id?: string
          recipients_failed?: string[]
          recipients_sent?: string[]
          row_count?: number | null
          run_date?: string
          schedule_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_runs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "export_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      export_schedules: {
        Row: {
          created_at: string
          date_range_kind: string
          employee_ids: string[]
          enabled: boolean
          format: string
          id: string
          last_run_date: string | null
          name: string
          owner_id: string
          recipients: string[]
          send_time: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_range_kind?: string
          employee_ids?: string[]
          enabled?: boolean
          format?: string
          id?: string
          last_run_date?: string | null
          name: string
          owner_id: string
          recipients?: string[]
          send_time?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_range_kind?: string
          employee_ids?: string[]
          enabled?: boolean
          format?: string
          id?: string
          last_run_date?: string | null
          name?: string
          owner_id?: string
          recipients?: string[]
          send_time?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      face_descriptors: {
        Row: {
          descriptor: Json
          enrolled_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          descriptor: Json
          enrolled_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          descriptor?: Json
          enrolled_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "face_descriptors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          location_id: string
          profile_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          location_id: string
          profile_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          location_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofence_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_assignments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "geofence_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_locations: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          lat: number
          lng: number
          name: string
          radius_m: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          lat: number
          lng: number
          name: string
          radius_m?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          lat?: number
          lng?: number
          name?: string
          radius_m?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofence_locations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      holiday_types: {
        Row: {
          affects_attendance: boolean
          color: string
          created_at: string
          description: string | null
          id: string
          is_paid: boolean
          name: string
          updated_at: string
        }
        Insert: {
          affects_attendance?: boolean
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_paid?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          affects_attendance?: boolean
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_paid?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          country: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          name: string
          notes: string | null
          recurring: boolean
          type: string
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          name: string
          notes?: string | null
          recurring?: boolean
          type?: string
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          name?: string
          notes?: string | null
          recurring?: boolean
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      kpis: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          metric: string
          name: string
          period: string
          target_value: number
          unit: string | null
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          metric: string
          name: string
          period?: string
          target_value?: number
          unit?: string | null
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          metric?: string
          name?: string
          period?: string
          target_value?: number
          unit?: string | null
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      late_penalties: {
        Row: {
          created_at: string
          from_minutes: number
          id: string
          is_active: boolean
          name: string
          penalty_type: string
          penalty_value: number
          to_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_minutes: number
          id?: string
          is_active?: boolean
          name: string
          penalty_type: string
          penalty_value?: number
          to_minutes: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          penalty_type?: string
          penalty_value?: number
          to_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      leave_balances: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          leave_type_id: string
          total_days: number
          updated_at: string
          used_days: number
          year: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          leave_type_id: string
          total_days?: number
          updated_at?: string
          used_days?: number
          year?: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          leave_type_id?: string
          total_days?: number
          updated_at?: string
          used_days?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          active: boolean
          annual_days: number
          created_at: string
          id: string
          name: string
          paid: boolean
          requires_proof: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          annual_days?: number
          created_at?: string
          id?: string
          name: string
          paid?: boolean
          requires_proof?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          annual_days?: number
          created_at?: string
          id?: string
          name?: string
          paid?: boolean
          requires_proof?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      leaves: {
        Row: {
          created_at: string
          days: number
          decided_at: string | null
          decided_by: string | null
          employee_id: string
          end_date: string
          id: string
          leave_type_id: string | null
          leave_type_name: string | null
          paid: boolean
          proof_mime: string | null
          proof_name: string | null
          proof_url: string | null
          reason: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days?: number
          decided_at?: string | null
          decided_by?: string | null
          employee_id: string
          end_date: string
          id?: string
          leave_type_id?: string | null
          leave_type_name?: string | null
          paid?: boolean
          proof_mime?: string | null
          proof_name?: string | null
          proof_url?: string | null
          reason?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days?: number
          decided_at?: string | null
          decided_by?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          leave_type_id?: string | null
          leave_type_name?: string | null
          paid?: boolean
          proof_mime?: string | null
          proof_name?: string | null
          proof_url?: string | null
          reason?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaves_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaves_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaves_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_assignment_history: {
        Row: {
          changed_by: string | null
          created_at: string
          employee_id: string
          id: string
          new_manager_id: string | null
          previous_manager_id: string | null
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          employee_id: string
          id?: string
          new_manager_id?: string | null
          previous_manager_id?: string | null
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          new_manager_id?: string | null
          previous_manager_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manager_assignment_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_assignment_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_assignment_history_new_manager_id_fkey"
            columns: ["new_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_assignment_history_previous_manager_id_fkey"
            columns: ["previous_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      network_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          network_id: string
          profile_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          network_id: string
          profile_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          network_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "network_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_assignments_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      networks: {
        Row: {
          branch: string | null
          bssid: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          ssid: string | null
          updated_at: string
        }
        Insert: {
          branch?: string | null
          bssid?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          ssid?: string | null
          updated_at?: string
        }
        Update: {
          branch?: string | null
          bssid?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          ssid?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notif_deliveries: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          id: string
          payload: Json | null
          recipient: string | null
          status: string
          subject: string | null
          user_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json | null
          recipient?: string | null
          status: string
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json | null
          recipient?: string | null
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      notification_category_prefs: {
        Row: {
          category: string
          channel: string
          enabled: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          channel: string
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          channel?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          email_enabled: boolean
          inapp_enabled: boolean
          push_enabled: boolean
          quiet_end: string | null
          quiet_start: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          email_enabled?: boolean
          inapp_enabled?: boolean
          push_enabled?: boolean
          quiet_end?: string | null
          quiet_start?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          email_enabled?: boolean
          inapp_enabled?: boolean
          push_enabled?: boolean
          quiet_end?: string | null
          quiet_start?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payroll_run_items: {
        Row: {
          absent_days: number
          allowance: number
          bonus: number
          created_at: string
          daily_rate: number
          department: string | null
          employee_id: string
          employee_name: string
          id: string
          kpi: number
          late_days: number
          leave_days: number
          net_pay: number
          penalty: number
          present_days: number
          run_id: string
          salary: number
          snapshot: Json
          target_met: boolean
        }
        Insert: {
          absent_days?: number
          allowance?: number
          bonus?: number
          created_at?: string
          daily_rate?: number
          department?: string | null
          employee_id: string
          employee_name: string
          id?: string
          kpi?: number
          late_days?: number
          leave_days?: number
          net_pay?: number
          penalty?: number
          present_days?: number
          run_id: string
          salary?: number
          snapshot?: Json
          target_met?: boolean
        }
        Update: {
          absent_days?: number
          allowance?: number
          bonus?: number
          created_at?: string
          daily_rate?: number
          department?: string | null
          employee_id?: string
          employee_name?: string
          id?: string
          kpi?: number
          late_days?: number
          leave_days?: number
          net_pay?: number
          penalty?: number
          present_days?: number
          run_id?: string
          salary?: number
          snapshot?: Json
          target_met?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payroll_run_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          created_at: string
          employee_count: number
          id: string
          late_penalty_ratio: number
          locked_at: string
          locked_by: string | null
          month: number
          notes: string | null
          status: string
          totals: Json
          updated_at: string
          working_days: number
          year: number
        }
        Insert: {
          created_at?: string
          employee_count?: number
          id?: string
          late_penalty_ratio?: number
          locked_at?: string
          locked_by?: string | null
          month: number
          notes?: string | null
          status?: string
          totals?: Json
          updated_at?: string
          working_days?: number
          year: number
        }
        Update: {
          created_at?: string
          employee_count?: number
          id?: string
          late_penalty_ratio?: number
          locked_at?: string
          locked_by?: string | null
          month?: number
          notes?: string | null
          status?: string
          totals?: Json
          updated_at?: string
          working_days?: number
          year?: number
        }
        Relationships: []
      }
      payroll_settings: {
        Row: {
          annual_personal_exemption: number
          created_at: string
          effective_date: string
          employee_insurance_rate: number
          employer_insurance_rate: number
          id: string
          insurance_ceiling: number
          insurance_floor: number
          martyrs_fund_enabled: boolean
          martyrs_fund_rate: number
          notes: string | null
          pay_period: string
          payout_methods: string[]
          updated_at: string
        }
        Insert: {
          annual_personal_exemption?: number
          created_at?: string
          effective_date: string
          employee_insurance_rate: number
          employer_insurance_rate: number
          id?: string
          insurance_ceiling: number
          insurance_floor?: number
          martyrs_fund_enabled?: boolean
          martyrs_fund_rate?: number
          notes?: string | null
          pay_period?: string
          payout_methods?: string[]
          updated_at?: string
        }
        Update: {
          annual_personal_exemption?: number
          created_at?: string
          effective_date?: string
          employee_insurance_rate?: number
          employer_insurance_rate?: number
          id?: string
          insurance_ceiling?: number
          insurance_floor?: number
          martyrs_fund_enabled?: boolean
          martyrs_fund_rate?: number
          notes?: string | null
          pay_period?: string
          payout_methods?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name_ar: string
          name_en: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name_ar?: string
          name_en: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profile_documents: {
        Row: {
          created_at: string
          data_url: string
          id: string
          kind: string
          mime_type: string
          name: string
          profile_id: string
          size_bytes: number
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          data_url: string
          id?: string
          kind: string
          mime_type: string
          name: string
          profile_id: string
          size_bytes: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          data_url?: string
          id?: string
          kind?: string
          mime_type?: string
          name?: string
          profile_id?: string
          size_bytes?: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          allowance: number | null
          avatar_url: string | null
          city: string | null
          city_id: string | null
          contract_cancelled: boolean
          contract_end_date: string | null
          contract_start_date: string | null
          contract_type: string | null
          created_at: string
          department_id: string | null
          district: string | null
          district_id: string | null
          email: string | null
          emp_code: string | null
          full_name: string | null
          id: string
          id_expiry_date: string | null
          id_issue_date: string | null
          insurance_applicable: boolean
          locale: string
          manager_id: string | null
          martyrs_fund_applicable: boolean
          national_id: string | null
          phone: string | null
          position_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          salary_amount: number
          salary_gross: number | null
          salary_mode: string | null
          salary_net: number | null
          salary_type: string
          status: string
          target_duration: string | null
          target_value: number | null
          tax_applicable: boolean
          updated_at: string
        }
        Insert: {
          allowance?: number | null
          avatar_url?: string | null
          city?: string | null
          city_id?: string | null
          contract_cancelled?: boolean
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_type?: string | null
          created_at?: string
          department_id?: string | null
          district?: string | null
          district_id?: string | null
          email?: string | null
          emp_code?: string | null
          full_name?: string | null
          id: string
          id_expiry_date?: string | null
          id_issue_date?: string | null
          insurance_applicable?: boolean
          locale?: string
          manager_id?: string | null
          martyrs_fund_applicable?: boolean
          national_id?: string | null
          phone?: string | null
          position_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          salary_amount?: number
          salary_gross?: number | null
          salary_mode?: string | null
          salary_net?: number | null
          salary_type?: string
          status?: string
          target_duration?: string | null
          target_value?: number | null
          tax_applicable?: boolean
          updated_at?: string
        }
        Update: {
          allowance?: number | null
          avatar_url?: string | null
          city?: string | null
          city_id?: string | null
          contract_cancelled?: boolean
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_type?: string | null
          created_at?: string
          department_id?: string | null
          district?: string | null
          district_id?: string | null
          email?: string | null
          emp_code?: string | null
          full_name?: string | null
          id?: string
          id_expiry_date?: string | null
          id_issue_date?: string | null
          insurance_applicable?: boolean
          locale?: string
          manager_id?: string | null
          martyrs_fund_applicable?: boolean
          national_id?: string | null
          phone?: string | null
          position_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          salary_amount?: number
          salary_gross?: number | null
          salary_mode?: string | null
          salary_net?: number | null
          salary_type?: string
          status?: string
          target_duration?: string | null
          target_value?: number | null
          tax_applicable?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_secret: string
          created_at: string
          endpoint: string
          failure_count: number
          id: string
          last_success_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_secret: string
          created_at?: string
          endpoint: string
          failure_count?: number
          id?: string
          last_success_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_secret?: string
          created_at?: string
          endpoint?: string
          failure_count?: number
          id?: string
          last_success_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_export: boolean
          can_view: boolean
          page: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          page: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          page?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      security_audit_events: {
        Row: {
          created_at: string
          detail: Json
          id: string
          ip: string | null
          kind: string
          path: string | null
          severity: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          id?: string
          ip?: string | null
          kind: string
          path?: string | null
          severity?: string
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: string
          ip?: string | null
          kind?: string
          path?: string | null
          severity?: string
        }
        Relationships: []
      }
      security_blocklist: {
        Row: {
          blocked_at: string
          blocked_until: string | null
          created_by: string | null
          hit_count: number
          id: string
          ip: string
          manual: boolean
          notes: string | null
          reason: string
        }
        Insert: {
          blocked_at?: string
          blocked_until?: string | null
          created_by?: string | null
          hit_count?: number
          id?: string
          ip: string
          manual?: boolean
          notes?: string | null
          reason?: string
        }
        Update: {
          blocked_at?: string
          blocked_until?: string | null
          created_by?: string | null
          hit_count?: number
          id?: string
          ip?: string
          manual?: boolean
          notes?: string | null
          reason?: string
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          block_sql_keywords: boolean
          cdn_subresource_integrity: boolean
          csp_enabled: boolean
          enforce_2fa: boolean
          hsts_enabled: boolean
          id: number
          ip_allowlist: string[]
          permissions_policy: string
          rate_limit_per_min: number
          referrer_policy: string
          sanitize_html_inputs: boolean
          session_timeout_minutes: number
          updated_at: string
          updated_by: string | null
          x_frame_deny: boolean
        }
        Insert: {
          block_sql_keywords?: boolean
          cdn_subresource_integrity?: boolean
          csp_enabled?: boolean
          enforce_2fa?: boolean
          hsts_enabled?: boolean
          id?: number
          ip_allowlist?: string[]
          permissions_policy?: string
          rate_limit_per_min?: number
          referrer_policy?: string
          sanitize_html_inputs?: boolean
          session_timeout_minutes?: number
          updated_at?: string
          updated_by?: string | null
          x_frame_deny?: boolean
        }
        Update: {
          block_sql_keywords?: boolean
          cdn_subresource_integrity?: boolean
          csp_enabled?: boolean
          enforce_2fa?: boolean
          hsts_enabled?: boolean
          id?: number
          ip_allowlist?: string[]
          permissions_policy?: string
          rate_limit_per_min?: number
          referrer_policy?: string
          sanitize_html_inputs?: boolean
          session_timeout_minutes?: number
          updated_at?: string
          updated_by?: string | null
          x_frame_deny?: boolean
        }
        Relationships: []
      }
      shifts: {
        Row: {
          created_at: string
          end_time: string
          grace_minutes: number
          id: string
          is_active: boolean
          is_overnight: boolean
          name: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          grace_minutes?: number
          id?: string
          is_active?: boolean
          is_overnight?: boolean
          name: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          grace_minutes?: number
          id?: string
          is_active?: boolean
          is_overnight?: boolean
          name?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      smtp_config: {
        Row: {
          from_email: string
          from_name: string
          host: string
          id: number
          password_encrypted: string | null
          port: number
          secure: boolean
          updated_at: string
          updated_by: string | null
          username: string
        }
        Insert: {
          from_email?: string
          from_name?: string
          host?: string
          id?: number
          password_encrypted?: string | null
          port?: number
          secure?: boolean
          updated_at?: string
          updated_by?: string | null
          username?: string
        }
        Update: {
          from_email?: string
          from_name?: string
          host?: string
          id?: number
          password_encrypted?: string | null
          port?: number
          secure?: boolean
          updated_at?: string
          updated_by?: string | null
          username?: string
        }
        Relationships: []
      }
      targets_overtime: {
        Row: {
          created_at: string
          daily_target_hours: number
          id: string
          is_active: boolean
          name: string
          overtime_cap_hours: number
          overtime_rate: number
          updated_at: string
          weekly_target_hours: number
        }
        Insert: {
          created_at?: string
          daily_target_hours?: number
          id?: string
          is_active?: boolean
          name: string
          overtime_cap_hours?: number
          overtime_rate?: number
          updated_at?: string
          weekly_target_hours?: number
        }
        Update: {
          created_at?: string
          daily_target_hours?: number
          id?: string
          is_active?: boolean
          name?: string
          overtime_cap_hours?: number
          overtime_rate?: number
          updated_at?: string
          weekly_target_hours?: number
        }
        Relationships: []
      }
      task_activity: {
        Row: {
          city: string | null
          created_at: string
          district: string | null
          employee_id: string
          id: string
          kind: string
          lat: number | null
          lng: number | null
          note: string | null
          occurred_at: string
          task_id: string | null
          task_name: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          district?: string | null
          employee_id: string
          id?: string
          kind: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          occurred_at?: string
          task_id?: string | null
          task_name?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          district?: string | null
          employee_id?: string
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          occurred_at?: string
          task_id?: string | null
          task_name?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          address: string | null
          assignees: string[]
          city: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          district: string | null
          due_date: string | null
          due_time: string | null
          estimated_hours: number | null
          id: string
          priority: string
          started_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          assignees?: string[]
          city?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          district?: string | null
          due_date?: string | null
          due_time?: string | null
          estimated_hours?: number | null
          id?: string
          priority?: string
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          assignees?: string[]
          city?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          district?: string | null
          due_date?: string | null
          due_time?: string | null
          estimated_hours?: number | null
          id?: string
          priority?: string
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_brackets: {
        Row: {
          created_at: string
          effective_date: string
          from_amount: number
          id: string
          tax_rate: number
          to_amount: number | null
        }
        Insert: {
          created_at?: string
          effective_date: string
          from_amount: number
          id?: string
          tax_rate: number
          to_amount?: number | null
        }
        Update: {
          created_at?: string
          effective_date?: string
          from_amount?: number
          id?: string
          tax_rate?: number
          to_amount?: number | null
        }
        Relationships: []
      }
      trips: {
        Row: {
          address: string | null
          assignee: string
          completed_at: string | null
          created_at: string
          created_by: string
          destination: string
          id: string
          notes: string | null
          purpose: string | null
          started_at: string | null
          status: string
          trip_date: string
          trip_time: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          assignee: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          destination: string
          id?: string
          notes?: string | null
          purpose?: string | null
          started_at?: string | null
          status?: string
          trip_date: string
          trip_time?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          assignee?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          destination?: string
          id?: string
          notes?: string | null
          purpose?: string | null
          started_at?: string | null
          status?: string
          trip_date?: string
          trip_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_assignee_fkey"
            columns: ["assignee"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_overrides: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_export: boolean | null
          can_view: boolean | null
          page: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_export?: boolean | null
          can_view?: boolean | null
          page: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_export?: boolean | null
          can_view?: boolean | null
          page?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webauthn_challenges: {
        Row: {
          challenge: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          kind: string
          user_id: string | null
        }
        Insert: {
          challenge: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          kind: string
          user_id?: string | null
        }
        Update: {
          challenge?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          kind?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webauthn_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webauthn_credentials: {
        Row: {
          counter: number
          created_at: string
          credential_id: string
          device_label: string | null
          id: string
          last_used_at: string | null
          public_key: string
          transports: string[] | null
          user_id: string
        }
        Insert: {
          counter?: number
          created_at?: string
          credential_id: string
          device_label?: string | null
          id?: string
          last_used_at?: string | null
          public_key: string
          transports?: string[] | null
          user_id: string
        }
        Update: {
          counter?: number
          created_at?: string
          credential_id?: string
          device_label?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webauthn_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_permission: {
        Args: { _action: string; _page: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_employee_profile: {
        Args: {
          _avatar_url?: string
          _city?: string
          _department_id?: string
          _district?: string
          _email: string
          _full_name: string
          _phone?: string
          _position_id?: string
          _role?: Database["public"]["Enums"]["app_role"]
          _status?: string
        }
        Returns: string
      }
      security_scan_exec: { Args: { _sql: string }; Returns: undefined }
      security_scan_query: { Args: { _sql: string }; Returns: Json[] }
      smtp_config_decrypt: {
        Args: { _key: string }
        Returns: {
          from_email: string
          from_name: string
          host: string
          password: string
          port: number
          secure: boolean
          username: string
        }[]
      }
      smtp_config_set_password: {
        Args: { _key: string; _password: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "hr" | "manager" | "employee" | "staff" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "hr", "manager", "employee", "staff", "user"],
    },
  },
} as const
