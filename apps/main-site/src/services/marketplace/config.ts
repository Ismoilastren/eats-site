export type MarketplaceDataSource = 'mock' | 'firestore';

const configuredDataSource = process.env.NEXT_PUBLIC_MARKETPLACE_DATA_SOURCE;

function isLocalDevelopment() {
  const isNodeDev = process.env.NODE_ENV !== 'production';
  if (typeof window !== 'undefined') {
    return isNodeDev && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  }
  return isNodeDev && !process.env.VERCEL_URL && !process.env.VERCEL;
}

export const MARKETPLACE_DATA_SOURCE: MarketplaceDataSource =
  isLocalDevelopment() && configuredDataSource === 'mock'
    ? 'mock'
    : 'firestore';

export const isFirestoreDataSource = () => MARKETPLACE_DATA_SOURCE === 'firestore';

export const MOCK_CUSTOMER_ID = 'mock-customer';
