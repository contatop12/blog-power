-- Migration 005: tipo de conteúdo WordPress por artigo (post | page)
ALTER TABLE articles ADD COLUMN wp_post_type TEXT NOT NULL DEFAULT 'post'
  CHECK(wp_post_type IN ('post', 'page'));
