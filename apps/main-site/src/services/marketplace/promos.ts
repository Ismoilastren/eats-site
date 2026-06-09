import { collection, db, getDocs, type DocumentData } from '@repo/firebase-config';
import { Promo, promos as mockPromos } from '@/data/marketplace';
import { isFirestoreDataSource } from './config';

function mapFirestorePromo(data: DocumentData, id: string): Promo {
  const type = data.type === 'freeDelivery' || data.type === 'gift' || data.type === 'percent' ? data.type : 'percent';
  return {
    code: String(data.code || id),
    title: String(data.title || data.code || id),
    description: String(data.description || ''),
    type,
    value: Number(data.value || 0),
  };
}

export async function getPromos(): Promise<Promo[]> {
  if (!isFirestoreDataSource()) return mockPromos;

  const snapshot = await getDocs(collection(db, 'promos'));
  return snapshot.docs
    .map((promoDoc) => mapFirestorePromo(promoDoc.data(), promoDoc.id))
    .filter((promo) => promo.code);
}
