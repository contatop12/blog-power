import {
  PERFIL_BLOCOS,
  PERFIL_CAMPOS,
  type PaginaRef,
  type PerfilBloco,
  type PerfilCampoMeta,
  type PerfilCliente,
  type PerfilCompletude,
  type ProfissionalResponsavel,
  type ServicoMarca,
} from '@publisher-p12/types'

export { PERFIL_BLOCOS, PERFIL_CAMPOS }

/**
 * Espelha `campoPreenchido` do pacote execution. A API devolve a completude oficial;
 * esta cópia serve para a barra reagir enquanto o usuário digita, antes de salvar.
 */
export function campoPreenchido(perfil: PerfilCliente, campo: PerfilCampoMeta): boolean {
  const valor = perfil[campo.chave]
  if (Array.isArray(valor)) return valor.length > 0
  return typeof valor === 'string' && valor.trim().length > 0
}

export function calcularCompletudeLocal(perfil: PerfilCliente): PerfilCompletude {
  const blocos = PERFIL_BLOCOS.map(({ bloco }) => {
    const campos = PERFIL_CAMPOS.filter((c) => c.bloco === bloco)
    return {
      bloco: bloco as PerfilBloco,
      preenchidos: campos.filter((c) => campoPreenchido(perfil, c)).length,
      total: campos.length,
    }
  })

  const preenchidos = blocos.reduce((soma, b) => soma + b.preenchidos, 0)
  const total = PERFIL_CAMPOS.length

  return {
    percentual: total === 0 ? 0 : Math.round((preenchidos / total) * 100),
    preenchidos,
    total,
    blocos,
    faltando_obrigatorios: PERFIL_CAMPOS.filter(
      (c) => c.obrigatorio && !campoPreenchido(perfil, c),
    ).map((c) => c.chave),
  }
}

/** Perfil zerado para a primeira renderização, antes de a API responder. */
export function perfilVazio(): PerfilCliente {
  const base: Record<string, unknown> = {}
  for (const campo of PERFIL_CAMPOS) {
    base[campo.chave] = campo.tipo === 'texto' || campo.tipo === 'texto_longo' ? '' : []
  }
  return base as unknown as PerfilCliente
}

// --- Conversão lista <-> textarea -------------------------------------------

export function listaParaTexto(valor: string[] | undefined): string {
  return (valor ?? []).join('\n')
}

export function textoParaLista(texto: string): string[] {
  return texto
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

// --- Itens em branco das listas estruturadas ---------------------------------

export function servicoVazio(): ServicoMarca {
  return { nome: '', url: '' }
}

export function paginaVazia(): PaginaRef {
  return { url: '', titulo: '' }
}

export function profissionalVazio(): ProfissionalResponsavel {
  return { nome: '', funcao: '', especialidade: '', url_autor: '' }
}

/**
 * Remove as linhas em branco que o usuário deixou para trás antes de enviar.
 * A API normaliza de novo; isto evita que o contador de completude conte vazio.
 */
export function limparListasEstruturadas(perfil: PerfilCliente): PerfilCliente {
  return {
    ...perfil,
    servicos: (perfil.servicos ?? []).filter((s) => s.nome.trim()),
    paginas_importantes: (perfil.paginas_importantes ?? []).filter((p) => p.url.trim()),
    paginas_servicos: (perfil.paginas_servicos ?? []).filter((p) => p.url.trim()),
    artigos_publicados: (perfil.artigos_publicados ?? []).filter((p) => p.url.trim()),
    profissionais_responsaveis: (perfil.profissionais_responsaveis ?? []).filter((p) =>
      p.nome.trim(),
    ),
  }
}
