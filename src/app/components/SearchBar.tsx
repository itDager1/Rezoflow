import { Search, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = [
    'Математика - квадратные уравнения',
    'Физика - законы Ньютона',
    'Химия - органические соединения',
    'История - Вторая мировая война',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
    setShowSuggestions(false);
  };

  return (
    <div className="relative w-full">
      <form onSubmit={handleSubmit} className="relative group">
        {/* Glow effect behind the input */}
        
        <div className="relative flex items-center">
          
          
        </div>
      </form>

      <AnimatePresence>
        {showSuggestions && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-4 w-full bg-[#1A1A1A]/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] z-50 overflow-hidden"
          >
            <div className="p-3">
              <div className="px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Популярные запросы</div>
              <div className="space-y-1 mt-1">
                {suggestions
                  .filter((s) => s.toLowerCase().includes(query.toLowerCase()))
                  .map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setQuery(suggestion);
                        onSearch(suggestion);
                        setShowSuggestions(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-all text-white/80 hover:text-white group"
                    >
                      <Search className="w-4 h-4 text-white/20 group-hover:text-primary transition-colors" />
                      <span className="text-left">{suggestion}</span>
                    </button>
                  ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
