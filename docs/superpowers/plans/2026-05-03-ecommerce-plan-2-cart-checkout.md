# E-commerce Template — Piano 2: Cart & Checkout

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere carrello persistente (localStorage via Nanostores) e flusso checkout completo con Stripe Checkout hosted.

**Architecture:** Carrello gestito client-side con Nanostores + `@nanostores/persistent` (localStorage). Al checkout: POST a Netlify Function `/api/checkout` che rilegge i prezzi da Directus, calcola spedizione, applica sconti e crea sessione Stripe. Coupon e gift card validati server-side prima del checkout.

**Tech Stack:** Nanostores, `@nanostores/persistent`, Stripe SDK v15, Zod v3, Netlify Functions (ESM).

**Prerequisito:** Piano 1 completato.

---

## Struttura File (questo piano)

```
src/
├── stores/
│   └── cart.ts                        # Nanostore carrello (localStorage)
├── components/shop/
│   ├── AddToCart.astro                # Island client:load
│   ├── VariantSelector.astro          # Selettore opzioni prodotto
│   ├── CartDrawer.astro               # Carrello laterale island
│   └── CartSummary.astro              # Riepilogo + coupon/gift card
├── pages/
│   ├── carrello.astro                 # Pagina carrello SSG
│   └── checkout/
│       ├── success.astro              # Conferma ordine SSG
│       └── cancel.astro              # Annullamento SSG
netlify/
└── functions/
    ├── checkout.ts                    # POST /api/checkout
    ├── coupon-validate.ts             # POST /api/coupon/validate
    └── giftcard-validate.ts           # POST /api/giftcard/validate
src/lib/
└── shipping.ts                        # Calcolo costo spedizione
```

---

## Task 1: Cart Store (Nanostores)

**Files:**
- Create: `src/stores/cart.ts`
- Create: `src/stores/cart.test.ts`

- [ ] **Step 1.1: Crea `src/stores/cart.ts`**

```typescript
import { atom, computed } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';
import type { CartItem } from '../lib/types';

export const cartItems = persistentAtom<CartItem[]>('cart', [], {
  encode: JSON.stringify,
  decode: JSON.parse,
});

export const cartCount = computed(cartItems, items =>
  items.reduce((sum, item) => sum + item.quantity, 0)
);

export const cartTotal = computed(cartItems, items =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0)
);

export const cartWeightG = computed(cartItems, items =>
  items.reduce((sum, item) => sum + item.weightG * item.quantity, 0)
);

export function addToCart(item: CartItem): void {
  const current = cartItems.get();
  const existing = current.findIndex(i => i.variantId === item.variantId);
  if (existing >= 0) {
    const updated = [...current];
    updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + item.quantity };
    cartItems.set(updated);
  } else {
    cartItems.set([...current, item]);
  }
}

export function removeFromCart(variantId: string): void {
  cartItems.set(cartItems.get().filter(i => i.variantId !== variantId));
}

export function updateQuantity(variantId: string, quantity: number): void {
  if (quantity <= 0) {
    removeFromCart(variantId);
    return;
  }
  cartItems.set(
    cartItems.get().map(i => i.variantId === variantId ? { ...i, quantity } : i)
  );
}

export function clearCart(): void {
  cartItems.set([]);
}
```

