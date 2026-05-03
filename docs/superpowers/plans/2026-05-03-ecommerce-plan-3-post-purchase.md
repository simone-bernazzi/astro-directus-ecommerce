# E-commerce Template — Piano 3: Post-Purchase

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementare il webhook Stripe per salvare ordini in Directus, gestire download protetti per prodotti digitali e creare le pagine account SSR (profilo, lista ordini, dettaglio ordine).

**Architecture:** Webhook `checkout.session.completed` → Netlify Function → salva ordine + order_items in Directus, decrementa stock, genera download token UUID. Download serviti via Netlify Function `/api/download/:token` con verifica token, scadenza e limite. Account in SSR con guard auth Directus JWT.

**Tech Stack:** Stripe SDK v15, @directus/sdk v21, crypto (Node built-in), Astro SSR (prerender=false).

**Prerequisito:** Piano 2 completato.

---

## Struttura File (questo piano)

```
netlify/functions/
├── webhook-stripe.ts              # POST /api/webhook/stripe
└── download.ts                    # GET /api/download/:token
src/pages/account/
├── index.astro                    # Profilo SSR
├── ordini/
│   ├── index.astro                # Lista ordini SSR
│   └── [id].astro                 # Dettaglio ordine SSR
└── wishlist.astro                 # Wishlist SSR
src/layouts/
└── Account.astro                  # Layout SSR con auth guard
src/lib/
└── auth.ts                        # Helpers Directus auth
```

---

## Task 1: Stripe Webhook

**Files:**
- Create: `netlify/functions/webhook-stripe.ts`

- [ ] **Step 1.1: Crea `netlify/functions/webhook-stripe.ts`**

