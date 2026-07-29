import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lê o username da conta do Instagram conectada (ig_config.conta_username).
 * Retorna string vazia enquanto carrega ou quando não há conta conectada.
 */
export function useContaInstagram() {
  const [username, setUsername] = useState<string>("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    supabase
      .from("ig_config")
      .select("conta_username")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!ativo) return;
        setUsername(data?.conta_username ?? "");
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  return { username, conectado: !!username, carregando };
}
