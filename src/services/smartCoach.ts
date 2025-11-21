import { supabase } from '../lib/supabase';
import { aiCoachService } from './aiCoach';

interface WeakArea {
  category: string;
  severity: number;
  occurrences: number;
}

interface ExerciseAttemptScores {
  pitch_accuracy: number;
  timing_accuracy: number;
  tone_quality: number;
  breathing_control: number;
}

export const smartCoachService = {
  /**
   * Analyze member's past performance to identify weak areas
   */
  async analyzeMemberPerformance(memberId: string): Promise<WeakArea[]> {
    try {
      const { data: attempts, error } = await supabase
        .from('exercise_attempts')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (!attempts || attempts.length === 0) {
        return [];
      }

      // Calculate average scores
      const avgScores = {
        pitch: attempts.reduce((sum, a) => sum + a.pitch_accuracy, 0) / attempts.length,
        timing: attempts.reduce((sum, a) => sum + a.timing_accuracy, 0) / attempts.length,
        tone: attempts.reduce((sum, a) => sum + a.tone_quality, 0) / attempts.length,
        breathing: attempts.reduce((sum, a) => sum + a.breathing_control, 0) / attempts.length,
      };

      // Identify weak areas (below 70%)
      const weakAreas: WeakArea[] = [];
      const threshold = 70;

      if (avgScores.pitch < threshold) {
        weakAreas.push({
          category: 'pitch',
          severity: 100 - avgScores.pitch,
          occurrences: attempts.filter(a => a.pitch_accuracy < threshold).length,
        });
      }

      if (avgScores.timing < threshold) {
        weakAreas.push({
          category: 'timing',
          severity: 100 - avgScores.timing,
          occurrences: attempts.filter(a => a.timing_accuracy < threshold).length,
        });
      }

      if (avgScores.tone < threshold) {
        weakAreas.push({
          category: 'tone',
          severity: 100 - avgScores.tone,
          occurrences: attempts.filter(a => a.tone_quality < threshold).length,
        });
      }

      if (avgScores.breathing < threshold) {
        weakAreas.push({
          category: 'breathing',
          severity: 100 - avgScores.breathing,
          occurrences: attempts.filter(a => a.breathing_control < threshold).length,
        });
      }

      return weakAreas.sort((a, b) => b.severity - a.severity);
    } catch (error) {
      console.error('Error analyzing performance:', error);
      return [];
    }
  },

  /**
   * Generate personalized exercises based on weak areas
   */
  async generateSmartCoachExercises(memberId: string) {
    try {
      const weakAreas = await this.analyzeMemberPerformance(memberId);

      // Get member's voice type
      const { data: profile } = await supabase
        .from('member_vocal_profile')
        .select('voice_type')
        .eq('member_id', memberId)
        .single();

      const voiceType = profile?.voice_type || 'general';

      // Generate exercises for top 3 weak areas
      const exercises = [];

      for (const weakArea of weakAreas.slice(0, 3)) {
        const exercise = this.createExerciseForWeakArea(
          memberId,
          weakArea.category,
          weakArea.severity,
          voiceType
        );
        exercises.push(exercise);
      }

      // If no weak areas, create general exercises
      if (exercises.length === 0) {
        exercises.push(
          this.createGeneralExercise(memberId, 'breathing', voiceType),
          this.createGeneralExercise(memberId, 'tone', voiceType)
        );
      }

      // Insert exercises into database
      const { data, error } = await supabase
        .from('smart_coach_exercises')
        .insert(exercises)
        .select();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error generating exercises:', error);
      throw error;
    }
  },

  /**
   * Create an exercise targeting a specific weak area
   */
  createExerciseForWeakArea(
    memberId: string,
    category: string,
    severity: number,
    voiceType: string
  ) {
    const difficulty = severity > 40 ? 'beginner' : severity > 20 ? 'intermediate' : 'advanced';

    const exercises: any = {
      breathing: {
        title: 'Diaphragm Control Exercise',
        description: 'Focus on proper breath support and control',
        exercise_type: 'breathing',
        instructions: '1. Stand with good posture\n2. Place hand on diaphragm\n3. Breathe deeply for 4 counts\n4. Hold for 4 counts\n5. Exhale slowly for 8 counts\n6. Repeat 5 times',
      },
      timing: {
        title: 'Rhythm and Timing Drill',
        description: 'Improve your timing and rhythm accuracy',
        exercise_type: 'rhythm',
        instructions: '1. Use a metronome at 60 BPM\n2. Clap on each beat\n3. Add vocal "ta" sounds\n4. Gradually increase tempo\n5. Practice for 5 minutes',
      },
      tone: {
        title: 'Tone Quality Exercise',
        description: 'Develop a consistent, beautiful tone',
        exercise_type: 'tone',
        instructions: '1. Start with a comfortable note\n2. Sustain "ah" vowel for 8 counts\n3. Focus on steady, clear tone\n4. Move up by half-steps\n5. Repeat 5 times',
      },
      pitch: {
        title: 'Pitch Accuracy Training',
        description: 'Improve your ability to match pitches accurately',
        exercise_type: 'tone',
        instructions: '1. Use a piano or pitch pipe\n2. Play a note and match it\n3. Hold for 4 counts\n4. Check if you\'re on pitch\n5. Practice with various notes',
      },
    };

    const exercise = exercises[category] || exercises.tone;

    return {
      member_id: memberId,
      title: exercise.title,
      description: exercise.description,
      exercise_type: exercise.exercise_type,
      difficulty,
      instructions: exercise.instructions,
      target_weak_area: category,
    };
  },

  /**
   * Create a general exercise when no weak areas identified
   */
  createGeneralExercise(memberId: string, type: string, voiceType: string) {
    const exercises: any = {
      breathing: {
        title: 'Basic Breathing Technique',
        description: 'Foundation breathing exercise for all singers',
        exercise_type: 'breathing',
        difficulty: 'beginner',
        instructions: 'Practice slow, controlled breathing with focus on diaphragm support.',
      },
      tone: {
        title: 'Tone Development',
        description: 'Build a consistent, beautiful singing tone',
        exercise_type: 'tone',
        difficulty: 'beginner',
        instructions: 'Sing sustained notes focusing on tone quality and consistency.',
      },
    };

    return {
      member_id: memberId,
      ...exercises[type],
    };
  },

  /**
   * Generate AI feedback based on scores
   */
  async generateAIFeedback(
    attemptId: string,
    scores: ExerciseAttemptScores,
    exerciseDetails?: { title: string; type: string; difficulty: string; duration: number }
  ): Promise<string> {
    try {
      console.log('🤖 Generating AI feedback with Claude...');

      // Use real AI if we have exercise details
      if (exerciseDetails) {
        const feedback = await aiCoachService.generatePersonalizedFeedback({
          exerciseTitle: exerciseDetails.title,
          exerciseType: exerciseDetails.type,
          difficulty: exerciseDetails.difficulty,
          scores,
          duration: exerciseDetails.duration,
        });

        // Update the attempt with AI feedback
        await supabase
          .from('exercise_attempts')
          .update({ ai_feedback: feedback })
          .eq('id', attemptId);

        console.log('✅ AI feedback generated successfully!');
        return feedback;
      }

      // Fallback to template-based feedback
      console.log('⚠️ No exercise details - using fallback feedback');
      const feedback: string[] = [];
      const avgScore =
        (scores.pitch_accuracy + scores.timing_accuracy + scores.tone_quality + scores.breathing_control) / 4;

      if (avgScore >= 85) {
        feedback.push('🌟 Excellent work! Your practice session shows strong vocal technique across all areas.');
      } else if (avgScore >= 70) {
        feedback.push('👍 Good practice session! You\'re making solid progress.');
      } else {
        feedback.push('💪 Keep practicing! Every session helps you improve.');
      }

      const feedbackText = feedback.join(' ');
      
      await supabase
        .from('exercise_attempts')
        .update({ ai_feedback: feedbackText })
        .eq('id', attemptId);

      return feedbackText;
    } catch (error) {
      console.error('❌ Error generating feedback:', error);
      return 'Great practice session! Keep up the good work and continue practicing regularly.';
    }
  },

  /**
   * Update member's vocal profile based on recent attempts
   */
  async updateMemberVocalProfile(memberId: string) {
    try {
      const weakAreas = await this.analyzeMemberPerformance(memberId);

      // Calculate strong areas (above 85%)
      const { data: attempts } = await supabase
        .from('exercise_attempts')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!attempts || attempts.length === 0) return;

      const avgScores = {
        pitch: attempts.reduce((sum, a) => sum + a.pitch_accuracy, 0) / attempts.length,
        timing: attempts.reduce((sum, a) => sum + a.timing_accuracy, 0) / attempts.length,
        tone: attempts.reduce((sum, a) => sum + a.tone_quality, 0) / attempts.length,
        breathing: attempts.reduce((sum, a) => sum + a.breathing_control, 0) / attempts.length,
      };

      const strongAreas: string[] = [];
      if (avgScores.pitch >= 85) strongAreas.push('pitch');
      if (avgScores.timing >= 85) strongAreas.push('timing');
      if (avgScores.tone >= 85) strongAreas.push('tone');
      if (avgScores.breathing >= 85) strongAreas.push('breathing');

      // Calculate total practice time
      const totalTime = attempts.reduce((sum, a) => sum + (a.duration_seconds || 0), 0);

      // Upsert profile
      await supabase.from('member_vocal_profile').upsert({
        member_id: memberId,
        weak_areas: weakAreas.map(w => w.category),
        strong_areas: strongAreas,
        total_practice_time: totalTime,
        last_practice_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating vocal profile:', error);
    }
  },
};
