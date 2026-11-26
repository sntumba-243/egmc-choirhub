import { useEffect, useMemo, useState } from 'react';
import { Smartphone, AlertTriangle, History, LogOut, X, ChevronDown, ChevronUp } from 'lucide-react';
import { deviceRpc } from '../lib/deviceLimit';
import toast from 'react-hot-toast';

// Device access (device limit). Super admin: every church, plus per-account
// limit overrides. Church admin: their own church (the RPC enforces the scope
// and who may be signed out — same rule as reset-password).

interface Row {
  user_id: string;
  member_id: string;
  full_name: string;
  email: string;
  role: string;
  church_id: string | null;
  church_name: string | null;
  devices: number;
  device_limit: number | null;
  override_max: number | null;
  override_exempt: boolean;
  last_sign_in: string | null;
  refused_7d: number;
  last_refused: string | null;
  can_manage: boolean;
}

interface EventRow {
  id: number;
  kind: string;
  created_at: string;
  user_agent: string | null;
  ip: string | null;
  active_devices: number | null;
  device_limit: number | null;
}

type SortKey = 'name' | 'church' | 'devices' | 'last';

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

const KIND_LABEL: Record<string, string> = {
  refused: 'Refused: new device over the limit',
  sign_out_all: 'All devices signed out by an admin',
  sign_out_others: 'Signed out their other devices',
};

