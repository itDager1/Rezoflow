import { useState } from 'react';
import { GraduationCap, Plus, Calendar, Users, BookOpen, Clock, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TeacherDashboardProps {
  userName: string;
}

interface Assignment {
  id: number;
  title: string;
  subject: string;
  class: string;
  deadline: string;
  studentsCount: number;
}

export function TeacherDashboard({ userName }: TeacherDashboardProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [newAssignment, setNewAssignment] = useState({
    title: '',
    subject: '',
    class: '',
    deadline: '',
    description: '',
  });

  const handleAddAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    const assignment: Assignment = {
      id: Date.now(),
      title: newAssignment.title,
      subject: newAssignment.subject,
      class: newAssignment.class,
      deadline: newAssignment.deadline,
      studentsCount: 0,
    };
    setAssignments([...assignments, assignment]);
    setNewAssignment({ title: '', subject: '', class: '', deadline: '', description: '' });
    setShowAddForm(false);
  };

  return (
    <div className="min-h-screen text-foreground relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="fixed top-[10%] right-[10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[10%] left-[10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none" />

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
              Добро пожаловать, {userName}!
            </h1>
          </div>
          <p className="text-lg text-white/50 max-w-2xl mx-auto font-light">
            Управляйте заданиями для ваших учеников
          </p>
        </motion.header>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-between items-center"
        >
          <h2 className="text-2xl font-medium tracking-tight text-white/90">Мои задания</h2>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-[#7C3AED] text-white font-medium rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] border border-white/10 transition-all duration-300"
          >
            <Plus className="w-5 h-5" />
            Добавить задание
          </motion.button>
        </motion.div>

        <AnimatePresence>
          {showAddForm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-6"
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-[#141414]/90 backdrop-blur-3xl rounded-3xl p-8 border border-white/10 shadow-2xl max-w-2xl w-full relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                <h3 className="text-2xl font-medium mb-6 text-white/90 relative z-10">Новое задание</h3>
                
                <form onSubmit={handleAddAssignment} className="space-y-5 relative z-10">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-white/60 ml-1">Название задания</label>
                    <input
                      type="text"
                      value={newAssignment.title}
                      onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                      placeholder="Например: Квадратные уравнения"
                      required
                      className="w-full px-4 py-3.5 bg-black/40 text-white rounded-xl border border-white/10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-white/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-white/60 ml-1">Предмет</label>
                      <input
                        type="text"
                        value={newAssignment.subject}
                        onChange={(e) => setNewAssignment({ ...newAssignment, subject: e.target.value })}
                        placeholder="Математика"
                        required
                        className="w-full px-4 py-3.5 bg-black/40 text-white rounded-xl border border-white/10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-white/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-white/60 ml-1">Класс</label>
                      <input
                        type="text"
                        value={newAssignment.class}
                        onChange={(e) => setNewAssignment({ ...newAssignment, class: e.target.value })}
                        placeholder="8А"
                        required
                        className="w-full px-4 py-3.5 bg-black/40 text-white rounded-xl border border-white/10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-white/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-white/60 ml-1">Срок сдачи</label>
                    <input
                      type="date"
                      value={newAssignment.deadline}
                      onChange={(e) => setNewAssignment({ ...newAssignment, deadline: e.target.value })}
                      required
                      className="w-full px-4 py-3.5 bg-black/40 text-white rounded-xl border border-white/10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-white/80 [color-scheme:dark]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-white/60 ml-1">Описание</label>
                    <textarea
                      value={newAssignment.description}
                      onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                      placeholder="Подробное описание задания..."
                      rows={4}
                      className="w-full px-4 py-3.5 bg-black/40 text-white rounded-xl border border-white/10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all resize-none placeholder:text-white/20"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="flex-1 py-3.5 bg-gradient-to-r from-primary to-[#7C3AED] text-white font-medium rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] border border-white/10 transition-all duration-300"
                    >
                      Создать задание
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-6 py-3.5 bg-white/5 text-white/80 font-medium rounded-xl border border-white/10 hover:bg-white/10 transition-all"
                    >
                      Отмена
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {assignments.map((assignment, idx) => (
              <motion.div
                key={assignment.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + idx * 0.1 }}
                className="relative bg-[#1A1A1A]/80 backdrop-blur-xl rounded-2xl p-6 border border-white/5 hover:border-primary/40 hover:shadow-[0_8px_30px_rgba(139,92,246,0.15)] transition-all duration-300 group overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5 group-hover:ring-primary/20 pointer-events-none transition-all duration-500" />

                <div className="relative z-10 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium text-white/90 group-hover:text-primary transition-colors leading-snug">
                        {assignment.title}
                      </h3>
                      <p className="text-white/50 text-sm mt-1 font-medium">{assignment.subject}</p>
                    </div>
                    <div className="p-2 bg-white/5 rounded-lg border border-white/10 text-primary">
                      <FileText className="w-5 h-5 opacity-80" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-2">
                    <span className="px-3 py-1.5 bg-white/5 rounded-lg text-xs font-medium text-white/80 border border-white/10 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 opacity-60" />
                      {assignment.class}
                    </span>
                    <span className="px-3 py-1.5 bg-white/5 rounded-lg text-xs font-medium text-white/80 border border-white/10 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 opacity-60" />
                      {assignment.deadline}
                    </span>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <span className="text-xs font-medium text-white/40 group-hover:text-white/60 transition-colors">
                      {assignment.studentsCount > 0 ? `${assignment.studentsCount} учеников` : 'Не назначено'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