- [ ] **Step 1.2: Crea `src/stores/cart.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { cartItems, cartCount, cartTotal, addToCart, removeFromCart, updateQuantity, clearCart } from './cart';
import type { CartItem } from '../lib/types';

const mockItem: CartItem = {
  variantId: 'v1',
  productId: 'p1',
  productName: 'Prodotto Test',
  variantName: 'Default',
  sku: 'SKU-001',
  price: 29.99,
  quantity: 1,
  image: null,
  type: 'physical',
  weightG: 300,
};

beforeEach(() => clearCart());

describe('addToCart', () => {
  it('adds a new item to the cart', () => {
    addToCart(mockItem);
    expect(cartItems.get()).toHaveLength(1);
    expect(cartCount.get()).toBe(1);
  });

  it('increments quantity if same variant already in cart', () => {
    addToCart(mockItem);
    addToCart({ ...mockItem, quantity: 2 });
    expect(cartItems.get()).toHaveLength(1);
    expect(cartItems.get()[0].quantity).toBe(3);
  });
});

describe('removeFromCart', () => {
  it('removes item by variantId', () => {
    addToCart(mockItem);
    removeFromCart('v1');
    expect(cartItems.get()).toHaveLength(0);
  });
});

describe('updateQuantity', () => {
  it('updates quantity of existing item', () => {
    addToCart(mockItem);
    updateQuantity('v1', 5);
    expect(cartItems.get()[0].quantity).toBe(5);
  });

  it('removes item when quantity set to 0', () => {
    addToCart(mockItem);
    updateQuantity('v1', 0);
    expect(cartItems.get()).toHaveLength(0);
  });
});

describe('cartTotal', () => {
  it('calculates total correctly', () => {
    addToCart({ ...mockItem, price: 10, quantity: 2 });
    addToCart({ ...mockItem, variantId: 'v2', price: 5, quantity: 1 });
    expect(cartTotal.get()).toBe(25);
  });
});
```

- [ ] **Step 1.3: Esegui test**

```bash
npm test
```

Expected: PASS (7 tests).

- [ ] **Step 1.4: Commit**

```bash
git add src/stores/
git commit -m "feat: add cart store with Nanostores + localStorage persistence"
```

---

## Task 2: Shipping Calculator

**Files:**
- Create: `src/lib/shipping.ts`
- Create: `src/lib/shipping.test.ts`

- [ ] **Step 2.1: Crea `src/lib/shipping.ts`**

```typescript
import type { ShippingZone } from './types';

export function findShippingZone(countryCode: string, zones: ShippingZone[]): ShippingZone | null {
  return zones.find(z => z.is_active && z.countries.includes(countryCode)) ?? null;
}

export function calculateShipping(
  zone: ShippingZone,
  weightG: number,
  subtotal: number
): number {
  if (zone.free_shipping_threshold !== null && subtotal >= zone.free_shipping_threshold) {
    return 0;
  }
  if (zone.max_weight_g !== null && weightG > zone.max_weight_g) {
    throw new Error(`Peso ${weightG}g supera il massimo di ${zone.max_weight_g}g per la zona ${zone.name}`);
  }
  const weightKg = weightG / 1000;
  return zone.base_rate + zone.rate_per_kg * weightKg;
}
```

- [ ] **Step 2.2: Crea `src/lib/shipping.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { findShippingZone, calculateShipping } from './shipping';
import type { ShippingZone } from './types';

const italyZone: ShippingZone = {
  id: 'z1',
  name: 'Italia',
  countries: ['IT'],
  base_rate: 5.90,
  free_shipping_threshold: 50,
  rate_per_kg: 1.5,
  max_weight_g: 30000,
  is_active: true,
};

describe('findShippingZone', () => {
  it('finds zone by country code', () => {
    expect(findShippingZone('IT', [italyZone])?.name).toBe('Italia');
  });

  it('returns null for unknown country', () => {
    expect(findShippingZone('US', [italyZone])).toBeNull();
  });
});

describe('calculateShipping', () => {
  it('returns 0 when subtotal exceeds free shipping threshold', () => {
    expect(calculateShipping(italyZone, 1000, 50)).toBe(0);
    expect(calculateShipping(italyZone, 1000, 100)).toBe(0);
  });

  it('calculates shipping with base rate + weight', () => {
    // 2kg = 5.90 + 1.5*2 = 8.90
    expect(calculateShipping(italyZone, 2000, 30)).toBeCloseTo(8.90);
  });

  it('throws when weight exceeds max', () => {
    expect(() => calculateShipping(italyZone, 31000, 30)).toThrow();
  });
});
```

- [ ] **Step 2.3: Esegui test**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2.4: Commit**

```bash
git add src/lib/shipping.ts src/lib/shipping.test.ts
git commit -m "feat: add shipping zone calculator"
```

---

## Task 3: Netlify Function — Coupon & Gift Card Validate

