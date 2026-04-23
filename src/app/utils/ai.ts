export const OPENROUTER_API_KEY = "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";

export interface ParsedTask {
  title: string;
  subject: string;
  difficulty: 'Легко' | 'Средне' | 'Сложно';
  deadline: string;
  duration: string;
  description: string;
  isPriority: boolean;
}

async function callOpenRouter(input: string, imageUrl?: string | null): Promise<ParsedTask | null> {
  // Skip API call if no real key is provided
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === "YOUR_OPENROUTER_API_KEY_HERE") {
    return null;
  }

  try {
    const messages: any[] = [];
    
    const systemPrompt = `Проанализируй это задание и верни ТОЛЬКО валидный JSON (без разметки markdown \`\`\`json).
Текст/Контекст: "${input}"
Текущая дата: ${new Date().toLocaleDateString('ru-RU')} (используй для расчета сроков)

Формат ответа JSON:
{
  "title": "краткое и понятное название задачи",
  "subject": "название предмета с заглавной буквы",
  "difficulty": "Легко|Средне|Сложно",
  "deadline": "YYYY-MM-DD",
  "duration": "примерное время на выполнение (например, '30 мин', '1 час')",
  "description": "подробное описание задачи. Обязательно разбей выполнение на логические шаги (подзадачи) маркированным списком (- шаг 1\\n- шаг 2).",
  "isPriority": false
}`;

    if (imageUrl) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: systemPrompt },
          { type: "image_url", image_url: { url: imageUrl } }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: systemPrompt
      });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "RezoFlow"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: messages,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.error("OpenRouter request failed", response.status, errorBody);
      if (response.status === 401) {
        console.warn("401 details:", errorBody);
      }
      return null;
    }

    const data = await response.json();
    if (data.choices && data.choices.length > 0) {
      const resultText = data.choices[0].message.content;
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title || input.substring(0, 50),
          subject: parsed.subject || 'Разное',
          difficulty: parsed.difficulty || 'Средне',
          deadline: parsed.deadline || new Date(Date.now() + 86400000).toISOString().split('T')[0],
          duration: parsed.duration || '30 мин',
          description: parsed.description || input,
          isPriority: parsed.isPriority || false
        } as ParsedTask;
      }
    }
  } catch (error) {
    console.error("Error calling OpenRouter:", error);
  }
  
  return null;
}

async function tryBrowserAI(input: string): Promise<ParsedTask | null> {
  try {
    // Проверяем наличие Chrome AI
    if ('ai' in window && (window as any).ai?.languageModel) {
      const session = await (window as any).ai.languageModel.create({
        systemPrompt: `Ты помощник для анализа домашних заданий. Извлекай информацию и возвращай ТОЛЬКО валидный JSON без дополнительного текста.`
      });

      const prompt = `Проанализируй это задание и верни JSON:
Текст: "${input}"
Текущая дата: ${new Date().toLocaleDateString('ru-RU')}

Формат ответа (только JSON, без объяснений):
{
  "title": "краткое название",
  "subject": "предмет с заглавной буквы",
  "difficulty": "Легко|Средне|Сложно",
  "deadline": "YYYY-MM-DD",
  "duration": "время на выполнение",
  "description": "подробное описание задания. Обязательно разбей его на логические шаги (подзадачи) в виде маркированного списка с дефисами (- шаг 1\\n- шаг 2), чтобы было понятно, как именно его выполнять.",
  "isPriority": false
}`;

      const result = await session.prompt(prompt);
      session.destroy();

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title || input.substring(0, 50),
          subject: parsed.subject || 'Разное',
          difficulty: parsed.difficulty || 'Средне',
          deadline: parsed.deadline || new Date(Date.now() + 86400000).toISOString().split('T')[0],
          duration: parsed.duration || '30 мин',
          description: parsed.description || input,
          isPriority: parsed.isPriority || false
        };
      }
    }
  } catch (e) {
    console.log('Browser AI не доступен:', e);
  }
  return null;
}

