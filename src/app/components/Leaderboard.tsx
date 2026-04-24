import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RefreshCw, Medal } from 'lucide-react';
import { apiRequest } from '../utils/api';

export interface LeaderboardEntry {
  name: string;
  email: string;
  studentClass: string;
  xp: number;
  updatedAt: number;
}

interface LeaderboardProps {
  currentUserEmail?: string;
  title?: string;
  listOnly?: boolean;
}

function getLevel(totalXp: number): number {
  let level = 1;
  let needed = 100;
  let rem = totalXp;
  while (rem >= needed) {
    rem -= needed;
    level++;
    needed *= 2;
  }
  return level;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function Leaderboard({ currentUserEmail, title = 'Рейтинг учеников', listOnly = false }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await apiRequest<LeaderboardEntry[]>('/leaderboard');
      setEntries(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch {
      // fail silently
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  return (
    <div className={listOnly ? '' : 'bg-[#1A1A1A]/90 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/5 shadow-2xl'}>
      {/* Header */}
      {!listOnly && (
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          {title}
        </h3>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-white/25">
              {lastUpdated.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => { setIsLoading(true); fetchLeaderboard(); }}
            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all text-white/40 hover:text-white"
            title="Обновить"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-14">
          <Medal className="w-10 h-10 text-white/15 mx-auto mb-3" />
          <p className="text-white/40 text-sm">Рейтинг пока пуст</p>
          <p className="text-white/25 text-xs mt-1">
            Выполняйте задания учителя, чтобы попасть в топ!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Top-3 podium — hidden in listOnly mode */}
          {!listOnly && entries.length >= 1 && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[entries[1], entries[0], entries[2]].map((entry, podiumIndex) => {
                if (!entry) return <div key={podiumIndex} />;
                const realRank = podiumIndex === 0 ? 2 : podiumIndex === 1 ? 1 : 3;
                const isMe = entry.email === currentUserEmail;
                const heights = ['h-24', 'h-32', 'h-20'];
                const colors = [
                  'from-slate-400/20 to-slate-600/10 border-slate-400/25',
                  'from-yellow-500/25 to-yellow-700/10 border-yellow-500/30',
                  'from-amber-600/20 to-amber-800/10 border-amber-600/25',
                ];
                return (
                  <motion.div
                    key={entry.email}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: podiumIndex * 0.1 }}
                    className={`flex flex-col items-center justify-end rounded-2xl border bg-gradient-to-b ${colors[podiumIndex]} ${heights[podiumIndex]} px-2 pb-3 relative ${isMe ? 'ring-2 ring-primary/40' : ''}`}
                  >
                    <span className="text-2xl mb-1">{MEDALS[realRank - 1]}</span>
                    <p className={`text-xs font-semibold truncate w-full text-center ${isMe ? 'text-primary' : 'text-white'}`}>
                      {entry.name.split(' ')[0]}
                    </p>
                    <p className="text-[10px] text-white/40 font-bold">{entry.xp.toLocaleString('ru-RU')} XP</p>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Full list */}
          <AnimatePresence initial={false}>
            {entries.map((entry, index) => {
              const rank = index + 1;
              const isMe = entry.email === currentUserEmail;
              const level = getLevel(entry.xp);

              return (
                <motion.div
                  key={entry.email}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.025, 0.3) }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                    isMe
                      ? 'bg-primary/15 border-primary/35 shadow-[0_0_20px_rgba(139,92,246,0.12)]'
                      : rank === 1
                      ? 'bg-yellow-500/[0.06] border-yellow-500/20'
                      : rank === 2
                      ? 'bg-slate-400/[0.05] border-slate-400/15'
                      : rank === 3
                      ? 'bg-amber-700/[0.05] border-amber-700/20'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                  }`}
                >
                  {/* Rank badge */}
                  <div className="w-9 text-center shrink-0">
                    {rank <= 3 ? (
                      <span className="text-lg leading-none">{MEDALS[rank - 1]}</span>
                    ) : (
                      <span className="text-sm font-bold text-white/30">#{rank}</span>
                    )}
                  </div>

                  {/* Avatar circle */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${
                    isMe
                      ? 'bg-primary/30 text-primary border-2 border-primary/50'
                      : 'bg-white/10 text-white/70 border-2 border-white/15'
                  }`} style={{ fontSize: listOnly ? '1rem' : '0.75rem' }}>
                    {entry.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Name & class */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-sm font-semibold truncate ${isMe ? 'text-primary' : rank === 1 ? 'text-yellow-300' : 'text-white'}`}>
                        {entry.name}
                      </span>
                      {isMe && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary/80 rounded border border-primary/20 shrink-0">
                          вы
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {entry.studentClass && (
                        <span className="text-[10px] text-white/40 bg-white/5 px-1.5 py-0.5 rounded border border-white/8">{entry.studentClass}</span>
                      )}
                      <span className="text-[10px] text-yellow-400/60">Ур. {level}</span>
                    </div>
                  </div>

                  {/* XP */}
                  <div className="shrink-0 text-right">
                    <span className={`text-sm font-bold ${
                      isMe ? 'text-primary' :
                      rank === 1 ? 'text-yellow-400' :
                      rank === 2 ? 'text-slate-300' :
                      rank === 3 ? 'text-amber-500' :
                      'text-white/50'
                    }`}>
                      {entry.xp.toLocaleString('ru-RU')}
                    </span>
                    <span className="text-[10px] text-white/25 ml-0.5">XP</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}