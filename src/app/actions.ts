"use server";

export async function translateWord(word: string, hebrewContext: string, englishContext: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { translation: "Translation unavailable (No API Key)", wordWithNekudot: word };
  }

  const prompt = `You are a helpful dictionary assistant. 
Translate the specific Hebrew word "${word}" into English. 
You are given the sentence where it appears to understand the exact context: 
Hebrew sentence: "${hebrewContext}"
English meaning of the sentence: "${englishContext}"

Return a JSON object with exactly two keys:
1. "translation": The English translation of the specific word "${word}", no punctuation, no extra text, just the direct translation.
2. "wordWithNekudot": The exact Hebrew word "${word}" but fully vocalized with Nekudot (Hebrew vowels) as it is pronounced in this context.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      console.error("OpenAI Error:", await res.text());
      return { translation: "Translation error", wordWithNekudot: word };
    }

    const data = await res.json();
    const result = JSON.parse(data.choices[0].message.content.trim());
    return {
      translation: result.translation || "Translation error",
      wordWithNekudot: result.wordWithNekudot || word
    };
  } catch (err) {
    console.error("Fetch Error:", err);
    return { translation: "Translation error", wordWithNekudot: word };
  }
}
