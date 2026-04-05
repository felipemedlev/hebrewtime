"use server";

type Entitlements = {
  isAuthenticated: boolean;
  isPremium: boolean;
  isAdmin: boolean;
  email: string | null;
};

type PremiumUserRow = {
  email: string;
  is_premium: boolean;
  created_at?: string;
  updated_at?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().replace(/^['"]|['"]$/g, "").toLowerCase())
  .filter(Boolean);

function getAuthHeaders(accessToken?: string, useServiceRole = false): HeadersInit {
  const apiKey = useServiceRole ? supabaseServiceRoleKey : supabaseAnonKey;
  const authToken = useServiceRole ? supabaseServiceRoleKey : accessToken;
  return {
    "Content-Type": "application/json",
    apikey: apiKey ?? "",
    Authorization: `Bearer ${authToken ?? ""}`,
  };
}

async function getUserFromToken(accessToken: string): Promise<{ id: string; email: string | null } | null> {
  if (!supabaseUrl || !supabaseAnonKey || !accessToken) return null;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const user = await res.json();
  return {
    id: user?.id,
    email: user?.email ?? null,
  };
}

async function isPremiumEmail(email: string): Promise<boolean> {
  if (!supabaseUrl || !supabaseServiceRoleKey) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const res = await fetch(
    `${supabaseUrl}/rest/v1/premium_users?select=is_premium&email=eq.${encodeURIComponent(normalized)}&limit=1`,
    {
      method: "GET",
      headers: getAuthHeaders(undefined, true),
      cache: "no-store",
    }
  );
  if (!res.ok) return false;
  const rows = (await res.json()) as Array<{ is_premium: boolean }>;
  return Boolean(rows?.[0]?.is_premium);
}

export async function getUserEntitlements(accessToken?: string): Promise<Entitlements> {
  if (!accessToken) {
    return { isAuthenticated: false, isPremium: false, isAdmin: false, email: null };
  }
  const user = await getUserFromToken(accessToken);
  if (!user?.email) {
    return { isAuthenticated: false, isPremium: false, isAdmin: false, email: null };
  }
  const email = user.email.toLowerCase();
  const isAdmin = adminEmails.includes(email);
  const premium = await isPremiumEmail(email);
  return {
    isAuthenticated: true,
    isPremium: premium,
    isAdmin,
    email,
  };
}

export async function listPremiumUsers(accessToken?: string): Promise<PremiumUserRow[]> {
  const ent = await getUserEntitlements(accessToken);
  if (!ent.isAdmin || !supabaseUrl || !supabaseServiceRoleKey) return [];
  const res = await fetch(
    `${supabaseUrl}/rest/v1/premium_users?select=email,is_premium,created_at,updated_at&order=email.asc`,
    {
      method: "GET",
      headers: getAuthHeaders(undefined, true),
      cache: "no-store",
    }
  );
  if (!res.ok) return [];
  return (await res.json()) as PremiumUserRow[];
}

export async function setPremiumStatus(
  accessToken: string | undefined,
  targetEmail: string,
  isPremium: boolean
): Promise<{ ok: boolean; message: string }> {
  const ent = await getUserEntitlements(accessToken);
  if (!ent.isAdmin) {
    return { ok: false, message: "Only admins can update premium users." };
  }
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return { ok: false, message: "Missing Supabase service role configuration." };
  }
  const normalized = targetEmail.trim().toLowerCase();
  if (!normalized) return { ok: false, message: "Email is required." };

  if (!isPremium) {
    const delRes = await fetch(
      `${supabaseUrl}/rest/v1/premium_users?email=eq.${encodeURIComponent(normalized)}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(undefined, true),
      }
    );
    if (!delRes.ok) {
      return { ok: false, message: "Failed to remove premium access." };
    }
    return { ok: true, message: `Removed premium access for ${normalized}.` };
  }

  const upsertRes = await fetch(`${supabaseUrl}/rest/v1/premium_users`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(undefined, true),
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      email: normalized,
      is_premium: true,
    }),
  });
  if (!upsertRes.ok) {
    return { ok: false, message: "Failed to grant premium access." };
  }
  return { ok: true, message: `Granted premium access to ${normalized}.` };
}

export async function translateWord(
  accessToken: string | undefined,
  word: string,
  hebrewContext: string,
  englishContext: string
) {
  const ent = await getUserEntitlements(accessToken);
  if (!ent.isAuthenticated) {
    return { translation: "Please log in to translate words.", wordWithNekudot: word, type: "auth_required" };
  }
  if (!ent.isPremium) {
    return { translation: "Premium subscription required for translations.", wordWithNekudot: word, type: "premium_required" };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { translation: "Translation unavailable (No API Key)", wordWithNekudot: word, type: "error" };
  }

  const prompt = `You are a helpful dictionary assistant.
Translate the specific Hebrew word "${word}" into English.
You are given the sentence where it appears to understand the exact context:
Hebrew sentence: "${hebrewContext}"
English meaning of the sentence: "${englishContext}"

Return a JSON object with exactly two keys:
1. "translation": The English translation of the specific word "${word}", no punctuation, no extra text, just the direct translation.
2. "wordWithNekudot": The exact Hebrew word "${word}" but fully vocalized with correct Nekudot (Hebrew vowels) as it is pronounced in this specific context. It is CRITICAL that the Nekudot are 100% accurate and grammatically correct for this exact sentence.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      console.error("OpenAI Error:", await res.text());
      return { translation: "Translation error", wordWithNekudot: word, type: "error" };
    }

    const data = await res.json();
    const result = JSON.parse(data.choices[0].message.content.trim());
    return {
      translation: result.translation || "Translation error",
      wordWithNekudot: result.wordWithNekudot || word,
      type: "success",
    };
  } catch (err) {
    console.error("Fetch Error:", err);
    return { translation: "Translation error", wordWithNekudot: word, type: "error" };
  }
}
