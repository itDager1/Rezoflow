import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sword, Wand2, Star, BookOpen, ChevronRight, CheckCircle2, Crosshair, Zap, ChevronLeft, Lock, Sparkles, X } from 'lucide-react';
import { CharacterCanvas, CHARACTER_COLORS, TIER_NAMES, TIER_XP, TIER_COLORS, getCharTier } from './CharacterCanvas';

export const CHARACTERS = [
  {
    id: 'warrior',
    name: 'Воин',
    emoji: '⚔️',
    icon: Sword,
    description: 'Сильный и непоколебимый. Защищает честь класса.',
    playstyle: 'Идеален для тех, кто берётся за сложные задания',
    trait: 'Сила',
    traitColor: '#ef4444',
  },
  {
    id: 'mage',
    name: 'Маг',
    emoji: '🔮',
    icon: Wand2,
    description: 'Мудрый мыслитель. Постигает тайны знаний.',
    playstyle: 'Подходит любителям точных наук',
    trait: 'Интеллект',
    traitColor: '#8B5CF6',
  },
  {
    id: 'archer',
    name: 'Лучник',
    emoji: '🏹',
    icon: Crosshair,
    description: 'Ловкий и точный. Никогда не промахивается.',
    playstyle: 'Для тех, кто стабильно выполняет задания вовремя',
    trait: 'Ловкость',
    traitColor: '#10b981',
  },
  {
    id: 'rogue',
    name: 'Плут',
    emoji: '🗡️',
    icon: Zap,
    description: 'Быстрый и хитрый. Всегда находит нестандартное решение.',
    playstyle: 'Для творческих и нестандартно мыслящих учеников',
    trait: 'Скорость',
    traitColor: '#3b82f6',
  },
  {
    id: 'scholar',
    name: 'Учёный',
    emoji: '📚',
    icon: BookOpen,
    description: 'Любознательный исследователь. Жажда знаний — его оружие.',
    playstyle: 'Для тех, кто любит гуманитарные предметы',
    trait: 'Мудрость',
    traitColor: '#f59e0b',
  },
];

const CHOSEN_KEY = 'rezoflow_char_chosen';

interface CharacterTabProps {
  xp: number;
  characterId: string;
  onSelectCharacter: (id: string) => void;
}

