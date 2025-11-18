import { useState, useEffect } from 'react';
import { X, ChevronLeft } from 'lucide-react';

interface PDFViewerProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
}

const PDFViewer = ({ fileUrl, fileName, onClose }: PDFViewerProps) => {
  const [showControls, setShowControls] = useState(true);
  const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);
  const [embedUrl, setEmbedUrl] = useState('');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  // Convert Google Drive URL to embeddable format
  const getEmbedUrl = (url: string): string => {
    const logs: string[] = [];
    logs.push(`Original URL: ${url}`);
    
    // Handle different Google Drive URL formats
    let fileId = '';
    
    // Format: https://drive.google.com/file/d/FILE_ID/view
    const viewMatch = url.match(/\/file\/d\/([^/]+)\//);
    if (viewMatch) {
      fileId = viewMatch[1];
      logs.push(`Found file ID via /file/d/ pattern: ${fileId}`);
    }
    
    // Format: https://drive.google.com/open?id=FILE_ID
    if (!fileId) {
      const openMatch = url.match(/[?&]id=([^&]+)/);
      if (openMatch) {
        fileId = openMatch[1];
        logs.push(`Found file ID via ?id= pattern: ${fileId}`);
      }
    }
    
    // If already an embed URL, use it
    if (url.includes('/preview')) {
      logs.push(`URL already in preview format`);
      setDebugInfo(logs);
      return url;
    }
    
    if (!fileId) {
      logs.push(`❌ ERROR: Could not extract file ID from URL`);
      setDebugInfo(logs);
      return '';
    }
    
    // Return embed URL with rm=minimal to hide most controls
    const finalUrl = `https://drive.google.com/file/d/${fileId}/preview?rm=minimal`;
    logs.push(`Final embed URL: ${finalUrl}`);
    setDebugInfo(logs);
    
    return finalUrl;
  };

  useEffect(() => {
    console.log('🎵 PDFViewer mounted');
    console.log('📄 File URL:', fileUrl);
    console.log('📝 File Name:', fileName);
    
    const url = getEmbedUrl(fileUrl);
    setEmbedUrl(url);
    
    console.log('🔗 Embed URL:', url);
  }, [fileUrl, fileName]);

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    if (showControls) {
      const timeout = setTimeout(() => {
        setShowControls(false);
      }, 3000);
      setHideTimeout(timeout);
      return () => clearTimeout(timeout);
    }
  }, [showControls]);

  // Toggle controls on tap/click
  const handleToggleControls = () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }
    setShowControls(!showControls);
  };

  // Show debug info if URL extraction failed
  if (!embedUrl) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center text-white p-8">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold mb-4">❌ PDF Loading Error</h2>
          <p className="mb-4">Could not extract Google Drive file ID from URL.</p>
          
          <div className="bg-gray-800 p-4 rounded-lg mb-4 overflow-auto">
            <p className="font-bold mb-2">Debug Info:</p>
            {debugInfo.map((log, i) => (
              <p key={i} className="text-sm font-mono mb-1">{log}</p>
            ))}
          </div>
          
          <div className="bg-blue-900/50 p-4 rounded-lg mb-4">
            <p className="font-bold mb-2">✅ Valid URL formats:</p>
            <code className="text-sm block mb-1">https://drive.google.com/file/d/FILE_ID/view</code>
            <code className="text-sm block">https://drive.google.com/open?id=FILE_ID</code>
          </div>
          
          <div className="bg-red-900/50 p-4 rounded-lg mb-4">
            <p className="font-bold mb-2">❌ Invalid URL formats:</p>
            <code className="text-sm block mb-1">https://docs.google.com/document/d/...</code>
            <code className="text-sm block">https://drive.google.com/drive/folders/...</code>
          </div>
          
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium"
          >
            ← Back to Songs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header with auto-hide */}
      <div
        className={`absolute top-0 left-0 right-0 z-10 transition-transform duration-300 ${
          showControls ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div 
          className="bg-gradient-to-b from-black/90 to-black/0 pb-8"
          style={{
            paddingTop: 'max(env(safe-area-inset-top), 1rem)',
          }}
        >
          <div className="px-4 flex items-center justify-between text-white">
            <button
              onClick={onClose}
              className="flex items-center gap-2 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
            
            <h1 className="text-sm font-medium truncate max-w-[50%] text-center">
              {fileName}
            </h1>
            
            <button
              onClick={onClose}
              className="hover:bg-white/10 rounded-lg p-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* PDF iframe - tap to toggle controls */}
      <div 
        className="flex-1 relative"
        onClick={handleToggleControls}
      >
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full border-0"
          title={fileName}
          allow="autoplay"
          onLoad={() => console.log('✅ PDF iframe loaded successfully')}
          onError={(e) => console.error('❌ PDF iframe error:', e)}
        />
      </div>

      {/* Tap anywhere hint (shows briefly on mount) */}
      {showControls && (
        <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
          <div className="inline-block bg-black/80 text-white text-xs px-4 py-2 rounded-full">
            Tap to show/hide controls
          </div>
        </div>
      )}
      
      {/* Debug console log indicator */}
      <div className="absolute top-20 left-4 text-white text-xs bg-green-600 px-2 py-1 rounded opacity-75 pointer-events-none">
        Check browser console (F12) for debug info
      </div>
    </div>
  );
};

export default PDFViewer;