```typescript
import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { createDirectus, rest, staticToken, createItem, readItems, updateItem } from '@directus/sdk';
import { randomUUID } from 'crypto';
import type { ProductVariant, Order, OrderItem } from '../../src/lib/types';

function getRequiredEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

function createDirectusClient() {
  return createDirectus(getRequiredEnv('DIRECTUS_URL'))
    .with(staticToken(getRequiredEnv('DIRECTUS_TOKEN')))
    .with(rest());
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const stripe = new Stripe(getRequiredEnv('STRIPE_SECRET_KEY'));
  const sig = event.headers['stripe-signature'];

  if (!sig) return { statusCode: 400, body: 'Missing stripe-signature header' };

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body ?? '',
      sig,
      getRequiredEnv('STRIPE_WEBHOOK_SECRET')
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook signature verification failed: ${err}` };
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: 'Event ignored' };
  }

  const session = stripeEvent.data.object as Stripe.Checkout.Session;
  const directus = createDirectusClient();

  // Idempotenza: controlla se ordine già salvato
  const existing = await directus.request(
    readItems('orders', {
      filter: { stripe_session_id: { _eq: session.id } },
      fields: ['id'],
      limit: 1,
    })
  ) as { id: string }[];

  if (existing.length > 0) {
    return { statusCode: 200, body: 'Order already processed' };
  }

  // Recupera line items da Stripe
  const lineItemsResult = await stripe.checkout.sessions.listLineItems(session.id, {
    expand: ['data.price.product'],
  });

  const meta = session.metadata ?? {};
  const shippingCost = session.shipping_cost?.amount_total
    ? session.shipping_cost.amount_total / 100
    : 0;

  // Recupera varianti da Directus tramite stripe_price_id
  const stripePriceIds = lineItemsResult.data
    .map(li => (li.price as Stripe.Price)?.id)
    .filter(Boolean);

  const variants = await directus.request(
    readItems('product_variants', {
      filter: { stripe_price_id: { _in: stripePriceIds } },
      fields: ['id', 'sku', 'name', 'price_override', 'stripe_price_id', 'digital_file',
               'download_limit', 'download_expires_hours', 'product_id.*'],
    })
  ) as (ProductVariant & { product_id: { id: string; name: string; base_price: number; weight_g: number } })[];

  const subtotal = (session.amount_subtotal ?? 0) / 100;
  const total = (session.amount_total ?? 0) / 100;
  const discountAmount = subtotal - (total - shippingCost - Number(meta.gift_card_amount ?? 0));

  // Snapshot items per email/riepilogo
  const itemsSnapshot = lineItemsResult.data.map(li => {
    const variant = variants.find(v => v.stripe_price_id === (li.price as Stripe.Price)?.id);
    return {
      product_name: variant?.product_id?.name ?? li.description ?? '',
      variant_name: variant?.name ?? '',
      sku: variant?.sku ?? '',
      unit_price: (li.price as Stripe.Price)?.unit_amount ? (li.price as Stripe.Price).unit_amount! / 100 : 0,
      quantity: li.quantity ?? 1,
    };
  });

  const shippingAddress = session.shipping_details?.address ? {
    name: session.shipping_details.name ?? '',
    line1: session.shipping_details.address.line1 ?? '',
    line2: session.shipping_details.address.line2 ?? null,
    city: session.shipping_details.address.city ?? '',
    postal_code: session.shipping_details.address.postal_code ?? '',
    state: session.shipping_details.address.state ?? '',
    country: session.shipping_details.address.country ?? '',
  } : null;

  // Salva ordine in Directus
  const order = await directus.request(
    createItem('orders', {
      stripe_session_id: session.id,
      status: 'paid',
      customer_email: session.customer_details?.email ?? '',
      customer_name: session.customer_details?.name ?? '',
      subtotal,
      discount_amount: discountAmount > 0 ? discountAmount : 0,
      shipping_cost: shippingCost,
      total,
      coupon_id: meta.coupon_id || null,
      gift_card_id: meta.gift_card_id || null,
      gift_card_amount_used: Number(meta.gift_card_amount ?? 0),
      shipping_address: shippingAddress,
      shipping_zone_id: meta.shipping_zone_id || null,
      items: itemsSnapshot,
    })
  ) as Order;

  // Salva order_items, decrementa stock, genera download token
  for (const li of lineItemsResult.data) {
    const variant = variants.find(v => v.stripe_price_id === (li.price as Stripe.Price)?.id);
    if (!variant) continue;

    const quantity = li.quantity ?? 1;
    const unitPrice = (li.price as Stripe.Price)?.unit_amount ? (li.price as Stripe.Price).unit_amount! / 100 : 0;

    const isDigital = !!variant.digital_file;
    const downloadToken = isDigital ? randomUUID() : null;
    const downloadExpiresAt = isDigital
      ? new Date(Date.now() + variant.download_expires_hours * 3_600_000).toISOString()
      : null;

    await directus.request(
      createItem('order_items', {
        order_id: order.id,
        product_name: variant.product_id?.name ?? '',
        variant_name: variant.name,
        sku: variant.sku,
        unit_price: unitPrice,
        quantity,
        download_token: downloadToken,
        download_count: 0,
        download_limit: variant.download_limit,
        download_expires_at: downloadExpiresAt,
      })
    );

    // Decrementa stock (solo prodotti fisici)
    if (!isDigital) {
      await directus.request(
        updateItem('product_variants', variant.id, {
          stock_quantity: Math.max(0, variant.stock_quantity - quantity),
        })
      );
    }
  }

  // Aggiorna saldo gift card
  if (meta.gift_card_id && Number(meta.gift_card_amount) > 0) {
    const cards = await directus.request(
      readItems('gift_cards', {
        filter: { id: { _eq: meta.gift_card_id } },
        fields: ['id', 'remaining_value', 'redemptions'],
        limit: 1,
      })
    ) as { id: string; remaining_value: number; redemptions: unknown[] }[];

    if (cards[0]) {
      const redemptions = Array.isArray(cards[0].redemptions) ? cards[0].redemptions : [];
      await directus.request(
        updateItem('gift_cards', cards[0].id, {
          remaining_value: Math.max(0, cards[0].remaining_value - Number(meta.gift_card_amount)),
          redemptions: [
            ...redemptions,
            { date: new Date().toISOString(), amount: Number(meta.gift_card_amount), order_id: order.id },
          ],
        })
      );
    }
  }

  // Incrementa coupon used_count
  if (meta.coupon_id) {
    const coupons = await directus.request(
      readItems('coupons', {
        filter: { id: { _eq: meta.coupon_id } },
        fields: ['id', 'used_count'],
        limit: 1,
      })
    ) as { id: string; used_count: number }[];

    if (coupons[0]) {
      await directus.request(
        updateItem('coupons', coupons[0].id, { used_count: coupons[0].used_count + 1 })
      );
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true, orderId: order.id }) };
};
```

- [ ] **Step 1.2: Commit**

```bash
git add netlify/functions/webhook-stripe.ts
git commit -m "feat: add Stripe webhook - save orders, decrement stock, generate download tokens"
```

---

## Task 2: Download Protetto (Digitali)

**Files:**
- Create: `netlify/functions/download.ts`

- [ ] **Step 2.1: Crea `netlify/functions/download.ts`**

```typescript
import type { Handler } from '@netlify/functions';
import { createDirectus, rest, staticToken, readItems, updateItem } from '@directus/sdk';

function getRequiredEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const token = event.path.split('/').pop();
  if (!token) return { statusCode: 400, body: 'Token mancante' };

  const directus = createDirectus(getRequiredEnv('DIRECTUS_URL'))
    .with(staticToken(getRequiredEnv('DIRECTUS_TOKEN')))
    .with(rest());

  const items = await directus.request(
    readItems('order_items', {
      filter: { download_token: { _eq: token } },
      fields: ['id', 'download_token', 'download_count', 'download_limit',
               'download_expires_at', 'variant_id.*'],
      limit: 1,
    })
  ) as {
    id: string;
    download_count: number;
    download_limit: number;
    download_expires_at: string | null;
    variant_id: { digital_file: string | null };
  }[];

  const item = items[0];

  if (!item) return { statusCode: 404, body: 'Token non trovato' };

  if (item.download_expires_at && new Date(item.download_expires_at) < new Date()) {
    return { statusCode: 410, body: 'Link scaduto' };
  }

  if (item.download_count >= item.download_limit) {
    return { statusCode: 410, body: 'Limite download raggiunto' };
  }

  if (!item.variant_id?.digital_file) {
    return { statusCode: 404, body: 'File non trovato' };
  }

  // Incrementa download count
  await directus.request(
    updateItem('order_items', item.id, { download_count: item.download_count + 1 })
  );

  // Redirect al file Directus (autenticato tramite token server)
  const fileUrl = `${getRequiredEnv('DIRECTUS_URL')}/assets/${item.variant_id.digital_file}?access_token=${getRequiredEnv('DIRECTUS_TOKEN')}`;

  return {
    statusCode: 302,
    headers: { Location: fileUrl },
    body: '',
  };
};
```

- [ ] **Step 2.2: Aggiungi route in `netlify.toml`**

```toml
[[redirects]]
  from = "/api/download/:token"
  to = "/.netlify/functions/download/:token"
  status = 200
```

- [ ] **Step 2.3: Commit**

```bash
git add netlify/functions/download.ts netlify.toml
git commit -m "feat: add protected digital download endpoint"
```

---

## Task 3: Auth Helper

**Files:**
- Create: `src/lib/auth.ts`

- [ ] **Step 3.1: Crea `src/lib/auth.ts`**

```typescript
import { createDirectus, rest, authentication, readMe } from '@directus/sdk';
import type { AstroCookies } from 'astro';

const DIRECTUS_URL = import.meta.env.DIRECTUS_URL ?? process.env.DIRECTUS_URL ?? '';
const ACCESS_TOKEN_COOKIE = 'directus_access_token';
const REFRESH_TOKEN_COOKIE = 'directus_refresh_token';

export interface AuthUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export function getTokenFromCookies(cookies: AstroCookies): string | null {
  return cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export async function getCurrentUser(cookies: AstroCookies): Promise<AuthUser | null> {
  const token = getTokenFromCookies(cookies);
  if (!token) return null;

  try {
    const client = createDirectus(DIRECTUS_URL).with(rest());
    const user = await client.request(readMe({ fields: ['id', 'email', 'first_name', 'last_name'] }));
    return user as AuthUser;
  } catch {
    return null;
  }
}

export function setAuthCookies(
  cookies: AstroCookies,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): void {
  cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: expiresIn,
    path: '/',
  });
  cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 giorni
    path: '/',
  });
}

export function clearAuthCookies(cookies: AstroCookies): void {
  cookies.delete(ACCESS_TOKEN_COOKIE, { path: '/' });
  cookies.delete(REFRESH_TOKEN_COOKIE, { path: '/' });
}
```

- [ ] **Step 3.2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: add Directus auth helpers for SSR"
```

---

## Task 4: Layout Account SSR

**Files:**
- Create: `src/layouts/Account.astro`

- [ ] **Step 4.1: Crea `src/layouts/Account.astro`**

```astro
---
import Base from './Base.astro';
import { getCurrentUser } from '../lib/auth';
import type { AuthUser } from '../lib/auth';

interface Props {
  title: string;
}

const { title } = Astro.props;
const user = await getCurrentUser(Astro.cookies);

if (!user) {
  return Astro.redirect('/account/login?redirect=' + encodeURIComponent(Astro.url.pathname));
}
---
<Base title={title}>
  <div class="max-w-[var(--max-width)] mx-auto px-4 py-12">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
      <aside class="md:col-span-1">
        <nav class="space-y-1">
          <a href="/account" class="block px-4 py-2 rounded hover:bg-[var(--color-surface)]">Profilo</a>
          <a href="/account/ordini" class="block px-4 py-2 rounded hover:bg-[var(--color-surface)]">Ordini</a>
          <a href="/account/wishlist" class="block px-4 py-2 rounded hover:bg-[var(--color-surface)]">Wishlist</a>
          <a href="/account/logout" class="block px-4 py-2 rounded text-red-500 hover:bg-red-50">Esci</a>
        </nav>
      </aside>
      <main class="md:col-span-3">
        <slot />
      </main>
    </div>
  </div>
</Base>
```

