import { describe, expect, it } from 'vitest'
import type { Oportunidade } from '@publisher-p12/types'
import { FakeD1 } from '../test-support/fakeD1.js'
import type { OportunidadeCalculada } from './quickWins.js'
import {
  createIdeaFromOportunidade,
  getClientGoogle,
  listOportunidades,
  oportunidadeParaPauta,
  saveClientGoogle,
  saveOportunidades,
  setOportunidadeStatus,
} from './store.js'

const calc: OportunidadeCalculada = {
  query: 'consultoria de ti', query_norm: 'consultoria de ti', page_url: 'https://abxtelecom.com.br/ti/',
  posicao: 10.8, impressoes: 64, cliques: 0, ctr: 0, volume_mensal: 720, concorrencia: 'MEDIUM', score: 71,
}

const linha = {
  id: 'op1', client_id: 'cli', tipo: 'quick_win', query: 'consultoria de ti', query_norm: 'consultoria de ti',
  page_url: 'https://abxtelecom.com.br/ti/', posicao: 10.8, impressoes: 64, cliques: 0, ctr: 0,
  volume_mensal: 720, concorrencia: 'MEDIUM', score: 71, status: 'nova', janela_inicio: '2026-09-05',
  janela_fim: '2026-10-02', idea_id: null, created_at: '2026-10-05 10:00:00', updated_at: '2026-10-05 10:00:00',
}

describe('client_google', () => {
  it('sem linha devolve vínculo vazio', async () => {
    const db = new FakeD1()
    expect(await getClientGoogle(db, 'cli')).toEqual({ client_id: 'cli', gsc_site_url: null, gsc_conta: null, updated_at: null })
  })

  it('salva com upsert por client_id', async () => {
    const db = new FakeD1([{ match: /SELECT .* FROM client_google/, rows: [{ client_id: 'cli', gsc_site_url: 'https://abxtelecom.com.br/', gsc_conta: 'contato', updated_at: 'agora' }] }])
    const v = await saveClientGoogle(db, 'cli', { gsc_site_url: 'https://abxtelecom.com.br/', gsc_conta: 'contato' })
    const insert = db.executed.find((e) => e.sql.includes('INSERT INTO client_google'))!
    expect(insert.sql).toContain('ON CONFLICT(client_id) DO UPDATE')
    expect(insert.binds).toEqual(['cli', 'https://abxtelecom.com.br/', 'contato'])
    expect(v.gsc_conta).toBe('contato')
  })
})

describe('saveOportunidades', () => {
  it('upsert não mexe no status e apaga só as "nova" de janelas antigas', async () => {
    const db = new FakeD1()
    const n = await saveOportunidades(db, 'cli', { inicio: '2026-09-05', fim: '2026-10-02' }, [calc])
    expect(n).toBe(1)
    const lote = db.batches[0]
    const upsert = lote.find((e) => e.sql.includes('INSERT INTO opportunities'))!
    expect(upsert.sql).toContain('ON CONFLICT(client_id, tipo, query_norm) DO UPDATE')
    const doUpdate = upsert.sql.split('DO UPDATE')[1]
    expect(doUpdate).not.toMatch(/\bstatus\b/)
    const limpeza = lote.find((e) => e.sql.startsWith('DELETE FROM opportunities'))!
    expect(limpeza.sql).toContain("status = 'nova'")
    expect(limpeza.binds).toEqual(['cli', '2026-10-02'])
  })
})

describe('listOportunidades e status', () => {
  it('converte as linhas e filtra por status', async () => {
    const db = new FakeD1([{ match: /FROM opportunities/, rows: [linha] }])
    const lista = await listOportunidades(db, 'cli', 'nova')
    expect(lista[0]).toMatchObject({ id: 'op1', volume_mensal: 720, status: 'nova', idea_id: null })
    expect(db.executed[0].binds).toEqual(['cli', 'nova'])
  })

  it('marca em_pauta guardando a pauta', async () => {
    const db = new FakeD1()
    expect(await setOportunidadeStatus(db, 'cli', 'op1', 'em_pauta', 'idea9')).toBe(true)
    expect(db.executed[0].binds).toEqual(['em_pauta', 'idea9', 'cli', 'op1'])
  })
})

describe('pauta a partir da oportunidade', () => {
  it('explica a demanda e manda linkar a página que já ranqueia', () => {
    const p = oportunidadeParaPauta(linha as Oportunidade)
    expect(p.kw_principal).toBe('consultoria de ti')
    expect(p.tema).toBe('Consultoria de ti')
    expect(p.artigos_relacionados).toEqual(['https://abxtelecom.com.br/ti/'])
    expect(p.justificativa).toContain('posição 10,8')
    expect(p.justificativa).toContain('720 buscas/mês')
    expect(p.risco_canibalizacao).toContain('https://abxtelecom.com.br/ti/')
  })

  it('cria a linha em article_ideas e devolve o id', async () => {
    const db = new FakeD1()
    const id = await createIdeaFromOportunidade(db, 'cli', linha as Oportunidade)
    const insert = db.executed.find((e) => e.sql.includes('INSERT INTO article_ideas'))!
    expect(insert.binds[0]).toBe(id)
    expect(insert.binds[1]).toBe('cli')
    expect(JSON.parse(String(insert.binds[5])).kw_principal).toBe('consultoria de ti')
  })
})
