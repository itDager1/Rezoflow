import { Info, Users, Bell } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

export function ClassAssignmentInfo() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-4 md:p-5 mb-6 relative overflow-hidden"
    >
      <div className="relative z-10 flex gap-4">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Info className="w-5 h-5 text-blue-400" />
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            Как работают задания по классам
          </h3>

          <div className="space-y-2 text-sm text-white/80">
            <div className="flex items-start gap-2">
              <Users className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <p>При создании задания выберите класс из списка (1А-11Е)</p>
            </div>

            <div className="flex items-start gap-2">
              <Bell className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              <p>Все ученики выбранного класса автоматически получат уведомление и задание в своём списке</p>
            </div>
          </div>

          <p className="text-xs text-white/50 italic">
            Пример: Если вы создадите задание для 8А класса, его увидят только ученики, зарегистрированные в 8А
          </p>
        </div>

        <button
          onClick={() => setIsVisible(false)}
          className="text-white/40 hover:text-white/80 transition-colors self-start"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}
