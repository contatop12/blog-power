/** Subconjunto mínimo do D1 usado pelo pacote execution (sem depender de @cloudflare/workers-types). */
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(): Promise<T | null>
  all<T = unknown>(): Promise<{ results?: T[] }>
  run(): Promise<{ meta?: { changes?: number } }>
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement
}
