import { describe, expect, it } from 'vitest'
import {
  EDITOR,
  NUCLEO,
  PAUTEIRO,
  PESQUISADOR,
  REDATOR,
  REVISOR,
  SKILL_VERSION,
  buildSystemPrompt,
  type PapelAgente,
} from './skill.js'

const PAPEIS: PapelAgente[] = ['pesquisador', 'redator', 'editor', 'revisor', 'pauteiro']

describe('buildSystemPrompt', () => {
  it('todo agente recebe o núcleo da Skill', () => {
    for (const papel of PAPEIS) {
      const prompt = buildSystemPrompt(papel, 'perfil')
      expect(prompt).toContain('PROIBIÇÕES ABSOLUTAS')
      expect(prompt).toContain('ORDEM DE PRIORIDADE')
    }
  })

  it('cada papel recebe só o próprio bloco', () => {
    const redator = buildSystemPrompt('redator', '')
    expect(redator).toContain('SEU PAPEL: escrever o artigo')
    expect(redator).not.toContain('SEU PAPEL: controle de qualidade')

    const revisor = buildSystemPrompt('revisor', '')
    expect(revisor).toContain('SEU PAPEL: controle de qualidade')
    expect(revisor).not.toContain('CAMPOS SEO OBRIGATÓRIOS')
  })

  it('o perfil renderizado entra no prompt', () => {
    const prompt = buildSystemPrompt('redator', '# PERFIL DO CLIENTE\n- Nome: ABX')
    expect(prompt).toContain('# PERFIL DO CLIENTE')
    expect(prompt).toContain('ABX')
  })

  it('perfil vazio não deixa separador órfão no fim', () => {
    expect(buildSystemPrompt('redator', '').endsWith('---')).toBe(false)
  })
})

describe('recorte por papel', () => {
  it('só o Redator recebe as travas de linguagem humana', () => {
    expect(REDATOR).toContain('NÃO use travessões')
    expect(EDITOR).not.toContain('NÃO use travessões')
  })

  it('só o Editor recebe as regras de link interno', () => {
    expect(EDITOR).toContain('Use SOMENTE URLs de links_candidatos')
    expect(REDATOR).toContain('PROIBIDO NESTA ETAPA: inserir qualquer URL')
  })

  it('só o Revisor recebe o score §64', () => {
    expect(REVISOR).toContain('Nenhuma categoria pode ficar abaixo de 8')
    expect(PESQUISADOR).not.toContain('Nenhuma categoria pode ficar abaixo de 8')
  })

  it('Pesquisador e Pauteiro recebem canibalização, cada um no seu escopo', () => {
    expect(PESQUISADOR).toContain('CANIBALIZAÇÃO')
    expect(PAUTEIRO).toContain('ATUALIZAR em vez de CRIAR')
  })

  it('o núcleo cabe no orçamento de contexto dos agentes', () => {
    // A Skill completa tem ~40 KB; o núcleo precisa ficar muito abaixo disso
    expect(NUCLEO.length).toBeLessThan(4000)
    for (const bloco of [PESQUISADOR, REDATOR, EDITOR, REVISOR, PAUTEIRO]) {
      expect(bloco.length).toBeLessThan(8000)
    }
  })
})

describe('SKILL_VERSION', () => {
  it('segue versionamento semântico', () => {
    expect(SKILL_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
