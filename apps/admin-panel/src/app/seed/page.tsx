export default function SeedPage() {
  return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="max-w-lg space-y-4 rounded-xl bg-white p-8 text-center shadow-sm dark:bg-gray-800">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-500">
          Data safety
        </p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Data seeding is disabled
        </h1>
        <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-left text-sm font-semibold text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
          This production admin panel uses live Firestore workflows for users,
          restaurants, couriers, and orders. Bulk fixture injection is not
          available from the UI.
        </div>
      </div>
    </div>
  );
}
