// v2
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Calendar, Users, FileText, User, Settings, X, Camera, CheckCircle, XCircle, Eye, Mic, Image as ImageIcon, Loader2, Sparkles, Trash2, Trophy, Bell, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseTaskWithAI, transcribeAudio, checkHomeworkWithAI, AIHomeworkCheckResult } from '../utils/ai';
import { apiRequest } from '../utils/api';
import { ClassAssignmentInfo } from './ClassAssignmentInfo';
import { TeacherSubmissionsView } from './TeacherSubmissionsView';
import { Leaderboard } from './Leaderboard';
import { ClassStudentsModal } from './ClassStudentsList';

interface TeacherDashboardProps {
  userName: string;
  userEmail: string;
  isLightGradient: boolean;
  setIsLightGradient: (value: boolean) => void;
  onLogout?: () => void;
}

interface Submission {
  id: number;
  studentName: string;
  studentEmail?: string;
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

export function TeacherDashboard({ userName, userEmail, isLightGradient, setIsLightGradient, onLogout }: TeacherDashboardProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Stable ref: submission IDs that teacher has already approved/rejected locally.
  // A manual refresh will never revert these back to "pending".
  const localResolvedRef = useRef<Map<number, 'approved' | 'rejected'>>(new Map());

  // Stable ref: assignment IDs deleted locally. Polling won't restore them even
  // if kvDel hasn't fully propagated yet.
  const localDeletedAssignmentIdsRef = useRef<Set<number>>(new Set());

  const fetchAssignments = useCallback(async (silent = false) => {
    if (!userEmail) return;
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const data = await apiRequest<Assignment[]>(`/assignments/teacher?email=${encodeURIComponent(userEmail)}`);
      setAssignments(() => {
        return data
          // Filter out any assignments that were deleted locally in this session
          .filter(a => !localDeletedAssignmentIdsRef.current.has(a.id))
          .map(a => ({
            ...a,
            submissions: a.submissions.map(s => {
              // Always prefer the locally-resolved status — KV may still be syncing.
              const local = localResolvedRef.current.get(s.id);
              if (local) return { ...s, status: local };
              return s;
            }),
          }));
      });
      setLastFetched(new Date());
    } catch (err) {
      console.error('Failed to fetch assignments:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userEmail]);

  useEffect(() => {
    fetchAssignments();
    // Silent background polling every 15s — localResolvedRef protects approved/rejected
    // decisions from being overwritten, so this is safe and flicker-free.
    const interval = setInterval(() => fetchAssignments(true), 15000);
    return () => clearInterval(interval);
  }, [fetchAssignments]);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showStudentsList, setShowStudentsList] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<{assignment: Assignment, submission: Submission} | null>(null);
  const [selectedAssignmentDetail, setSelectedAssignmentDetail] = useState<Assignment | null>(null);
  const [aiCheckModal, setAiCheckModal] = useState<{ assignment: Assignment; submission: Submission } | null>(null);
  const [aiCheckResult, setAiCheckResult] = useState<AIHomeworkCheckResult | null>(null);
  const [aiCheckLoading, setAiCheckLoading] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(() => {
    try { return localStorage.getItem('rezoflow_teacher_avatar'); } catch { return null; }
  });
  const [subjects, setSubjects] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`rezoflow_teacher_subjects_${userEmail}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeTab, setActiveTab] = useState<'assignments' | 'check'>('assignments');

  // ── Notifications ──────────────────────────────────────────────
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [seenSubmissionIds, setSeenSubmissionIds] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem(`rezoflow_teacher_seen_subs_${userEmail}`);
      return raw ? new Set<number>(JSON.parse(raw)) : new Set<number>();
    } catch { return new Set<number>(); }
  });
  const notifPanelRef = useRef<HTMLDivElement>(null);

  // Persist seen IDs
  useEffect(() => {
    try {
      localStorage.setItem(
        `rezoflow_teacher_seen_subs_${userEmail}`,
        JSON.stringify(Array.from(seenSubmissionIds))
      );
    } catch {}
  }, [seenSubmissionIds, userEmail]);

  // Collect all pending submissions not yet seen
  const newSubmissions = assignments.flatMap(a =>
    a.submissions
      .filter(s => s.status === 'pending' && !seenSubmissionIds.has(s.id))
      .map(s => ({ submission: s, assignment: a }))
  );

  const markAllSeen = () => {
    const allPendingIds = assignments.flatMap(a =>
      a.submissions.filter(s => s.status === 'pending').map(s => s.id)
    );
    setSeenSubmissionIds(prev => new Set([...prev, ...allPendingIds]));
  };

  // Close panel on outside click
  useEffect(() => {
    if (!showNotifPanel) return;
    const handler = (e: MouseEvent) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifPanel]);
  // ───────────────────────────────────────────────────────────────

  const [isRecording, setIsRecording] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<'selection' | 'text' | 'voice'>('selection');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [voiceStep, setVoiceStep] = useState<'idle' | 'recording' | 'processing'>('idle');
  const speechTranscriptRef = useRef('');
  const stopRecordingRef = useRef<(() => void) | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  const [newAssignment, setNewAssignment] = useState({
    title: '',
    subject: '',
    classes: [] as string[],
    deadline: '',
    description: '',
  });
  const [classDigit, setClassDigit] = useState('');
  const [classLetter, setClassLetter] = useState('');

  useEffect(() => {
    try {
      if (avatar) localStorage.setItem('rezoflow_teacher_avatar', avatar);
      else localStorage.removeItem('rezoflow_teacher_avatar');
    } catch {}
  }, [avatar]);

  useEffect(() => {
    try {
      if (userEmail) {
        localStorage.setItem(`rezoflow_teacher_subjects_${userEmail}`, JSON.stringify(subjects));
      }
    } catch {}
  }, [subjects, userEmail]);



  const handleAICheck = async (assignment: Assignment, submission: Submission) => {
    if (!submission.screenshotUrl) return;
    setAiCheckResult(null);
    setAiCheckModal({ assignment, submission });
    setAiCheckLoading(true);
    try {
      const result = await checkHomeworkWithAI(
        assignment.title,
        assignment.description ?? '',
        submission.screenshotUrl
      );
      setAiCheckResult(result);
    } catch {
      setAiCheckResult({
        isCorrect: false,
        grade: 'Удовлетворительно',
        summary: 'Не удалось проанализировать работу. Попробуйте ещё раз.',
        issues: [],
        suggestions: [],
      });
    } finally {
      setAiCheckLoading(false);
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
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      speechTranscriptRef.current = '';
      setLiveTranscript('');
      setVoiceStep('recording');
      setIsRecording(true);

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
        recognition.onerror = (event: any) => { console.warn('Speech Recognition error:', event.error); };
        try { recognition.start(); } catch (e) { console.warn(e); }
      }

      const processAfterStop = async () => {
        if (speechRecognitionRef.current) {
          try { speechRecognitionRef.current.stop(); } catch (_) {}
          speechRecognitionRef.current = null;
        }
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        await new Promise(resolve => setTimeout(resolve, 400));

        const transcript = speechTranscriptRef.current.trim();
        setVoiceStep('processing');
        setIsParsing(true);

        try {
          let textForAI = transcript;
          if (!textForAI || textForAI.length < 3) {
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

          const parsed = await parseTaskWithAI(textForAI, null);
          setNewAssignment(prev => ({
            ...prev,
            title: parsed.title,
            subject: parsed.subject,
            deadline: parsed.deadline,
            description: parsed.description,
          }));
          setClassDigit('');
          setClassLetter('');
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
        if (mediaRecorder.state !== 'recording') { clearTimeout(maxTimer); audioContext.close(); return; }
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        if (avg > SILENCE_THRESHOLD) { hasSpeech = true; silenceStart = 0; }
        else if (hasSpeech) {
          if (silenceStart === 0) silenceStart = Date.now();
          if (Date.now() - silenceStart > SILENCE_DURATION) { stopRecording(); return; }
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
          const parsed = await parseTaskWithAI('Распознай задание на этом изображении. Определи его суть, установи предмет, сроки и подробное описание.', dataUrl);
          setNewAssignment(prev => ({
            ...prev,
            title: parsed.title,
            subject: parsed.subject,
            deadline: parsed.deadline,
            description: parsed.description,
          }));
          setClassDigit('');
          setClassLetter('');
        } catch (error) {
          console.error(error);
          setNewAssignment(prev => ({ ...prev, title: `Задание из изображения (${file.name})` }));
        } finally {
          setIsParsing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleParseAI = async () => {
    if (!newAssignment.title && !uploadedImage) {
      alert('Введите текст задания, запишите голос или загрузите изображе��ие для распознавания.');
      return;
    }

    setIsParsing(true);
    try {
      const parsed = await parseTaskWithAI(newAssignment.title || "Распознай это задание", uploadedImage);
      setNewAssignment({
        ...newAssignment,
        title: parsed.title,
        subject: parsed.subject,
        classes: [],
        deadline: parsed.deadline,
        description: parsed.description,
      });
      setClassDigit('');
      setClassLetter('');
    } catch (error) {
      console.error(error);
      alert('Ошибка при обращении к нейросети');
    } finally {
      setIsParsing(false);
    }
  };

  const removeImage = () => {
    setUploadedImage(null);
  };

  const closeAddForm = () => {
    setShowAddForm(false);
    setAddMode('selection');
    setVoiceStep('idle');
    setIsRecording(false);
    setIsParsing(false);
    setLiveTranscript('');
    setUploadedImage(null);
    speechTranscriptRef.current = '';
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch (_) {}
      speechRecognitionRef.current = null;
    }
  };

  const handleAddAssignment = (e: React.FormEvent) => {
    e.preventDefault();

    let finalClasses = [...newAssignment.classes];
    if (classDigit && classLetter.trim()) {
      const newClass = `${classDigit}${classLetter.trim()}`;
      if (!finalClasses.includes(newClass)) {
        finalClasses.push(newClass);
      }
    }

    if (finalClasses.length === 0) {
      alert("Пожалуйста, укажите и добавьте хотя бы один класс.");
      return;
    }

    const tempId = Date.now();
    const optimisticAssignment: Assignment = {
      id: tempId,
      title: newAssignment.title,
      subject: newAssignment.subject,
      class: finalClasses,
      deadline: newAssignment.deadline,
      studentsCount: 0,
      description: newAssignment.description,
      submissions: []
    };
    setAssignments(prev => [optimisticAssignment, ...prev]);
    setNewAssignment({ title: '', subject: '', classes: [], deadline: '', description: '' });
    setClassDigit('');
    setClassLetter('');
    setUploadedImage(null);
    setShowAddForm(false);
    setAddMode('selection');

    // Fire-and-forget: the optimistic entry already reflects the UI.
    // We pass tempId as the assignment id so the server persists exactly
    // the same id — no "replace optimistic with real" re-render needed.
    apiRequest('/assignments', {
      method: 'POST',
      body: JSON.stringify({
        id: tempId,
        title: newAssignment.title,
        subject: newAssignment.subject,
        assignedClass: finalClasses,
        deadline: newAssignment.deadline,
        description: newAssignment.description,
        teacherEmail: userEmail,
        teacherName: userName,
      }),
    }).catch((err) => {
      console.error('Failed to create assignment:', err);
      // Roll back optimistic entry if the server rejected it
      setAssignments(prev => prev.filter(a => a.id !== tempId));
      alert('Ошибка при создании задания. Попробуйте снова.');
    });
  };

  const handleDeleteAssignment = async (assignmentId: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить это задание? Оно пропадет у всех учеников.')) {
      return;
    }

    // Mark as deleted immediately — polling will never restore it even if kvDel lags
    localDeletedAssignmentIdsRef.current.add(assignmentId);
    setAssignments(prev => prev.filter(a => a.id !== assignmentId));

    try {
      await apiRequest(`/assignments/${assignmentId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete assignment:', err);
      // Roll back: remove the guard and re-fetch real state
      localDeletedAssignmentIdsRef.current.delete(assignmentId);
      fetchAssignments(true);
      alert('Ошибка пр�� удалении задания.');
    }
  };

  const handleApproveSubmission = async (assignmentId: number, submissionId: number) => {
    // Record locally so refresh never reverts this decision.
    localResolvedRef.current.set(submissionId, 'approved');
    setAssignments(prev => prev.map(assignment => {
      if (assignment.id === assignmentId) {
        return {
          ...assignment,
          submissions: assignment.submissions.map(sub =>
            sub.id === submissionId ? { ...sub, status: 'approved' as const } : sub
          )
        };
      }
      return assignment;
    }));
    setShowCheckModal(false);
    setSelectedSubmission(null);

    try {
      await apiRequest(`/submissions/${submissionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
      });
    } catch (err) {
      console.error('Failed to approve submission:', err);
    }
  };

  const handleRejectSubmission = async (assignmentId: number, submissionId: number) => {
    // Record locally so refresh never reverts this decision.
    localResolvedRef.current.set(submissionId, 'rejected');
    setAssignments(prev => prev.map(assignment => {
      if (assignment.id === assignmentId) {
        return {
          ...assignment,
          submissions: assignment.submissions.map(sub =>
            sub.id === submissionId ? { ...sub, status: 'rejected' as const } : sub
          )
        };
      }
      return assignment;
    }));
    setShowCheckModal(false);
    setSelectedSubmission(null);

    try {
      await apiRequest(`/submissions/${submissionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'rejected' }),
      });
    } catch (err) {
      console.error('Failed to reject submission:', err);
    }
  };

