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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      appointment_reminders: {
        Row: {
          appointment_id: string
          created_at: string
          id: string
          reminder_type: string
          sent_at: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          id?: string
          reminder_type: string
          sent_at?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          id?: string
          reminder_type?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_slots: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string | null
          current_bookings: number
          end_time: string
          health_unit_id: string | null
          id: string
          max_bookings: number
          municipality_id: string
          professional_name: string | null
          slot_date: string
          specialty_id: string
          start_time: string
        }
        Insert: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string | null
          current_bookings?: number
          end_time: string
          health_unit_id?: string | null
          id?: string
          max_bookings?: number
          municipality_id: string
          professional_name?: string | null
          slot_date: string
          specialty_id: string
          start_time: string
        }
        Update: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string | null
          current_bookings?: number
          end_time?: string
          health_unit_id?: string | null
          id?: string
          max_bookings?: number
          municipality_id?: string
          professional_name?: string | null
          slot_date?: string
          specialty_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_slots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_slots_health_unit_id_fkey"
            columns: ["health_unit_id"]
            isOneToOne: false
            referencedRelation: "health_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_slots_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_slots_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          clinic_name: string | null
          company_id: string | null
          created_at: string
          doctor_name: string | null
          id: string
          municipality_id: string | null
          notes: string | null
          slot_id: string | null
          specialty: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_date: string
          clinic_name?: string | null
          company_id?: string | null
          created_at?: string
          doctor_name?: string | null
          id?: string
          municipality_id?: string | null
          notes?: string | null
          slot_id?: string | null
          specialty: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_date?: string
          clinic_name?: string | null
          company_id?: string | null
          created_at?: string
          doctor_name?: string | null
          id?: string
          municipality_id?: string | null
          notes?: string | null
          slot_id?: string | null
          specialty?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "appointment_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_missions: {
        Row: {
          campaign_id: string
          created_at: string | null
          id: string
          mission_id: string
          sort_order: number | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          id?: string
          mission_id: string
          sort_order?: number | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          id?: string
          mission_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_missions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_missions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "company_campaign_summary"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "campaign_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_participants: {
        Row: {
          badge_awarded: boolean | null
          campaign_id: string
          completed_at: string | null
          id: string
          joined_at: string | null
          points_earned: number | null
          user_id: string
        }
        Insert: {
          badge_awarded?: boolean | null
          campaign_id: string
          completed_at?: string | null
          id?: string
          joined_at?: string | null
          points_earned?: number | null
          user_id: string
        }
        Update: {
          badge_awarded?: boolean | null
          campaign_id?: string
          completed_at?: string | null
          id?: string
          joined_at?: string | null
          points_earned?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_participants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_participants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "company_campaign_summary"
            referencedColumns: ["campaign_id"]
          },
        ]
      }
      campaigns: {
        Row: {
          active: boolean | null
          badge_emoji: string | null
          badge_name: string | null
          bonus_points: number | null
          category: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          emoji: string | null
          ends_at: string
          id: string
          program_id: string | null
          starts_at: string
          title: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          badge_emoji?: string | null
          badge_name?: string | null
          bonus_points?: number | null
          category?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          emoji?: string | null
          ends_at: string
          id?: string
          program_id?: string | null
          starts_at: string
          title: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          badge_emoji?: string | null
          badge_name?: string | null
          bonus_points?: number | null
          category?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          emoji?: string | null
          ends_at?: string
          id?: string
          program_id?: string | null
          starts_at?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "company_program_summary"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "campaigns_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "wellbeing_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborative_teams: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string
          emoji: string | null
          id: string
          is_default: boolean | null
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by: string
          emoji?: string | null
          id?: string
          is_default?: boolean | null
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string
          emoji?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborative_teams_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          accent_color: string
          background_color: string
          cnae: string | null
          cnpj: string | null
          created_at: string
          employee_count: number | null
          foreground_color: string
          hr_contact_email: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          plan_type: string | null
          primary_color: string
          rppg_url: string | null
          secondary_color: string
          slug: string
          state: string
          telemedicine_url: string | null
          updated_at: string
          wellbeing_program_name: string | null
        }
        Insert: {
          accent_color?: string
          background_color?: string
          cnae?: string | null
          cnpj?: string | null
          created_at?: string
          employee_count?: number | null
          foreground_color?: string
          hr_contact_email?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          plan_type?: string | null
          primary_color?: string
          rppg_url?: string | null
          secondary_color?: string
          slug: string
          state?: string
          telemedicine_url?: string | null
          updated_at?: string
          wellbeing_program_name?: string | null
        }
        Update: {
          accent_color?: string
          background_color?: string
          cnae?: string | null
          cnpj?: string | null
          created_at?: string
          employee_count?: number | null
          foreground_color?: string
          hr_contact_email?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          plan_type?: string | null
          primary_color?: string
          rppg_url?: string | null
          secondary_color?: string
          slug?: string
          state?: string
          telemedicine_url?: string | null
          updated_at?: string
          wellbeing_program_name?: string | null
        }
        Relationships: []
      }
      company_features: {
        Row: {
          company_id: string
          config: Json | null
          created_at: string | null
          enabled: boolean | null
          feature_key: string
          id: string
        }
        Insert: {
          company_id: string
          config?: Json | null
          created_at?: string | null
          enabled?: boolean | null
          feature_key: string
          id?: string
        }
        Update: {
          company_id?: string
          config?: Json | null
          created_at?: string | null
          enabled?: boolean | null
          feature_key?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_features_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_locations: {
        Row: {
          active: boolean | null
          address: string | null
          cnes_code: string | null
          company_id: string
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          qr_code: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          cnes_code?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          qr_code: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          cnes_code?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          qr_code?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          call_duration_seconds: number | null
          company_id: string | null
          consultation_flow_type: Database["public"]["Enums"]["consultation_flow_type"]
          consultation_mode: string
          created_at: string
          ended_at: string | null
          id: string
          jitsi_room_name: string | null
          join_window_starts_at: string | null
          municipality_id: string | null
          professional_id: string
          professional_type: Database["public"]["Enums"]["consultation_professional_type"]
          queue_position: number | null
          scheduled_at: string | null
          specialty: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["consultation_status"]
          triage_notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          call_duration_seconds?: number | null
          company_id?: string | null
          consultation_flow_type?: Database["public"]["Enums"]["consultation_flow_type"]
          consultation_mode?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          jitsi_room_name?: string | null
          join_window_starts_at?: string | null
          municipality_id?: string | null
          professional_id: string
          professional_type?: Database["public"]["Enums"]["consultation_professional_type"]
          queue_position?: number | null
          scheduled_at?: string | null
          specialty?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["consultation_status"]
          triage_notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          call_duration_seconds?: number | null
          company_id?: string | null
          consultation_flow_type?: Database["public"]["Enums"]["consultation_flow_type"]
          consultation_mode?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          jitsi_room_name?: string | null
          join_window_starts_at?: string | null
          municipality_id?: string | null
          professional_id?: string
          professional_type?: Database["public"]["Enums"]["consultation_professional_type"]
          queue_position?: number | null
          scheduled_at?: string | null
          specialty?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["consultation_status"]
          triage_notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_availability: {
        Row: {
          consultation_mode: string | null
          created_at: string | null
          end_time: string
          id: string
          is_active: boolean | null
          partner_id: string
          slot_duration_minutes: number
          specialty: string | null
          start_time: string
          weekday: number
        }
        Insert: {
          consultation_mode?: string | null
          created_at?: string | null
          end_time: string
          id?: string
          is_active?: boolean | null
          partner_id: string
          slot_duration_minutes?: number
          specialty?: string | null
          start_time: string
          weekday: number
        }
        Update: {
          consultation_mode?: string | null
          created_at?: string | null
          end_time?: string
          id?: string
          is_active?: boolean | null
          partner_id?: string
          slot_duration_minutes?: number
          specialty?: string | null
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "doctor_availability_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      esf_teams: {
        Row: {
          active: boolean | null
          address: string | null
          cnes_code: string
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          municipality_id: string
          name: string
          qr_code: string
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          cnes_code: string
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          municipality_id: string
          name: string
          qr_code: string
        }
        Update: {
          active?: boolean | null
          address?: string | null
          cnes_code?: string
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          municipality_id?: string
          name?: string
          qr_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "esf_teams_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      health_measurements: {
        Row: {
          blood_pressure_dia: number | null
          blood_pressure_sys: number | null
          created_at: string
          heart_rate: number | null
          id: string
          measured_at: string
          measurement_type: string
          notes: string | null
          respiratory_rate: number | null
          source: string | null
          spo2: number | null
          stress_level: number | null
          user_id: string
        }
        Insert: {
          blood_pressure_dia?: number | null
          blood_pressure_sys?: number | null
          created_at?: string
          heart_rate?: number | null
          id?: string
          measured_at?: string
          measurement_type: string
          notes?: string | null
          respiratory_rate?: number | null
          source?: string | null
          spo2?: number | null
          stress_level?: number | null
          user_id: string
        }
        Update: {
          blood_pressure_dia?: number | null
          blood_pressure_sys?: number | null
          created_at?: string
          heart_rate?: number | null
          id?: string
          measured_at?: string
          measurement_type?: string
          notes?: string | null
          respiratory_rate?: number | null
          source?: string | null
          spo2?: number | null
          stress_level?: number | null
          user_id?: string
        }
        Relationships: []
      }
      health_units: {
        Row: {
          active: boolean | null
          address: string | null
          cnes_code: string | null
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          municipality_id: string | null
          name: string
          qr_code: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          cnes_code?: string | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          municipality_id?: string | null
          name: string
          qr_code: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          cnes_code?: string | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          municipality_id?: string | null
          name?: string
          qr_code?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_units_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_validations: {
        Row: {
          created_at: string | null
          health_unit_id: string | null
          id: string
          photo_url: string | null
          status: string | null
          user_id: string
          user_mission_id: string
          validated_at: string | null
          validated_by: string | null
          validation_type: string
        }
        Insert: {
          created_at?: string | null
          health_unit_id?: string | null
          id?: string
          photo_url?: string | null
          status?: string | null
          user_id: string
          user_mission_id: string
          validated_at?: string | null
          validated_by?: string | null
          validation_type: string
        }
        Update: {
          created_at?: string | null
          health_unit_id?: string | null
          id?: string
          photo_url?: string | null
          status?: string | null
          user_id?: string
          user_mission_id?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_validations_health_unit_id_fkey"
            columns: ["health_unit_id"]
            isOneToOne: false
            referencedRelation: "health_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_validations_user_mission_id_fkey"
            columns: ["user_mission_id"]
            isOneToOne: false
            referencedRelation: "user_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          emoji: string | null
          frequency: string | null
          id: string
          points: number | null
          priority: number | null
          questionnaire_id: string | null
          tag: string
          title: string
          validation_type: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          frequency?: string | null
          id?: string
          points?: number | null
          priority?: number | null
          questionnaire_id?: string | null
          tag: string
          title: string
          validation_type?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          frequency?: string | null
          id?: string
          points?: number | null
          priority?: number | null
          questionnaire_id?: string | null
          tag?: string
          title?: string
          validation_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
        ]
      }
      municipalities: {
        Row: {
          accent_color: string
          background_color: string
          codigo_ibge: number | null
          created_at: string
          foreground_color: string
          id: string
          logo_url: string | null
          name: string
          primary_color: string
          rppg_url: string | null
          secondary_color: string
          secretaria: string
          slug: string
          state: string
          telemedicine_url: string | null
          ubs_email: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string
          background_color?: string
          codigo_ibge?: number | null
          created_at?: string
          foreground_color?: string
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string
          rppg_url?: string | null
          secondary_color?: string
          secretaria?: string
          slug: string
          state?: string
          telemedicine_url?: string | null
          ubs_email?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string
          background_color?: string
          codigo_ibge?: number | null
          created_at?: string
          foreground_color?: string
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string
          rppg_url?: string | null
          secondary_color?: string
          secretaria?: string
          slug?: string
          state?: string
          telemedicine_url?: string | null
          ubs_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      municipality_features: {
        Row: {
          config: Json | null
          created_at: string | null
          enabled: boolean | null
          feature_key: string
          id: string
          municipality_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          enabled?: boolean | null
          feature_key: string
          id?: string
          municipality_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          enabled?: boolean | null
          feature_key?: string
          id?: string
          municipality_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipality_features_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          active: boolean | null
          body: string | null
          color: string | null
          company_id: string | null
          created_at: string | null
          created_by: string
          emoji: string | null
          expires_at: string | null
          external_url: string | null
          id: string
          municipality_id: string | null
          priority: number | null
          scope: string
          target_user_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          body?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by: string
          emoji?: string | null
          expires_at?: string | null
          external_url?: string | null
          id?: string
          municipality_id?: string | null
          priority?: number | null
          scope?: string
          target_user_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          body?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string
          emoji?: string | null
          expires_at?: string | null
          external_url?: string | null
          id?: string
          municipality_id?: string | null
          priority?: number | null
          scope?: string
          target_user_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_doctor_links: {
        Row: {
          clinic_id: string
          created_at: string | null
          doctor_id: string
          id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          id?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_doctor_links_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_doctor_links_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_locations: {
        Row: {
          city: string | null
          created_at: string | null
          full_address: string | null
          id: string
          is_main: boolean | null
          latitude: number | null
          location_name: string | null
          longitude: number | null
          partner_id: string
          state: string | null
          zip_code: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          full_address?: string | null
          id?: string
          is_main?: boolean | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          partner_id: string
          state?: string | null
          zip_code?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          full_address?: string | null
          id?: string
          is_main?: boolean | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          partner_id?: string
          state?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_locations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          accepted_payments: Json | null
          active: boolean | null
          appointment_only: boolean | null
          approval_status: Database["public"]["Enums"]["approval_status"] | null
          booking_link: string | null
          city: string | null
          collection_methods: Json | null
          consultation_price: number | null
          consultation_type: string | null
          contact_link: string | null
          created_at: string | null
          crm: string | null
          crm_state: string | null
          delivery_available: boolean | null
          description: string | null
          email: string | null
          exam_types: Json | null
          full_address: string | null
          id: string
          is_partner_gym: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          notification_email: string | null
          online_consultation_enabled: boolean | null
          opening_hours: Json | null
          partner_type: Database["public"]["Enums"]["partner_type"]
          phone: string | null
          scheduling_link: string | null
          service_mode: string | null
          service_notes: string | null
          services_offered: Json | null
          specialties_offered: Json | null
          specialty: string | null
          state: string | null
          sub_specialty: string | null
          updated_at: string | null
          user_id: string | null
          virtual_store_url: string | null
          wellness_activities: Json | null
          zip_code: string | null
        }
        Insert: {
          accepted_payments?: Json | null
          active?: boolean | null
          appointment_only?: boolean | null
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          booking_link?: string | null
          city?: string | null
          collection_methods?: Json | null
          consultation_price?: number | null
          consultation_type?: string | null
          contact_link?: string | null
          created_at?: string | null
          crm?: string | null
          crm_state?: string | null
          delivery_available?: boolean | null
          description?: string | null
          email?: string | null
          exam_types?: Json | null
          full_address?: string | null
          id?: string
          is_partner_gym?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          notification_email?: string | null
          online_consultation_enabled?: boolean | null
          opening_hours?: Json | null
          partner_type: Database["public"]["Enums"]["partner_type"]
          phone?: string | null
          scheduling_link?: string | null
          service_mode?: string | null
          service_notes?: string | null
          services_offered?: Json | null
          specialties_offered?: Json | null
          specialty?: string | null
          state?: string | null
          sub_specialty?: string | null
          updated_at?: string | null
          user_id?: string | null
          virtual_store_url?: string | null
          wellness_activities?: Json | null
          zip_code?: string | null
        }
        Update: {
          accepted_payments?: Json | null
          active?: boolean | null
          appointment_only?: boolean | null
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          booking_link?: string | null
          city?: string | null
          collection_methods?: Json | null
          consultation_price?: number | null
          consultation_type?: string | null
          contact_link?: string | null
          created_at?: string | null
          crm?: string | null
          crm_state?: string | null
          delivery_available?: boolean | null
          description?: string | null
          email?: string | null
          exam_types?: Json | null
          full_address?: string | null
          id?: string
          is_partner_gym?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          notification_email?: string | null
          online_consultation_enabled?: boolean | null
          opening_hours?: Json | null
          partner_type?: Database["public"]["Enums"]["partner_type"]
          phone?: string | null
          scheduling_link?: string | null
          service_mode?: string | null
          service_notes?: string | null
          services_offered?: Json | null
          specialties_offered?: Json | null
          specialty?: string | null
          state?: string | null
          sub_specialty?: string | null
          updated_at?: string | null
          user_id?: string | null
          virtual_store_url?: string | null
          wellness_activities?: Json | null
          zip_code?: string | null
        }
        Relationships: []
      }
      professional_online_status: {
        Row: {
          accepts_on_demand: boolean
          always_available: boolean
          created_at: string
          estimated_response_minutes: number
          id: string
          last_seen_at: string | null
          max_parallel_waiting: number
          online_now: boolean
          professional_id: string
          updated_at: string
        }
        Insert: {
          accepts_on_demand?: boolean
          always_available?: boolean
          created_at?: string
          estimated_response_minutes?: number
          id?: string
          last_seen_at?: string | null
          max_parallel_waiting?: number
          online_now?: boolean
          professional_id: string
          updated_at?: string
        }
        Update: {
          accepts_on_demand?: boolean
          always_available?: boolean
          created_at?: string
          estimated_response_minutes?: number
          id?: string
          last_seen_at?: string | null
          max_parallel_waiting?: number
          online_now?: boolean
          professional_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_online_status_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          altura: number | null
          avatar_url: string | null
          bairro: string | null
          biological_sex: string | null
          birth_date: string | null
          cep: string | null
          cidade: string | null
          company_id: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          department: string | null
          endereco: string | null
          esf_team_id: string | null
          estado: string | null
          full_name: string | null
          has_bedridden_at_home: boolean | null
          has_child_under_12: boolean | null
          has_child_under_5: boolean | null
          has_diabetes: boolean | null
          has_hypertension: boolean | null
          has_pregnant_at_home: boolean | null
          health_survey_completed: boolean | null
          health_survey_completed_at: string | null
          id: string
          is_bolsa_familia: boolean | null
          is_pregnant: string | null
          job_title: string | null
          last_acs_visit: boolean | null
          last_dental_visit: string | null
          level: string
          lives_with_infant: boolean | null
          mental_anxiety: number | null
          mental_mood: number | null
          mental_sleep: number | null
          mental_social: number | null
          mental_stress: number | null
          municipality_id: string | null
          numero: string | null
          peso: number | null
          phone: string | null
          points: number
          prenatal_dental_done: boolean | null
          prenatal_started: boolean | null
          support_team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          altura?: number | null
          avatar_url?: string | null
          bairro?: string | null
          biological_sex?: string | null
          birth_date?: string | null
          cep?: string | null
          cidade?: string | null
          company_id?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          department?: string | null
          endereco?: string | null
          esf_team_id?: string | null
          estado?: string | null
          full_name?: string | null
          has_bedridden_at_home?: boolean | null
          has_child_under_12?: boolean | null
          has_child_under_5?: boolean | null
          has_diabetes?: boolean | null
          has_hypertension?: boolean | null
          has_pregnant_at_home?: boolean | null
          health_survey_completed?: boolean | null
          health_survey_completed_at?: string | null
          id?: string
          is_bolsa_familia?: boolean | null
          is_pregnant?: string | null
          job_title?: string | null
          last_acs_visit?: boolean | null
          last_dental_visit?: string | null
          level?: string
          lives_with_infant?: boolean | null
          mental_anxiety?: number | null
          mental_mood?: number | null
          mental_sleep?: number | null
          mental_social?: number | null
          mental_stress?: number | null
          municipality_id?: string | null
          numero?: string | null
          peso?: number | null
          phone?: string | null
          points?: number
          prenatal_dental_done?: boolean | null
          prenatal_started?: boolean | null
          support_team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          altura?: number | null
          avatar_url?: string | null
          bairro?: string | null
          biological_sex?: string | null
          birth_date?: string | null
          cep?: string | null
          cidade?: string | null
          company_id?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          department?: string | null
          endereco?: string | null
          esf_team_id?: string | null
          estado?: string | null
          full_name?: string | null
          has_bedridden_at_home?: boolean | null
          has_child_under_12?: boolean | null
          has_child_under_5?: boolean | null
          has_diabetes?: boolean | null
          has_hypertension?: boolean | null
          has_pregnant_at_home?: boolean | null
          health_survey_completed?: boolean | null
          health_survey_completed_at?: string | null
          id?: string
          is_bolsa_familia?: boolean | null
          is_pregnant?: string | null
          job_title?: string | null
          last_acs_visit?: boolean | null
          last_dental_visit?: string | null
          level?: string
          lives_with_infant?: boolean | null
          mental_anxiety?: number | null
          mental_mood?: number | null
          mental_sleep?: number | null
          mental_social?: number | null
          mental_stress?: number | null
          municipality_id?: string | null
          numero?: string | null
          peso?: number | null
          phone?: string | null
          points?: number
          prenatal_dental_done?: boolean | null
          prenatal_started?: boolean | null
          support_team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_esf_team_id_fkey"
            columns: ["esf_team_id"]
            isOneToOne: false
            referencedRelation: "esf_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_support_team_id_fkey"
            columns: ["support_team_id"]
            isOneToOne: false
            referencedRelation: "support_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      program_missions: {
        Row: {
          created_at: string | null
          id: string
          mission_id: string
          program_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mission_id: string
          program_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mission_id?: string
          program_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "program_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_missions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "company_program_summary"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_missions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "wellbeing_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_questions: {
        Row: {
          category: string
          created_at: string | null
          id: string
          options: Json | null
          question_text: string
          questionnaire_id: string
          sort_order: number | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          id?: string
          options?: Json | null
          question_text: string
          questionnaire_id: string
          sort_order?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          options?: Json | null
          question_text?: string
          questionnaire_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_questions_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_responses: {
        Row: {
          answers: Json
          created_at: string | null
          id: string
          questionnaire_id: string
          user_id: string
          user_mission_id: string | null
        }
        Insert: {
          answers?: Json
          created_at?: string | null
          id?: string
          questionnaire_id: string
          user_id: string
          user_mission_id?: string | null
        }
        Update: {
          answers?: Json
          created_at?: string | null
          id?: string
          questionnaire_id?: string
          user_id?: string
          user_mission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_responses_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_user_mission_id_fkey"
            columns: ["user_mission_id"]
            isOneToOne: false
            referencedRelation: "user_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaires: {
        Row: {
          created_at: string | null
          id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      special_measurements: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          measured_at: string | null
          measurement_data: Json
          municipality_id: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          measured_at?: string | null
          measurement_data?: Json
          municipality_id?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          measured_at?: string | null
          measurement_data?: Json
          municipality_id?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_measurements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_measurements_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      specialties: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string | null
          emoji: string | null
          id: string
          municipality_id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          municipality_id: string
          name: string
        }
        Update: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          municipality_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specialties_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      support_notes: {
        Row: {
          admin_user_id: string
          created_at: string
          id: string
          note: string
          user_id: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          id?: string
          note: string
          user_id: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          id?: string
          note?: string
          user_id?: string
        }
        Relationships: []
      }
      support_teams: {
        Row: {
          active: boolean | null
          address: string | null
          company_id: string
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          qr_code: string
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          qr_code: string
        }
        Update: {
          active?: boolean | null
          address?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          qr_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_teams_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          joined_at: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "collaborative_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_missions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          mission_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          mission_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          mission_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wellbeing_checkins: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          mood: number | null
          notes: string | null
          sleep_quality: number | null
          stress_level: number | null
          user_id: string
          week_start: string
          workload: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          mood?: number | null
          notes?: string | null
          sleep_quality?: number | null
          stress_level?: number | null
          user_id: string
          week_start?: string
          workload?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          mood?: number | null
          notes?: string | null
          sleep_quality?: number | null
          stress_level?: number | null
          user_id?: string
          week_start?: string
          workload?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wellbeing_checkins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      wellbeing_programs: {
        Row: {
          active: boolean | null
          category: string
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          emoji: string | null
          ends_at: string | null
          id: string
          starts_at: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          category?: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          emoji?: string | null
          ends_at?: string | null
          id?: string
          starts_at?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          emoji?: string | null
          ends_at?: string | null
          id?: string
          starts_at?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wellbeing_programs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      company_campaign_summary: {
        Row: {
          badges_awarded: number | null
          campaign_id: string | null
          company_id: string | null
          ends_at: string | null
          starts_at: string | null
          title: string | null
          total_completed: number | null
          total_participants: number | null
          total_points_awarded: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_health_summary: {
        Row: {
          active_users: number | null
          avg_heart_rate: number | null
          avg_spo2: number | null
          avg_stress_level: number | null
          company_id: string | null
          week: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_program_summary: {
        Row: {
          active: boolean | null
          category: string | null
          company_id: string | null
          completed_missions: number | null
          participants: number | null
          program_id: string | null
          title: string | null
          total_missions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wellbeing_programs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_wellbeing_summary: {
        Row: {
          avg_mood: number | null
          avg_sleep: number | null
          avg_stress: number | null
          avg_workload: number | null
          company_id: string | null
          total_checkins: number | null
          unique_participants: number | null
          week_start: string | null
          wellbeing_index: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wellbeing_checkins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_company_wellbeing_summary: {
        Args: { _company_id: string }
        Returns: {
          avg_mood: number
          avg_sleep: number
          avg_stress: number
          avg_workload: number
          total_checkins: number
          unique_participants: number
          week_start: string
          wellbeing_index: number
        }[]
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_user_municipality_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_admin: { Args: { _user_id: string }; Returns: boolean }
      is_hr_manager: { Args: { _user_id: string }; Returns: boolean }
      is_wellbeing_manager: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "user"
        | "company_admin"
        | "hr_manager"
        | "wellbeing_manager"
        | "employee"
      approval_status: "pending" | "approved" | "blocked"
      consultation_flow_type: "scheduled" | "on_demand"
      consultation_professional_type: "doctor" | "nurse"
      consultation_status:
        | "pending"
        | "confirmed"
        | "waiting"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
        | "finished"
        | "missed"
      partner_type: "doctor" | "clinic" | "gym" | "laboratory" | "pharmacy"
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
      app_role: [
        "admin",
        "manager",
        "user",
        "company_admin",
        "hr_manager",
        "wellbeing_manager",
        "employee",
      ],
      approval_status: ["pending", "approved", "blocked"],
      consultation_flow_type: ["scheduled", "on_demand"],
      consultation_professional_type: ["doctor", "nurse"],
      consultation_status: [
        "pending",
        "confirmed",
        "waiting",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
        "finished",
        "missed",
      ],
      partner_type: ["doctor", "clinic", "gym", "laboratory", "pharmacy"],
    },
  },
} as const
