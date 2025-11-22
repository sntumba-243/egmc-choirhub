import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Mic, 
  Square, 
  Play, 
  Pause,
  RotateCcw,
  Send,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SongRecorderProps {
  songId: string;
  songTitle: string;
  assignmentId?: string;
  onClose: () => void;
}

export function SongRecorder({ songId, songTitle, assignmentId, onClose }: SongRecorderProps) {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploading, setUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      toast.success('Recording stopped');
    }
  };

  const playRecording = () => {
    if (audioRef.current && audioUrl) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const resetRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setIsPlaying(false);
    setRecordingTime(0);
  };

  const submitRecording = async () => {
    if (!audioBlob || !user) return;

    try {
      setUploading(true);

      // Upload to Supabase Storage
      const fileName = `${user.id}/${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('song-recordings')
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('song-recordings')
        .getPublicUrl(fileName);

      // Create submission record
      const { error: dbError } = await supabase
        .from('song_submissions')
        .insert({
          member_id: user.id,
          song_id: songId,
          assignment_id: assignmentId,
          audio_url: publicUrl,
          duration_seconds: recordingTime,
          status: 'pending'
        });

      if (dbError) throw dbError;

      toast.success('Recording submitted successfully!');
      onClose();
    } catch (error) {
      console.error('Error submitting recording:', error);
      toast.error('Failed to submit recording');
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-2xl p-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Record Performance</h3>
            <p className="text-sm text-gray-600">{songTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Recording Status */}
        <div className="text-center mb-6">
          {isRecording && (
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-2xl font-mono font-bold text-gray-900">
                {formatTime(recordingTime)}
              </span>
            </div>
          )}

          {audioUrl && !isRecording && (
            <div className="text-lg font-semibold text-gray-700 mb-4">
              Recording: {formatTime(recordingTime)}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center space-x-4 mb-6">
          {!audioUrl && !isRecording && (
            <button
              onClick={startRecording}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full p-8 shadow-lg transition-all"
            >
              <Mic className="w-8 h-8" />
            </button>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              className="bg-gray-800 hover:bg-gray-900 text-white rounded-full p-8 shadow-lg transition-all"
            >
              <Square className="w-8 h-8" />
            </button>
          )}

          {audioUrl && !isRecording && (
            <>
              <button
                onClick={playRecording}
                className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-full p-6 shadow-lg transition-all"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" />
                )}
              </button>

              <button
                onClick={resetRecording}
                className="bg-gray-500 hover:bg-gray-600 text-white rounded-full p-6 shadow-lg transition-all"
              >
                <RotateCcw className="w-6 h-6" />
              </button>

              <button
                onClick={submitRecording}
                disabled={uploading}
                className="bg-green-500 hover:bg-green-600 text-white rounded-full p-6 shadow-lg transition-all disabled:opacity-50"
              >
                <Send className="w-6 h-6" />
              </button>
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="text-center text-sm text-gray-600">
          {!audioUrl && !isRecording && (
            <p>Tap the microphone to start recording</p>
          )}
          {isRecording && (
            <p>Recording in progress... Tap stop when finished</p>
          )}
          {audioUrl && !isRecording && (
            <p>Listen to your recording, re-record, or submit to director</p>
          )}
        </div>

        {/* Hidden audio element */}
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        )}
      </div>
    </div>
  );
}
