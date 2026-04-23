import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, User, X, Loader2, Sparkles, BookOpen, Clock } from 'lucide-react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('rezoflow_ai_chat', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
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
            key="chat-window"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
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
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                      msg.role === 'user' 
                        ? 'bg-white/10 text-white rounded-br-sm' 
                        : 'bg-gradient-to-br from-[#8B5CF6]/20 to-transparent border border-[#8B5CF6]/30 text-white/90 rounded-bl-sm'
                    }`}>
                      {/* Basic markdown parsing for bold text or line breaks */}
                      {msg.content.split('\n').map((line, i) => (
                        <p key={i} className={i !== 0 ? 'mt-1' : ''}>
                          {line.split('**').map((text, j) => j % 2 === 1 ? <strong key={j} className="text-white font-bold">{text}</strong> : text)}
                        </p>
                      ))}
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
              <form onSubmit={handleSend} className="relative flex items-center">
                <input 
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Спроси у наставника..."
                  className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-4 pr-12 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#8B5CF6]/50 focus:ring-1 focus:ring-[#8B5CF6]/50 transition-all"
                />
                <button 
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-1 p-2 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 disabled:hover:bg-[#8B5CF6] text-white rounded-full transition-all shadow-[0_0_10px_rgba(139,92,246,0.4)]"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}