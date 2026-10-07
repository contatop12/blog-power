import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache'

// Todas as telas são client components sem revalidação: as páginas pré-geradas no build
// saem direto dos assets (o deploy copia o cache para lá), sem re-renderizar a cada request.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
})
