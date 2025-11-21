/**
 * Type Definitions for Vocal Coach Feature
 * 
 * These types match the Supabase database schema and are used
 * across all Vocal Coach components.
 */

// ============================================
// EXERCISE TYPES
// ============================================

export type ExerciseType = 'breathing' | 'rhythm' | 'tone' | 'range';

export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface SmartCoachExercise {
  id: string;
  member_id: string;
  title: string;
  description: string;
  exercise_type: ExerciseType;
  difficulty: ExerciseDifficulty;
  instructions?: string;
  target_weak_area?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// ATTEMPT TYPES
// ============================================

export interface ExerciseAttemptScores {
  pitch_accuracy: number;      // 0-100
  timing_accuracy: number;      // 0-100
  tone_quality: number;         // 0-100
  breathing_control: number;    // 0-100
}

export interface ExerciseAttempt extends ExerciseAttemptScores {
  id: string;
  member_id: string;
  exercise_id?: string;         // null if song practice
  song_id?: string;             // null if exercise practice
  recording_url: string;        // Supabase storage path
  duration_seconds: number;
  ai_feedback?: string;
  created_at: string;
  updated_at: string;
}

// For display with joined data
export interface ExerciseAttemptWithDetails extends ExerciseAttempt {
  exercise?: {
    title: string;
    exercise_type: ExerciseType;
  };
  song?: {
    title: string;
  };
}

// ============================================
// VOCAL PROFILE TYPES
// ============================================

export type VoiceType = 'soprano' | 'alto' | 'tenor' | 'bass' | null;

export interface MemberVocalProfile {
  id: string;
  member_id: string;
  voice_type?: VoiceType;
  weak_areas?: string[];        // JSON array
  strong_areas?: string[];      // JSON array
  practice_streak?: number;     // days
  total_practice_time?: number; // seconds
  last_practice_date?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// ASSIGNMENT TYPES
// ============================================

export interface SongAssignment {
  id: string;
  song_id: string;
  song_title: string;
  notes?: string;
  assigned_at: string;
}

// ============================================
// COMPONENT PROPS
// ============================================

export interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, audioDuration: number) => void;
  maxDuration?: number;         // seconds, default 300 (5 min)
  disabled?: boolean;
}

export interface FeedbackDisplayProps {
  attemptId: string;
  onClose: () => void;
}

export interface PracticeSessionParams {
  id: string;                   // exercise or song ID
  mode?: 'exercise' | 'song';
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface WeakArea {
  category: string;             // 'pitch', 'timing', 'tone', 'breathing'
  severity: number;             // 0-100, higher = more severe
  occurrences: number;
}

export interface GenerateExercisesResponse {
  exercises: SmartCoachExercise[];
  weak_areas: WeakArea[];
}

export interface GenerateFeedbackResponse {
  feedback: string;
  suggestions: string[];
}

// ============================================
// STATISTICS TYPES
// ============================================

export interface AverageScores {
  pitch: number;
  timing: number;
  tone: number;
  breathing: number;
  overall: number;
}

export interface PracticeStats {
  totalSessions: number;
  totalTime: number;            // seconds
  currentStreak: number;        // days
  averageScores: AverageScores;
  improvement: number;          // percentage change
  lastPracticeDate?: string;
}

export interface ProgressData {
  attempts: ExerciseAttemptWithDetails[];
  profile: MemberVocalProfile;
  stats: PracticeStats;
}

// ============================================
// FILTER TYPES
// ============================================

export type TimeRange = 'week' | 'month' | 'all';

export interface ProgressFilters {
  timeRange: TimeRange;
  exerciseType?: ExerciseType;
  minScore?: number;
  maxScore?: number;
}

// ============================================
// AUDIO RECORDING TYPES
// ============================================

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  hasRecording: boolean;
  isPlaying: boolean;
  permissionDenied: boolean;
}

