import { describe, expect, it } from 'vitest'
import { PERFIL_CAMPOS } from '@publisher-p12/types'
import {
  calcularCompletude,
  emptyPerfilCliente,
  normalizePerfilCliente,
  renderPerfilParaPrompt,
  validatePerfilCliente,
} from './perfil.js'

const PERFIL_MINIMO = {
  nome_empresa: 'ABX Telecom',
  site: 'https://abxtelecom.com.br',
  servicos: [{ nome: 'Link dedicado', url: 'https://abxtelecom.com.br/link-dedicado' }],
  publico_alvo: 'Gestores de TI de empresas médias',
  tom_de_voz: 'Técnico e direto, sem jargão de vendas',
}

describe('normalizePerfilCliente', () => {
  it('devolve perfil vazio para entrada nula', () => {
    const perfil = normalizePerfilCliente(null)
    expect(perfil.nome_empresa).toBe('')
    expect(perfil.servicos).toEqual([])
  })

  it('aceita string multilinha no lugar de lista', () => {
    const perfil = normalizePerfilCliente({ certificacoes: 'ISO 9001\n  \nANATEL  ' })
    expect(perfil.certificacoes).toEqual(['ISO 9001', 'ANATEL'])
  })

  it('descarta item de lista estruturada sem a chave obrigatória', () => {
    const perfil = normalizePerfilCliente({
      servicos: [{ nome: 'Link dedicado', url: 'x' }, { url: 'sem-nome' }, 'lixo'],
      paginas_servicos: [{ url: 'https://a.com', titulo: 'A' }, { titulo: 'sem url' }],
      profissionais_responsaveis: [{ nome: 'Ana', funcao: 'CTO' }, { funcao: 'sem nome' }],
    })

    expect(perfil.servicos).toHaveLength(1)
    expect(perfil.paginas_servicos).toHaveLength(1)
    expect(perfil.profissionais_responsaveis).toEqual([
      { nome: 'Ana', funcao: 'CTO', especialidade: '' },
    ])
  })

  it('deriva os 8 campos legados a partir dos campos novos', () => {
    const perfil = normalizePerfilCliente({
      ...PERFIL_MINIMO,
      posicionamento: 'Provedor regional de conectividade corporativa',
      icp: 'Indústrias com mais de 50 funcionários',
      diferenciais_reais: ['SLA de 99,8% auditado'],
      certificacoes: ['ANATEL'],
      cases: ['Migração da rede da Indústria X'],
      informacoes_proibidas: ['Preços de contrato'],
      restricoes_legais: ['Regras da ANATEL para publicidade'],
      ctas_permitidos: ['Fale com um especialista', 'Peça uma proposta'],
      diretriz_visual: 'Fotografia corporativa, azul institucional',
    })

    expect(perfil.descricao_institucional).toBe('Provedor regional de conectividade corporativa')
    expect(perfil.segmentos_atendidos).toEqual([
      'Gestores de TI de empresas médias',
      'Indústrias com mais de 50 funcionários',
    ])
    expect(perfil.provas_eeat).toEqual([
      'SLA de 99,8% auditado',
      'ANATEL',
      'Migração da rede da Indústria X',
    ])
    expect(perfil.proibicoes).toEqual([
      'Preços de contrato',
      'Regras da ANATEL para publicidade',
    ])
    expect(perfil.cta_padrao).toBe('Fale com um especialista')
    expect(perfil.diretriz_visual).toBe('Fotografia corporativa, azul institucional')
  })

  it('converte perfil legado PerfilMarca sem perder informação', () => {
    const perfil = normalizePerfilCliente({
      descricao_institucional: 'Clínica de audiologia',
      segmentos_atendidos: ['Idosos', 'Adultos com perda auditiva'],
      servicos: [{ nome: 'Adaptação de aparelho', url: 'https://x.com/adaptacao' }],
      provas_eeat: ['15 anos de atuação'],
      tom_de_voz: 'Acolhedor',
      proibicoes: ['Prometer cura'],
      cta_padrao: 'Agende uma avaliação',
      diretriz_visual: 'Ambiente clínico claro',
    })

    expect(perfil.posicionamento).toBe('Clínica de audiologia')
    expect(perfil.publico_alvo).toBe('Idosos, Adultos com perda auditiva')
    expect(perfil.diferenciais_reais).toEqual(['15 anos de atuação'])
    expect(perfil.informacoes_proibidas).toEqual(['Prometer cura'])
    expect(perfil.ctas_permitidos).toEqual(['Agende uma avaliação'])
    // E a derivação continua consistente depois da conversão
    expect(perfil.cta_padrao).toBe('Agende uma avaliação')
  })

  it('campo novo preenchido tem prioridade sobre o legado equivalente', () => {
    const perfil = normalizePerfilCliente({
      informacoes_proibidas: ['Nome de pacientes'],
      proibicoes: ['Legado que deve ser ignorado'],
    })
    expect(perfil.informacoes_proibidas).toEqual(['Nome de pacientes'])
  })
})