export function DeviceAccessPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>(isSuperAdmin ? 'church' : 'name');
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<{ row: Row; events: EventRow[] | null } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await deviceRpc('device_overview', { p_church_id: null });
    if (error) { setUnavailable(true); return; }
    setRows((data || []) as Row[]);
  };
  useEffect(() => { if (open && !rows) load(); }, [open]);

  const flaggedCount = rows?.filter((r) => r.refused_7d > 0).length ?? 0;

  const visible = useMemo(() => {
    let list = rows || [];
    if (flaggedOnly) list = list.filter((r) => r.refused_7d > 0);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((r) => `${r.full_name} ${r.email} ${r.church_name || ''}`.toLowerCase().includes(q));
    const by: Record<SortKey, (a: Row, b: Row) => number> = {
      name: (a, b) => a.full_name.localeCompare(b.full_name),
      church: (a, b) => (a.church_name || '').localeCompare(b.church_name || '') || a.full_name.localeCompare(b.full_name),
      devices: (a, b) => b.devices - a.devices || a.full_name.localeCompare(b.full_name),
      last: (a, b) => (b.last_sign_in || '').localeCompare(a.last_sign_in || ''),
    };
    return [...list].sort(by[sort]);
  }, [rows, flaggedOnly, sort, query]);

  const showHistory = async (row: Row) => {
    setHistory({ row, events: null });
    const { data, error } = await deviceRpc('device_events_for', { p_user_id: row.user_id });
    if (error) { toast.error('Could not load the history'); setHistory(null); return; }
    setHistory({ row, events: (data || []) as EventRow[] });
  };

  const signOutAll = async (row: Row) => {
    setConfirming(null);
    const { data, error } = await deviceRpc('device_sign_out_all', { p_user_id: row.user_id });
    if (error) { toast.error(error.message || 'Could not sign out this account'); return; }
    toast.success(`${row.full_name}: signed out of ${data ?? 0} session${data === 1 ? '' : 's'}. It can take up to an hour on a device left open.`);
    load();
  };

  const setOverride = async (row: Row, value: string) => {
    const exempt = value === 'exempt';
    const max = value === 'default' || exempt ? null : Number(value);
    const { error } = await deviceRpc('device_set_override', { p_user_id: row.user_id, p_max: max, p_exempt: exempt });
    if (error) { toast.error(error.message || 'Could not change the limit'); return; }
    toast.success('Device limit updated');
    load();
  };

  if (unavailable) return null;

  const overrideValue = (r: Row) => (r.override_exempt ? 'exempt' : r.override_max != null ? String(r.override_max) : 'default');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left min-h-[44px]"
      >
        <span className="flex items-center gap-2 font-semibold text-gray-900">
          <Smartphone className="w-5 h-5" /> Devices
          {flaggedCount > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">{flaggedCount} flagged</span>
          )}
        </span>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-gray-500">
            Members and guests can be signed in on 2 devices. Admins are not limited.
            {isSuperAdmin ? ' You can change the limit for one account.' : ''} Flagged: a new device was refused in the last 7 days.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email or church"
              className="flex-1 min-w-[12rem] px-3 py-2 border rounded-lg text-sm"
            />
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="px-3 py-2 border rounded-lg text-sm">
              <option value="name">Sort: name</option>
              {isSuperAdmin && <option value="church">Sort: church</option>}
              <option value="devices">Sort: devices</option>
              <option value="last">Sort: last sign-in</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700 px-2 min-h-[44px]">
              <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
              Flagged only
            </label>
          </div>

          {!rows ? (
            <div className="py-6 text-center text-sm text-gray-500">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">{flaggedOnly ? 'No flagged accounts' : 'No accounts'}</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {visible.map((r) => (
                <div key={r.user_id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate flex items-center gap-2">
                      {r.full_name || r.email}
                      {r.refused_7d > 0 && (
                        <span title={`Last refused ${fmt(r.last_refused)}`} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold rounded bg-red-50 text-red-700 shrink-0">
                          <AlertTriangle className="w-3 h-3" /> {r.refused_7d}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {isSuperAdmin && r.church_name ? `${r.church_name} · ` : ''}{r.role} · last sign-in {fmt(r.last_sign_in)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold px-2 py-1 rounded ${r.device_limit != null && r.devices > r.device_limit ? 'bg-amber-50 text-amber-800' : 'text-gray-700'}`}>
                      {r.device_limit == null ? `${r.devices} device${r.devices === 1 ? '' : 's'} · no limit` : `${r.devices} of ${r.device_limit}`}
                    </span>
                    {isSuperAdmin && (
                      <select
                        value={overrideValue(r)}
                        onChange={(e) => setOverride(r, e.target.value)}
                        aria-label="Device limit for this account"
                        className="px-2 py-1.5 border rounded-lg text-xs"
                      >
                        <option value="default">Default limit</option>
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Limit {n}</option>)}
                        <option value="exempt">Exempt</option>
                      </select>
                    )}
                    <button onClick={() => showHistory(r)} className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg min-h-[40px]" title="Sign-in attempt history">
                      <History className="w-4 h-4" />
                    </button>
                    {r.can_manage && r.devices > 0 && (
                      confirming === r.user_id ? (
                        <span className="flex items-center gap-1">
                          <button onClick={() => signOutAll(r)} className="px-2 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg min-h-[36px]">Sign out all</button>
                          <button onClick={() => setConfirming(null)} className="px-2 py-1.5 text-xs text-gray-600 rounded-lg min-h-[36px]">Cancel</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirming(r.user_id)} className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 min-h-[36px]">
                          <LogOut className="w-3.5 h-3.5" /> Sign out all devices
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {history && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setHistory(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{history.row.full_name || history.row.email}</h3>
                <p className="text-xs text-gray-500">Device history (last 100)</p>
              </div>
              <button onClick={() => setHistory(null)} className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            {!history.events ? (
              <p className="text-sm text-gray-500 py-4 text-center">Loading…</p>
            ) : history.events.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">Nothing recorded</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {history.events.map((e) => (
                  <li key={e.id} className="py-2 text-sm">
                    <p className="font-medium text-gray-800">{KIND_LABEL[e.kind] || e.kind}</p>
                    <p className="text-xs text-gray-500 break-words">
                      {fmt(e.created_at)}
                      {e.kind === 'refused' && e.active_devices != null ? ` · ${e.active_devices} other devices active (limit ${e.device_limit})` : ''}
                      {e.kind !== 'refused' && e.active_devices != null ? ` · ${e.active_devices} session${e.active_devices === 1 ? '' : 's'}` : ''}
                      {e.ip ? ` · ${e.ip}` : ''}
                    </p>
                    {e.user_agent && <p className="text-[11px] text-gray-400 break-all">{e.user_agent}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
