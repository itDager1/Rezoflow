import { useState } from 'react';
import { Calendar, FileText, Star, CheckCircle2, Upload, X, ImageIcon, User } from 'lucide-react';
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
}

interface TaskCardProps {
  task: Task;
  onComplete?: (taskId: number, screenshot: string | null) => void;
  isArchived?: boolean;
}

export function TaskCard({ task, onComplete, isArchived }: TaskCardProps) {
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(task.screenshot || null);

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
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCompleteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onComplete) {
      onComplete(task.id, screenshot);
    }
  };

  return (
    <motion.div 
      layout
      whileHover={{ scale: 1.01, y: -2 }}
      className={`relative bg-[#1A1A1A]/80 backdrop-blur-xl rounded-2xl p-6 border transition-all duration-300 group overflow-hidden ${isArchived ? 'border-white/5 opacity-80' : 'border-white/5 hover:border-primary/40 hover:shadow-[0_8px_30px_rgba(139,92,246,0.15)] cursor-pointer'}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      {/* inner glow */}
      <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5 group-hover:ring-primary/20 pointer-events-none transition-all duration-500" />

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
      {isArchived && task.screenshot && (
         <div className="absolute top-5 right-5 z-10">
            <div className="w-8 h-8 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20">
               <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
         </div>
      )}

      <div className="space-y-4 relative z-10">
        <div className="pr-10">
          <h3 className="text-xl font-medium tracking-tight text-white/90 group-hover:text-primary transition-colors duration-300 leading-snug">
            {task.title}
          </h3>
          <p className="text-white/50 mt-2 text-sm leading-relaxed font-light whitespace-pre-wrap">{task.description}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-3 py-1.5 bg-white/5 rounded-lg text-xs font-medium text-white/80 border border-white/10">
            {task.subject}
          </span>
          <span className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${difficultyColors[task.difficulty]}`}>
            {task.difficulty}
          </span>
          {task.teacherName && (
             <div className="relative group/teacher">
               <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 cursor-help">
                 <User className="w-3.5 h-3.5" />
                 {task.teacherName}
               </span>
               <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] opacity-0 group-hover/teacher:opacity-100 transition-opacity pointer-events-none z-50">
                 <div className="bg-[#1A1A1A] text-white/80 text-[10px] py-1.5 px-3 rounded-lg border border-white/10 shadow-xl whitespace-pre-wrap">
                   {(() => {
                     try {
                       if (task.teacherEmail) {
                         const saved = localStorage.getItem(`rezoflow_teacher_subjects_${task.teacherEmail}`);
                         if (saved) {
                           const subjects = JSON.parse(saved);
                           if (Array.isArray(subjects) && subjects.length > 0) {
                             return `Ведёт предметы:\n${subjects.join(', ')}`;
                           }
                         }
                       }
                     } catch {}
                     return "Предметы не указаны";
                   })()}
                 </div>
               </div>
             </div>
          )}
          {!isArchived && (
             <span className={`px-3 py-1.5 rounded-lg text-xs font-medium border shadow-[0_0_10px_rgba(139,92,246,0.1)] ${
               task.fromTeacher
                 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                 : 'bg-primary/10 text-primary border-primary/20'
             }`}>
               {task.fromTeacher ? `+${difficultyXp[task.difficulty]} XP после проверки` : `+${difficultyXp[task.difficulty]} XP`}
             </span>
          )}
        </div>

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
                className="flex items-center gap-1.5 text-xs font-medium text-white/60 hover:text-green-400 transition-colors bg-white/5 hover:bg-green-500/10 px-3 py-1.5 rounded-lg border border-transparent hover:border-green-500/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                Выполнено
              </button>
           )}
        </div>

        {/* Form to attach screenshot and complete */}
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
                   
                   {!screenshot ? (
                     <div className="relative border-2 border-dashed border-white/10 hover:border-primary/50 rounded-xl p-6 text-center transition-colors">
                        <input 
                           type="file" 
                           accept="image/*" 
                           className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                           onChange={handleScreenshotUpload}
                        />
                        <Upload className="w-6 h-6 text-white/40 mx-auto mb-2 group-hover:text-primary transition-colors" />
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
                   
                   <button 
                      type="submit"
                      className="w-full mt-3 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-medium rounded-lg shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_25px_rgba(34,197,94,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
                   >
                      {task.fromTeacher ? 'Отправить на проверку учителю' : `Завершить и получить +${difficultyXp[task.difficulty]} XP`}
                   </button>
                </div>
             </motion.form>
          )}
        </AnimatePresence>

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
