import React, { useState, useRef, useEffect } from 'react';
import { Lightbulb, Send, X, Music, PlayCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const vocalCoachResponses: Record<string, string> = {
  'breathing': "Great question! Here are 3 breathing techniques:\n\n1. **Diaphragmatic Breathing**: Place your hand on your belly. Breathe in through your nose for 4 counts (belly expands), hold for 2, exhale through mouth for 6.\n\n2. **Rib Expansion**: Place hands on sides of ribs. Breathe in deeply feeling ribs expand outward.\n\n3. **Sustained Breathing**: Breathe in for 4 counts, hold for 4, exhale on 'sss' sound for 8-12 counts. Repeat 5 times.",
  'warm-up': "Here are essential vocal warm-ups:\n\n1. **Lip Trills**: Buzz your lips while sliding up and down your range (2 min)\n\n2. **Sirens**: Slide from lowest to highest note on 'oo' sound (1 min)\n\n3. **5-Note Scale**: Sing 'do-re-mi-fa-sol-fa-mi-re-do' on different vowels (3 min)\n\n4. **Tongue Twisters**: 'Unique New York' to warm up articulation (1 min)\n\nDo these for 7-10 minutes before singing!",
  'high notes': "Singing higher notes tips:\n\n1. **Don't reach up**: Think of notes going 'down and out' rather than 'up'\n\n2. **Open throat**: Yawn gently to feel open space in throat\n\n3. **Support from below**: Engage core muscles, don't push from throat\n\n4. **Vowel modification**: Slightly darken vowels as you go higher (ah → aw)\n\n5. **Practice sirens**: Slide into high notes rather than jumping\n\nRemember: Never force or strain!",
  'pitch': "Improving pitch accuracy:\n\n1. **Ear Training**: Use apps like Perfect Ear or EarMaster daily (10 min)\n\n2. **Match Pitch Exercise**: Play a note on piano, sing it back. Start with comfortable range.\n\n3. **Slow Practice**: Sing songs very slowly to focus on hitting each note precisely\n\n4. **Record Yourself**: Listen back to identify pitch issues\n\n5. **Vocal Sirens**: Helps develop smooth pitch transitions\n\nPractice 15-20 minutes daily for best results!",
  'default': "I'm your AI vocal coach! I can help with:\n\n• Breathing techniques\n• Vocal warm-ups\n• Singing high notes\n• Pitch accuracy\n• Performance tips\n• Vocal health\n\nWhat would you like to work on?"
};

export const MemberPractice: React.FC = () => {
  const [showChat, setShowChat] = useState(false);
  const [showWarmup, setShowWarmup] = useState(false);
  const [showPitch, setShowPitch] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '👋 Hi! I\'m your AI Practice Assistant. I can help you with vocal techniques, breathing exercises, and practice tips. What would you like to work on today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getResponse = (query: string): string => {
    const q = query.toLowerCase();
    if (q.includes('breath')) return vocalCoachResponses.breathing;
    if (q.includes('warm')) return vocalCoachResponses['warm-up'];
    if (q.includes('high') || q.includes('note')) return vocalCoachResponses['high notes'];
    if (q.includes('pitch') || q.includes('tune') || q.includes('accuracy')) return vocalCoachResponses.pitch;
    return vocalCoachResponses.default;
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    // Simulate thinking delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const response = getResponse(userMessage);
    setMessages([...newMessages, { role: 'assistant', content: response }]);
    setLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickPrompts = [
    "How do I improve my breathing?",
    "What are good vocal warm-ups?",
    "How to sing higher notes?",
    "Tips for pitch accuracy"
  ];

  return (
    <div className="space-y-6 pb-6">
      <h1 className="text-2xl font-bold text-gray-900">Practice Studio</h1>

      {/* AI Practice Assistant Card */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Lightbulb className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">AI Practice Assistant</h2>
            <p className="text-indigo-100">Your personal vocal coach</p>
          </div>
        </div>
        <button
          onClick={() => setShowChat(true)}
          className="w-full bg-white text-purple-600 font-semibold py-3 rounded-lg hover:bg-purple-50 transition-all shadow-md"
        >
          Start Practice Session
        </button>
      </div>

      {/* Quick Practice Section */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Quick Practice</h3>
        <div className="space-y-3">
          <button 
            onClick={() => setShowWarmup(true)}
            className="w-full bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Music className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Vocal Warm-ups</h4>
                <p className="text-sm text-gray-600">15 min guided exercises</p>
              </div>
            </div>
          </button>

          <button 
            onClick={() => setShowPitch(true)}
            className="w-full bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-green-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <PlayCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Pitch Training</h4>
                <p className="text-sm text-gray-600">Interactive ear training</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Warmup Modal */}
      {showWarmup && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Vocal Warm-ups</h2>
              <button onClick={() => setShowWarmup(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <p className="font-medium">15-Minute Warm-up Routine:</p>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="font-semibold text-blue-900">1. Lip Trills (2 min)</p>
                <p className="text-blue-700 text-xs mt-1">Buzz your lips while sliding up and down</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="font-semibold text-blue-900">2. Sirens (2 min)</p>
                <p className="text-blue-700 text-xs mt-1">Slide from low to high on 'oo' sound</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="font-semibold text-blue-900">3. Scale Exercises (5 min)</p>
                <p className="text-blue-700 text-xs mt-1">Do-re-mi-fa-sol on different vowels</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="font-semibold text-blue-900">4. Articulation (3 min)</p>
                <p className="text-blue-700 text-xs mt-1">Tongue twisters and consonant exercises</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="font-semibold text-blue-900">5. Full Range (3 min)</p>
                <p className="text-blue-700 text-xs mt-1">Gentle scales through entire range</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pitch Training Modal */}
      {showPitch && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Pitch Training</h2>
              <button onClick={() => setShowPitch(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <p className="font-medium">Pitch Accuracy Exercises:</p>
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="font-semibold text-green-900">Match the Pitch</p>
                <p className="text-green-700 text-xs mt-1">Play a note, sing it back accurately</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="font-semibold text-green-900">Interval Training</p>
                <p className="text-green-700 text-xs mt-1">Practice jumping between notes</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="font-semibold text-green-900">Slow Practice</p>
                <p className="text-green-700 text-xs mt-1">Sing songs at half speed for accuracy</p>
              </div>
              <p className="text-gray-600 text-xs mt-4">💡 Tip: Record yourself and listen back to identify pitch issues</p>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Modal */}
      {showChat && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Lightbulb className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">AI Practice Assistant</h2>
                  <p className="text-xs text-purple-100">Ask me anything about vocal technique!</p>
                </div>
              </div>
              <button onClick={() => setShowChat(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((message, index) => (
                <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user' ? 'bg-purple-600 text-white' : 'bg-white text-gray-900 border border-gray-200'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {messages.length === 1 && (
              <div className="px-4 py-2 border-t border-gray-200 bg-white">
                <p className="text-xs text-gray-500 mb-2">Quick questions:</p>
                <div className="flex flex-wrap gap-2">
                  {quickPrompts.map((prompt, index) => (
                    <button key={index} onClick={() => setInput(prompt)} className="text-xs px-3 py-1.5 bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100 transition-colors">
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about singing..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={loading}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
