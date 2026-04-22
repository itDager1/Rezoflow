import { GraduationCap, CheckCircle2, Clock, AlertCircle, TrendingUp, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';

interface ParentDashboardProps {
  userName: string;
}

export function ParentDashboard({ userName }: ParentDashboardProps) {
  const todayCompleted: Array<{ subject: string; task: string; time: string }> = [];

  const todayRemaining: Array<{ subject: string; task: string; deadline: string; priority: boolean }> = [];

  const weekStats = {
    totalTasks: 0,
    completed: 0,
    inProgress: 0,
    overdue: 0,
  };

  const subjectProgress: Array<{ subject: string; completed: number; total: number; percentage: number }> = [];

  return (
    <div className="min-h-screen text-foreground relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="fixed top-[-10%] left-[20%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[10%] w-[700px] h-[700px] bg-pink-600/10 rounded-full blur-[180px] pointer-events-none" />

      <div className="max-w-7xl mx-auto p-6 space-y-12 relative z-10 pt-12 pb-24">
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <div className="flex items-center justify-center gap-4">
            <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_30px_rgba(139,92,246,0.2)] backdrop-blur-xl">
              <GraduationCap className="w-8 h-8 text-primary drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
            </div>
            <h1 className="text-5xl font-semibold tracking-tight bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-transparent">
              Здравствуйте, {userName}!
            </h1>
          </div>
          <p className="text-lg text-white/50 max-w-2xl mx-auto font-light">
            Дашборд успеваемости вашего ребёнка
          </p>
        </motion.header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'Выполнено', value: weekStats.completed, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'В процессе', value: weekStats.inProgress, icon: Clock, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Просрочено', value: weekStats.overdue, icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-500/10' },
            { label: 'Всего заданий', value: weekStats.totalTasks, icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          ].map((stat, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.1 }}
              className="bg-[#141414]/60 backdrop-blur-2xl rounded-3xl p-6 border border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
              <div className="flex items-center gap-4 relative z-10">
                <div className={`p-3 rounded-2xl ${stat.bg} shadow-inner`}>
                  <stat.icon className={`w-7 h-7 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/50">{stat.label}</p>
                  <p className="text-3xl font-semibold text-white/90 tracking-tight mt-1">{stat.value}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#141414]/60 backdrop-blur-2xl rounded-3xl p-8 border border-white/5 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
            <div className="flex items-center gap-3 mb-8 relative z-10">
              <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-xl font-medium tracking-tight text-white/90">Выполнено сегодня</h2>
            </div>
            <div className="space-y-4 relative z-10">
              {todayCompleted.map((item, idx) => (
                <motion.div
                  key={idx}
                  whileHover={{ scale: 1.01 }}
                  className="bg-emerald-500/[0.03] border border-emerald-500/10 rounded-2xl p-5 hover:bg-emerald-500/[0.08] transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">{item.subject}</span>
                      </div>
                      <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{item.task}</p>
                    </div>
                    <span className="text-xs font-medium text-white/40">{item.time}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-[#141414]/60 backdrop-blur-2xl rounded-3xl p-8 border border-white/5 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
            <div className="flex items-center gap-3 mb-8 relative z-10">
              <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-medium tracking-tight text-white/90">Осталось сделать сегодня</h2>
            </div>
            <div className="space-y-4 relative z-10">
              {todayRemaining.map((item, idx) => (
                <motion.div
                  key={idx}
                  whileHover={{ scale: 1.01 }}
                  className={`rounded-2xl p-5 border transition-all group ${
                    item.priority
                      ? 'bg-rose-500/[0.03] border-rose-500/10 hover:bg-rose-500/[0.08]'
                      : 'bg-primary/[0.03] border-primary/10 hover:bg-primary/[0.08]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${
                          item.priority 
                            ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' 
                            : 'text-primary bg-primary/10 border-primary/20'
                        }`}>
                          {item.subject}
                        </span>
                        {item.priority && (
                          <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 text-[10px] uppercase font-bold rounded-full tracking-wider border border-rose-500/30">
                            Срочно
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{item.task}</p>
                    </div>
                    <div className="text-xs font-medium text-white/40 bg-white/5 px-2 py-1 rounded-lg border border-white/10">до {item.deadline}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-[#141414]/60 backdrop-blur-2xl rounded-3xl p-8 border border-white/5 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
          <div className="flex items-center gap-3 mb-8 relative z-10">
            <div className="p-2 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
              <BookOpen className="w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="text-xl font-medium tracking-tight text-white/90">Прогресс по предметам</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 relative z-10">
            {subjectProgress.map((item, idx) => (
              <div key={idx} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white/80">{item.subject}</span>
                  <span className="text-xs font-medium text-white/40 bg-white/5 px-2 py-1 rounded-md border border-white/10">
                    {item.completed} / {item.total} ({item.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percentage}%` }}
                    transition={{ duration: 1, delay: 0.5 + idx * 0.1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-primary to-[#7C3AED] rounded-full relative"
                  >
                    <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]" />
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
