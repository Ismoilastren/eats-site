'use client';

import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { db, collection, getDocs, query, orderBy, limit } from '@repo/firebase-config';
import { formatFirestoreDate } from '@repo/shared-types';

type AuditLogRow = {
  id: string;
  actorEmail?: string;
  actorName?: string;
  actorRole?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  source?: string;
  userAgent?: string;
  createdAt?: unknown;
};

function toCsvValue(value: unknown) {
  const text = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(toCsvValue).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actorFilter, setActorFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [entityIdFilter, setEntityIdFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<AuditLogRow | null>(null);
  const [loadError, setLoadError] = useState('');

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      setLoadError('');
      const snapshot = await getDocs(query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(500)));
      setLogs(snapshot.docs.map((documentSnapshot) => ({ id: documentSnapshot.id, ...documentSnapshot.data() })) as AuditLogRow[]);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to read audit logs.');
      toast.error('Audit logs are not readable yet. Deploy auditLogs Firestore rules if this is a permission error.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, []);

  const actors = useMemo(() => Array.from(new Set(logs.map((log) => log.actorEmail || 'unknown-admin'))).sort(), [logs]);
  const actions = useMemo(() => Array.from(new Set(logs.map((log) => log.action || 'unknown'))).sort(), [logs]);
  const entities = useMemo(() => Array.from(new Set(logs.map((log) => log.entityType || 'unknown'))).sort(), [logs]);

  const filteredLogs = useMemo(() => {
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
    const entityId = entityIdFilter.trim().toLowerCase();
    return logs.filter((log) => {
      if (actorFilter !== 'all' && (log.actorEmail || 'unknown-admin') !== actorFilter) return false;
      if (actionFilter !== 'all' && (log.action || 'unknown') !== actionFilter) return false;
      if (entityFilter !== 'all' && (log.entityType || 'unknown') !== entityFilter) return false;
      if (entityId && !String(log.entityId || '').toLowerCase().includes(entityId)) return false;
      const createdAtDate = (log.createdAt as { toDate?: () => Date })?.toDate?.() || null;
      const time = createdAtDate?.getTime?.();
      if (from && time && time < from) return false;
      if (to && time && time > to) return false;
      return true;
    });
  }, [actionFilter, actorFilter, dateFrom, dateTo, entityFilter, entityIdFilter, logs]);

  const exportCsv = () => {
    downloadCsv(`audit_logs_${new Date().toISOString().slice(0, 10)}.csv`, [
      ['id', 'created_at', 'actor_email', 'actor_role', 'action', 'entity_type', 'entity_id', 'entity_name', 'source'],
      ...filteredLogs.map((log) => [
        log.id,
        formatFirestoreDate(log.createdAt),
        log.actorEmail || '',
        log.actorRole || '',
        log.action || '',
        log.entityType || '',
        log.entityId || '',
        log.entityName || '',
        log.source || '',
      ]),
    ]);
    toast.success(`${filteredLogs.length} audit rows exported`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-500">Security</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Change History</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Audit logs from live Firestore data. No synthetic rows are shown.</p>
        </div>
        <button type="button" onClick={exportCsv} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-black text-white">Export CSV</button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
          <select value={actorFilter} onChange={(event) => setActorFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
            <option value="all">All actors</option>
            {actors.map((actor) => <option key={actor} value={actor}>{actor}</option>)}
          </select>
          <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
            <option value="all">All actions</option>
            {actions.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>
          <select value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
            <option value="all">All entities</option>
            {entities.map((entity) => <option key={entity} value={entity}>{entity}</option>)}
          </select>
          <input value={entityIdFilter} onChange={(event) => setEntityIdFilter(event.target.value)} placeholder="Entity ID" className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
        </div>
        <p className="mt-3 text-xs font-black uppercase tracking-wide text-gray-500">Showing {filteredLogs.length} of {logs.length} logs</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {isLoading ? (
          <div className="p-10 text-center text-gray-500">Loading audit logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-black text-gray-900 dark:text-white">{loadError ? 'Audit logs are not available yet.' : 'No audit logs found.'}</p>
            <p className="mt-2 text-sm text-gray-500">
              {loadError
                ? 'Deploy auditLogs Firestore rules to read and capture admin events.'
                : 'No admin changes have been captured yet. Create or update an order, catalog item, role, setting, or geozone to generate the first audit event.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-black uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                  <th className="px-5 py-3 text-left">Time</th>
                  <th className="px-5 py-3 text-left">Actor</th>
                  <th className="px-5 py-3 text-left">Action</th>
                  <th className="px-5 py-3 text-left">Entity</th>
                  <th className="px-5 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/70">
                    <td className="px-5 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300">{formatFirestoreDate(log.createdAt)}</td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-gray-900 dark:text-white">{log.actorEmail || 'unknown-admin'}</p>
                      <p className="text-xs text-gray-500">{log.actorRole || 'admin'}</p>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs font-black text-brand-600 dark:text-brand-300">{log.action || 'unknown'}</td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-gray-900 dark:text-white">{log.entityName || log.entityId || 'Unknown entity'}</p>
                      <p className="text-xs text-gray-500">{log.entityType || 'unknown'} · {log.entityId || log.id}</p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button type="button" onClick={() => setSelected(log)} className="rounded-lg bg-blue-100 px-3 py-2 text-xs font-black text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">View diff</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white">{selected.action}</h2>
                <p className="mt-1 text-sm text-gray-500">{selected.entityType} · {selected.entityId}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold dark:bg-gray-800">Close</button>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">Before</p>
                <pre className="max-h-[520px] overflow-auto rounded-xl bg-gray-950 p-4 text-xs text-gray-100">{JSON.stringify(selected.before || {}, null, 2)}</pre>
              </div>
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">After</p>
                <pre className="max-h-[520px] overflow-auto rounded-xl bg-gray-950 p-4 text-xs text-gray-100">{JSON.stringify(selected.after || {}, null, 2)}</pre>
              </div>
            </div>
            {selected.metadata && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">Metadata</p>
                <pre className="max-h-60 overflow-auto rounded-xl bg-gray-950 p-4 text-xs text-gray-100">{JSON.stringify(selected.metadata, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
