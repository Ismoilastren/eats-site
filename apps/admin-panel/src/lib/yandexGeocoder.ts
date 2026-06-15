'use client';

import { isReadableAddress, isValidCoordinates } from '@repo/shared-types';

type ApiResponse = {
  ok?: boolean;
  results?: {
    response?: {
      GeoObjectCollection?: {
        featureMember?: Array<{
          GeoObject?: {
            name?: string;
            description?: string;
            metaDataProperty?: { GeocoderMetaData?: { text?: string } };
          };
        }>;
      };
    };
  };
  error?: string;
  errorCode?: string;
};

export type AdminGeocodeResult = {
  address: string;
  error?: string;
  errorCode?: string;
};

export async function reverseGeocodeRestaurant(lat: number, lng: number): Promise<AdminGeocodeResult> {
  if (!isValidCoordinates(lat, lng)) {
    return { address: '', error: 'Valid coordinates are required.', errorCode: 'INVALID_COORDINATES' };
  }

  try {
    const response = await fetch(`/api/geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`);
    const data = await response.json() as ApiResponse;
    if (!response.ok || !data.ok) {
      return {
        address: '',
        error: data.error || 'Address lookup failed.',
        errorCode: data.errorCode || 'YANDEX_GEOCODER_REJECTED',
      };
    }

    const geoObject = data.results?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
    const address = geoObject?.metaDataProperty?.GeocoderMetaData?.text?.trim()
      || [geoObject?.name, geoObject?.description].filter(Boolean).join(', ');

    return isReadableAddress(address)
      ? { address }
      : { address: '', error: 'Yandex Geocoder did not return a readable address.', errorCode: 'ADDRESS_NOT_RESOLVED' };
  } catch {
    return {
      address: '',
      error: 'Could not reach the admin geocoder endpoint.',
      errorCode: 'YANDEX_GEOCODER_UNAVAILABLE',
    };
  }
}
