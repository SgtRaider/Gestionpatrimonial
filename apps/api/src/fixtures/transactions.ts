import type { Category, TransactionListItem } from '@gp/shared';

// Stable UUIDs (v7-shaped, hand-written so they're deterministic across reloads).
const ID = {
  // institutions
  bbva: '01951b00-1000-7000-8000-000000000101',
  cre: '01951b00-1000-7000-8000-000000000102',
  wise: '01951b00-1000-7000-8000-000000000103',
  myinvestor: '01951b00-1000-7000-8000-000000000104',
  // accounts
  bbvaChecking: '01951b00-2000-7000-8000-000000000201',
  bbvaCard: '01951b00-2000-7000-8000-000000000202',
  creChecking: '01951b00-2000-7000-8000-000000000203',
  wiseEur: '01951b00-2000-7000-8000-000000000204',
  myInvCash: '01951b00-2000-7000-8000-000000000205',
  // category roots
  catVivienda: '01951b00-3000-7000-8000-000000000301',
  catAliment: '01951b00-3000-7000-8000-000000000302',
  catTransporte: '01951b00-3000-7000-8000-000000000303',
  catOcio: '01951b00-3000-7000-8000-000000000304',
  catSalud: '01951b00-3000-7000-8000-000000000305',
  catIngresos: '01951b00-3000-7000-8000-000000000306',
  // category children
  catHipotecaCapital: '01951b00-3000-7000-8000-000000000311',
  catHipotecaIntereses: '01951b00-3000-7000-8000-000000000312',
  catSuministros: '01951b00-3000-7000-8000-000000000313',
  catSuper: '01951b00-3000-7000-8000-000000000321',
  catRestaurantes: '01951b00-3000-7000-8000-000000000322',
  catCombustible: '01951b00-3000-7000-8000-000000000331',
  catStreaming: '01951b00-3000-7000-8000-000000000341',
  catNomina: '01951b00-3000-7000-8000-000000000361',
} as const;

export const institutionsFixture = [
  { id: ID.bbva, name: 'BBVA', type: 'bank' as const, color: '#004481', country: 'ES' },
  {
    id: ID.cre,
    name: 'Caja Rural Extremadura',
    type: 'bank' as const,
    color: '#009639',
    country: 'ES',
  },
  { id: ID.wise, name: 'Wise', type: 'bank' as const, color: '#9fe870', country: 'ES' },
  {
    id: ID.myinvestor,
    name: 'MyInvestor',
    type: 'broker' as const,
    color: '#ff6b00',
    country: 'ES',
  },
];

export const accountsFixture = [
  {
    id: ID.bbvaChecking,
    institutionId: ID.bbva,
    name: 'Cuenta nómina',
    type: 'checking',
    currency: 'EUR',
    ibanLast4: '4521',
    isActive: true,
  },
  {
    id: ID.bbvaCard,
    institutionId: ID.bbva,
    name: 'Tarjeta crédito',
    type: 'checking',
    currency: 'EUR',
    ibanLast4: '8842',
    isActive: true,
  },
  {
    id: ID.creChecking,
    institutionId: ID.cre,
    name: 'Cuenta corriente',
    type: 'checking',
    currency: 'EUR',
    ibanLast4: '1234',
    isActive: true,
  },
  {
    id: ID.wiseEur,
    institutionId: ID.wise,
    name: 'Wise EUR',
    type: 'checking',
    currency: 'EUR',
    ibanLast4: '7766',
    isActive: true,
  },
  {
    id: ID.myInvCash,
    institutionId: ID.myinvestor,
    name: 'MyInvestor CC',
    type: 'checking',
    currency: 'EUR',
    ibanLast4: '5511',
    isActive: true,
  },
];

