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
      beacon_reflections: {
        Row: {
          created_at: string
          id: string
          improvement_note: string | null
          made_proud: boolean
          reflection_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          improvement_note?: string | null
          made_proud: boolean
          reflection_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          improvement_note?: string | null
          made_proud?: boolean
          reflection_date?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          parts: Json
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          parts: Json
          role: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      confidence_challenges: {
        Row: {
          challenge_date: string
          completed: boolean | null
          confidence_level: number | null
          created_at: string
          id: string
          learning: string | null
          prompt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_date?: string
          completed?: boolean | null
          confidence_level?: number | null
          created_at?: string
          id?: string
          learning?: string | null
          prompt: string
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_date?: string
          completed?: boolean | null
          confidence_level?: number | null
          created_at?: string
          id?: string
          learning?: string | null
          prompt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          category: string
          completed: boolean
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          completed?: boolean
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          completed?: boolean
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          created_at: string
          habit_id: string
          id: string
          log_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          habit_id: string
          id?: string
          log_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          habit_id?: string
          id?: string
          log_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          archived: boolean
          created_at: string
          icon: string | null
          id: string
          is_default: boolean
          name: string
          target_per_day: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          target_per_day?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          target_per_day?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          content: string
          created_at: string
          entry_date: string
          id: string
          mood: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          entry_date?: string
          id?: string
          mood?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          entry_date?: string
          id?: string
          mood?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          category: string
          content: string
          created_at: string
          embedding: string | null
          id: string
          source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          completed: boolean
          created_at: string
          due_date: string | null
          goal_id: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          due_date?: string | null
          goal_id: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          due_date?: string | null
          goal_id?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_customers: {
        Row: {
          created_at: string
          display_name: string | null
          handled_while_sleeping: boolean
          handoff_reason: string | null
          id: string
          last_interaction: string
          notes: string | null
          owner_id: string
          state: Database["public"]["Enums"]["telegram_conv_state"]
          status: string
          telegram_chat_id: number
          telegram_user_id: number | null
          telegram_username: string | null
          updated_at: string
          waiting_for_human: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          handled_while_sleeping?: boolean
          handoff_reason?: string | null
          id?: string
          last_interaction?: string
          notes?: string | null
          owner_id: string
          state?: Database["public"]["Enums"]["telegram_conv_state"]
          status?: string
          telegram_chat_id: number
          telegram_user_id?: number | null
          telegram_username?: string | null
          updated_at?: string
          waiting_for_human?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          handled_while_sleeping?: boolean
          handoff_reason?: string | null
          id?: string
          last_interaction?: string
          notes?: string | null
          owner_id?: string
          state?: Database["public"]["Enums"]["telegram_conv_state"]
          status?: string
          telegram_chat_id?: number
          telegram_user_id?: number | null
          telegram_username?: string | null
          updated_at?: string
          waiting_for_human?: boolean
        }
        Relationships: []
      }
      telegram_messages: {
        Row: {
          created_at: string
          customer_id: string
          direction: string
          id: string
          owner_id: string
          sender: string
          text: string | null
          update_id: number | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          direction: string
          id?: string
          owner_id: string
          sender: string
          text?: string | null
          update_id?: number | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          direction?: string
          id?: string
          owner_id?: string
          sender?: string
          text?: string | null
          update_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "telegram_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_settings: {
        Row: {
          automation_enabled: boolean
          bot_id: number | null
          bot_username: string | null
          connected: boolean
          connected_at: string | null
          created_at: string
          sleeping_mode: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          automation_enabled?: boolean
          bot_id?: number | null
          bot_username?: string | null
          connected?: boolean
          connected_at?: string | null
          created_at?: string
          sleeping_mode?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          automation_enabled?: boolean
          bot_id?: number | null
          bot_username?: string | null
          connected?: boolean
          connected_at?: string | null
          created_at?: string
          sleeping_mode?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_style_examples: {
        Row: {
          created_at: string
          customer_message: string
          id: string
          owner_id: string
          owner_reply: string
          tag: string | null
        }
        Insert: {
          created_at?: string
          customer_message: string
          id?: string
          owner_id: string
          owner_reply: string
          tag?: string | null
        }
        Update: {
          created_at?: string
          customer_message?: string
          id?: string
          owner_id?: string
          owner_reply?: string
          tag?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_memories: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          category: string
          content: string
          created_at: string
          id: string
          similarity: number
        }[]
      }
    }
    Enums: {
      telegram_conv_state: "BEACON_ACTIVE" | "HUMAN_TAKEOVER"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      telegram_conv_state: ["BEACON_ACTIVE", "HUMAN_TAKEOVER"],
    },
  },
} as const
