import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, Clock, XCircle, ChevronRight } from 'lucide-react';
import { CharacterCanvas, getCharTier, TIER_NAMES, TIER_COLORS, TIER_XP } from './CharacterCanvas';
import { CHARACTERS } from './CharacterTab';
import { apiRequest } from '../utils/api';
import type { LeaderboardEntry } from './Leaderboard';

interface StudentProfileModalProps {
  entry: LeaderboardEntry;
  rank: number;
  currentUserEmail: string;
  onClose: () => void;
}

interface SubmissionStats {
  approved: number;
  pending: number;
  rejected: number;
  total: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

function getLevel(totalXp: number): number {
  let level = 1;
  let needed = 100;
  let rem = totalXp;
  while (rem >= needed) { rem -= needed; level++; needed *= 2; }
  return level;
}

function getLevelProgress(totalXp: number): number {
  let needed = 100;
  let rem = totalXp;
  while (rem >= needed) { rem -= needed; needed *= 2; }
  return Math.round((rem / needed) * 100);
}

export function StudentProfileModal({ entry, rank, currentUserEmail, onClose }: StudentProfileModalProps) {
  const [characterId, setCharacterId] = useState<string>('mage');
  const [stats, setStats] = useState<SubmissionStats | null>(null);
  const [loading, setLoading] = useState(true);

  const tier        = getCharTier(entry.xp);
  const tierColor   = TIER_COLORS[tier];
  const nextTierXp  = tier < 3 ? TIER_XP[tier + 1] : null;
  const tierProgress = tier < 3
    ? ((entry.xp - TIER_XP[tier]) / (TIER_XP[tier + 1] - TIER_XP[tier])) * 100
    : 100;
  const level       = getLevel(entry.xp);
  const levelPct    = getLevelProgress(entry.xp);
  const charInfo    = CHARACTERS.find(c => c.id === characterId) ?? CHARACTERS[1];
  const isMe        = entry.email === currentUserEmail;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.allSettled([
      apiRequest<{ characterId: string }>(`/profile/char?email=${encodeURIComponent(entry.email)}`),
      // fetch submissions for stats — uses parent/submissions endpoint (works for all auth'd users)
      apiRequest<any[]>(`/parent/submissions?studentEmail=${encodeURIComponent(entry.email)}`),
    ]).then(([charRes, subsRes]) => {
      if (cancelled) return;

      if (charRes.status === 'fulfilled' && charRes.value?.characterId) {
        setCharacterId(charRes.value.characterId);
      }

      if (subsRes.status === 'fulfilled' && Array.isArray(subsRes.value)) {
        const subs = subsRes.value;
        setStats({
          approved: subs.filter(s => s.status === 'approved').length,
          pending:  subs.filter(s => s.status === 'pending').length,
          rejected: subs.filter(s => s.status === 'rejected').length,
          total:    subs.length,
        });
      }

      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [entry.email]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.20 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(18px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.90, opacity: 0, y: 24 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{    scale: 0.90, opacity: 0, y: 24 }}
        transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-sm bg-[#141414] rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
        style={{ boxShadow: `0 0 80px ${tierColor}25, 0 0 0 1px rgba(255,255,255,0.06)` }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/[0.015]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl leading-none shrink-0">
              {rank <= 3 ? MEDALS[rank - 1] : `#${rank}`}
            </span>
            <span className="text-white font-semibold truncate">{entry.name}</span>
            {isMe && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded-md border border-primary/25">
                вы
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-2 shrink-0 p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white/40 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Character stage ── */}
        <div
          className="relative flex items-center justify-center py-4"
          style={{ background: `radial-gradient(ellipse at 50% 60%, ${tierColor}18 0%, transparent 70%)` }}
        >
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="spinner"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="w-[200px] h-[200px] flex items-center justify-center"
              >
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </motion.div>
            ) : (
              <motion.div
                key={characterId}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
              >
                <CharacterCanvas characterId={characterId} tier={tier} size={200} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tier badge */}
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm whitespace-nowrap"
            style={{ color: tierColor, borderColor: `${tierColor}40`, background: `${tierColor}18` }}
          >
            {TIER_NAMES[tier]} · Ур. {level}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-5 pb-5 space-y-4">

          {/* Class + character tag + XP */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {entry.studentClass && (
                <span className="text-xs px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-white/50">
                  {entry.studentClass}
                </span>
              )}
              <span
                className="text-xs px-2.5 py-1 border rounded-lg font-medium"
                style={{
                  color: charInfo.traitColor,
                  borderColor: `${charInfo.traitColor}35`,
                  background: `${charInfo.traitColor}12`,
                }}
              >
                {charInfo.name} · {charInfo.trait}
              </span>
            </div>
            <span className="text-white font-bold text-base">
              {entry.xp.toLocaleString('ru-RU')}{' '}
              <span className="text-white/35 font-normal text-sm">XP</span>
            </span>
          </div>

          {/* Tier XP bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span style={{ color: tierColor }}>{TIER_NAMES[tier]}</span>
              {nextTierXp
                ? <span className="text-white/35">{entry.xp} / {nextTierXp} XP до {TIER_NAMES[tier + 1]}</span>
                : <span className="text-yellow-400">Максимальный тир!</span>
              }
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/8">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(tierProgress, 100)}%` }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${tierColor}, ${tierColor}bb)` }}
              />
            </div>
          </div>

          {/* Level bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Уровень {level}</span>
              <span className="text-white/25">{levelPct}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/8">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${levelPct}%` }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: 0.25 }}
                className="h-full rounded-full bg-white/25"
              />
            </div>
          </div>

          {/* Tier progression grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {TIER_NAMES.map((name, i) => (
              <div
                key={name}
                className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border text-center transition-all ${
                  i === tier
                    ? 'border-white/20 bg-white/5'
                    : i < tier
                    ? 'border-green-500/20 bg-green-500/5'
                    : 'border-white/5 opacity-35'
                }`}
              >
                {i < tier ? (
                  <CheckCircle2 className="w-3 h-3 text-green-400 mb-0.5" />
                ) : (
                  <div
                    className="w-3 h-3 rounded-full border-2 mb-0.5"
                    style={{ borderColor: i === tier ? tierColor : '#ffffff25',
                             background:    i === tier ? `${tierColor}40` : 'transparent' }}
                  />
                )}
                <span className="text-[10px] font-medium text-white/55">{name}</span>
                <span className="text-[9px] text-white/25">{TIER_XP[i]} XP</span>
              </div>
            ))}
          </div>

          {/* Submission stats */}
          {stats !== null && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: CheckCircle2, label: 'Принято',   value: stats.approved, color: '#10b981', bg: '#10b98115' },
                { icon: Clock,        label: 'На провер.', value: stats.pending,  color: '#f59e0b', bg: '#f59e0b15' },
                { icon: XCircle,      label: 'Отклонено', value: stats.rejected, color: '#ef4444', bg: '#ef444415' },
              ].map(({ icon: Icon, label, value, color, bg }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-2xl border text-center"
                  style={{ borderColor: `${color}25`, background: bg }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                  <span className="text-white font-bold text-base leading-none">{value}</span>
                  <span className="text-[10px] text-white/40">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