- [ ] **Step 4.2: Commit**

```bash
git add src/layouts/Account.astro
git commit -m "feat: add Account SSR layout with auth guard"
```

---

## Task 5: Pagine Account SSR

**Files:**
- Create: `src/pages/account/index.astro`
- Create: `src/pages/account/ordini/index.astro`
- Create: `src/pages/account/ordini/[id].astro`
- Create: `src/pages/account/wishlist.astro`
- Create: `src/pages/account/login.astro`
- Create: `src/pages/account/logout.astro`

- [ ] **Step 5.1: Crea `src/pages/account/index.astro`**

```astro
---
export const prerender = false;
import Account from '../../layouts/Account.astro';
import { getCurrentUser } from '../../lib/auth';

const user = await getCurrentUser(Astro.cookies);
---
<Account title="Il mio profilo">
  <h1 class="text-2xl font-bold mb-6">Profilo</h1>
  <div class="bg-[var(--color-surface)] rounded-lg p-6 space-y-4">
    <div>
      <label class="text-sm text-[var(--color-muted)]">Email</label>
      <p class="font-medium">{user?.email}</p>
    </div>
    <div>
      <label class="text-sm text-[var(--color-muted)]">Nome</label>
      <p class="font-medium">{user?.first_name} {user?.last_name}</p>
    </div>
  </div>
</Account>
```

- [ ] **Step 5.2: Crea `src/pages/account/ordini/index.astro`**

```astro
---
export const prerender = false;
import Account from '../../../layouts/Account.astro';
import { getCurrentUser } from '../../../lib/auth';
import { getOrdersByCustomer } from '../../../lib/directus';

const user = await getCurrentUser(Astro.cookies);
const orders = user ? await getOrdersByCustomer(user.id) : [];
---
<Account title="I miei ordini">
  <h1 class="text-2xl font-bold mb-6">I miei ordini</h1>
  {orders.length === 0
    ? <p class="text-[var(--color-muted)]">Nessun ordine ancora. <a href="/negozio" class="text-[var(--color-brand)]">Vai al negozio</a></p>
    : (
      <div class="space-y-4">
        {orders.map(order => (
          <a href={`/account/ordini/${order.id}`} class="block bg-[var(--color-surface)] rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div class="flex justify-between items-center">
              <div>
                <p class="font-medium">Ordine #{order.id.slice(0, 8)}</p>
                <p class="text-sm text-[var(--color-muted)]">{new Date(order.date_created).toLocaleDateString('it-IT')}</p>
              </div>
              <div class="text-right">
                <p class="font-bold">€{order.total.toFixed(2)}</p>
                <span class={`text-xs px-2 py-1 rounded-full ${order.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                  {order.status}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    )
  }
</Account>
```

- [ ] **Step 5.3: Crea `src/pages/account/ordini/[id].astro`**

```astro
---
export const prerender = false;
import Account from '../../../layouts/Account.astro';
import { getCurrentUser } from '../../../lib/auth';
import { getOrderById } from '../../../lib/directus';

const { id } = Astro.params;
const user = await getCurrentUser(Astro.cookies);
const order = id ? await getOrderById(id) : null;

