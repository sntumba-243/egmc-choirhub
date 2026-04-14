import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { RefreshCw, FolderOpen, CheckCircle, AlertCircle, Palette } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { googleDriveService } from '../../lib/googleDrive';
import toast from 'react-hot-toast';

export const AdminSettings: React.FC = () => {
  const location = useLocation();
  const isSuperAdmin = location.pathname.startsWith('/super-admin');
  const themePath = isSuperAdmin ? '/super-admin/theme' : '/admin/theme';
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ added: number; skipped: number; errors: number } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const files = await googleDriveService.listFilesInFolder();
      
      if (files.length === 0) {
        toast.error('No files found in Google Drive folder');
        setSyncing(false);
        return;
      }

      let added = 0;
      let skipped = 0;
      let errors = 0;

      const { data: existingSongs } = await supabase
        .from('songs')
        .select('title, sheet_music_url');

      const existingUrls = new Set(existingSongs?.map(s => s.sheet_music_url) || []);
      const existingTitles = new Set(existingSongs?.map(s => s.title.toLowerCase()) || []);

      for (const file of files) {
        try {
          const embedUrl = googleDriveService.getEmbedUrl(file.id);
          
          // Check if URL already exists
          if (existingUrls.has(embedUrl)) {
            skipped++;
            continue;
          }
          
          // Parse filename to get title and composer
          const fileName = file.name.replace(/\.(pdf|png|jpg|jpeg)$/i, '');
          const parts = fileName.split('-').map(p => p.trim());
          const title = parts[0] || fileName;
          const composer = parts[1] || 'Unknown';
          
          // Check if title already exists (case-insensitive)
          if (existingTitles.has(title.toLowerCase())) {
            skipped++;
            continue;
          }
          
          const { error } = await supabase.from('songs').insert([{
            title, 
            composer, 
            language: 'English', 
            sheet_music_url: embedUrl,
            created_at: new Date().toISOString(), 
            updated_at: new Date().toISOString()
          }]);
          
          if (error) { 
            errors++; 
          } else { 
            added++;
            existingTitles.add(title.toLowerCase()); // Add to set to prevent duplicates in same sync
          }
        } catch (error) { 
          errors++; 
        }
      }
      
      setSyncResult({ added, skipped, errors });
      
      if (added > 0) {
        toast.success(`Successfully synced ${added} songs!`);
      } else if (skipped > 0) {
        toast.info(`All ${skipped} songs already exist`);
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error('Failed to sync: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
      {/* Google Drive Sync */}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="w-full bg-white rounded-xl shadow-sm p-4 border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all group disabled:opacity-60 text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <RefreshCw className={`w-4 h-4 text-white ${syncing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{syncing ? 'Syncing...' : 'Google Drive Sync'}</h2>
              <p className="text-xs text-gray-500">Sync sheet music from Drive</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
        </div>
        {syncResult && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-xs">
            <span className="text-green-600 font-medium">{syncResult.added} added</span>
            {syncResult.skipped > 0 && <span className="text-gray-500">{syncResult.skipped} skipped</span>}
            {syncResult.errors > 0 && <span className="text-red-500">{syncResult.errors} errors</span>}
          </div>
        )}
      </button>

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
