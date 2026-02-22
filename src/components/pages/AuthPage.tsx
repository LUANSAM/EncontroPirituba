"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/atoms/Container";
import { supabase } from "@/lib/supabase/client";

type PublicRole = "cliente" | "profissional" | "estabelecimento";

const roleCards: Array<{ value: PublicRole; label: string; description: string }> = [
  { value: "cliente", label: "Cliente", description: "Descubra serviços e vouchers locais." },
  { value: "profissional", label: "Profissional", description: "Divulgue serviços para moradores da região." },
  { value: "estabelecimento", label: "Estabelecimento", description: "Promova ofertas e vouchers para o bairro." },
];

const allowedNeighborhoods = ["pirituba", "jaragua", "sao domingos"];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function sanitizeCep(rawCep: string) {
  return rawCep.replace(/\D/g, "").slice(0, 8);
}

function mapRoleToProfileRole(role: PublicRole): "client" | "professional" | "establishment" {
  if (role === "profissional") return "professional";
  if (role === "estabelecimento") return "establishment";
  return "client";
}

interface SignUpFormState {
  fullName: string;
  email: string;
  password: string;
  role: PublicRole;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  whatsapp: string;
  instagram: string;
  site: string;
}

const initialSignUpState: SignUpFormState = {
  fullName: "",
  email: "",
  password: "",
  role: "cliente",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  whatsapp: "",
  instagram: "",
  site: "",
};

async function validatePiritubaCep(cep: string) {
  const cleanedCep = sanitizeCep(cep);
  if (cleanedCep.length !== 8) {
    return {
      valid: false,
      message: "Informe um CEP válido com 8 dígitos.",
    };
  }

  const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
  const data = await response.json();

  if (!response.ok || data?.erro) {
    return {
      valid: false,
      message: "CEP não encontrado. Verifique e tente novamente.",
    };
  }

  const neighborhood = normalizeText(data?.bairro ?? "");
  const city = normalizeText(data?.localidade ?? "");
  const inPiritubaArea = city === "sao paulo" && allowedNeighborhoods.some((item) => neighborhood.includes(item));

  if (!inPiritubaArea) {
    return {
      valid: false,
      message: "Entrada Negada: serviço disponível apenas para a região de Pirituba",
    };
  }

  return {
    valid: true,
    message: "CEP validado com sucesso para Pirituba/Jaraguá/São Domingos.",
    address: {
      logradouro: data?.logradouro ?? "",
      complemento: data?.complemento ?? "",
    },
  };
}

