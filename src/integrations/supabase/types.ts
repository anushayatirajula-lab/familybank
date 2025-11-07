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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      allowances: {
        Row: {
          child_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          next_payment_at: string
          updated_at: string | null
          weekly_amount: number
        }
        Insert: {
          child_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          next_payment_at: string
          updated_at?: string | null
          weekly_amount: number
        }
        Update: {
          child_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          next_payment_at?: string
          updated_at?: string | null
          weekly_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "allowances_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      balances: {
        Row: {
          amount: number | null
          child_id: string
          id: string
          jar_type: Database["public"]["Enums"]["jar_type"]
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          child_id: string
          id?: string
          jar_type: Database["public"]["Enums"]["jar_type"]
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          child_id?: string
          id?: string
          jar_type?: Database["public"]["Enums"]["jar_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "balances_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          age: number | null
          ai_tips_enabled: boolean | null
          avatar_url: string | null
          created_at: string | null
          daily_spend_limit: number | null
          first_login: boolean | null
          id: string
          initial_password: string | null
          name: string
          parent_id: string
          per_txn_limit: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          age?: number | null
          ai_tips_enabled?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          daily_spend_limit?: number | null
          first_login?: boolean | null
          id?: string
          initial_password?: string | null
          name: string
          parent_id: string
          per_txn_limit?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          age?: number | null
          ai_tips_enabled?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          daily_spend_limit?: number | null
          first_login?: boolean | null
          id?: string
          initial_password?: string | null
          name?: string
          parent_id?: string
          per_txn_limit?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chores: {
        Row: {
          approved_at: string | null
          child_id: string
          created_at: string | null
          description: string | null
          due_at: string | null
          id: string
          status: Database["public"]["Enums"]["chore_status"] | null
          submitted_at: string | null
          title: string
          token_reward: number
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          child_id: string
          created_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["chore_status"] | null
          submitted_at?: string | null
          title: string
          token_reward: number
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          child_id?: string
          created_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["chore_status"] | null
          submitted_at?: string | null
          title?: string
          token_reward?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chores_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      jars: {
        Row: {
          child_id: string
          created_at: string | null
          id: string
          jar_type: Database["public"]["Enums"]["jar_type"]
          percentage: number
        }
        Insert: {
          child_id: string
          created_at?: string | null
          id?: string
          jar_type: Database["public"]["Enums"]["jar_type"]
          percentage: number
        }
        Update: {
          child_id?: string
          created_at?: string | null
          id?: string
          jar_type?: Database["public"]["Enums"]["jar_type"]
          percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "jars_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          child_id: string
          created_at: string | null
          description: string | null
          id: string
          jar_type: Database["public"]["Enums"]["jar_type"]
          reference_id: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          child_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          jar_type: Database["public"]["Enums"]["jar_type"]
          reference_id?: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          child_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          jar_type?: Database["public"]["Enums"]["jar_type"]
          reference_id?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          approved_by_parent: boolean | null
          child_id: string
          created_at: string | null
          current_amount: number | null
          description: string | null
          id: string
          image_url: string | null
          is_purchased: boolean | null
          target_amount: number
          title: string
          updated_at: string | null
        }
        Insert: {
          approved_by_parent?: boolean | null
          child_id: string
          created_at?: string | null
          current_amount?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_purchased?: boolean | null
          target_amount: number
          title: string
          updated_at?: string | null
        }
        Update: {
          approved_by_parent?: boolean | null
          child_id?: string
          created_at?: string | null
          current_amount?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_purchased?: boolean | null
          target_amount?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      authenticate_child: {
        Args: { p_name: string; p_pin: string }
        Returns: {
          child_id: string
          child_name: string
          message: string
          success: boolean
        }[]
      }
      fb_approve_chore: { Args: { p_chore: string }; Returns: boolean }
      fb_split_into_jars: {
        Args: {
          p_amount: number
          p_child: string
          p_reference_id?: string
          p_type: Database["public"]["Enums"]["transaction_type"]
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      chore_status: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED"
      jar_type: "TOYS" | "BOOKS" | "SHOPPING" | "CHARITY" | "WISHLIST"
      transaction_type:
        | "CHORE_REWARD"
        | "ALLOWANCE_SPLIT"
        | "WISHLIST_SPEND"
        | "MANUAL_ADJUSTMENT"
      user_role: "PARENT" | "CHILD"
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
      chore_status: ["PENDING", "SUBMITTED", "APPROVED", "REJECTED"],
      jar_type: ["TOYS", "BOOKS", "SHOPPING", "CHARITY", "WISHLIST"],
      transaction_type: [
        "CHORE_REWARD",
        "ALLOWANCE_SPLIT",
        "WISHLIST_SPEND",
        "MANUAL_ADJUSTMENT",
      ],
      user_role: ["PARENT", "CHILD"],
    },
  },
} as const
