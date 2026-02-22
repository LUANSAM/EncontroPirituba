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

type Role = "profissional" | "estabelecimento";

interface Props {
  role: Role;
}

interface EnderecoForm {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

interface ContatoForm {
  whatsapp: string;
  instagram: string;
  site: string;
}

function getFileExtension(fileName: string) {
  const ext = fileName.split(".").pop();
  return ext ? ext.toLowerCase() : "bin";
}

function getDashboardPathByRole(role: Role) {
  return role === "profissional" ? "/dashboard/profissional" : "/dashboard/estabelecimento";
}

export function BusinessProfileEditorPage({ role }: Props) {
  const router = useRouter();
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const [usuarioId, setUsuarioId] = useState("");
  const [authUserId, setAuthUserId] = useState("");
  const [email, setEmail] = useState("");

  const [name, setName] = useState("");
  const [endereco, setEndereco] = useState<EnderecoForm>({
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
  });
  const [contato, setContato] = useState<ContatoForm>({
    whatsapp: "",
    instagram: "",
    site: "",
  });
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [benefits, setBenefits] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryWarning, setCategoryWarning] = useState("");
  const [description, setDescription] = useState("");

  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([]);
  const [photoWarning, setPhotoWarning] = useState("");

  const [existingPanfleto, setExistingPanfleto] = useState("");
  const [newCatalog, setNewCatalog] = useState<File | null>(null);

  const charactersLeft = useMemo(() => 500 - description.length, [description.length]);

  useEffect(() => {
    const previews = newPhotos.map((file) => URL.createObjectURL(file));
    setNewPhotoPreviews(previews);

    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [newPhotos]);

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

  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user?.email) {
        router.replace("/auth");
        return;
      }

      setAuthUserId(user.id);