export function AuthPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"login" | "cadastro">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signUp, setSignUp] = useState<SignUpFormState>(initialSignUpState);
  const [cepValidated, setCepValidated] = useState(false);

  const needsCepValidation = signUp.role === "profissional" || signUp.role === "estabelecimento";

  const canSubmitSignUp = useMemo(() => {
    if (!signUp.fullName || !signUp.email || !signUp.password) return false;
    if (!needsCepValidation) return true;
    if (!signUp.cep || !cepValidated) return false;
    if (!signUp.logradouro || !signUp.numero || !signUp.whatsapp) return false;
    if (signUp.role !== "cliente" && (!signUp.instagram || !signUp.site)) return false;
    return true;
  }, [signUp, needsCepValidation, cepValidated]);

  const handleForgotPassword = async () => {
    setError("");
    setFeedback("");
    if (!loginEmail) {
      setError("Informe seu e-mail para recuperar a senha.");
      return;
    }

    setIsLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(loginEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setIsLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setFeedback("Enviamos o link de recuperação para seu e-mail.");
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    setIsLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      router.push("/");
      return;
    }

    const { data: profileData } = await supabase.from("usuarios").select("role").eq("user_id", userId).maybeSingle();
    const role = profileData?.role;

    if (role === "profissional" || role === "estabelecimento") {
      router.push("/dashboard");
      return;
    }

    router.push("/");
  };

  const handleCepValidation = async () => {
    setError("");
    setFeedback("");

    if (!needsCepValidation) {
      setCepValidated(true);
      return;
    }

    setIsLoading(true);
    try {
      const result = await validatePiritubaCep(signUp.cep);
      if (!result.valid) {
        setCepValidated(false);
        setError(result.message);
        return;
      }

      setCepValidated(true);
      setFeedback(result.message);

      if (result.address) {
        setSignUp((prev) => ({
          ...prev,
          logradouro: prev.logradouro || result.address.logradouro,
          complemento: prev.complemento || result.address.complemento,
        }));
      }
    } catch {
      setCepValidated(false);
      setError("Não foi possível validar o CEP agora. Tente novamente em instantes.");
    } finally {
      setIsLoading(false);
    }
  };

  const insertUserProfile = async (userId: string) => {
    const payload = {
      user_id: userId,
      nome: signUp.fullName,
      email: signUp.email,
      role: signUp.role,
      cep: sanitizeCep(signUp.cep) || null,
      logradouro: signUp.logradouro || null,
      numero: signUp.numero || null,
      complemento: signUp.complemento || null,
      whatsapp: signUp.whatsapp || null,
      instagram: signUp.role === "cliente" ? null : signUp.instagram || null,
      site: signUp.role === "cliente" ? null : signUp.site || null,
    };

    const tryUsuarios = await supabase.from("usuarios").insert(payload);
    if (!tryUsuarios.error) return;

    const tryUsuario = await supabase.from("usuario").insert(payload);
    if (!tryUsuario.error) return;

    await supabase.from("profiles").insert({
      user_id: userId,
      name: signUp.fullName,
      phone: signUp.whatsapp || null,
      role: mapRoleToProfileRole(signUp.role),
    });
  };

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setFeedback("");

    if (needsCepValidation && !cepValidated) {
      setError("Valide o CEP antes de concluir o cadastro.");
      return;
    }

    setIsLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: signUp.email,
      password: signUp.password,
      options: {
        data: {
          nome: signUp.fullName,
          role: signUp.role,
          cep: sanitizeCep(signUp.cep),
        },
      },
    });

    if (signUpError) {
      setIsLoading(false);
      setError(signUpError.message);
      return;
    }

    const userId = data.user?.id;

    if (userId) {
      await insertUserProfile(userId);
    }

    setIsLoading(false);

    if (signUp.role === "cliente") {
      router.push("/onboarding/dados-iniciais");
      return;
    }

    router.push("/onboarding/recepcao");
  };

  return (
    <main className="py-6">
      <Container>
        <div className="mx-auto w-full max-w-xl rounded-xl border bg-white p-4 shadow sm:p-6">
          <h1 className="text-center text-2xl font-bold text-blue-900">Acessar conta</h1>
          <p className="mt-1 text-center text-sm text-graytext">Login e cadastro para clientes, profissionais e estabelecimentos.</p>

          <div className="mt-4 grid grid-cols-2 rounded-lg bg-blue-50 p-1">
            <button
              className={`rounded-md px-3 py-2 text-sm font-semibold ${activeTab === "login" ? "bg-blue-900 text-white" : "text-blue-900"}`}
              onClick={() => {
                setActiveTab("login");
                setError("");
                setFeedback("");
              }}
              type="button"
            >
              Login
            </button>
            <button
              className={`rounded-md px-3 py-2 text-sm font-semibold ${activeTab === "cadastro" ? "bg-blue-900 text-white" : "text-blue-900"}`}
              onClick={() => {
                setActiveTab("cadastro");
                setError("");
                setFeedback("");
              }}
              type="button"
            >
              Cadastro
            </button>
          </div>

          {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {feedback && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{feedback}</p>}

          {activeTab === "login" ? (
            <form className="mt-4 space-y-3" onSubmit={handleLogin}>
              <input
                className="w-full rounded-lg border px-3 py-2"
                onChange={(event) => setLoginEmail(event.target.value)}
                placeholder="E-mail"
                required
                type="email"
                value={loginEmail}
              />
              <input
                className="w-full rounded-lg border px-3 py-2"
                onChange={(event) => setLoginPassword(event.target.value)}
                placeholder="Senha"
                required
                type="password"
                value={loginPassword}
              />

              <button className="w-full rounded-lg bg-blue-900 px-4 py-2 text-white" disabled={isLoading} type="submit">
                {isLoading ? "Entrando..." : "Entrar"}
              </button>

              <button
                className="w-full rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-900"
                disabled={isLoading}
                onClick={handleForgotPassword}
                type="button"
              >
                Esqueci minha senha
              </button>
            </form>
          ) : (
            <form className="mt-4 space-y-3" onSubmit={handleSignUp}>
              <div className="grid gap-2 sm:grid-cols-3">
                {roleCards.map((roleCard) => (
                  <button
                    key={roleCard.value}
                    className={`rounded-lg border p-3 text-left ${signUp.role === roleCard.value ? "border-blue-900 bg-blue-50" : "border-gray-200"}`}
                    onClick={() => {
                      setSignUp((prev) => ({ ...prev, role: roleCard.value }));
                      setCepValidated(false);
                      setError("");
                      setFeedback("");
                    }}
                    type="button"
                  >
                    <p className="text-sm font-bold text-blue-900">{roleCard.label}</p>
                    <p className="mt-1 text-xs text-graytext">{roleCard.description}</p>
                  </button>
                ))}
              </div>

              <input
                className="w-full rounded-lg border px-3 py-2"
                onChange={(event) => setSignUp((prev) => ({ ...prev, fullName: event.target.value }))}
                placeholder="Nome completo / Razão social"
                required
                value={signUp.fullName}
              />
              <input
                className="w-full rounded-lg border px-3 py-2"
                onChange={(event) => setSignUp((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="E-mail"
                required
                type="email"
                value={signUp.email}
              />
              <input
                className="w-full rounded-lg border px-3 py-2"
                minLength={6}
                onChange={(event) => setSignUp((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Senha"
                required
                type="password"
                value={signUp.password}
              />

              <input
                className="w-full rounded-lg border px-3 py-2"
                onChange={(event) => {
                  setSignUp((prev) => ({ ...prev, cep: sanitizeCep(event.target.value) }));
                  setCepValidated(false);
                }}
                placeholder={needsCepValidation ? "CEP (obrigatório)" : "CEP (opcional)"}
                required={needsCepValidation}
                value={signUp.cep}
              />

              {needsCepValidation && (
                <button
                  className="w-full rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-900"
                  disabled={isLoading}
                  onClick={handleCepValidation}
                  type="button"
                >
                  {cepValidated ? "CEP validado ✓" : "Validar CEP"}
                </button>
              )}

              {needsCepValidation && cepValidated && (
                <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-sm font-semibold text-green-700">Dados liberados após validação de CEP</p>
                  <input
                    className="w-full rounded-lg border px-3 py-2"
                    onChange={(event) => setSignUp((prev) => ({ ...prev, logradouro: event.target.value }))}
                    placeholder="Logradouro"
                    required
                    value={signUp.logradouro}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="w-full rounded-lg border px-3 py-2"
                      onChange={(event) => setSignUp((prev) => ({ ...prev, numero: event.target.value }))}
                      placeholder="Número"
                      required
                      value={signUp.numero}
                    />
                    <input
                      className="w-full rounded-lg border px-3 py-2"
                      onChange={(event) => setSignUp((prev) => ({ ...prev, complemento: event.target.value }))}
                      placeholder="Complemento"
                      value={signUp.complemento}
                    />
                  </div>

                  <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
                    <span aria-hidden>📱</span>
                    <input
                      className="w-full bg-transparent outline-none"
                      onChange={(event) => setSignUp((prev) => ({ ...prev, whatsapp: event.target.value }))}
                      placeholder="WhatsApp"
                      required
                      value={signUp.whatsapp}
                    />
                  </label>

                  <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
                    <span aria-hidden>📸</span>
                    <input
                      className="w-full bg-transparent outline-none"
                      onChange={(event) => setSignUp((prev) => ({ ...prev, instagram: event.target.value }))}
                      placeholder="Instagram"
                      required
                      value={signUp.instagram}
                    />
                  </label>

                  <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
                    <span aria-hidden>🌐</span>
                    <input
                      className="w-full bg-transparent outline-none"
                      onChange={(event) => setSignUp((prev) => ({ ...prev, site: event.target.value }))}
                      placeholder="Site"
                      required
                      value={signUp.site}
                    />
                  </label>
                </div>
              )}

              <button
                className="w-full rounded-lg bg-green-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
                disabled={!canSubmitSignUp || isLoading}
                type="submit"
              >
                {isLoading ? "Criando conta..." : "Criar conta"}
              </button>

              <p className="text-center text-xs text-graytext">
                Profissionais e estabelecimentos fora de Pirituba recebem recusa automática conforme regra de negócio.
              </p>
            </form>
          )}
        </div>
      </Container>
    </main>
  );
}
