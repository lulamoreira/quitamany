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
      automacoes: {
        Row: {
          ativa: boolean
          botoes: Json
          criado_em: string
          etiqueta_aplicar: string | null
          execucoes: number
          id: string
          nome: string
          palavras: string[]
          post_ig_id: string | null
          resposta_comentario: string | null
          resposta_dm: string
          tipo: Database["public"]["Enums"]["automacao_tipo"]
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          botoes?: Json
          criado_em?: string
          etiqueta_aplicar?: string | null
          execucoes?: number
          id?: string
          nome: string
          palavras?: string[]
          post_ig_id?: string | null
          resposta_comentario?: string | null
          resposta_dm?: string
          tipo: Database["public"]["Enums"]["automacao_tipo"]
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          botoes?: Json
          criado_em?: string
          etiqueta_aplicar?: string | null
          execucoes?: number
          id?: string
          nome?: string
          palavras?: string[]
          post_ig_id?: string | null
          resposta_comentario?: string | null
          resposta_dm?: string
          tipo?: Database["public"]["Enums"]["automacao_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      contatos: {
        Row: {
          criado_em: string
          etiquetas: string[]
          foto_url: string | null
          id: string
          ig_id: string
          nome: string | null
          notas: string
          primeira_interacao: string
          ultima_interacao: string
          updated_at: string
          username: string | null
        }
        Insert: {
          criado_em?: string
          etiquetas?: string[]
          foto_url?: string | null
          id?: string
          ig_id: string
          nome?: string | null
          notas?: string
          primeira_interacao?: string
          ultima_interacao?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          criado_em?: string
          etiquetas?: string[]
          foto_url?: string | null
          id?: string
          ig_id?: string
          nome?: string | null
          notas?: string
          primeira_interacao?: string
          ultima_interacao?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      conversas: {
        Row: {
          contato_id: string
          criado_em: string
          id: string
          janela_expira_em: string | null
          modo: Database["public"]["Enums"]["conversa_modo"]
          nao_lidas: number
          ultima_mensagem: string | null
          ultima_msg_em: string | null
          updated_at: string
        }
        Insert: {
          contato_id: string
          criado_em?: string
          id?: string
          janela_expira_em?: string | null
          modo?: Database["public"]["Enums"]["conversa_modo"]
          nao_lidas?: number
          ultima_mensagem?: string | null
          ultima_msg_em?: string | null
          updated_at?: string
        }
        Update: {
          contato_id?: string
          criado_em?: string
          id?: string
          janela_expira_em?: string | null
          modo?: Database["public"]["Enums"]["conversa_modo"]
          nao_lidas?: number
          ultima_mensagem?: string | null
          ultima_msg_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: true
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_webhook: {
        Row: {
          criado_em: string
          erro: string | null
          evento_id: string | null
          id: string
          payload: Json | null
          processado: boolean
          tipo: string
        }
        Insert: {
          criado_em?: string
          erro?: string | null
          evento_id?: string | null
          id?: string
          payload?: Json | null
          processado?: boolean
          tipo: string
        }
        Update: {
          criado_em?: string
          erro?: string | null
          evento_id?: string | null
          id?: string
          payload?: Json | null
          processado?: boolean
          tipo?: string
        }
        Relationships: []
      }
      ig_config: {
        Row: {
          access_token: string
          conta_username: string | null
          id: string
          ig_user_id: string
          page_id: string | null
          token_gerado_em: string
          ultima_execucao_motor: string | null
          ultima_execucao_resultado: Json | null
          updated_at: string
        }
        Insert: {
          access_token: string
          conta_username?: string | null
          id?: string
          ig_user_id: string
          page_id?: string | null
          token_gerado_em?: string
          ultima_execucao_motor?: string | null
          ultima_execucao_resultado?: Json | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          conta_username?: string | null
          id?: string
          ig_user_id?: string
          page_id?: string | null
          token_gerado_em?: string
          ultima_execucao_motor?: string | null
          ultima_execucao_resultado?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      mensagens: {
        Row: {
          conversa_id: string
          criado_em: string
          direcao: Database["public"]["Enums"]["msg_direcao"]
          enviada_por: Database["public"]["Enums"]["msg_autor"] | null
          id: string
          payload_bruto: Json | null
          texto: string
        }
        Insert: {
          conversa_id: string
          criado_em?: string
          direcao: Database["public"]["Enums"]["msg_direcao"]
          enviada_por?: Database["public"]["Enums"]["msg_autor"] | null
          id?: string
          payload_bruto?: Json | null
          texto?: string
        }
        Update: {
          conversa_id?: string
          criado_em?: string
          direcao?: Database["public"]["Enums"]["msg_direcao"]
          enviada_por?: Database["public"]["Enums"]["msg_autor"] | null
          id?: string
          payload_bruto?: Json | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      posts_agendados: {
        Row: {
          agendado_para: string | null
          container_id: string | null
          criado_em: string
          criado_por: string | null
          erro_msg: string | null
          hashtags: string
          id: string
          legenda: string
          media_id: string | null
          permalink: string | null
          publicado_em: string | null
          status: Database["public"]["Enums"]["post_status"]
          titulo: string | null
          updated_at: string
          video_path: string | null
          video_url: string | null
        }
        Insert: {
          agendado_para?: string | null
          container_id?: string | null
          criado_em?: string
          criado_por?: string | null
          erro_msg?: string | null
          hashtags?: string
          id?: string
          legenda?: string
          media_id?: string | null
          permalink?: string | null
          publicado_em?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          titulo?: string | null
          updated_at?: string
          video_path?: string | null
          video_url?: string | null
        }
        Update: {
          agendado_para?: string | null
          container_id?: string | null
          criado_em?: string
          criado_por?: string | null
          erro_msg?: string | null
          hashtags?: string
          id?: string
          legenda?: string
          media_id?: string | null
          permalink?: string | null
          publicado_em?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          titulo?: string | null
          updated_at?: string
          video_path?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          criado_em: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          criado_em?: string
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
      current_role_of: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "pendente"
      automacao_tipo: "gatilho_comentario" | "palavra_chave_dm" | "boas_vindas"
      conversa_modo: "automatico" | "humano"
      msg_autor: "robo" | "humano"
      msg_direcao: "recebida" | "enviada"
      post_status:
        | "rascunho"
        | "agendado"
        | "processando"
        | "publicado"
        | "erro"
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
      app_role: ["admin", "editor", "pendente"],
      automacao_tipo: ["gatilho_comentario", "palavra_chave_dm", "boas_vindas"],
      conversa_modo: ["automatico", "humano"],
      msg_autor: ["robo", "humano"],
      msg_direcao: ["recebida", "enviada"],
      post_status: ["rascunho", "agendado", "processando", "publicado", "erro"],
    },
  },
} as const