// Verifica che l'ordine appartenga all'utente corrente
if (!order || (order.customer_id && order.customer_id !== user?.id)) {
  return Astro.redirect('/account/ordini');
}
---
<Account title={`Ordine #${order.id.slice(0, 8)}`}>
  <div class="flex items-center gap-4 mb-6">
    <a href="/account/ordini" class="text-[var(--color-muted)] hover:text-[var(--color-brand)]">← Ordini</a>
    <h1 class="text-2xl font-bold">Ordine #{order.id.slice(0, 8)}</h1>
    <span class={`text-xs px-2 py-1 rounded-full ${order.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
      {order.status}
    </span>
  </div>

  <div class="space-y-6">
    <div class="bg-[var(--color-surface)] rounded-lg p-6">
      <h2 class="font-semibold mb-4">Prodotti</h2>
      <div class="space-y-3">
        {order.order_items?.map(item => (
          <div class="flex justify-between items-start">
            <div>
              <p class="font-medium">{item.product_name}</p>
              <p class="text-sm text-[var(--color-muted)]">{item.variant_name} × {item.quantity}</p>
              {item.download_token && (
                <a
                  href={`/api/download/${item.download_token}`}
                  class="text-sm text-[var(--color-brand)] hover:underline mt-1 block"
                  download
                >
                  ↓ Download ({item.download_count}/{item.download_limit})
                </a>
              )}
            </div>
            <span class="font-medium">€{(item.unit_price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>

    <div class="bg-[var(--color-surface)] rounded-lg p-6">
      <h2 class="font-semibold mb-4">Riepilogo</h2>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between"><span>Subtotale</span><span>€{order.subtotal.toFixed(2)}</span></div>
        {order.discount_amount > 0 && (
          <div class="flex justify-between text-[var(--color-success)]"><span>Sconto</span><span>-€{order.discount_amount.toFixed(2)}</span></div>
        )}
        {order.shipping_cost > 0 && (
          <div class="flex justify-between"><span>Spedizione</span><span>€{order.shipping_cost.toFixed(2)}</span></div>
        )}
        <div class="flex justify-between font-bold text-base border-t pt-2"><span>Totale</span><span>€{order.total.toFixed(2)}</span></div>
      </div>
    </div>
  </div>
</Account>
```

- [ ] **Step 5.4: Crea `src/pages/account/login.astro`** (form login Directus)

```astro
---
export const prerender = false;
import Base from '../../layouts/Base.astro';
import { setAuthCookies } from '../../lib/auth';

if (Astro.request.method === 'POST') {
  const data = await Astro.request.formData();
  const email = data.get('email')?.toString() ?? '';
  const password = data.get('password')?.toString() ?? '';

  const res = await fetch(`${import.meta.env.DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (res.ok) {
    const { data: auth } = await res.json();
    setAuthCookies(Astro.cookies, auth.access_token, auth.refresh_token, auth.expires);
    const redirect = new URL(Astro.request.url).searchParams.get('redirect') ?? '/account';
    return Astro.redirect(redirect);
  }
}
---
<Base title="Accedi">
  <div class="max-w-sm mx-auto px-4 py-20">
    <h1 class="text-2xl font-bold mb-8 text-center">Accedi</h1>
    <form method="POST" class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">Email</label>
        <input type="email" name="email" required class="w-full border rounded-[var(--radius)] px-3 py-2" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Password</label>
        <input type="password" name="password" required class="w-full border rounded-[var(--radius)] px-3 py-2" />
      </div>
      <button type="submit" class="w-full py-3 bg-[var(--color-brand)] text-white rounded-[var(--radius)] font-medium">
        Accedi
      </button>
    </form>
    <p class="text-center text-sm text-[var(--color-muted)] mt-4">
      Non hai un account? <a href="/account/register" class="text-[var(--color-brand)]">Registrati</a>
    </p>
  </div>
</Base>
```

- [ ] **Step 5.5: Crea `src/pages/account/logout.astro`**

```astro
---
export const prerender = false;
import { clearAuthCookies } from '../../lib/auth';
clearAuthCookies(Astro.cookies);
return Astro.redirect('/');
---
```

- [ ] **Step 5.6: Crea `src/pages/account/wishlist.astro`** (stub)

```astro
---
export const prerender = false;
import Account from '../../layouts/Account.astro';
---
<Account title="Wishlist">
  <h1 class="text-2xl font-bold mb-6">Wishlist</h1>
  <p class="text-[var(--color-muted)]">La wishlist sarà disponibile nella prossima versione.</p>
</Account>
```

- [ ] **Step 5.7: Esegui build**

```bash
npm run build
```

Expected: 0 errori.

- [ ] **Step 5.8: Commit**

```bash
git add src/pages/account/ src/lib/auth.ts
git commit -m "feat: add SSR account pages (profile, orders, order detail, login)"
```

---

## Checklist Finale Piano 3

- [ ] `npm run build` — 0 errori
- [ ] Testa webhook in locale con `stripe listen --forward-to localhost:8888/.netlify/functions/webhook-stripe`
- [ ] Dopo pagamento test: verifica ordine creato in Directus
- [ ] Verifica decremento stock varianti fisiche
- [ ] Testa download token: URL `/api/download/:token` scarica il file
- [ ] Testa limite download: al limite + 1 ritorna 410
- [ ] Pagine `/account/*` redirigono a `/account/login` senza cookie
- [ ] Login con credenziali Directus funziona
- [ ] `/account/ordini` mostra ordini dell'utente
- [ ] Commit finale con tag `v0.3.0-post-purchase`

```bash
git tag v0.3.0-post-purchase
```

---

**Prossimo piano:** [Piano 4 — Commerce Features](2026-05-03-ecommerce-plan-4-commerce-features.md)
