import type { PerfilBloco, PerfilCampoMeta } from './index'

/**
 * Metadados dos 33 campos do perfil do cliente — fonte única para UI, validação,
 * completude e renderização de prompt. Ordem dos campos = ordem na tela.
 *
 * 32 campos vêm da lista de briefing acordada com o usuário. `diretriz_visual` é o 33º:
 * não está na lista, mas `directives/imagem.md` depende dele para dar direção de marca
 * ao gerador de imagem.
 *
 * `obrigatorio: true` = o pipeline recusa redigir sem o campo (ver validatePerfilCliente).
 */
export const PERFIL_CAMPOS: PerfilCampoMeta[] = [
  // --- Identidade e marca ---
  {
    chave: 'nome_empresa',
    label: 'Nome da empresa',
    bloco: 'identidade',
    tipo: 'texto',
    obrigatorio: true,
    dica: 'Nome exato como a empresa deve ser citada nos artigos. Skill §69 exige consistência entre páginas.',
    placeholder: 'ABX Telecom',
  },
  {
    chave: 'site',
    label: 'Site',
    bloco: 'identidade',
    tipo: 'texto',
    obrigatorio: true,
    dica: 'URL institucional com https://. Usada para desambiguar a entidade da empresa.',
    placeholder: 'https://abxtelecom.com.br',
  },
  {
    chave: 'posicionamento',
    label: 'Posicionamento',
    bloco: 'identidade',
    tipo: 'texto_longo',
    obrigatorio: false,
    dica: 'Como a empresa quer ser percebida no mercado. Vira a descrição institucional usada pelos agentes.',
  },
  {
    chave: 'tom_de_voz',
    label: 'Tom de voz',
    bloco: 'identidade',
    tipo: 'texto_longo',
    obrigatorio: true,
    dica: 'Padrão da Skill §44 é profissional, acessível e didático. Descreva aqui o que muda para este cliente.',
  },
  {
    chave: 'diretriz_visual',
    label: 'Diretriz visual',
    bloco: 'identidade',
    tipo: 'texto_longo',
    obrigatorio: false,
    dica: 'Direção de arte das imagens geradas: paleta, estilo, ambientes. O gerador nunca escreve texto na imagem (Skill §38).',
  },

  // --- Oferta ---
  {
    chave: 'servicos',
    label: 'Serviços',
    bloco: 'oferta',
    tipo: 'lista_servico',
    obrigatorio: true,
    dica: 'Nome do serviço + URL da página correspondente. A URL vira candidata a link interno.',
  },
  {
    chave: 'produtos',
    label: 'Produtos',
    bloco: 'oferta',
    tipo: 'lista',
    obrigatorio: false,
    dica: 'Produtos vendidos, quando diferentes dos serviços.',
  },
  {
    chave: 'servicos_prioritarios',
    label: 'Serviços prioritários',
    bloco: 'oferta',
    tipo: 'lista',
    obrigatorio: false,
    dica: 'Onde o comercial quer gerar oportunidade. O Pesquisador usa isso para pontuar potencial comercial da pauta.',
  },
  {
    chave: 'especialidades',
    label: 'Especialidades',
    bloco: 'oferta',
    tipo: 'lista',
    obrigatorio: false,
    dica: 'Áreas em que a empresa tem profundidade técnica real. Alimenta a expertise do E-E-A-T (Skill §22).',
  },
  {
    chave: 'diferenciais',
    label: 'Diferenciais',
    bloco: 'oferta',
    tipo: 'lista',
    obrigatorio: false,
    dica: 'Diferenciais alegados, de posicionamento. Os comprováveis vão em "Diferenciais reais".',
  },
  {
    chave: 'ticket_medio',
    label: 'Ticket médio',
    bloco: 'oferta',
    tipo: 'texto',
    obrigatorio: false,
    dica: 'Ordem de grandeza do contrato. Calibra a profundidade e a carga comercial do artigo. Nunca é publicado.',
  },

  // --- Mercado ---
  {
    chave: 'publico_alvo',
    label: 'Público-alvo',
    bloco: 'mercado',
    tipo: 'texto_longo',
    obrigatorio: true,
    dica: 'Quem lê o artigo. Define o nível de linguagem e o que precisa ser explicado (Skill §19).',
  },
  {
    chave: 'icp',
    label: 'ICP',
    bloco: 'mercado',
    tipo: 'texto_longo',
    obrigatorio: false,
    dica: 'Perfil de cliente ideal: porte, segmento, dor, momento de compra.',
  },
  {
    chave: 'area_geografica',
    label: 'Área geográfica de atuação',
    bloco: 'mercado',
    tipo: 'texto',
    obrigatorio: false,
    dica: 'Onde a empresa atende. Sem isso o agente não sabe se cabe SEO local (Skill §42).',
  },
  {
    chave: 'cidades_prioritarias',
    label: 'Cidades e regiões prioritárias',
    bloco: 'mercado',
    tipo: 'lista',
    obrigatorio: false,
    dica: 'Usadas só quando a busca tem intenção local. Skill §42 proíbe spam geográfico.',
  },
  {
    chave: 'concorrentes',
    label: 'Concorrentes',
    bloco: 'mercado',
    tipo: 'lista',
    obrigatorio: false,
    dica: 'Analisados para achar lacunas. Nunca viram link externo nem são copiados (Skill §59).',
  },

  // --- Autoridade (E-E-A-T) ---
  {
    chave: 'profissionais_responsaveis',
    label: 'Profissionais responsáveis',
    bloco: 'autoridade',
    tipo: 'lista_pessoa',
    obrigatorio: false,
    dica: 'Especialistas reais para autoria e revisão técnica. Skill §36: nunca inventar especialista.',
  },
  {
    chave: 'certificacoes',
    label: 'Certificações',
    bloco: 'autoridade',
    tipo: 'lista',
    obrigatorio: false,
    dica: 'Certificações verificáveis. Entram como prova de autoridade.',
  },
  {
    chave: 'diferenciais_reais',
    label: 'Diferenciais reais',
    bloco: 'autoridade',
    tipo: 'lista',
    obrigatorio: false,
    dica: 'Só o que é demonstrável objetivamente. Skill §43 proíbe "somos referência" sem prova.',
  },
  {
    chave: 'dados_proprietarios',
    label: 'Dados proprietários',
    bloco: 'autoridade',
    tipo: 'lista',
    obrigatorio: false,
    dica: 'Números internos que o artigo pode citar. É o que impede o conteúdo de virar commodity (Skill §50).',
  },
  {
    chave: 'cases',
    label: 'Cases',
    bloco: 'autoridade',
    tipo: 'lista',
    obrigatorio: false,
    dica: 'Casos reais, já autorizados pelo cliente para uso público.',
  },

  // --- Site e conteúdo ---
  {
    chave: 'paginas_importantes',
    label: 'Páginas importantes',
    bloco: 'conteudo',
    tipo: 'lista_url',
    obrigatorio: false,
    dica: 'Institucionais que merecem link interno: Sobre, Contato, página de autor.',
  },
  {
    chave: 'paginas_servicos',
    label: 'Páginas de serviços',
    bloco: 'conteudo',
    tipo: 'lista_url',
    obrigatorio: false,
    dica: 'Destino comercial dos links internos. Skill §14 as coloca como prioridade 1.',
  },
  {
    chave: 'artigos_publicados',
    label: 'Artigos já publicados',
    bloco: 'conteudo',
    tipo: 'lista_url',
    obrigatorio: false,
    dica: 'Complementar. A fonte primária é a base de conhecimento sincronizada do WordPress.',
  },

  // --- Comercial ---
  {
    chave: 'objetivos_comerciais',
    label: 'Objetivos comerciais',
    bloco: 'comercial',
    tipo: 'lista',
    obrigatorio: false,
    dica: 'O que o conteúdo precisa gerar: leads, agendamentos, autoridade em um tema.',
  },
  {
    chave: 'ctas_permitidos',
    label: 'CTAs permitidos',
    bloco: 'comercial',
    tipo: 'lista',
    obrigatorio: false,
    dica: 'Chamadas aprovadas. O agente não inventa CTA fora desta lista. O primeiro vira o CTA padrão.',
  },
  {
    chave: 'formas_contato',
    label: 'Formas de contato',
    bloco: 'comercial',
    tipo: 'lista',
    obrigatorio: false,
    dica: 'Canais que podem ser citados: telefone, WhatsApp, formulário, unidade física.',
  },
  {
    chave: 'crm_qualificacao',
    label: 'CRM e qualificação de leads',
    bloco: 'comercial',
    tipo: 'texto_longo',
    obrigatorio: false,
    dica: 'Como o lead é qualificado. Ajuda a calibrar a intensidade do CTA por etapa de funil (Skill §26).',
  },

  // --- Insights do comercial ---
  {
    chave: 'perguntas_frequentes',
    label: 'Perguntas frequentes dos clientes',
    bloco: 'insights',
    tipo: 'lista',
    obrigatorio: false,
    dica: 'Dúvidas reais que o comercial recebe. Viram FAQ e blocos citáveis (Skill §34, §51).',
  },
  {
    chave: 'objecoes_comerciais',
    label: 'Objeções comerciais',
    bloco: 'insights',
    tipo: 'lista',
    obrigatorio: false,
    dica: 'O que trava a venda. Responder objeção no artigo é conteúdo de fundo de funil.',
  },

  // --- Compliance ---
  {
    chave: 'restricoes_legais',
    label: 'Restrições legais',
    bloco: 'compliance',
    tipo: 'lista',
    obrigatorio: false,
    dica: 'Regras do setor: publicidade médica, advocacia, investimentos. Skill §61: têm prioridade absoluta sobre conversão.',
  },
  {
    chave: 'restricoes_compliance',
    label: 'Restrições de compliance',
    bloco: 'compliance',
    tipo: 'lista',
    obrigatorio: false,
    dica: 'Regras internas do cliente ou do grupo econômico.',
  },
  {
    chave: 'informacoes_proibidas',
    label: 'Informações que não podem ser utilizadas',
    bloco: 'compliance',
    tipo: 'lista',
    obrigatorio: false,
    dica: 'O que nunca pode aparecer: preços, nomes de clientes, dados de processos.',
  },
]

