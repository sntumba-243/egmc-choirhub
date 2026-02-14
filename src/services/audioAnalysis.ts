/**
 * Audio Analysis Service — Real pitch detection, rhythm, tone & breathing analysis.
 * Uses Web Audio API + YIN pitch detection. Runs in browser, no API needed.
 */

export interface AudioAnalysisScores {
  pitch_stability: number;
  tone_quality: number;
  note_accuracy: number;
  breathing: number;
  rhythm: number;
}

export interface AnalysisProgress {
  stage: string;
  percent: number;
}

function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  const SIZE = buffer.length;
  const minFreq = 60;
  const maxFreq = 1200;
  const minPeriod = Math.floor(sampleRate / maxFreq);
  const maxPeriod = Math.floor(sampleRate / minFreq);
  const threshold = 0.15;

  const yinLen = Math.min(SIZE / 2, maxPeriod + 1);
  const yinBuffer = new Float32Array(yinLen);
  yinBuffer[0] = 1;

  let runningSum = 0;
  for (let tau = 1; tau < yinLen; tau++) {
    let sum = 0;
    for (let i = 0; i < yinLen; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    runningSum += sum;
    yinBuffer[tau] = runningSum === 0 ? 1 : (sum * tau) / runningSum;
  }

  let bestTau = -1;
  for (let tau = minPeriod; tau < Math.min(yinLen, maxPeriod); tau++) {
    if (yinBuffer[tau] < threshold) {
      while (tau + 1 < yinLen && yinBuffer[tau + 1] < yinBuffer[tau]) tau++;
      bestTau = tau;
      break;
    }
  }
  if (bestTau === -1) return null;

  const s0 = yinBuffer[bestTau - 1] ?? yinBuffer[bestTau];
  const s1 = yinBuffer[bestTau];
  const s2 = yinBuffer[bestTau + 1] ?? yinBuffer[bestTau];
  const betterTau = bestTau + (s0 - s2) / (2 * (s0 - 2 * s1 + s2) || 1);
  return sampleRate / betterTau;
}

function getRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

function getSpectralCentroid(frame: Float32Array, sampleRate: number): number {
  let wSum = 0, tMag = 0;
  for (let i = 0; i < frame.length; i++) {
    const mag = Math.abs(frame[i]);
    wSum += mag * (i * sampleRate) / (frame.length * 2);
    tMag += mag;
  }
  return tMag > 0 ? wSum / tMag : 0;
}

function detectOnsets(data: Float32Array, sr: number): number[] {
  const frameSize = 1024, hopSize = 512;
  const onsets: number[] = [];
  let prevE = 0;
  const history: number[] = [];

  for (let i = 0; i < data.length - frameSize; i += hopSize) {
    const e = getRMS(data.slice(i, i + frameSize));
    history.push(e);
    const avg = history.slice(-10).reduce((s, v) => s + v, 0) / Math.min(history.length, 10);
    if (e > avg * 1.8 && e > prevE * 1.3 && e > 0.02) {
      const t = i / sr;
      if (!onsets.length || t - onsets[onsets.length - 1] > 0.1) onsets.push(t);
    }
    prevE = e;
  }
  return onsets;
}

interface PhraseInfo { start: number; end: number; duration: number; }

function detectPhrases(data: Float32Array, sr: number): { phrases: PhraseInfo[]; silences: number[] } {
  const hop = 1024, frame = 2048, silTh = 0.015;
  const phrases: PhraseInfo[] = [];
  const silences: number[] = [];
  let inPhrase = false, phraseStart = 0, silStart = 0, wasSilent = true;

  for (let i = 0; i < data.length - frame; i += hop) {
    const rms = getRMS(data.slice(i, i + frame));
    const t = i / sr;
    const isSilent = rms < silTh;

    if (!isSilent && wasSilent) {
      if (inPhrase && t - silStart >= 0.15) {
        const dur = silStart - phraseStart;
        if (dur >= 0.5) phrases.push({ start: phraseStart, end: silStart, duration: dur });
        silences.push(t - silStart);
        phraseStart = t;
      } else if (!inPhrase) phraseStart = t;
      inPhrase = true;
    } else if (isSilent && !wasSilent) silStart = t;
    wasSilent = isSilent;
  }

  if (inPhrase) {
    const end = wasSilent ? silStart : data.length / sr;
    const dur = end - phraseStart;
    if (dur >= 0.5) phrases.push({ start: phraseStart, end, duration: dur });
  }
  return { phrases, silences };
}

