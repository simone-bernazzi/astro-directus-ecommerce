# E-commerce Template — Piano 4: Commerce Features

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completare le features commerce avanzate: vendita gift card come prodotto, gestione zone di spedizione nel pannello Directus, pagina prodotto gift card con importi configurabili, e registrazione account cliente post-checkout.

**Architecture:** Le gift card sono prodotti speciali in Directus (`type = 'gift_card'`). All'acquisto il webhook genera automaticamente il codice UUID e lo salva in `gift_cards`. La vendita avviene tramite il normale flusso checkout. La registrazione account è opzionale dopo il checkout.

**Tech Stack:** Stessa stack dei piani precedenti. Nessuna dipendenza nuova.

**Prerequisito:** Piano 3 completato.

---

## Struttura File (questo piano)

```
src/
├── pages/
│   ├── gift-card.astro                # Pagina acquisto gift card
│   └── account/
│       └── register.astro             # Registrazione opzionale post-checkout
├── components/shop/
│   └── GiftCardSelector.astro         # Selettore importo gift card
netlify/functions/
└── webhook-stripe.ts                  # Aggiornato: gestisce acquisto gift card
scripts/
└── setup-collections.mjs              # Aggiornato: aggiunge campo type a products
```

---

## Task 1: Gift Card come Prodotto

Le gift card si vendono come normali prodotti con `type = 'gift_card'`. Ogni variante ha un importo fisso (es. €25, €50, €100). Il webhook le riconosce e crea automaticamente il codice in `gift_cards`.

- [ ] **Step 1.1: Aggiungi valore enum `gift_card` al campo `type` in Directus**

In Directus Admin → Collections → products → Campo `type` → Aggiungi scelta:
- Text: "Gift Card"
- Value: `gift_card`

- [ ] **Step 1.2: Aggiorna `src/lib/types.ts`** — estendi `ProductType`

```typescript
export type ProductType = 'physical' | 'digital' | 'gift_card';
```

- [ ] **Step 1.3: Crea `src/pages/gift-card.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import { getProducts, assetUrl } from '../lib/directus';

const giftCards = await getProducts();
const gcProducts = giftCards.filter(p => p.type === 'gift_card' && p.is_active);
---
<Base title="Gift Card">
  <div class="max-w-[var(--max-width)] mx-auto px-4 py-12">
    <div class="max-w-2xl mx-auto text-center">
      <h1 class="text-4xl font-bold mb-4">Gift Card</h1>
      <p class="text-[var(--color-muted)] text-lg mb-12">
        Il regalo perfetto. Scegli l'importo e invia il codice a chi vuoi.
      </p>
    </div>

    {gcProducts.map(product => (
      <div class="max-w-xl mx-auto bg-[var(--color-surface)] rounded-2xl p-8 mb-8">
        <h2 class="text-2xl font-bold mb-6">{product.name}</h2>

        <div class="mb-6">
          <p class="text-sm font-medium mb-3">Scegli l'importo</p>
          <div class="grid grid-cols-3 gap-3">
            {product.variants.filter(v => v.is_active).map((v, i) => (
              <button
                type="button"
                class={`gc-amount-btn py-3 px-4 border-2 rounded-lg font-bold text-lg transition-colors ${i === 0 ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white' : 'border-gray-200 hover:border-[var(--color-brand)]'}`}
                data-variant-id={v.id}
                data-price={v.price_override ?? product.base_price}
                data-sku={v.sku}
                data-name={v.name}
              >
                €{(v.price_override ?? product.base_price).toFixed(0)}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          id={`gc-add-${product.id}`}
          class="w-full py-4 bg-[var(--color-brand)] text-white rounded-xl font-bold text-lg hover:opacity-90"
          data-product-id={product.id}
          data-product-name={product.name}
        >
          Aggiungi al carrello
        </button>
        <p id={`gc-msg-${product.id}`} class="text-center text-sm text-[var(--color-success)] mt-3 hidden">✓ Aggiunto!</p>
      </div>
    ))}
  </div>
</Base>

<script>
  import { addToCart } from '../stores/cart';

  document.querySelectorAll<HTMLButtonElement>('.gc-amount-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.max-w-xl');
      parent?.querySelectorAll('.gc-amount-btn').forEach(b => {
        b.classList.remove('border-[var(--color-brand)]', 'bg-[var(--color-brand)]', 'text-white');
        b.classList.add('border-gray-200');
      });
      btn.classList.add('border-[var(--color-brand)]', 'bg-[var(--color-brand)]', 'text-white');
      btn.classList.remove('border-gray-200');
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[id^="gc-add-"]').forEach(addBtn => {
    addBtn.addEventListener('click', () => {
      const productId = addBtn.dataset.productId!;
      const parent = addBtn.closest('.max-w-xl')!;
      const selected = parent.querySelector<HTMLButtonElement>('.gc-amount-btn.bg-\\[var\\(--color-brand\\)\\]')
        ?? parent.querySelector<HTMLButtonElement>('.gc-amount-btn');

      if (!selected) return;

      addToCart({
        variantId: selected.dataset.variantId!,
        productId,
        productName: addBtn.dataset.productName!,
        variantName: selected.dataset.name!,
        sku: selected.dataset.sku!,
        price: Number(selected.dataset.price),
        quantity: 1,
        image: null,
        type: 'gift_card',
        weightG: 0,
      });

      const msg = document.getElementById(`gc-msg-${productId}`);
      msg?.classList.remove('hidden');
      setTimeout(() => msg?.classList.add('hidden'), 2000);
    });
  });
