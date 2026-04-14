import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Mic } from 'lucide-react';
import { SongRecorder } from './SongRecorder';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

interface PDFViewerProps {
  url: string;
  title?: string;
  songId?: string;
  assignmentId?: string;
}

export function PDFViewer({ url: googleDriveUrl, title: songTitle, songId, assignmentId }: PDFViewerProps) {
  const navigate = useNavigate();
  const [controlsVisible, setControlsVisible] = useState(true);
  const [iframeUrl, setIframeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showRecorder, setShowRecorder] = useState(false);
  const [hasError, setHasError] = useState(false);

  const isNative = Capacitor.isNativePlatform();

  // Extract file ID from Google Drive URL
  function extractFileId(inputUrl: string): string {
    const viewPattern = inputUrl.match(/\/d\/([^/]+)/);
    if (viewPattern && viewPattern[1]) return viewPattern[1];
    const openPattern = inputUrl.match(/[?&]id=([^&]+)/);
    if (openPattern && openPattern[1]) return openPattern[1];
    return '';
  }

  // On native, open PDF in Capacitor Browser and navigate back
  useEffect(() => {
    if (!isNative) return;

    const fileId = extractFileId(googleDriveUrl);
    if (!fileId) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    const pdfUrl = `https://drive.google.com/file/d/${fileId}/preview?rm=minimal`;

    Browser.open({
      url: pdfUrl,
      windowName: '_blank',
      toolbarColor: '#1a2744',
      presentationStyle: 'fullscreen' as any,
    }).then(() => {
      // Listen for browser closed event to navigate back
      Browser.addListener('browserFinished', () => {
        navigate(-1);
        Browser.removeAllListeners();
      });
    });

    setIsLoading(false);
  }, [googleDriveUrl, isNative]);

  // Convert Google Drive URL to iframe embed URL (web only)
  useEffect(() => {
    if (isNative) return;

    function convertToIframeUrl(inputUrl: string): string {
      const extractedFileId = extractFileId(inputUrl);

      if (!extractedFileId) {
        console.error('❌ Could not extract Google Drive file ID from:', inputUrl);
        return '';
      }

      // Create embed URL with rm=minimal for minimal controls
      const finalUrl = `https://drive.google.com/file/d/${extractedFileId}/preview?rm=minimal`;
      return finalUrl;
    }

    const converted = convertToIframeUrl(googleDriveUrl);
    if (converted) {
      setIframeUrl(converted);
      setHasError(false);
    } else {
      setHasError(true);
    }
    setIsLoading(false);
  }, [googleDriveUrl, isNative]);

  // Auto-hide controls after 2.5 seconds
  useEffect(() => {
    if (controlsVisible) {
      const hideTimer = setTimeout(() => {
        setControlsVisible(false);
      }, 2500); // 2.5 seconds
      return () => clearTimeout(hideTimer);
    }
  }, [controlsVisible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setIframeUrl("");
      setIsLoading(true);
    };
  }, []);

  function showControls() {
    setControlsVisible(true);
  }

  function goBack() {
    navigate(-1);
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center">
        <div className="text-center text-gray-600">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-400 border-t-transparent mx-auto mb-4"></div>
          <div className="text-sm opacity-75">Loading PDF...</div>
        </div>
      </div>
    );
  }

  // On native, the PDF opens in Capacitor Browser — show a minimal waiting screen
  if (isNative) {
    return (
      <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center">
        <div className="text-center text-gray-600">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-400 border-t-transparent mx-auto mb-4"></div>
          <div className="text-sm opacity-75">Opening PDF...</div>
          <button
            onClick={() => navigate(-1)}
            className="mt-6 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Show error if URL conversion failed
  if (hasError || !iframeUrl) {
    return (
      <div className="fixed inset-0 bg-red-600 z-[9999] flex items-center justify-center">
        <div className="text-center text-white p-6 max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="text-xl font-bold mb-2">Invalid Google Drive URL</div>
          <div className="text-sm mb-6 opacity-90">
            Could not extract file ID from the URL
          </div>
          <button
            onClick={goBack}
            className="px-6 py-3 bg-white text-red-600 rounded-lg font-bold hover:bg-gray-100 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Main viewer with minimal UI
  return (
    <div
      className="fixed inset-0 bg-white z-[9999]"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Always-visible minimal back button */}
      <button
        onClick={goBack}
        className="fixed top-3 left-3 z-[10003] w-9 h-9 bg-gray-200/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-gray-300/70 transition-all"
        style={{ marginTop: 'env(safe-area-inset-top)' }}
      >
        <ArrowLeft className="w-4 h-4 text-gray-600" strokeWidth={2.5} />
      </button>

      {/* Google Drive iframe */}
      <iframe
        src={iframeUrl}
        title={songTitle || 'Sheet Music'}
        allow="autoplay"
        className="border-0 transition-all origin-top-left"
        style={{
          width: '110%',
          height: showRecorder ? 'calc(110% - 70px)' : '110%',
          transform: 'scale(0.909)',
          transformOrigin: 'top left',
        }}
        onLoad={() => {}}
      />

      {/* Thin top-edge tap zone to show controls - invisible, doesn't block PDF scrolling */}
      {!controlsVisible && !showRecorder && (
        <div
          onClick={showControls}
          className="absolute top-0 left-0 right-0 h-4 z-[10000]"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        />
      )}

      {/* Record Button - Small floating icon */}
      {songId && (
        <button
          onClick={() => setShowRecorder(true)}
          className="fixed bottom-4 right-4 z-[10003] bg-red-600 hover:bg-red-700 text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all opacity-80 hover:opacity-100"
          title="Record your practice"
        >
          <Mic className="w-5 h-5" />
        </button>
      )}

      {/* Song Recorder Modal */}
      {showRecorder && songId && (
        <SongRecorder
          songId={songId}
          songTitle={songTitle || 'Song'}
          assignmentId={assignmentId}
          onClose={() => setShowRecorder(false)}
          onSuccess={() => setShowRecorder(false)}
        />
      )}
    </div>
  );
}

// Standalone page version for React Router
export function PDFViewerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { url?: string; title?: string; songId?: string; assignmentId?: string } | null;

  if (!state || !state.url) {
    return (
      <div className="fixed inset-0 bg-orange-500 z-[9999] flex items-center justify-center">
        <div className="text-center text-white p-6">
          <div className="text-2xl font-bold mb-4">No PDF URL Provided</div>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-white text-orange-500 rounded-lg font-bold hover:bg-gray-100 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return <PDFViewer url={state.url} title={state.title} songId={state.songId} assignmentId={state.assignmentId} />;
}
