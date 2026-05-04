// src/stores/currency.ts
import { atom } from 'nanostores'
import { persistentAtom } from '@nanostores/persistent'

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const
export type SupportedCurrency = typeof CURRENCIES[number]

const RATES_TTL = 3_600_000

export const selectedCurrency = persistentAtom<string>('shop_currency', 'EUR')

interface RatesCache {
  rates: Record<string, number>
  ts: number
}

const _ratesCache = persistentAtom<RatesCache | null>('shop_rates', null, {
  encode: JSON.stringify,
  decode: (v) => { try { return JSON.parse(v) } catch { return null } },
})

// Fetched rates for current session (atom, not persisted separately)
export const exchangeRates = atom<Record<string, number>>({})

async function loadRates(): Promise<Record<string, number>> {
  const cached = _ratesCache.get()
  if (cached && Date.now() - cached.ts < RATES_TTL) {
    exchangeRates.set(cached.rates)
    return cached.rates
  }
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR')
    if (!res.ok) return {}
    const data = (await res.json()) as { rates: Record<string, number> }
    _ratesCache.set({ rates: data.rates, ts: Date.now() })
    exchangeRates.set(data.rates)
    return data.rates
  } catch {
    return {}
  }
}

export function formatPrice(eurAmount: number, currency: string, rates: Record<string, number>): string {
  if (currency === 'EUR' || !rates[currency]) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(eurAmount)
  }
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(eurAmount * rates[currency])
}

export async function applyConversion(currency?: string): Promise<void> {
  const cur = currency ?? selectedCurrency.get()
  const rates = cur === 'EUR' ? {} : await loadRates()
  document.querySelectorAll<HTMLElement>('[data-eur-price]').forEach(el => {
    const eur = parseFloat(el.dataset.eurPrice ?? '')
    if (!isNaN(eur)) el.textContent = formatPrice(eur, cur, rates)
  })
}
