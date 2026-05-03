// src/lib/directus.test.ts
import { describe, it, expect, vi } from 'vitest'

// Mock del modulo @directus/sdk
vi.mock('@directus/sdk', () => ({
  createDirectus: vi.fn(() => ({
    with: vi.fn().mockReturnThis(),
  })),
  rest: vi.fn(),
  staticToken: vi.fn(() => ({})),
  readItems: vi.fn((collection) => ({ collection, action: 'readItems' })),
  readItem: vi.fn((collection, id) => ({ collection, id, action: 'readItem' })),
  readSingleton: vi.fn((collection) => ({ collection, action: 'readSingleton' })),
}))

describe('getDirectusImageUrl', () => {
  it('restituisce URL completo dato un file ID', async () => {
    process.env.DIRECTUS_URL = 'https://cms.example.com'
    const { getDirectusImageUrl } = await import('./directus')
    const url = getDirectusImageUrl('abc-123')
    expect(url).toBe('https://cms.example.com/assets/abc-123')
  })

  it('restituisce stringa vuota se fileId è null', async () => {
    const { getDirectusImageUrl } = await import('./directus')
    const url = getDirectusImageUrl(null)
    expect(url).toBe('')
  })

  it('accetta parametri di trasformazione opzionali', async () => {
    process.env.DIRECTUS_URL = 'https://cms.example.com'
    const { getDirectusImageUrl } = await import('./directus')
    const url = getDirectusImageUrl('abc-123', { width: 800, quality: 80 })
    expect(url).toContain('width=800')
    expect(url).toContain('quality=80')
  })
})
