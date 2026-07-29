import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Music, Calendar, Mail } from 'lucide-react';
import { songsService, eventsService, messagesService, directMessagesService } from '../lib/database';
import { createSearcher, SONG_KEYS, EVENT_KEYS, MESSAGE_KEYS } from '../lib/smartSearch';

interface SearchResult {
  type: 'song' | 'event' | 'message';
  id: string;
  title: string;
  subtitle?: string;
}

interface GlobalSearchProps {
  onNavigate: (type: string, id: string) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onNavigate }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounce — this fires four network fetches per run.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    const searchData = async () => {
      setLoading(true);
      try {
        const [songs, events, messages, directMessages] = await Promise.all([
          songsService.getSongs(),
          eventsService.getEvents(),
          messagesService.getMessages(),
          directMessagesService.getDirectMessages(),
        ]);

        // Each entity type ranks independently (fuzzy, accent/typo-tolerant),
        // then the ranked groups concatenate in songs → events → messages order.
        const searchResults: SearchResult[] = [
          ...createSearcher(songs as any[], SONG_KEYS)(q).map(song => ({
            type: 'song' as const,
            id: song.id,
            title: song.title,
            subtitle: song.composer,
          })),
          ...createSearcher(events as any[], EVENT_KEYS)(q).map(event => ({
            type: 'event' as const,
            id: event.id,
            title: event.title,
            subtitle: new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
          })),
          ...createSearcher(messages as any[], MESSAGE_KEYS)(q).map(message => ({
            type: 'message' as const,
            id: message.id,
            title: message.subject,
            subtitle: `Message to ${message.send_to}`,
          })),
          ...createSearcher(directMessages as any[], MESSAGE_KEYS)(q).map(message => ({
            type: 'message' as const,
            id: message.id,
            title: message.subject,
            subtitle: 'Direct Message',
          })),
        ];

        setResults(searchResults);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    searchData();
  }, [debouncedQuery]);

  const handleResultClick = (result: SearchResult) => {
    onNavigate(result.type, result.id);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'song':
        return <Music className="w-5 h-5 text-blue-700" />;
      case 'event':
        return <Calendar className="w-5 h-5 text-green-700" />;
      case 'message':
        return <Mail className="w-5 h-5 text-purple-700" />;
      default:
        return <Search className="w-5 h-5 text-gray-700" />;
    }
  };

  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search songs, events, messages..."
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-3 animate-pulse" />
              <p>Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>No results found for "{query}"</p>
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(groupedResults).map(([type, items]) => (
                <div key={type}>
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <span className="text-xs font-semibold text-gray-700 uppercase">
                      {type}s ({items.length})
                    </span>
                  </div>
                  {items.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleResultClick(result)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      {getIcon(result.type)}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{result.title}</p>
                        {result.subtitle && (
                          <p className="text-sm text-gray-600 truncate">{result.subtitle}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