export const PERFIL_BLOCOS: Array<{ bloco: PerfilBloco; titulo: string; descricao: string }> = [
  {
    bloco: 'identidade',
    titulo: 'Identidade e marca',
    descricao: 'Quem é a empresa e como ela soa no texto.',
  },
  {
    bloco: 'oferta',
    titulo: 'Oferta',
    descricao: 'O que a empresa vende e o que o comercial quer priorizar.',
  },
  {
    bloco: 'mercado',
    titulo: 'Mercado e público',
    descricao: 'Para quem se escreve e onde a empresa atua.',
  },
  {
    bloco: 'autoridade',
    titulo: 'Autoridade (E-E-A-T)',
    descricao: 'Provas reais. É o que impede o artigo de virar conteúdo genérico.',
  },
  {
    bloco: 'conteudo',
    titulo: 'Site e conteúdo',
    descricao: 'Páginas que devem receber link interno.',
  },
  {
    bloco: 'comercial',
    titulo: 'Comercial e conversão',
    descricao: 'O que o conteúdo precisa gerar e como convidar o leitor.',
  },
  {
    bloco: 'insights',
    titulo: 'Insights do comercial',
    descricao: 'Perguntas e objeções reais. Fonte de pauta e de FAQ.',
  },
  {
    bloco: 'compliance',
    titulo: 'Compliance e restrições',
    descricao: 'Limites inegociáveis. Vencem qualquer objetivo de conversão.',
  },
]

export const PERFIL_CAMPOS_OBRIGATORIOS = PERFIL_CAMPOS.filter((c) => c.obrigatorio).map(
  (c) => c.chave,
)

export function camposDoBloco(bloco: PerfilBloco): PerfilCampoMeta[] {
  return PERFIL_CAMPOS.filter((c) => c.bloco === bloco)
}
