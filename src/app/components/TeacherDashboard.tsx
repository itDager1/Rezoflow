// v2
import { useState } from 'react';
import { GraduationCap, Plus, Calendar, Users, BookOpen, Clock, FileText, User, Settings, X, Camera, CheckCircle, XCircle, Eye, Mic, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseTaskWithAI } from '../utils/ai';

interface TeacherDashboardProps {
  userName: string;
  isLightGradient: boolean;
  setIsLightGradient: (value: boolean) => void;
  isSnowEnabled: boolean;
  setIsSnowEnabled: (value: boolean) => void;
}

interface Submission {
  id: number;
  studentName: string;
  screenshot?: string;
  submittedAt: number;
  status: 'pending' | 'approved' | 'rejected';
  xp: number;
}

interface Assignment {
  id: number;
  title: string;
  subject: string;
  class: string;
  deadline: string;
  studentsCount: number;
  description?: string;
  submissions: Submission[];
}

export function TeacherDashboard({ userName, isLightGradient, setIsLightGradient, isSnowEnabled, setIsSnowEnabled }: TeacherDashboardProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<{assignment: Assignment, submission: Submission} | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'assignments' | 'check'>('assignments');

  const [isRecording, setIsRecording] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const [newAssignment, setNewAssignment] = useState({
    title: '',
    subject: '',
    class: '',
    deadline: '',
    description: '',
  });

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

      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Голосовой ввод не поддерживается в вашем браузере');
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'ru-RU';
      recognition.continuous = false;
      recognition.interimResults = true;

      let finalTranscript = '';

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            currentTranscript += event.results[i][0].transcript;
          }
        }
        setNewAssignment(prev => ({ ...prev, title: finalTranscript + currentTranscript }));
      };

      recognition.onerror = (event: any) => {
        console.error('Ошибка распознавания речи:', event.error);
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
        if (event.error !== 'no-speech') {
          alert('Ошибка микрофона. Убедитесь, что он подключен и работает.');
        }
      };

      recognition.onend = async () => {
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());

        if (finalTranscript.trim()) {
          setIsParsing(true);
          try {
            const parsed = await parseTaskWithAI(finalTranscript, null);
            setNewAssignment(prev => ({
              ...prev,
              title: parsed.title,
              subject: parsed.subject,
              class: '',
              deadline: parsed.deadline,
              description: parsed.description,
            }));
          } catch (error) {
            console.error('Ошибка при обработке голосового ввода через AI:', error);
            alert('Не удалось обработать голосовой ввод. Попробуйте еще раз.');
            setNewAssignment(prev => ({ ...prev, title: finalTranscript }));
          } finally {
            setIsParsing(false);
          }
        }
      };

      recognition.start();
    } catch (err) {
      console.error('Ошибка доступа к микрофону:', err);
      alert('Не удалось получить доступ к микрофону. Разрешите браузеру использовать микрофон в настройках сайта.');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
        setNewAssignment({ ...newAssignment, title: `Задание из изображения (${file.name})` });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleParseAI = async () => {
    if (!newAssignment.title && !uploadedImage) {
      alert('Введите текст задания, запишите голос или загрузите изображение для распознавания.');
      return;
    }

    setIsParsing(true);
    try {
      const parsed = await parseTaskWithAI(newAssignment.title || "Распознай это задание", uploadedImage);
      setNewAssignment({
        ...newAssignment,
        title: parsed.title,
        subject: parsed.subject,
        class: '',
        deadline: parsed.deadline,
        description: parsed.description,
      });
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

  const handleAddAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    const assignment: Assignment = {
      id: Date.now(),
      title: newAssignment.title,
      subject: newAssignment.subject,
      class: newAssignment.class,
      deadline: newAssignment.deadline,
      studentsCount: 0,
      description: newAssignment.description,
      submissions: []
    };
    setAssignments([...assignments, assignment]);
    setNewAssignment({ title: '', subject: '', class: '', deadline: '', description: '' });
    setUploadedImage(null);
    setShowAddForm(false);
  };

  const handleApproveSubmission = (assignmentId: number, submissionId: number) => {
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
  };

  const handleRejectSubmission = (assignmentId: number, submissionId: number) => {
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
          className="flex items-center justify-between gap-4 px-3 md:px-6 py-3 md:py-4"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSettingsModal(true)}
            className="p-2 md:p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-white/60 hover:text-white"
          >
            <Settings className="w-4 h-4 md:w-5 md:h-5" />
          </motion.button>

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
                  <h3 className="text-lg md:text-2xl font-medium mb-3 md:mb-6 text-white/90 relative z-10">Новое задание</h3>

                  <form onSubmit={handleAddAssignment} className="space-y-3 md:space-y-5 relative z-10">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-white/90 ml-1">Название задания</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newAssignment.title}
                          onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                          placeholder="Например: Квадратные уравнения"
                          required
                          className="flex-1 min-w-0 px-3 md:px-4 py-3 md:py-3.5 bg-black/50 text-white font-normal text-[15px] rounded-xl border border-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-white/50"
                        />
                        <button
                          type="button"
                          onClick={handleVoiceInput}
                          disabled={isRecording || isParsing}
                          className={`p-3 md:py-3.5 md:px-4 rounded-xl border transition-all ${
                            isRecording
                              ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse'
                              : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                          } disabled:opacity-50`}
                        >
                          <Mic className="w-5 h-5" />
                        </button>
                        <label className="p-3 md:py-3.5 md:px-4 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 rounded-xl transition-all cursor-pointer">
                          <ImageIcon className="w-5 h-5" />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {uploadedImage && (
                      <div className="relative">
                        <img src={uploadedImage} alt="Загруженное изображение" className="w-full max-h-48 object-contain rounded-xl border border-white/10" />
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-black rounded-full transition-colors"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    )}

                    {(newAssignment.title || uploadedImage) && !isParsing && (
                      <button
                        type="button"
                        onClick={handleParseAI}
                        className="w-full py-3 bg-gradient-to-r from-primary/20 to-purple-600/20 text-primary hover:from-primary/30 hover:to-purple-600/30 font-medium rounded-xl border border-primary/30 transition-all flex items-center justify-center gap-2"
                      >
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
                        <label className="text-xs font-semibold text-white/90 ml-1">Класс</label>
                        <input
                          type="text"
                          value={newAssignment.class}
                          onChange={(e) => setNewAssignment({ ...newAssignment, class: e.target.value })}
                          placeholder="8А"
                          required
                          className="w-full min-w-0 px-2.5 md:px-4 py-2 md:py-3 bg-black/50 text-white font-normal text-[15px] rounded-xl border border-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-white/50"
                        />
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
                        onClick={() => {
                          setShowAddForm(false);
                          setUploadedImage(null);
                        }}
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
                        Создать задание
                      </motion.button>
                    </div>
                  </form>
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

                  {selectedSubmission.submission.screenshot && (
                    <div className="mb-6 rounded-2xl overflow-hidden border border-white/10 bg-black/30">
                      <img
                        src={selectedSubmission.submission.screenshot}
                        alt="Работа ученика"
                        className="w-full h-auto"
                      />
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-white/60 text-sm mb-2">Информация о задании</p>
                      <p className="text-white font-medium">{selectedSubmission.assignment.description || 'Нет описания'}</p>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-2xl border border-primary/20">
                      <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                        <span className="text-2xl font-bold text-primary">+{selectedSubmission.submission.xp}</span>
                      </div>
                      <div>
                        <p className="text-white font-medium">Награда за правильное решение</p>
                        <p className="text-white/60 text-sm">Очки опыта будут начислены ученику</p>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => handleRejectSubmission(selectedSubmission.assignment.id, selectedSubmission.submission.id)}
                        className="flex-1 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium rounded-xl border border-red-500/30 transition-all flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-5 h-5" />
                        Отклонить работу
                      </button>
                      <button
                        onClick={() => handleApproveSubmission(selectedSubmission.assignment.id, selectedSubmission.submission.id)}
                        className="flex-1 py-3.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 font-medium rounded-xl border border-green-500/30 transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Принять работу (+{selectedSubmission.submission.xp} XP)
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

            {activeTab === 'assignments' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <AnimatePresence mode="popLayout">
                  {assignments.length > 0 ? (
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
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {pendingSubmissionsCount > 0 ? (
                    assignments.flatMap(assignment =>
                      assignment.submissions
                        .filter(s => s.status === 'pending')
                        .map(submission => (
                          <motion.div
                            key={`${assignment.id}-${submission.id}`}
                            layout
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="relative bg-[#1A1A1A]/80 backdrop-blur-xl rounded-2xl p-6 border border-white/5 hover:border-primary/40 hover:shadow-[0_8px_30px_rgba(139,92,246,0.15)] transition-all duration-300 group overflow-hidden"
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5 group-hover:ring-primary/20 pointer-events-none transition-all duration-500" />

                            <div className="relative z-10 flex flex-col md:flex-row gap-6">
                              <div className="flex-1 space-y-4">
                                <div>
                                  <h3 className="text-lg font-medium text-white/90 mb-1">{assignment.title}</h3>
                                  <p className="text-white/50 text-sm">{assignment.subject} • {assignment.class}</p>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                                    <User className="w-5 h-5 text-primary" />
                                  </div>
                                  <div>
                                    <p className="text-white font-medium">{submission.studentName}</p>
                                    <p className="text-white/40 text-xs">
                                      {new Date(submission.submittedAt).toLocaleString('ru-RU')}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 pt-2">
                                  <span className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium border border-primary/20">
                                    +{submission.xp} XP за правильное решение
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col gap-3 items-end justify-between">
                                {submission.screenshot && (
                                  <button
                                    onClick={() => {
                                      setSelectedSubmission({ assignment, submission });
                                      setShowCheckModal(true);
                                    }}
                                    className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-xl border border-primary/30 transition-all flex items-center gap-2 font-medium"
                                  >
                                    <Eye className="w-4 h-4" />
                                    Просмотреть работу
                                  </button>
                                )}

                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleRejectSubmission(assignment.id, submission.id)}
                                    className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/30 transition-all"
                                    title="Отклонить"
                                  >
                                    <XCircle className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleApproveSubmission(assignment.id, submission.id)}
                                    className="p-2.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-xl border border-green-500/30 transition-all"
                                    title="Принять"
                                  >
                                    <CheckCircle className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))
                    )
                  ): (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-20 px-6 rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-md"
                    >
                      <div className="w-16 h-16 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="w-8 h-8 text-white/20" />
                      </div>
                      <p className="text-white/50 text-lg mb-4">
                        Нет работ на проверке
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
