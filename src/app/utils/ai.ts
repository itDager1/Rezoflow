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

export async function parseTaskWithAI(input: string, imageUrl?: string | null): Promise<ParsedTask> {
  const prompt = `
Ты интеллектуальный помощник для школьника. Твоя задача — извлечь информацию о домашнем задании из текста (или описания картинки) и вернуть её строго в формате JSON.
Текущая дата: ${new Date().toISOString().split('T')[0]}.
Если дата не указана явно, ставь дату на завтра или через пару дней.
Сложность должна быть одной из: "Легко", "Средне", "Сложно".
Предмет должен быть с заглавной буквы.

Входные данные: ${input}

Верни JSON со следующей структурой:
{
  "title": "Краткое название задачи",
  "subject": "Предмет (например, Математика, Русский язык)",
  "difficulty": "Средне",
  "deadline": "YYYY-MM-DD",
  "duration": "Оценка времени (например, 30 мин, 1 час)",
  "description": "Подробное описание задачи на основе ввода",
  "isPriority": false
}
`;

  const messages: any[] = [
    {
      role: "user",
      content: []
    }
  ];

  if (imageUrl) {
    messages[0].content.push({
      type: "image_url",
      image_url: {
        url: imageUrl
      }
    });
  }

  messages[0].content.push({
    type: "text",
    text: prompt
  });

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "School Task AI"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash", // Good for multi-modal and fast text parsing
        response_format: { type: "json_object" },
        messages: messages
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);
    
    return {
      title: parsed.title || input.substring(0, 50),
      subject: parsed.subject || 'Разное',
      difficulty: parsed.difficulty || 'Средне',
      deadline: parsed.deadline || new Date(Date.now() + 86400000).toISOString().split('T')[0],
      duration: parsed.duration || '30 мин',
      description: parsed.description || input,
      isPriority: parsed.isPriority || false
    };
  } catch (error) {
    console.error("AI Parsing Error:", error);
    throw error;
  }
}