export interface AudioAnalysisResult {
  scores: ExerciseAttemptScores;
  waveform?: number[];          // For visualization
  pitchData?: number[];         // Pitch over time
  volumeData?: number[];        // Volume over time
}

// ============================================
// SMART COACH SERVICE TYPES
// ============================================

export interface SmartCoachServiceInterface {
  analyzeMemberPerformance(memberId: string): Promise<WeakArea[]>;
  generateSmartCoachExercises(memberId: string): Promise<SmartCoachExercise[]>;
  generateAIFeedback(attemptId: string, scores: ExerciseAttemptScores): Promise<string>;
  updateMemberVocalProfile(memberId: string): Promise<void>;
}

// ============================================
// UTILITY TYPES
// ============================================

export type ScoreCategory = keyof ExerciseAttemptScores;

export interface ScoreDisplay {
  label: string;
  value: number;
  icon: string;
  category: ScoreCategory;
}

export interface ChartDataPoint {
  date: string;
  pitch: number;
  timing: number;
  tone: number;
  breathing: number;
  overall: number;
}

// ============================================
// ERROR TYPES
// ============================================

export interface VocalCoachError {
  code: string;
  message: string;
  details?: any;
}

export type VocalCoachErrorCode = 
  | 'PERMISSION_DENIED'
  | 'UPLOAD_FAILED'
  | 'ANALYSIS_FAILED'
  | 'FEEDBACK_GENERATION_FAILED'
  | 'PROFILE_UPDATE_FAILED'
  | 'RECORDING_FAILED'
  | 'INVALID_EXERCISE'
  | 'INVALID_SONG';

// ============================================
// CONSTANTS
// ============================================

export const SCORE_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 80,
  FAIR: 70,
  NEEDS_IMPROVEMENT: 60,
} as const;

export const EXERCISE_TYPES: Record<ExerciseType, string> = {
  breathing: 'Breathing Control',
  rhythm: 'Rhythm & Timing',
  tone: 'Tone Quality',
  range: 'Vocal Range',
} as const;

export const DIFFICULTY_LEVELS: Record<ExerciseDifficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
} as const;

export const VOICE_TYPES: Record<NonNullable<VoiceType>, string> = {
  soprano: 'Soprano',
  alto: 'Alto',
  tenor: 'Tenor',
  bass: 'Bass',
} as const;

// ============================================
// HELPER TYPE GUARDS
// ============================================

export function isExerciseType(value: string): value is ExerciseType {
  return ['breathing', 'rhythm', 'tone', 'range'].includes(value);
}

export function isExerciseDifficulty(value: string): value is ExerciseDifficulty {
  return ['beginner', 'intermediate', 'advanced'].includes(value);
}

export function isVoiceType(value: string): value is VoiceType {
  return ['soprano', 'alto', 'tenor', 'bass'].includes(value);
}

export function isValidScore(score: number): boolean {
  return score >= 0 && score <= 100;
}

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// Example 1: Type-safe exercise creation
const newExercise: SmartCoachExercise = {
  id: '123',
  member_id: 'user-456',
  title: 'Breathing Exercise',
  description: 'Focus on diaphragm control',
  exercise_type: 'breathing',
  difficulty: 'beginner',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Example 2: Type-safe attempt with scores
const attempt: ExerciseAttempt = {
  id: '789',
  member_id: 'user-456',
  exercise_id: '123',
  recording_url: 'recordings/user-456/1702345678901.webm',
  duration_seconds: 120,
  pitch_accuracy: 85,
  timing_accuracy: 78,
  tone_quality: 90,
  breathing_control: 82,
  ai_feedback: 'Great work on tone quality...',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Example 3: Type-safe vocal profile
const profile: MemberVocalProfile = {
  id: 'profile-1',
  member_id: 'user-456',
  voice_type: 'tenor',
  weak_areas: ['pitch', 'breathing'],
  strong_areas: ['tone', 'rhythm'],
  practice_streak: 7,
  total_practice_time: 3600,
  last_practice_date: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
*/
