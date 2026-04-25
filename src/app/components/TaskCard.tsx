import { useState } from 'react';
import { Calendar, FileText, Star, CheckCircle2, Upload, X, ImageIcon, User, BookOpen, Zap, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface Task {
  id: number;
  title: string;
  subject: string;
  difficulty: 'Легко' | 'Средне' | 'Сложно';
  deadline: string;
  description: string;
  isPriority: boolean;
  duration?: string;
  screenshot?: string;
  status?: 'pending' | 'approved' | 'rejected';
  submissionId?: string;
  fromTeacher?: boolean;
  teacherName?: string;
  teacherEmail?: string;
  teacherSubjects?: string[];
}

interface TaskCardProps {
  task: Task;
  onComplete?: (taskId: number, screenshot: string | null) => void | Promise<void>;
  isArchived?: boolean;
}

export function TaskCard({ task, onComplete, isArchived }: TaskCardProps) {
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(task.screenshot || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [completionText, setCompletionText] = useState('');

  const isTeacher = !!task.fromTeacher;

  const difficultyColors = {
    Легко: 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]',
    Средне: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]',
    Сложно: 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]',
  };

  const difficultyXp: Record<string, number> = { Легко: 8, Средне: 20, Сложно: 50, '': 20 };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setScreenshot(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !onComplete) return;
    setIsSubmitting(true);
    try {
      await onComplete(task.id, screenshot);
      setShowCompleteForm(false);
      setIsModalOpen(false);
    } catch {
      // onComplete already shows an error alert; just re-enable the button
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Color tokens ─────────────────────────────────────────────────────────
  const accent = isTeacher
    ? {
        border:       'hover:border-primary/40',
        shadow:       'hover:shadow-[0_8px_30px_rgba(139,92,246,0.18)]',
        baseShadow:   'shadow-[0_4px_20px_rgba(139,92,246,0.05)]',
        gradient:     'from-primary/5',
        ring:         'group-hover:ring-primary/20',
        stripe:       'bg-primary/60',
        titleHover:   'group-hover:text-primary',
        btnHover:     'hover:text-primary hover:bg-primary/10 hover:border-primary/20',
        completeBtn:  'bg-gradient-to-r from-primary to-violet-600 shadow-[0_0_15px_rgba(139,92,246,0.4)] hover:shadow-[0_0_25px_rgba(139,92,246,0.6)]',
        modalBorder:  'border-primary/20',
        modalGlow:    'shadow-[0_0_60px_rgba(139,92,246,0.2)]',
        modalStripe:  'from-primary/10 to-transparent',
        accentText:   'text-primary',
      }
    : {
        border:       'hover:border-teal-400/40',
        shadow:       'hover:shadow-[0_8px_30px_rgba(20,184,166,0.18)]',
        baseShadow:   'shadow-[0_4px_20px_rgba(20,184,166,0.05)]',
        gradient:     'from-teal-500/5',
        ring:         'group-hover:ring-teal-400/20',
        stripe:       'bg-teal-400/60',
        titleHover:   'group-hover:text-teal-300',
        btnHover:     'hover:text-teal-400 hover:bg-teal-500/10 hover:border-teal-500/20',
        completeBtn:  'bg-gradient-to-r from-teal-500 to-emerald-600 shadow-[0_0_15px_rgba(20,184,166,0.4)] hover:shadow-[0_0_25px_rgba(20,184,166,0.6)]',
        modalBorder:  'border-teal-400/20',
        modalGlow:    'shadow-[0_0_60px_rgba(20,184,166,0.2)]',
        modalStripe:  'from-teal-500/10 to-transparent',
        accentText:   'text-teal-400',
      };

  return (
    <>
      {/* ── Card ── */}
      <motion.div
        layout
        whileHover={{ scale: 1.01, y: -2 }}
        onClick={() => setIsModalOpen(true)}
        className={`relative bg-[#1A1A1A]/80 backdrop-blur-xl rounded-2xl p-6 border transition-all duration-300 group overflow-hidden ${
          isArchived
            ? 'border-white/5 opacity-80 cursor-pointer'
            : `border-white/5 ${accent.border} ${accent.shadow} ${accent.baseShadow} cursor-pointer`
        }`}
      >
        {/* Hover gradient overlay */}
        <div className={`absolute inset-0 bg-gradient-to-br ${accent.gradient} via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

        {/* Inner glow ring */}
        <div className={`absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5 ${accent.ring} pointer-events-none transition-all duration-500`} />

        {/* Left accent stripe */}
        {!isArchived && (
          <div className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full ${accent.stripe} opacity-70 group-hover:opacity-100 transition-opacity duration-300`} />
        )}

        {/* Priority star */}
        {task.isPriority && !isArchived && (
          <div className="absolute top-5 right-5 z-10">
            <div className="relative flex items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-yellow-500/30 blur-md rounded-full"
              />
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400 relative z-10 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
            </div>
          </div>
        )}

        {/* Archived screenshot badge */}
        {isArchived && task.screenshot && (
          <div className="absolute top-5 right-5 z-10">
            <div className="w-8 h-8 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
          </div>
        )}

        <div className="space-y-4 relative z-10">
          {/* Title + description */}
          <div className="pr-10 pl-1">
            <h3 className={`text-xl font-medium tracking-tight text-white/90 ${accent.titleHover} transition-colors duration-300 leading-snug`}>
              {task.title}
            </h3>
            <p className="text-white/50 mt-2 text-sm leading-relaxed font-light line-clamp-2">
              {task.description}
            </p>
          </div>

          {/* Badges row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3 py-1.5 bg-white/5 rounded-lg text-xs font-medium text-white/80 border border-white/10">
              {task.subject}
            </span>
            <span className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${difficultyColors[task.difficulty]}`}>
              {task.difficulty}
            </span>
            {task.teacherName && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <User className="w-3.5 h-3.5" />
                {task.teacherName}
              </span>
            )}
            {!isArchived && isTeacher && (
              <span className="px-3 py-1.5 rounded-lg text-xs font-medium border shadow-[0_0_10px_rgba(139,92,246,0.1)] bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                +{difficultyXp[task.difficulty]} XP после проверки
              </span>
            )}
            {!isArchived && !isTeacher && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-teal-500/10 text-teal-400 border-teal-500/20 shadow-[0_0_10px_rgba(20,184,166,0.1)]">
                <BookOpen className="w-3 h-3" />
                Личное задание
              </span>
            )}
          </div>

          {/* Footer row */}
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <div className="flex gap-5">
              <div className="flex items-center gap-2 text-white/40 group-hover:text-white/60 transition-colors">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-medium">{task.deadline}</span>
              </div>
              <div className="flex items-center gap-2 text-white/40 group-hover:text-white/60 transition-colors">
                <FileText className="w-4 h-4" />
                <span className="text-xs font-medium">{task.duration || 'Задание'}</span>
              </div>
            </div>
            <span className={`text-xs ${accent.accentText} opacity-0 group-hover:opacity-60 transition-opacity`}>
              Нажми, чтобы открыть →
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Modal ── */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => { setIsModalOpen(false); setShowCompleteForm(false); }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-w-lg bg-[#141414] rounded-3xl border ${accent.modalBorder} ${accent.modalGlow} overflow-hidden`}
            >
              {/* Top gradient stripe */}
              <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b ${accent.modalStripe} pointer-events-none`} />

              {/* Left accent bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${accent.stripe}`} />

              {/* Close button */}
              <button
                onClick={() => { setIsModalOpen(false); setShowCompleteForm(false); }}
                className="absolute top-4 right-4 z-10 w-8 h-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative p-7 space-y-5 max-h-[85vh] overflow-y-auto">
                {/* Header */}
                <div className="pr-8">
                  <div className="flex items-center gap-2 mb-2">
                    {task.isPriority && (
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 shrink-0" />
                    )}
                    <span className="text-xs text-white/40 font-medium uppercase tracking-widest">{task.subject}</span>
                  </div>
                  <h2 className={`text-2xl font-semibold text-white/95 leading-snug ${accent.accentText === 'text-primary' ? 'group-hover:text-primary' : ''}`}>
                    {task.title}
                  </h2>
                </div>

                {/* Description */}
                <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/5">
                  <p className="text-xs text-white/40 font-medium uppercase tracking-widest mb-2">Описание задания</p>
                  <p className="text-white/75 text-sm leading-relaxed whitespace-pre-wrap">
                    {task.description || 'Описание не указано'}
                  </p>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-white/30 shrink-0" />
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-wider">Дедлайн</p>
                      <p className="text-sm text-white/80 font-medium">{task.deadline}</p>
                    </div>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 flex items-center gap-3">
                    <Clock className="w-4 h-4 text-white/30 shrink-0" />
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-wider">Формат</p>
                      <p className="text-sm text-white/80 font-medium">{task.duration || 'Задание'}</p>
                    </div>
                  </div>
                  <div className={`rounded-xl p-3 border flex items-center gap-3 ${difficultyColors[task.difficulty]}`}>
                    <Zap className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider opacity-60">Сложность</p>
                      <p className="text-sm font-medium">{task.difficulty}</p>
                    </div>
                  </div>
                  {isTeacher && (
                    <div className="bg-yellow-500/10 rounded-xl p-3 border border-yellow-500/20 flex items-center gap-3">
                      <Star className="w-4 h-4 text-yellow-400 shrink-0" />
                      <div>
                        <p className="text-[10px] text-yellow-400/60 uppercase tracking-wider">Награда</p>
                        <p className="text-sm text-yellow-400 font-medium">+{difficultyXp[task.difficulty]} XP</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Teacher info */}
                {task.teacherName && (
                  <div className="bg-blue-500/5 rounded-xl p-4 border border-blue-500/15 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-blue-300 font-medium">{task.teacherName}</p>
                      {task.teacherEmail && <p className="text-xs text-white/30 mt-0.5">{task.teacherEmail}</p>}
                      {task.teacherSubjects && task.teacherSubjects.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {task.teacherSubjects.map((s, i) => (
                            <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md text-[10px]">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Archived screenshot */}
                {isArchived && task.screenshot && (
                  <div>
                    <p className="text-xs text-white/40 mb-2 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      Прикреплённое решение
                    </p>
                    <div className="relative rounded-xl overflow-hidden border border-white/5 aspect-video bg-black/50">
                      <img src={task.screenshot} alt="Решение" className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}

                {/* Complete button / form */}
                {!isArchived && onComplete && (
                  <div className="pt-1">
                    {!showCompleteForm ? (
                      <button
                        onClick={() => setShowCompleteForm(true)}
                        className={`w-full py-3 rounded-xl text-sm font-medium text-white transition-all border border-white/10 flex items-center justify-center gap-2 ${accent.completeBtn}`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Отметить как выполненное
                      </button>
                    ) : (
                      <motion.form
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-black/30 rounded-xl p-4 border border-white/5 relative"
                        onSubmit={handleCompleteSubmit}
                      >
                        <button
                          type="button"
                          onClick={() => setShowCompleteForm(false)}
                          className="absolute top-3 right-3 text-white/30 hover:text-white/70"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <h4 className="text-sm font-medium text-white/80 mb-3">Подтверждение выполнения</h4>

                        {/* Comment textarea — always shown, required with screenshot */}
                        <div className="mb-3">
                          <textarea
                            value={completionText}
                            onChange={(e) => setCompletionText(e.target.value)}
                            placeholder="Опиши, что сделал и как решил задание…"
                            rows={3}
                            className={`w-full bg-white/5 border rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 resize-none outline-none transition-all ${
                              isTeacher
                                ? 'border-white/10 focus:border-primary/40 focus:bg-primary/5'
                                : 'border-white/10 focus:border-teal-400/40 focus:bg-teal-500/5'
                            }`}
                          />
                        </div>

                        {isTeacher && (
                          <>
                            {!screenshot ? (
                              <div className="relative border-2 border-dashed border-white/10 hover:border-primary/50 rounded-xl p-5 text-center transition-colors">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  onChange={handleScreenshotUpload}
                                />
                                <Upload className="w-5 h-5 text-white/30 mx-auto mb-1.5" />
                                <p className="text-xs text-white/40">Прикрепить скриншот решения (необязательно)</p>
                              </div>
                            ) : (
                              <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-black/50 mb-1 flex items-center justify-center">
                                <img src={screenshot} alt="Скриншот решения" className="w-full h-full object-contain" />
                                <button
                                  type="button"
                                  onClick={() => setScreenshot(null)}
                                  className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-full hover:bg-red-500 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </>
                        )}

                        {!isTeacher && !screenshot && (
                          <div className="relative border-2 border-dashed border-white/10 hover:border-teal-400/40 rounded-xl p-4 text-center transition-colors mb-1">
                            <input
                              type="file"
                              accept="image/*"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={handleScreenshotUpload}
                            />
                            <Upload className="w-5 h-5 text-white/30 mx-auto mb-1.5" />
                            <p className="text-xs text-white/40">Прикрепить скриншот (необязательно)</p>
                          </div>
                        )}
                        {!isTeacher && screenshot && (
                          <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-black/50 mb-1 flex items-center justify-center">
                            <img src={screenshot} alt="Скриншот решения" className="w-full h-full object-contain" />
                            <button
                              type="button"
                              onClick={() => setScreenshot(null)}
                              className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-full hover:bg-red-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {/* Hint */}
                        {!completionText.trim() && !screenshot && (
                          <p className="text-[11px] text-red-400/70 mt-2 text-center">
                            Напиши комментарий или прикрепи скриншот, чтобы отправить
                          </p>
                        )}

                        <button
                          type="submit"
                          disabled={isSubmitting || (!completionText.trim() && !screenshot)}
                          className={`w-full mt-3 py-2.5 text-sm font-medium rounded-lg transition-all border ${
                            isSubmitting || (!completionText.trim() && !screenshot)
                              ? 'bg-white/5 text-white/25 cursor-not-allowed border-white/5'
                              : `${accent.completeBtn} text-white border-white/10`
                          }`}
                        >
                          {isSubmitting
                            ? (isTeacher ? 'Отправляется...' : 'Выполняется...')
                            : (isTeacher ? 'Отправить на проверку учителю' : 'Выполнено')}
                        </button>
                      </motion.form>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}