export const categoriesFixture: Category[] = [
  {
    id: ID.catVivienda,
    parentId: null,
    name: 'Vivienda',
    kind: 'expense',
    color: '#f59e0b',
    iconKey: 'home',
  },
  {
    id: ID.catHipotecaCapital,
    parentId: ID.catVivienda,
    name: 'Hipoteca (capital)',
    kind: 'expense',
    color: '#f59e0b',
    iconKey: 'home',
  },
  {
    id: ID.catHipotecaIntereses,
    parentId: ID.catVivienda,
    name: 'Hipoteca (intereses)',
    kind: 'expense',
    color: '#f59e0b',
    iconKey: 'home',
  },
  {
    id: ID.catSuministros,
    parentId: ID.catVivienda,
    name: 'Suministros',
    kind: 'expense',
    color: '#f59e0b',
    iconKey: 'zap',
  },
  {
    id: ID.catAliment,
    parentId: null,
    name: 'Alimentación',
    kind: 'expense',
    color: '#10b981',
    iconKey: 'shopping-cart',
  },
  {
    id: ID.catSuper,
    parentId: ID.catAliment,
    name: 'Supermercado',
    kind: 'expense',
    color: '#10b981',
    iconKey: 'shopping-cart',
  },
  {
    id: ID.catRestaurantes,
    parentId: ID.catAliment,
    name: 'Restaurantes',
    kind: 'expense',
    color: '#10b981',
    iconKey: 'utensils',
  },
  {
    id: ID.catTransporte,
    parentId: null,
    name: 'Transporte',
    kind: 'expense',
    color: '#3b82f6',
    iconKey: 'car',
  },
  {
    id: ID.catCombustible,
    parentId: ID.catTransporte,
    name: 'Combustible',
    kind: 'expense',
    color: '#3b82f6',
    iconKey: 'fuel',
  },
  {
    id: ID.catOcio,
    parentId: null,
    name: 'Ocio',
    kind: 'expense',
    color: '#a855f7',
    iconKey: 'film',
  },
  {
    id: ID.catStreaming,
    parentId: ID.catOcio,
    name: 'Streaming',
    kind: 'expense',
    color: '#a855f7',
    iconKey: 'film',
  },
  {
    id: ID.catSalud,
    parentId: null,
    name: 'Salud',
    kind: 'expense',
    color: '#ec4899',
    iconKey: 'heart',
  },
  {
    id: ID.catIngresos,
    parentId: null,
    name: 'Ingresos',
    kind: 'income',
    color: '#16a34a',
    iconKey: 'briefcase',
  },
  {
    id: ID.catNomina,
    parentId: ID.catIngresos,
    name: 'Nómina',
    kind: 'income',
    color: '#16a34a',
    iconKey: 'briefcase',
  },
];

const categoryById = new Map(categoriesFixture.map((c) => [c.id, c]));

function institutionById(id: string) {
  const ins = institutionsFixture.find((i) => i.id === id);
  if (!ins) throw new Error(`Unknown institution ${id}`);
  return ins;
}
function accountById(id: string) {
  const a = accountsFixture.find((acc) => acc.id === id);
  if (!a) throw new Error(`Unknown account ${id}`);
  return a;
}

type RawTx = {
  date: string;
  accountId: string;
  amount: string;
  description: string;
  counterparty?: string;
  merchant?: string;
  categoryId?: string | null;
  status?: 'booked' | 'pending';
  source?: 'psd2' | 'csv' | 'manual';
  transferPairId?: string | null;
  recurringRuleId?: string | null;
  notes?: string | null;
  tags?: string[];
};

const transferPair1 = '01951b00-4000-7000-8000-0000000000a1';
const transferPair2 = '01951b00-4000-7000-8000-0000000000a2';
const recurringNetflix = '01951b00-5000-7000-8000-000000000051';
const recurringSpotify = '01951b00-5000-7000-8000-000000000052';
const recurringHipoteca = '01951b00-5000-7000-8000-000000000053';
const recurringNomina = '01951b00-5000-7000-8000-000000000054';

