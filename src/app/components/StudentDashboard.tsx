import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GraduationCap, Plus, FileText, Mic, Image as ImageIcon, X, Sparkles, Loader2, Archive, User, Trophy, Camera, Target, Star, Medal, Settings, Bell, RotateCcw, XCircle, Clock, ChevronDown, RefreshCw } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { StudentClassBadge } from './StudentClassBadge';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiRequest, getStoredToken } from '../utils/api';

import { parseTaskWithAI, transcribeAudio } from '../utils/ai';
import { StudentAIChat } from './StudentAIChat';
import { Leaderboard } from './Leaderboard';
import { CharacterTab } from './CharacterTab';
import { StudentProfileModal } from './StudentProfileModal';
import type { LeaderboardEntry } from './Leaderboard';

interface StudentDashboardProps {
  userName: string;
  userEmail: string;
  studentClass: string; // Формат: "5А", "8Б" и т.д.
  isLightGradient: boolean;
  setIsLightGradient: (value: boolean) => void;
  onLogout?: () => void;
}

interface Task {
  id: number;
  title: string;
  subject: string;
  difficulty: '' | 'Легко' | 'Средне' | 'Сложно';
  deadline: string;
  description: string;
  isPriority: boolean;
  duration: string;
  screenshot?: string;
  createdAt?: number;
  completedAt?: number;
  fromTeacher?: boolean;
  teacherName?: string;
  teacherEmail?: string;
  status?: 'pending' | 'approved' | 'rejected';
  submissionId?: string;
}

interface NotificationItem {
  id: number;
  title: string;
  description: string;
  time: string;
  read: boolean;
  taskId?: number;
}

