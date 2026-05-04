// src/i18n/index.ts
import { ui } from './ui'
import type { Lang, UiKey } from './ui'

export type { Lang }

export function getLang(url: URL): Lang {
  return url.pathname.startsWith('/en/') || url.pathname === '/en' ? 'en' : 'it'
}

export function useTranslations(lang: Lang) {
  return function t(key: UiKey): string {
    return (ui[lang] as Record<string, string>)[key] ?? (ui.it as Record<string, string>)[key] ?? key
  }
}

export function shopBase(lang: Lang): string {
  return lang === 'en' ? '/en/shop' : '/negozio'
}

export function blogBase(lang: Lang): string {
  return lang === 'en' ? '/en/blog' : '/blog'
}

export function portfolioBase(lang: Lang): string {
  return lang === 'en' ? '/en/portfolio' : '/portfolio'
}

export function langSwitchUrl(currentLang: Lang, currentPath: string): string {
  if (currentLang === 'it') {
    return '/en' + currentPath
      .replace(/^\/negozio/, '/shop')
      .replace(/^\/blog/, '/blog')
      .replace(/^\/portfolio/, '/portfolio')
  }
  return currentPath
    .replace(/^\/en\/shop/, '/negozio')
    .replace(/^\/en\/blog/, '/blog')
    .replace(/^\/en\/portfolio/, '/portfolio')
    .replace(/^\/en$/, '/')
    .replace(/^\/en\//, '/')
}
