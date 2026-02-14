import { supabase } from '../lib/supabase';

export interface VocalRatings {
  key_accuracy: number;
  tone_quality: number;
  note_accuracy: number;
  breathing: number;
  rhythm: number;
}

export interface VocalAnalysisResult {
  overall_score: number;
  summary: string;
  details: {
    key: string;
    tone: string;
    notes: string;
    breathing: string;
    rhythm: string;
  };
  suggestions: string[];
  encouragement: string;
}

export async function generateVocalFeedback(
  ratings: VocalRatings,
  context: {
    songTitle?: string;
    exerciseTitle?: string;
    voicePart?: string;
    memberName?: string;
    directorNotes?: string;
  }
): Promise<VocalAnalysisResult> {
  const overall = Math.round(
    ((ratings.key_accuracy + ratings.tone_quality + ratings.note_accuracy +
      ratings.breathing + ratings.rhythm) / 25) * 100
  );
  return generateLocalFeedback(ratings, context, overall);
}

function generateLocalFeedback(
  ratings: VocalRatings,
  context: { songTitle?: string; exerciseTitle?: string; voicePart?: string; memberName?: string; directorNotes?: string },
  overall: number
): VocalAnalysisResult {
  const name = context.memberName?.split(' ')[0] || 'the member';
  const piece = context.songTitle || context.exerciseTitle || 'this piece';
  const voice = context.voicePart || '';

  const getDetail = (score: number, area: string): string => {
    const t: Record<string, Record<number, string>> = {
      key: {
        1: `Significant pitch issues throughout. ${name} is singing in a different key. Recommend scale exercises in the correct key before attempting the full song.`,
        2: `Frequent pitch drift, especially during transitions. Starting key is correct but ${name} tends to go flat/sharp during longer phrases. Focus on ear training with a reference pitch.`,
        3: `Generally on key with occasional wandering. Main melodies are correct but some intervals are slightly off. Practice tricky intervals slowly with a piano or tuner.`,
        4: `Good key accuracy throughout most of the piece. Only minor pitch issues in more challenging passages. Nearly performance-ready.`,
        5: `Excellent pitch accuracy. ${name} stays perfectly in key throughout, even during difficult modulations and intervals. Outstanding ear and vocal control.`,
      },
      tone: {
        1: `Tone quality needs significant work. Voice sounds strained and unsupported. Focus on relaxing the throat, proper posture, and singing from the diaphragm.`,
        2: `Tone is inconsistent — sometimes pleasant but often thin or forced. Work on maintaining a consistent, open sound. Lip trills and humming exercises will help.`,
        3: `Decent tone quality with room for improvement. Mid-range sounds good but higher/lower notes lose richness. Practice vowel exercises across the range.`,
        4: `Very pleasant tone quality. ${name}'s ${voice} voice has good resonance and warmth. Minor improvements in extreme ranges, but overall very nice sound.`,
        5: `Beautiful, rich tone quality throughout. ${name} has a naturally expressive ${voice} voice with excellent resonance. Consistent across all dynamics and ranges.`,
      },
      notes: {
        1: `Many wrong notes. ${name} may need to re-learn the melody. Go phrase by phrase with the reference recording, singing slowly until each note is correct.`,
        2: `Several note accuracy issues, particularly in transitions. General melody shape is there but specific notes are frequently wrong. Practice with sheet music note by note.`,
        3: `Most notes correct but some passages need attention. Main melody is learned but embellishments or harmony parts have errors. Focus on specific measures that need work.`,
        4: `Good note accuracy overall. Only a few minor errors in complex sections. ${name} clearly knows the piece well, just needs to polish a few spots.`,
        5: `Excellent note accuracy. Every note is sung correctly, including challenging passages. ${name} has clearly put in significant practice time.`,
      },
      breathing: {
        1: `Breath support is a major issue. Running out of air mid-phrase and taking breaths at wrong points. Start with breathing exercises — 4 counts in, 8 counts out.`,
        2: `Breathing needs improvement. Phrases cut short with audible gasps between sections. Practice diaphragmatic breathing and mark breath points in the score.`,
        3: `Adequate breathing with some weak spots. Most phrases completed but longer passages show strain. Work on expanding lung capacity and planning breath marks.`,
        4: `Good breath control. Handles most phrases well with only occasional issues in longest passages. Nearly there — just need a bit more stamina.`,
        5: `Excellent breath control. Phrases are smooth and well-supported throughout. Great diaphragmatic technique and strategic breath placement. Professional-level control.`,
      },
      rhythm: {
        1: `Significant timing issues. Either rushing or falling behind consistently. Practice with a metronome at slower tempo and gradually increase speed.`,
        2: `Rhythm is inconsistent. Some sections in time but others drift. Pay attention to held notes (don't cut them short) and rests (don't rush past them).`,
        3: `Generally good rhythm with some timing wobbles. Main beat maintained but syncopated or complex patterns need attention. Clap the rhythm before singing it.`,
        4: `Very good rhythmic accuracy. Maintains steady tempo throughout with only minor hesitations in complex passages. Good sense of pulse.`,
        5: `Perfect rhythm and timing. Nails every rhythmic element including syncopation, held notes, and tempo changes. Great musicianship.`,
      },
    };
    return t[area]?.[score] || `${score}/5 in ${area}.`;
  };

  const weakAreas: string[] = [];
  const strongAreas: string[] = [];

  if (ratings.key_accuracy <= 2) weakAreas.push('pitch/key accuracy');
  else if (ratings.key_accuracy >= 4) strongAreas.push('pitch accuracy');
  if (ratings.tone_quality <= 2) weakAreas.push('tone quality');
  else if (ratings.tone_quality >= 4) strongAreas.push('tone quality');
  if (ratings.note_accuracy <= 2) weakAreas.push('note accuracy');
  else if (ratings.note_accuracy >= 4) strongAreas.push('note accuracy');
  if (ratings.breathing <= 2) weakAreas.push('breath control');
  else if (ratings.breathing >= 4) strongAreas.push('breath control');
  if (ratings.rhythm <= 2) weakAreas.push('rhythm');
  else if (ratings.rhythm >= 4) strongAreas.push('rhythm');

  const suggestions: string[] = [];
  if (ratings.key_accuracy <= 3) suggestions.push('Practice with a tuner or piano to lock in correct pitches');
  if (ratings.tone_quality <= 3) suggestions.push('Do 5 min of lip trills and humming before singing to warm up');
  if (ratings.note_accuracy <= 3) suggestions.push('Go through the piece slowly, phrase by phrase, with reference recording');
  if (ratings.breathing <= 3) suggestions.push('Practice breathing exercises daily: breathe in 4 counts, out 8 counts');
  if (ratings.rhythm <= 3) suggestions.push('Practice clapping the rhythm before singing, use a metronome');
  if (suggestions.length === 0) suggestions.push('Keep up the great work and maintain your practice routine');

  let summary = '';
  if (overall >= 80) {
    summary = `Great work on "${piece}"! ${name} shows strong vocal skills${strongAreas.length ? `, especially in ${strongAreas.join(' and ')}` : ''}. ${weakAreas.length ? `Minor improvements in ${weakAreas.join(' and ')}.` : 'Performance-ready!'}`;
  } else if (overall >= 60) {
    summary = `Good effort on "${piece}". ${name} is making progress${strongAreas.length ? ` — ${strongAreas.join(' and ')} looking good` : ''}. ${weakAreas.length ? `Focus on ${weakAreas.join(' and ')} next.` : 'Keep polishing!'}`;
  } else {
    summary = `"${piece}" needs more practice. ${weakAreas.length ? `Key areas: ${weakAreas.join(', ')}.` : ''} Go back to basics — slow practice with reference recording, one phrase at a time.`;
  }

  const enc = [
    'Every practice session makes you better — keep going! 🎵',
    'Even professional singers practice constantly. You\'re on the right track! 💪',
    'Your dedication shows — the choir is better with you in it! 🎶',
    'Take it one phrase at a time and you\'ll master this piece! ✨',
    'Great effort putting in the practice time. Consistency is key! 🌟',
  ];

  return {
    overall_score: overall,
    summary,
    details: {
      key: getDetail(ratings.key_accuracy, 'key'),
      tone: getDetail(ratings.tone_quality, 'tone'),
      notes: getDetail(ratings.note_accuracy, 'notes'),
      breathing: getDetail(ratings.breathing, 'breathing'),
      rhythm: getDetail(ratings.rhythm, 'rhythm'),
    },
    suggestions,
    encouragement: enc[Math.floor(Math.random() * enc.length)],
  };
}

export async function saveVocalFeedback(
  submissionId: string,
  analysis: VocalAnalysisResult,
  ratings: VocalRatings
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('song_submissions')
      .update({ ai_feedback: JSON.stringify({ analysis, ratings }), status: 'reviewed' })
      .eq('id', submissionId);
    return !error;
  } catch { return false; }
}
