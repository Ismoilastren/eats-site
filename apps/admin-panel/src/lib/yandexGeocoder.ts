'use client';

import { isReadableAddress, isValidCoordinates } from '@repo/shared-types';

type ApiResponse = {
  ok?: boolean;
  address?: string;
  provider?: string;
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

function geocoderErrorMessage(code: string) {
  switch (code) {
    case 'YANDEX_GEOCODER_API_KEY_MISSING':
      return 'Automatic address lookup is not configured.';
    case 'YANDEX_GEOCODER_FORBIDDEN':
      return 'Automatic address lookup is not enabled for this key.';
    case 'YANDEX_GEOCODER_TIMEOUT':
      return 'Automatic address lookup took too long.';
    case 'YANDEX_GEOCODER_UNAVAILABLE':
      return 'Automatic address lookup is temporarily unavailable.';
    default:
      return 'Address lookup failed.';
  }
}

export async function reverseGeocodeRestaurant(lat: number, lng: number): Promise<AdminGeocodeResult> {
  if (!isValidCoordinates(lat, lng)) {
    return { address: '', error: 'Valid coordinates are required.', errorCode: 'INVALID_COORDINATES' };
  }

  try {
    const response = await fetch(`/api/geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`);
    const data = await response.json() as ApiResponse;
    if (!response.ok || !data.ok) {
      const errorCode = data.errorCode || data.error || 'YANDEX_GEOCODER_REJECTED';
      return {
        address: '',
        error: geocoderErrorMessage(errorCode),
        errorCode,
      };
    }

    const geoObject = data.results?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
    const address = data.address?.trim()
      || geoObject?.metaDataProperty?.GeocoderMetaData?.text?.trim()
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
