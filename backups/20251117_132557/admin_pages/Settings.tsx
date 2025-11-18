import React, { useState } from 'react';
import { RefreshCw, FolderOpen, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { googleDriveService } from '../../lib/googleDrive';
import toast from 'react-hot-toast';

export const AdminSettings: React.FC = () => {
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

      for (const file of files) {
        try {
          const embedUrl = googleDriveService.getEmbedUrl(file.id);
          if (existingUrls.has(embedUrl)) {
            skipped++;
            continue;
          }
          const fileName = file.name.replace(/\.(pdf|png|jpg|jpeg)$/i, '');
          const parts = fileName.split('-').map(p => p.trim());
          const title = parts[0] || fileName;
          const composer = parts[1] || 'Unknown';
          
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
          }
        } catch (error) { 
          errors++; 
        }
      }
      
      setSyncResult({ added, skipped, errors });
      
      if (added > 0) {
        toast.success('Successfully synced ' + added + ' songs!');
      } else if (skipped > 0) {
        toast('All songs already synced');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <FolderOpen className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Google Drive Sync</h2>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-900"><strong>Folder:</strong> /EGMC ChoirHub/</p>
          <p className="text-xs text-blue-700 mt-1">Files will be synced automatically. Name files as: Song Title - Composer.pdf</p>
        </div>
        <button 
          onClick={handleSync} 
          disabled={syncing} 
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-medium disabled:opacity-50"
        >
          <RefreshCw className={'w-5 h-5 ' + (syncing ? 'animate-spin' : '')} />
          {syncing ? 'Syncing...' : 'Sync from Google Drive'}
        </button>
        {syncResult && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">{syncResult.added} songs added</span>
            </div>
            {syncResult.skipped > 0 && (
              <div className="flex items-center gap-2 text-gray-600">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">{syncResult.skipped} songs skipped</span>
              </div>
            )}
            {syncResult.errors > 0 && (
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">{syncResult.errors} errors</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
