/**
 * Traduz mensagens de erro do Supabase Auth para português claro.
 * Se não houver tradução conhecida, devolve a mensagem original —
 * nunca escondemos informação útil do usuário.
 */
export function traduzirErroAuth(mensagem: string): string {
  const m = mensagem.toLowerCase();

  if (m.includes("known to be weak") || m.includes("easy to guess")) {
    return "Essa senha já apareceu em vazamentos de outros sites e não pode ser usada. Escolha uma senha diferente — uma frase de 4 ou 5 palavras costuma ser mais segura que senhas curtas com símbolos.";
  }
  if (m.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos. Confira e tente de novo.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Já existe uma conta com esse e-mail. Tente entrar em vez de criar uma nova.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar — enviamos um link de confirmação para sua caixa de entrada.";
  }
  if (m.includes("password should be at least")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (m.includes("unable to validate email") || m.includes("invalid format")) {
    return "Esse e-mail não parece válido. Confira se digitou corretamente.";
  }
  if (m.includes("rate limit") || m.includes("only request this after")) {
    return "Muitas tentativas em pouco tempo. Espere um minuto e tente de novo.";
  }
  if (m.includes("user not found")) {
    return "Não encontramos uma conta com esse e-mail.";
  }

  return mensagem;
}
