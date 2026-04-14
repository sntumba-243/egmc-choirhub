import { supabase } from '../lib/supabase';

interface VocalAnalysis {
  exerciseTitle: string;
  exerciseType: string;
  difficulty: string;
  scores: {
    pitch_accuracy: number;
    timing_accuracy: number;
    tone_quality: number;
    breathing_control: number;
  };
  duration: number;
  practiceHistory?: any[];
}

async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export const aiCoachService = {
  /**
   * Generate personalized AI feedback using Claude (via server-side API)
   */
  async generatePersonalizedFeedback(analysis: VocalAnalysis): Promise<string> {
    try {
      console.log('📊 Analysis:', analysis);

      const avgScore = (
        analysis.scores.pitch_accuracy +
        analysis.scores.timing_accuracy +
        analysis.scores.tone_quality +
        analysis.scores.breathing_control
      ) / 4;

      const prompt = `You are an expert vocal coach providing personalized feedback to a choir member.

Exercise Details:
- Title: ${analysis.exerciseTitle}
- Type: ${analysis.exerciseType}
- Difficulty: ${analysis.difficulty}
- Duration: ${analysis.duration} seconds

Performance Scores (0-100):
- Pitch Accuracy: ${analysis.scores.pitch_accuracy}%
- Timing Accuracy: ${analysis.scores.timing_accuracy}%
- Tone Quality: ${analysis.scores.tone_quality}%
- Breathing Control: ${analysis.scores.breathing_control}%
- Overall Average: ${avgScore.toFixed(1)}%

Please provide:
1. A brief, encouraging assessment (2-3 sentences)
2. Specific strengths to celebrate
3. ONE main area to focus on for improvement
4. A practical tip they can use in their next practice

Keep the tone warm, supportive, and motivating. Use emojis where appropriate. Be concise but specific.`;

      console.log('🤖 Calling AI Coach API...');

      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const res = await fetch('/api/ai-coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const message = await res.json();

      console.log('✅ AI Coach API response received!');

      const feedback = message.content[0].type === 'text'
        ? message.content[0].text
        : 'Great practice session! Keep up the good work!';

      console.log('📝 Generated feedback:', feedback);
      return feedback;

    } catch (error) {
      console.error('❌ Error generating AI feedback:', error);

      // Fallback feedback if API fails
      const avgScore = (
        analysis.scores.pitch_accuracy +
        analysis.scores.timing_accuracy +
        analysis.scores.tone_quality +
        analysis.scores.breathing_control
      ) / 4;

      if (avgScore >= 85) {
        return '🌟 Excellent practice session! Your technique is really coming together. Keep maintaining this level of consistency!';
      } else if (avgScore >= 70) {
        return '👍 Good work! You\'re making solid progress. Focus on maintaining steady breath support and you\'ll see even better results.';
      } else {
        return '💪 Every practice session helps you improve! Focus on one element at a time, starting with your breathing technique. You\'ve got this!';
      }
    }
  }
};
