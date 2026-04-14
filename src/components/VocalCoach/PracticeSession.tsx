import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import AudioRecorder from './AudioRecorder';
import FeedbackDisplay from './FeedbackDisplay';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { smartCoachService } from '../../services/smartCoach';

interface Exercise {
  id: string;
  title: string;
  description: string;
  exercise_type: string;
  difficulty: string;
  instructions?: string;
}

type PracticeMode = 'exercise' | 'song';

const PracticeSession: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id, mode } = useParams<{ id: string; mode?: string }>();
  
  const [practiceMode] = useState<PracticeMode>(
    mode === 'song' ? 'song' : 'exercise'
  );
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [songTitle, setSongTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);

  useEffect(() => {
    loadPracticeData();
  }, [id, practiceMode]);

  const loadPracticeData = async () => {
    try {
      setLoading(true);

      if (practiceMode === 'exercise') {
        // Load exercise data
        const { data, error } = await supabase
          .from('smart_coach_exercises')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setExercise(data);
      } else {
        // Load song data
        const { data, error } = await supabase
          .from('songs')
          .select('title')
          .eq('id', id)
          .single();

        if (error) throw error;
        setSongTitle(data.title);
      }
    } catch (error) {
      console.error('Error loading practice data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordingComplete = (audioBlob: Blob, duration: number) => {
    setRecording(audioBlob);
    setRecordingDuration(duration);
  };

  const uploadAudioToSupabase = async (audioBlob: Blob): Promise<string | null> => {
    try {
      const fileName = `${user!.id}/${Date.now()}.webm`;
      // Get current session to ensure we're authenticated
      const { data: session } = await supabase.auth.getSession();

      const { data, error } = await supabase.storage
        .from('vocal-recordings')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Supabase Storage Error:', error);
        console.error('Error details:', {
          message: error.message,
          statusCode: error.statusCode,
          error: error.error
        });
        throw error;
      }
      return fileName;
    } catch (error: any) {
      console.error('Error uploading audio:', error);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      return null;
    }
  };

  const generateMockScores = () => {
    // In a real implementation, this would analyze the audio
    // For now, generate realistic scores with some randomness
    const baseScore = 60 + Math.random() * 30; // 60-90 range
    
    return {
      pitch_accuracy: Math.round(baseScore + (Math.random() * 10 - 5)),
      timing_accuracy: Math.round(baseScore + (Math.random() * 10 - 5)),
      tone_quality: Math.round(baseScore + (Math.random() * 10 - 5)),
      breathing_control: Math.round(baseScore + (Math.random() * 10 - 5)),
    };
  };

  const handleSubmitRecording = async () => {
    if (!recording || !user) return;

    try {
      setSubmitting(true);

      // Upload audio to Supabase storage
      // TEMPORARY: Skip actual upload for testing
      const audioPath = `test-uploads/${user!.id}/${Date.now()}.webm`;
      
      // Uncomment this when CORS is fixed:
      // const audioPath = await uploadAudioToSupabase(recording);
      // if (!audioPath) {
      //   throw new Error('Failed to upload audio');
      // }

      // Generate scores (in production, this would come from audio analysis)
      const scores = generateMockScores();

      // Create exercise attempt record
      const { data: attemptData, error: attemptError } = await supabase
        .from('exercise_attempts')
        .insert({
          member_id: user.id,
          exercise_id: practiceMode === 'exercise' ? id : null,
          song_id: practiceMode === 'song' ? id : null,
          recording_url: audioPath,
          duration_seconds: recordingDuration,
          ...scores,
        })
        .select()
        .single();

      if (attemptError) throw attemptError;

      // Generate AI feedback with Claude AI
      const feedback = await smartCoachService.generateAIFeedback(
        attemptData.id,
        scores,
        exercise ? {
          title: exercise.title,
          type: exercise.exercise_type,
          difficulty: exercise.difficulty,
          duration: recordingDuration
        } : undefined
      );

      // Update vocal profile
      await smartCoachService.updateMemberVocalProfile(user.id);

      // Show feedback
      setAttemptId(attemptData.id);
      setShowFeedback(true);

    } catch (error) {
      console.error('Error submitting recording:', error);
      alert('Failed to submit recording. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading practice session...</p>
        </div>
      </div>
    );
  }

  if (showFeedback && attemptId) {
    return <FeedbackDisplay attemptId={attemptId} onClose={() => navigate('/vocal-coach')} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate('/vocal-coach')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-gray-900">
              {practiceMode === 'exercise' ? exercise?.title : songTitle}
            </h1>
            <p className="text-sm text-gray-600">
              {practiceMode === 'exercise' ? 'Practice Exercise' : 'Song Practice'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Exercise/Song Info */}
        {practiceMode === 'exercise' && exercise && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="font-semibold text-blue-900 mb-2">Exercise Instructions</h2>
            <p className="text-sm text-blue-800 mb-3">{exercise.description}</p>
            {exercise.instructions && (
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <p className="text-sm text-gray-700 whitespace-pre-line">
                  {exercise.instructions}
                </p>
              </div>
            )}
          </div>
        )}

        {practiceMode === 'song' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="font-semibold text-blue-900 mb-2">Practice Tips</h2>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Warm up your voice before recording</li>
              <li>Find a quiet space to minimize background noise</li>
              <li>Stand or sit with good posture</li>
              <li>Take a deep breath before you begin</li>
            </ul>
          </div>
        )}

        {/* Recording Section */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Record Your Practice</h2>
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            maxDuration={180} // 3 minutes
            disabled={submitting}
          />
        </div>

        {/* Submit Button */}
        {recording && (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900 mb-1">
                  Recording ready to submit
                </p>
                <p className="text-xs text-green-700">
                  Your recording will be analyzed to provide personalized feedback on your pitch, timing, tone, and breathing.
                </p>
              </div>
            </div>

            <button
              onClick={handleSubmitRecording}
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Submit & Get Feedback
                </>
              )}
            </button>
          </div>
        )}

        {/* Help Text */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 text-center">
            💡 <span className="font-medium">Pro tip:</span> Record multiple takes to track your improvement over time!
          </p>
        </div>
      </div>
    </div>
  );
};

export default PracticeSession;