const raw: RawTx[] = [
  // May 2026
  {
    date: '2026-05-04',
    accountId: ID.bbvaChecking,
    amount: '-47.82',
    description: 'COMPRA EN MERCADONA CACERES',
    counterparty: 'MERCADONA',
    merchant: 'Mercadona',
    categoryId: ID.catSuper,
    tags: ['comida'],
  },
  {
    date: '2026-05-04',
    accountId: ID.creChecking,
    amount: '-20.00',
    description: 'BIZUM ENVIADO Juan G.',
    counterparty: 'Juan G.',
    categoryId: null,
  },
  {
    date: '2026-05-03',
    accountId: ID.bbvaCard,
    amount: '-89.99',
    description: 'AMAZON ES MARKETPLACE',
    counterparty: 'AMAZON.ES',
    merchant: 'Amazon',
    categoryId: null,
    notes: 'Producto sin clasificar',
  },
  {
    date: '2026-05-02',
    accountId: ID.wiseEur,
    amount: '2450.00',
    description: 'EMPLEADOR SA NOMINA MAYO',
    counterparty: 'EMPLEADOR SA',
    merchant: 'Empleador SA',
    categoryId: ID.catNomina,
    recurringRuleId: recurringNomina,
    source: 'psd2',
  },
  {
    date: '2026-05-01',
    accountId: ID.myInvCash,
    amount: '-500.00',
    description: 'TRASPASO A BBVA 4521',
    counterparty: 'BBVA',
    categoryId: null,
    transferPairId: transferPair1,
  },
  {
    date: '2026-05-01',
    accountId: ID.bbvaChecking,
    amount: '500.00',
    description: 'TRASPASO DESDE MyINVESTOR',
    counterparty: 'MyInvestor',
    categoryId: null,
    transferPairId: transferPair1,
  },
  {
    date: '2026-04-30',
    accountId: ID.bbvaCard,
    amount: '-13.99',
    description: 'NETFLIX.COM',
    counterparty: 'NETFLIX',
    merchant: 'Netflix',
    categoryId: ID.catStreaming,
    recurringRuleId: recurringNetflix,
  },
  {
    date: '2026-04-29',
    accountId: ID.bbvaChecking,
    amount: '-200.00',
    description: 'CAJERO RETIRADA',
    counterparty: 'CAJERO',
    categoryId: null,
    status: 'pending',
  },
  {
    date: '2026-04-28',
    accountId: ID.bbvaCard,
    amount: '-23.40',
    description: 'COMPRA TARJETA 23,40',
    counterparty: '?',
    categoryId: null,
  },
  {
    date: '2026-04-28',
    accountId: ID.creChecking,
    amount: '-65.20',
    description: 'IBERDROLA RECIBO',
    counterparty: 'IBERDROLA',
    merchant: 'Iberdrola',
    categoryId: ID.catSuministros,
    tags: ['luz'],
  },
  {
    date: '2026-04-26',
    accountId: ID.bbvaChecking,
    amount: '-32.50',
    description: 'REPSOL E.S.',
    counterparty: 'REPSOL',
    merchant: 'Repsol',
    categoryId: ID.catCombustible,
  },
  {
    date: '2026-04-25',
    accountId: ID.bbvaCard,
    amount: '-58.90',
    description: 'CARREFOUR EXP',
    counterparty: 'CARREFOUR',
    merchant: 'Carrefour',
    categoryId: ID.catSuper,
  },
  {
    date: '2026-04-24',
    accountId: ID.creChecking,
    amount: '-42.00',
    description: 'RESTAURANTE LA CAJA',
    counterparty: 'LA CAJA',
    merchant: 'La Caja',
    categoryId: ID.catRestaurantes,
    tags: ['cena'],
  },
  {
    date: '2026-04-22',
    accountId: ID.bbvaCard,
    amount: '-10.99',
    description: 'SPOTIFY P0123F',
    counterparty: 'SPOTIFY',
    merchant: 'Spotify',
    categoryId: ID.catStreaming,
    recurringRuleId: recurringSpotify,
  },
  {
    date: '2026-04-20',
    accountId: ID.bbvaCard,
    amount: '-19.99',
    description: 'AMAZON PRIME',
    counterparty: 'AMAZON PRIME',
    merchant: 'Amazon Prime',
    categoryId: ID.catStreaming,
  },
  {
    date: '2026-04-18',
    accountId: ID.bbvaChecking,
    amount: '-612.40',
    description: 'CUOTA HIPOTECA',
    counterparty: 'BBVA HIPOTECA',
    categoryId: ID.catHipotecaCapital,
    recurringRuleId: recurringHipoteca,
    notes: 'Capital + intereses (separar en split)',
  },
  {
    // Real BBVA mortgage payment — matches the schedule at €990.85 so the
    // matcher demos ✓ on the recent period.
    date: '2026-04-15',
    accountId: ID.bbvaChecking,
    amount: '-990.85',
    description: 'AMORTIZACIÓN HIPOTECA BBVA',
    counterparty: 'BBVA HIPOTECA',
    categoryId: ID.catHipotecaCapital,
  },
  {
    date: '2026-04-16',
    accountId: ID.bbvaChecking,
    amount: '-24.99',
    description: 'CHATGPT SUBSCRIPTION',
    counterparty: 'OPENAI',
    merchant: 'OpenAI',
    categoryId: null,
  },
  {
    date: '2026-04-15',
    accountId: ID.creChecking,
    amount: '-87.40',
    description: 'LIDL',
    counterparty: 'LIDL',
    merchant: 'Lidl',
    categoryId: ID.catSuper,
  },
  {
    date: '2026-04-14',
    accountId: ID.bbvaCard,
    amount: '-15.50',
    description: 'CINESA TARJETA',
    counterparty: 'CINESA',
    merchant: 'Cinesa',
    categoryId: ID.catOcio,
  },
  {
    date: '2026-04-12',
    accountId: ID.bbvaChecking,
    amount: '-45.00',
    description: 'FARMACIA CENTRAL',
    counterparty: 'FARMACIA',
    merchant: 'Farmacia',
    categoryId: ID.catSalud,
  },
  {
    date: '2026-04-10',
    accountId: ID.bbvaChecking,
    amount: '-18.20',
    description: 'BIZUM RECIBIDO María L.',
    counterparty: 'María L.',
    categoryId: null,
  },
  {
    date: '2026-04-08',
    accountId: ID.bbvaCard,
    amount: '-39.95',
    description: 'MERCADONA SA 4521',
    counterparty: 'MERCADONA',
    merchant: 'Mercadona',
    categoryId: ID.catSuper,
  },
  {
    date: '2026-04-05',
    accountId: ID.creChecking,
    amount: '-145.00',
    description: 'COMUNIDAD VECINOS',
    counterparty: 'COMUNIDAD',
    categoryId: ID.catVivienda,
    tags: ['comunidad'],
  },
  {
    date: '2026-04-02',
    accountId: ID.wiseEur,
    amount: '2450.00',
    description: 'EMPLEADOR SA NOMINA ABRIL',
    counterparty: 'EMPLEADOR SA',
    merchant: 'Empleador SA',
    categoryId: ID.catNomina,
    recurringRuleId: recurringNomina,
    source: 'psd2',
  },
  {
    date: '2026-04-01',
    accountId: ID.bbvaChecking,
    amount: '-500.00',
    description: 'TRASPASO A MyINVESTOR',
    counterparty: 'MyInvestor',
    categoryId: null,
    transferPairId: transferPair2,
  },
  {
    date: '2026-04-01',
    accountId: ID.myInvCash,
    amount: '500.00',
    description: 'TRASPASO DESDE BBVA 4521',
    counterparty: 'BBVA',
    categoryId: null,
    transferPairId: transferPair2,
  },
  {
    date: '2026-03-30',
    accountId: ID.bbvaCard,
    amount: '-13.99',
    description: 'NETFLIX.COM',
    counterparty: 'NETFLIX',
    merchant: 'Netflix',
    categoryId: ID.catStreaming,
    recurringRuleId: recurringNetflix,
  },
  {
    date: '2026-03-28',
    accountId: ID.bbvaChecking,
    amount: '-31.40',
    description: 'REPSOL E.S.',
    counterparty: 'REPSOL',
    merchant: 'Repsol',
    categoryId: ID.catCombustible,
  },
  {
    date: '2026-03-25',
    accountId: ID.creChecking,
    amount: '-58.10',
    description: 'IBERDROLA RECIBO',
    counterparty: 'IBERDROLA',
    merchant: 'Iberdrola',
    categoryId: ID.catSuministros,
    tags: ['luz'],
  },
  {
    date: '2026-03-22',
    accountId: ID.bbvaCard,
    amount: '-10.99',
    description: 'SPOTIFY P0123F',
    counterparty: 'SPOTIFY',
    merchant: 'Spotify',
    categoryId: ID.catStreaming,
    recurringRuleId: recurringSpotify,
  },
  {
    date: '2026-03-18',
    accountId: ID.bbvaChecking,
    amount: '-612.40',
    description: 'CUOTA HIPOTECA',
    counterparty: 'BBVA HIPOTECA',
    categoryId: ID.catHipotecaCapital,
    recurringRuleId: recurringHipoteca,
  },
  {
    date: '2026-03-20',
    accountId: ID.wiseEur,
    amount: '-250.00',
    description: 'Wise transfer to BBVA',
    counterparty: 'BBVA',
    categoryId: null,
  },
  {
    date: '2026-03-20',
    accountId: ID.bbvaChecking,
    amount: '250.00',
    description: 'Transferencia desde Wise',
    counterparty: 'Wise',
    categoryId: null,
  },
  {
    date: '2026-03-15',
    accountId: ID.bbvaChecking,
    amount: '-990.85',
    description: 'AMORTIZACIÓN HIPOTECA BBVA',
    counterparty: 'BBVA HIPOTECA',
    categoryId: ID.catHipotecaCapital,
  },
  {
    date: '2026-02-25',
    accountId: ID.creChecking,
    amount: '-71.40',
    description: 'IBERDROLA RECIBO',
    counterparty: 'IBERDROLA',
    merchant: 'Iberdrola',
    categoryId: ID.catSuministros,
    tags: ['luz'],
  },
  {
    date: '2026-02-15',
    accountId: ID.bbvaChecking,
    amount: '-990.85',
    description: 'AMORTIZACIÓN HIPOTECA BBVA',
    counterparty: 'BBVA HIPOTECA',
    categoryId: ID.catHipotecaCapital,
  },
  {
    date: '2026-01-25',
    accountId: ID.creChecking,
    amount: '-52.30',
    description: 'IBERDROLA RECIBO',
    counterparty: 'IBERDROLA',
    merchant: 'Iberdrola',
    categoryId: ID.catSuministros,
    tags: ['luz'],
  },
  {
    date: '2026-01-15',
    accountId: ID.bbvaChecking,
    amount: '-990.85',
    description: 'AMORTIZACIÓN HIPOTECA BBVA',
    counterparty: 'BBVA HIPOTECA',
    categoryId: ID.catHipotecaCapital,
  },
  {
    date: '2026-03-15',
    accountId: ID.bbvaCard,
    amount: '-72.30',
    description: 'MERCADONA',
    counterparty: 'MERCADONA',
    merchant: 'Mercadona',
    categoryId: ID.catSuper,
  },
  {
    date: '2026-03-10',
    accountId: ID.creChecking,
    amount: '-38.50',
    description: 'CENA BAR ASUR',
    counterparty: 'BAR ASUR',
    merchant: 'Bar Asur',
    categoryId: ID.catRestaurantes,
    tags: ['cena'],
  },
];

