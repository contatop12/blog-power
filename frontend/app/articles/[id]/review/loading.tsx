import { ReviewPageSkeleton } from '@/components/ui/skeleton'

/** Aparece no clique, enquanto a rota dinâmica carrega — e libera o prefetch dela pelo Link. */
export default function Loading() {
  return <ReviewPageSkeleton />
}
