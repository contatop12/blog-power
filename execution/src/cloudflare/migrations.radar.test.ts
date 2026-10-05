import { describe, expect, it } from 'vitest'
import { D1_BOOTSTRAP_STATEMENTS, RADAR_FATIA1_STATEMENTS, REQUIRED_TABLES } from './migrations.js'

describe('migrations — Radar fatia 1', () => {
  it('bootstrap e tabelas obrigatórias incluem as tabelas novas', () => {
    for (const tabela of ['client_google', 'opportunities', 'llm_usage']) {
      expect(REQUIRED_TABLES).toContain(tabela)
      expect(D1_BOOTSTRAP_STATEMENTS.some((s) => s.includes(`CREATE TABLE IF NOT EXISTS ${tabela}`))).toBe(true)
    }
  })

  it('statements são idempotentes', () => {
    for (const sql of RADAR_FATIA1_STATEMENTS) expect(sql).toMatch(/IF NOT EXISTS/)
  })
})