**Files:**
- Create: `netlify/functions/coupon-validate.ts`
- Create: `netlify/functions/giftcard-validate.ts`

- [ ] **Step 3.1: Crea `netlify/functions/coupon-validate.ts`**

```typescript
import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { getCouponByCode } from '../../src/lib/directus';

const schema = z.object({ code: z.string().min(1) });

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const origin = event.headers['origin'] ?? '';
  const allowed = process.env.ALLOWED_ORIGIN ?? '';
  if (allowed && origin !== allowed) return { statusCode: 403, body: 'Forbidden' };

  let body: unknown;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Codice coupon mancante' }) };
  }

  const coupon = await getCouponByCode(parsed.data.code);

  if (!coupon) {
    return { statusCode: 404, body: JSON.stringify({ valid: false, error: 'Coupon non trovato o non attivo' }) };
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { statusCode: 400, body: JSON.stringify({ valid: false, error: 'Coupon scaduto' }) };
  }
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    return { statusCode: 400, body: JSON.stringify({ valid: false, error: 'Coupon esaurito' }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        min_order_amount: coupon.min_order_amount,
        description: coupon.description,
      },
    }),
  };
};
```

- [ ] **Step 3.2: Crea `netlify/functions/giftcard-validate.ts`**

```typescript
import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { getGiftCardByCode } from '../../src/lib/directus';

const schema = z.object({ code: z.string().min(1) });

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let body: unknown;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Codice gift card mancante' }) };
  }

  const card = await getGiftCardByCode(parsed.data.code);

  if (!card) {
    return { statusCode: 404, body: JSON.stringify({ valid: false, error: 'Gift card non trovata o non attiva' }) };
  }
  if (card.expires_at && new Date(card.expires_at) < new Date()) {
    return { statusCode: 400, body: JSON.stringify({ valid: false, error: 'Gift card scaduta' }) };
  }
  if (card.remaining_value <= 0) {
    return { statusCode: 400, body: JSON.stringify({ valid: false, error: 'Gift card esaurita' }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      valid: true,
      giftCard: {
        id: card.id,
        code: card.code,
        remaining_value: card.remaining_value,
      },
    }),
  };
};
```

- [ ] **Step 3.3: Installa `@netlify/functions`**

```bash
npm install -D @netlify/functions
```

- [ ] **Step 3.4: Commit**

```bash
git add netlify/ package.json package-lock.json
git commit -m "feat: add coupon and gift card validation Netlify Functions"
```

---

## Task 4: Netlify Function — Checkout

**Files:**
- Create: `netlify/functions/checkout.ts`

- [ ] **Step 4.1: Crea `netlify/functions/checkout.ts`**

