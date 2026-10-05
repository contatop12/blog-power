/** D1 falso para testes: devolve linhas por trecho de SQL e registra o que foi executado. */
import type { D1Database, D1PreparedStatement } from '../types/d1.js'

export interface Executed {
  sql: string
  binds: unknown[]
}

export class FakeD1 implements D1Database {
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
        return { meta: { changes: 1 } }
      },
    }
    Object.defineProperty(stmt, '__record', { value: record, enumerable: false })
    return stmt
  }

  async batch(statements: D1PreparedStatement[]): Promise<unknown> {
    this.batches.push(statements.map((s) => (s as unknown as { __record: Executed }).__record))
    return []
  }
}
