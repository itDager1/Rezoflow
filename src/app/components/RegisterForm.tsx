import { useState } from 'react';
import { Mail, Lock, User, GraduationCap, BookOpen, Users } from 'lucide-react';
import { motion } from 'motion/react';

interface RegisterFormProps {
  onRegister: (name: string, email: string, password: string, role: string) => void;
}

type UserRole = 'student' | 'teacher' | 'parent' | null;

export function RegisterForm({ onRegister }: RegisterFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);

  const roles = [
    {
      id: 'student' as UserRole,
      label: 'Школьник',
      icon: <GraduationCap className="w-8 h-8" />,
      description: 'Я учусь',
    },
    {
      id: 'teacher' as UserRole,
      label: 'Учитель',
      icon: <BookOpen className="w-8 h-8" />,
      description: 'Я преподаю',
    },
    {
      id: 'parent' as UserRole,
      label: 'Родитель',
      icon: <Users className="w-8 h-8" />,
      description: 'Я помогаю',
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) {
      alert('Пожалуйста, выберите вашу роль');
      return;
    }
    if (password !== confirmPassword) {
      alert('Пароли не совпадают');
      return;
    }
    onRegister(name, email, password, selectedRole);
  };

  return (
    <div className="min-h-screen text-foreground flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-primary/25 via-[#A78BFA]/15 to-transparent rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#6D28D9]/15 rounded-full blur-[150px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-[480px] relative z-10"
      >
        <div className="text-center mb-10">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
            className="flex items-center justify-center gap-3 mb-6"
          >
            <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_40px_rgba(139,92,246,0.3)] backdrop-blur-xl">
              <GraduationCap className="w-10 h-10 text-primary drop-shadow-[0_0_15px_rgba(139,92,246,0.5)]" />
            </div>
          </motion.div>
          <h1 className="text-4xl mb-3 font-semibold tracking-tight bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-transparent">
            Создать аккаунт
          </h1>
          <p className="text-white/50 text-sm">Присоединяйтесь к платформе нового поколения</p>
        </div>

        <div className="bg-[#141414]/80 backdrop-blur-3xl rounded-3xl p-8 border border-white/5 shadow-2xl relative overflow-hidden">
          {/* subtle inner glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none rounded-3xl" />
          
          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            <div className="space-y-4">
              <label className="text-sm font-medium text-white/70">Выберите вашу роль</label>
              <div className="grid grid-cols-3 gap-3">
                {roles.map((role, idx) => (
                  <motion.button
                    key={role.id}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + idx * 0.1 }}
                    onClick={() => setSelectedRole(role.id)}
                    className={`relative p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-3 ${
                      selectedRole === role.id
                        ? 'border-primary bg-primary/10 shadow-[0_0_30px_rgba(139,92,246,0.2)]'
                        : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <div className={`transition-colors duration-300 ${selectedRole === role.id ? 'text-primary drop-shadow-[0_0_10px_rgba(139,92,246,0.8)]' : 'text-white/60'}`}>
                      {role.icon}
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${selectedRole === role.id ? 'text-white' : 'text-white/70'}`}>{role.label}</div>
                      <div className="text-[11px] text-white/40 mt-1">{role.description}</div>
                    </div>
                    
                    {selectedRole === role.id && (
                      <motion.div 
                        layoutId="activeRoleIndicator"
                        className="absolute inset-0 border-2 border-primary rounded-2xl pointer-events-none"
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {[
                { label: 'Имя', icon: User, value: name, setter: setName, type: 'text', placeholder: 'Ваше имя' },
                { label: 'Email', icon: Mail, value: email, setter: setEmail, type: 'email', placeholder: 'your@email.com' },
                { label: 'Пароль', icon: Lock, value: password, setter: setPassword, type: 'password', placeholder: '••••••••' },
                { label: 'Подтвердите пароль', icon: Lock, value: confirmPassword, setter: setConfirmPassword, type: 'password', placeholder: '••••••••' },
              ].map((field, idx) => (
                <motion.div 
                  key={field.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + idx * 0.1 }}
                  className="space-y-1.5"
                >
                  <label className="text-xs font-medium text-white/60 ml-1">{field.label}</label>
                  <div className="relative group">
                    <field.icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                    <input
                      type={field.type}
                      value={field.value}
                      onChange={(e) => field.setter(e.target.value)}
                      placeholder={field.placeholder}
                      required
                      className="w-full pl-12 pr-4 py-3.5 bg-black/40 text-white rounded-xl border border-white/10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-white/20"
                    />
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-4 mt-2 bg-gradient-to-r from-primary to-[#7C3AED] text-white font-medium rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] border border-white/10 transition-all duration-300"
            >
              Создать аккаунт
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