```typescript
import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { z } from 'zod';
import { createClient } from '../../src/lib/directus';
import { readItems, readItem } from '@directus/sdk';
import { findShippingZone, calculateShipping } from '../../src/lib/shipping';
import type { Product, ProductVariant, ShippingZone, Coupon, GiftCard } from '../../src/lib/types';

const lineItemSchema = z.object({
  variantId: z.string(),
  quantity: z.number().int().min(1),
});

const checkoutSchema = z.object({
  items: z.array(lineItemSchema).min(1),
  countryCode: z.string().length(2),
  couponId: z.string().optional(),
  giftCardId: z.string().optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

function getRequiredEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const origin = event.headers['origin'] ?? '';
  const allowed = process.env.ALLOWED_ORIGIN ?? '';
  if (allowed && origin !== allowed) return { statusCode: 403, body: 'Forbidden' };

  let body: unknown;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return { statusCode: 400, body: JSON.stringify({ error: parsed.error.flatten() }) };
  }

  const { items, countryCode, couponId, giftCardId, successUrl, cancelUrl } = parsed.data;

  const stripe = new Stripe(getRequiredEnv('STRIPE_SECRET_KEY'));
  const directus = createClient();

  // 1. Rilegge prezzi e varianti da Directus — mai fidati dal client
  const variantIds = items.map(i => i.variantId);
  const variants = await directus.request(
    readItems('product_variants', {
      filter: { id: { _in: variantIds }, is_active: { _eq: true } },
      fields: ['id', 'sku', 'name', 'price_override', 'stripe_price_id', 'stock_quantity', 'product_id.*'],
    })
  ) as (ProductVariant & { product_id: Product })[];

  if (variants.length !== items.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Una o più varianti non trovate o non attive' }) };
  }

  // 2. Verifica stock
  for (const item of items) {
    const variant = variants.find(v => v.id === item.variantId)!;
    if (variant.stock_quantity < item.quantity) {
      return { statusCode: 400, body: JSON.stringify({ error: `Stock insufficiente per ${variant.name}` }) };
    }
  }

  // 3. Calcola subtotale e peso
  let subtotal = 0;
  let totalWeightG = 0;
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  for (const item of items) {
    const variant = variants.find(v => v.id === item.variantId)!;
    const price = variant.price_override ?? variant.product_id.base_price;
    subtotal += price * item.quantity;
    totalWeightG += variant.product_id.weight_g * item.quantity;
    lineItems.push({ price: variant.stripe_price_id, quantity: item.quantity });
  }

  // 4. Calcola spedizione
  const zones = await directus.request(
    readItems('shipping_zones', { filter: { is_active: { _eq: true } }, fields: ['*'] })
  ) as ShippingZone[];

  const zone = findShippingZone(countryCode, zones);
  let shippingCost = 0;
  if (zone) {
    try {
      shippingCost = calculateShipping(zone, totalWeightG, subtotal);
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: 'Spedizione non disponibile per il peso totale' }) };
    }
  }

  // 5. Applica coupon
  let discountAmount = 0;
  let stripeCouponId: string | undefined;
  if (couponId) {
    const coupon = await directus.request(readItem('coupons', couponId, { fields: ['*'] })) as Coupon;
    if (coupon?.is_active) {
      if (coupon.type === 'percent') {
        discountAmount = subtotal * (coupon.value / 100);
      } else {
        discountAmount = Math.min(coupon.value, subtotal);
      }
      stripeCouponId = coupon.stripe_coupon_id;
    }
  }

  // 6. Applica gift card
  let giftCardAmount = 0;
  if (giftCardId) {
    const card = await directus.request(readItem('gift_cards', giftCardId, { fields: ['remaining_value'] })) as GiftCard;
    if (card) {
      giftCardAmount = Math.min(card.remaining_value, subtotal - discountAmount + shippingCost);
    }
  }

  // 7. Crea sessione Stripe
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    line_items: lineItems,
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: {
      coupon_id: couponId ?? '',
      gift_card_id: giftCardId ?? '',
      gift_card_amount: giftCardAmount.toFixed(2),
      country_code: countryCode,
      shipping_zone_id: zone?.id ?? '',
    },
    shipping_address_collection: { allowed_countries: [countryCode as Stripe.ShippingAddressCollection.AllowedCountry] },
    customer_email: undefined,
  };

  if (shippingCost > 0) {
    sessionParams.shipping_options = [{
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: { amount: Math.round(shippingCost * 100), currency: 'eur' },
        display_name: zone?.name ?? 'Spedizione standard',
      },
    }];
  }

  if (stripeCouponId) {
    sessionParams.discounts = [{ coupon: stripeCouponId }];
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: session.url }),
  };
};
```

- [ ] **Step 4.2: Commit**

```bash
git add netlify/functions/checkout.ts
git commit -m "feat: add Stripe checkout Netlify Function"
```

---

## Task 5: Componenti Cart UI

**Files:**
- Create: `src/components/shop/VariantSelector.astro`
- Create: `src/components/shop/AddToCart.astro`
- Create: `src/components/shop/CartDrawer.astro`
- Create: `src/components/shop/CartSummary.astro`
- Modify: `src/pages/negozio/[slug].astro`

- [ ] **Step 5.1: Crea `src/components/shop/VariantSelector.astro`**