export function CharacterTab({ xp, characterId, onSelectCharacter }: CharacterTabProps) {
  const tier = getCharTier(xp);
  const tierColor = TIER_COLORS[tier];
  const nextTierXp = tier < 3 ? TIER_XP[tier + 1] : null;
  const tierProgress = tier < 3
    ? ((xp - TIER_XP[tier]) / (TIER_XP[tier + 1] - TIER_XP[tier])) * 100
    : 100;

  // ── Character-choice state ──────────────────────────────────────────────
  const [hasChosen, setHasChosen] = useState<boolean>(
    () => localStorage.getItem(CHOSEN_KEY) === 'true'
  );
  const [showCarousel, setShowCarousel] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(
    () => Math.max(0, CHARACTERS.findIndex(c => c.id === characterId))
  );
  const [direction, setDirection] = useState<1 | -1>(1);
  const [confirming, setConfirming] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Open carousel automatically on first visit
  useEffect(() => {
    if (!hasChosen) {
      const t = setTimeout(() => setShowCarousel(true), 300);
      return () => clearTimeout(t);
    }
  }, [hasChosen]);

  const navigate = (dir: 1 | -1) => {
    setDirection(dir);
    setCarouselIndex(i => (i + dir + CHARACTERS.length) % CHARACTERS.length);
  };

  const handleConfirm = () => {
    if (confirming) return;
    setConfirming(true);
    const chosen = CHARACTERS[carouselIndex];
    onSelectCharacter(chosen.id);
    localStorage.setItem(CHOSEN_KEY, 'true');
    setTimeout(() => {
      setHasChosen(true);
      setShowCarousel(false);
      setConfirming(false);
    }, 700);
  };

  const currentChar = CHARACTERS[carouselIndex];
  const chosenChar = CHARACTERS.find(c => c.id === characterId) ?? CHARACTERS[0];
  const chosenColors = CHARACTER_COLORS[chosenChar.id];
  const charColors = CHARACTER_COLORS[currentChar.id];
  const accentHex = `#${charColors.emissive.toString(16).padStart(6, '0')}`;

  // Swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) navigate(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  return (
    <div className="space-y-6">
      {/* Top: 3D viewer + tier info */}
      <div className="bg-[#1A1A1A]/90 backdrop-blur-xl rounded-3xl border border-white/5 overflow-hidden">
        <div className="flex flex-col md:flex-row items-center gap-0">
          <div
            className="relative flex-shrink-0 flex items-center justify-center p-6 md:p-8"
            style={{ background: `radial-gradient(ellipse at center, ${tierColor}15 0%, transparent 70%)` }}
          >
            <CharacterCanvas characterId={characterId} tier={tier} size={240} interactive />
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm"
              style={{ color: tierColor, borderColor: `${tierColor}40`, background: `${tierColor}15` }}
            >
              {TIER_NAMES[tier]}
            </div>
          </div>

          <div className="flex-1 p-6 md:p-8 md:pl-4 w-full">
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-white">{chosenChar.name}</h3>
              <p className="text-white/50 text-sm mt-1">{chosenChar.description}</p>
              <p className="text-white/30 text-xs mt-1 italic">{chosenChar.playstyle}</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span style={{ color: tierColor }}>{TIER_NAMES[tier]}</span>
                {nextTierXp !== null
                  ? <span className="text-white/40">{xp} / {nextTierXp} XP до {TIER_NAMES[tier + 1]}</span>
                  : <span className="text-yellow-400">Максимальный уровень!</span>
                }
              </div>
              <div className="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(tierProgress, 100)}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${tierColor}, ${tierColor}cc)` }}
                />
              </div>
              {nextTierXp !== null && (
                <p className="text-[11px] text-white/30">
                  Ещё {nextTierXp - xp} XP до тира «{TIER_NAMES[tier + 1]}»
                </p>
              )}
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2">
              {TIER_NAMES.map((name, i) => (
                <div
                  key={name}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all ${
                    i === tier ? 'border-white/20 bg-white/5' : i < tier ? 'border-green-500/20 bg-green-500/5' : 'border-white/5 opacity-40'
                  }`}
                >
                  {i < tier ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                      style={{ borderColor: i === tier ? tierColor : '#ffffff20' }}
                    >
                      {i === tier && <div className="w-2 h-2 rounded-full" style={{ background: tierColor }} />}
                    </div>
                  )}
                  <span className="text-[10px] font-medium text-white/60">{name}</span>
                  <span className="text-[9px] text-white/30">{TIER_XP[i]} XP</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── CHARACTER SELECTION BLOCK (selected element) ── */}
      {hasChosen ? (
        tier < 2 ? (
          /* Unlocked — can still change (Новичок / Адепт) */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#1A1A1A]/90 backdrop-blur-xl rounded-3xl p-6 border border-white/5"
          >
            <div className="flex items-center gap-4">
              <div
                className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                style={{ background: `radial-gradient(ellipse, ${`#${chosenColors.emissive.toString(16).padStart(6, '0')}`}25 0%, transparent 70%)` }}
              >
                <CharacterCanvas characterId={chosenChar.id} tier={tier} size={80} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-semibold text-lg">{chosenChar.name}</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                    style={{ color: chosenChar.traitColor, borderColor: `${chosenChar.traitColor}40`, background: `${chosenChar.traitColor}15` }}
                  >
                    {chosenChar.trait}
                  </span>
                </div>
                <p className="text-white/40 text-sm">{chosenChar.description}</p>
                <p className="text-[11px] text-white/25 mt-1">
                  🔓 Смена доступна до тира «Эксперт» · осталось {80 - xp} XP
                </p>
              </div>
              <button
                onClick={() => {
                  setCarouselIndex(Math.max(0, CHARACTERS.findIndex(c => c.id === characterId)));
                  setShowCarousel(true);
                }}
                className="flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-2xl border border-primary/30 bg-primary/10 hover:bg-primary/20 transition-colors group"
                title="Сменить персонажа"
              >
                <Lock className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                <span className="text-[10px] text-primary font-medium">сменить</span>
              </button>
            </div>
          </motion.div>
        ) : (
          /* Locked forever — Эксперт / Мастер */
          <div className="bg-[#1A1A1A]/90 backdrop-blur-xl rounded-3xl p-6 border border-white/5">
            <div className="flex items-center gap-4">
              <div
                className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                style={{ background: `radial-gradient(ellipse, ${`#${chosenColors.emissive.toString(16).padStart(6, '0')}`}25 0%, transparent 70%)` }}
              >
                <CharacterCanvas characterId={chosenChar.id} tier={tier} size={80} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-semibold text-lg">{chosenChar.name}</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                    style={{ color: chosenChar.traitColor, borderColor: `${chosenChar.traitColor}40`, background: `${chosenChar.traitColor}15` }}
                  >
                    {chosenChar.trait}
                  </span>
                </div>
                <p className="text-white/40 text-sm">{chosenChar.description}</p>
              </div>
              <div className="flex-shrink-0 flex flex-col items-center gap-1 text-white/25">
                <Lock className="w-5 h-5" />
                <span className="text-[10px]">навсегда</span>
              </div>
            </div>
          </div>
        )
      ) : (
        /* Not yet chosen — invitation card */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1A1A1A]/90 backdrop-blur-xl rounded-3xl p-6 border border-primary/20 relative overflow-hidden cursor-pointer group"
          onClick={() => setShowCarousel(true)}
          style={{ boxShadow: '0 0 40px rgba(139,92,246,0.08)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center text-center gap-3 py-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">Выбери своего персонажа</h3>
              <p className="text-white/40 text-sm mt-1">5 уникальных персонажей · Выбор навсегда</p>
            </div>
            <div className="px-6 py-2.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-2xl text-sm font-medium transition-colors">
              Начать выбор →
            </div>
          </div>
        </motion.div>
      )}

      {/* ── CAROUSEL MODAL ── */}
      <AnimatePresence>
        {showCarousel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}
          >
            {/* Ambient glow */}
            <div
              className="absolute inset-0 pointer-events-none transition-all duration-700"
              style={{ background: `radial-gradient(ellipse at 50% 40%, ${accentHex}18 0%, transparent 60%)` }}
            />

            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 24 }}
              transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
              className="relative w-full max-w-md bg-[#141414]/95 border rounded-3xl overflow-hidden shadow-2xl"
              style={{ borderColor: `${accentHex}30` }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-2">
                <span className="text-white/30 text-sm">Выбор персонажа</span>
                <div className="flex items-center gap-3">
                  <span className="text-white/30 text-sm">{carouselIndex + 1} / {CHARACTERS.length}</span>
                  <button
                    onClick={() => setShowCarousel(false)}
                    className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-white/50" />
                  </button>
                </div>
              </div>

              {/* 3D Character stage */}
              <div
                className="relative flex items-center justify-center py-4 mx-4 rounded-2xl overflow-hidden"
                style={{ background: `radial-gradient(ellipse at center, ${accentHex}20 0%, ${accentHex}05 50%, transparent 80%)` }}
              >
                {/* Left nav */}
                <button
                  onClick={() => navigate(-1)}
                  className="absolute left-2 z-10 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-white/70" />
                </button>

                {/* Character with slide animation */}
                <div className="overflow-hidden w-[260px] h-[260px] flex items-center justify-center">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={carouselIndex}
                      initial={{ x: direction * 80, opacity: 0, scale: 0.85 }}
                      animate={{ x: 0, opacity: 1, scale: 1 }}
                      exit={{ x: direction * -80, opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
                    >
                      <CharacterCanvas characterId={currentChar.id} tier={0} size={260} />
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Right nav */}
                <button
                  onClick={() => navigate(1)}
                  className="absolute right-2 z-10 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-white/70" />
                </button>
              </div>

              {/* Character info */}
              <div className="px-6 pt-4 pb-2 text-center min-h-[100px]">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={currentChar.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22 }}
                  >
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl font-bold text-white">{currentChar.name}</span>
                      <span
                        className="px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                        style={{ color: currentChar.traitColor, borderColor: `${currentChar.traitColor}40`, background: `${currentChar.traitColor}15` }}
                      >
                        {currentChar.trait}
                      </span>
                    </div>
                    <p className="text-white/50 text-sm">{currentChar.description}</p>
                    <p className="text-white/30 text-xs mt-1 italic">{currentChar.playstyle}</p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Dot indicators */}
              <div className="flex items-center justify-center gap-2 py-3">
                {CHARACTERS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setDirection(i > carouselIndex ? 1 : -1); setCarouselIndex(i); }}
                    className="transition-all duration-300 rounded-full"
                    style={{
                      width: i === carouselIndex ? 20 : 7,
                      height: 7,
                      background: i === carouselIndex ? accentHex : 'rgba(255,255,255,0.15)',
                    }}
                  />
                ))}
              </div>

              {/* Confirm button */}
              <div className="px-6 pb-4 space-y-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="w-full py-3.5 rounded-2xl font-semibold text-white transition-all disabled:opacity-60 relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${accentHex}, ${accentHex}99)`, boxShadow: `0 4px 24px ${accentHex}40` }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {confirming ? (
                      <motion.span
                        key="confirming"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        {hasChosen ? 'Персонаж сменён!' : 'Выбрано!'}
                      </motion.span>
                    ) : (
                      <motion.span
                        key="select"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        {hasChosen ? `Сменить на «${currentChar.name}»` : `Выбрать «${currentChar.name}»`}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
                <p className="text-center text-[11px] text-white/25">
                  {hasChosen
                    ? `⚠️ После смены вернуться к прошлому нельзя · доступно до Эксперта`
                    : `⚠️ Выбор навсегда — после подтверждения изменить нельзя`}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}