import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, ChevronDown, RefreshCw, GraduationCap, Mail, Search, X } from 'lucide-react';
import { apiRequest } from '../utils/api';

interface Student {
  name: string;
  email: string;
  studentClass: string;
}

interface ClassGroup {
  className: string;
  students: Student[];
}

interface ClassStudentsModalProps {
  onClose: () => void;
}

export function ClassStudentsModal({ onClose }: ClassStudentsModalProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<Student[]>('/students/all');
      setStudents(data);
    } catch (err) {
      console.error('Failed to fetch students:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const toggleClass = (className: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(className)) next.delete(className);
      else next.add(className);
      return next;
    });
  };

  const expandAll = () => setExpandedClasses(new Set(classGroups.map(g => g.className)));
  const collapseAll = () => setExpandedClasses(new Set());

  const classGroups: ClassGroup[] = React.useMemo(() => {
    const filtered = searchQuery.trim()
      ? students.filter(s =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.studentClass.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : students;

    const map = new Map<string, Student[]>();
    for (const s of filtered) {
      const cls = s.studentClass || 'Без класса';
      if (!map.has(cls)) map.set(cls, []);
      map.get(cls)!.push(s);
    }

    return Array.from(map.entries())
      .map(([className, students]) => ({ className, students }))
      .sort((a, b) => {
        const numA = parseInt(a.className) || 0;
        const numB = parseInt(b.className) || 0;
        if (numA !== numB) return numA - numB;
        return a.className.localeCompare(b.className, 'ru');
      });
  }, [students, searchQuery]);

  const totalCount = students.length;
  const allExpanded = classGroups.length > 0 && classGroups.every(g => expandedClasses.has(g.className));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 16 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="bg-[#0f0f1a]/95 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.6)] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Ученики по классам</h2>
              {!isLoading && (
                <p className="text-white/40 text-xs mt-0.5">{totalCount} учеников · {classGroups.length} классов</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchStudents}
              className="p-2 rounded-xl text-white/40 hover:text-white/80 hover:bg-white/10 transition-all"
              title="Обновить"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/40 hover:text-white/80 hover:bg-white/10 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search + controls */}
        <div className="px-6 py-3 border-b border-white/5 shrink-0 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск по имени, email или классу..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/40 focus:bg-white/8 transition-all"
            />
          </div>
          {classGroups.length > 1 && (
            <div className="flex gap-2">
              <button
                onClick={allExpanded ? collapseAll : expandAll}
                className="text-xs text-primary/70 hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
              >
                {allExpanded ? 'Свернуть все' : 'Развернуть все'}
              </button>
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-16 gap-3 text-white/40">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-sm">Загрузка учеников...</span>
            </div>
          )}

          {/* Empty */}
          {!isLoading && students.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/30">
              <Users className="w-12 h-12 opacity-30" />
              <p className="text-sm text-center leading-relaxed">
                Пока нет зарегистрированных учеников.<br />
                <span className="text-white/20">Они появятся после регистрации в системе.</span>
              </p>
            </div>
          )}

          {/* No results */}
          {!isLoading && students.length > 0 && classGroups.length === 0 && (
            <div className="text-center py-12 text-white/30 text-sm">
              Ничего не найдено по запросу «{searchQuery}»
            </div>
          )}

          {/* Class groups */}
          {!isLoading && classGroups.map(({ className, students: classStudents }) => {
            const isExpanded = expandedClasses.has(className);
            return (
              <div
                key={className}
                className="rounded-2xl border border-white/8 overflow-hidden"
              >
                {/* Class header */}
                <button
                  onClick={() => toggleClass(className)}
                  className="w-full flex items-center justify-between px-4 py-3.5 bg-white/[0.03] hover:bg-white/[0.07] transition-colors group/cls"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/25 to-purple-700/20 border border-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold text-sm">
                        {className.replace(/[^0-9]/g, '') || '?'}
                      </span>
                    </div>
                    <div className="text-left">
                      <span className="text-white/90 text-sm font-medium">{className} класс</span>
                      <span className="ml-2 text-white/35 text-xs">{classStudents.length} уч.</span>
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <ChevronDown className="w-4 h-4 text-white/30 group-hover/cls:text-white/70 transition-colors" />
                  </motion.div>
                </button>

                {/* Students */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-white/5 border-t border-white/5">
                        {classStudents.map((student, idx) => (
                          <div
                            key={student.email}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors"
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-purple-700/30 border border-primary/20 flex items-center justify-center shrink-0">
                              <span className="text-xs font-semibold text-primary/90">
                                {student.name.trim().charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white/85 text-sm font-medium truncate">{student.name}</p>
                              <p className="text-white/35 text-xs flex items-center gap-1 truncate">
                                <Mail className="w-3 h-3 shrink-0" />
                                {student.email}
                              </p>
                            </div>
                            <span className="text-white/20 text-xs shrink-0 font-mono">#{idx + 1}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