      const { data, error: loadError } = await supabase
        .from("usuarios")
        .select("id, nome, email, role, endereco, contato, meios_pagamento, fotos, panfleto, beneficios, descricao, categorias")
        .eq("email", user.email)
        .eq("role", role)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!mounted) return;

      if (loadError || !data || data.length === 0) {
        setError("Não foi possível carregar os dados do perfil.");
        setIsBootLoading(false);
        return;
      }

      const row = data[0] as any;
      const enderecoData = (row.endereco || {}) as Partial<EnderecoForm>;
      const contatoData = (row.contato || {}) as Partial<ContatoForm>;

      setUsuarioId(row.id || "");
      setEmail(row.email || user.email);
      setName(row.nome || "");
      setEndereco({
        cep: enderecoData.cep || "",
        logradouro: enderecoData.logradouro || "",
        numero: enderecoData.numero || "",
        complemento: enderecoData.complemento || "",
        bairro: enderecoData.bairro || "",
        cidade: enderecoData.cidade || "",
        uf: enderecoData.uf || "",
      });
      setContato({
        whatsapp: contatoData.whatsapp || "",
        instagram: contatoData.instagram || "",
        site: contatoData.site || "",
      });
      setPaymentMethods(Array.isArray(row.meios_pagamento) ? row.meios_pagamento : []);
      setBenefits(Array.isArray(row.beneficios) ? row.beneficios : []);
      setSelectedCategories(Array.isArray(row.categorias) ? row.categorias.filter((item: unknown) => typeof item === "string") : []);
      setDescription((row.descricao || "").toString().slice(0, 500));
      setExistingPhotos(Array.isArray(row.fotos) ? row.fotos.filter((url: string) => Boolean(url)) : []);
      setExistingPanfleto((row.panfleto || "").toString());
      setIsBootLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [role, router]);

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

  const handleNewPhotosChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    if (selected.length === 0) return;

    setNewPhotos((prev) => {
      const maxNewAllowed = Math.max(0, 3 - existingPhotos.length);
      const merged = [...prev, ...selected];
      if (merged.length > maxNewAllowed) {
        setPhotoWarning("Você pode manter no máximo 3 fotos no total.");
      } else {
        setPhotoWarning("");
      }
      return merged.slice(0, maxNewAllowed);
    });

    event.target.value = "";
  };

  const handleRemoveExistingPhoto = (indexToRemove: number) => {
    setExistingPhotos((prev) => prev.filter((_, index) => index !== indexToRemove));
    setPhotoWarning("");
  };

  const handleRemoveNewPhoto = (indexToRemove: number) => {
    setNewPhotos((prev) => prev.filter((_, index) => index !== indexToRemove));
    setPhotoWarning("");
  };

  const handleCatalogChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null;
    setNewCatalog(selected);
  };

  const uploadNewPhotos = async (bucket: string, userId: string) => {
    if (newPhotos.length === 0) return [] as string[];

    const uploadedUrls: string[] = [];
    for (const [index, file] of newPhotos.entries()) {
      const extension = getFileExtension(file.name);
      const filePath = `${userId}/foto-${Date.now()}-${index + 1}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  };

  const uploadNewCatalog = async (bucket: string, userId: string) => {
    if (!newCatalog) return "";
    const extension = getFileExtension(newCatalog.name);
    const filePath = `${userId}/catalogo-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, newCatalog, { upsert: false });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsSaving(true);

    try {
      if (!usuarioId || !authUserId) {
        setError("Não foi possível identificar seu perfil para atualização.");
        setIsSaving(false);
        return;
      }

      const bucket = role === "profissional" ? "profissionais" : "estabelecimentos";
      const uploadedPhotos = await uploadNewPhotos(bucket, authUserId);
      const uploadedCatalogUrl = await uploadNewCatalog(bucket, authUserId);

      const mergedPhotos = [...existingPhotos, ...uploadedPhotos].slice(0, 3);
      const finalPanfleto = uploadedCatalogUrl || existingPanfleto || null;

      const payload = {
        nome: name,
        endereco,
        contato,
        categorias: selectedCategories,
        meios_pagamento: paymentMethods,
        beneficios: benefits,
        descricao: description.trim(),
        fotos: mergedPhotos,
        panfleto: finalPanfleto,
      };

      const { error: updateError } = await supabase.from("usuarios").update(payload).eq("id", usuarioId);
      if (updateError) {
        setError("Não foi possível salvar as alterações do perfil.");
        setIsSaving(false);
        return;
      }

      setNewPhotos([]);
      setExistingPhotos(mergedPhotos);
      setNewCatalog(null);
      setExistingPanfleto(finalPanfleto || "");
      setFeedback("Perfil atualizado com sucesso.");
      router.push(getDashboardPathByRole(role));
    } catch {
      setError("Falha ao atualizar perfil. Tente novamente em instantes.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isBootLoading) {
    return (
      <main className="py-8">
        <Container>
          <section className="mx-auto max-w-3xl rounded-lg border bg-white p-5 shadow">
            <p className="text-sm text-graytext">Carregando dados do perfil...</p>
          </section>
        </Container>
      </main>
    );
  }

  return (
    <main className="py-8">
      <Container>
        <section className="mx-auto max-w-3xl rounded-lg border bg-white p-5 shadow">
          <h1 className="text-xl font-bold text-blue-900">Editar perfil</h1>
          <p className="mt-2 text-sm text-graytext">Atualize as informações do seu cadastro profissional/estabelecimento.</p>

          {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {feedback && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{feedback}</p>}

          <form className="mt-4 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-blue-900">Nome / Razão social</label>
              <input className="w-full rounded-lg border px-3 py-2" onChange={(event) => setName(event.target.value)} value={name} />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-blue-900">E-mail</label>
              <input className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-gray-500" readOnly value={email} />
            </div>

            <div className="rounded-lg border bg-blue-50 p-3">
              <p className="mb-3 text-sm font-semibold text-blue-900">Endereço</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className="rounded-lg border px-3 py-2"
                  onChange={(event) => setEndereco((prev) => ({ ...prev, cep: event.target.value }))}
                  placeholder="CEP"
                  value={endereco.cep}
                />
                <input
                  className="rounded-lg border px-3 py-2"
                  onChange={(event) => setEndereco((prev) => ({ ...prev, numero: event.target.value }))}
                  placeholder="Número"
                  value={endereco.numero}
                />
              </div>
              <input
                className="mt-2 w-full rounded-lg border px-3 py-2"
                onChange={(event) => setEndereco((prev) => ({ ...prev, logradouro: event.target.value }))}
                placeholder="Logradouro"
                value={endereco.logradouro}
              />
              <input
                className="mt-2 w-full rounded-lg border px-3 py-2"
                onChange={(event) => setEndereco((prev) => ({ ...prev, complemento: event.target.value }))}
                placeholder="Complemento"
                value={endereco.complemento}
              />
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <input
                  className="rounded-lg border px-3 py-2"
                  onChange={(event) => setEndereco((prev) => ({ ...prev, bairro: event.target.value }))}
                  placeholder="Bairro"
                  value={endereco.bairro}
                />
                <input
                  className="rounded-lg border px-3 py-2"
                  onChange={(event) => setEndereco((prev) => ({ ...prev, cidade: event.target.value }))}
                  placeholder="Cidade"
                  value={endereco.cidade}
                />
                <input
                  className="rounded-lg border px-3 py-2"
                  onChange={(event) => setEndereco((prev) => ({ ...prev, uf: event.target.value }))}
                  placeholder="UF"
                  value={endereco.uf}
                />
              </div>
            </div>

            <div className="rounded-lg border bg-blue-50 p-3">
              <p className="mb-3 text-sm font-semibold text-blue-900">Contato</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  className="rounded-lg border px-3 py-2"
                  onChange={(event) => setContato((prev) => ({ ...prev, whatsapp: event.target.value }))}
                  placeholder="WhatsApp"
                  value={contato.whatsapp}
                />
                <input
                  className="rounded-lg border px-3 py-2"
                  onChange={(event) => setContato((prev) => ({ ...prev, instagram: event.target.value }))}
                  placeholder="Instagram"
                  value={contato.instagram}
                />
                <input
                  className="rounded-lg border px-3 py-2"
                  onChange={(event) => setContato((prev) => ({ ...prev, site: event.target.value }))}
                  placeholder="Site"
                  value={contato.site}
                />
              </div>
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
              <label className="mb-2 block text-sm font-semibold text-blue-900">Fotos (máximo 3)</label>
              <input accept="image/*" className="w-full rounded-lg border px-3 py-2" multiple onChange={handleNewPhotosChange} type="file" />
              {photoWarning && <p className="mt-2 text-xs text-red-700">{photoWarning}</p>}

              {existingPhotos.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-semibold text-graytext">Fotos atuais</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {existingPhotos.map((url, index) => (
                      <div key={`${url}-${index}`} className="relative overflow-hidden rounded-lg border bg-gray-50">
                        <img alt={`Foto atual ${index + 1}`} className="h-24 w-full object-cover" src={url} />
                        <button
                          aria-label={`Remover foto atual ${index + 1}`}
                          className="absolute right-1 top-1 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-red-700 shadow"
                          onClick={() => handleRemoveExistingPhoto(index)}
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {newPhotoPreviews.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-semibold text-graytext">Novas fotos</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {newPhotoPreviews.map((previewUrl, index) => (
                      <div key={`${previewUrl}-${index}`} className="relative overflow-hidden rounded-lg border bg-gray-50">
                        <img alt={`Nova foto ${index + 1}`} className="h-24 w-full object-cover" src={previewUrl} />
                        <button
                          aria-label={`Remover nova foto ${index + 1}`}
                          className="absolute right-1 top-1 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-red-700 shadow"
                          onClick={() => handleRemoveNewPhoto(index)}
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-blue-900">Panfleto / Catálogo (PDF)</label>
              <input accept="application/pdf" className="w-full rounded-lg border px-3 py-2" onChange={handleCatalogChange} type="file" />

              {existingPanfleto && (
                <div className="mt-2 flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2 text-sm">
                  <a className="font-semibold text-blue-900 underline" href={existingPanfleto} rel="noreferrer" target="_blank">
                    Ver panfleto atual
                  </a>
                  <button
                    className="text-sm font-semibold text-red-700"
                    onClick={() => {
                      setExistingPanfleto("");
                      setNewCatalog(null);
                    }}
                    type="button"
                  >
                    Remover
                  </button>
                </div>
              )}

              {newCatalog && <p className="mt-2 text-xs text-graytext">Novo arquivo selecionado: {newCatalog.name}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-blue-900">Descrição (até 500 caracteres)</label>
              <textarea
                className="min-h-28 w-full rounded-lg border px-3 py-2"
                maxLength={500}
                onChange={(event) => setDescription(event.target.value)}
                value={description}
              />
              <p className="mt-1 text-right text-xs text-graytext">{charactersLeft} caracteres restantes</p>
            </div>

            <div className="flex gap-2">
              <button className="w-full rounded-lg bg-blue-900 px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={isSaving} type="submit">
                {isSaving ? "Salvando..." : "Salvar alterações"}
              </button>
              <button
                className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-900"
                onClick={() => router.push(getDashboardPathByRole(role))}
                type="button"
              >
                Voltar
              </button>
            </div>
          </form>
        </section>
      </Container>
    </main>
  );
}
