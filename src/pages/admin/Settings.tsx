import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Palette } from 'lucide-react';

// Google Drive Sync lives on /super-admin/settings (GoogleDriveSyncCard) —
// song writes are super-admin only.
export const AdminSettings: React.FC = () => {
  const location = useLocation();
  const isSuperAdmin = location.pathname.startsWith('/super-admin');
  const themePath = isSuperAdmin ? '/super-admin/theme' : '/admin/theme';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Settings</h1>

      {/* Church Theme */}
      <Link to={themePath} className="block bg-white rounded-xl shadow-sm p-4 border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all group">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg theme-gradient flex items-center justify-center">
              <Palette className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Church Theme</h2>
              <p className="text-xs text-gray-500">Colors, logo & branding</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </Link>
    </div>
  );
};
