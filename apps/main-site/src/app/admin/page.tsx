import Link from 'next/link';
import { ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react';

export default function AdminEntryPage() {
  return (
    <main className="min-h-screen bg-[#f6f6f3] px-4 py-10 text-gray-950">
      <section className="mx-auto max-w-3xl rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-black/5">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-3 font-black"
        >
          <ArrowLeft size={18} />
          Customer site
        </Link>

        <div className="mt-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-950 text-white">
          <ShieldCheck size={32} />
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-[0.28em] text-orange-500">
          Admin operations
        </p>
        <h1 className="mt-2 text-4xl font-black">Open the production admin panel</h1>
        <p className="mt-4 text-lg font-bold leading-8 text-gray-500">
          The customer website no longer contains a separate embedded admin
          dashboard. Restaurants, catalog, couriers, orders, users, reports, and
          settings are managed from the dedicated Firestore-backed 2(13) admin
          panel.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <a
            href="https://eats-adminn.vercel.app"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-950 px-5 py-4 font-black text-white"
          >
            Open admin panel
            <ExternalLink size={18} />
          </a>
          <Link
            href="/orders"
            className="inline-flex items-center justify-center rounded-2xl bg-yellow-300 px-5 py-4 font-black text-gray-950"
          >
            View customer orders
          </Link>
        </div>
      </section>
    </main>
  );
}
