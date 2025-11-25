with open('src/pages/member/VocalCoach.tsx', 'r') as f:
    content = f.read()

# Add reference_audio_url to Assignment interface
content = content.replace(
    """  due_date: string | null;
  notes: string | null;
  completed: boolean;""",
    """  due_date: string | null;
  notes: string | null;
  completed: boolean;
  reference_audio_url: string | null;"""
)

# Add state for playing reference audio
if "playingReference" not in content:
    content = content.replace(
        "const [assignments, setAssignments] = useState<Assignment[]>([]);",
        """const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [playingReference, setPlayingReference] = useState<string | null>(null);
  const referenceAudioRef = useRef<HTMLAudioElement | null>(null);"""
    )

# Add useRef if not imported
if "useRef" not in content.split("from 'react'")[0]:
    content = content.replace(
        "import { useState, useEffect } from 'react';",
        "import { useState, useEffect, useRef } from 'react';"
    )

# Add Play and Pause icons if not imported
if "Play," not in content and "Play " not in content:
    content = content.replace(
        "import {",
        "import { Play, Pause,"
    )
elif "Pause" not in content:
    content = content.replace(
        "import { Play,",
        "import { Play, Pause,"
    )

# Add reference audio player function
if "toggleReferenceAudio" not in content:
    content = content.replace(
        "const handleMarkComplete = async",
        """const toggleReferenceAudio = (url: string, id: string) => {
    if (playingReference === id) {
      referenceAudioRef.current?.pause();
      setPlayingReference(null);
    } else {
      if (referenceAudioRef.current) {
        referenceAudioRef.current.src = url;
        referenceAudioRef.current.play();
        setPlayingReference(id);
      }
    }
  };

  const handleMarkComplete = async"""
    )

# Add audio element to the JSX (after the first return div)
if "referenceAudioRef" not in content or "<audio ref={referenceAudioRef}" not in content:
    content = content.replace(
        'return (\n    <div className="',
        '''return (
    <div className="'''
    )
    # Add audio element after the opening div
    content = content.replace(
        '<div className="p-4 sm:p-6 pb-20">',
        '''<div className="p-4 sm:p-6 pb-20">
      <audio ref={referenceAudioRef} onEnded={() => setPlayingReference(null)} />'''
    )

# Add reference audio button before the notes section
old_notes = """                {assignment.notes && (
                  <p className="text-sm text-gray-600 mb-3">{assignment.notes}</p>
                )}

                <div className="flex space-x-2">
                  {assignment.assignment_type === 'song' ? ("""

new_notes = """                {/* Reference Audio */}
                {assignment.reference_audio_url && (
                  <div className="mb-3 p-2 bg-indigo-50 rounded-lg">
                    <button
                      onClick={() => toggleReferenceAudio(assignment.reference_audio_url!, assignment.id)}
                      className="flex items-center gap-2 text-sm text-indigo-700 hover:text-indigo-900 w-full"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        playingReference === assignment.id ? 'bg-indigo-600' : 'bg-indigo-500'
                      } text-white`}>
                        {playingReference === assignment.id ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </div>
                      <span className="font-medium">
                        {playingReference === assignment.id ? 'Pause' : 'Listen to Reference'}
                      </span>
                    </button>
                  </div>
                )}

                {assignment.notes && (
                  <p className="text-sm text-gray-600 mb-3">{assignment.notes}</p>
                )}

                <div className="flex space-x-2">
                  {assignment.assignment_type === 'song' ? ("""

content = content.replace(old_notes, new_notes)

with open('src/pages/member/VocalCoach.tsx', 'w') as f:
    f.write(content)

print("✅ Added reference audio player to member view!")
