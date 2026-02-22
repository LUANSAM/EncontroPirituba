"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/atoms/Container";
import { supabase } from "@/lib/supabase/client";

const PAYMENT_OPTIONS = ["PIX", "Dinheiro", "Débito", "Crédito", "VA", "VR"] as const;
const BENEFIT_OPTIONS = [
  "Pet Friendly",
  "Silencioso",
  "Para crianças",
  "Fumódromo",
  "Vegetariano",
  "Vegano",
  "Área coberta",
  "Área externa",
  "Estacionamento",
  "Valet",
  "Para família",
  "Reunião de amigos",
  "Reunião de negócios",
  "Íntimo",
  "Aceita convênio médico",
] as const;
const MAX_SELECTED_CATEGORIES = 3;

type PublicRole = "cliente" | "profissional" | "estabelecimento";

function getDashboardPathByRole(role: PublicRole | null) {
  if (role === "profissional") return "/dashboard/profissional";
  if (role === "estabelecimento") return "/dashboard/estabelecimento";
  return "/dashboard/cliente";
}

function getFileExtension(fileName: string) {
  const ext = fileName.split(".").pop();
  return ext ? ext.toLowerCase() : "bin";
}

async function recoverAuthFromPendingSignUp() {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem("pendingSignUpAuth");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { email?: string; password?: string; createdAt?: number };
    const createdAt = parsed.createdAt || 0;
    const isExpired = Date.now() - createdAt > 15 * 60 * 1000;
    if (!parsed.email || !parsed.password || isExpired) {
      window.sessionStorage.removeItem("pendingSignUpAuth");
      return null;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });

    if (error) return null;
    window.sessionStorage.removeItem("pendingSignUpAuth");
    return data.user || null;
  } catch {
    window.sessionStorage.removeItem("pendingSignUpAuth");
    return null;
  }
}

