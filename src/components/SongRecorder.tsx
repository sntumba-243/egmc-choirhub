import { useState, useRef, useEffect } from 'react';
import { Mic, Square, RotateCcw, Send, X, Loader2, Play, Pause } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface SongRecorderProps {
  songId: string;
  songTitle: string;
  assignmentId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SongRecorder({ songId, songTitle, assignmentId, onClose, onSuccess }: SongRecorderProps) {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
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
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (error) {
      toast.error('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const retryRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const sendRecording = async () => {
    const userId = user?.id || (user as any)?.user?.id;
    console.log('Send clicked', { audioBlob: !!audioBlob, userId, songId, user });
    if (!audioBlob) {
      toast.error('No recording to send');
      return;
    }
    if (!userId) {
      toast.error('Please log in to send');
      return;
    }
    setSending(true);
    try {
      const fileName = `${userId}/${songId}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(fileName, audioBlob, { contentType: 'audio/webm' });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('recordings').getPublicUrl(fileName);

      await supabase.from('song_submissions').insert({
        member_id: userId,
        song_id: songId,
        assignment_id: assignmentId || null,
        audio_url: publicUrl,
        status: 'pending'
      });

      if (assignmentId) {
        await supabase.from('exercise_assignments').update({ completed: true }).eq('id', assignmentId);
      }

      toast.success('Recording sent!');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('Failed to send');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[10004] bg-white border-t-2 border-gray-200 shadow-lg px-4 py-3">
      {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />}
      
      <div className="flex items-center justify-between max-w-lg mx-auto gap-3">
        {/* Title & Time */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 truncate">{songTitle}</p>
          <p className={`text-lg font-mono font-bold ${isRecording ? 'text-red-600' : 'text-gray-800'}`}>
            {formatTime(recordingTime)}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {!audioUrl ? (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                isRecording ? 'bg-red-600 animate-pulse' : 'bg-purple-600'
              } text-white`}
            >
              {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          ) : (
            <>
              <button onClick={togglePlayback} className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center">
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button onClick={retryRecording} className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={sendRecording}
                disabled={sending}
                className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>

        {/* Close */}
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
