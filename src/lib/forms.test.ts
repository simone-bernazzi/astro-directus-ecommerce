import { describe, it, expect } from 'vitest'
import type { Form, FormField } from './types'

describe('Form types', () => {
  it('FormField ha i campi obbligatori', () => {
    const field: FormField = {
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
    }
    expect(field.type).toBe('email')
    expect(field.required).toBe(true)
  })

  it('FormField select ha options', () => {
    const field: FormField = {
      name: 'servizio',
      label: 'Servizio',
      type: 'select',
      required: false,
      options: ['Info', 'Preventivo'],
    }
    expect(field.options).toHaveLength(2)
  })

  it('Form ha tutte le feature flags', () => {
    const form: Form = {
      id: '1',
      name: 'Contattaci',
      slug: 'contattaci',
      fields: [],
      success_message: 'Grazie!',
      redirect_enabled: false,
      redirect_url: null,
      notification_email: 'admin@test.it',
      recaptcha_enabled: false,
      capture_ip: false,
      capture_user_agent: false,
      capture_page_url: true,
      honeypot_enabled: true,
      country_filter_enabled: false,
      allowed_countries: null,
      keyword_filter_enabled: false,
      blocked_keywords: null,
      is_active: true,
    }
    expect(form.honeypot_enabled).toBe(true)
    expect(form.capture_ip).toBe(false)
  })
})

describe('keyword filter logic', () => {
  function containsBlockedKeyword(data: Record<string, unknown>, keywords: string[]): boolean {
    const values = Object.values(data).join(' ').toLowerCase()
    return keywords.some(kw => values.includes(kw.toLowerCase()))
  }

  it('rileva parola bloccata', () => {
    expect(containsBlockedKeyword({ msg: 'buy casino chips' }, ['casino'])).toBe(true)
  })

  it('non blocca testo normale', () => {
    expect(containsBlockedKeyword({ msg: 'vorrei un preventivo' }, ['casino', 'viagra'])).toBe(false)
  })

  it('case insensitive', () => {
    expect(containsBlockedKeyword({ msg: 'CASINO FREE' }, ['casino'])).toBe(true)
  })
})
