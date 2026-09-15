import { describe, expect, it } from 'vitest'
import type { D1Database, D1PreparedStatement } from '../types/d1.js'
import type { CorpusPost } from '../wordpress/corpus.js'
import {
  MAX_CONTEUDO_CHARS,
  listCorpusForPrompt,
  rowToClientPost,
  truncateConteudo,
  upsertCorpusPosts,
  type ClientPostRow,
} from './store.js'

interface Executed {
  sql: string
  binds: unknown[]
}

/** D1 falso: devolve linhas por trecho de SQL e registra o que foi executado. */
class FakeD1 implements D1Database {
  executed: Executed[] = []
  batches: Executed[][] = []

  constructor(private readonly responses: Array<{ match: RegExp; rows: unknown[] }> = []) {}

  private rowsFor(sql: string): unknown[] {
    return this.responses.find((r) => r.match.test(sql))?.rows ?? []
  }

  prepare(sql: string): D1PreparedStatement {
    const self = this
    const record: Executed = { sql, binds: [] }
    const stmt: D1PreparedStatement = {
      bind(...values: unknown[]) {
        record.binds = values
        return stmt
      },
      async first<T>() {
        self.executed.push(record)
        return (self.rowsFor(sql)[0] ?? null) as T | null
      },
      async all<T>() {
        self.executed.push(record)
        return { results: self.rowsFor(sql) as T[] }
      },
      async run() {
        self.executed.push(record)
        return {}
      },
    }
    // guarda referência para o batch conseguir registrar sem executar
    Object.defineProperty(stmt, '__record', { value: record, enumerable: false })
    return stmt
  }

  async batch(statements: D1PreparedStatement[]): Promise<unknown> {
    this.batches.push(
      statements.map((s) => (s as unknown as { __record: Executed }).__record),
    )
    return []
  }
}

function corpusPost(overrides: Partial<CorpusPost> = {}): CorpusPost {
  return {
    wp_post_id: 1,
    wp_post_type: 'post',
    titulo: 'Link dedicado',
    slug: 'link-dedicado',
    url: 'https://exemplo.com/link-dedicado/',
    excerpt: 'Resumo',
    conteudo_txt: 'Conteúdo do artigo',
    categorias: [{ id: 3, name: 'Conectividade' }],
    tags: [],
    palavras: 3,
    publicado_em: '2026-01-05T10:00:00Z',
    wp_modified: '2026-02-01T09:30:00Z',
    ...overrides,
  }
}

describe('truncateConteudo', () => {
  it('mantém textos dentro do limite', () => {
    expect(truncateConteudo('curto')).toBe('curto')
  })

  it('corta e sinaliza textos acima do limite', () => {
    const grande = 'x'.repeat(MAX_CONTEUDO_CHARS + 10)
    const cortado = truncateConteudo(grande)
    expect(cortado.length).toBeLessThan(grande.length + 30)
    expect(cortado.endsWith('[conteúdo truncado]')).toBe(true)
  })
})

describe('rowToClientPost', () => {
  it('converte JSON de taxonomias e normaliza o tipo', () => {
    const row: ClientPostRow = {
      id: 'p1',
      client_id: 'c1',
      wp_post_id: 9,
      wp_post_type: 'algo-invalido',
      titulo: 'Título',
      slug: 'titulo',
      url: 'https://exemplo.com/titulo/',
      excerpt: null,
      conteudo_txt: null,
      categorias: '[{"id":3,"name":"Conectividade"}]',
      tags: 'json quebrado',
      palavras: 10,
      publicado_em: null,
      wp_modified: null,
      synced_at: '2026-03-01T00:00:00Z',
    }

    const post = rowToClientPost(row)
    expect(post.wp_post_type).toBe('post')
    expect(post.categorias).toEqual([{ id: 3, name: 'Conectividade' }])
    expect(post.tags).toEqual([])
  })
})

describe('upsertCorpusPosts', () => {
  it('separa inseridos de atualizados usando o que já existe no D1', async () => {
    const db = new FakeD1([
      {
        match: /SELECT wp_post_id, wp_post_type FROM client_posts/,
        rows: [{ wp_post_id: 1, wp_post_type: 'post' }],
      },
    ])

    const result = await upsertCorpusPosts(db, 'c1', [
      corpusPost({ wp_post_id: 1 }),
      corpusPost({ wp_post_id: 2 }),
    ])

    expect(result).toEqual({ inseridos: 1, atualizados: 1 })
    expect(db.batches).toHaveLength(1)
    expect(db.batches[0]).toHaveLength(2)
  })

  it('não toca no banco quando não há posts', async () => {
    const db = new FakeD1()
    const result = await upsertCorpusPosts(db, 'c1', [])
    expect(result).toEqual({ inseridos: 0, atualizados: 0 })
    expect(db.executed).toHaveLength(0)
  })

  it('grava categorias como JSON e trunca conteúdo gigante', async () => {
    const db = new FakeD1()
    await upsertCorpusPosts(db, 'c1', [
      corpusPost({ conteudo_txt: 'y'.repeat(MAX_CONTEUDO_CHARS + 100) }),
    ])

    const binds = db.batches[0][0].binds
    expect(binds).toContain('[{"id":3,"name":"Conectividade"}]')
    const conteudo = binds.find(
      (b) => typeof b === 'string' && b.startsWith('yyy'),
    ) as string
    expect(conteudo.endsWith('[conteúdo truncado]')).toBe(true)
  })
})

describe('listCorpusForPrompt', () => {
  it('compacta cada post em título, url, categorias e excerpt curto', async () => {
    const db = new FakeD1([
      {
        match: /FROM client_posts/,
        rows: [
          {
            titulo: 'SD-WAN na prática',
            url: 'https://exemplo.com/sd-wan/',
            categorias: '[{"id":3,"name":"Conectividade"}]',
            publicado_em: '2026-01-01T00:00:00Z',
            palavras: 1200,
            excerpt: null,
            conteudo_txt: 'z'.repeat(500),
          },
        ],
      },
    ])

    const items = await listCorpusForPrompt(db, 'c1')

    expect(items).toHaveLength(1)
    expect(items[0].categorias).toEqual(['Conectividade'])
    expect(items[0].excerpt).toHaveLength(200)
  })
})
