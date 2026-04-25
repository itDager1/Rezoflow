import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, User, X, Loader2, BookOpen, Clock, ImageIcon } from 'lucide-react';
import { chatWithAI, ChatMessage } from '../utils/ai';

interface StudentAIChatProps {
  onClose?: () => void;
  isLightGradient?: boolean;
}

export function StudentAIChat({ onClose, isLightGradient = false }: StudentAIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('rezoflow_ai_chat');
      return saved ? JSON.parse(saved) : [
        { role: 'assistant', content: 'Привет! Я ИИ-наставник RezoFlow. Я могу помочь тебе составить оптимальное расписание или разобраться с трудной темой. Напиши, с чем нужна помощь!' }
      ];
    } catch {
      return [{ role: 'assistant', content: 'Привет! Я ИИ-наставник RezoFlow. Чем могу помочь?' }];
    }
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('rezoflow_ai_chat', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Capture Ctrl+V paste anywhere inside the chat window
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = (ev) => {
          setPastedImage(ev.target?.result as string);
        };
        reader.readAsDataURL(file);
        e.preventDefault();
        break;
      }
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !pastedImage) || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim() || (pastedImage ? 'Посмотри на этот скриншот.' : ''),
      ...(pastedImage ? { image: pastedImage } : {}),
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setPastedImage(null);
    setIsLoading(true);

    try {
      const reply = await chatWithAI(newMessages);
      setMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch (error) {
      console.error(error);
      setMessages([...newMessages, { role: 'assistant', content: 'Ой, произошла ошибка подключения. Попробуй еще раз.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] rounded-full shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] flex items-center justify-center text-white border border-white/20 transition-all duration-300"
          >
            <Bot className="w-7 h-7 md:w-8 md:h-8 drop-shadow-md" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={chatWindowRef}
            key="chat-window"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onPaste={handlePaste}
            className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 w-[calc(100vw-3rem)] sm:w-[400px] h-[500px] md:h-[600px] max-h-[80vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden bg-[#0a0a0e]/95 border-white/10 backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-tight">ИИ-наставник</h2>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMessages([{ role: 'assistant', content: 'Диалог очищен. О чем поговорим?' }])}
                  className="text-[11px] font-medium text-white/50 hover:text-white/80 transition-colors px-2 py-1.5 rounded-full hover:bg-white/5"
                >
                  Очистить
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    if (onClose) onClose();
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {messages.length === 1 && (
                 <div className="flex flex-col gap-2 mt-4 max-w-full">
                   <button onClick={() => handleQuickPrompt('Помоги мне составить расписание на сегодня')} className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#8B5CF6]/50 transition-all text-left group flex items-center gap-3">
                     <div className="p-2 rounded-xl bg-white/5 group-hover:bg-[#8B5CF6]/20 transition-colors">
                       <Clock className="w-5 h-5 text-[#8B5CF6] group-hover:scale-110 transition-transform" />
                     </div>
                     <div>
                       <h3 className="text-white text-sm font-medium mb-0.5">Оптимизировать время</h3>
                       <p className="text-xs text-white/60">Составить план выполнения задач</p>
                     </div>
                   </button>
                   <button onClick={() => handleQuickPrompt('У меня трудности с задачей по математике. Дай подсказку')} className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#8B5CF6]/50 transition-all text-left group flex items-center gap-3">
                     <div className="p-2 rounded-xl bg-white/5 group-hover:bg-[#8B5CF6]/20 transition-colors">
                       <BookOpen className="w-5 h-5 text-[#8B5CF6] group-hover:scale-110 transition-transform" />
                     </div>
                     <div>
                       <h3 className="text-white text-sm font-medium mb-0.5">Разобрать задачу</h3>
                       <p className="text-xs text-white/60">Получить наводящие вопросы</p>
                     </div>
                   </button>
                   <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#8B5CF6]/5 border border-[#8B5CF6]/15">
                     <ImageIcon className="w-4 h-4 text-[#8B5CF6]/60 shrink-0" />
                     <p className="text-xs text-white/40">Нажми <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/60 text-[10px] font-mono">Ctrl+V</kbd> внутри чата, чтобы вставить скриншот</p>
                   </div>
                 </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === 'user' ? 'bg-white/10' : 'bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9]'
                    }`}>
                      {msg.role === 'user' ? <User className="w-3 h-3 text-white" /> : <Bot className="w-3 h-3 text-white" />}
                    </div>
                    <div className={`max-w-[85%] rounded-2xl text-sm overflow-hidden ${
                      msg.role === 'user'
                        ? 'bg-white/10 text-white rounded-br-sm'
                        : 'bg-gradient-to-br from-[#8B5CF6]/20 to-transparent border border-[#8B5CF6]/30 text-white/90 rounded-bl-sm'
                    }`}>
                      {/* Screenshot thumbnail in user messages */}
                      {msg.role === 'user' && msg.image && (
                        <div className="p-1.5 pb-0">
                          <img
                            src={msg.image}
                            alt="скриншот"
                            className="rounded-xl w-full max-h-48 object-cover border border-white/10 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(msg.image, '_blank')}
                          />
                        </div>
                      )}
                      <div className="p-3">
                        {/* Basic markdown parsing for bold text or line breaks */}
                        {msg.content.split('\n').map((line, i) => (
                          <p key={i} className={i !== 0 ? 'mt-1' : ''}>
                            {line.split('**').map((text, j) => j % 2 === 1 ? <strong key={j} className="text-white font-bold">{text}</strong> : text)}
                          </p>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-[#8B5CF6]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">ИИ думает...</span>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/10 bg-white/5 shrink-0">
              {/* Pasted image preview */}
              <AnimatePresence>
                {pastedImage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="relative inline-flex"
                  >
                    <img
                      src={pastedImage}
                      alt="вложение"
                      className="h-20 rounded-xl border border-[#8B5CF6]/40 object-cover shadow-[0_0_12px_rgba(139,92,246,0.2)] cursor-zoom-in hover:opacity-90 transition-opacity"
                      onClick={() => setLightboxImage(pastedImage)}
                      title="Нажми, чтобы увеличить"
                    />
                    <button
                      onClick={() => setPastedImage(null)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#1a1a2e] border border-white/20 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-[#8B5CF6] transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSend} className="relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={pastedImage ? 'Добавь комментарий к скриншоту…' : 'Спроси у наставника…'}
                  className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-4 pr-12 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#8B5CF6]/50 focus:ring-1 focus:ring-[#8B5CF6]/50 transition-all"
                />
                <button
                  type="submit"
                  disabled={(!input.trim() && !pastedImage) || isLoading}
                  className="absolute right-1 p-2 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 disabled:hover:bg-[#8B5CF6] text-white rounded-full transition-all shadow-[0_0_10px_rgba(139,92,246,0.4)]"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
              {!pastedImage && (
                <p className="text-center text-white/20 text-[10px] mt-1.5">
                  Ctrl+V — вставить скриншот
                </p>
              )}
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setLightboxImage(null)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative max-w-[90vw] max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxImage}
                alt="полный размер"
                className="max-w-full max-h-[85vh] rounded-2xl border border-[#8B5CF6]/40 shadow-[0_0_40px_rgba(139,92,246,0.3)] object-contain"
              />
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-[#1a1a2e] border border-white/20 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-[#8B5CF6] transition-all shadow-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}