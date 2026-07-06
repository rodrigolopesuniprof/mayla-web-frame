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
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          amount_cents: number
          commission_percent: number
          created_at: string
          id: string
          invoice_id: string | null
          pagarme_split_id: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["commission_status"]
          subscription_id: string
        }
        Insert: {
          affiliate_id: string
          amount_cents: number
          commission_percent: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          pagarme_split_id?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          subscription_id: string
        }
        Update: {
          affiliate_id?: string
          amount_cents?: number
          commission_percent?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          pagarme_split_id?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          active: boolean
          bank_account: Json | null
          commission_percent: number
          company_id: string | null
          cpf_cnpj: string
          created_at: string
          email: string
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          name: string
          notes: string | null
          pagarme_recipient_id: string | null
          phone: string | null
          referral_code: string
          register_info: Json | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          bank_account?: Json | null
          commission_percent?: number
          company_id?: string | null
          cpf_cnpj: string
          created_at?: string
          email: string
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          name: string
          notes?: string | null
          pagarme_recipient_id?: string | null
          phone?: string | null
          referral_code: string
          register_info?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          bank_account?: Json | null
          commission_percent?: number
          company_id?: string | null
          cpf_cnpj?: string
          created_at?: string
          email?: string
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          name?: string
          notes?: string | null
          pagarme_recipient_id?: string | null
          phone?: string | null
          referral_code?: string
          register_info?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
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
          external_appointment_id: string | null
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
          external_appointment_id?: string | null
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
          external_appointment_id?: string | null
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
      assistant_conversations: {
        Row: {
          company_id: string | null
          created_at: string
          health_context_snapshot: Json | null
          id: string
          last_message_at: string
          message_count: number
          started_at: string
          topic_tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          health_context_snapshot?: Json | null
          id?: string
          last_message_at?: string
          message_count?: number
          started_at?: string
          topic_tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          health_context_snapshot?: Json | null
          id?: string
          last_message_at?: string
          message_count?: number
          started_at?: string
          topic_tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          message_id: string
          rating: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          message_id: string
          rating: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          message_id?: string
          rating?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "assistant_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          latency_ms: number | null
          model: string | null
          role: string
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          role: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          role?: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_prompts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          model: string
          name: string
          system_prompt: string
          temperature: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          model?: string
          name: string
          system_prompt: string
          temperature?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          model?: string
          name?: string
          system_prompt?: string
          temperature?: number
          updated_at?: string
        }
        Relationships: []
      }
      assistant_safety_flags: {
        Row: {
          created_at: string
          details: Json | null
          flag_type: string
          id: string
          message_id: string
          reviewed: boolean | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          flag_type: string
          id?: string
          message_id: string
          reviewed?: boolean | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          flag_type?: string
          id?: string
          message_id?: string
          reviewed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_safety_flags_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "assistant_messages"
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
          completion_criteria: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          emoji: string | null
          ends_at: string
          how_to_participate: string | null
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
          completion_criteria?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          emoji?: string | null
          ends_at: string
          how_to_participate?: string | null
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
          completion_criteria?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          emoji?: string | null
          ends_at?: string
          how_to_participate?: string | null
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
      clinical_notes: {
        Row: {
          conditions_active: Json | null
          consultation_id: string | null
          created_at: string
          id: string
          medications: Json | null
          note_text: string | null
          professional_id: string | null
          referrals: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conditions_active?: Json | null
          consultation_id?: string | null
          created_at?: string
          id?: string
          medications?: Json | null
          note_text?: string | null
          professional_id?: string | null
          referrals?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conditions_active?: Json | null
          consultation_id?: string | null
          created_at?: string
          id?: string
          medications?: Json | null
          note_text?: string | null
          professional_id?: string | null
          referrals?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clinical_profile_field_config: {
        Row: {
          company_id: string | null
          created_at: string
          field_key: string
          id: string
          label: string
          section: string
          sort_order: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          field_key: string
          id?: string
          label: string
          section: string
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          company_id?: string | null
          created_at?: string
          field_key?: string
          id?: string
          label?: string
          section?: string
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clinical_profile_field_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          leagues_enabled: boolean
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
          leagues_enabled?: boolean
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
          leagues_enabled?: boolean
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
      company_invite_tokens: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          token: string
          uses_count: number
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          token?: string
          uses_count?: number
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          token?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_invite_tokens_company_id_fkey"
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
      company_payment_credentials: {
        Row: {
          company_id: string
          created_at: string
          enabled: boolean
          environment: Database["public"]["Enums"]["pagarme_environment"]
          id: string
          pagarme_api_key_encrypted: string | null
          pagarme_public_key: string | null
          pagarme_recipient_id: string | null
          require_paid_subscription: boolean
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          enabled?: boolean
          environment?: Database["public"]["Enums"]["pagarme_environment"]
          id?: string
          pagarme_api_key_encrypted?: string | null
          pagarme_public_key?: string | null
          pagarme_recipient_id?: string | null
          require_paid_subscription?: boolean
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          enabled?: boolean
          environment?: Database["public"]["Enums"]["pagarme_environment"]
          id?: string
          pagarme_api_key_encrypted?: string | null
          pagarme_public_key?: string | null
          pagarme_recipient_id?: string | null
          require_paid_subscription?: boolean
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      company_plan_assignments: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          custom_price_cents: number | null
          id: string
          plan_id: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          custom_price_cents?: number | null
          id?: string
          plan_id: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          custom_price_cents?: number | null
          id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_plan_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      company_point_goals: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          monthly_goal: number
          updated_at: string
          weekly_goal: number
          yearly_goal: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          monthly_goal?: number
          updated_at?: string
          weekly_goal?: number
          yearly_goal?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          monthly_goal?: number
          updated_at?: string
          weekly_goal?: number
          yearly_goal?: number
        }
        Relationships: []
      }
      consultation_documents: {
        Row: {
          consultation_id: string
          content: string | null
          created_at: string
          document_type: string
          file_url: string | null
          id: string
          professional_id: string
          sent_at: string | null
          sent_to_email: boolean
          title: string
          user_id: string
        }
        Insert: {
          consultation_id: string
          content?: string | null
          created_at?: string
          document_type: string
          file_url?: string | null
          id?: string
          professional_id: string
          sent_at?: string | null
          sent_to_email?: boolean
          title: string
          user_id: string
        }
        Update: {
          consultation_id?: string
          content?: string | null
          created_at?: string
          document_type?: string
          file_url?: string | null
          id?: string
          professional_id?: string
          sent_at?: string | null
          sent_to_email?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
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
          room_token: string
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
          room_token?: string
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
          room_token?: string
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
      daily_challenge_assignments: {
        Row: {
          assigned_date: string
          challenge_id: string
          company_id: string
          created_at: string
          id: string
        }
        Insert: {
          assigned_date?: string
          challenge_id: string
          company_id: string
          created_at?: string
          id?: string
        }
        Update: {
          assigned_date?: string
          challenge_id?: string
          company_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_challenge_assignments_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "daily_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_challenge_completions: {
        Row: {
          assignment_id: string
          company_id: string
          completed_at: string
          id: string
          points_awarded: number
          user_id: string
        }
        Insert: {
          assignment_id: string
          company_id: string
          completed_at?: string
          id?: string
          points_awarded?: number
          user_id: string
        }
        Update: {
          assignment_id?: string
          company_id?: string
          completed_at?: string
          id?: string
          points_awarded?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_challenge_completions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "daily_challenge_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_challenges: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          emoji: string | null
          id: string
          points: number
          sort_order: number
          title: string
          updated_at: string
          validation_config: Json | null
          validation_type: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          emoji?: string | null
          id?: string
          points?: number
          sort_order?: number
          title: string
          updated_at?: string
          validation_config?: Json | null
          validation_type?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          emoji?: string | null
          id?: string
          points?: number
          sort_order?: number
          title?: string
          updated_at?: string
          validation_config?: Json | null
          validation_type?: string
        }
        Relationships: []
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
      health_alerts: {
        Row: {
          days_triggered: number | null
          description: string
          detail: string | null
          dismissed_at: string | null
          generated_at: string
          id: string
          metric: string
          severity: string
          user_id: string
        }
        Insert: {
          days_triggered?: number | null
          description: string
          detail?: string | null
          dismissed_at?: string | null
          generated_at?: string
          id?: string
          metric: string
          severity?: string
          user_id: string
        }
        Update: {
          days_triggered?: number | null
          description?: string
          detail?: string | null
          dismissed_at?: string | null
          generated_at?: string
          id?: string
          metric?: string
          severity?: string
          user_id?: string
        }
        Relationships: []
      }
      health_article_views: {
        Row: {
          article_id: string
          completed: boolean | null
          id: string
          read_duration_seconds: number | null
          user_id: string
          viewed_at: string
        }
        Insert: {
          article_id: string
          completed?: boolean | null
          id?: string
          read_duration_seconds?: number | null
          user_id: string
          viewed_at?: string
        }
        Update: {
          article_id?: string
          completed?: boolean | null
          id?: string
          read_duration_seconds?: number | null
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_article_views_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "health_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      health_articles: {
        Row: {
          author_name: string | null
          company_id: string | null
          content_markdown: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          is_active: boolean
          is_global: boolean
          published_at: string | null
          reading_time_minutes: number | null
          slug: string
          sort_order: number | null
          tags: string[] | null
          target_conditions: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          company_id?: string | null
          content_markdown: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_active?: boolean
          is_global?: boolean
          published_at?: string | null
          reading_time_minutes?: number | null
          slug: string
          sort_order?: number | null
          tags?: string[] | null
          target_conditions?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          company_id?: string | null
          content_markdown?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_active?: boolean
          is_global?: boolean
          published_at?: string | null
          reading_time_minutes?: number | null
          slug?: string
          sort_order?: number | null
          tags?: string[] | null
          target_conditions?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_articles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      health_measurements: {
        Row: {
          active_minutes: number | null
          blood_pressure_dia: number | null
          blood_pressure_sys: number | null
          created_at: string
          fatigue_score: number | null
          glucose_estimated: number | null
          heart_rate: number | null
          hrv: number | null
          id: string
          measured_at: string
          measurement_type: string
          notes: string | null
          respiratory_rate: number | null
          sleep_duration_min: number | null
          sleep_quality_score: number | null
          source: string | null
          spo2: number | null
          steps: number | null
          stress_level: number | null
          user_id: string
        }
        Insert: {
          active_minutes?: number | null
          blood_pressure_dia?: number | null
          blood_pressure_sys?: number | null
          created_at?: string
          fatigue_score?: number | null
          glucose_estimated?: number | null
          heart_rate?: number | null
          hrv?: number | null
          id?: string
          measured_at?: string
          measurement_type: string
          notes?: string | null
          respiratory_rate?: number | null
          sleep_duration_min?: number | null
          sleep_quality_score?: number | null
          source?: string | null
          spo2?: number | null
          steps?: number | null
          stress_level?: number | null
          user_id: string
        }
        Update: {
          active_minutes?: number | null
          blood_pressure_dia?: number | null
          blood_pressure_sys?: number | null
          created_at?: string
          fatigue_score?: number | null
          glucose_estimated?: number | null
          heart_rate?: number | null
          hrv?: number | null
          id?: string
          measured_at?: string
          measurement_type?: string
          notes?: string | null
          respiratory_rate?: number | null
          sleep_duration_min?: number | null
          sleep_quality_score?: number | null
          source?: string | null
          spo2?: number | null
          steps?: number | null
          stress_level?: number | null
          user_id?: string
        }
        Relationships: []
      }
      health_scores: {
        Row: {
          generated_at: string
          id: string
          period_end: string
          period_start: string
          recommendation_level: number
          score_emotional: number
          score_general: number
          score_lifestyle: number
          score_physiological: number
          user_id: string
        }
        Insert: {
          generated_at?: string
          id?: string
          period_end: string
          period_start: string
          recommendation_level?: number
          score_emotional?: number
          score_general?: number
          score_lifestyle?: number
          score_physiological?: number
          user_id: string
        }
        Update: {
          generated_at?: string
          id?: string
          period_end?: string
          period_start?: string
          recommendation_level?: number
          score_emotional?: number
          score_general?: number
          score_lifestyle?: number
          score_physiological?: number
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
      league_challenges: {
        Row: {
          alvo: number
          created_at: string
          created_by: string
          id: string
          league_id: string
          metrica: string
          premio: string | null
          titulo: string
          week_id: string
        }
        Insert: {
          alvo: number
          created_at?: string
          created_by: string
          id?: string
          league_id: string
          metrica: string
          premio?: string | null
          titulo: string
          week_id?: string
        }
        Update: {
          alvo?: number
          created_at?: string
          created_by?: string
          id?: string
          league_id?: string
          metrica?: string
          premio?: string | null
          titulo?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_challenges_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_invites: {
        Row: {
          affiliate_code: string
          created_at: string
          id: string
          invitee_contato: string | null
          inviter_id: string
          league_id: string
          status: string
        }
        Insert: {
          affiliate_code: string
          created_at?: string
          id?: string
          invitee_contato?: string | null
          inviter_id: string
          league_id: string
          status?: string
        }
        Update: {
          affiliate_code?: string
          created_at?: string
          id?: string
          invitee_contato?: string | null
          inviter_id?: string
          league_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_invites_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          id: string
          joined_at: string
          league_id: string
          papel: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          league_id: string
          papel?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          league_id?: string
          papel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invite_code: string
          marca_logo_url: string | null
          nome: string
          owner_id: string
          status: string
          updated_at: string
          visibilidade: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invite_code?: string
          marca_logo_url?: string | null
          nome: string
          owner_id: string
          status?: string
          updated_at?: string
          visibilidade?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invite_code?: string
          marca_logo_url?: string | null
          nome?: string
          owner_id?: string
          status?: string
          updated_at?: string
          visibilidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          badge_title: string | null
          bonus_points: number
          company_id: string | null
          created_at: string
          emoji: string | null
          id: string
          level_number: number
          min_points: number
          name: string
          unlock_config: Json | null
        }
        Insert: {
          badge_title?: string | null
          bonus_points?: number
          company_id?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          level_number: number
          min_points: number
          name: string
          unlock_config?: Json | null
        }
        Update: {
          badge_title?: string | null
          bonus_points?: number
          company_id?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          level_number?: number
          min_points?: number
          name?: string
          unlock_config?: Json | null
        }
        Relationships: []
      }
      medication_logs: {
        Row: {
          created_at: string
          id: string
          medication_id: string
          points_awarded: number
          taken_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          medication_id: string
          points_awarded?: number
          taken_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          medication_id?: string
          points_awarded?: number
          taken_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_logs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "user_medications"
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
          cap_lifetime: number | null
          cap_per_day: number | null
          cap_per_month: number | null
          cap_per_week: number | null
          created_at: string | null
          description: string | null
          emoji: string | null
          frequency: string | null
          id: string
          points: number | null
          priority: number | null
          questionnaire_id: string | null
          success_link_label: string | null
          success_link_url: string | null
          success_message: string | null
          tag: string
          title: string
          valid_from: string | null
          valid_until: string | null
          validation_type: string | null
        }
        Insert: {
          active?: boolean | null
          cap_lifetime?: number | null
          cap_per_day?: number | null
          cap_per_month?: number | null
          cap_per_week?: number | null
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          frequency?: string | null
          id?: string
          points?: number | null
          priority?: number | null
          questionnaire_id?: string | null
          success_link_label?: string | null
          success_link_url?: string | null
          success_message?: string | null
          tag: string
          title: string
          valid_from?: string | null
          valid_until?: string | null
          validation_type?: string | null
        }
        Update: {
          active?: boolean | null
          cap_lifetime?: number | null
          cap_per_day?: number | null
          cap_per_month?: number | null
          cap_per_week?: number | null
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          frequency?: string | null
          id?: string
          points?: number | null
          priority?: number | null
          questionnaire_id?: string | null
          success_link_label?: string | null
          success_link_url?: string | null
          success_message?: string | null
          tag?: string
          title?: string
          valid_from?: string | null
          valid_until?: string | null
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
          google_maps_url: string | null
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
          google_maps_url?: string | null
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
          google_maps_url?: string | null
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
          google_maps_url: string | null
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
          google_maps_url?: string | null
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
          google_maps_url?: string | null
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
      pending_signups: {
        Row: {
          affiliate_id: string | null
          amount_cents: number
          billing_city: string | null
          billing_complement: string | null
          billing_country: string | null
          billing_neighborhood: string | null
          billing_number: string | null
          billing_state: string | null
          billing_street: string | null
          billing_zip_code: string | null
          company_id: string
          cpf: string
          created_at: string
          customer_phone: string | null
          email: string
          expires_at: string
          full_name: string
          id: string
          pagarme_charge_id: string
          pagarme_customer_id: string
          pagarme_subscription_id: string | null
          password: string
          payment_method: string
          plan_id: string
          processed_at: string | null
          user_id: string | null
        }
        Insert: {
          affiliate_id?: string | null
          amount_cents: number
          billing_city?: string | null
          billing_complement?: string | null
          billing_country?: string | null
          billing_neighborhood?: string | null
          billing_number?: string | null
          billing_state?: string | null
          billing_street?: string | null
          billing_zip_code?: string | null
          company_id: string
          cpf: string
          created_at?: string
          customer_phone?: string | null
          email: string
          expires_at?: string
          full_name: string
          id?: string
          pagarme_charge_id: string
          pagarme_customer_id: string
          pagarme_subscription_id?: string | null
          password: string
          payment_method: string
          plan_id: string
          processed_at?: string | null
          user_id?: string | null
        }
        Update: {
          affiliate_id?: string | null
          amount_cents?: number
          billing_city?: string | null
          billing_complement?: string | null
          billing_country?: string | null
          billing_neighborhood?: string | null
          billing_number?: string | null
          billing_state?: string | null
          billing_street?: string | null
          billing_zip_code?: string | null
          company_id?: string
          cpf?: string
          created_at?: string
          customer_phone?: string | null
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          pagarme_charge_id?: string
          pagarme_customer_id?: string
          pagarme_subscription_id?: string | null
          password?: string
          payment_method?: string
          plan_id?: string
          processed_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      point_rules: {
        Row: {
          active: boolean
          cap_lifetime: number | null
          cap_per_day: number | null
          cap_per_month: number | null
          cap_per_week: number | null
          company_id: string
          created_at: string
          description: string | null
          emoji: string | null
          event_key: string
          id: string
          label: string
          points: number
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          cap_lifetime?: number | null
          cap_per_day?: number | null
          cap_per_month?: number | null
          cap_per_week?: number | null
          company_id: string
          created_at?: string
          description?: string | null
          emoji?: string | null
          event_key: string
          id?: string
          label: string
          points?: number
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          cap_lifetime?: number | null
          cap_per_day?: number | null
          cap_per_month?: number | null
          cap_per_week?: number | null
          company_id?: string
          created_at?: string
          description?: string | null
          emoji?: string | null
          event_key?: string
          id?: string
          label?: string
          points?: number
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "point_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          points: number
          source: string
          source_id: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          points: number
          source?: string
          source_id?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          points?: number
          source?: string
          source_id?: string | null
          user_id?: string
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
          avatar_points_awarded: boolean
          avatar_seed: string | null
          avatar_style: string
          avatar_type: string
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
          gender_other_text: string | null
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
          points_tour_completed: boolean
          points_tour_current_step: number
          points_tour_dismissed_at: string | null
          prenatal_dental_done: boolean | null
          prenatal_started: boolean | null
          signed_up_via_token: string | null
          support_team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          altura?: number | null
          avatar_points_awarded?: boolean
          avatar_seed?: string | null
          avatar_style?: string
          avatar_type?: string
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
          gender_other_text?: string | null
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
          points_tour_completed?: boolean
          points_tour_current_step?: number
          points_tour_dismissed_at?: string | null
          prenatal_dental_done?: boolean | null
          prenatal_started?: boolean | null
          signed_up_via_token?: string | null
          support_team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          altura?: number | null
          avatar_points_awarded?: boolean
          avatar_seed?: string | null
          avatar_style?: string
          avatar_type?: string
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
          gender_other_text?: string | null
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
          points_tour_completed?: boolean
          points_tour_current_step?: number
          points_tour_dismissed_at?: string | null
          prenatal_dental_done?: boolean | null
          prenatal_started?: boolean | null
          signed_up_via_token?: string | null
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
            foreignKeyName: "profiles_signed_up_via_token_fkey"
            columns: ["signed_up_via_token"]
            isOneToOne: false
            referencedRelation: "company_invite_tokens"
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
      prontuario_connections: {
        Row: {
          active: boolean
          company_id: string | null
          created_at: string
          external_clinic_name: string | null
          external_patient_id: string | null
          external_professional_id: string
          external_professional_name: string | null
          external_system: string
          id: string
          internal_partner_id: string | null
          report_token: string
          source_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          external_clinic_name?: string | null
          external_patient_id?: string | null
          external_professional_id: string
          external_professional_name?: string | null
          external_system?: string
          id?: string
          internal_partner_id?: string | null
          report_token?: string
          source_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          external_clinic_name?: string | null
          external_patient_id?: string | null
          external_professional_id?: string
          external_professional_name?: string | null
          external_system?: string
          id?: string
          internal_partner_id?: string | null
          report_token?: string
          source_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prontuario_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prontuario_connections_internal_partner_id_fkey"
            columns: ["internal_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      public_dashboard_tokens: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          token: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          token?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_dashboard_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      referral_rewards: {
        Row: {
          affiliate_code: string
          carencia_ate: string | null
          created_at: string
          id: string
          invite_id: string | null
          inviter_id: string
          pago_em: string | null
          referred_user_id: string | null
          release_ate: string | null
          split_ref: string | null
          status: string
          valor: number | null
        }
        Insert: {
          affiliate_code: string
          carencia_ate?: string | null
          created_at?: string
          id?: string
          invite_id?: string | null
          inviter_id: string
          pago_em?: string | null
          referred_user_id?: string | null
          release_ate?: string | null
          split_ref?: string | null
          status?: string
          valor?: number | null
        }
        Update: {
          affiliate_code?: string
          carencia_ate?: string | null
          created_at?: string
          id?: string
          invite_id?: string | null
          inviter_id?: string
          pago_em?: string | null
          referred_user_id?: string | null
          release_ate?: string | null
          split_ref?: string | null
          status?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "league_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      report_access_codes: {
        Row: {
          access_code: string
          created_at: string
          id: string
          professional_id: string
          report_token: string
          used: boolean
        }
        Insert: {
          access_code?: string
          created_at?: string
          id?: string
          professional_id: string
          report_token: string
          used?: boolean
        }
        Update: {
          access_code?: string
          created_at?: string
          id?: string
          professional_id?: string
          report_token?: string
          used?: boolean
        }
        Relationships: []
      }
      report_shares: {
        Row: {
          accessed_at: string | null
          created_at: string
          expires_at: string
          id: string
          professional_id: string | null
          token: string
          user_id: string
        }
        Insert: {
          accessed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          professional_id?: string | null
          token: string
          user_id: string
        }
        Update: {
          accessed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          professional_id?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_grants: {
        Row: {
          company_id: string
          created_at: string
          granted_at: string
          granted_by: string | null
          id: string
          note: string | null
          notified_email_at: string | null
          notified_whatsapp_at: string | null
          reward_id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          notified_email_at?: string | null
          notified_whatsapp_at?: string | null
          reward_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          notified_email_at?: string | null
          notified_whatsapp_at?: string | null
          reward_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_grants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_grants_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          active: boolean
          company_id: string
          cost_points: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          min_level: number | null
          stock: number | null
          title: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          company_id: string
          cost_points?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          min_level?: number | null
          stock?: number | null
          title: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          cost_points?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          min_level?: number | null
          stock?: number | null
          title?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rewards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      self_assessment_questions: {
        Row: {
          active: boolean
          company_id: string | null
          created_at: string
          id: string
          options: Json | null
          qtype: string
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          id?: string
          options?: Json | null
          qtype?: string
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          id?: string
          options?: Json | null
          qtype?: string
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "self_assessment_questions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      self_assessment_responses: {
        Row: {
          answers: Json
          company_id: string | null
          completed_at: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          company_id?: string | null
          completed_at?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          company_id?: string | null
          completed_at?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
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
      subscription_invoices: {
        Row: {
          amount_cents: number
          created_at: string
          due_date: string | null
          failure_reason: string | null
          id: string
          pagarme_charge_id: string | null
          pagarme_invoice_id: string | null
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          pix_expires_at: string | null
          pix_qr_code: string | null
          pix_qr_code_url: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subscription_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          due_date?: string | null
          failure_reason?: string | null
          id?: string
          pagarme_charge_id?: string | null
          pagarme_invoice_id?: string | null
          paid_at?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          due_date?: string | null
          failure_reason?: string | null
          id?: string
          pagarme_charge_id?: string | null
          pagarme_invoice_id?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          active: boolean
          billing_interval: Database["public"]["Enums"]["billing_interval"]
          company_id: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          name: string
          payment_methods: Database["public"]["Enums"]["payment_method"][]
          price_cents: number
          trial_days: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_interval?: Database["public"]["Enums"]["billing_interval"]
          company_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name: string
          payment_methods?: Database["public"]["Enums"]["payment_method"][]
          price_cents: number
          trial_days?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_interval?: Database["public"]["Enums"]["billing_interval"]
          company_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name?: string
          payment_methods?: Database["public"]["Enums"]["payment_method"][]
          price_cents?: number
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          affiliate_id: string | null
          billing_city: string | null
          billing_complement: string | null
          billing_country: string | null
          billing_neighborhood: string | null
          billing_number: string | null
          billing_state: string | null
          billing_street: string | null
          billing_zip_code: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          card_brand: string | null
          card_last4: string | null
          company_id: string
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          customer_phone: string | null
          id: string
          metadata: Json | null
          pagarme_customer_id: string | null
          pagarme_subscription_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_id?: string | null
          billing_city?: string | null
          billing_complement?: string | null
          billing_country?: string | null
          billing_neighborhood?: string | null
          billing_number?: string | null
          billing_state?: string | null
          billing_street?: string | null
          billing_zip_code?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          card_brand?: string | null
          card_last4?: string | null
          company_id: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_phone?: string | null
          id?: string
          metadata?: Json | null
          pagarme_customer_id?: string | null
          pagarme_subscription_id?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_id?: string | null
          billing_city?: string | null
          billing_complement?: string | null
          billing_country?: string | null
          billing_neighborhood?: string | null
          billing_number?: string | null
          billing_state?: string | null
          billing_street?: string | null
          billing_zip_code?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          card_brand?: string | null
          card_last4?: string | null
          company_id?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_phone?: string | null
          id?: string
          metadata?: Json | null
          pagarme_customer_id?: string | null
          pagarme_subscription_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
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
      user_level_progress: {
        Row: {
          badges: Json
          company_id: string | null
          current_level: number
          id: string
          reached_at: string
          total_bonus_paid: number
          updated_at: string
          user_id: string
        }
        Insert: {
          badges?: Json
          company_id?: string | null
          current_level?: number
          id?: string
          reached_at?: string
          total_bonus_paid?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          badges?: Json
          company_id?: string | null
          current_level?: number
          id?: string
          reached_at?: string
          total_bonus_paid?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_medications: {
        Row: {
          active: boolean
          created_at: string
          dosage: string | null
          frequency: string
          id: string
          name: string
          reminder_time: string | null
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dosage?: string | null
          frequency?: string
          id?: string
          name: string
          reminder_time?: string | null
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dosage?: string | null
          frequency?: string
          id?: string
          name?: string
          reminder_time?: string | null
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      user_visible_indicators: {
        Row: {
          indicator_key: string
          updated_at: string
          updated_by: string | null
          visible_to_user: boolean
        }
        Insert: {
          indicator_key: string
          updated_at?: string
          updated_by?: string | null
          visible_to_user?: boolean
        }
        Update: {
          indicator_key?: string
          updated_at?: string
          updated_by?: string | null
          visible_to_user?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_visible_indicators_indicator_key_fkey"
            columns: ["indicator_key"]
            isOneToOne: true
            referencedRelation: "vitals_indicators_catalog"
            referencedColumns: ["key"]
          },
        ]
      }
      vitals_indicators_catalog: {
        Row: {
          active: boolean
          category: string
          created_at: string
          default_visible_to_user: boolean
          description: string | null
          key: string
          label: string
          providers: string[]
          sort_order: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          default_visible_to_user?: boolean
          description?: string | null
          key: string
          label: string
          providers?: string[]
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          default_visible_to_user?: boolean
          description?: string | null
          key?: string
          label?: string
          providers?: string[]
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          company_id: string | null
          error: string | null
          event_type: string
          id: string
          pagarme_event_id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          received_at: string
        }
        Insert: {
          company_id?: string | null
          error?: string | null
          event_type: string
          id?: string
          pagarme_event_id: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          received_at?: string
        }
        Update: {
          company_id?: string | null
          error?: string | null
          event_type?: string
          id?: string
          pagarme_event_id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          received_at?: string
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
      company_leaderboard: {
        Row: {
          avatar_type: string | null
          avatar_url: string | null
          company_id: string | null
          current_level: number | null
          full_name: string | null
          month_points: number | null
          rank_month: number | null
          rank_total: number | null
          rank_week: number | null
          rank_year: number | null
          total_points: number | null
          user_id: string | null
          week_points: number | null
          year_points: number | null
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
      league_prize_eligible: {
        Row: {
          elegivel_premio_mayla: boolean | null
          league_id: string | null
          membros: number | null
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_points_to_profile: {
        Args: { _points: number; _user_id: string }
        Returns: undefined
      }
      apply_dicebear_avatar: {
        Args: { _url: string; _user_id: string }
        Returns: Json
      }
      award_event: {
        Args: {
          _company_id?: string
          _description?: string
          _event_key: string
          _override_points?: number
          _source_id?: string
          _user_id: string
        }
        Returns: Json
      }
      award_mission_event: {
        Args: { _mission_id: string; _user_id: string }
        Returns: Json
      }
      award_points: {
        Args: {
          _description?: string
          _points: number
          _source: string
          _source_id?: string
          _user_id: string
        }
        Returns: undefined
      }
      backfill_user_levels: { Args: never; Returns: number }
      check_user_level: { Args: { _user_id: string }; Returns: undefined }
      complete_daily_challenge: {
        Args: { _assignment_id: string }
        Returns: Json
      }
      consume_report_share: {
        Args: { _token: string }
        Returns: {
          expires_at: string
          user_id: string
          valid: boolean
        }[]
      }
      current_user_affiliate_ids: { Args: never; Returns: string[] }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_daily_challenge: { Args: { _company_id: string }; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      get_company_id_strict: { Args: { _user_id: string }; Returns: string }
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
      get_effective_clinical_fields: {
        Args: { _company_id: string }
        Returns: {
          field_key: string
          label: string
          section: string
          sort_order: number
          visible: boolean
        }[]
      }
      get_effective_goals: {
        Args: { _company_id: string }
        Returns: {
          monthly_goal: number
          weekly_goal: number
          yearly_goal: number
        }[]
      }
      get_effective_levels: {
        Args: { _company_id: string }
        Returns: {
          badge_title: string
          bonus_points: number
          emoji: string
          level_number: number
          min_points: number
          name: string
        }[]
      }
      get_public_dashboard: { Args: { _token: string }; Returns: Json }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_user_municipality_id: { Args: { _user_id: string }; Returns: string }
      has_platform_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_admin: { Args: { _user_id: string }; Returns: boolean }
      is_hr_manager: { Args: { _user_id: string }; Returns: boolean }
      is_league_admin: {
        Args: { p_league: string; p_user?: string }
        Returns: boolean
      }
      is_league_member: {
        Args: { p_league: string; p_user?: string }
        Returns: boolean
      }
      is_wellbeing_manager: { Args: { _user_id: string }; Returns: boolean }
      league_ranking: {
        Args: { p_league_id: string; p_week_id?: string }
        Returns: {
          pontos_semana: number
          posicao: number
          user_id: string
        }[]
      }
      mayla_ranking: {
        Args: { p_company_id: string; p_week_id?: string }
        Returns: {
          pontos_semana: number
          posicao: number
          user_id: string
        }[]
      }
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
      register_via_invite_token: {
        Args: { _token: string; _user_id: string }
        Returns: Json
      }
      save_clinical_note_via_share: {
        Args: { _note: string; _token: string }
        Returns: string
      }
      seed_default_point_rules: {
        Args: { _company_id: string }
        Returns: undefined
      }
      user_xp: { Args: { p_user?: string }; Returns: number }
      validate_invite_token: {
        Args: { _token: string }
        Returns: {
          company_id: string
          reason: string
          valid: boolean
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
      billing_interval: "monthly" | "yearly"
      commission_status: "pending" | "paid" | "canceled"
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
      invoice_status: "pending" | "paid" | "failed" | "canceled" | "refunded"
      kyc_status: "pending" | "approved" | "rejected"
      pagarme_environment: "test" | "live"
      partner_type:
        | "doctor"
        | "clinic"
        | "gym"
        | "laboratory"
        | "pharmacy"
        | "other"
      payment_method: "credit_card" | "pix"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "pending"
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
      billing_interval: ["monthly", "yearly"],
      commission_status: ["pending", "paid", "canceled"],
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
      invoice_status: ["pending", "paid", "failed", "canceled", "refunded"],
      kyc_status: ["pending", "approved", "rejected"],
      pagarme_environment: ["test", "live"],
      partner_type: [
        "doctor",
        "clinic",
        "gym",
        "laboratory",
        "pharmacy",
        "other",
      ],
      payment_method: ["credit_card", "pix"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "pending",
      ],
    },
  },
} as const
