export type MarketplaceDataSource = 'mock' | 'firestore';

const configuredDataSource = process.env.NEXT_PUBLIC_MARKETPLACE_DATA_SOURCE;

export const MARKETPLACE_DATA_SOURCE: MarketplaceDataSource =
  configuredDataSource === 'mock'
    ? 'mock'
    : configuredDataSource === 'firestore' || process.env.NODE_ENV === 'production'
      ? 'firestore'
      : 'mock';

export const isFirestoreDataSource = () => MARKETPLACE_DATA_SOURCE === 'firestore';

export const MOCK_CUSTOMER_ID = 'mock-customer';
