'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

/**
 * Cache em memória das leituras da API (stale-while-revalidate).
 *
 * Tela já visitada abre na hora com o último dado conhecido e revalida em segundo plano;
 * requests iguais em voo são compartilhados. Vive só nesta aba: some no reload e no logout,
 * nada vai para storage.
 */

/** Uma leitura da API: a chave identifica o dado no cache, `fn` vai buscá-lo. */
export interface Query<T> {
  key: string
  fn: () => Promise<T>
}

interface Entry<T = unknown> {
  data?: T
  error?: Error
  /** Quando `data` chegou da API (0 = nunca). */
  updatedAt: number
  promise?: Promise<T>
}

/** Leitura que acabou de chegar (ex.: prefetch no hover) não é refeita ao montar a tela. */
const FRESH_MS = 5_000

const EMPTY: Entry = { updatedAt: 0 }
const store = new Map<string, Entry>()
const listeners = new Map<string, Set<() => void>>()

function emit(key: string) {
  listeners.get(key)?.forEach((l) => l())
}

function write(key: string, patch: Partial<Entry>) {
  store.set(key, { ...(store.get(key) ?? EMPTY), ...patch })
  emit(key)
}

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error('Erro na API')
}

export function getQueryData<T>(key: string): T | undefined {
  return store.get(key)?.data as T | undefined
}

/**
 * Busca e guarda no cache. Sem `force`, reaproveita o request em voo da mesma chave;
 * com `force` (recarga depois de uma mutação), começa outro e descarta o anterior.
 */
export function fetchQuery<T>({ key, fn }: Query<T>, force = false): Promise<T> {
  const current = store.get(key)
  if (current?.promise && !force) return current.promise as Promise<T>

  const promise: Promise<T> = fn().then(
    (data) => {
      // Cache limpo (logout) ou request substituído: o resultado não vale mais
      if (store.get(key)?.promise === promise) {
        write(key, { data, error: undefined, updatedAt: Date.now(), promise: undefined })
      }
      return data
    },
    (e: unknown) => {
      if (store.get(key)?.promise === promise) write(key, { error: toError(e), promise: undefined })
      throw e
    },
  )
  write(key, { promise, error: undefined })
  return promise
}

/** Esquenta o cache antes da navegação (hover, foco, toque). Ignora falhas. */
export function prefetchQuery<T>(query: Query<T>, maxAgeMs = 15_000): void {
  const current = store.get(query.key)
  if (current?.promise) return
  if (current && Date.now() - current.updatedAt < maxAgeMs) return
  fetchQuery(query).catch(() => undefined)
}

/** Atualiza o cache com o que uma mutação já devolveu, sem ir à API. */
export function setQueryData<T>(key: string, updater: T | ((current: T | undefined) => T | undefined)): void {
  const current = store.get(key)?.data as T | undefined
  const next =
    typeof updater === 'function' ? (updater as (c: T | undefined) => T | undefined)(current) : updater
  if (next === undefined) return
  write(key, { data: next, error: undefined, updatedAt: Date.now() })
}

/** Descarta as leituras cujas chaves começam com o prefixo (a próxima tela busca de novo). */
export function invalidateQueries(prefix: string): void {
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) {
      store.delete(key)
      emit(key)
    }
  }
}

export function clearQueryCache(): void {
  const keys = Array.from(store.keys())
  store.clear()
  keys.forEach(emit)
}

export interface QueryResult<T> {
  data: T | undefined
  /** Erro da última leitura; com `data` presente a tela segue mostrando o dado anterior. */
  error: Error | undefined
  /** Ainda sem nada para mostrar. */
  isLoading: boolean
  /** Revalidando em segundo plano. */
  isFetching: boolean
  /** Busca de novo ignorando o cache (depois de uma mutação ou no "Tentar de novo"). */
  reload: () => Promise<T>
  /** Grava no cache o resultado de uma mutação. */
  mutate: (updater: T | ((current: T | undefined) => T | undefined)) => void
}

/**
 * Lê a query do cache e revalida ao montar. `null` desliga a leitura.
 * `placeholder` mostra um dado de outra chave enquanto esta não chega
 * (ex.: o cliente que já veio na lista de clientes).
 */
export function useQuery<T>(
  query: Query<T> | null,
  options: { placeholder?: () => T | undefined } = {},
): QueryResult<T> {
  const key = query?.key ?? null
  const fetcherRef = useRef(query?.fn)
  useEffect(() => {
    fetcherRef.current = query?.fn
  })

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!key) return () => undefined
      let set = listeners.get(key)
      if (!set) listeners.set(key, (set = new Set()))
      set.add(onChange)
      return () => {
        set.delete(onChange)
        if (set.size > 0) return
        listeners.delete(key)
        // Erro sem dado não sobrevive à tela: quem voltar vê o skeleton e uma nova tentativa
        const current = store.get(key)
        if (current?.error && current.data === undefined && !current.promise) store.delete(key)
      }
    },
    [key],
  )
  const entry = useSyncExternalStore(
    subscribe,
    () => (key ? (store.get(key) ?? EMPTY) : EMPTY),
    () => EMPTY,
  ) as Entry<T>

  useEffect(() => {
    if (!key) return
    const current = store.get(key)
    if (current?.promise) return
    if (current?.data !== undefined && Date.now() - current.updatedAt < FRESH_MS) return
    const fn = fetcherRef.current
    if (fn) fetchQuery({ key, fn }).catch(() => undefined)
  }, [key])

  const reload = useCallback(() => {
    const fn = fetcherRef.current
    if (!key || !fn) return Promise.reject(new Error('Leitura desligada'))
    return fetchQuery({ key, fn }, true)
  }, [key])

  const mutate = useCallback(
    (updater: T | ((current: T | undefined) => T | undefined)) => {
      if (key) setQueryData(key, updater)
    },
    [key],
  )

  const data = entry.data !== undefined ? entry.data : key ? options.placeholder?.() : undefined
  return {
    data,
    error: entry.error,
    isLoading: data === undefined && !entry.error,
    isFetching: Boolean(entry.promise),
    reload,
    mutate,
  }
}