  const pendingSubmissionsCount = assignments.reduce((count, assignment) =>
    count + assignment.submissions.filter(s => s.status === 'pending').length, 0
  );

  return (
    <div className="min-h-screen text-foreground relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="fixed top-[10%] right-[10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[10%] left-[10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 space-y-6 relative z-10">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4"
        >
          {/* ── Left group: Settings + Bell + Trophy ── */}
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSettingsModal(true)}
              className="p-2 md:p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-white/60 hover:text-white"
            >
              <Settings className="w-4 h-4 md:w-5 md:h-5" />
            </motion.button>

            {/* ── Notification bell ── */}
            <div className="relative" ref={notifPanelRef}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setShowNotifPanel(v => !v);
                if (!showNotifPanel) markAllSeen();
              }}
              className="relative p-2 md:p-2.5 bg-white/5 hover:bg-primary/15 rounded-xl border border-white/10 hover:border-primary/30 transition-all"
              title="Уведомления"
            >
              <Bell className="w-4 h-4 md:w-5 md:h-5 text-white/60 hover:text-white" />
              {newSubmissions.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-primary rounded-full flex items-center justify-center text-[9px] text-white shadow-[0_0_8px_rgba(139,92,246,0.7)]">
                  {newSubmissions.length > 9 ? '9+' : newSubmissions.length}
                </span>
              )}
            </motion.button>

            <AnimatePresence>
              {showNotifPanel && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full mt-2 left-0 w-80 bg-[#0f0f1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                    <span className="text-sm text-white/80">Уведомления</span>
                    <button
                      onClick={() => setShowNotifPanel(false)}
                      className="text-white/40 hover:text-white/80 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {(() => {
                    const pendingAll = assignments.flatMap(a =>
                      a.submissions
                        .filter(s => s.status === 'pending')
                        .map(s => ({ submission: s, assignment: a }))
                    ).sort((a, b) => b.submission.submittedAt - a.submission.submittedAt);

                    if (pendingAll.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-10 gap-2 text-white/30">
                          <Bell className="w-8 h-8 opacity-30" />
                          <span className="text-xs">Новых уведомлений нет</span>
                        </div>
                      );
                    }

                    return (
                      <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                        {pendingAll.map(({ submission, assignment }) => {
                          const isNew = !seenSubmissionIds.has(submission.id);
                          const minutesAgo = Math.max(0, Math.floor((Date.now() - submission.submittedAt) / 60000));
                          const timeStr = minutesAgo < 60
                            ? `${minutesAgo} мин назад`
                            : `${Math.floor(minutesAgo / 60)} ч назад`;
                          return (
                            <button
                              key={submission.id}
                              onClick={() => {
                                setShowNotifPanel(false);
                                setActiveTab('check');
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-start gap-3 group"
                            >
                              <div className="mt-0.5 w-8 h-8 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-primary/80" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-white/90 truncate">{submission.studentName}</span>
                                  {isNew && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                  )}
                                </div>
                                <div className="text-[11px] text-white/40 truncate mt-0.5">
                                  сдал «{assignment.title}»
                                </div>
                                <div className="text-[10px] text-white/25 mt-0.5">{timeStr}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <div className="border-t border-white/8 px-4 py-2.5">
                    <button
                      onClick={() => {
                        setShowNotifPanel(false);
                        setActiveTab('check');
                      }}
                      className="w-full text-center text-xs text-primary/70 hover:text-primary transition-colors py-0.5"
                    >
                      Перейти к проверке →
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            </div>{/* end bell wrapper */}

            {/* ── Leaderboard ── */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowLeaderboard(true)}
              className="p-2 md:p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/20 transition-all"
              title="Рейтинг учеников"
            >
              <Trophy className="w-4 h-4 md:w-5 md:h-5 text-white/60" />
            </motion.button>

            {/* ── Students by class ── */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowStudentsList(true)}
              className="p-2 md:p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/20 transition-all"
              title="Ученики по классам"
            >
              <GraduationCap className="w-4 h-4 md:w-5 md:h-5 text-white/60" />
            </motion.button>
          </div>{/* end left group */}

          <div
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2 md:gap-3 bg-white/5 hover:bg-white/10 transition-all cursor-pointer p-1.5 pr-3 md:pr-4 rounded-2xl border border-white/10 backdrop-blur-md shadow-[0_0_20px_rgba(139,92,246,0.1)] hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] shrink-0 group"
          >
            <div className="relative">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl border border-white/10 overflow-hidden bg-black/50 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                {avatar ? (
                  <img src={avatar} alt="Аватар" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 md:w-6 md:h-6 text-white/40" />
                )}
              </div>
            </div>
            <div className="hidden md:block text-left">
              <div className="text-sm font-medium text-white truncate max-w-[120px] group-hover:text-primary transition-colors">{userName || "Учитель"}</div>
              <div className="text-xs text-primary/80 font-medium">Преподаватель</div>
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

              <div className="text-center space-y-3 relative z-10">
                <h1 className="-mt-4 text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-primary to-purple-400 drop-shadow-[0_0_20px_rgba(139,92,246,0.4)] tracking-tight text-center">
                  RezoFlow
                </h1>
              </div>

              <div className="w-full max-w-md relative z-10 pt-4">
                <motion.button
                  whileHover={{ scale: 1.02, translateY: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-primary to-[#7C3AED] text-white text-lg font-semibold rounded-2xl shadow-[0_0_30px_rgba(139,92,246,0.4)] hover:shadow-[0_0_40px_rgba(139,92,246,0.6)] border border-white/10 transition-all duration-300 group overflow-hidden relative"
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-t from-white/0 via-white/20 to-white/0 -translate-y-full group-hover:animate-[shimmer_1.5s_infinite]" />
                  <div className="p-2 bg-white/20 rounded-xl group-hover:rotate-90 transition-transform duration-300 relative z-10">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="relative z-10">Создать задание</span>
                </motion.button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setActiveTab('assignments')}
                className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
                  activeTab === 'assignments'
                    ? 'bg-primary text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                Задания
              </button>
              <button
                onClick={() => setActiveTab('check')}
                className={`px-6 py-2.5 rounded-xl font-medium transition-all relative ${
                  activeTab === 'check'
                    ? 'bg-primary text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                Проверка работ
                {pendingSubmissionsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {pendingSubmissionsCount}
                  </span>
                )}
              </button>
            </div>

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
                    {addMode === 'selection' ? 'Выберите формат ввода' : addMode === 'voice' ? 'Голосовой ввод' : 'Новое задание'}
                  </h3>

                  {/* Selection screen */}
                  {addMode === 'selection' && (
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
                        onClick={() => setAddMode('voice')}
                        className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left w-full group relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-[#10b981]/0 via-[#10b981]/10 to-[#10b981]/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-12 h-12 rounded-full bg-[#10b981]/20 flex items-center justify-center text-[#10b981] shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.2)] group-hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all">
                          <Mic className="w-6 h-6 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="relative z-10">
                          <h4 className="text-white font-medium text-lg">Голосовой ввод</h4>
                          <p className="text-white/50 text-sm group-hover:text-white/70 transition-colors">Продиктовать задание ИИ</p>
                        </div>
                      </motion.button>

                      <div className="relative">
                        <button onClick={() => document.getElementById('teacherImageUploadFormat')?.click()} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left w-full">
                          <div className="w-12 h-12 rounded-full bg-[#f59e0b]/20 flex items-center justify-center text-[#f59e0b] shrink-0">
                            <ImageIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-white font-medium text-lg">По фото</h4>
                            <p className="text-white/50 text-sm">Загрузить фото задания</p>
                          </div>
                        </button>
                        <input type="file" id="teacherImageUploadFormat" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="button" onClick={closeAddForm} className="w-full px-6 py-3.5 bg-white/5 text-white/80 font-medium rounded-xl border border-white/10 hover:bg-white/10 transition-all">
                          Отмена
                        </motion.button>
                      </div>
                    </div>
                  )}

                  {/* Voice screen */}
                  {addMode === 'voice' && (
                    <div className="flex flex-col items-center relative z-10 gap-5 py-2">
                      <AnimatePresence mode="wait">
                        {voiceStep === 'idle' && (
                          <motion.div key="idle" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center gap-4 text-center">
                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="button" onClick={handleVoiceInput} className="w-24 h-24 rounded-full bg-[#10b981]/15 border-2 border-[#10b981]/40 flex items-center justify-center text-[#10b981] shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:shadow-[0_0_50px_rgba(16,185,129,0.4)] hover:bg-[#10b981]/25 hover:border-[#10b981]/70 transition-all">
                              <Mic className="w-10 h-10" />
                            </motion.button>
                            <p className="text-white font-medium">Нажмите для записи</p>
                          </motion.div>
                        )}
                        {voiceStep === 'recording' && (
                          <motion.div key="recording" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center gap-4 w-full text-center">
                            <div className="relative">
                              <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }} className="absolute inset-0 rounded-full bg-red-500/30" />
                              <motion.div animate={{ scale: [1, 1.35, 1], opacity: [0.2, 0.05, 0.2] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="absolute inset-0 rounded-full bg-red-500/20" />
                              <div className="w-20 h-20 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 relative z-10">
                                <Mic className="w-9 h-9" />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-red-400 font-medium">
                              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
                              Запись идёт
                            </div>
                            <div className="w-full min-h-[70px] max-h-[130px] overflow-y-auto px-4 py-3 bg-black/40 rounded-xl border border-white/10 text-left">
                              {liveTranscript
                                ? <p className="text-white/90 text-sm leading-relaxed">{liveTranscript}<span className="inline-block w-1 h-4 bg-primary ml-0.5 animate-pulse align-middle rounded-sm" /></p>
                                : <p className="text-white/25 text-sm italic">Говорите — слова появятся здесь в реальном времени...</p>
                              }
                            </div>
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="button" onClick={() => { if (stopRecordingRef.current) stopRecordingRef.current(); }} className="flex items-center gap-2 px-5 py-2.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 rounded-xl transition-all text-sm font-medium">
                              <span className="w-2.5 h-2.5 rounded-sm bg-red-400" />
                              Остановить запись
                            </motion.button>
                          </motion.div>
                        )}
                        {voiceStep === 'processing' && (
                          <motion.div key="processing" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center gap-4 text-center">
                            <div className="w-20 h-20 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.3)]">
                              <Loader2 className="w-9 h-9 text-primary animate-spin" />
                            </div>
                            <p className="text-white font-medium">ИИ анализирует текст</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="button" onClick={() => { setAddMode('selection'); setVoiceStep('idle'); setLiveTranscript(''); setIsRecording(false); }} className="w-full px-6 py-3 bg-white/5 text-white/80 font-medium rounded-xl border border-white/10 hover:bg-white/10 transition-all mt-2">
                        ← Назад
                      </motion.button>
                    </div>
                  )}

                  {/* Text form */}
                  {addMode === 'text' && (
                  <>
                  <form onSubmit={handleAddAssignment} className="space-y-3 md:space-y-5 relative z-10">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-white/90 ml-1">Название задания</label>
                      <input
                        type="text"
                        value={newAssignment.title}
                        onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                        placeholder="Например: Квадратные уравнения"
                        required
                        className="w-full min-w-0 px-3 md:px-4 py-3 md:py-3.5 bg-black/50 text-white font-normal text-[15px] rounded-xl border border-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-white/50"
                      />
                    </div>

                    {uploadedImage && (
                      <div className="relative">
                        <img src={uploadedImage} alt="Загруженное изображение" className="w-full max-h-48 object-contain rounded-xl border border-white/10" />
                        <button type="button" onClick={removeImage} className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-black rounded-full transition-colors">
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    )}

                    {(newAssignment.title || uploadedImage) && !isParsing && (
                      <button type="button" onClick={handleParseAI} className="w-full py-3 bg-gradient-to-r from-primary/20 to-purple-600/20 text-primary hover:from-primary/30 hover:to-purple-600/30 font-medium rounded-xl border border-primary/30 transition-all flex items-center justify-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Распознать с помощью AI
                      </button>
                    )}

                    {isParsing && (
                      <div className="flex items-center justify-center gap-2 py-3 text-primary">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Обрабатываем задание...</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/90 ml-1">Предмет</label>
                        <input
                          type="text"
                          value={newAssignment.subject}
                          onChange={(e) => setNewAssignment({ ...newAssignment, subject: e.target.value })}
                          placeholder="Математика"
                          required
                          className="w-full min-w-0 px-2.5 md:px-4 py-2 md:py-3 bg-black/50 text-white font-normal text-[15px] rounded-xl border border-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-white/50"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/90 ml-1">Классы</label>
                        <div className="flex gap-2">
                          <select
                            value={classDigit}
                            onChange={(e) => setClassDigit(e.target.value)}
                            className={`w-1/3 min-w-0 px-2.5 md:px-4 py-2 md:py-3 bg-black/50 text-white font-normal text-[15px] rounded-xl border border-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all [color-scheme:dark] ${!classDigit ? 'text-white/50' : 'text-white'}`}
                          >
                            <option value="" disabled>Цифра</option>
                            {Array.from({ length: 11 }, (_, i) => i + 1).map(grade => (
                                <option key={grade} value={grade.toString()}>
                                  {grade}
                                </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={classLetter}
                            onChange={(e) => setClassLetter(e.target.value.toUpperCase())}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (classDigit && classLetter.trim()) {
                                  const newClass = `${classDigit}${classLetter.trim()}`;
                                  if (!newAssignment.classes.includes(newClass)) {
                                    setNewAssignment({ ...newAssignment, classes: [...newAssignment.classes, newClass] });
                                  }
                                  setClassDigit('');
                                  setClassLetter('');
                                }
                              }
                            }}
                            placeholder="Буква"
                            maxLength={2}
                            className="w-1/3 min-w-0 px-2.5 md:px-4 py-2 md:py-3 bg-black/50 text-white font-normal text-[15px] rounded-xl border border-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-white/50"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (classDigit && classLetter.trim()) {
                                const newClass = `${classDigit}${classLetter.trim()}`;
                                if (!newAssignment.classes.includes(newClass)) {
                                  setNewAssignment({ ...newAssignment, classes: [...newAssignment.classes, newClass] });
                                }
                                setClassDigit('');
                                setClassLetter('');
                              }
                            }}
                            className="w-1/3 px-2 py-2 md:py-3 bg-primary/20 hover:bg-primary/30 text-primary font-medium text-[15px] rounded-xl border border-primary/50 transition-all flex items-center justify-center gap-1"
                          >
                            <Plus className="w-4 h-4" /> Добавить
                          </button>
                        </div>
                        {newAssignment.classes.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {newAssignment.classes.map(c => (
                              <span key={c} className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 px-3 py-1.5 rounded-lg text-sm text-white">
                                {c}
                                <button
                                  type="button"
                                  onClick={() => setNewAssignment({ ...newAssignment, classes: newAssignment.classes.filter(cls => cls !== c) })}
                                  className="text-white/50 hover:text-white/90 transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-white/90 ml-1">Срок сдачи</label>
                      <input
                        type="date"
                        value={newAssignment.deadline}
                        onChange={(e) => setNewAssignment({ ...newAssignment, deadline: e.target.value })}
                        required
                        className="w-full min-w-0 px-2.5 md:px-4 py-2 md:py-3 bg-black/50 text-white font-normal text-[15px] rounded-xl border border-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all [color-scheme:dark]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-white/90 ml-1">Описание</label>
                      <textarea
                        value={newAssignment.description}
                        onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                        placeholder="Подробное описание задания..."
                        rows={4}
                        className="w-full min-w-0 px-3 md:px-4 py-3 md:py-3.5 bg-black/50 text-white font-normal text-[15px] rounded-xl border border-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all resize-none placeholder:text-white/50"
                      />
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => setAddMode('selection')}
                        className="w-full sm:w-auto px-6 py-3.5 bg-white/5 text-white/80 font-medium rounded-xl border border-white/10 hover:bg-white/10 transition-all"
                      >
                        ← Назад
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        className="w-full sm:flex-1 py-3.5 bg-gradient-to-r from-primary to-[#7C3AED] text-white font-medium rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] border border-white/10 transition-all duration-300"
                      >
                        Создать задание
                      </motion.button>
                    </div>
                  </form>
                  </>
                  )}
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showProfileModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 overflow-y-auto overflow-x-hidden flex justify-center items-start pt-10 pb-10"
            >
              <div className="w-full max-w-2xl px-4 md:px-6 flex flex-col gap-6 relative z-10">
                <div className="flex justify-between items-center bg-[#1A1A1A]/90 p-4 rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl">
                  <h2 className="text-xl font-semibold text-white ml-4">Профиль учителя</h2>
                  <button
                    onClick={() => setShowProfileModal(false)}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

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
                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{userName || "Учитель"}</h2>
                        <p className="text-white/50">Преподаватель</p>
                      </div>
                      <p className="text-white/60">Всего заданий: {assignments.length}</p>

                      <div className="mt-4 border-t border-white/10 pt-4">
                        <h3 className="text-lg font-medium text-white/90 mb-3">Мои предметы</h3>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {subjects.map((sub, idx) => (
                            <span key={idx} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm">
                              {sub}
                              <button onClick={async () => {
                                const newSubjects = subjects.filter(s => s !== sub);
                                setSubjects(newSubjects);
                                try {
                                  await apiRequest('/teacher/subjects', {
                                    method: 'POST',
                                    body: JSON.stringify({ subjects: newSubjects }),
                                  });
                                } catch {}
                              }} className="hover:text-red-400 transition-colors ml-1">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ))}
                          {subjects.length === 0 && <p className="text-white/40 text-sm">Предметы не добавлены</p>}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            id="newSubjectInput"
                            type="text" 
                            placeholder="Добавить предмет..." 
                            className="bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white flex-1 focus:outline-none focus:border-primary/50"
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                const val = e.currentTarget.value.trim();
                                if (val && !subjects.includes(val)) {
                                  const newSubjects = [...subjects, val];
                                  setSubjects(newSubjects);
                                  e.currentTarget.value = '';
                                  try {
                                    await apiRequest('/teacher/subjects', {
                                      method: 'POST',
                                      body: JSON.stringify({ subjects: newSubjects }),
                                    });
                                  } catch {}
                                }
                              }
                            }}
                          />
                          <button 
                            onClick={async () => {
                              const input = document.getElementById('newSubjectInput') as HTMLInputElement;
                              const val = input.value.trim();
                              if (val && !subjects.includes(val)) {
                                const newSubjects = [...subjects, val];
                                setSubjects(newSubjects);
                                input.value = '';
                                try {
                                  await apiRequest('/teacher/subjects', {
                                    method: 'POST',
                                    body: JSON.stringify({ subjects: newSubjects }),
                                  });
                                } catch {}
                              }
                            }}
                            className="px-4 py-2 bg-primary/20 text-primary rounded-xl text-sm font-medium hover:bg-primary/30 transition-colors shrink-0"
                          >
                            Добавить
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSettingsModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 overflow-y-auto overflow-x-hidden flex justify-center items-start pt-10 pb-10"
            >
              <div className="w-full max-w-xl px-4 md:px-6 flex flex-col gap-6 relative z-10">
                <div className="flex justify-between items-center bg-[#1A1A1A]/90 p-4 rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl">
                  <h2 className="text-xl font-semibold text-white ml-4">Настройки</h2>
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="bg-[#1A1A1A]/90 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/5 shadow-2xl space-y-6">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div>
                      <h3 className="text-white font-medium">Градиентный фон</h3>
                      <p className="text-white/50 text-sm mt-1">Красивый фиолетовый градиент</p>
                    </div>
                    <button
                      onClick={() => setIsLightGradient(!isLightGradient)}
                      className={`relative w-14 h-7 rounded-full transition-colors ${
                        isLightGradient ? 'bg-primary' : 'bg-white/20'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform ${
                          isLightGradient ? 'translate-x-7' : 'translate-x-0'
                        }`}
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showCheckModal && selectedSubmission && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 overflow-y-auto overflow-x-hidden flex justify-center items-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#141414]/95 backdrop-blur-3xl rounded-3xl p-6 md:p-8 border border-white/10 shadow-2xl w-full max-w-4xl relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-2xl font-medium text-white/90">{selectedSubmission.assignment.title}</h3>
                      <p className="text-white/60 mt-1">{selectedSubmission.submission.studentName}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowCheckModal(false);
                        setSelectedSubmission(null);
                      }}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {selectedSubmission.submission.screenshotUrl && (
                    <div className="mb-6 rounded-2xl overflow-hidden border border-white/10 bg-black/30">
                      <img
                        src={selectedSubmission.submission.screenshotUrl}
                        alt="Работа ученика"
                        className="w-full h-auto"
                      />
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Meta info */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-white/40 text-xs mb-1">Ученик</p>
                        <p className="text-white font-semibold text-sm">{selectedSubmission.submission.studentName}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-white/40 text-xs mb-1">Сдано</p>
                        <p className="text-white font-semibold text-sm">
                          {new Date(selectedSubmission.submission.submittedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {selectedSubmission.assignment.description && (
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-white/40 text-xs mb-1.5">Условие задания</p>
                        <p className="text-white/80 text-sm leading-relaxed">{selectedSubmission.assignment.description}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-2xl border border-primary/20">
                      <div className="w-11 h-11 bg-primary/20 rounded-xl flex items-center justify-center shrink-0">
                        <span className="text-lg font-bold text-primary">+{selectedSubmission.submission.xp}</span>
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">XP за принятие работы</p>
                        <p className="text-white/50 text-xs">Будет начислено ученику сразу после нажатия «Принять»</p>
                      </div>
                    </div>

                    {/* Action buttons — only for pending */}
                    {selectedSubmission.submission.status === 'pending' && (
                      <div className="flex gap-3 pt-1">
                        <button
                          onClick={() => handleRejectSubmission(selectedSubmission.assignment.id, selectedSubmission.submission.id)}
                          className="flex-1 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold rounded-xl border border-red-500/30 transition-all flex items-center justify-center gap-2"
                        >
                          <XCircle className="w-5 h-5" />
                          На доработку
                        </button>
                        <button
                          onClick={() => handleApproveSubmission(selectedSubmission.assignment.id, selectedSubmission.submission.id)}
                          className="flex-1 py-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold rounded-xl border border-emerald-500/30 transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="w-5 h-5" />
                          Принять работу
                        </button>
                      </div>
                    )}

                    {/* Status badge for already-reviewed */}
                    {selectedSubmission.submission.status !== 'pending' && (
                      <div className={`flex items-center justify-center gap-2 py-3 rounded-xl border ${
                        selectedSubmission.submission.status === 'approved'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/10 border-red-500/20 text-red-400'
                      }`}>
                        {selectedSubmission.submission.status === 'approved'
                          ? <><CheckCircle className="w-4 h-4" /> Работа принята</>
                          : <><XCircle className="w-4 h-4" /> Работа отклонена</>
                        }
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

            {activeTab === 'assignments' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <AnimatePresence mode="popLayout">
                  {isLoading ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="col-span-full flex justify-center items-center py-20"
                    >
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <span className="ml-3 text-white/50">Загрузка заданий...</span>
                    </motion.div>
                  ) : assignments.length > 0 ? (
                    assignments.map((assignment, idx) => (
                      <motion.div
                        key={assignment.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.3, delay: idx * 0.05 }}
                        className="relative bg-[#1A1A1A]/80 backdrop-blur-xl rounded-2xl p-6 border border-white/5 hover:border-primary/40 hover:shadow-[0_8px_30px_rgba(139,92,246,0.15)] transition-all duration-300 group overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <button
                          onClick={() => setSelectedAssignmentDetail(assignment)}
                          className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5 group-hover:ring-primary/20 transition-all duration-500 cursor-pointer z-0 focus:outline-none"
                          aria-label="Открыть подробности задания"
                        >
                          <span className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-2.5 py-1 bg-primary/20 border border-primary/30 rounded-lg text-[10px] font-semibold text-primary/90 flex items-center gap-1 pointer-events-none">
                            <Eye className="w-3 h-3" />
                            Подробнее
                          </span>
                        </button>

                        <div className="relative z-10 space-y-4">
                          <div className="flex justify-between items-start relative">
                            <div className="pr-12">
                              <h3 className="text-lg font-medium text-white/90 group-hover:text-primary transition-colors leading-snug">
                                {assignment.title}
                              </h3>
                              <p className="text-white/50 text-sm mt-1 font-medium">{assignment.subject}</p>
                            </div>
                            <div className="flex items-center justify-center w-10 h-10 bg-white/5 rounded-lg border border-white/10 text-primary group-hover:opacity-0 transition-opacity absolute top-0 right-0">
                              <FileText className="w-5 h-5 opacity-80" />
                            </div>
                            <button 
                              onClick={() => handleDeleteAssignment(assignment.id)}
                              className="flex items-center justify-center w-10 h-10 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 transition-all opacity-0 group-hover:opacity-100 absolute top-0 right-0 z-20"
                              title="Удалить задание"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-4 pt-2">
                            <span className="px-3 py-1.5 bg-white/5 rounded-lg text-xs font-medium text-white/80 border border-white/10 flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 opacity-60" />
                              {Array.isArray(assignment.class) ? assignment.class.join(', ') : assignment.class}
                            </span>
                            <span className="px-3 py-1.5 bg-white/5 rounded-lg text-xs font-medium text-white/80 border border-white/10 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 opacity-60" />
                              {assignment.deadline}
                            </span>
                          </div>

                          <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                            <span className="text-xs font-medium text-white/40 group-hover:text-white/60 transition-colors">
                              {assignment.submissions.filter(s => s.status === 'pending').length > 0
                                ? `${assignment.submissions.filter(s => s.status === 'pending').length} на проверке`
                                : assignment.studentsCount > 0 ? `${assignment.studentsCount} учеников` : 'Не назначено'}
                            </span>
                            {assignment.submissions.filter(s => s.status === 'pending').length > 0 && (
                              <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-full border border-red-500/30">
                                {assignment.submissions.filter(s => s.status === 'pending').length}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="col-span-full text-center py-20 px-6 rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-md"
                    >
                      <div className="w-16 h-16 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-4">
                        <FileText className="w-8 h-8 text-white/20" />
                      </div>
                      <p className="text-white/50 text-lg mb-4">
                        У вас пока нет заданий. Создайте первое!
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
                </div>

              </div>
            ) : (
              <div className="space-y-6">
                {/* ── Pending submissions ── */}
                {pendingSubmissionsCount > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <motion.span
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1.4, repeat: Infinity }}
                          className="w-2 h-2 rounded-full bg-amber-400"
                        />
                        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide">
                          Ожидают проверки — {pendingSubmissionsCount}
                        </h3>
                      </div>
                      <button
                        onClick={() => fetchAssignments(true)}
                        disabled={isRefreshing}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/50 hover:text-white/80 text-xs font-medium transition-all disabled:opacity-50"
                        title="Обновить список работ"
                      >
                        <motion.span
                          animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
                          transition={isRefreshing ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : {}}
                          className="inline-block"
                        >
                          ↻
                        </motion.span>
                        {isRefreshing ? 'Обновление…' : lastFetched ? `Обновлено в ${lastFetched.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : 'Обновить'}
                      </button>
                    </div>
                    <AnimatePresence mode="popLayout">
                      {assignments.flatMap(assignment =>
                        assignment.submissions
                          .filter(s => s.status === 'pending')
                          .sort((a, b) => a.submittedAt - b.submittedAt)
                          .map(submission => (
                            <motion.div
                              key={`${assignment.id}-${submission.id}`}
                              layout
                              initial={{ opacity: 0, y: 16 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.96, y: -8 }}
                              transition={{ duration: 0.25 }}
                              className="bg-[#1A1A1A]/90 backdrop-blur-xl rounded-2xl border border-amber-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.3)] overflow-hidden"
                            >
                              {/* Card header */}
                              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                                <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                                  <User className="w-4 h-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white font-semibold text-sm">{submission.studentName}</p>
                                  <p className="text-white/40 text-xs truncate">
                                    {assignment.title} · {assignment.subject}
                                    {' · '}
                                    {Array.isArray(assignment.class) ? assignment.class.join(', ') : assignment.class}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-white/30 text-xs">
                                    {new Date(submission.submittedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                  <span className="text-xs font-semibold text-primary">+{submission.xp} XP</span>
                                </div>
                              </div>

                              {/* Screenshot (if any) */}
                              {submission.screenshotUrl && (
                                <div
                                  className="relative bg-black/40 cursor-zoom-in group/img"
                                  onClick={() => { setSelectedSubmission({ assignment, submission }); setShowCheckModal(true); }}
                                >
                                  <img
                                    src={submission.screenshotUrl}
                                    alt="Работа ученика"
                                    className="w-full max-h-64 object-contain group-hover/img:opacity-90 transition-opacity"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover/img:opacity-100 transition-opacity">
                                    <div className="px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-xl text-white text-xs flex items-center gap-1.5 pointer-events-none">
                                      <Eye className="w-3.5 h-3.5" />
                                      Увеличить
                                    </div>
                                    <button
                                      onClick={e => { e.stopPropagation(); handleAICheck(assignment, submission); }}
                                      className="px-3 py-1.5 bg-violet-600/85 backdrop-blur-sm rounded-xl text-white text-xs flex items-center gap-1.5 hover:bg-violet-500/90 transition-colors border border-violet-400/30 pointer-events-auto shadow-[0_0_12px_rgba(139,92,246,0.4)]"
                                    >
                                      <Sparkles className="w-3.5 h-3.5" />
                                      ИИ-проверка
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* No screenshot placeholder */}
                              {!submission.screenshotUrl && (
                                <div className="px-5 py-3 bg-white/[0.02] text-center">
                                  <p className="text-white/25 text-xs italic">Ученик не прикрепил скриншот</p>
                                </div>
                              )}

                              {/* Action buttons */}
                              <div className="flex gap-0 border-t border-white/5">
                                <button
                                  onClick={() => handleRejectSubmission(assignment.id, submission.id)}
                                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-red-500/5 hover:bg-red-500/15 text-red-400 hover:text-red-300 font-semibold text-sm transition-all border-r border-white/5 group/btn"
                                >
                                  <XCircle className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                                  На доработку
                                </button>
                                <button
                                  onClick={() => handleApproveSubmission(assignment.id, submission.id)}
                                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-400 hover:text-emerald-300 font-semibold text-sm transition-all group/btn"
                                >
                                  <CheckCircle className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                                  Принять (+{submission.xp} XP)
                                </button>
                              </div>
                            </motion.div>
                          ))
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Empty pending state */}
                {pendingSubmissionsCount === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <CheckCircle className="w-7 h-7 text-emerald-400" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-white/60 text-sm font-medium">Нет работ на проверке</p>
                      <p className="text-white/30 text-xs">
                        {lastFetched
                          ? `Обновлено в ${lastFetched.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
                          : 'Новые работы не подгружаются автоматически'}
                      </p>
                    </div>
                    <button
                      onClick={() => fetchAssignments(true)}
                      disabled={isRefreshing}
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-white/50 hover:text-white/80 text-sm font-medium transition-all disabled:opacity-50"
                    >
                      <motion.span
                        animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
                        transition={isRefreshing ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : {}}
                        className="inline-block text-base leading-none"
                      >
                        ↻
                      </motion.span>
                      {isRefreshing ? 'Проверяем…' : 'Проверить новые работы'}
                    </button>
                  </div>
                )}

                {/* ── History: reviewed submissions ── */}
                {assignments.some(a => a.submissions.some(s => s.status !== 'pending')) && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-white/5" />
                      <span className="text-xs text-white/30 font-medium px-2">История проверок</span>
                      <div className="flex-1 h-px bg-white/5" />
                    </div>
                    <TeacherSubmissionsView
                      assignments={assignments}
                      onViewSubmission={(assignment, submission) => {
                        setSelectedSubmission({ assignment, submission });
                        setShowCheckModal(true);
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </motion.div>

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
                <Leaderboard listOnly />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStudentsList && (
          <ClassStudentsModal onClose={() => setShowStudentsList(false)} />
        )}
      </AnimatePresence>

      {/* ── Assignment Detail Modal ── */}
      <AnimatePresence>
        {selectedAssignmentDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-md z-[75] flex items-center justify-center p-4"
            onClick={() => setSelectedAssignmentDetail(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full max-w-lg bg-[#141414] rounded-3xl border border-primary/20 shadow-[0_0_80px_rgba(139,92,246,0.2)] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-primary/5">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-primary/20 rounded-xl border border-primary/25">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white leading-snug">{selectedAssignmentDetail.title}</h2>
                    <p className="text-white/40 text-xs">{selectedAssignmentDetail.subject}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAssignmentDetail(null)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white/50 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
                {/* Meta info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8">
                    <p className="text-white/35 text-[10px] font-semibold uppercase tracking-wide mb-1">Класс</p>
                    <p className="text-white/85 text-sm font-medium">
                      {Array.isArray(selectedAssignmentDetail.class)
                        ? selectedAssignmentDetail.class.join(', ')
                        : selectedAssignmentDetail.class}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8">
                    <p className="text-white/35 text-[10px] font-semibold uppercase tracking-wide mb-1">Дедлайн</p>
                    <p className="text-white/85 text-sm font-medium flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary/70" />
                      {selectedAssignmentDetail.deadline}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8">
                    <p className="text-white/35 text-[10px] font-semibold uppercase tracking-wide mb-1">Учеников</p>
                    <p className="text-white/85 text-sm font-medium flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary/70" />
                      {selectedAssignmentDetail.studentsCount > 0 ? selectedAssignmentDetail.studentsCount : '—'}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8">
                    <p className="text-white/35 text-[10px] font-semibold uppercase tracking-wide mb-1">На проверке</p>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {(() => {
                        const pending = selectedAssignmentDetail.submissions.filter(s => s.status === 'pending').length;
                        return pending > 0
                          ? <><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /><span className="text-amber-400">{pending} работ</span></>
                          : <><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /><span className="text-emerald-400">Все проверены</span></>;
                      })()}
                    </p>
                  </div>
                </div>

                {/* Description */}
                {selectedAssignmentDetail.description ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-primary/80 uppercase tracking-wide px-0.5">Описание задания</p>
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8">
                      <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">
                        {selectedAssignmentDetail.description}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 text-center">
                    <p className="text-white/30 text-sm italic">Описание не указано</p>
                  </div>
                )}

                {/* Submissions summary */}
                {selectedAssignmentDetail.submissions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wide px-0.5">Сдавшие ученики</p>
                    <div className="space-y-1.5">
                      {selectedAssignmentDetail.submissions.map(sub => (
                        <div key={sub.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.025] border border-white/6">
                          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <span className="flex-1 text-white/80 text-sm font-medium">{sub.studentName}</span>
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            sub.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : sub.status === 'rejected'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {sub.status === 'approved' ? 'Принято' : sub.status === 'rejected' ? 'Отклонено' : 'Ожидание'}
                          </span>
                          <span className="text-primary/70 text-xs font-semibold">+{sub.xp} XP</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/5 flex justify-end">
                <button
                  onClick={() => setSelectedAssignmentDetail(null)}
                  className="px-5 py-2.5 bg-primary/15 hover:bg-primary/25 text-primary rounded-xl border border-primary/25 text-sm font-semibold transition-all"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Homework Check Modal ── */}
      <AnimatePresence>
        {aiCheckModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-md z-[80] flex items-center justify-center p-4"
            onClick={() => { setAiCheckModal(null); setAiCheckResult(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full max-w-lg bg-[#141414] rounded-3xl border border-violet-500/20 shadow-[0_0_80px_rgba(139,92,246,0.2)] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-violet-500/5">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-violet-500/20 rounded-xl border border-violet-500/25">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">ИИ-проверка работы</h2>
                    <p className="text-white/40 text-xs truncate max-w-[260px]">{aiCheckModal.assignment.title} · {aiCheckModal.submission.studentName}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setAiCheckModal(null); setAiCheckResult(null); }}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white/50 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Preview image */}
              {aiCheckModal.submission.screenshotUrl && (
                <div className="px-6 pt-4">
                  <img
                    src={aiCheckModal.submission.screenshotUrl}
                    alt="Работа ученика"
                    className="w-full max-h-48 object-contain rounded-2xl border border-white/8 bg-black/30"
                  />
                </div>
              )}

              {/* Body */}
              <div className="px-6 py-5 space-y-4 max-h-[50vh] overflow-y-auto">
                {aiCheckLoading && (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                      className="w-10 h-10 rounded-full border-2 border-violet-500/30 border-t-violet-400"
                    />
                    <p className="text-white/50 text-sm">Нейросеть анализирует работу…</p>
                  </div>
                )}

                {!aiCheckLoading && aiCheckResult && (() => {
                  const gradeColors: Record<string, string> = {
                    'Отлично':          'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
                    'Хорошо':           'bg-blue-500/15 text-blue-400 border-blue-500/25',
                    'Удовлетворительно':'bg-amber-500/15 text-amber-400 border-amber-500/25',
                    'Неверно':          'bg-red-500/15 text-red-400 border-red-500/25',
                  };
                  const gradeColor = gradeColors[aiCheckResult.grade] ?? gradeColors['Удовлетворительно'];
                  return (
                    <div className="space-y-4">
                      {/* Grade badge */}
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1.5 rounded-xl text-sm font-bold border ${gradeColor}`}>
                          {aiCheckResult.grade}
                        </span>
                        <span className={`text-sm font-medium ${aiCheckResult.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                          {aiCheckResult.isCorrect ? '✓ Верно выполнено' : '✗ Есть ошибки'}
                        </span>
                      </div>

                      {/* Summary */}
                      <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8">
                        <p className="text-white/75 text-sm leading-relaxed">{aiCheckResult.summary}</p>
                      </div>

                      {/* Issues */}
                      {aiCheckResult.issues.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-red-400 uppercase tracking-wide px-0.5">Ошибки и недочёты</p>
                          <div className="space-y-1.5">
                            {aiCheckResult.issues.map((issue, i) => (
                              <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/[0.06] border border-red-500/15">
                                <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                                <p className="text-white/70 text-xs leading-relaxed">{issue}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggestions */}
                      {aiCheckResult.suggestions.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-violet-400 uppercase tracking-wide px-0.5">Рекомендации</p>
                          <div className="space-y-1.5">
                            {aiCheckResult.suggestions.map((s, i) => (
                              <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-violet-500/[0.06] border border-violet-500/15">
                                <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                                <p className="text-white/70 text-xs leading-relaxed">{s}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Footer actions */}
              {!aiCheckLoading && aiCheckResult && (
                <div className="flex gap-0 border-t border-white/5">
                  <button
                    onClick={() => { setAiCheckModal(null); setAiCheckResult(null); }}
                    className="flex-1 py-3.5 text-white/50 hover:text-white/80 text-sm font-medium transition-colors border-r border-white/5"
                  >
                    Закрыть
                  </button>
                  <button
                    onClick={() => {
                      handleAICheck(aiCheckModal.assignment, aiCheckModal.submission);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Проверить снова
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}