```astro
---
import type { ProductVariant } from '../../lib/types';

interface Props {
  variants: ProductVariant[];
  basePrice: number;
}
const { variants, basePrice } = Astro.props;
---
<div class="variant-selector space-y-4" data-base-price={basePrice}>
  {variants.length > 1 && (
    <div>
      <label class="block text-sm font-medium mb-2">Variante</label>
      <div class="flex gap-2 flex-wrap">
        {variants.map((v, i) => (
          <button
            type="button"
            class={`variant-btn px-4 py-2 border rounded-[var(--radius)] text-sm transition-colors ${i === 0 ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white' : 'border-gray-200 hover:border-[var(--color-brand)]'}`}
            data-variant-id={v.id}
            data-sku={v.sku}
            data-name={v.name}
            data-price={v.price_override ?? basePrice}
            data-stock={v.stock_quantity}
          >
            {v.name}
          </button>
        ))}
      </div>
    </div>
  )}
  <p class="selected-price text-2xl font-bold text-[var(--color-brand)]">
    €{(variants[0]?.price_override ?? basePrice).toFixed(2)}
  </p>
  <input type="hidden" id="selected-variant-id" value={variants[0]?.id ?? ''} />
  <input type="hidden" id="selected-variant-sku" value={variants[0]?.sku ?? ''} />
  <input type="hidden" id="selected-variant-name" value={variants[0]?.name ?? ''} />
  <input type="hidden" id="selected-variant-price" value={variants[0]?.price_override ?? basePrice} />
  <input type="hidden" id="selected-variant-stock" value={variants[0]?.stock_quantity ?? 0} />
</div>

<script>
  document.querySelectorAll<HTMLButtonElement>('.variant-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.variant-btn').forEach(b => {
        b.classList.remove('border-[var(--color-brand)]', 'bg-[var(--color-brand)]', 'text-white');
        b.classList.add('border-gray-200');
      });
      btn.classList.add('border-[var(--color-brand)]', 'bg-[var(--color-brand)]', 'text-white');
      btn.classList.remove('border-gray-200');

      const price = Number(btn.dataset.price);
      document.querySelector<HTMLParagraphElement>('.selected-price')!.textContent = `€${price.toFixed(2)}`;
      (document.getElementById('selected-variant-id') as HTMLInputElement).value = btn.dataset.variantId!;
      (document.getElementById('selected-variant-sku') as HTMLInputElement).value = btn.dataset.sku!;
      (document.getElementById('selected-variant-name') as HTMLInputElement).value = btn.dataset.name!;
      (document.getElementById('selected-variant-price') as HTMLInputElement).value = String(price);
      (document.getElementById('selected-variant-stock') as HTMLInputElement).value = btn.dataset.stock!;
    });
  });
</script>
```

- [ ] **Step 5.2: Crea `src/components/shop/AddToCart.astro`**

```astro
---
interface Props {
  productId: string;
  productName: string;
  productType: 'physical' | 'digital';
  weightG: number;
  image: string | null;
}
const { productId, productName, productType, weightG, image } = Astro.props;
---
<div class="add-to-cart-widget space-y-4"
  data-product-id={productId}
  data-product-name={productName}
  data-product-type={productType}
  data-weight={weightG}
  data-image={image ?? ''}>
  <div class="flex items-center gap-3">
    <label class="text-sm font-medium">Quantità</label>
    <div class="flex items-center border rounded-[var(--radius)]">
      <button type="button" id="qty-minus" class="px-3 py-2 hover:bg-gray-50">−</button>
      <span id="qty-display" class="px-4 py-2 min-w-[3rem] text-center">1</span>
      <button type="button" id="qty-plus" class="px-3 py-2 hover:bg-gray-50">+</button>
    </div>
  </div>
  <button
    type="button"
    id="add-to-cart-btn"
    class="w-full py-3 px-6 bg-[var(--color-brand)] text-white rounded-[var(--radius)] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
  >
    Aggiungi al carrello
  </button>
  <p id="add-to-cart-msg" class="text-sm text-[var(--color-success)] hidden">✓ Aggiunto al carrello</p>
</div>

