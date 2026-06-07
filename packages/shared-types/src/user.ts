// =============================================
// USER TYPES
// =============================================

export type UserRole = 'client' | 'courier' | 'restaurant' | 'admin' | 'superadmin';

export interface Address {
  id: string;
  label: string; // "Home", "Work", etc.
  street: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
}

export interface User {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  photoURL: string;
  role: UserRole;
  savedAddresses: Address[];
  createdAt: Date;
  updatedAt: Date;
}