let _items: TransactionListItem[] | null = null;

export function getTransactionsFixture(): TransactionListItem[] {
  if (_items) return _items;

  const items = raw.map((r, idx) => {
    const account = accountById(r.accountId);
    const institution = institutionById(account.institutionId);
    const category = r.categoryId ? (categoryById.get(r.categoryId) ?? null) : null;
    const txId = `01951b00-7000-7000-8000-${String(idx).padStart(12, '0')}`;
    const bookedAt = `${r.date}T10:00:00.000Z`;

    return {
      id: txId,
      accountId: r.accountId,
      bookedAt,
      valueAt: bookedAt,
      amount: r.amount,
      currency: account.currency,
      amountBaseCurrency: r.amount,
      descriptionRaw: r.description,
      counterparty: r.counterparty ?? null,
      normalizedMerchant: r.merchant ?? null,
      merchantAliasUser: null,
      categoryId: r.categoryId ?? null,
      status: r.status ?? 'booked',
      source: r.source ?? 'manual',
      transferPairId: r.transferPairId ?? null,
      parentTransactionId: null,
      recurringRuleId: r.recurringRuleId ?? null,
      notes: r.notes ?? null,
      isProjection: false,
      accountName: account.name,
      accountIbanLast4: account.ibanLast4 ?? null,
      institutionName: institution.name,
      institutionColor: institution.color ?? null,
      category,
      tags: r.tags ?? [],
    } satisfies TransactionListItem;
  });

  // Sort by booked_at desc
  items.sort((a, b) => b.bookedAt.localeCompare(a.bookedAt));
  _items = items;
  return items;
}
