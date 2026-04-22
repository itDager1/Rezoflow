import { Lightbulb, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export function SmartRecommendations() {
  const recommendations = [
    'У вас 3 задания по математике на этой неделе',
    'Физика: рекомендуем начать с теории перед практикой',
    'История: осталось 2 дня до сдачи эссе',
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-gradient-to-br from-[#1A1A1A]/90 to-[#141414]/90 backdrop-blur-2xl rounded-3xl p-8 border border-white/5 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-[-50%] right-[-10%] w-[400px] h-[400px] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/5 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 blur-md rounded-2xl" />
            <div className="p-3 bg-primary/20 rounded-2xl border border-primary/30 relative z-10 shadow-inner">
              <Lightbulb className="w-6 h-6 text-primary fill-primary/20" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-medium tracking-tight text-white/90">AI Рекомендации</h3>
            <p className="text-sm text-white/50 mt-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary/70" />
              Основано на вашей успеваемости
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendations.map((rec, idx) => (
            <motion.div
              key={idx}
              whileHover={{ scale: 1.02 }}
              className="flex items-start gap-4 bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-white/10 hover:bg-white/10 hover:border-primary/30 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] transition-all group"
            >
              <div className="mt-1 relative flex-shrink-0">
                <div className="w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_10px_rgba(139,92,246,0.8)] group-hover:scale-150 transition-transform duration-300" />
              </div>
              <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors leading-relaxed">
                {rec}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
