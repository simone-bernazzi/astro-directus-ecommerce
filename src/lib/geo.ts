export type GeoProvider = 'ip-api' | 'maxmind' | 'cloudflare'

const GEO_PROVIDER = (process.env.GEO_PROVIDER ?? 'ip-api') as GeoProvider

async function getCountryFromIpApi(ip: string): Promise<string | null> {
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, {
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return null
    const data = await res.json() as { countryCode?: string }
    return data.countryCode ?? null
  } catch {
    return null
  }
}

async function getCountryFromMaxMind(ip: string): Promise<string | null> {
  // Richiede: npm install @maxmind/geoip2-node + database GeoLite2-Country.mmdb
  // Documentato in docs/geo-filter-maxmind.md
  console.warn('MaxMind GeoIP2 non configurato — tornando a ip-api.com')
  return getCountryFromIpApi(ip)
}

export async function detectCountry(
  request: Request,
  clientIp: string
): Promise<string | null> {
  if (GEO_PROVIDER === 'cloudflare') {
    return request.headers.get('cf-ipcountry')
  }
  if (GEO_PROVIDER === 'maxmind') {
    return getCountryFromMaxMind(clientIp)
  }
  return getCountryFromIpApi(clientIp)
}

export function extractClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}