export default function ConfiguracoesIniciaisPage() {
  const router = useRouter();
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoWarning, setPhotoWarning] = useState("");
  const [catalog, setCatalog] = useState<File | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [benefits, setBenefits] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryWarning, setCategoryWarning] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const charactersLeft = useMemo(() => 500 - description.length, [description.length]);

  useEffect(() => {
    const previews = photos.map((file) => URL.createObjectURL(file));
    setPhotoPreviews(previews);

    return () => {
      previews.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
    };
  }, [photos]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error: activeBooleanError } = await supabase
        .from("categorias")
        .select("categoria")
        .eq("ativo", true)
        .order("categoria", { ascending: true });

      if (!mounted) return;

      if (!activeBooleanError && data) {
        const categories = data
          .map((row) => String((row as { categoria?: unknown }).categoria || "").trim())
          .filter(Boolean);
        setAvailableCategories(categories);
        return;
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("categorias")
        .select("categoria")
        .eq("ativo", "true")
        .order("categoria", { ascending: true });

      if (!mounted) return;
      if (fallbackError || !fallbackData) {
        setAvailableCategories([]);
        return;
      }

      const categories = fallbackData
        .map((row) => String((row as { categoria?: unknown }).categoria || "").trim())
        .filter(Boolean);
      setAvailableCategories(categories);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handlePhotosChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    if (selected.length === 0) return;

    setPhotos((prev) => {
      const merged = [...prev, ...selected];
      if (merged.length > 3) {
        setPhotoWarning("Você pode enviar no máximo 3 fotos. Remova uma para substituir.");
      } else {
        setPhotoWarning("");
      }
      return merged.slice(0, 3);
    });

    event.target.value = "";
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setPhotos((prev) => prev.filter((_, index) => index !== indexToRemove));
    setPhotoWarning("");
  };

  const handleCatalogChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null;
    setCatalog(selected);
  };

  const toggleOption = (currentValues: string[], value: string, onChange: (values: string[]) => void) => {
    if (currentValues.includes(value)) {
      onChange(currentValues.filter((item) => item !== value));
      return;
    }
    onChange([...currentValues, value]);
  };

  const toggleCategory = (value: string) => {
    if (selectedCategories.includes(value)) {
      setSelectedCategories((prev) => prev.filter((item) => item !== value));
      setCategoryWarning("");
      return;
    }

    if (selectedCategories.length >= MAX_SELECTED_CATEGORIES) {
      setCategoryWarning("Você pode selecionar no máximo 3 categorias.");
      return;
    }

    setSelectedCategories((prev) => [...prev, value]);
    setCategoryWarning("");
  };

  const uploadPhotoFiles = async (bucket: string, userId: string) => {
    if (photos.length === 0) return [] as string[];

    const uploadedUrls: string[] = [];
    for (const [index, file] of photos.entries()) {
      const extension = getFileExtension(file.name);
      const filePath = `${userId}/foto-${Date.now()}-${index + 1}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  };

  const uploadCatalogFile = async (bucket: string, userId: string) => {
    if (!catalog) return "";
    const extension = getFileExtension(catalog.name);
    const filePath = `${userId}/catalogo-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, catalog, { upsert: false });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      const recoveredUser = !session?.user && !user ? await recoverAuthFromPendingSignUp() : null;
      const authUser = session?.user || user || recoveredUser;

      if (userError || !authUser?.email) {
        setError("Sua sessão não foi encontrada. Faça login novamente para continuar.");
        setIsLoading(false);
        return;
      }

      const { data: usuariosData, error: usuariosError } = await supabase
        .from("usuarios")
        .select("id, role, categorias")
        .eq("email", authUser.email)
        .order("created_at", { ascending: false })
        .limit(1);

      if (usuariosError || !usuariosData || usuariosData.length === 0) {
        setError("Não encontramos seu cadastro inicial. Tente fazer login novamente.");
        setIsLoading(false);
        return;
      }

      const usuario = usuariosData[0] as { id: string; role: PublicRole };
      const role = usuario.role;

      if (selectedCategories.length === 0) {
        setError("Selecione ao menos uma categoria de atuação para continuar.");
        setIsLoading(false);
        return;
      }

      if (role !== "profissional" && role !== "estabelecimento") {
        router.push(getDashboardPathByRole(role));
        return;
      }

      const bucket = role === "profissional" ? "profissionais" : "estabelecimentos";
      const photoUrls = await uploadPhotoFiles(bucket, authUser.id);
      const catalogUrl = await uploadCatalogFile(bucket, authUser.id);

      const payload = {
        fotos: photoUrls,
        panfleto: catalogUrl || null,
        meios_pagamento: paymentMethods,
        beneficios: benefits,
        categorias: selectedCategories,
        descricao: description.trim(),
      };

      const { error: updateError } = await supabase.from("usuarios").update(payload).eq("id", usuario.id);
      if (updateError) {
        setError("Não foi possível salvar os dados complementares agora.");
        setIsLoading(false);
        return;
      }

      setFeedback("Dados complementares salvos com sucesso.");
      router.push(getDashboardPathByRole(role));
    } catch {
      setError("Falha ao enviar arquivos e salvar dados. Tente novamente em instantes.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="py-8">
      <Container>
        <section className="mx-auto max-w-2xl rounded-lg border bg-white p-5 shadow">
          <h1 className="text-xl font-bold text-blue-900">Complementar cadastro</h1>
          <p className="mt-2 text-sm text-graytext">
            Esta etapa é opcional. Você pode preencher agora ou seguir para o dashboard e completar depois.
          </p>

          {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {feedback && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{feedback}</p>}

          <form className="mt-4 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-blue-900">3 fotos do serviço (opcional)</label>
              <input accept="image/*" className="w-full rounded-lg border px-3 py-2" multiple onChange={handlePhotosChange} type="file" />
              <p className="mt-1 text-xs text-graytext">Selecione até 3 imagens.</p>
              {photoWarning && <p className="mt-2 text-xs text-red-700">{photoWarning}</p>}

              {photoPreviews.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {photoPreviews.map((previewUrl, index) => (
                    <div key={`${previewUrl}-${index}`} className="relative overflow-hidden rounded-lg border bg-gray-50">
                      <img alt={`Prévia da foto ${index + 1}`} className="h-24 w-full object-cover" src={previewUrl} />
                      <button
                        aria-label={`Excluir foto ${index + 1}`}
                        className="absolute right-1 top-1 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-red-700 shadow"
                        onClick={() => handleRemovePhoto(index)}
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-blue-900">Folder/Catálogo em PDF (opcional)</label>
              <input accept="application/pdf" className="w-full rounded-lg border px-3 py-2" onChange={handleCatalogChange} type="file" />
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-blue-900">Categorias de atuação</p>
              <p className="mb-2 text-xs text-graytext">Selecionadas {selectedCategories.length}/{MAX_SELECTED_CATEGORIES}</p>
              {availableCategories.length === 0 ? (
                <p className="text-sm text-graytext">Nenhuma categoria ativa encontrada no momento.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 min-[401px]:grid-cols-2 min-[551px]:grid-cols-3">
                  {availableCategories.map((option) => {
                    const selected = selectedCategories.includes(option);
                    const isLimitReached = selectedCategories.length >= MAX_SELECTED_CATEGORIES && !selected;
                    return (
                      <button
                        aria-disabled={isLimitReached}
                        key={option}
                        className={`rounded-lg border px-3 py-2 text-left text-[clamp(0.72rem,1.7vw,0.9rem)] leading-tight ${selected ? "border-blue-900 bg-blue-50 text-blue-900" : "border-gray-200 text-gray-700"} ${isLimitReached ? "cursor-not-allowed opacity-60" : ""}`}
                        onClick={() => toggleCategory(option)}
                        type="button"
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}
              {categoryWarning && <p className="mt-2 text-xs text-red-700">{categoryWarning}</p>}
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-blue-900">Meios de pagamento aceitos</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {PAYMENT_OPTIONS.map((option) => {
                  const selected = paymentMethods.includes(option);
                  return (
                    <button
                      key={option}
                      className={`rounded-lg border px-3 py-2 text-sm ${selected ? "border-blue-900 bg-blue-50 text-blue-900" : "border-gray-200 text-gray-700"}`}
                      onClick={() => toggleOption(paymentMethods, option, setPaymentMethods)}
                      type="button"
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-blue-900">Benefícios</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {BENEFIT_OPTIONS.map((option) => {
                  const selected = benefits.includes(option);
                  return (
                    <button
                      key={option}
                      className={`rounded-lg border px-3 py-2 text-sm text-left ${selected ? "border-blue-900 bg-blue-50 text-blue-900" : "border-gray-200 text-gray-700"}`}
                      onClick={() => toggleOption(benefits, option, setBenefits)}
                      type="button"
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-blue-900">Apresentação (até 500 caracteres)</label>
              <textarea
                className="min-h-28 w-full rounded-lg border px-3 py-2"
                maxLength={500}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Escreva um breve parágrafo sobre seu serviço/estabelecimento."
                value={description}
              />
              <p className="mt-1 text-right text-xs text-graytext">{charactersLeft} caracteres restantes</p>
            </div>

            <button className="w-full rounded-lg bg-blue-900 px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={isLoading} type="submit">
              {isLoading ? "Salvando..." : "Salvar e continuar"}
            </button>
          </form>
        </section>
      </Container>
    </main>
  );
}
