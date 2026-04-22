import { useState } from 'react';
import { GraduationCap, Plus, FileText, Mic, Image, X, Sparkles, Loader2, Archive, User, Trophy, Camera, Target, Star, Medal, Settings } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { parseTaskWithAI } from '../utils/ai';

interface StudentDashboardProps {
  userName: string;
  isLightGradient: boolean;
  setIsLightGradient: (value: boolean) => void;
  isSnowEnabled: boolean;
  setIsSnowEnabled: (value: boolean) => void;
}

interface Task {
  id: number;
  title: string;
  subject: string;
  difficulty: 'Легко' | 'Средне' | 'Сложно';
  deadline: string;
  description: string;
  isPriority: boolean;
  duration: string;
  screenshot?: string;
  createdAt?: number;
  completedAt?: number;
}

export function StudentDashboard({ userName, isLightGradient, setIsLightGradient, isSnowEnabled, setIsSnowEnabled }: StudentDashboardProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [xp, setXp] = useState(0);
  const [avatar, setAvatar] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const [newTask, setNewTask] = useState({
    title: '',
    subject: '',
    difficulty: 'Средне' as 'Легко' | 'Средне' | 'Сложно',
    deadline: '',
    description: '',
    duration: '',
    isPriority: false,
  });

  const handleVoiceInput = async () => {
    try {
      // Явно запрашиваем дос��уп к микрофону. 
      // Это заставит браузер использовать активное устройство аудио (внешний микрофон)
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
      // Включаем промежуточные результаты для красивого отображения текста в реальном времени
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
        // Отображаем промежуточный результат
        setNewTask(prev => ({ ...prev, title: finalTranscript + currentTranscript }));
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
        
        // Если есть транскрипция, автоматически отправляем её в AI для парсинга
        if (finalTranscript.trim()) {
          setIsParsing(true);
          try {
            const parsed = await parseTaskWithAI(finalTranscript, null);
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
            console.error('Ошибка при обработке голосового ввода через AI:', error);
            alert('Не удалось обработать голосовой ввод. Попробуйте еще раз.');
            // Оставляем только транскрипцию в поле title
            setNewTask(prev => ({ ...prev, title: finalTranscript }));
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
        // В будущем здесь можно добавить OCR для распознавания текста с изображения
        setNewTask({ ...newTask, title: `Задание из изображения (${file.name})` });
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
      const parsed = await parseTaskWithAI(newTask.title || "Распознай эту задачу", uploadedImage);
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
    }
  };

  const removeImage = () => {
    setUploadedImage(null);
  };

  const handleTaskComplete = (taskId: number, screenshot: string | null) => {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const task = tasks[taskIndex];
    const difficultyXp = { Легко: 8, Средне: 20, Сложно: 50 };
    const earnedXp = difficultyXp[task.difficulty];

    setXp(prev => prev + earnedXp);

    const completedTask = { ...task, screenshot: screenshot || undefined, completedAt: Date.now() };
    setCompletedTasks([completedTask, ...completedTasks]);

    setTasks(tasks.filter(t => t.id !== taskId));
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
    setNewTask({
      title: '',
      subject: '',
      difficulty: 'Средне',
      deadline: '',
      description: '',
      duration: '',
      isPriority: false,
    });
    setUploadedImage(null);
    setShowAddForm(false);
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });

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
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 md:p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md transition-all shadow-[0_0_20px_rgba(139,92,246,0.1)] hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] shrink-0"
          >
            <Settings className="w-5 h-5 md:w-6 md:h-6 text-white/80 hover:text-white transition-colors" />
          </button>

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
                  <span className="relative z-10">Создать задачу</span>
                </motion.button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between mb-2 px-1">
                
                
              </div>
              <AnimatePresence mode="popLayout">
                {sortedTasks.length > 0 ? (
                  sortedTasks.map((task, idx) => (
                    <motion.div
                      key={task.id}
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
                    <h2 className="text-xl font-semibold text-white ml-4">Профиль ученика</h2>
                    <button 
                      onClick={() => setShowProfileModal(false)}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
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
                            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{userName || "Алексей"} (Ученик)</h2>
                            <p className="text-white/50">Продолжай в том же духе, чтобы стать легендой!</p>
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
                              data={(() => {
                                const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
                                const dayXp = [0, 0, 0, 0, 0, 0, 0];
                                
                                const difficultyMap: Record<string, number> = { 'Легко': 8, 'Средне': 20, 'Сложно': 50 };
                                const now = new Date();
                                const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                const currentDayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
                                
                                const weekStart = new Date(todayDate);
                                weekStart.setDate(todayDate.getDate() - currentDayIndex);

                                completedTasks.forEach(task => {
                                  if (task.completedAt) {
                                    const taskDate = new Date(task.completedAt);
                                    if (taskDate >= weekStart) {
                                      const dayIndex = taskDate.getDay() === 0 ? 6 : taskDate.getDay() - 1;
                                      dayXp[dayIndex] += difficultyMap[task.difficulty] || 0;
                                    }
                                  }
                                });

                                return days.map((day, index) => ({ day, xp: dayXp[index] }));
                              })()}
                              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.8} />
                                  <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.2} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                              <XAxis
                                dataKey="day"
                                stroke="rgba(255,255,255,0.3)"
                                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                              />
                              <YAxis
                                stroke="rgba(255,255,255,0.3)"
                                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                                tickFormatter={(value) => `${value}`}
                              />
                              <Tooltip
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
                                type="monotone"
                                dataKey="xp"
                                stroke="url(#xpGradient)"
                                strokeWidth={3}
                                dot={{ fill: '#8B5CF6', r: 4, strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 6, fill: '#8B5CF6', stroke: '#fff', strokeWidth: 2 }}
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
                              className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all flex flex-col gap-2"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-white mb-1 truncate">{task.title}</h4>
                                  <p className="text-sm text-white/50">{task.subject} • {task.difficulty}</p>
                                </div>
                                {task.screenshot && (
                                  <img
                                    src={task.screenshot}
                                    alt="Скриншот"
                                    className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0"
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
                  <h3 className="text-lg md:text-2xl font-medium mb-3 md:mb-6 text-white/90 relative z-10">Новая задача</h3>

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
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleVoiceInput}
                            disabled={isParsing || isRecording}
                            className={`p-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                              isRecording 
                                ? 'bg-primary/20 text-primary shadow-[0_0_15px_rgba(139,92,246,0.5)]' 
                                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
                            }`}
                            title="Голосовой ввод"
                          >
                            <Mic className={`w-4 h-4 ${isRecording ? 'animate-pulse' : ''}`} />
                          </motion.button>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => document.getElementById('imageUpload')?.click()}
                            className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 transition-all"
                            title="Загрузить изображение"
                          >
                            <Image className="w-4 h-4" />
                          </motion.button>
                          <input
                            type="file"
                            id="imageUpload"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </div>
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
                          Обрабатываю голосовое сообщение с помощью ИИ...
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

                      {(newTask.title || uploadedImage) && (
                        <motion.button
                          type="button"
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={handleParseAI}
                          disabled={isParsing}
                          className="mt-3 flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl border border-primary/20 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
                        >
                          {isParsing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          {isParsing ? 'Распознаём задачу...' : 'Заполнить все поля с помощью ИИ'}
                        </motion.button>
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
                          onChange={(e) => setNewTask({ ...newTask, difficulty: e.target.value as 'Легко' | 'Средне' | 'Сложно' })}
                          className="w-full min-w-0 px-2.5 md:px-4 py-2 md:py-3 bg-black/40 text-white rounded-xl border border-white/10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all [color-scheme:dark]"
                        >
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
                          className="w-full min-w-0 px-2.5 md:px-4 py-2 md:py-3 bg-black/40 text-white rounded-xl border border-white/10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-white/80 [color-scheme:dark]"
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
                        onClick={() => setShowAddForm(false)}
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
                </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}