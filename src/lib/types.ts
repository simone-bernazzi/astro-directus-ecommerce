// src/lib/types.ts

export interface DirectusFile {
  id: string
  filename_download: string
  title: string | null
  description: string | null
  width: number | null
  height: number | null
}

export interface Category {
  id: string
  name: string
  slug: string
}

export interface Post {
  id: string
  title: string
  slug: string
  content: string | null
  cover: DirectusFile | null
  category: Category | null
  published_at: string
  status: 'published' | 'draft'
  excerpt: string | null
  seo_title: string | null
  seo_description: string | null
}

export interface PortfolioItem {
  id: string
  title: string
  slug: string
  cover: DirectusFile | null
  gallery: DirectusFile[] | null
  client: string | null
  year: number | null
  tags: string[] | null
  description: string | null
  status: 'published' | 'draft'
}

export interface FaqItem {
  id: string
  question: string
  answer: string
  category: string | null
  sort_order: number
}

export interface PageBlock {
  type: 'hero' | 'features' | 'cta' | 'testimonials' | 'blog_grid' | 'portfolio_grid' | 'faq'
  data: Record<string, unknown>
}

export interface Page {
  id: string
  title: string
  slug: string
  blocks: PageBlock[] | null
  seo_title: string | null
  seo_description: string | null
  status: 'published' | 'draft'
}

export interface SiteSettings {
  site_name: string
  logo: DirectusFile | null
  nav_links: Array<{ label: string; url: string }> | null
  social: Array<{ platform: string; url: string }> | null
  footer_text: string | null
}
