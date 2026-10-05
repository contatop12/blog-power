import { describe, expect, it, vi } from 'vitest'
import type { GscRow } from '../google/searchConsole.js'
import type { KeywordVolume } from '../google/keywordPlanner.js'
import { calcularQuickWins } from './sync.js'

const ROWS: GscRow[] = [
  { keys: ['consultoria de ti', 'https://abx/ti'], clicks: 0, impressions: 64, ctr: 0, position: 10.8 },
  { keys: ['abx telecom', 'https://abx/'], clicks: 50, impressions: 900, ctr: 0.05, position: 4.2 },
  { keys: ['fibra óptica', 'https://abx/fibra'], clicks: 9, impressions: 300, ctr: 0.03, position: 2.1 },
]

describe('calcularQuickWins', () => {
  it('consulta a janela de 28 dias, tira marca e top 3 e junta volume', async () => {
    const queryGsc = vi.fn(async () => ROWS)
    const getVolumes = vi.fn(async (kws: string[]) => {
      expect(kws).toEqual(['consultoria de ti'])
      return new Map<string, KeywordVolume>([['consultoria de ti', { keyword: 'consultoria de ti', volumeMensal: 720, concorrencia: 'MEDIUM' }]])
    })

    const out = await calcularQuickWins('https://abxtelecom.com.br/', { queryGsc, getVolumes, today: new Date('2026-10-05T12:00:00Z') }, { marca: ['abxtelecom'] })

    expect(queryGsc).toHaveBeenCalledWith('https://abxtelecom.com.br/', {
      startDate: '2026-09-05', endDate: '2026-10-02', dimensions: ['query', 'page'], maxRows: 50_000,
    })
    expect(out.janela).toEqual({ inicio: '2026-09-05', fim: '2026-10-02' })
    expect(out.queriesAnalisadas).toBe(3)
    expect(out.oportunidades.map((o) => o.query)).toEqual(['consultoria de ti'])
    expect(out.oportunidades[0].volume_mensal).toBe(720)
    expect(out.kpErro).toBeNull()
  })

  it('Keyword Planner falhando não derruba a sincronização', async () => {
    const out = await calcularQuickWins('https://abxtelecom.com.br/', {
      queryGsc: async () => ROWS,
      getVolumes: async () => { throw new Error('Keyword Planner: projeto só aprovado para contas de teste') },
      today: new Date('2026-10-05T12:00:00Z'),
    }, { marca: ['abxtelecom'] })

    expect(out.oportunidades).toHaveLength(1)
    expect(out.oportunidades[0].volume_mensal).toBeNull()
    expect(out.kpErro).toBe('Keyword Planner: projeto só aprovado para contas de teste')
  })

  it('sem Keyword Planner configurado segue sem volume', async () => {
    const out = await calcularQuickWins('https://x/', { queryGsc: async () => ROWS, getVolumes: null, today: new Date('2026-10-05T12:00:00Z') })
    expect(out.kpErro).toBe('Keyword Planner não configurado')
    expect(out.oportunidades.every((o) => o.volume_mensal === null)).toBe(true)
  })

  it('erro do Search Console sobe para quem chamou', async () => {
    await expect(calcularQuickWins('https://x/', {
      queryGsc: async () => { throw new Error('Search Console: cota 0') },
      getVolumes: null,
    })).rejects.toThrow('Search Console: cota 0')
  })
})
