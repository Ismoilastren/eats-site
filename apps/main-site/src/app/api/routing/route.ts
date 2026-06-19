import { NextRequest, NextResponse } from 'next/server';
import { buildFallbackRoute, normalizeRoutePoint } from '@repo/shared-types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const restaurant = normalizeRoutePoint(body.restaurant);
    const customer = normalizeRoutePoint(body.customer);
    const courier = normalizeRoutePoint(body.courier);

    if (!restaurant || !customer) {
      return NextResponse.json({
        error: 'Valid restaurant and customer coordinates are required.',
        source: 'fallback_preview',
      }, { status: 400 });
    }

    const routingKey = process.env.YANDEX_ROUTING_API_KEY;
    if (!routingKey) {
      return NextResponse.json(buildFallbackRoute({ restaurant, customer, courier }));
    }

    // The app deliberately does not pretend fallback geometry is a road route.
    // Wire the provider-specific Yandex routing endpoint here once the paid
    // routing API and endpoint contract are enabled for this project.
    return NextResponse.json({
      ...buildFallbackRoute({ restaurant, customer, courier }),
      error: 'YANDEX_ROUTING_API_KEY is present, but provider endpoint integration is not enabled in this build.',
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Routing request failed.',
      source: 'fallback_preview',
    }, { status: 500 });
  }
}
