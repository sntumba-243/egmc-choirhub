import { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface InactiveChurch {
  id: string;
  name: string;
}

export default function SuperAdminSettings() {
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purging, setPurging] = useState(false);
  const [inactiveChurches, setInactiveChurches] = useState<InactiveChurch[]>([]);

  const fetchAndShowPurge = async () => {
    const { data } = await supabase
      .from('churches')
      .select('id, name')
      .eq('is_active', false);
    setInactiveChurches(data || []);
    setShowPurgeModal(true);
  };

  const handlePurge = async () => {
    setPurging(true);
    try {
      await supabase.from('churches').delete().eq('is_active', false);
      setShowPurgeModal(false);
      setInactiveChurches([]);
    } catch (error) {
      console.error('Purge failed:', error);
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mb-6">Settings</h1>

      {/* Data Management */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">Data Management</h3>
          <p className="text-xs text-gray-400 mt-0.5">Manage inactive and soft-deleted records.</p>
        </div>
        <div className="bg-white px-6 py-4 flex items-center justify-between gap-6">
          <div>
            <div className="text-sm font-medium text-gray-900">Purge inactive churches</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Permanently delete all churches marked as inactive.
              Soft-deleted churches are kept for 30 days before auto-purge.
            </div>
          </div>
          <button
            onClick={fetchAndShowPurge}
            className="text-sm font-medium text-red-600 border border-red-300 bg-white hover:bg-red-50 px-4 py-2 rounded-xl min-h-[44px] whitespace-nowrap flex-shrink-0"
          >
            Purge inactive
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showPurgeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-lg font-semibold text-gray-900 mb-2">Purge inactive churches?</div>
            <div className="text-sm text-gray-500 mb-3 leading-relaxed">
              This will permanently delete{' '}
              <span className="font-semibold text-gray-900">
                {inactiveChurches.length} inactive {inactiveChurches.length === 1 ? 'church' : 'churches'}
              </span>
              . This cannot be undone.
            </div>
            {inactiveChurches.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-3 mb-4 max-h-32 overflow-y-auto">
                {inactiveChurches.map(c => (
                  <div key={c.id} className="text-xs text-gray-600 py-0.5">{c.name}</div>
                ))}
              </div>
            )}
            {inactiveChurches.length === 0 && (
              <div className="bg-green-50 rounded-xl p-3 mb-4 text-xs text-green-700">
                No inactive churches found.
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowPurgeModal(false)}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handlePurge}
                disabled={purging || inactiveChurches.length === 0}
                className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 min-h-[44px]"
              >
                {purging ? 'Purging...' : 'Yes, purge all'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
