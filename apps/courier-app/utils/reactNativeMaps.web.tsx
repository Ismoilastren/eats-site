import React from 'react';
import { View, Text } from 'react-native';

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

type MapViewProps = React.PropsWithChildren<{
  style?: unknown;
  initialRegion?: Region;
  region?: Region;
}>;

type MarkerProps = React.PropsWithChildren<{
  coordinate: Coordinate;
  title?: string;
  description?: string;
}>;

type PolylineProps = {
  coordinates?: Coordinate[];
  strokeColor?: string;
};

export function Marker({ children, title, coordinate }: MarkerProps) {
  return (
    <View style={{ alignItems: 'center', margin: 4 }}>
      {children}
      <Text style={{ color: '#0f172a', fontSize: 10, fontWeight: '700' }} numberOfLines={1}>
        {title || `${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)}`}
      </Text>
    </View>
  );
}

export function Polyline({ coordinates = [], strokeColor = '#f97316' }: PolylineProps) {
  if (coordinates.length < 2) return null;

  return (
    <View
      style={{
        height: 4,
        alignSelf: 'stretch',
        marginVertical: 8,
        borderRadius: 999,
        backgroundColor: strokeColor,
        opacity: 0.85,
      }}
    />
  );
}

export default function MapView({ children, style, region, initialRegion }: MapViewProps) {
  const activeRegion = region || initialRegion;

  return (
    <View
      style={[
        {
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#e2e8f0',
          padding: 16,
        },
        style as object,
      ]}
    >
      <Text style={{ marginBottom: 8, color: '#0f172a', fontSize: 12, fontWeight: '800' }}>
        Web map preview
      </Text>
      {activeRegion ? (
        <Text style={{ marginBottom: 8, color: '#475569', fontSize: 10, fontWeight: '700' }}>
          {activeRegion.latitude.toFixed(4)}, {activeRegion.longitude.toFixed(4)}
        </Text>
      ) : null}
      <View style={{ width: '100%', alignItems: 'center' }}>{children}</View>
    </View>
  );
}
