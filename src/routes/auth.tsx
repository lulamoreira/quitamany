import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FooterLinks } from "@/components/footer-links";
import { toast } from "sonner";
import { Instagram, Loader2, Mail } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · QuitaMany" },
      {
        name: "description",
        content: "QuitaMany — automação de atendimento e publicações para Instagram.",
      },
    ],
  }),
  component: AuthPage,
});

// Paleta local — mesma identidade da landing, sem tocar no tema global
const C = {
  tinta: "#0B0B0F",
  amarelo: "#FFE24B",
  creme: "#FAF9F6",
};

const displayStyle: React.CSSProperties = {
  fontWeight: 900,
  letterSpacing: "-0.03em",
  lineHeight: 1,
};

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel" });
    });
  }, [navigate]);

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não conseguimos entrar com o Google. Tente novamente.");
      setLoading(false);
    }
    // se result.redirected, o navegador redireciona
  };

  const handleMagicLink = async () => {
    if (!email) return toast.error("Informe seu e-mail");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + "/" },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Link mágico enviado! Confira sua caixa de entrada.");
  };

  const handleEmailPassword = async (mode: "signin" | "signup") => {
    if (!email || !password) return toast.error("Preencha e-mail e senha");
    setLoading(true);
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin + "/" },
          });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (mode === "signup") toast.success("Conta criada! Aguarde aprovação do administrador.");
    navigate({ to: "/painel" });
  };

  const botaoPrimario =
    "w-full rounded-full font-semibold shadow-none hover:brightness-95";

  return (
    <div
      className="flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden px-4 py-10"
      style={{ backgroundColor: C.tinta }}
    >
      <div
        className="w-full max-w-sm rounded-[28px] p-6 shadow-2xl sm:p-8"
        style={{ backgroundColor: C.creme, color: C.tinta }}
      >
        <div className="text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: C.amarelo, color: C.tinta }}
          >
            <Instagram className="h-7 w-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl" style={displayStyle}>
            QuitaMany
          </h1>
          <p className="mt-2 text-sm opacity-70">
            Automação de atendimento e publicações para Instagram
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <Button
            variant="outline"
            className="w-full rounded-full border-black/15 bg-white font-medium hover:bg-white/80"
            style={{ color: C.tinta }}
            onClick={handleGoogle}
            disabled={loading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
              />
            </svg>
            Entrar com Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-black/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="px-2 opacity-60" style={{ backgroundColor: C.creme }}>
                ou
              </span>
            </div>
          </div>

          <Tabs defaultValue="magic">
            <TabsList className="grid w-full grid-cols-2 rounded-full bg-black/5 p-1">
              <TabsTrigger value="magic" className="rounded-full text-xs sm:text-sm">
                Link mágico
              </TabsTrigger>
              <TabsTrigger value="password" className="rounded-full text-xs sm:text-sm">
                E-mail e senha
              </TabsTrigger>
            </TabsList>

            <TabsContent value="magic" className="space-y-3 pt-4">
              <div className="space-y-2">
                <Label htmlFor="magic-email">E-mail</Label>
                <Input
                  id="magic-email"
                  type="email"
                  placeholder="voce@exemplo.com"
                  className="rounded-xl border-black/15 bg-white"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button
                className={botaoPrimario}
                style={{ backgroundColor: C.amarelo, color: C.tinta }}
                onClick={handleMagicLink}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Enviar link
              </Button>
            </TabsContent>

            <TabsContent value="password" className="space-y-3 pt-4">
              <div className="space-y-2">
                <Label htmlFor="pw-email">E-mail</Label>
                <Input
                  id="pw-email"
                  type="email"
                  className="rounded-xl border-black/15 bg-white"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw-password">Senha</Label>
                <Input
                  id="pw-password"
                  type="password"
                  className="rounded-xl border-black/15 bg-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="min-w-0 rounded-full border-black/15 bg-white"
                  style={{ color: C.tinta }}
                  onClick={() => handleEmailPassword("signup")}
                  disabled={loading}
                >
                  Criar conta
                </Button>
                <Button
                  className="min-w-0 rounded-full font-semibold shadow-none hover:brightness-95"
                  style={{ backgroundColor: C.amarelo, color: C.tinta }}
                  onClick={() => handleEmailPassword("signin")}
                  disabled={loading}
                >
                  Entrar
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="mt-6 w-full max-w-sm [&_a:hover]:text-white [&_footer]:border-0 [&_footer]:bg-transparent [&_footer]:text-white/60">
        <FooterLinks />
      </div>
    </div>
  );
}