</script>
```

- [ ] **Step 1.4: Commit**

```bash
git add src/pages/gift-card.astro src/lib/types.ts
git commit -m "feat: add gift card product page"
```

---

## Task 2: Webhook — Generazione automatica codice gift card

Quando viene acquistata una gift card, il webhook deve creare il record in `gift_cards` e associarlo all'order item.

- [ ] **Step 2.1: Aggiorna `netlify/functions/webhook-stripe.ts`**

Nel loop `for (const li of lineItemsResult.data)`, dopo `createItem('order_items', ...)`, aggiungi:

```typescript
// Genera gift card se il prodotto è di tipo gift_card
const productType = variant.product_id?.type;
if (productType === 'gift_card') {
  const gcCode = randomUUID();
  const gcValue = unitPrice; // il valore della gift card = prezzo pagato

  await directus.request(
    createItem('gift_cards', {
      code: gcCode,
      initial_value: gcValue,
      remaining_value: gcValue,
      order_id: order.id,
      is_active: true,
      redemptions: [],
    })
  );

  // Aggiorna order_item con il codice gift card nel download_token
  // (riutilizziamo download_token come campo per il codice)
  // In alternativa aggiungere campo gift_card_code su order_items
  // Per semplicità, il codice viene inviato via email dal Flow Directus
}
```

- [ ] **Step 2.2: Commit**

```bash
git add netlify/functions/webhook-stripe.ts
git commit -m "feat: auto-generate gift card code on purchase in webhook"
```

---

## Task 3: Registrazione Account Post-Checkout

- [ ] **Step 3.1: Crea `src/pages/account/register.astro`**

```astro
---
export const prerender = false;
import Base from '../../layouts/Base.astro';
import { setAuthCookies } from '../../lib/auth';

let error = '';

if (Astro.request.method === 'POST') {
  const data = await Astro.request.formData();
  const email = data.get('email')?.toString() ?? '';
  const password = data.get('password')?.toString() ?? '';
  const firstName = data.get('first_name')?.toString() ?? '';
  const lastName = data.get('last_name')?.toString() ?? '';

  // Registra utente in Directus
  const regRes = await fetch(`${import.meta.env.DIRECTUS_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.DIRECTUS_TOKEN}`,
    },
    body: JSON.stringify({
      email,
      password,
      first_name: firstName,
      last_name: lastName,
      role: import.meta.env.DIRECTUS_CUSTOMER_ROLE_ID, // ID ruolo Customer
    }),
  });

  if (regRes.ok) {
    // Login automatico dopo registrazione
    const loginRes = await fetch(`${import.meta.env.DIRECTUS_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (loginRes.ok) {
      const { data: auth } = await loginRes.json();
      setAuthCookies(Astro.cookies, auth.access_token, auth.refresh_token, auth.expires);
      return Astro.redirect('/account');
    }
  } else {
    const err = await regRes.json();
    error = err.errors?.[0]?.message ?? 'Errore durante la registrazione';
  }
}
---
<Base title="Crea account">
  <div class="max-w-sm mx-auto px-4 py-20">
    <h1 class="text-2xl font-bold mb-8 text-center">Crea account</h1>
    {error && <p class="text-[var(--color-error)] text-sm mb-4 p-3 bg-red-50 rounded">{error}</p>}
    <form method="POST" class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium mb-1">Nome</label>
          <input type="text" name="first_name" class="w-full border rounded-[var(--radius)] px-3 py-2" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Cognome</label>
          <input type="text" name="last_name" class="w-full border rounded-[var(--radius)] px-3 py-2" />
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Email</label>
        <input type="email" name="email" required class="w-full border rounded-[var(--radius)] px-3 py-2" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Password</label>
        <input type="password" name="password" required minlength="8" class="w-full border rounded-[var(--radius)] px-3 py-2" />
      </div>
      <button type="submit" class="w-full py-3 bg-[var(--color-brand)] text-white rounded-[var(--radius)] font-medium">
        Crea account
      </button>
    </form>
    <p class="text-center text-sm text-[var(--color-muted)] mt-4">
      Hai già un account? <a href="/account/login" class="text-[var(--color-brand)]">Accedi</a>
    </p>
  </div>
</Base>
```

- [ ] **Step 3.2: Aggiungi `DIRECTUS_CUSTOMER_ROLE_ID` a `.env.example`**

```bash
# ID del ruolo Customer in Directus (Settings → Roles → Customer → copia UUID)
DIRECTUS_CUSTOMER_ROLE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

- [ ] **Step 3.3: Commit**

```bash
git add src/pages/account/register.astro .env.example
git commit -m "feat: add optional account registration flow"
```

---

## Task 4: Link Gift Card nel Header + Nav

- [ ] **Step 4.1: Aggiungi link Gift Card in `src/components/layout/Header.astro`**

```astro
<!-- aggiunge dopo il link "Negozio" -->
<a href="/gift-card">Gift Card</a>
```

- [ ] **Step 4.2: Esegui build**

```bash
npm run build
```

Expected: 0 errori.

- [ ] **Step 4.3: Commit**

```bash
git add src/components/layout/Header.astro
git commit -m "feat: add gift card link to navigation"
```

---

## Checklist Finale Piano 4

- [ ] `npm run build` — 0 errori
- [ ] Pagina `/gift-card` mostra importi selezionabili
- [ ] Gift card aggiungibile al carrello e acquistabile via Stripe
- [ ] Dopo acquisto: record creato in `gift_cards` con codice UUID
- [ ] Registrazione account funziona e logga automaticamente l'utente
- [ ] Commit finale con tag `v0.4.0-commerce`

```bash
git tag v0.4.0-commerce
```

---

**Prossimo piano:** [Piano 5 — i18n & Security](2026-05-03-ecommerce-plan-5-i18n-security.md)
