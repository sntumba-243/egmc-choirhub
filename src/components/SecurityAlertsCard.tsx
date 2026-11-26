import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { deviceRpc } from '../lib/deviceLimit';

// Super admin dashboard: device-limit alerts (at most one per member per hour).
interface Alert {
  id: number; created_at: string; full_name: string; church_name: string | null;
  active_devices: number | null; device_limit: number | null; user_agent: string | null; seen: boolean;
}

export function SecurityAlertsCard() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = async () => {
    const { data, error } = await deviceRpc('device_alerts');
    if (!error) setAlerts((data || []) as Alert[]);
  };
  useEffect(() => { load(); }, []);

  if (!alerts) return null; // functions not deployed yet, or not a super admin
  const unseen = alerts.filter((a) => !a.seen).length;

  const markSeen = async () => {
    await deviceRpc('device_alerts_mark_seen');
    load();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button onClick={() => setExpanded((e) => !e)} className="flex items-center gap-2 font-semibold text-gray-900 min-h-[44px]">
          <ShieldAlert className="w-5 h-5" /> Security alerts
          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${unseen ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{unseen}</span>
        </button>
        <div className="flex gap-2">
          {unseen > 0 && (
            <button onClick={markSeen} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 min-h-[36px]">Mark all seen</button>
          )}
          <button onClick={() => navigate('/super-admin/members')} className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 min-h-[36px]">Devices</button>
        </div>
      </div>
      {expanded && (
        alerts.length === 0 ? (
          <p className="text-sm text-gray-500 mt-2">No alerts in the last 30 days.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {alerts.map((a) => (
              <li key={a.id} className={`py-2 text-sm ${a.seen ? 'text-gray-500' : 'text-gray-900'}`}>
                <p className="font-medium break-words">
                  {a.full_name}{a.church_name ? ` · ${a.church_name}` : ''}: new device refused
                </p>
                <p className="text-xs text-gray-500 break-words">
                  {new Date(a.created_at).toLocaleString()} · {a.active_devices} other devices active (limit {a.device_limit})
                </p>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
