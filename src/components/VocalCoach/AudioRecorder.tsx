import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2 } from 'lucide-react';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, audioDuration: number) => void;
  maxDuration?: number; // in seconds
  disabled?: boolean;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onRecordingComplete,
  maxDuration = 300, // 5 minutes default
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopRecording();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const requestMicrophonePermission = async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      setPermissionDenied(false);
      return stream;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setPermissionDenied(true);
      return null;
    }
  };

  const startRecording = async () => {
    if (disabled) return;

    try {
      // Reset previous recording
      audioChunksRef.current = [];
      setRecordingTime(0);
      setHasRecording(false);

      // Get microphone access
      const stream = await requestMicrophonePermission();
      if (!stream) return;

      streamRef.current = stream;

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setHasRecording(true);
        onRecordingComplete(audioBlob, recordingTime);

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setIsPaused(false);

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Auto-stop at max duration
          if (newTime >= maxDuration) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      // Resume timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const playRecording = () => {
    if (hasRecording && audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' 
      });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      audioElementRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
      };
      
      audio.play();
      setIsPlaying(true);
    }
  };

  const stopPlayback = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const deleteRecording = () => {
    audioChunksRef.current = [];
    setHasRecording(false);
    setRecordingTime(0);
    stopPlayback();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    return (recordingTime / maxDuration) * 100;
  };

  if (permissionDenied) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <Mic className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h3 className="font-semibold text-red-900 mb-2">Microphone Access Denied</h3>
        <p className="text-sm text-red-700 mb-4">
          Please enable microphone permissions in your browser settings to record audio.
        </p>
        <button
          onClick={startRecording}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Timer Display */}
      <div className="text-center mb-6">
        <div className="text-4xl font-bold text-gray-900 mb-2">
          {formatTime(recordingTime)}
        </div>
        <div className="text-sm text-gray-600">
          {isRecording ? (isPaused ? 'Paused' : 'Recording...') : hasRecording ? 'Ready to submit' : 'Ready to record'}
        </div>
      </div>

      {/* Progress Bar */}
      {isRecording && (
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                getProgressPercentage() > 80 ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1 text-center">
            {maxDuration - recordingTime}s remaining
          </div>
        </div>
      )}

      {/* Recording Controls */}
      <div className="flex items-center justify-center gap-4">
        {!isRecording && !hasRecording && (
          <button
            onClick={startRecording}
            disabled={disabled}
            className="bg-red-500 hover:bg-red-600 text-white rounded-full p-6 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mic className="w-8 h-8" />
          </button>
        )}

        {isRecording && (
          <>
            <button
              onClick={isPaused ? resumeRecording : pauseRecording}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all"
            >
              {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
            </button>
            <button
              onClick={stopRecording}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full p-6 shadow-lg hover:shadow-xl transition-all"
            >
              <Square className="w-8 h-8" />
            </button>
          </>
        )}

        {hasRecording && !isRecording && (
          <>
            <button
              onClick={isPlaying ? stopPlayback : playRecording}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            <button
              onClick={deleteRecording}
              className="bg-gray-500 hover:bg-gray-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all"
            >
              <Trash2 className="w-6 h-6" />
            </button>
            <button
              onClick={startRecording}
              disabled={disabled}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              <Mic className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          {!isRecording && !hasRecording && 'Tap the microphone to start recording'}
          {isRecording && !isPaused && 'Recording in progress...'}
          {isRecording && isPaused && 'Recording paused'}
          {hasRecording && !isRecording && 'Review your recording or re-record'}
        </p>
      </div>
    </div>
  );
};

export default AudioRecorder;