describe('validatePerfilCliente', () => {
  it('aprova quando os 5 campos obrigatórios estão preenchidos', () => {
    expect(validatePerfilCliente(PERFIL_MINIMO).ok).toBe(true)
  })

  it('nomeia os campos faltantes na mensagem de erro', () => {
    const resultado = validatePerfilCliente({ nome_empresa: 'ABX', site: 'https://abx.com.br' })

    expect(resultado.ok).toBe(false)
    expect(resultado.faltando).toEqual(['tom_de_voz', 'servicos', 'publico_alvo'])
    expect(resultado.mensagem).toContain('Tom de voz')
    expect(resultado.mensagem).toContain('Serviços')
    expect(resultado.mensagem).toContain('Público-alvo')
  })

  it('perfil nulo reprova sem lançar', () => {
    expect(validatePerfilCliente(null).ok).toBe(false)
  })
})

describe('calcularCompletude', () => {
  it('perfil vazio tem 0%', () => {
    const completude = calcularCompletude(emptyPerfilCliente())
    expect(completude.percentual).toBe(0)
    expect(completude.preenchidos).toBe(0)
    expect(completude.total).toBe(PERFIL_CAMPOS.length)
  })

  it('conta por bloco e lista os obrigatórios que faltam', () => {
    const completude = calcularCompletude(normalizePerfilCliente(PERFIL_MINIMO))

    const identidade = completude.blocos.find((b) => b.bloco === 'identidade')
    // nome_empresa, site e tom_de_voz de 5 campos do bloco
    expect(identidade).toEqual({ bloco: 'identidade', preenchidos: 3, total: 5 })
    expect(completude.faltando_obrigatorios).toEqual([])
    expect(completude.percentual).toBeGreaterThan(0)
  })

  it('lista vazia não conta como preenchida', () => {
    const completude = calcularCompletude(
      normalizePerfilCliente({ ...PERFIL_MINIMO, certificacoes: [] }),
    )
    expect(completude.blocos.find((b) => b.bloco === 'autoridade')?.preenchidos).toBe(0)
  })
})

describe('renderPerfilParaPrompt', () => {
  it('omite campos vazios', () => {
    const texto = renderPerfilParaPrompt(PERFIL_MINIMO)

    expect(texto).toContain('ABX Telecom')
    expect(texto).toContain('Link dedicado (https://abxtelecom.com.br/link-dedicado)')
    expect(texto).not.toContain('Ticket médio')
    expect(texto).not.toContain('Concorrentes')
  })

  it('avisa sobre obrigatórios ausentes em vez de deixar o modelo preencher', () => {
    const texto = renderPerfilParaPrompt({ nome_empresa: 'ABX', site: 'https://abx.com.br' })

    expect(texto).toContain('Não informado')
    expect(texto).toContain('Nunca preencha por conta própria')
    expect(texto).toContain('Tom de voz')
  })

  it('perfil totalmente vazio não vira texto enganoso', () => {
    expect(renderPerfilParaPrompt(null)).toBe('PERFIL DO CLIENTE: não preenchido.')
  })

  it('agrupa por bloco com o título legível', () => {
    const texto = renderPerfilParaPrompt({
      ...PERFIL_MINIMO,
      restricoes_legais: ['Resolução ANATEL 632'],
    })

    expect(texto).toContain('## Identidade e marca')
    expect(texto).toContain('## Compliance e restrições')
    expect(texto).toContain('Resolução ANATEL 632')
  })
})