<script>
  import { addToCart } from '../../stores/cart';

  const widget = document.querySelector<HTMLDivElement>('.add-to-cart-widget')!;
  let qty = 1;

  document.getElementById('qty-minus')?.addEventListener('click', () => {
    if (qty > 1) { qty--; document.getElementById('qty-display')!.textContent = String(qty); }
  });
  document.getElementById('qty-plus')?.addEventListener('click', () => {
    qty++; document.getElementById('qty-display')!.textContent = String(qty);
  });

  document.getElementById('add-to-cart-btn')?.addEventListener('click', () => {
    const variantId = (document.getElementById('selected-variant-id') as HTMLInputElement)?.value ?? '';
    const variantSku = (document.getElementById('selected-variant-sku') as HTMLInputElement)?.value ?? '';
    const variantName = (document.getElementById('selected-variant-name') as HTMLInputElement)?.value ?? '';
    const price = Number((document.getElementById('selected-variant-price') as HTMLInputElement)?.value ?? 0);
    const stock = Number((document.getElementById('selected-variant-stock') as HTMLInputElement)?.value ?? 0);

    if (!variantId) return;
    if (stock <= 0 && widget.dataset.productType === 'physical') {
      alert('Prodotto esaurito');
      return;
    }

    addToCart({
      variantId,
      productId: widget.dataset.productId!,
      productName: widget.dataset.productName!,
      variantName,
      sku: variantSku,
      price,
      quantity: qty,
      image: widget.dataset.image || null,
      type: widget.dataset.productType as 'physical' | 'digital',
      weightG: Number(widget.dataset.weight),
    });

    const msg = document.getElementById('add-to-cart-msg');
    msg?.classList.remove('hidden');
    setTimeout(() => msg?.classList.add('hidden'), 2000);
  });
</script>
```

- [ ] **Step 5.3: Aggiorna `src/pages/negozio/[slug].astro`** — sostituisce il placeholder con i componenti reali

Trova il blocco `<!-- Variant selector + Add to cart (Piano 2) -->` e sostituiscilo:

```astro
---
// aggiunge import in cima al frontmatter:
import VariantSelector from '../../components/shop/VariantSelector.astro';
import AddToCart from '../../components/shop/AddToCart.astro';
---
```

```astro
<!-- sostituisce il div #add-to-cart-placeholder -->
<VariantSelector variants={activeVariants} basePrice={product.base_price} />
<AddToCart
  productId={product.id}
  productName={product.name}
  productType={product.type}
  weightG={product.weight_g}
  image={images[0] ?? null}
/>
```

- [ ] **Step 5.4: Crea `src/pages/carrello.astro`**

```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="Carrello">
  <div class="max-w-[var(--max-width)] mx-auto px-4 py-12">
    <h1 class="text-3xl font-bold mb-8">Il tuo carrello</h1>
    <div id="cart-root">
      <p class="text-[var(--color-muted)]">Caricamento...</p>
    </div>
  </div>
</Base>

