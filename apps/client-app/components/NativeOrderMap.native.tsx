import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import type { NormalizedCoordinate } from '@repo/shared-types';
import { missingYandexMapsKeyMessage, publicYandexMapsApiKey } from '../services/addressing';

interface NativeOrderMapProps {
  restaurant: NormalizedCoordinate;
  customer: NormalizedCoordinate;
  courier?: NormalizedCoordinate | null;
  restaurantName: string;
  customerAddress: string;
  courierName?: string;
  vehicleIcon: string;
}

const safeScriptJson = (value: unknown) =>
  JSON.stringify(value).replace(/<\/script/gi, '<\\/script');

function yandexOrderMapHTML({
  apiKey,
  restaurant,
  customer,
  courier,
  restaurantName,
  customerAddress,
  courierName,
}: NativeOrderMapProps & { apiKey: string }) {
  const points = [
    {
      id: 'restaurant',
      title: 'Restaurant',
      description: restaurantName,
      lat: restaurant.latitude,
      lng: restaurant.longitude,
      color: '#2563eb',
      icon: 'R',
    },
    {
      id: 'customer',
      title: 'Customer',
      description: customerAddress,
      lat: customer.latitude,
      lng: customer.longitude,
      color: '#16a34a',
      icon: 'C',
    },
    ...(courier
      ? [{
          id: 'courier',
          title: 'Courier',
          description: courierName || 'Courier',
          lat: courier.latitude,
          lng: courier.longitude,
          color: '#f97316',
          icon: 'D',
        }]
      : []),
  ];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #e5e7eb; }
    .pin {
      width: 34px; height: 34px; border-radius: 17px; border: 3px solid white;
      color: white; display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 900;
      box-shadow: 0 8px 20px rgba(0,0,0,0.25);
    }
    .route-note {
      position: absolute; left: 10px; right: 10px; bottom: 10px; z-index: 10;
      border-radius: 12px; background: rgba(17,24,39,0.88); color: white;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px;
      font-weight: 800; text-align: center; padding: 8px 10px;
    }
  </style>
  <script src="https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=en_RU" type="text/javascript"></script>
</head>
<body>
  <div id="map"></div>
  <div class="route-note">Route preview only. Live road routing is unavailable.</div>
  <script>
    var points = ${safeScriptJson(points)};
    function init() {
      var map = new ymaps.Map('map', {
        center: [${customer.latitude}, ${customer.longitude}],
        zoom: 13,
        controls: []
      });

      points.forEach(function(point) {
        var marker = new ymaps.Placemark(
          [point.lat, point.lng],
          { balloonContentHeader: point.title, balloonContentBody: point.description },
          {
            iconLayout: ymaps.templateLayoutFactory.createClass(
              '<div class="pin" style="background:' + point.color + '">' + point.icon + '</div>'
            ),
            iconShape: { type: 'Circle', coordinates: [17, 17], radius: 18 },
            iconOffset: [-17, -17]
          }
        );
        map.geoObjects.add(marker);
      });

      var route = new ymaps.Polyline(
        [[${restaurant.latitude}, ${restaurant.longitude}], [${customer.latitude}, ${customer.longitude}]],
        {},
        { strokeColor: '#f97316', strokeWidth: 5, strokeStyle: 'shortdash' }
      );
      map.geoObjects.add(route);

      if (points.length > 1) {
        map.setBounds(map.geoObjects.getBounds(), {
          checkZoomRange: true,
          zoomMargin: [38, 38, 38, 38]
        });
      }
    }
    if (window.ymaps) ymaps.ready(init);
  </script>
</body>
</html>
`;
}

export default function NativeOrderMap(props: NativeOrderMapProps) {
  const apiKey = publicYandexMapsApiKey();
  const html = useMemo(() => apiKey ? yandexOrderMapHTML({ ...props, apiKey }) : '', [
    apiKey,
    props.restaurant.latitude,
    props.restaurant.longitude,
    props.customer.latitude,
    props.customer.longitude,
    props.courier?.latitude,
    props.courier?.longitude,
    props.restaurantName,
    props.customerAddress,
    props.courierName,
  ]);

  if (!apiKey) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100 px-6">
        <Ionicons name="map-outline" size={48} color="#9ca3af" />
        <Text className="mt-3 text-center font-bold text-gray-500">
          {missingYandexMapsKeyMessage()}
        </Text>
      </View>
    );
  }

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      scrollEnabled={false}
      bounces={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={{ flex: 1, backgroundColor: '#e5e7eb' }}
    />
  );
}