export function StudentDashboard({ userName, userEmail, studentClass, isLightGradient, setIsLightGradient, onLogout }: StudentDashboardProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<'selection' | 'text' | 'voice' | 'photo'>('selection');
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem(`rezoflow_student_tasks_${userEmail}`);
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [completedTasks, setCompletedTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem(`rezoflow_student_completed_${userEmail}`);
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [rejectedTasks, setRejectedTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem(`rezoflow_student_rejected_${userEmail}`);
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeTab, setActiveTab] = useState<'active' | 'rework'>('active');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [pendingCollapsed, setPendingCollapsed] = useState(false);
  // ── Pending updates (background-fetched) — never auto-applied to visible list ──
  const [pendingTeacherTasks, setPendingTeacherTasks] = useState<Task[]>([]);
  // pendingRejectedTasks IS persisted so that reload before clicking "Показать" doesn't lose rework notification
  const [pendingRejectedTasks, setPendingRejectedTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(`rezoflow_pending_rejected_${userEmail}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const latestServerAssignmentsRef = useRef<any[]>([]);
  // Guard: set of assignment IDs for which XP has already been awarded this session.
  // Prevents double-awarding if two polling cycles fire before React re-renders.
  const xpAwardedAssignmentIds = useRef<Set<number>>(new Set());
  const [xp, setXp] = useState(() => {
    const saved = localStorage.getItem(`rezoflow_student_xp_${userEmail}`);
    return saved ? parseInt(saved) : 0;
  });
  const [avatar, setAvatar] = useState<string | null>(() => {
    try { return localStorage.getItem(`rezoflow_student_avatar_${userEmail}`); } catch { return null; }
  });

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem(`rezoflow_student_notifications_${userEmail}`);
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(`rezoflow_student_tasks_${userEmail}`, JSON.stringify(tasks));
  }, [tasks, userEmail]);

  useEffect(() => {
    localStorage.setItem(`rezoflow_student_completed_${userEmail}`, JSON.stringify(completedTasks));
  }, [completedTasks, userEmail]);

  useEffect(() => {
    localStorage.setItem(`rezoflow_student_rejected_${userEmail}`, JSON.stringify(rejectedTasks));
  }, [rejectedTasks, userEmail]);

  // Persist pendingRejectedTasks so "Показать" survives page reloads
  useEffect(() => {
    localStorage.setItem(`rezoflow_pending_rejected_${userEmail}`, JSON.stringify(pendingRejectedTasks));
  }, [pendingRejectedTasks, userEmail]);

  useEffect(() => {
    localStorage.setItem(`rezoflow_student_notifications_${userEmail}`, JSON.stringify(notifications));
  }, [notifications, userEmail]);

  useEffect(() => {
    localStorage.setItem(`rezoflow_student_xp_${userEmail}`, xp.toString());
  }, [xp, userEmail]);

  // Sync XP to KV store (debounced 2s) so it appears in the leaderboard
  const xpSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!userEmail || !getStoredToken()) return;
    if (xpSyncTimerRef.current) clearTimeout(xpSyncTimerRef.current);
    xpSyncTimerRef.current = setTimeout(async () => {
      try {
        await apiRequest('/leaderboard/sync', {
          method: 'POST',
          body: JSON.stringify({ name: userName, studentClass, xp }),
        });
      } catch {}
    }, 2000);
    return () => { if (xpSyncTimerRef.current) clearTimeout(xpSyncTimerRef.current); };
  }, [xp, userEmail, userName, studentClass]);

  useEffect(() => {
    try {
      if (avatar) localStorage.setItem(`rezoflow_student_avatar_${userEmail}`, avatar);
      else localStorage.removeItem(`rezoflow_student_avatar_${userEmail}`);
    } catch {}
  }, [avatar, userEmail]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{ entry: LeaderboardEntry; rank: number } | null>(null);

  const [characterId, setCharacterId] = useState<string>(() => {
    return localStorage.getItem(`rezoflow_student_character_${userEmail}`) || 'mage';
  });
  const [profileTab, setProfileTab] = useState<'profile' | 'character'>('profile');

  useEffect(() => {
    localStorage.setItem(`rezoflow_student_character_${userEmail}`, characterId);
    // Sync to kv_store so other users can view this student's character
    apiRequest('/profile/char', {
      method: 'POST',
      body: JSON.stringify({ characterId }),
    }).catch(() => {});
  }, [characterId, userEmail]);

  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); // A6
      
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn("AudioContext issue", e);
    }
  };

  const scrollToTask = (taskId: number) => {
    const el = document.getElementById(`task-${taskId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.animate([
        { boxShadow: '0 0 0 0px rgba(139, 92, 246, 0.8)', borderColor: 'rgba(139, 92, 246, 1)' },
        { boxShadow: '0 0 0 20px rgba(139, 92, 246, 0)', borderColor: 'rgba(255, 255, 255, 0.05)' }
      ], {
        duration: 1500,
        easing: 'ease-out'
      });
    }
  };

  const notifyUser = (title: string, options: { body: string, isUrgent?: boolean, taskId?: number }) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    
    setNotifications(prev => [{
      id,
      title,
      description: options.body,
      time: 'Только что',
      read: false,
      taskId: options.taskId
    }, ...prev]);

    if (options.isUrgent) {
      playAlertSound();
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      const browserNotification = new window.Notification(title, {
        body: options.body,
      });
      
      browserNotification.onclick = () => {
        window.focus();
        if (options.taskId) {
           scrollToTask(options.taskId);
        }
        browserNotification.close();
      };
    }
  };

  // ── Daily login XP ──────────────────────────────────────────────────────
  useEffect(() => {
    const DAILY_XP = 10;
    const key = `rezoflow_daily_login_${userEmail}`;
    const today = new Date().toISOString().split('T')[0];
    const lastLogin = localStorage.getItem(key);
    if (lastLogin === today) return;
    localStorage.setItem(key, today);
    setXp(prev => prev + DAILY_XP);
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotifications(prev => [{
      id,
      title: '🌟 Ежедневный бонус',
      description: `+${DAILY_XP} XP за вход на сайт сегодня! Возвращайся завтра за новым бонусом.`,
      time: 'Только что',
      read: false,
    }, ...prev]);
  }, [userEmail]);

  // Polling for teacher assignments from server
  const processedTeacherIds = useRef<Set<number>>(new Set());
  // Mirror of completedTasks teacher IDs — acts as a second guard in fetchTeacherAssignments
  const completedTeacherIdsRef = useRef<Set<number>>(new Set());

  const fetchTeacherAssignments = useCallback(async () => {
    if (!studentClass) return;
    if (!getStoredToken()) return;
    try {
      const assignments = await apiRequest<any[]>(`/assignments/class?name=${encodeURIComponent(studentClass)}`);
      // Store latest server state for use when the user manually applies updates
      latestServerAssignmentsRef.current = assignments;

      assignments.forEach((assignment: any) => {
        const assignmentId = assignment.id as number;
        // Already seen this assignment
        if (processedTeacherIds.current.has(assignmentId)) return;
        // Already in completed/approved list
        if (completedTeacherIdsRef.current.has(assignmentId)) {
          processedTeacherIds.current.add(assignmentId);
          return;
        }
        processedTeacherIds.current.add(assignmentId);

        // Queue into pending — DO NOT touch `tasks` state directly (prevents flicker)
        setPendingTeacherTasks(prev => {
          if (prev.some(t => t.id === assignmentId)) return prev;
          notifyUser('Новое задание от учителя', {
            body: `${assignment.title} (${assignment.subject})`,
            isUrgent: false,
            taskId: assignmentId,
          });
          return [{
            id: assignmentId,
            title: assignment.title || 'Новое задание',
            subject: assignment.subject || 'Разное',
            difficulty: 'Средне' as const,
            deadline: assignment.deadline || new Date(Date.now() + 86400000).toISOString().split('T')[0],
            description: assignment.description || '',
            isPriority: true,
            duration: '30 мин',
            createdAt: assignment.createdAt || Date.now(),
            fromTeacher: true,
            teacherName: assignment.teacherName || 'Учитель',
            teacherEmail: assignment.teacherEmail,
            teacherSubjects: Array.isArray(assignment.teacherSubjects) ? assignment.teacherSubjects : [],
          }, ...prev];
        });
      });
    } catch {
      // Silently ignore auth/network errors (e.g. no token, design preview mode)
    }
  }, [studentClass]);

  /** Apply pending teacher tasks + remove server-deleted ones — triggered by user */
  const applyPendingTasks = useCallback(() => {
    const serverIds = new Set(latestServerAssignmentsRef.current.map((a: any) => a.id as number));
    setTasks(prev => {
      // Remove teacher tasks that no longer exist on server
      const cleaned = prev.filter(t => {
        if (t.fromTeacher && !serverIds.has(t.id)) {
          processedTeacherIds.current.delete(t.id);
          return false;
        }
        return true;
      });
      // Merge pending new tasks (deduplicated)
      const existingIds = new Set(cleaned.map(t => t.id));
      const toAdd = pendingTeacherTasks.filter(t => !existingIds.has(t.id));
      return [...toAdd, ...cleaned];
    });
    setPendingTeacherTasks([]);
  }, [pendingTeacherTasks]);

  /** Apply pending rejected (rework) tasks — triggered by user */
  const applyPendingRejected = useCallback(() => {
    setRejectedTasks(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      const unique = pendingRejectedTasks.filter(t => !existingIds.has(t.id));
      if (unique.length === 0) return prev;
      return [...unique, ...prev];
    });
    setPendingRejectedTasks([]);
  }, [pendingRejectedTasks]);

  // Seed processed IDs from already-known teacher tasks (prevents re-notifying on reload)
  useEffect(() => {
    tasks.forEach(t => {
      if (t.fromTeacher) processedTeacherIds.current.add(t.id);
    });
    // Also seed from completedTasks so finished teacher assignments
    // don't get re-added to the active list after a page reload.
    completedTasks.forEach(t => {
      if (t.fromTeacher) processedTeacherIds.current.add(t.id);
      // Seed XP guard from already-approved tasks so we never double-award on reload
      if (t.fromTeacher && t.status === 'approved') xpAwardedAssignmentIds.current.add(t.id);
    });
    // Seed from rejectedTasks — they are in the rework tab, not active list
    rejectedTasks.forEach(t => {
      if (t.fromTeacher) processedTeacherIds.current.add(t.id);
    });
    // Seed from pendingRejectedTasks — persisted across reloads, must not be re-added as "new"
    pendingRejectedTasks.forEach(t => {
      if (t.fromTeacher) processedTeacherIds.current.add(t.id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep both refs in sync whenever completedTasks changes —
  // ensures approved/pending teacher tasks can NEVER be re-added to the
  // active list, even across reloads or rapid state transitions.
  useEffect(() => {
    const ids = new Set<number>();
    completedTasks.forEach(t => {
      if (t.fromTeacher) {
        ids.add(t.id);
        processedTeacherIds.current.add(t.id);
      }
    });
    completedTeacherIdsRef.current = ids;
  }, [completedTasks]);

  useEffect(() => {
    fetchTeacherAssignments();
    const interval = setInterval(fetchTeacherAssignments, 15000);
    return () => clearInterval(interval);
  }, [fetchTeacherAssignments]);

  const checkSubmissionStatus = useCallback(async () => {
    if (!getStoredToken()) return;
    const hasPending = completedTasks.some(t => t.fromTeacher && t.status === 'pending');
    if (!hasPending) return;

    try {
      const submissions = await apiRequest<any[]>('/submissions/student');
      let newlyRejected: Task[] = [];

      setCompletedTasks(prev => {
        let changed = false;
        const newTasks = prev.map(t => {
          // Only check teacher tasks that are currently pending
          if (!t.fromTeacher || t.status !== 'pending') return t;

          // Match by submissionId first (exact), then fall back to assignmentId
          const sub = submissions.find(s =>
            (t.submissionId ? String(s.id) === String(t.submissionId) : false) ||
            s.assignmentId === t.id
          );
          if (!sub || sub.status === 'pending') return t;

          changed = true;

          if (sub.status === 'approved') {
            const difficultyXpMap: Record<string, number> = { Легко: 8, Средне: 20, Сложно: 50, '': 20 };
            const earnedXp = typeof sub.xp === 'number' ? sub.xp : (difficultyXpMap[t.difficulty] ?? 20);

            // Guard against double-awarding XP (race condition between polling cycles)
            if (!xpAwardedAssignmentIds.current.has(t.id)) {
              xpAwardedAssignmentIds.current.add(t.id);
              setXp(x => x + earnedXp);
              notifyUser('🎉 Задание принято!', {
                body: `Учитель принял «${t.title}». Начислено +${earnedXp} XP!`,
                isUrgent: false
              });
            }
            return { ...t, status: 'approved' as const };

          } else if (sub.status === 'rejected') {
            // Only notify once per rejection (check pendingRejectedTasks already has it)
            newlyRejected.push({ ...t, status: 'rejected' as const, submissionId: undefined });
            return { ...t, status: 'rejected' as const };
          }

          return t;
        });
        return changed ? newTasks.filter(t => t.status !== 'rejected') : prev;
      });

      if (newlyRejected.length > 0) {
        // Queue into pending — user applies manually from rework tab (no auto-switch, no flicker)
        setPendingRejectedTasks(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const unique = newlyRejected.filter(rt => !existingIds.has(rt.id));
          if (unique.length === 0) return prev;
          // Notify only for truly new rejections
          unique.forEach(t => {
            notifyUser('❌ Задание отправлено на доработку', {
              body: `Учитель отклонил «${t.title}». Открой вкладку «На доработку» и нажми «Показать».`,
              isUrgent: true
            });
          });
          return [...unique, ...prev];
        });
      }
    } catch {
      // ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedTasks]);

  useEffect(() => {
    const interval = setInterval(checkSubmissionStatus, 3000);
    return () => clearInterval(interval);
  }, [checkSubmissionStatus]);

  const handleMarkAsRead = (id: number) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  // Ref для отслеживания уже отправленных уведомлений о дедлайнах
  const notifiedDeadlinesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem('rezoflow_notified_deadlines');
    if (saved) {
      try { notifiedDeadlinesRef.current = new Set(JSON.parse(saved)); } catch {}
    }
  }, []);

  // Проверка приближающих��я дедлайнов каждую минуту
  useEffect(() => {
    const checkDeadlines = () => {
      const now = new Date();
      tasks.forEach(task => {
        if (!task.deadline) return;
        const deadlineDate = new Date(task.deadline + 'T23:59:59');
        const diffMs = deadlineDate.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        const key3h = `${task.id}_3h`;
        const key1h = `${task.id}_1h`;

        if (diffHours > 2.83 && diffHours <= 3.1 && !notifiedDeadlinesRef.current.has(key3h)) {
          notifiedDeadlinesRef.current.add(key3h);
          localStorage.setItem('rezoflow_notified_deadlines', JSON.stringify([...notifiedDeadlinesRef.current]));
          notifyUser('⏰ До дедлайна 3 часа', {
            body: `Задача "${task.title}" (${task.subject}) истекает сегодня`,
            isUrgent: false,
            taskId: task.id
          });
        }

        if (diffHours > 0.83 && diffHours <= 1.1 && !notifiedDeadlinesRef.current.has(key1h)) {
          notifiedDeadlinesRef.current.add(key1h);
          localStorage.setItem('rezoflow_notified_deadlines', JSON.stringify([...notifiedDeadlinesRef.current]));
          notifyUser('🚨 До дедлайна 1 час!', {
            body: `Срочно! Задача "${task.title}" (${task.subject}) истекает через час`,
            isUrgent: true,
            taskId: task.id
          });
        }
      });
    };

    checkDeadlines();
    const interval = setInterval(checkDeadlines, 60 * 1000);
    return () => clearInterval(interval);
  }, [tasks]);

  const [isRecording, setIsRecording] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [voiceStep, setVoiceStep] = useState<'idle' | 'recording' | 'processing'>('idle');
  const speechTranscriptRef = useRef('');
  const stopRecordingRef = useRef<(() => void) | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  const [newTask, setNewTask] = useState({
    title: '',
    subject: '',
    difficulty: '' as '' | 'Легко' | 'Средне' | 'Сложно',
    deadline: '',
    description: '',
    duration: '',
    isPriority: false,
  });

  const handleVoiceInput = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      // Сброс перед записью
      speechTranscriptRef.current = '';
      setLiveTranscript('');
      setVoiceStep('recording');
      setIsRecording(true);

      // Web Speech API — живой транскрипт в реальном времени
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        speechRecognitionRef.current = recognition;
        recognition.lang = 'ru-RU';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              speechTranscriptRef.current += event.results[i][0].transcript + ' ';
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          setLiveTranscript((speechTranscriptRef.current + interim).trim());
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech Recognition error:', event.error);
        };

        try { recognition.start(); } catch (e) { console.warn(e); }
      }

      const processAfterStop = async () => {
        // Останавливаем Web Speech API и ждём финальные результаты
        if (speechRecognitionRef.current) {
          try { speechRecognitionRef.current.stop(); } catch (_) {}
          speechRecognitionRef.current = null;
        }
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);

        // Пауза для финальных результатов Web Speech API
        await new Promise(resolve => setTimeout(resolve, 400));

        const transcript = speechTranscriptRef.current.trim();
        setVoiceStep('processing');
        setIsParsing(true);

        try {
          let textForAI = transcript;

          if (!textForAI || textForAI.length < 3) {
            // Fallback: транскрипция через Whisper
            const audioBlob = new Blob(chunks, { type: mimeType });
            if (audioBlob.size < 1000) {
              setVoiceStep('idle');
              setIsParsing(false);
              setLiveTranscript('');
              alert('Запись слишком короткая. Попробуйте ещё раз.');
              return;
            }
            const whisperTranscript = await transcribeAudio(audioBlob);
            if (!whisperTranscript) {
              setVoiceStep('idle');
              setIsParsing(false);
              alert('Не удалось распознать речь. Попробуйте ещё раз.');
              return;
            }
            textForAI = whisperTranscript;
            setLiveTranscript(whisperTranscript);
          }

          // Отправляем текст в нейросеть (GPT-4o-mini через OpenRouter)
          const parsed = await parseTaskWithAI(textForAI, null);
          setNewTask(prev => ({
            ...prev,
            title: parsed.title,
            subject: parsed.subject,
            difficulty: parsed.difficulty,
            deadline: parsed.deadline,
            duration: parsed.duration,
            description: parsed.description,
            isPriority: parsed.isPriority,
          }));
          setLiveTranscript('');
          setVoiceStep('idle');
          setAddMode('text');
        } catch (error) {
          console.error('Ошибка при обработке голосового ввода:', error);
          setVoiceStep('idle');
          alert('Ошибка при обработке записи. Попробуйте ещё раз.');
        } finally {
          setIsParsing(false);
        }
      };

      mediaRecorder.onstop = processAfterStop;

      // Детекция тишины через AudioContext
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 1024;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      mediaRecorder.start(100);

      let silenceStart = 0;
      let hasSpeech = false;
      const MAX_DURATION = 60000;
      const SILENCE_THRESHOLD = 12;
      const SILENCE_DURATION = 2500;

      const maxTimer = setTimeout(() => {
        if (mediaRecorder.state === 'recording') mediaRecorder.stop();
        audioContext.close();
      }, MAX_DURATION);

      const stopRecording = () => {
        clearTimeout(maxTimer);
        audioContext.close();
        if (mediaRecorder.state === 'recording') mediaRecorder.stop();
      };

      stopRecordingRef.current = stopRecording;

      const checkSilence = () => {
        if (mediaRecorder.state !== 'recording') {
          clearTimeout(maxTimer);
          audioContext.close();
          return;
        }
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

        if (avg > SILENCE_THRESHOLD) {
          hasSpeech = true;
          silenceStart = 0;
        } else if (hasSpeech) {
          if (silenceStart === 0) silenceStart = Date.now();
          if (Date.now() - silenceStart > SILENCE_DURATION) {
            stopRecording();
            return;
          }
        }
        requestAnimationFrame(checkSilence);
      };

      setTimeout(() => requestAnimationFrame(checkSilence), 1500);

    } catch (err) {
      console.error('Ошибка доступа к микрофону:', err);
      setIsRecording(false);
      setVoiceStep('idle');
      alert('Не удалось получить доступ к микрофону. Разрешите браузеру использовать микрофон в настройках сайта.');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        setUploadedImage(dataUrl);
        setAddMode('text');
        setIsParsing(true);
        try {
          const parsed = await parseTaskWithAI("Распознай задание на этом изображении. Определи его суть, установи предмет, примерное время и сроки, и обязательно разбей выполнение на логические шаги (подзадачи).", dataUrl);
          setNewTask(prev => ({
            ...prev,
            title: parsed.title,
            subject: parsed.subject,
            difficulty: parsed.difficulty,
            deadline: parsed.deadline,
            duration: parsed.duration,
            description: parsed.description,
            isPriority: parsed.isPriority,
          }));
        } catch (error) {
          console.error(error);
          setNewTask(prev => ({ ...prev, title: `Задание из изображения (${file.name})` }));
        } finally {
          setIsParsing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleParseAI = async () => {
    if (!newTask.title && !uploadedImage) {
      alert('Введите текст задачи, запишите голос или загрузите изображение для распознавания.');
      return;
    }
    
    setIsParsing(true);
    try {
      const parsed = await parseTaskWithAI(newTask.title || "Распознай эту задачу, определи предмет, сроки и разбей на подзадачи", uploadedImage);
      setNewTask({
        ...newTask,
        title: parsed.title,
        subject: parsed.subject,
        difficulty: parsed.difficulty,
        deadline: parsed.deadline,
        duration: parsed.duration,
        description: parsed.description,
        isPriority: parsed.isPriority,
      });
    } catch (error) {
      console.error(error);
      alert('Ошибка при обращении к нейросети');
    } finally {
      setIsParsing(false);
      setAddMode('text');
    }
  };

  const removeImage = () => {
    setUploadedImage(null);
  };

  const handleTaskComplete = async (taskId: number, screenshot: string | null) => {
    // Check both active tasks and rejected (rework) tasks
    const task = tasks.find(t => t.id === taskId) ?? rejectedTasks.find(t => t.id === taskId);
    if (!task) return;

    const isFromRework = rejectedTasks.some(t => t.id === taskId);

    const difficultyXpMap: Record<string, number> = { Легко: 8, Средне: 20, Сложно: 50, '': 20 };
    const earnedXp = difficultyXpMap[task.difficulty] ?? 20;
    const completedAt = Date.now();

    const timeSpentMs = task.createdAt ? completedAt - task.createdAt : 0;
    const hours = Math.floor(timeSpentMs / 3600000);
    const minutes = Math.max(1, Math.round((timeSpentMs % 3600000) / 60000));
    const timeStr = hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`;

    if (task.fromTeacher) {
      // ── Optimistic update: remove from UI immediately ──
      if (isFromRework) {
        setRejectedTasks(prev => prev.filter(t => t.id !== taskId));
      } else {
        setTasks(prev => prev.filter(t => t.id !== taskId));
      }
      const pendingTask = { ...task, screenshot: screenshot || undefined, completedAt, status: 'pending' as const, submissionId: undefined };
      setCompletedTasks(prev => [pendingTask, ...prev]);

      try {
        const res = await apiRequest<any>(`/assignments/${task.id}/submit`, {
          method: 'POST',
          body: JSON.stringify({
            studentName: userName,
            studentEmail: userEmail,
            screenshot: screenshot || null,
            difficulty: task.difficulty,
            xp: earnedXp,
          }),
        });

        const subId: string | undefined = res.submission?.id;
        if (subId) {
          setCompletedTasks(prev => prev.map(t => t.id === taskId ? { ...t, submissionId: subId } : t));
        }

        notifyUser('📤 Отправлено на проверку', {
          body: `Задание «${task.title}» отправлено. XP будет начислено после проверки учителем.`,
          isUrgent: false
        });
      } catch (err) {
        console.error('Failed to submit assignment to server:', err);
        // Roll back optimistic update so the student can try again
        setCompletedTasks(prev => prev.filter(t => t.id !== taskId));
        if (isFromRework) {
          setRejectedTasks(prev => [task, ...prev]);
        } else {
          setTasks(prev => [task, ...prev]);
        }
        alert('Не удалось отправить задание. Проверьте подключение и попробуйте ещё раз.');
        throw err; // re-throw so TaskCard resets isSubmitting
      }
    } else {
      // Optimistic removal for self-created tasks too
      setTasks(prev => prev.filter(t => t.id !== taskId));
      const completedTask = { ...task, screenshot: screenshot || undefined, completedAt, status: 'approved' as const };
      setCompletedTasks(prev => [completedTask, ...prev]);

      notifyUser('✅ Задача выполнена', {
        body: `«${task.title}» завершена за ${timeStr}`,
        isUrgent: false
      });
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const closeAddForm = () => {
    setShowAddForm(false);
    setAddMode('selection');
    setVoiceStep('idle');
    setIsRecording(false);
    setIsParsing(false);
    setNewTask({
      title: '',
      subject: '',
      difficulty: '' as '' | 'Легко' | 'Средне' | 'Сложно',
      deadline: '',
      description: '',
      duration: '',
      isPriority: false,
    });
    setUploadedImage(null);
    setLiveTranscript('');
    speechTranscriptRef.current = '';
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch (_) {}
      speechRecognitionRef.current = null;
    }
    if (stopRecordingRef.current) {
      try { stopRecordingRef.current(); } catch (_) {}
      stopRecordingRef.current = null;
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const task: Task = {
      id: Date.now(),
      title: newTask.title,
      subject: newTask.subject,
      difficulty: newTask.difficulty,
      deadline: newTask.deadline,
      description: newTask.description,
      isPriority: newTask.isPriority,
      duration: newTask.duration,
      createdAt: Date.now(),
    };
    setTasks([...tasks, task]);
    closeAddForm();
  };

  const sortedTasks = useMemo(() => {
    // Deduplicate by id before sorting – prevents duplicate React keys in the list
    const seen = new Set<number>();
    return [...tasks]
      .filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; })
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  }, [tasks]);

  // Chart data – stable reference so recharts doesn't re-key internal nodes on every render
  const chartData = useMemo(() => {
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const dayXp = [0, 0, 0, 0, 0, 0, 0];
    const difficultyMap: Record<string, number> = { 'Легко': 8, 'Средне': 20, 'Сложно': 50 };
    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentDayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const weekStart = new Date(todayDate);
    weekStart.setDate(todayDate.getDate() - currentDayIndex);

    completedTasks.forEach(task => {
      if (task.completedAt && task.status !== 'pending' && task.status !== 'rejected') {
        const taskDate = new Date(task.completedAt);
        if (taskDate >= weekStart) {
          const dayIndex = taskDate.getDay() === 0 ? 6 : taskDate.getDay() - 1;
          dayXp[dayIndex] += difficultyMap[task.difficulty] || 0;
        }
      }
    });

    return days.map((day, index) => ({ id: `day-${index}`, day, xp: dayXp[index] }));
  }, [completedTasks]);

  const getLevelInfo = (totalXp: number) => {
    let currentLevel = 1;
    let xpForNextLevel = 100;
    let xpInCurrentLevel = totalXp;

    while (xpInCurrentLevel >= xpForNextLevel) {
      xpInCurrentLevel -= xpForNextLevel;
      currentLevel++;
      xpForNextLevel *= 2; // Удваиваем необходимое количество XP
    }

    return {
      currentLevel,
      xpProgress: xpInCurrentLevel,
      xpForNextLevel,
      progressPercentage: (xpInCurrentLevel / xpForNextLevel) * 100
    };
  };

  const { currentLevel, xpProgress, xpForNextLevel, progressPercentage } = getLevelInfo(xp);
  
  const achievements = [
    { id: 1, name: 'Первый шаг', description: 'Выполнил первую задачу', unlocked: completedTasks.length >= 1, icon: Target },
    { id: 2, name: 'Мастер планирования', description: 'Выполнил 5 задач', unlocked: completedTasks.length >= 5, icon: Star },
    { id: 3, name: 'Неостановимый', description: 'Достиг 5-го уровня', unlocked: currentLevel >= 5, icon: Trophy },
    { id: 4, name: 'Легенда', description: 'Достиг 10-го уровня', unlocked: currentLevel >= 10, icon: Medal },
  ];

  return (
    <div className="min-h-screen text-foreground relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className={`fixed top-0 left-[10%] w-[600px] h-[600px] ${isLightGradient ? 'bg-primary/20' : 'bg-primary/10'} rounded-full blur-[150px] pointer-events-none transition-all duration-1000`} />
      <div className={`fixed bottom-0 right-[10%] w-[800px] h-[800px] ${isLightGradient ? 'bg-purple-400/20' : 'bg-purple-600/10'} rounded-full blur-[180px] pointer-events-none transition-all duration-1000`} />

      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 md:space-y-8 relative z-10 pt-8 md:pt-16 pb-16 md:pb-24">
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 md:p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md transition-all shadow-[0_0_20px_rgba(139,92,246,0.1)] hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] shrink-0"
            >
              <Settings className="w-5 h-5 md:w-6 md:h-6 text-white/80 hover:text-white transition-colors" />
            </button>
            
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 md:p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md transition-all shadow-[0_0_20px_rgba(139,92,246,0.1)] hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] shrink-0 relative"
              >
                <Bell className="w-5 h-5 md:w-6 md:h-6 text-white/80 hover:text-white transition-colors" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0D0D0D] shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute left-0 md:left-0 top-full mt-4 w-[280px] md:w-[320px] max-h-[300px] bg-black/40 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden z-50 origin-top-left flex flex-col"
                  >
                    <div className="p-3 md:p-4 border-b border-white/5 flex items-center justify-between bg-white/5 shrink-0">
                      <h3 className="text-sm md:text-base font-semibold text-white flex items-center gap-2">
                        <Bell className="w-4 h-4 text-primary" />
                        Уведомления
                      </h3>
                      {unreadCount > 0 && (
                        <button 
                          onClick={handleMarkAllAsRead}
                          className="text-xs text-primary hover:text-white transition-colors"
                        >
                          Прочитать все
                        </button>
                      )}
                    </div>
                    
                    <div className="overflow-y-auto custom-scrollbar flex-1">
                      {notifications.length > 0 ? (
                        <div className="flex flex-col">
                          {notifications.map(notification => (
                            <div 
                              key={notification.id} 
                              onClick={() => {
                                handleMarkAsRead(notification.id);
                                if (notification.taskId) {
                                  setShowNotifications(false);
                                  scrollToTask(notification.taskId);
                                }
                              }}
                              className={`p-3 md:p-4 border-b border-white/5 transition-colors cursor-pointer hover:bg-white/[0.08] ${!notification.read ? 'bg-primary/10' : ''}`}
                            >
                              <div className="flex gap-2 md:gap-3">
                                <div className="shrink-0 mt-1">
                                  <div className={`w-2 h-2 rounded-full ${!notification.read ? 'bg-primary shadow-[0_0_8px_rgba(139,92,246,0.8)]' : 'bg-transparent'}`} />
                                </div>
                                <div className="space-y-1 flex-1">
                                  <h4 className={`text-sm font-medium ${!notification.read ? 'text-white' : 'text-white/70'}`}>
                                    {notification.title}
                                  </h4>
                                  <p className="text-xs text-white/60 leading-relaxed line-clamp-2">
                                    {notification.description}
                                  </p>
                                  <span className="text-[10px] text-white/40 block mt-1 md:mt-2">
                                    {notification.time}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 md:p-8 text-center flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                            <Bell className="w-5 h-5 text-white/20" />
                          </div>
                          <p className="text-white/50 text-sm">Нет новых уведомлений</p>

                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Leaderboard icon button */}
            <button
              onClick={() => setShowLeaderboard(true)}
              className="p-2 md:p-3 bg-white/5 hover:bg-yellow-500/15 rounded-2xl border border-white/10 hover:border-yellow-500/30 backdrop-blur-md transition-all shadow-[0_0_20px_rgba(139,92,246,0.1)] hover:shadow-[0_0_20px_rgba(234,179,8,0.25)] shrink-0"
              title="Рейтинг учеников"
            >
              <Trophy className="w-5 h-5 md:w-6 md:h-6 text-white/80 hover:text-white transition-colors" />
            </button>
          </div>

          <div className="flex-1"></div>

          <div
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2 md:gap-3 bg-white/5 hover:bg-white/10 transition-all cursor-pointer p-1.5 pr-3 md:pr-4 rounded-2xl border border-white/10 backdrop-blur-md shadow-[0_0_20px_rgba(139,92,246,0.1)] hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] shrink-0 group"
          >
            <div className="relative">
              <div className="relative flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl bg-black/50 border border-white/10 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                {avatar ? (
                  <img src={avatar} alt="Аватар" className="w-full h-full object-cover" />
                ) : (
                  <GraduationCap className="w-5 h-5 text-primary drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
                )}
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 bg-gradient-to-r from-primary to-purple-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0D0D0D] shadow-[0_0_10px_rgba(139,92,246,0.5)] group-hover:scale-110 transition-transform duration-300">
                {currentLevel}
              </div>
            </div>
            <div className="hidden md:block text-left">
              <div className="text-sm font-medium text-white truncate max-w-[120px] group-hover:text-primary transition-colors">{userName || "Алексей"}</div>
              <div className="text-xs text-primary/80 font-medium">{xpProgress} / {xpForNextLevel} XP</div>
            </div>
          </div>
        </motion.header>

        <main className="space-y-6 md:space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 md:space-y-8 -mt-8 md:-mt-12"
          >
            <div className="flex flex-col items-center justify-center py-2 md:py-3 space-y-6 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-32 bg-primary/20 blur-[100px] pointer-events-none rounded-full" />
              
              <div className="text-center space-y-4 relative z-10">
                <h1 className="-mt-4 text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-primary to-purple-400 drop-shadow-[0_0_20px_rgba(139,92,246,0.4)] tracking-tight text-center">
                  RezoFlow
                </h1>


              </div>

              <div className="w-full max-w-md relative z-10 pt-4">
                <motion.button
                  whileHover={{ scale: 1.02, translateY: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-primary to-[#7C3AED] text-white text-base md:text-lg font-semibold rounded-2xl shadow-[0_0_30px_rgba(139,92,246,0.4)] hover:shadow-[0_0_40px_rgba(139,92,246,0.6)] border border-white/10 transition-all duration-300 group overflow-hidden relative"
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-t from-white/0 via-white/20 to-white/0 -translate-y-full group-hover:animate-[shimmer_1.5s_infinite]" />
                  <div className="p-2 bg-white/20 rounded-xl group-hover:rotate-90 transition-transform duration-300 relative z-10">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="relative z-10">Создать задачу</span>
                </motion.button>
                <StudentAIChat isLightGradient={isLightGradient} />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {/* Tabs */}
              <div className="flex items-center gap-2 px-1">
                <button
                  onClick={() => setActiveTab('active')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                    activeTab === 'active'
                      ? 'bg-primary/15 text-primary border-primary/30'
                      : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white/80'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Активные
                  {sortedTasks.length > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeTab === 'active' ? 'bg-primary/30 text-primary' : 'bg-white/10 text-white/40'}`}>
                      {sortedTasks.length}
                    </span>
                  )}
                  {pendingTeacherTasks.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-primary/40 text-primary animate-pulse">
                      +{pendingTeacherTasks.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('rework')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                    activeTab === 'rework'
                      ? 'bg-red-500/15 text-red-400 border-red-500/30'
                      : rejectedTasks.length > 0 || pendingRejectedTasks.length > 0
                        ? 'bg-red-500/5 text-red-400/70 border-red-500/20 hover:bg-red-500/10 hover:text-red-400'
                        : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white/80'
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  На доработку
                  {(rejectedTasks.length > 0 || pendingRejectedTasks.length > 0) && (
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeTab === 'rework' ? 'bg-red-500/30 text-red-400' : 'bg-red-500/20 text-red-400'}`}>
                      {rejectedTasks.length + pendingRejectedTasks.length}
                    </span>
                  )}
                  {pendingRejectedTasks.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  )}
                </button>
              </div>

              {/* ── Refresh banner: new teacher assignments ── */}
              <AnimatePresence>
                {pendingTeacherTasks.length > 0 && activeTab === 'active' && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary/10 border border-primary/25 backdrop-blur-sm"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                    <span className="flex-1 text-sm text-primary/90">
                      {pendingTeacherTasks.length === 1
                        ? 'Новое задание от учителя'
                        : `${pendingTeacherTasks.length} новых задания от учителя`}
                    </span>
                    <button
                      onClick={applyPendingTasks}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 hover:bg-primary/35 text-primary text-xs font-semibold rounded-xl border border-primary/30 transition-all shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Показать
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Refresh banner: rework tab pending ── */}
              <AnimatePresence>
                {pendingRejectedTasks.length > 0 && activeTab === 'rework' && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/25 backdrop-blur-sm"
                  >
                    <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
                    <span className="flex-1 text-sm text-red-400/90">
                      {pendingRejectedTasks.length === 1
                        ? 'Учитель отправил задание на доработку'
                        : `${pendingRejectedTasks.length} задания отправлены на доработку`}
                    </span>
                    <button
                      onClick={applyPendingRejected}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/35 text-red-400 text-xs font-semibold rounded-xl border border-red-500/30 transition-all shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Показать
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── На проверке у учителя ── */}
              {(() => {
                const pendingTasks = completedTasks.filter(t => t.status === 'pending' && t.fromTeacher);
                if (pendingTasks.length === 0) return null;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    <button
                      onClick={() => setPendingCollapsed(v => !v)}
                      className="w-full flex items-center gap-2 px-1 group"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 uppercase tracking-wide">
                        <motion.span
                          animate={{ opacity: [1, 0.4, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"
                        />
                        На проверке у учителя
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-400">
                        {pendingTasks.length}
                      </span>
                      <motion.span
                        animate={{ rotate: pendingCollapsed ? 0 : -90 }}
                        transition={{ duration: 0.2 }}
                        className="ml-auto text-amber-400/60 group-hover:text-amber-400 transition-colors"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </motion.span>
                    </button>
                    <AnimatePresence initial={false}>
                      {pendingCollapsed && (
                        <motion.div
                          key="pending-list"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden space-y-2"
                        >
                          {pendingTasks.map(task => (
                            <motion.div
                              key={`pending-${task.id}`}
                              layout
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/[0.05] border border-amber-500/20 backdrop-blur-sm"
                            >
                              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                                <Clock className="w-5 h-5 text-amber-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white/90 font-medium text-sm truncate">{task.title}</p>
                                <p className="text-white/40 text-xs mt-0.5">{task.subject} · {task.teacherName || 'Учитель'} проверяет работу</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 text-[11px] font-semibold rounded-lg border border-amber-500/20">
                                  Ожидание
                                </span>
                              </div>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })()}

              {/* Active tasks */}
              <AnimatePresence mode="popLayout">
                {activeTab === 'active' && (
                  sortedTasks.length > 0 ? (
                    sortedTasks.map((task, idx) => (
                      <motion.div
                        key={task.id}
                        id={`task-${task.id}`}
                        layout
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.3, delay: idx * 0.05 }}
                      >
                        <TaskCard task={task} onComplete={handleTaskComplete} />
                      </motion.div>
                    ))
                  ) : (
                    <motion.div
                      key="empty-active"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-20 px-6 rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-md"
                    >
                      <div className="w-16 h-16 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-4">
                        <FileText className="w-8 h-8 text-white/20" />
                      </div>
                      <p className="text-white/50 text-lg mb-4">
                        У тебя пока нет заданий. Самое время добавить первое!
                      </p>
                    </motion.div>
                  )
                )}
              </AnimatePresence>

              {/* Rework (rejected) tasks */}
              <AnimatePresence mode="popLayout">
                {activeTab === 'rework' && (
                  rejectedTasks.length > 0 ? (
                    rejectedTasks.map((task, idx) => (
                      <motion.div
                        key={task.id}
                        id={`task-${task.id}`}
                        layout
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.3, delay: idx * 0.05 }}
                      >
                        <div className="space-y-2">
                          {/* Rejection banner */}
                          <div className="flex items-center gap-3 p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                            <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
                              <XCircle className="w-4 h-4 text-red-400" />
                            </div>
                            <div>
                              <p className="text-red-400 text-sm font-semibold">Учитель отправил на доработку</p>
                              <p className="text-red-400/60 text-xs mt-0.5">Исправь работу и отправь повторно</p>
                            </div>
                          </div>

                          {/* Previous submission preview */}
                          {task.screenshot && (
                            <div className="bg-[#1A1A1A]/60 backdrop-blur-sm rounded-2xl border border-red-500/15 p-4 space-y-2">
                              <p className="text-xs text-white/40 flex items-center gap-1.5">
                                <ImageIcon className="w-3.5 h-3.5 text-red-400/60" />
                                Твоя предыдущая отправка учителю:
                              </p>
                              <div className="relative rounded-xl overflow-hidden border border-white/5 bg-black/40 aspect-video flex items-center justify-center">
                                <img
                                  src={task.screenshot}
                                  alt="Предыдущее решение"
                                  className="w-full h-full object-contain opacity-75"
                                />
                              </div>
                            </div>
                          )}

                          {/* Task card for resubmission */}
                          <TaskCard task={{ ...task, screenshot: undefined, status: undefined }} onComplete={handleTaskComplete} />
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <motion.div
                      key="empty-rework"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-20 px-6 rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-md"
                    >
                      <div className="w-16 h-16 mx-auto bg-green-500/10 rounded-full flex items-center justify-center mb-4 border border-green-500/20">
                        <RotateCcw className="w-8 h-8 text-green-400/50" />
                      </div>
                      <p className="text-white/50 text-lg">Все задания приняты!</p>
                      <p className="text-white/30 text-sm mt-1">Отклонённые задания будут появляться здесь</p>
                    </motion.div>
                  )
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          <AnimatePresence>
            {showProfileModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 overflow-y-auto overflow-x-hidden flex justify-center items-start pt-10 pb-10"
              >
                <div className="w-full max-w-4xl px-4 md:px-6 flex flex-col gap-6 relative z-10">
                  <div className="flex justify-between items-center bg-[#1A1A1A]/90 p-4 rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl">
                    <div className="flex items-center gap-2 ml-2">
                      <button
                        onClick={() => setProfileTab('profile')}
                        className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all ${profileTab === 'profile' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                      >
                        👤 Профиль
                      </button>
                      <button
                        onClick={() => setProfileTab('character')}
                        className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all ${profileTab === 'character' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                      >
                        🎮 Персонаж
                      </button>
                    </div>
                    <button 
                      onClick={() => { setShowProfileModal(false); setProfileTab('profile'); }}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  {profileTab === 'character' ? (
                    <CharacterTab
                      xp={xp}
                      characterId={characterId}
                      onSelectCharacter={setCharacterId}
                    />
                  ) : (
                  <div className="space-y-6">
                    {/* Level Card */}
                    <div className="bg-[#1A1A1A]/90 backdrop-blur-xl rounded-3xl p-6 md:p-10 border border-white/5 shadow-2xl relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />
                      <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
                        <div className="flex-shrink-0 relative group">
                          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white/10 shadow-[0_0_50px_rgba(139,92,246,0.3)] overflow-hidden bg-black/50 flex items-center justify-center relative">
                            {avatar ? (
                              <img src={avatar} alt="Аватар" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-16 h-16 text-white/20" />
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                              <Camera className="w-8 h-8 text-white" />
                              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 w-full text-center md:text-left space-y-4">
                          <div>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                              <h2 className="text-2xl md:text-3xl font-bold text-white">{userName || "Алексей"}</h2>
                              <StudentClassBadge studentClass={studentClass} />
                            </div>
                            <p className="text-white/50 mt-1">Продолжай в том же духе, чтобы стать легендой!</p>
                          </div>
                          
                          <div className="space-y-2 pt-2">
                            <div className="flex justify-between text-sm font-medium">
                              <span className="text-primary flex items-center gap-1.5"><Star className="w-4 h-4" /> Уровень {currentLevel}</span>
                              <span className="text-white/60">{xpProgress} / {xpForNextLevel} XP</span>
                            </div>
                            <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/10">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercentage}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-primary to-purple-500 relative"
                              >
                                <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite] -skew-x-12" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)' }} />
                              </motion.div>
                            </div>
                            <p className="text-xs text-white/40 text-right">Осталось {xpForNextLevel - xpProgress} XP до {currentLevel + 1} уровня</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats & Achievements */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-[#1A1A1A]/90 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/5 shadow-2xl">
                        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                          <Target className="w-5 h-5 text-primary" /> Статистика
                        </h3>
                        <div className="space-y-4">
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart
                              data={chartData}
                              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                            >
                              <CartesianGrid key="grid" strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                              <XAxis
                                key="x-axis"
                                dataKey="day"
                                stroke="rgba(255,255,255,0.3)"
                                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                              />
                              <YAxis
                                key="y-axis"
                                stroke="rgba(255,255,255,0.3)"
                                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                                tickFormatter={(value) => `${value}`}
                                allowDecimals={false}
                                domain={[0, 'auto']}
                              />
                              <Tooltip
                                key="tooltip"
                                contentStyle={{
                                  backgroundColor: 'rgba(26, 26, 26, 0.95)',
                                  border: '1px solid rgba(139, 92, 246, 0.3)',
                                  borderRadius: '12px',
                                  color: '#fff',
                                  padding: '8px 12px'
                                }}
                                labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
                                formatter={(value: number) => [`${value} XP`, 'Получено']}
                              />
                              <Line
                                key="line-xp"
                                type="monotone"
                                dataKey="xp"
                                stroke="#8B5CF6"
                                strokeWidth={3}
                                dot={{ fill: '#8B5CF6', r: 4, strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 6, fill: '#8B5CF6', stroke: '#fff', strokeWidth: 2 }}
                                isAnimationActive={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                          <div className="flex justify-between items-center px-2 pt-2">
                            <span className="text-xs text-white/40">Прогресс за неделю</span>
                            <span className="text-sm font-bold text-primary">{xp} XP</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#1A1A1A]/90 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/5 shadow-2xl">
                        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-yellow-500" /> Достижения
                        </h3>
                        <div className="space-y-3">
                          {achievements.map(ach => {
                            const Icon = ach.icon;
                            return (
                              <div
                                key={ach.id}
                                className={`flex items-center gap-4 p-3 rounded-2xl border transition-all ${ach.unlocked ? 'bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(139,92,246,0.1)]' : 'bg-white/5 border-transparent opacity-50 grayscale'}`}
                              >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${ach.unlocked ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white/40'}`}>
                                  <Icon className="w-6 h-6" />
                                </div>
                                <div>
                                  <h4 className={`font-medium ${ach.unlocked ? 'text-white' : 'text-white/60'}`}>{ach.name}</h4>
                                  <p className="text-xs text-white/50">{ach.description}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Archive Section */}
                    <details className="bg-[#1A1A1A]/90 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/5 shadow-2xl group [&_summary::-webkit-details-marker]:hidden">
                      <summary className="text-lg font-semibold text-white cursor-pointer flex items-center justify-between list-none">
                        <div className="flex items-center gap-2">
                          <Archive className="w-5 h-5 text-purple-400" /> Архив задач
                        </div>
                        <svg className="w-5 h-5 text-white/50 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="mt-6 space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {completedTasks.length > 0 ? (
                          completedTasks.map((task) => (
                            <div
                              key={task.id}
                              className={`p-4 rounded-2xl border transition-all flex flex-col gap-2 ${
                                task.fromTeacher && task.status === 'pending'
                                  ? 'bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10'
                                  : task.fromTeacher && task.status === 'approved'
                                  ? 'bg-green-500/5 border-green-500/20 hover:bg-green-500/10'
                                  : task.fromTeacher && task.status === 'rejected'
                                  ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                                  : 'bg-white/5 border-white/5 hover:bg-white/10'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-white mb-1 truncate">{task.title}</h4>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm text-white/50">{task.subject} • {task.difficulty}</p>
                                    {task.teacherName && (
                                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                        <User className="w-3 h-3" />
                                        {task.teacherName}
                                      </span>
                                    )}
                                    {/* Учительские задания */}
                                    {task.fromTeacher && task.status === 'pending' && (
                                      <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded-lg border border-yellow-500/30">
                                        ⏳ На проверке
                                      </span>
                                    )}
                                    {task.fromTeacher && task.status === 'rejected' && (
                                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded-lg border border-red-500/30">❌ Отклонено</span>
                                    )}
                                    {task.fromTeacher && task.status === 'approved' && (() => {
                                      const difficultyXpMap: Record<string, number> = { Легко: 8, Средне: 20, Сложно: 50, '': 20 };
                                      const earnedXp = difficultyXpMap[task.difficulty] ?? 20;
                                      return (
                                        <>
                                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded-lg border border-green-500/30">
                                            ✅ Принята учителем
                                          </span>
                                          <span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] rounded-lg border border-primary/30">
                                            +{earnedXp} XP начислено
                                          </span>
                                        </>
                                      );
                                    })()}
                                    {/* Личные задания */}
                                    {!task.fromTeacher && (
                                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded-lg border border-green-500/30">✓ Выполнено</span>
                                    )}
                                  </div>
                                </div>
                                {task.screenshot && (
                                  <img
                                    src={task.screenshot}
                                    alt="Скриншот"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const link = document.createElement('a');
                                      link.href = task.screenshot;
                                      link.download = `screenshot-${task.id}.png`;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                    }}
                                    className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                  />
                                )}
                              </div>
                              {task.completedAt && (
                                <div className="flex items-center justify-between text-xs text-white/40 border-t border-white/5 pt-2 mt-1">
                                  <span>
                                    {task.createdAt ? `Затрачено: ${Math.floor((task.completedAt - task.createdAt) / 3600000) > 0 ? `${Math.floor((task.completedAt - task.createdAt) / 3600000)}ч ` : ''}${Math.max(1, Math.round(((task.completedAt - task.createdAt) % 3600000) / 60000))} мин` : 'Время не записано'}
                                  </span>
                                  <span>
                                    Выполнено в {new Date(task.completedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-12">
                            <div className="w-12 h-12 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-3">
                              <Archive className="w-6 h-6 text-white/20" />
                            </div>
                            <p className="text-white/50 text-sm">
                              Архив пока пуст. Выполняй задания!
                            </p>
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                  )}
                </div>
                
                {/* Backdrop closer */}
                <div 
                  className="fixed inset-0 z-0" 
                  onClick={() => setShowProfileModal(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showSettingsModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex justify-center items-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="w-full max-w-md bg-[#1A1A1A]/90 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/10 shadow-2xl relative z-10"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                      <Settings className="w-5 h-5 text-primary" /> Настройки
                    </h2>
                    <button 
                      onClick={() => setShowSettingsModal(false)}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-white mb-1">Светлая тема</h4>
                        <p className="text-xs text-white/50">Включить более светлый фон сайта</p>
                      </div>
                      <button
                        onClick={() => setIsLightGradient(!isLightGradient)}
                        className={`w-14 h-8 rounded-full flex items-center transition-colors p-1 ${isLightGradient ? 'bg-primary' : 'bg-white/10'}`}
                      >
                        <motion.div
                          animate={{ x: isLightGradient ? 24 : 0 }}
                          className="w-6 h-6 bg-white rounded-full shadow-md"
                        />
                      </button>
                    </div>

                    {onLogout && (
                      <button
                        onClick={() => {
                          setShowSettingsModal(false);
                          onLogout();
                        }}
                        className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium rounded-xl border border-red-500/30 transition-all"
                      >
                        Выйти из аккаунта
                      </button>
                    )}
                  </div>
                </motion.div>
                
                <div 
                  className="fixed inset-0 z-0" 
                  onClick={() => setShowSettingsModal(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 overflow-y-auto overflow-x-hidden"
              >
                <div className="min-h-full w-full flex flex-col items-center px-3 py-4 md:p-8 overflow-x-hidden">
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="bg-[#141414]/90 backdrop-blur-3xl rounded-2xl md:rounded-3xl p-4 md:p-8 border border-white/10 shadow-2xl w-full max-w-2xl relative overflow-hidden shrink-0 my-auto"
                  >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                  <h3 className="text-lg md:text-2xl font-medium mb-3 md:mb-6 text-white/90 relative z-10 text-center">
                    {addMode === 'selection' ? 'Выберите формат ввода' : addMode === 'voice' ? 'Голосовой ввод' : 'Новая задача'}
                  </h3>

                  {addMode === 'selection' ? (
                    <div className="flex flex-col gap-4 relative z-10">
                      <button onClick={() => setAddMode('text')} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left w-full">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-white font-medium text-lg">Текстовый ввод</h4>
                          <p className="text-white/50 text-sm">Заполнить форму вручную</p>
                        </div>
                      </button>
                      <motion.button 
                        whileHover={{ scale: 1.02 }} 
                        whileTap={{ scale: 0.98 }} 
                        onClick={() => { setAddMode('voice'); }} 
                        className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left w-full group relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-[#10b981]/0 via-[#10b981]/10 to-[#10b981]/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-12 h-12 rounded-full bg-[#10b981]/20 flex items-center justify-center text-[#10b981] shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.2)] group-hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all">
                          <Mic className="w-6 h-6 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="relative z-10">
                          <h4 className="text-white font-medium text-lg">Голосовой ввод</h4>
                          <p className="text-white/50 text-sm group-hover:text-white/70 transition-colors">Продиктовать задачу ИИ</p>
                        </div>
                      </motion.button>
                      <div className="relative">
                        <button onClick={() => document.getElementById('imageUploadFormat')?.click()} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left w-full">
                          <div className="w-12 h-12 rounded-full bg-[#f59e0b]/20 flex items-center justify-center text-[#f59e0b] shrink-0">
                            <ImageIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-white font-medium text-lg">По фото</h4>
                            <p className="text-white/50 text-sm">Загрузить фото задания</p>
                          </div>
                        </button>
                        <input
                          type="file"
                          id="imageUploadFormat"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          type="button"
                          onClick={closeAddForm}
                          className="w-full px-6 py-3.5 bg-white/5 text-white/80 font-medium rounded-xl border border-white/10 hover:bg-white/10 transition-all"
                        >
                          Отмена
                        </motion.button>
                      </div>
                    </div>
                  ) : addMode === 'voice' ? (
                    <div className="flex flex-col items-center relative z-10 gap-5 py-2">

                      {/* Шаги прогресса */}
                      <div className="flex items-center gap-2 w-full px-2">
                        {[
                          { key: 'idle', label: 'Запись', num: 1 },
                          { key: 'recording', label: 'Распознавание', num: 2 },
                          { key: 'processing', label: 'Анализ ИИ', num: 3 },
                        ].map((step, i, arr) => {
                          const stepOrder = { idle: 0, recording: 1, processing: 2 };
                          const currentOrder = stepOrder[voiceStep];
                          const isDone = stepOrder[step.key as keyof typeof stepOrder] < currentOrder;
                          const isActive = step.key === voiceStep;
                          return (
                            null
                          );
                        })}
                      </div>

                      {/* Основная зона */}
                      <AnimatePresence mode="wait">
                        {voiceStep === 'idle' && (
                          <motion.div
                            key="idle"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col items-center gap-4 text-center"
                          >
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              type="button"
                              onClick={handleVoiceInput}
                              className="w-24 h-24 rounded-full bg-[#10b981]/15 border-2 border-[#10b981]/40 flex items-center justify-center text-[#10b981] shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:shadow-[0_0_50px_rgba(16,185,129,0.4)] hover:bg-[#10b981]/25 hover:border-[#10b981]/70 transition-all"
                            >
                              <Mic className="w-10 h-10" />
                            </motion.button>
                            <div>
                              <p className="text-white font-medium">Нажмите для записи</p>
                              
                            </div>
                          </motion.div>
                        )}

                        {voiceStep === 'recording' && (
                          <motion.div
                            key="recording"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col items-center gap-4 w-full text-center"
                          >
                            {/* Пульсирующая иконка микрофона */}
                            <div className="relative">
                              <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.1, 0.4] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="absolute inset-0 rounded-full bg-red-500/30"
                              />
                              <motion.div
                                animate={{ scale: [1, 1.35, 1], opacity: [0.2, 0.05, 0.2] }}
                                transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
                                className="absolute inset-0 rounded-full bg-red-500/20"
                              />
                              <div className="w-20 h-20 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 relative z-10">
                                <Mic className="w-9 h-9" />
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-red-400 font-medium">
                              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
                              Запись идёт
                            </div>

                            {/* Живой транскрипт */}
                            <div className="w-full min-h-[70px] max-h-[130px] overflow-y-auto px-4 py-3 bg-black/40 rounded-xl border border-white/10 text-left">
                              {liveTranscript ? (
                                <p className="text-white/90 text-sm leading-relaxed">
                                  {liveTranscript}
                                  <span className="inline-block w-1 h-4 bg-primary ml-0.5 animate-pulse align-middle rounded-sm" />
                                </p>
                              ) : (
                                <p className="text-white/25 text-sm italic">Говорите — слова появятся здесь в реальном времени...</p>
                              )}
                            </div>

                            

                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.97 }}
                              type="button"
                              onClick={() => { if (stopRecordingRef.current) stopRecordingRef.current(); }}
                              className="flex items-center gap-2 px-5 py-2.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 rounded-xl transition-all text-sm font-medium"
                            >
                              <span className="w-2.5 h-2.5 rounded-sm bg-red-400" />
                              Остановить запись
                            </motion.button>
                          </motion.div>
                        )}

                        {voiceStep === 'processing' && (
                          <motion.div
                            key="processing"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col items-center gap-4 text-center"
                          >
                            <div className="w-20 h-20 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.3)]">
                              <Loader2 className="w-9 h-9 text-primary animate-spin" />
                            </div>
                            <div>
                              <p className="text-white font-medium">ИИ анализирует текст</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => setAddMode('selection')}
                        className="w-full px-6 py-3 bg-white/5 text-white/80 font-medium rounded-xl border border-white/10 hover:bg-white/10 transition-all mt-2"
                      >
                        ← Назад
                      </motion.button>
                    </div>
                  ) : (
                  <form onSubmit={handleAddTask} className="space-y-3 md:space-y-5 relative z-10">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-white/60 ml-1">Название задачи</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={newTask.title}
                          onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                          placeholder="Например: Решить задачи по алгебре"
                          required
                          className="w-full min-w-0 px-3 md:px-4 py-3 md:py-3.5 pr-20 md:pr-24 bg-black/40 text-white rounded-xl border border-white/10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-white/20"
                        />
                        {/* Camera upload button */}
                        
                        <input
                          type="file"
                          id="titleImageUpload"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        {/* AI parse button */}
                        
                      </div>
                      {isRecording && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-primary font-medium ml-1 flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          Слушаю... Говорите название задачи
                        </motion.p>
                      )}
                      {isParsing && !isRecording && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-primary font-medium ml-1 flex items-center gap-2"
                        >
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {uploadedImage ? 'Нейросеть анализирует изображение...' : 'Обрабатываю с помощью ИИ...'}
                        </motion.p>
                      )}
                      {uploadedImage && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative mt-3 p-3 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm"
                        >
                          <button
                            type="button"
                            onClick={removeImage}
                            className="absolute -top-2 -right-2 p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full border border-red-500/30 transition-all z-10"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <div className="flex items-center gap-3">
                            <img
                              src={uploadedImage}
                              alt="Загруженное изображение"
                              className="w-16 h-16 object-cover rounded-lg border border-white/10"
                            />
                            <div className="flex-1">
                              <p className="text-sm text-white/80 font-medium">Изображение загружено</p>
                              <p className="text-xs text-white/50 mt-1">Задача будет создана на основе этого изображения</p>
                            </div>
                          </div>
                        </motion.div>
                      )}


                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-white/60 ml-1">Предмет</label>
                        <input
                          type="text"
                          value={newTask.subject}
                          onChange={(e) => setNewTask({ ...newTask, subject: e.target.value })}
                          placeholder="Математика"
                          required
                          className="w-full min-w-0 px-2.5 md:px-4 py-2 md:py-3 bg-black/40 text-white rounded-xl border border-white/10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-white/20"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-white/60 ml-1">Сложность</label>
                        <select
                          value={newTask.difficulty}
                          onChange={(e) => setNewTask({ ...newTask, difficulty: e.target.value as '' | 'Легко' | 'Средне' | 'Сложно' })}
                          required
                          className={`w-full min-w-0 px-2.5 md:px-4 py-2 md:py-3 bg-black/40 rounded-xl border border-white/10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all [color-scheme:dark] ${newTask.difficulty === '' ? 'text-white/20' : 'text-white'}`}
                        >
                          <option value="" disabled>Средне</option>
                          <option value="Легко">Легко</option>
                          <option value="Средне">Средне</option>
                          <option value="Сложно">Сложно</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-white/60 ml-1 truncate">Время</label>
                        <input
                          type="text"
                          value={newTask.duration}
                          onChange={(e) => setNewTask({ ...newTask, duration: e.target.value })}
                          placeholder="30 мин"
                          required
                          className="w-full min-w-0 px-2.5 md:px-4 py-2 md:py-3 bg-black/40 text-white rounded-xl border border-white/10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-white/20"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-white/60 ml-1 truncate">Дедлайн</label>
                        <input
                          type="date"
                          value={newTask.deadline}
                          onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                          required
                          className={`w-full min-w-0 px-2.5 md:px-4 py-2 md:py-3 bg-black/40 rounded-xl border border-white/10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all [color-scheme:dark] ${!newTask.deadline ? 'text-white/20' : 'text-white'}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-white/60 ml-1">Описание</label>
                      <textarea
                        value={newTask.description}
                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                        placeholder="Подробное описание задачи..."
                        rows={4}
                        className="w-full min-w-0 px-3 md:px-4 py-3 md:py-3.5 bg-black/40 text-white rounded-xl border border-white/10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all resize-none placeholder:text-white/20"
                      />
                    </div>

                    

                    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={closeAddForm}
                        className="w-full sm:w-auto px-6 py-3.5 bg-white/5 text-white/80 font-medium rounded-xl border border-white/10 hover:bg-white/10 transition-all"
                      >
                        Отмена
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        className="w-full sm:flex-1 py-3.5 bg-gradient-to-r from-primary to-[#7C3AED] text-white font-medium rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] border border-white/10 transition-all duration-300"
                      >
                        Сохранить задачу
                      </motion.button>
                    </div>
                  </form>
                  )}
                </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

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
              {/* Modal header */}
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
              {/* Modal body */}
              <div className="max-h-[70vh] overflow-y-auto custom-scrollbar p-4">
                <Leaderboard
                  currentUserEmail={userEmail}
                  listOnly
                  onSelectStudent={(entry, rank) => setSelectedStudent({ entry, rank })}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Student Profile Modal ── */}
      <AnimatePresence>
        {selectedStudent && (
          <StudentProfileModal
            entry={selectedStudent.entry}
            rank={selectedStudent.rank}
            currentUserEmail={userEmail}
            onClose={() => setSelectedStudent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