<script>
  import { cartItems, cartTotal, cartWeightG, removeFromCart, updateQuantity, clearCart } from '../stores/cart';

  function renderCart() {
    const root = document.getElementById('cart-root')!;
    const items = cartItems.get();

    if (items.length === 0) {
      root.innerHTML = `
        <p class="text-[var(--color-muted)] text-lg">Il carrello è vuoto.</p>
        <a href="/negozio" class="inline-block mt-4 px-6 py-3 bg-[var(--color-brand)] text-white rounded-lg">Vai al negozio</a>
      `;
      return;
    }

    const itemsHtml = items.map(item => `
      <tr class="border-b">
        <td class="py-4 flex items-center gap-4">
          ${item.image ? `<img src="${item.image}" alt="${item.productName}" class="w-16 h-16 object-cover rounded" />` : '<div class="w-16 h-16 bg-gray-100 rounded"></div>'}
          <div>
            <p class="font-medium">${item.productName}</p>
            <p class="text-sm text-[var(--color-muted)]">${item.variantName}</p>
          </div>
        </td>
        <td class="py-4 text-center">€${item.price.toFixed(2)}</td>
        <td class="py-4 text-center">
          <input type="number" min="1" value="${item.quantity}" data-variant="${item.variantId}"
            class="qty-input w-16 text-center border rounded p-1" />
        </td>
        <td class="py-4 text-center font-bold">€${(item.price * item.quantity).toFixed(2)}</td>
        <td class="py-4 text-center">
          <button type="button" class="remove-btn text-red-500 hover:text-red-700" data-variant="${item.variantId}">✕</button>
        </td>
      </tr>
    `).join('');

    root.innerHTML = `
      <div id="coupon-gift-form" class="mb-6 p-4 bg-[var(--color-surface)] rounded-lg space-y-3">
        <div class="flex gap-2">
          <input id="coupon-input" type="text" placeholder="Codice coupon" class="flex-1 border rounded px-3 py-2 text-sm" />
          <button id="apply-coupon" type="button" class="px-4 py-2 bg-[var(--color-brand)] text-white rounded text-sm">Applica</button>
        </div>
        <div class="flex gap-2">
          <input id="giftcard-input" type="text" placeholder="Codice gift card" class="flex-1 border rounded px-3 py-2 text-sm" />
          <button id="apply-giftcard" type="button" class="px-4 py-2 bg-[var(--color-accent)] text-white rounded text-sm">Applica</button>
        </div>
        <p id="discount-msg" class="text-sm text-[var(--color-success)] hidden"></p>
        <p id="discount-error" class="text-sm text-[var(--color-error)] hidden"></p>
      </div>

      <table class="w-full mb-8">
        <thead><tr class="text-left text-sm text-[var(--color-muted)] border-b">
          <th class="pb-2">Prodotto</th><th class="pb-2 text-center">Prezzo</th>
          <th class="pb-2 text-center">Qtà</th><th class="pb-2 text-center">Totale</th><th></th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <div class="flex justify-end">
        <div class="w-full max-w-xs space-y-2">
          <div class="flex justify-between"><span>Subtotale</span><span>€${cartTotal.get().toFixed(2)}</span></div>
          <div id="discount-line" class="flex justify-between text-[var(--color-success)] hidden">
            <span>Sconto</span><span id="discount-value">-€0.00</span>
          </div>
          <div class="flex justify-between font-bold text-lg border-t pt-2">
            <span>Totale</span><span id="cart-total">€${cartTotal.get().toFixed(2)}</span>
          </div>
          <button id="checkout-btn" type="button"
            class="w-full py-3 bg-[var(--color-brand)] text-white rounded-lg font-medium hover:opacity-90 mt-4">
            Procedi al checkout →
          </button>
        </div>
      </div>
    `;

    // Event listeners
    document.querySelectorAll<HTMLInputElement>('.qty-input').forEach(input => {
      input.addEventListener('change', () => updateQuantity(input.dataset.variant!, Number(input.value)));
    });
    document.querySelectorAll<HTMLButtonElement>('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => { removeFromCart(btn.dataset.variant!); renderCart(); });
    });

    // Coupon
    let appliedCoupon: { id: string; type: string; value: number } | null = null;
    let appliedGiftCard: { id: string; remaining_value: number } | null = null;

    document.getElementById('apply-coupon')?.addEventListener('click', async () => {
      const code = (document.getElementById('coupon-input') as HTMLInputElement).value.trim();
      if (!code) return;
      const res = await fetch('/api/coupon/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const data = await res.json();
      const msg = document.getElementById('discount-msg')!;
      const err = document.getElementById('discount-error')!;
      if (data.valid) {
        appliedCoupon = data.coupon;
        msg.textContent = `Coupon "${code}" applicato!`;
        msg.classList.remove('hidden');
        err.classList.add('hidden');
      } else {
        err.textContent = data.error;
        err.classList.remove('hidden');
        msg.classList.add('hidden');
      }
    });

    document.getElementById('apply-giftcard')?.addEventListener('click', async () => {
      const code = (document.getElementById('giftcard-input') as HTMLInputElement).value.trim();
      if (!code) return;
      const res = await fetch('/api/giftcard/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const data = await res.json();
      const msg = document.getElementById('discount-msg')!;
      const err = document.getElementById('discount-error')!;
      if (data.valid) {
        appliedGiftCard = data.giftCard;
        msg.textContent = `Gift card applicata! Saldo: €${data.giftCard.remaining_value.toFixed(2)}`;
        msg.classList.remove('hidden');
        err.classList.add('hidden');
      } else {
        err.textContent = data.error;
        err.classList.remove('hidden');
        msg.classList.add('hidden');
      }
    });

    document.getElementById('checkout-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('checkout-btn') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = 'Elaborazione...';

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartItems.get().map(i => ({ variantId: i.variantId, quantity: i.quantity })),
          countryCode: 'IT',
          couponId: appliedCoupon?.id,
          giftCardId: appliedGiftCard?.id,
          successUrl: `${window.location.origin}/checkout/success`,
          cancelUrl: `${window.location.origin}/carrello`,
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        btn.disabled = false;
        btn.textContent = 'Procedi al checkout →';
        alert(data.error ?? 'Errore durante il checkout');
      }
    });
  }

  renderCart();
  cartItems.subscribe(renderCart);