export async function parseTaskWithAI(input: string, imageUrl?: string | null): Promise<ParsedTask> {
  // Пытаемся использовать полноценную Vision-модель через OpenRouter
  // Если есть картинка, или если мы просто хотим получить лучший результат для текста
  const orResult = await callOpenRouter(input, imageUrl);
  if (orResult) return orResult;

  // Резервные варианты (Fallback):
  // Пробуем использовать встроенный AI браузера
  if (!imageUrl) {
    const browserResult = await tryBrowserAI(input);
    if (browserResult) return browserResult;
  }

  // Имитация задержки обработки для локального парсинга
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Улучшенный парсинг на основе ключевых слов и контекста
  const lowerInput = input.toLowerCase();
  const words = lowerInput.split(/\s+/);

  // Определение предмета с учетом контекста
  let subject = 'Разное';
  const subjectKeywords = {
    'Математика': ['математик', 'алгебр', 'геометр', 'уравнен', 'задач', 'примеры', 'решить', 'вычисли', 'формул', 'теорем'],
    'Русский язык': ['русск', 'сочинен', 'изложен', 'диктант', 'правописан', 'орфограф', 'грамматик', 'синтаксис'],
    'Литература': ['литерату', 'роман', 'повесть', 'стих', 'поэм', 'анализ текста', 'произведен'],
    'Английский язык': ['англ', 'english', 'перевод', 'топик', 'эссе на английском'],
    'Физика': ['физик', 'механик', 'электр', 'оптик', 'закон ньютона', 'силы', 'движен'],
    'Химия': ['хими', 'реакци', 'формул', 'элемент', 'вещество', 'раствор'],
    'Биология': ['биолог', 'клетк', 'организм', 'растен', 'животн', 'эволюци'],
    'История': ['истор', 'война', 'революци', 'век', 'событи', 'дата'],
    'География': ['географ', 'карт', 'страна', 'материк', 'климат', 'природ'],
    'Информатика': ['информатик', 'программ', 'код', 'алгоритм', 'компьютер', 'python', 'pascal']
  };

  for (const [subj, keywords] of Object.entries(subjectKeywords)) {
    if (keywords.some(kw => lowerInput.includes(kw))) {
      subject = subj;
      break;
    }
  }

  // Определение сложности на основе контекста
  let difficulty: 'Легко' | 'Средне' | 'Сложно' = 'Средне';
  if (lowerInput.match(/легк|прост|быстр|коротк|несложн/)) {
    difficulty = 'Легко';
  } else if (lowerInput.match(/сложн|труд|долг|большой объем|контрольн|экзамен|олимпиад/)) {
    difficulty = 'Сложно';
  }

  // Улучшенное определение срока
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  let deadline = tomorrow.toISOString().split('T')[0];

  // Поиск даты в формате "15 апреля", "к понедельнику", "через 3 дня"
  const monthNames: {[key: string]: number} = {
    'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
    'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
  };

  const dateMatch = input.match(/(\d{1,2})\s*(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = monthNames[dateMatch[2].toLowerCase()];
    const year = new Date().getFullYear();
    const date = new Date(year, month, day);
    if (date < new Date()) {
      date.setFullYear(year + 1);
    }
    deadline = date.toISOString().split('T')[0];
  } else if (lowerInput.includes('завтра')) {
    deadline = tomorrow.toISOString().split('T')[0];
  } else if (lowerInput.includes('послезавтра')) {
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    deadline = dayAfter.toISOString().split('T')[0];
  } else if (lowerInput.match(/через\s+(\d+)\s+дн/)) {
    const match = lowerInput.match(/через\s+(\d+)\s+дн/);
    const days = parseInt(match![1]);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    deadline = futureDate.toISOString().split('T')[0];
  } else if (lowerInput.match(/к\s+(понедельник|вторник|среду|четверг|пятниц|субботу|воскресень)/)) {
    const weekDays = ['воскресень', 'понедельник', 'вторник', 'среду', 'четверг', 'пятниц', 'субботу'];
    const match = lowerInput.match(/к\s+(понедельник|вторник|среду|четверг|пятниц|субботу|воскресень)/);
    const targetDay = weekDays.indexOf(match![1]);
    const today = new Date();
    const currentDay = today.getDay();
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7;
    const targetDate = new Date();
    targetDate.setDate(today.getDate() + daysToAdd);
    deadline = targetDate.toISOString().split('T')[0];
  }

  // Определение длительности
  let duration = '30 мин';
  if (lowerInput.match(/страниц|параграф|номер/)) {
    const pageMatch = lowerInput.match(/(\d+)\s*страниц/);
    const parMatch = lowerInput.match(/(\d+)\s*параграф/);
    const numMatch = lowerInput.match(/(\d+)\s*номер/);

    if (pageMatch && parseInt(pageMatch[1]) > 5) {
      duration = '1-2 часа';
    } else if (parMatch && parseInt(parMatch[1]) > 2) {
      duration = '1 час';
    } else if (numMatch && parseInt(numMatch[1]) > 10) {
      duration = '45 мин';
    }
  } else if (lowerInput.match(/сочинен|изложен|эссе|реферат/)) {
    duration = '1-2 часа';
  } else if (lowerInput.match(/выучить|наизусть/)) {
    duration = '45 мин';
  } else if (lowerInput.match(/прочита/)) {
    duration = '30-45 мин';
  }

  // Приоритет
  const isPriority = lowerInput.match(/срочн|важн|контрольн|экзамен|зачет|олимпиад/) !== null;

  // Извлечение названия - первое предложение или ключевая фраза
  let title = input.trim();

  // Удаляем вводные фразы
  title = title.replace(/^(надо|нужно|необходимо|задали|дали|домашка|дз|задание)\s+/i, '');

  // Берем первое предложение
  const sentences = title.split(/[.!?;]/);
  if (sentences[0] && sentences[0].length < 100) {
    title = sentences[0].trim();
  } else if (title.length > 70) {
    title = title.substring(0, 67) + '...';
  }

  // Делаем первую букву заглавной
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Формируем подробное описание
  let description = input;
  if (input.length < 20) {
    description = `Задание по предмету "${subject}": ${input}`;
  }

  return {
    title: title || 'Новое задание',
    subject,
    difficulty,
    deadline,
    duration,
    description,
    isPriority
  };
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === "YOUR_OPENROUTER_API_KEY_HERE") {
    throw new Error('API key not set');
  }
  const ext = audioBlob.type.includes('ogg') ? 'audio.ogg' : audioBlob.type.includes('mp4') ? 'audio.mp4' : 'audio.webm';
  const formData = new FormData();
  formData.append('file', audioBlob, ext);
  formData.append('model', 'openai/whisper-large-v3');

  const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'RezoFlow',
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('Whisper transcription failed', response.status, err);
    throw new Error('Transcription failed');
  }

  const data = await response.json();
  return (data.text || '').trim();
}

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export async function chatWithAI(messages: ChatMessage[]): Promise<string> {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === "YOUR_OPENROUTER_API_KEY_HERE") {
    throw new Error('API key not set');
  }

  // Prepend system instruction for the AI persona
  const systemPrompt: ChatMessage = {
    role: 'system',
    content: `Ты — ИИ-помощник RezoFlow для учеников. Твоя задача — помогать анализировать и составлять оптимальное расписание, а также давать подсказки по сложным заданиям. Строго запрещено решать задания за пользователя — только давай подсказки, наводящие вопросы и объясняй концепции. Будь дружелюбным, поддерживающим и используй понятный язык.`
  };

  const payloadMessages = [systemPrompt, ...messages];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "RezoFlow Chat"
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: payloadMessages,
    })
  });

  if (!response.ok) {
    throw new Error('Chat API request failed');
  }

  const data = await response.json();
  if (data.choices && data.choices.length > 0) {
    return data.choices[0].message.content;
  }
  
  return "Извините, не удалось получить ответ. Попробуйте еще раз.";
}