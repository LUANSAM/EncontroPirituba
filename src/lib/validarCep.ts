import { supabase } from "@/lib/supabase/client";

export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export interface ValidacaoCepResult {
  valido: boolean;
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  distrito?: string;
  autorizado: boolean;
  mensagem: string;
}

interface DistritoRow {
  distrito: string;
}

/**
 * Normaliza o CEP removendo caracteres não numéricos
 */
export function normalizarCep(cep: string): string {
  return cep.replace(/\D/g, "");
}

/**
 * Busca os distritos autorizados no Supabase
 */
export async function buscarDistritosAutorizados(): Promise<string[]> {
  const { data, error } = await supabase
    .from("distritos")
    .select("distrito")
    .eq("autorizado", true);

  if (error) {
    console.error("Erro ao buscar distritos autorizados:", error);
    return [];
  }

  return data?.map((d: DistritoRow) => d.distrito.toLowerCase().trim()) || [];
}

/**
 * Consulta o ViaCEP e valida se o bairro está autorizado
 */
export async function validarCep(cep: string): Promise<ValidacaoCepResult> {
  const cepNormalizado = normalizarCep(cep);

  // Valida formato do CEP
  if (!cepNormalizado || cepNormalizado.length !== 8) {
    return {
      valido: false,
      autorizado: false,
      mensagem: "CEP inválido. Digite um CEP com 8 dígitos.",
    };
  }

  try {
    // Consulta ViaCEP
    const response = await fetch(`https://viacep.com.br/ws/${cepNormalizado}/json/`);
    
    if (!response.ok) {
      return {
        valido: false,
        autorizado: false,
        mensagem: "Erro ao consultar o CEP. Tente novamente.",
      };
    }

    const viaCepData: ViaCepResponse = await response.json();

    if (viaCepData.erro) {
      return {
        valido: false,
        autorizado: false,
        mensagem: "CEP não encontrado. Verifique o número digitado.",
      };
    }

    // Busca distritos autorizados
    const distritosAutorizados = await buscarDistritosAutorizados();

    // Normaliza o bairro retornado pelo ViaCEP
    const bairroNormalizado = viaCepData.bairro?.toLowerCase().trim() || "";

    // Verifica se o bairro está na lista de autorizados
    const autorizado = distritosAutorizados.some(
      (distrito) => bairroNormalizado.includes(distrito) || distrito.includes(bairroNormalizado)
    );

    return {
      valido: true,
      cep: viaCepData.cep,
      logradouro: viaCepData.logradouro,
      complemento: viaCepData.complemento,
      bairro: viaCepData.bairro,
      cidade: viaCepData.localidade,
      uf: viaCepData.uf,
      distrito: viaCepData.bairro,
      autorizado,
      mensagem: autorizado
        ? `CEP válido! Bairro: ${viaCepData.bairro}, ${viaCepData.localidade}/${viaCepData.uf}`
        : `Atualmente, apenas cadastros dos distritos da Subprefeitura de Pirituba são aceitos. Seu bairro (${viaCepData.bairro}) não está autorizado no momento. Entre em contato para mais informações.`,
    };
  } catch (error) {
    console.error("Erro na validação do CEP:", error);
    return {
      valido: false,
      autorizado: false,
      mensagem: "Erro ao validar o CEP. Verifique sua conexão e tente novamente.",
    };
  }
}