</script>
```

- [ ] **Step 5.5: Crea `src/pages/checkout/success.astro`**

```astro
---
import Base from '../../layouts/Base.astro';
---
<Base title="Ordine confermato">
  <div class="max-w-2xl mx-auto px-4 py-20 text-center">
    <div class="text-6xl mb-6">✓</div>
    <h1 class="text-3xl font-bold mb-4">Ordine confermato!</h1>
    <p class="text-[var(--color-muted)] mb-8">Grazie per il tuo acquisto. Riceverai una email di conferma a breve.</p>
    <div id="order-summary" class="text-left mb-8">
      <p class="text-[var(--color-muted)] text-sm">Caricamento dettagli ordine...</p>
    </div>
    <a href="/negozio" class="inline-block px-8 py-3 bg-[var(--color-brand)] text-white rounded-lg font-medium">
      Continua gli acquisti
    </a>
  </div>
</Base>

<script>
  import { clearCart } from '../../stores/cart';

  const sessionId = new URLSearchParams(window.location.search).get('session_id');
  if (sessionId) {
    clearCart();
    // Mostra session ID per debug — in produzione sostituire con fetch ordine da Directus
    document.getElementById('order-summary')!.innerHTML =
      `<p class="text-sm text-[var(--color-muted)]">ID sessione: ${sessionId}</p>`;
  }
</script>
```

- [ ] **Step 5.6: Crea `src/pages/checkout/cancel.astro`**

```astro
---
import Base from '../../layouts/Base.astro';
---
<Base title="Ordine annullato">
  <div class="max-w-2xl mx-auto px-4 py-20 text-center">
    <h1 class="text-2xl font-bold mb-4">Checkout annullato</h1>
    <p class="text-[var(--color-muted)] mb-6">Nessun addebito è stato effettuato.</p>
    <a href="/carrello" class="inline-block px-6 py-3 bg-[var(--color-brand)] text-white rounded-lg">
      Torna al carrello
    </a>
  </div>
</Base>
```

- [ ] **Step 5.7: Verifica build**

```bash
npm run build
```

Expected: 0 errori.

- [ ] **Step 5.8: Commit**

```bash
git add src/ netlify/
git commit -m "feat: add cart UI, checkout flow and Stripe integration"
```

---

## Checklist Finale Piano 2

- [ ] `npm test` — tutti i test passano (cart store + shipping calculator)
- [ ] `npm run build` — 0 errori
- [ ] Dev server: aggiungere prodotto al carrello funziona
- [ ] Pagina `/carrello` mostra items, coupon input, bottone checkout
- [ ] In ambiente Netlify dev (`netlify dev`): test checkout con Stripe test key
- [ ] Commit finale con tag `v0.2.0-checkout`

```bash
git tag v0.2.0-checkout
```

---

**Prossimo piano:** [Piano 3 — Post-Purchase](2026-05-03-ecommerce-plan-3-post-purchase.md)
