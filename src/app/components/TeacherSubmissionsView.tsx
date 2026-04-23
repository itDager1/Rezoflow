import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, CheckCircle, XCircle, Clock, BookOpen, ChevronLeft, Eye, User } from 'lucide-react';

interface Submission {
  id: number;
  studentName: string;
  screenshotUrl?: string;
  submittedAt: number;
  status: 'pending' | 'approved' | 'rejected';
  xp: number;
}

interface Assignment {
  id: number;
  title: string;
  subject: string;
  class: string | string[];
  deadline: string;
  studentsCount: number;
  description?: string;
  submissions: Submission[];
}

interface TeacherSubmissionsViewProps {
  assignments: Assignment[];
  onViewSubmission?: (assignment: Assignment, submission: Submission) => void;
}

export function TeacherSubmissionsView({ assignments, onViewSubmission }: TeacherSubmissionsViewProps) {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  // Collect all unique classes
  const allClasses = Array.from(
    new Set(
      assignments.flatMap(a =>
        Array.isArray(a.class) ? a.class : [a.class]
      )
    )
  ).sort();

  // All completed submissions (approved + rejected) with their assignment
  const completedSubmissions = assignments.flatMap(assignment =>
    assignment.submissions
      .filter(s => s.status === 'approved' || s.status === 'rejected')
      .map(s => ({ assignment, submission: s }))
  );

  // Filter by selected class
  const filteredSubmissions = selectedClass
    ? completedSubmissions.filter(({ assignment }) => {
        const classes = Array.isArray(assignment.class) ? assignment.class : [assignment.class];
        return classes.includes(selectedClass);
      })
    : completedSubmissions;

  // Count completed per class
  const classStats = allClasses.map(cls => ({
    name: cls,
    total: assignments.filter(a => {
      const classes = Array.isArray(a.class) ? a.class : [a.class];
      return classes.includes(cls);
    }).reduce((acc, a) => acc + a.submissions.length, 0),
    completed: completedSubmissions.filter(({ assignment }) => {
      const classes = Array.isArray(assignment.class) ? assignment.class : [assignment.class];
      return classes.includes(cls);
    }).length,
    pending: assignments.filter(a => {
      const classes = Array.isArray(a.class) ? a.class : [a.class];
      return classes.includes(cls);
    }).reduce((acc, a) => acc + a.submissions.filter(s => s.status === 'pending').length, 0),
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        {selectedClass ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedClass(null)}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors text-white/60 hover:text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-lg font-semibold text-white">Класс {selectedClass}</h3>
              <p className="text-white/40 text-sm">{filteredSubmissions.length} проверенных работ</p>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-semibold text-white">Выберите класс</h3>
            <p className="text-white/40 text-sm">Просмотр выполненных домашних работ</p>
          </div>
        )}
      </div>

      {!selectedClass ? (
        /* Class cards grid */
        allClasses.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {classStats.map((cls, i) => (
              <motion.button
                key={cls.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedClass(cls.name)}
                className="group relative bg-[#1A1A1A]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/5 hover:border-primary/40 hover:shadow-[0_8px_30px_rgba(139,92,246,0.15)] transition-all duration-300 text-left overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-base">{cls.name}</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {assignments.filter(a => {
                        const classes = Array.isArray(a.class) ? a.class : [a.class];
                        return classes.includes(cls.name);
                      }).length} заданий
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {cls.completed > 0 && (
                      <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/20 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {cls.completed}
                      </span>
                    )}
                    {cls.pending > 0 && (
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-xs rounded-full border border-amber-500/20 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {cls.pending}
                      </span>
                    )}
                    {cls.completed === 0 && cls.pending === 0 && (
                      <span className="text-white/20 text-xs">Нет работ</span>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 px-6 rounded-2xl border border-white/5 bg-white/[0.02]">
            <div className="w-14 h-14 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-3">
              <Users className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-white/40 text-sm">Нет назначенных классов</p>
          </div>
        )
      ) : (
        /* Submissions list for selected class */
        <AnimatePresence mode="popLayout">
          {filteredSubmissions.length > 0 ? (
            <div className="space-y-3">
              {filteredSubmissions.map(({ assignment, submission }, i) => (
                <motion.div
                  key={`${assignment.id}-${submission.id}`}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: i * 0.04 }}
                  className="relative bg-[#1A1A1A]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all duration-200 overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
                  <div className="relative z-10 flex items-center gap-4">
                    {/* Status indicator */}
                    <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center border ${
                      submission.status === 'approved'
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                    }`}>
                      {submission.status === 'approved'
                        ? <CheckCircle className="w-5 h-5 text-green-400" />
                        : <XCircle className="w-5 h-5 text-red-400" />
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-medium text-sm">{submission.studentName}</p>
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${
                          submission.status === 'approved'
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {submission.status === 'approved' ? 'Принята' : 'Отклонена'}
                        </span>
                      </div>
                      <p className="text-white/50 text-xs mt-0.5 truncate">{assignment.title}</p>
                      <p className="text-white/25 text-xs">
                        {new Date(submission.submittedAt).toLocaleString('ru-RU')}
                      </p>
                    </div>

                    {/* XP badge */}
                    {submission.status === 'approved' && (
                      <span className="flex-shrink-0 px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-lg border border-primary/20">
                        +{submission.xp} XP
                      </span>
                    )}

                    {/* View button */}
                    {submission.screenshotUrl && onViewSubmission && (
                      <button
                        onClick={() => onViewSubmission(assignment, submission)}
                        className="flex-shrink-0 p-2 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-xl border border-white/10 transition-all opacity-0 group-hover:opacity-100"
                        title="Просмотреть работу"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-14 px-6 rounded-2xl border border-white/5 bg-white/[0.02]"
            >
              <div className="w-14 h-14 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-3">
                <User className="w-7 h-7 text-white/20" />
              </div>
              <p className="text-white/40 text-sm">В классе {selectedClass} пока нет проверенных работ</p>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
}
