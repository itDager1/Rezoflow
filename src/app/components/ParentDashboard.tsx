import { useState, useEffect, useCallback } from 'react';
import { GraduationCap, CheckCircle2, Clock, AlertCircle, TrendingUp, BookOpen, User, Link2, X, Settings, Star, Trophy, ChevronRight, RefreshCw, Unlink, Loader2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiRequest } from '../utils/api';
import { StudentClassBadge } from './StudentClassBadge';
import { Leaderboard } from './Leaderboard';

interface ParentDashboardProps {
  userName: string;
  userEmail: string;
  isLightGradient: boolean;
  setIsLightGradient: (value: boolean) => void;
  onLogout?: () => void;
}

interface ChildProfile {
  name: string;
  email: string;
  role: string;
  studentClass: string;
}

interface Submission {
  id: number;
  assignmentId: number;
  studentName: string;
  studentEmail: string;
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
  description?: string;
  teacherName?: string;
  createdAt: number;
}

export function ParentDashboard({
  userName,
  userEmail,
  isLightGradient,
  setIsLightGradient,
  onLogout,
}: ParentDashboardProps) {
  const LS_CHILD_KEY = `rezoflow_parent_child_${userEmail}`;

  const [childEmail, setChildEmail] = useState<string>(() => {
    try { return localStorage.getItem(LS_CHILD_KEY) || ''; } catch { return ''; }
  });
  const [emailInput, setEmailInput] = useState('');
  const [linkError, setLinkError] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  const [linkedChild, setLinkedChild] = useState<ChildProfile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<{ assignment: Assignment; submission: Submission } | null>(null);

  // ─── Fetch all child data ──────────────────────────────────────────────────
  const fetchChildData = useCallback(async (email: string) => {
    if (!email) return;
    setIsLoading(true);
    try {
      const child = await apiRequest<ChildProfile>(`/parent/child?email=${encodeURIComponent(email)}`);
      setLinkedChild(child);

      const [classAssignments, childSubmissions] = await Promise.all([
        child.studentClass
          ? apiRequest<Assignment[]>(`/assignments/class?name=${encodeURIComponent(child.studentClass)}`)
          : Promise.resolve<Assignment[]>([]),
        apiRequest<Submission[]>(`/parent/submissions?studentEmail=${encodeURIComponent(email)}`),
      ]);

      setAssignments(classAssignments);
      setSubmissions(childSubmissions);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Failed to fetch child data:', err);
      setLinkedChild(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (childEmail) fetchChildData(childEmail);
  }, [childEmail, fetchChildData]);

  // Poll every 15 seconds when linked
  useEffect(() => {
    if (!childEmail) return;
    const interval = setInterval(() => fetchChildData(childEmail), 15000);
    return () => clearInterval(interval);
  }, [childEmail, fetchChildData]);

  // ─── Link child ────────────────────────────────────────────────────────────
  const handleLink = async () => {
    const trimmed = emailInput.toLowerCase().trim();
    if (!trimmed) { setLinkError('Введите email ребёнка'); return; }
    setLinkError('');
    setIsLinking(true);
    try {
      const child = await apiRequest<ChildProfile>(`/parent/child?email=${encodeURIComponent(trimmed)}`);
      if (child.role !== 'student') {
        setLinkError('Этот пользователь не является учеником');
        return;
      }
      localStorage.setItem(LS_CHILD_KEY, trimmed);
      setChildEmail(trimmed);
      setEmailInput('');
    } catch (err: any) {
      setLinkError(err.message || 'Ученик с таким email не найден');
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = () => {
    localStorage.removeItem(LS_CHILD_KEY);
    setChildEmail('');
    setLinkedChild(null);
    setAssignments([]);
    setSubmissions([]);
  };

  // ─── Computed stats ───────────────────────────────────────────────────────
  const totalAssignments = assignments.length;
  const submittedCount = submissions.length;
  const approvedCount = submissions.filter(s => s.status === 'approved').length;
  const pendingCount = submissions.filter(s => s.status === 'pending').length;
  const xpEarned = submissions.filter(s => s.status === 'approved').reduce((sum, s) => sum + (s.xp || 0), 0);
  const notSubmittedCount = Math.max(0, totalAssignments - submittedCount);

  // Merge assignments with submission status
  const assignmentsWithStatus = assignments.map(a => {
    const sub = submissions.find(s => s.assignmentId === a.id);
    return { assignment: a, submission: sub || null };
  });

  const getLevelInfo = (totalXp: number) => {
    let level = 1; let xpFor = 100; let xpIn = totalXp;
    while (xpIn >= xpFor) { xpIn -= xpFor; level++; xpFor *= 2; }
    return { level, xpProgress: xpIn, xpForNext: xpFor, pct: (xpIn / xpFor) * 100 };
  };
  const { level, xpProgress, xpForNext, pct } = getLevelInfo(xpEarned);

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen text-foreground relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="fixed top-[-10%] left-[20%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[10%] w-[700px] h-[700px] bg-pink-600/10 rounded-full blur-[180px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6 relative z-10 pb-20">

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4"
        >
          {/* Title */}
          <div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {childEmail && linkedChild && (
              <button
                onClick={() => fetchChildData(childEmail)}
                disabled={isLoading}
                className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white/60 hover:text-white transition-all disabled:opacity-40"
                title="Обновить"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={() => setShowLeaderboard(true)}
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white/60 hover:text-white transition-all"
              title="Рейтинг учеников"
            >
              <Trophy className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white/60 hover:text-white transition-all"
            >
              <Settings className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl">
              <User className="w-4 h-4 text-primary" />
              <span className="text-sm text-white/80 max-w-[100px] truncate">{userName}</span>
            </div>
          </div>
        </motion.header>

        {/* ── No child linked ── */}
        <AnimatePresence mode="wait">
          {!childEmail ? (
            <motion.div
              key="link-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[60vh] gap-8 text-center"
            >
              <div className="w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_50px_rgba(139,92,246,0.2)]">
                <Link2 className="w-12 h-12 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">Привяжите аккаунт ребёнка</h2>
              </div>

              <div className="w-full max-w-sm space-y-3">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    type="email"
                    value={emailInput}
                    onChange={e => { setEmailInput(e.target.value); setLinkError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleLink()}
                    placeholder="Email ребёнка"
                    className="w-full pl-12 pr-4 py-4 bg-black/40 text-white rounded-2xl border border-white/10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 placeholder:text-white/25 transition-all"
                  />
                </div>

                <AnimatePresence>
                  {linkError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-red-400 text-sm px-2"
                    >
                      {linkError}
                    </motion.p>
                  )}
                </AnimatePresence>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleLink}
                  disabled={isLinking || !emailInput.trim()}
                  className="w-full py-4 bg-gradient-to-r from-primary to-[#7C3AED] text-white font-semibold rounded-2xl shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] border border-white/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLinking ? <><Loader2 className="w-5 h-5 animate-spin" /> Поиск...</> : <><Link2 className="w-5 h-5" /> Привязать аккаунт</>}
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {isLoading && !linkedChild ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : linkedChild ? (
                <>
                  {/* ── Child profile card ── */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#141414]/80 backdrop-blur-2xl rounded-3xl p-6 border border-white/5 shadow-2xl relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />
                    <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5">
                      {/* Avatar placeholder */}
                      <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
                        <GraduationCap className="w-8 h-8 text-primary" />
                      </div>
                      <div className="flex-1 text-center sm:text-left">
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-1">
                          <h2 className="text-xl font-bold text-white">{linkedChild.name}</h2>
                          {linkedChild.studentClass && <StudentClassBadge studentClass={linkedChild.studentClass} />}
                          <span className="flex items-center gap-1 px-2.5 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-xl text-xs font-semibold">
                            <Star className="w-3 h-3" /> Ур. {level}
                          </span>
                        </div>
                        <p className="text-white/40 text-sm">{linkedChild.email}</p>

                        {/* XP bar */}
                        <div className="mt-3 space-y-1.5">
                          <div className="flex justify-between text-xs text-white/50">
                            <span>Опыт: {xpProgress} / {xpForNext} XP</span>
                            <span className="text-primary font-medium">Всего: {xpEarned} XP</span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 1, ease: 'easeOut' }}
                              className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Unlink button */}
                      <button
                        onClick={handleUnlink}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/15 border border-red-500/20 rounded-xl transition-all shrink-0"
                      >
                        <Unlink className="w-3.5 h-3.5" /> Отвязать
                      </button>
                    </div>

                    {lastUpdated && (
                      <p className="text-[10px] text-white/20 mt-3 text-right relative z-10">
                        Обовлено: {lastUpdated.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </motion.div>

                  {/* ── Stats grid ── */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Заданий всего', value: totalAssignments, icon: BookOpen, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                      { label: 'На проверке', value: pendingCount, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                      { label: 'Принято', value: approvedCount, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                      { label: 'Не сдано', value: notSubmittedCount, icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
                    ].map((stat, idx) => (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.06 }}
                        className={`bg-[#141414]/80 backdrop-blur-xl rounded-2xl p-4 border ${stat.border} relative overflow-hidden`}
                      >
                        <div className={`absolute top-0 right-0 w-20 h-20 ${stat.bg} rounded-full blur-2xl -translate-y-1/2 translate-x-1/2`} />
                        <div className={`w-9 h-9 rounded-xl ${stat.bg} border ${stat.border} flex items-center justify-center mb-3`}>
                          <stat.icon className={`w-4.5 h-4.5 ${stat.color}`} />
                        </div>
                        <p className="text-2xl font-bold text-white">{stat.value}</p>
                        <p className="text-xs text-white/40 mt-0.5">{stat.label}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* ── Assignments list ── */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-[#141414]/80 backdrop-blur-2xl rounded-3xl p-6 border border-white/5 shadow-2xl"
                  >
                    <div className="flex items-center gap-2 mb-5">
                      <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
                        <TrendingUp className="w-4 h-4 text-primary" />
                      </div>
                      <h2 className="text-lg font-semibold text-white">Задания от учителей</h2>
                      <span className="ml-auto text-xs text-white/30">{assignments.length} шт.</span>
                    </div>

                    {assignments.length === 0 ? (
                      <div className="text-center py-10">
                        <BookOpen className="w-10 h-10 text-white/10 mx-auto mb-3" />
                        <p className="text-white/30 text-sm">Пока нет заданий от учителей</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                        {assignmentsWithStatus.map(({ assignment, submission }) => {
                          const statusColor = !submission
                            ? 'border-white/5 bg-white/[0.02]'
                            : submission.status === 'approved'
                            ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                            : submission.status === 'pending'
                            ? 'border-amber-500/20 bg-amber-500/[0.04]'
                            : 'border-red-500/20 bg-red-500/[0.04]';

                          const isOverdue = !submission && new Date(assignment.deadline) < new Date();

                          return (
                            <button
                              key={assignment.id}
                              onClick={() => submission && setSelectedSubmission({ assignment, submission })}
                              className={`w-full text-left p-4 rounded-2xl border transition-all group ${statusColor} ${submission ? 'hover:brightness-125 cursor-pointer' : 'cursor-default'}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-white font-medium text-sm truncate group-hover:text-primary transition-colors">
                                    {assignment.title}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <span className="text-xs text-white/40">{assignment.subject}</span>
                                    {assignment.teacherName && (
                                      <span className="text-xs text-white/30">• {assignment.teacherName}</span>
                                    )}
                                    <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-white/30'}`}>
                                      • до {assignment.deadline}
                                    </span>
                                  </div>
                                </div>

                                <div className="shrink-0 flex items-center gap-2">
                                  {!submission ? (
                                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border ${isOverdue ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-white/5 text-white/40 border-white/10'}`}>
                                      {isOverdue ? 'Просрочено' : 'Не сдано'}
                                    </span>
                                  ) : submission.status === 'approved' ? (
                                    <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-[11px] font-medium rounded-lg border border-emerald-500/20 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> Принято · +{submission.xp} XP
                                    </span>
                                  ) : submission.status === 'pending' ? (
                                    <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 text-[11px] font-medium rounded-lg border border-amber-500/20 flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> На проверке
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 bg-red-500/10 text-red-400 text-[11px] font-medium rounded-lg border border-red-500/20">
                                      Отклонено
                                    </span>
                                  )}
                                  {submission && <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>

                  {/* ── Recent activity ── */}
                  {submissions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="bg-[#141414]/80 backdrop-blur-2xl rounded-3xl p-6 border border-white/5 shadow-2xl"
                    >
                      <div className="flex items-center gap-2 mb-5">
                        <div className="p-2 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                          <Trophy className="w-4 h-4 text-yellow-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">Последние сдачи работ</h2>
                      </div>

                      <div className="space-y-3">
                        {[...submissions]
                          .sort((a, b) => b.submittedAt - a.submittedAt)
                          .slice(0, 6)
                          .map(sub => {
                            const asgn = assignments.find(a => a.id === sub.assignmentId);
                            return (
                              <div
                                key={sub.id}
                                className={`flex items-center gap-4 p-3 rounded-2xl border transition-all ${
                                  sub.status === 'approved'
                                    ? 'bg-emerald-500/[0.04] border-emerald-500/15'
                                    : sub.status === 'pending'
                                    ? 'bg-amber-500/[0.04] border-amber-500/15'
                                    : 'bg-red-500/[0.04] border-red-500/15'
                                }`}
                              >
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                                  sub.status === 'approved'
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : sub.status === 'pending'
                                    ? 'bg-amber-500/15 text-amber-400'
                                    : 'bg-red-500/15 text-red-400'
                                }`}>
                                  {sub.status === 'approved'
                                    ? <CheckCircle2 className="w-5 h-5" />
                                    : sub.status === 'pending'
                                    ? <Clock className="w-5 h-5" />
                                    : <AlertCircle className="w-5 h-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white/80 text-sm font-medium truncate">
                                    {asgn?.title || `Задание #${sub.assignmentId}`}
                                  </p>
                                  <p className="text-white/35 text-xs">{formatDate(sub.submittedAt)}</p>
                                </div>
                                {sub.status === 'approved' && (
                                  <span className="shrink-0 text-xs font-bold text-primary px-2 py-1 bg-primary/10 rounded-lg border border-primary/20">
                                    +{sub.xp} XP
                                  </span>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </motion.div>
                  )}


                </>
              ) : (
                // Child email set but failed to load
                <div className="text-center py-20">
                  <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                  <p className="text-white/60 mb-4">Не удалось загрузить данные ученика</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => fetchChildData(childEmail)}
                      className="px-5 py-2.5 bg-primary/20 text-primary rounded-xl border border-primary/30 hover:bg-primary/30 transition-all text-sm font-medium"
                    >
                      Повторить
                    </button>
                    <button
                      onClick={handleUnlink}
                      className="px-5 py-2.5 bg-white/5 text-white/60 rounded-xl border border-white/10 hover:bg-white/10 transition-all text-sm"
                    >
                      Ввести другой email
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Submission detail modal ── */}
        <AnimatePresence>
          {selectedSubmission && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedSubmission(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="bg-[#141414]/95 backdrop-blur-3xl rounded-3xl p-6 md:p-8 border border-white/10 shadow-2xl w-full max-w-lg relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h3 className="text-xl font-semibold text-white">{selectedSubmission.assignment.title}</h3>
                      <p className="text-white/50 text-sm mt-1">{selectedSubmission.assignment.subject}</p>
                    </div>
                    <button
                      onClick={() => setSelectedSubmission(null)}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {selectedSubmission.submission.screenshotUrl && (
                      <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/30">
                        <img src={selectedSubmission.submission.screenshotUrl} alt="Работа" className="w-full h-auto" />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-white/40 text-xs mb-1">Статус</p>
                        <p className={`text-sm font-semibold ${
                          selectedSubmission.submission.status === 'approved' ? 'text-emerald-400'
                          : selectedSubmission.submission.status === 'pending' ? 'text-amber-400'
                          : 'text-red-400'
                        }`}>
                          {selectedSubmission.submission.status === 'approved' ? '✅ Принято'
                          : selectedSubmission.submission.status === 'pending' ? '⏳ На проверке'
                          : '❌ Отклонено'}
                        </p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-white/40 text-xs mb-1">XP</p>
                        <p className="text-sm font-semibold text-primary">
                          {selectedSubmission.submission.status === 'approved' ? `+${selectedSubmission.submission.xp} XP` : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-white/40 text-xs mb-1">Сдано</p>
                      <p className="text-white/80 text-sm">{formatDate(selectedSubmission.submission.submittedAt)}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Settings modal ── */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex justify-center items-start pt-10 pb-10 overflow-y-auto"
            >
              <div className="w-full max-w-md px-4 flex flex-col gap-6 relative z-10">
                <div className="flex justify-between items-center bg-[#1A1A1A]/90 p-4 rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl">
                  <h2 className="text-xl font-semibold text-white ml-4">Настройки</h2>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="bg-[#1A1A1A]/90 backdrop-blur-xl rounded-3xl p-6 border border-white/5 shadow-2xl space-y-4">
                  {/* Gradient toggle */}
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div>
                      <h3 className="text-white font-medium">Градиентный фон</h3>
                      <p className="text-white/50 text-sm mt-0.5">Фиолетовый градиент</p>
                    </div>
                    <button
                      onClick={() => setIsLightGradient(!isLightGradient)}
                      className={`relative w-14 h-7 rounded-full transition-colors ${isLightGradient ? 'bg-primary' : 'bg-white/20'}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform ${isLightGradient ? 'translate-x-7' : 'translate-x-0'}`} />
                    </button>
                  </div>



                  {onLogout && (
                    <button
                      onClick={() => { setShowSettings(false); onLogout(); }}
                      className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium rounded-xl border border-red-500/30 transition-all"
                    >
                      Выйти из аккаунта
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* ── Leaderboard Modal ── */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[70] flex items-center justify-center p-4"
            onClick={() => setShowLeaderboard(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full max-w-lg bg-[#141414] rounded-3xl border border-white/10 shadow-[0_0_80px_rgba(139,92,246,0.15)] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-yellow-500/15 rounded-xl border border-yellow-500/20">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Рейтинг учеников</h2>
                </div>
                <button
                  onClick={() => setShowLeaderboard(false)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white/50 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto p-4">
                <Leaderboard currentUserEmail={childEmail} listOnly />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}