function interpolate(arr: number[], len: number): number[] {
  const r: number[] = [];
  for (let i = 0; i < len; i++) {
    const pos = (i / len) * arr.length;
    const lo = Math.floor(pos), hi = Math.min(lo + 1, arr.length - 1);
    r.push(arr[lo] * (1 - (pos - lo)) + arr[hi] * (pos - lo));
  }
  return r;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

export async function analyzeAudio(
  audioUrl: string,
  referenceUrl?: string | null,
  onProgress?: (p: AnalysisProgress) => void
): Promise<AudioAnalysisScores> {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

  try {
    onProgress?.({ stage: 'Loading audio...', percent: 5 });
    const res = await fetch(audioUrl);
    const buf = await ctx.decodeAudioData(await res.arrayBuffer());
    const raw = buf.getChannelData(0);
    const sr = buf.sampleRate;
    const dur = buf.duration;

    if (dur < 3) {
      onProgress?.({ stage: 'Recording too short', percent: 100 });
      return { pitch_stability: 3, tone_quality: 3, note_accuracy: 3, breathing: 2, rhythm: 3 };
    }

    onProgress?.({ stage: 'Detecting pitch...', percent: 20 });
    const frameSize = 2048, hopSize = 1024;
    const pitches: number[] = [], volumes: number[] = [];

    for (let i = 0; i < raw.length - frameSize; i += hopSize) {
      const frame = raw.slice(i, i + frameSize);
      if (getRMS(frame) > 0.02) {
        const p = detectPitch(frame, sr);
        if (p && p > 50 && p < 1500) { pitches.push(p); volumes.push(getRMS(frame)); }
      }
    }

    onProgress?.({ stage: 'Analyzing tone quality...', percent: 40 });
    const centroids: number[] = [];
    for (let i = 0; i < raw.length - 4096; i += 4096) {
      const frame = raw.slice(i, i + 4096);
      if (getRMS(frame) > 0.02) centroids.push(getSpectralCentroid(frame, sr));
    }

    onProgress?.({ stage: 'Analyzing rhythm...', percent: 60 });
    const onsets = detectOnsets(raw, sr);

    onProgress?.({ stage: 'Analyzing breathing...', percent: 75 });
    const { phrases, silences } = detectPhrases(raw, sr);

    onProgress?.({ stage: 'Calculating scores...', percent: 90 });

    let pitchScore = 3;
    if (pitches.length > 10) {
      const cents = pitches.map(p => 1200 * Math.log2(p / pitches[0]));
      const winSize = 10;
      const vars: number[] = [];
      for (let i = 0; i < cents.length - winSize; i++) {
        const w = cents.slice(i, i + winSize);
        const m = w.reduce((s, v) => s + v, 0) / w.length;
        vars.push(w.reduce((s, v) => s + (v - m) ** 2, 0) / w.length);
      }
      const std = Math.sqrt(vars.reduce((s, v) => s + v, 0) / (vars.length || 1));
      if (std < 15) pitchScore = 5;
      else if (std < 30) pitchScore = 4;
      else if (std < 60) pitchScore = 3;
      else if (std < 100) pitchScore = 2;
      else pitchScore = 1;
    }

    let toneScore = 3;
    if (centroids.length > 5) {
      const avg = centroids.reduce((s, v) => s + v, 0) / centroids.length;
      const std = Math.sqrt(centroids.reduce((s, v) => s + (v - avg) ** 2, 0) / centroids.length);
      const inRange = avg > 400 && avg < 3500;
      const stable = std < avg * 0.5;
      if (inRange && stable) toneScore = 5;
      else if (inRange || stable) toneScore = 4;
      else if (avg > 200 && avg < 5000) toneScore = 3;
      else toneScore = 2;
      if (volumes.length > 10) {
        const vAvg = volumes.reduce((s, v) => s + v, 0) / volumes.length;
        const vCV = Math.sqrt(volumes.reduce((s, v) => s + (v - vAvg) ** 2, 0) / volumes.length) / (vAvg || 1);
        if (vCV > 0.8) toneScore = Math.max(1, toneScore - 1);
      }
    }

    let noteScore = 3;
    if (referenceUrl) {
      try {
        onProgress?.({ stage: 'Comparing to reference melody...', percent: 85 });
        const refBuf = await ctx.decodeAudioData(await (await fetch(referenceUrl)).arrayBuffer());
        const refRaw = refBuf.getChannelData(0);
        const refPitches: number[] = [];
        for (let i = 0; i < refRaw.length - frameSize; i += hopSize) {
          const frame = refRaw.slice(i, i + frameSize);
          if (getRMS(frame) > 0.02) {
            const p = detectPitch(frame, refBuf.sampleRate);
            if (p && p > 50 && p < 1500) refPitches.push(p);
          }
        }
        if (refPitches.length > 5 && pitches.length > 5) {
          const len = Math.min(refPitches.length, pitches.length, 100);
          const nRef = interpolate(refPitches, len).map(p => 12 * Math.log2(p / refPitches[0]));
          const nSub = interpolate(pitches, len).map(p => 12 * Math.log2(p / pitches[0]));
          const mae = nRef.reduce((s, v, i) => s + Math.abs(v - nSub[i]), 0) / len;
          if (mae < 0.5) noteScore = 5;
          else if (mae < 1.0) noteScore = 4;
          else if (mae < 2.0) noteScore = 3;
          else if (mae < 4.0) noteScore = 2;
          else noteScore = 1;
        }
      } catch { noteScore = pitchScore; }
    } else {
      if (pitches.length > 10) {
        const semi = pitches.map(p => Math.round(12 * Math.log2(p / 440)));
        const unique = new Set(semi).size;
        noteScore = (unique >= 4 && unique <= 20 && pitchScore >= 3) ? 4 : (unique >= 3 ? 3 : 2);
      }
    }

    let breathingScore = 3;
    if (phrases.length > 0) {
      const avgPL = phrases.reduce((s, p) => s + p.duration, 0) / phrases.length;
      const avgSil = silences.length > 0 ? silences.reduce((s, v) => s + v, 0) / silences.length : 0;
      if (avgPL > 6 && avgSil < 1.5) breathingScore = 5;
      else if (avgPL > 4 && avgSil < 2) breathingScore = 4;
      else if (avgPL > 2.5 && avgSil < 3) breathingScore = 3;
      else if (avgPL > 1.5) breathingScore = 2;
      else breathingScore = 1;
      if (phrases.length > 2) {
        const pls = phrases.map(p => p.duration);
        const plM = pls.reduce((s, v) => s + v, 0) / pls.length;
        const plCV = Math.sqrt(pls.reduce((s, v) => s + (v - plM) ** 2, 0) / pls.length) / (plM || 1);
        if (plCV > 0.7) breathingScore = Math.max(1, breathingScore - 1);
      }
    }

    let rhythmScore = 3;
    if (onsets.length > 4) {
      const ioi: number[] = [];
      for (let i = 1; i < onsets.length; i++) ioi.push(onsets[i] - onsets[i - 1]);
      if (ioi.length > 2) {
        const avg = ioi.reduce((s, v) => s + v, 0) / ioi.length;
        const cv = Math.sqrt(ioi.reduce((s, v) => s + (v - avg) ** 2, 0) / ioi.length) / (avg || 1);
        if (cv < 0.15) rhythmScore = 5;
        else if (cv < 0.25) rhythmScore = 4;
        else if (cv < 0.4) rhythmScore = 3;
        else if (cv < 0.6) rhythmScore = 2;
        else rhythmScore = 1;
      }
    }

    onProgress?.({ stage: 'Done!', percent: 100 });
    return {
      pitch_stability: clamp(pitchScore, 1, 5),
      tone_quality: clamp(toneScore, 1, 5),
      note_accuracy: clamp(noteScore, 1, 5),
      breathing: clamp(breathingScore, 1, 5),
      rhythm: clamp(rhythmScore, 1, 5),
    };
  } finally { ctx.close(); }
}
