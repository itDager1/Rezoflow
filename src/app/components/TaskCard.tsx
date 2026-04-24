import { useState } from 'react';
import { Calendar, FileText, Star, CheckCircle2, Upload, X, ImageIcon, User, BookOpen } from 'lucide-react';
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
  onComplete?: (taskId: number, screenshot: string | null) => Promise<void>;
  isArchived?: boolean;
}

export function TaskCard({ task, onComplete, isArchived }: TaskCardProps) {
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(task.screenshot || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Color tokens ─────────────────────────────────────────────────────────
  // Teacher task  → purple/violet  (#8B5CF6)
  // Student task  → teal/emerald   (#14B8A6)
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
      };

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.01, y: -2 }}
      className={`relative bg-[#1A1A1A]/80 backdrop-blur-xl rounded-2xl p-6 border transition-all duration-300 group overflow-hidden ${
        isArchived
          ? 'border-white/5 opacity-80'
          : `border-white/5 ${accent.border} ${accent.shadow} ${accent.baseShadow} cursor-pointer`
      }`}
    >
      {/* Hover gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${accent.gradient} via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

      {/* Inner glow ring */}
      <div className={`absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5 ${accent.ring} pointer-events-none transition-all duration-500`} />

      {/* Left accent stripe — always visible, identifies task type at a glance */}
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
          <p className="text-white/50 mt-2 text-sm leading-relaxed font-light whitespace-pre-wrap">
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

          {/* Teacher name badge (only for teacher assignments) */}
          {task.teacherName && (
            <div className="relative group/teacher">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 cursor-help">
                <User className="w-3.5 h-3.5" />
                {task.teacherName}
              </span>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[220px] opacity-0 group-hover/teacher:opacity-100 transition-opacity pointer-events-none z-50">
                <div className="bg-[#1A1A1A] border border-white/10 rounded-xl shadow-xl px-3 py-2.5">
                  <p className="text-[10px] text-white/50 mb-1.5">Ведёт предметы:</p>
                  {task.teacherSubjects && task.teacherSubjects.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {task.teacherSubjects.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md text-[10px]">
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-white/30 italic">Не указаны</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* XP badge — teacher tasks only */}
          {!isArchived && isTeacher && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium border shadow-[0_0_10px_rgba(139,92,246,0.1)] bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
              +{difficultyXp[task.difficulty]} XP после проверки
            </span>
          )}

          {/* "Personal task" badge — student-created tasks only */}
          {!isArchived && !isTeacher && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-teal-500/10 text-teal-400 border-teal-500/20 shadow-[0_0_10px_rgba(20,184,166,0.1)]">
              <BookOpen className="w-3 h-3" />
              Личное задание
            </span>
          )}
        </div>

        {/* Footer row: dates + complete button */}
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

          {!isArchived && onComplete && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowCompleteForm(!showCompleteForm); }}
              className={`flex items-center gap-1.5 text-xs font-medium text-white/60 transition-all bg-white/5 px-3 py-1.5 rounded-lg border border-transparent ${accent.btnHover}`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Выполнено
            </button>
          )}
        </div>

        {/* Complete form */}
        <AnimatePresence>
          {showCompleteForm && !isArchived && (
            <motion.form
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: 'auto', opacity: 1, marginTop: 16 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              className="overflow-hidden border-t border-white/5 pt-4"
              onSubmit={handleCompleteSubmit}
            >
              <div className="bg-black/30 rounded-xl p-4 border border-white/5 relative">
                <button
                  type="button"
                  onClick={() => setShowCompleteForm(false)}
                  className="absolute top-3 right-3 text-white/30 hover:text-white/70"
                >
                  <X className="w-4 h-4" />
                </button>
                <h4 className="text-sm font-medium text-white/80 mb-3">Подтверждение выполнения</h4>

                {isTeacher && (
                  <>
                    {!screenshot ? (
                      <div className="relative border-2 border-dashed border-white/10 hover:border-primary/50 rounded-xl p-6 text-center transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={handleScreenshotUpload}
                        />
                        <Upload className="w-6 h-6 text-white/40 mx-auto mb-2" />
                        <p className="text-xs text-white/50">Прикрепите скриншот решения (по желанию)</p>
                      </div>
                    ) : (
                      <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-black/50 mb-4 flex items-center justify-center">
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

                {!isTeacher && (
                  <p className="text-xs text-white/40 mb-3 text-center">Нажмите кнопку, чтобы отметить задание как выполненное</p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full mt-3 py-2 text-sm font-medium rounded-lg transition-all border ${
                    isSubmitting
                      ? 'bg-white/5 text-white/25 cursor-not-allowed border-white/5'
                      : `${accent.completeBtn} text-white border-white/10`
                  }`}
                >
                  {isSubmitting
                    ? (isTeacher ? 'Отправляется...' : 'Выполняется...')
                    : (isTeacher ? 'Отправить на проверку учителю' : 'Выполнено')}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Archived screenshot preview */}
        {isArchived && task.screenshot && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-xs text-white/40 mb-2 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              Прикреплённое решение
            </p>
            <div className="relative rounded-lg overflow-hidden border border-white/5 aspect-video bg-black/50">
              <img src={task.screenshot} alt="Решение" className="w-full h-full object-contain opacity-80 hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}