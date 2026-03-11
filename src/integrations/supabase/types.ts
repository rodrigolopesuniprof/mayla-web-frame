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
          tag?: string
          title?: string
          validation_type?: string | null
        }
        Relationships: []
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
            foreignKeyName: "notifications_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
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
          complemento: string | null
          cpf: string | null
          created_at: string
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
          id: string
          is_bolsa_familia: boolean | null
          is_pregnant: string | null
          last_acs_visit: boolean | null
          last_dental_visit: string | null
          level: string
          lives_with_infant: boolean | null
          municipality_id: string | null
          numero: string | null
          peso: number | null
          phone: string | null
          points: number
          prenatal_dental_done: boolean | null
          prenatal_started: boolean | null
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
          complemento?: string | null
          cpf?: string | null
          created_at?: string
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
          id?: string
          is_bolsa_familia?: boolean | null
          is_pregnant?: string | null
          last_acs_visit?: boolean | null
          last_dental_visit?: string | null
          level?: string
          lives_with_infant?: boolean | null
          municipality_id?: string | null
          numero?: string | null
          peso?: number | null
          phone?: string | null
          points?: number
          prenatal_dental_done?: boolean | null
          prenatal_started?: boolean | null
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
          complemento?: string | null
          cpf?: string | null
          created_at?: string
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
          id?: string
          is_bolsa_familia?: boolean | null
          is_pregnant?: string | null
          last_acs_visit?: boolean | null
          last_dental_visit?: string | null
          level?: string
          lives_with_infant?: boolean | null
          municipality_id?: string | null
          numero?: string | null
          peso?: number | null
          phone?: string | null
          points?: number
          prenatal_dental_done?: boolean | null
          prenatal_started?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
        ]
      }
      special_measurements: {
        Row: {
          created_at: string | null
          id: string
          measured_at: string | null
          measurement_data: Json
          municipality_id: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          measured_at?: string | null
          measurement_data?: Json
          municipality_id?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
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
          created_at: string | null
          emoji: string | null
          id: string
          municipality_id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          municipality_id: string
          name: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          municipality_id?: string
          name?: string
        }
        Relationships: [
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
    }
    Views: {
      [_ in never]: never
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
      get_user_municipality_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
    }
    Enums: {
      app_role: "admin" | "manager" | "user"
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
      app_role: ["admin", "manager", "user"],
    },
  },
} as const
