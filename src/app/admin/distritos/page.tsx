"use client";

import { useState, useEffect } from "react";
import { Container } from "@/components/atoms/Container";
import { supabase } from "@/lib/supabase/client";

interface Distrito {
  id: string;
  distrito: string;
  autorizado: boolean;
  descricao: string | null;
  created_at: string;
}

export default function AdminDistritosPage() {
  const [distritos, setDistritos] = useState<Distrito[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [novoDistrito, setNovoDistrito] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");

  useEffect(() => {
    carregarDistritos();
  }, []);

  const carregarDistritos = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("distritos")
      .select("*")
      .order("distrito", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setDistritos(data || []);
    }
    setLoading(false);
  };

  const adicionarDistrito = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!novoDistrito.trim()) {
      setError("Digite o nome do distrito");
      return;
    }

    const { error: insertError } = await supabase
      .from("distritos")
      .insert({
        distrito: novoDistrito.trim(),
        autorizado: true,
        descricao: novaDescricao.trim() || null,
      });

    if (insertError) {
      setError(insertError.message);
    } else {
      setSuccess(`Distrito "${novoDistrito}" adicionado com sucesso!`);
      setNovoDistrito("");
      setNovaDescricao("");
      carregarDistritos();
    }
  };

  const toggleAutorizado = async (id: string, valorAtual: boolean) => {
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("distritos")
      .update({ autorizado: !valorAtual })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("Status atualizado com sucesso!");
      carregarDistritos();
    }
  };

  const excluirDistrito = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o distrito "${nome}"?`)) {
      return;
    }

    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase
      .from("distritos")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess(`Distrito "${nome}" excluído com sucesso!`);
      carregarDistritos();
    }
  };

  return (
    <main className="py-8">
      <Container>
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-blue-900">Gerenciar Distritos Autorizados</h1>
          <p className="mt-2 text-graytext">
            Configure quais distritos/bairros são permitidos para cadastro de profissionais e estabelecimentos.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {success}
            </div>
          )}

          {/* Formulário para adicionar novo distrito */}
          <section className="mt-6 rounded-lg border bg-white p-5 shadow">
            <h2 className="text-xl font-semibold text-blue-900">Adicionar Novo Distrito</h2>
            <form className="mt-4 space-y-3" onSubmit={adicionarDistrito}>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nome do Distrito *
                </label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  onChange={(e) => setNovoDistrito(e.target.value)}
                  placeholder="Ex: Pirituba, Jaraguá, São Domingos"
                  required
                  type="text"
                  value={novoDistrito}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Descrição (opcional)
                </label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  placeholder="Ex: Distrito da Subprefeitura de Pirituba"
                  type="text"
                  value={novaDescricao}
                />
              </div>

              <button
                className="rounded-lg bg-blue-900 px-4 py-2 font-semibold text-white hover:bg-blue-800"
                type="submit"
              >
                Adicionar Distrito
              </button>
            </form>
          </section>

          {/* Lista de distritos existentes */}
          <section className="mt-6 rounded-lg border bg-white p-5 shadow">
            <h2 className="text-xl font-semibold text-blue-900">Distritos Cadastrados</h2>
            
            {loading ? (
              <p className="mt-4 text-center text-graytext">Carregando...</p>
            ) : distritos.length === 0 ? (
              <p className="mt-4 text-center text-graytext">Nenhum distrito cadastrado ainda.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm font-semibold text-gray-700">
                      <th className="pb-2">Distrito</th>
                      <th className="pb-2">Descrição</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distritos.map((distrito) => (
                      <tr key={distrito.id} className="border-b">
                        <td className="py-3 font-medium text-gray-900">{distrito.distrito}</td>
                        <td className="py-3 text-sm text-graytext">
                          {distrito.descricao || "—"}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                              distrito.autorizado
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {distrito.autorizado ? "Autorizado" : "Desabilitado"}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            <button
                              className={`rounded px-3 py-1 text-xs font-semibold ${
                                distrito.autorizado
                                  ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                  : "bg-green-100 text-green-700 hover:bg-green-200"
                              }`}
                              onClick={() => toggleAutorizado(distrito.id, distrito.autorizado)}
                              type="button"
                            >
                              {distrito.autorizado ? "Desabilitar" : "Habilitar"}
                            </button>
                            <button
                              className="rounded bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
                              onClick={() => excluirDistrito(distrito.id, distrito.distrito)}
                              type="button"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Informações úteis */}
          <section className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="font-semibold text-blue-900">ℹ️ Informações Importantes</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-blue-800">
              <li>Apenas distritos marcados como "Autorizado" permitem cadastro de profissionais/estabelecimentos</li>
              <li>A validação é feita comparando o bairro retornado pelo ViaCEP com os nomes cadastrados aqui</li>
              <li>Use nomes exatos como aparecem no ViaCEP (ex: "Pirituba", "Jaraguá", "São Domingos")</li>
              <li>Desabilitar um distrito não afeta cadastros já aprovados, apenas novos cadastros</li>
            </ul>
          </section>
        </div>
      </Container>
    </main>
  );
}
