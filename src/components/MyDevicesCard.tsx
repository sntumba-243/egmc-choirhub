import { useEffect, useState } from 'react';
import { Smartphone, LogOut } from 'lucide-react';
import { deviceRpc } from '../lib/deviceLimit';
import toast from 'react-hot-toast';

// "Signed in on N of 2 devices" + "Sign out my other devices" (device limit).
// Hidden when the database doesn't have the device-limit functions yet.
export function MyDevicesCard() {
  const [status, setStatus] = useState<{ devices: number; limit: number | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await deviceRpc('device_my_status');
    if (!error && data) setStatus({ devices: data.devices ?? 0, limit: data.limit ?? null });
  };
  useEffect(() => { load(); }, []);

  if (!status) return null;

  const signOutOthers = async () => {
    setBusy(true);
    const { data, error } = await deviceRpc('device_sign_out_others');
    setBusy(false);
    if (error) { toast.error('Could not sign out your other devices'); return; }
    toast.success(data ? `Signed out ${data} other session${data === 1 ? '' : 's'}` : 'No other devices were signed in');
    load();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Devices</h2>
      <div className="flex items-center gap-3 flex-wrap">
        <Smartphone className="w-5 h-5 text-gray-500 shrink-0" />
        <p className="text-sm text-gray-800 flex-1 min-w-[10rem]">
          {status.limit == null
            ? `Signed in on ${status.devices} device${status.devices === 1 ? '' : 's'}`
            : `Signed in on ${status.devices} of ${status.limit} devices`}
        </p>
        {status.devices > 1 && (
          <button
            onClick={signOutOthers}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 min-h-[44px]"
          >
            <LogOut className="w-4 h-4" /> Sign out my other devices
          </button>
        )}
      </div>
    </div>
  );
}
