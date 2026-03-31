"use server";

export async function translateWord(word: string, hebrewContext: string, englishContext: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return "Translation unavailable (No API Key)";
  }

  const prompt = `You are a helpful dictionary assistant. 
Translate the specific Hebrew word "${word}" into English. 
You are given the sentence where it appears to understand the exact context: 
Hebrew sentence: "${hebrewContext}"
English meaning of the sentence: "${englishContext}"

Return ONLY the English translation of the specific word "${word}", no punctuation, no extra text, just the direct translation of the word itself.`;

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
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      console.error("OpenAI Error:", await res.text());
      return "Translation error";
    }

    const data = await res.json();
    let translation = data.choices[0].message.content.trim();
    // remove any surrounding quotes if they exist
    translation = translation.replace(/^["'](.*)["']$/, '$1');
    return translation;
  } catch (err) {
    console.error("Fetch Error:", err);
    return "Translation error";
  }
}
