import type { SpeakLevel } from "./types";
import { SPEAK_RECENT_TOPICS_MAX } from "./types";

export type ConversationSpark = {
  id: string;
  level: SpeakLevel;
  hint: string;
  modelLines: string[];
  interestHints?: string[];
};

export type PickedConversationSparks = {
  primary: ConversationSpark;
  backups: ConversationSpark[];
};

const BEGINNER_SPARKS: ConversationSpark[] = [
  {
    id: "morning_drink",
    level: "beginner",
    hint: "Model your morning drink, then ask what they drink in the morning. Open question, not tea-or-coffee.",
    modelLines: ["בבוקר אני שותה קפה. מה אתה שותה בבוקר?"],
    interestHints: ["coffee", "tea", "קפה"],
  },
  {
    id: "today_weather",
    level: "beginner",
    hint: "Say how the weather is where you are, then ask how it is where they are.",
    modelLines: ["אצלי היום חם ויש שמש. איך מזג האוויר אצלך?"],
  },
  {
    id: "this_morning",
    level: "beginner",
    hint: "Tell one thing from your morning, then ask what they did this morning.",
    modelLines: ["הבוקר אכלתי לחם ושתיתי קפה. מה עשית הבוקר?"],
  },
  {
    id: "tonight_plans",
    level: "beginner",
    hint: "Say your evening plan, then ask what they are doing tonight.",
    modelLines: ["הערב אני נשאר בבית. מה אתה עושה הערב?"],
  },
  {
    id: "favorite_food",
    level: "beginner",
    hint: "Name a food you like, then ask what they like to eat and a little why if they can.",
    modelLines: ["אני אוהב שקשוקה. מה אתה אוהב לאכול?"],
    interestHints: ["food", "cook", "אוכל"],
  },
  {
    id: "music_listen",
    level: "beginner",
    hint: "Say when you listen to music, then ask what music they like.",
    modelLines: ["בערב אני שומע מוזיקה. איזו מוזיקה אתה אוהב?"],
    interestHints: ["music", "song", "מוזיקה"],
  },
  {
    id: "saturday",
    level: "beginner",
    hint: "Say what you do on Saturday, then ask how their Saturday looks.",
    modelLines: ["בשבת אני נח בבית. מה אתה עושה בשבת?"],
  },
  {
    id: "where_today",
    level: "beginner",
    hint: "Say where you are today and what you are doing, then ask about their day.",
    modelLines: ["היום אני בבית ועובד קצת. איפה אתה היום ומה אתה עושה?"],
  },
  {
    id: "work_study_today",
    level: "beginner",
    hint: "One sentence about work or study today, then ask what their day looks like.",
    modelLines: ["היום יש לי עבודה בבית. מה אתה עושה היום?"],
  },
  {
    id: "outside",
    level: "beginner",
    hint: "Say something you like to do outside, then ask what they like to do outside.",
    modelLines: ["אחרי הצהריים אני אוהב ללכת. מה אתה אוהב לעשות בחוץ?"],
  },
  {
    id: "how_today",
    level: "beginner",
    hint: "Say how you feel today in one sentence, then ask how their day is going.",
    modelLines: ["היום אני קצת עייף אבל בסדר. איך היום שלך?"],
  },
  {
    id: "breakfast",
    level: "beginner",
    hint: "Model a simple breakfast, then ask what they eat in the morning.",
    modelLines: ["בבוקר אני אוכל לחם עם גבינה. מה אתה אוכל בבוקר?"],
  },
  {
    id: "your_place",
    level: "beginner",
    hint: "Say one thing about where you live, then invite them to tell a little about their place.",
    modelLines: ["אני גר בעיר ליד הים. ספר לי קצת על המקום שלך."],
  },
  {
    id: "home_food",
    level: "beginner",
    hint: "What you cook or eat at home, then ask what they eat at home.",
    modelLines: ["בבית אני מבשל פסטה. מה אתה אוכל בבית?"],
    interestHints: ["cook", "cooking", "food", "בישול"],
  },
  {
    id: "when_hot",
    level: "beginner",
    hint: "What you like when it is hot, then ask what they like to do when it is hot.",
    modelLines: ["כשחם אני אוהב את הים. מה אתה אוהב לעשות כשחם?"],
    interestHints: ["sea", "beach", "swim", "ים"],
  },
  {
    id: "evening_habit",
    level: "beginner",
    hint: "Your evening habit, then ask what they do in the evening.",
    modelLines: ["בערב אני רואה משהו קצר. מה אתה עושה בערב?"],
    interestHints: ["film", "movie", "series", "סרט"],
  },
  {
    id: "people",
    level: "beginner",
    hint: "Who you talked to lately, then ask who they talk to a lot.",
    modelLines: ["אתמול דיברתי עם חבר. עם מי אתה מדבר הרבה?"],
  },
  {
    id: "like_doing",
    level: "beginner",
    hint: "Two simple things you like to do, then ask what they like to do.",
    modelLines: ["אני אוהב ללכת ולשמוע מוזיקה. מה אתה אוהב לעשות?"],
  },
  {
    id: "ate_today",
    level: "beginner",
    hint: "What you ate today, then ask what they ate today.",
    modelLines: ["היום אכלתי ארוחה פשוטה. מה אכלת היום?"],
    interestHints: ["food", "אוכל"],
  },
  {
    id: "day_shape",
    level: "beginner",
    hint: "A small picture of your day, then ask them to tell about their day.",
    modelLines: ["היום עבדתי ואחר כך נחתי. ספר לי על היום שלך."],
  },
  {
    id: "near_home",
    level: "beginner",
    hint: "One thing near your home, then ask what is near theirs.",
    modelLines: ["ליד הבית יש פארק. מה יש ליד הבית שלך?"],
  },
  {
    id: "after_work",
    level: "beginner",
    hint: "What you do after work or study, then ask what they do after.",
    modelLines: ["אחרי העבודה אני הולך הביתה. מה אתה עושה אחרי העבודה או הלימודים?"],
  },
  {
    id: "pets_home",
    level: "beginner",
    hint: "Whether you have an animal at home, then ask about animals or home life. Open, not cat-or-dog.",
    modelLines: ["אין לי חיה בבית, אבל אני אוהב שקט בבית. ספר לי על הבית שלך."],
    interestHints: ["dog", "cat", "pet", "כלב", "חתול"],
  },
  {
    id: "rest_time",
    level: "beginner",
    hint: "When you rest, then ask how they like to rest.",
    modelLines: ["אחרי הצהריים אני אוהב לנוח. איך אתה אוהב לנוח?"],
  },
];

const INTERMEDIATE_SPARKS: ConversationSpark[] = [
  {
    id: "yesterday_bit",
    level: "intermediate",
    hint: "Tell one thing from yesterday, then ask them to tell what they did yesterday.",
    modelLines: ["אתמול הלכתי לטייל אחרי העבודה. מה עשית אתמול?"],
  },
  {
    id: "weekend_plans",
    level: "intermediate",
    hint: "Your weekend, then ask them to describe theirs.",
    modelLines: ["בסוף השבוע אני נח וגם קצת מבשל. איך נראה סוף השבוע שלך?"],
  },
  {
    id: "favorite_food_why",
    level: "intermediate",
    hint: "A food you like and why, then ask what they like and why.",
    modelLines: ["אני אוהב חומוס כי זה פשוט וטעים. מה אתה אוהב לאכול, ולמה?"],
    interestHints: ["food", "cook", "אוכל"],
  },
  {
    id: "work_or_study_day",
    level: "intermediate",
    hint: "A slice of a typical work or study day, then ask them to describe theirs.",
    modelLines: ["בבוקר אני עובד מהבית, ואחר כך יש לי פגישות. איך נראה יום רגיל אצלך?"],
  },
  {
    id: "neighborhood",
    level: "intermediate",
    hint: "Something you like near home, then ask them to tell about their neighborhood.",
    modelLines: ["ליד הבית יש פארק שאני אוהב. ספר לי על השכונה שלך."],
  },
  {
    id: "last_trip",
    level: "intermediate",
    hint: "A recent trip or visit, then ask them to tell about a place they went.",
    modelLines: ["לאחרונה נסעתי לצפון ליום אחד. לאן נסעת לאחרונה, ומה עשית שם?"],
    interestHints: ["travel", "trip", "טיול"],
  },
  {
    id: "show_or_podcast",
    level: "intermediate",
    hint: "What you watch or listen to lately, then ask them to tell about something they like.",
    modelLines: ["בערב אני רואה סדרה קצרה. מה אתה רואה או שומע עכשיו?"],
    interestHints: ["film", "movie", "music", "series"],
  },
  {
    id: "cooking_at_home",
    level: "intermediate",
    hint: "What you cooked this week, then ask what they cook or eat at home.",
    modelLines: ["השבוע בישלתי פסטה בבית. מה אתה אוכל או מבשל השבוע?"],
    interestHints: ["cook", "food", "בישול"],
  },
  {
    id: "friends_this_week",
    level: "intermediate",
    hint: "Someone you talked to this week, then ask about their people this week.",
    modelLines: ["השבוע דיברתי עם חבר אחרי הרבה זמן. עם מי נפגשת או דיברת השבוע?"],
  },
  {
    id: "hobby_time",
    level: "intermediate",
    hint: "What you do with free time, then ask them to tell how they spend free time.",
    modelLines: ["כשיש לי זמן אני הולך ללכת בחוץ. מה אתה עושה כשיש לך זמן?"],
  },
  {
    id: "weather_week",
    level: "intermediate",
    hint: "This week's weather and how it changed your days, then ask about theirs.",
    modelLines: ["השבוע היה חם, אז יצאתי פחות. איך מזג האוויר משפיע על השבוע שלך?"],
  },
  {
    id: "small_win",
    level: "intermediate",
    hint: "One small good thing from today, then ask them to tell a small good thing.",
    modelLines: ["היום היה לי בוקר שקט עם קפה. מה היה דבר טוב אצלך היום או השבוע?"],
  },
];

const ADVANCED_SPARKS: ConversationSpark[] = [
  {
    id: "city_opinion",
    level: "advanced",
    hint: "An opinion about a city, then ask them to talk about theirs.",
    modelLines: ["אני חושב שתל אביב רועשת אבל חיה. מה אתה אומר על העיר שלך?"],
  },
  {
    id: "learning_hebrew",
    level: "advanced",
    hint: "What is hard or fun about speaking Hebrew lately, then ask them to talk about their learning.",
    modelLines: ["לדבר זה עדיין החלק הקשה בשבילי, אבל כיף. מה קשה או כיף לך עכשיו בעברית?"],
  },
  {
    id: "culture_compare",
    level: "advanced",
    hint: "One everyday difference between places, then invite their comparison.",
    modelLines: ["אצלנו אוכלים ארוחת צהריים מאוחר. איך נראה יום רגיל אצלך לעומת זה?"],
  },
  {
    id: "work_challenge",
    level: "advanced",
    hint: "A current work or study stretch, then ask what is going on for them.",
    modelLines: ["השבוע יש לי הרבה פגישות ואני קצת עייף. מה קורה אצלך בעבודה או בלימודים?"],
  },
  {
    id: "travel_story",
    level: "advanced",
    hint: "A place you want to go or went, then ask them to tell a short travel story.",
    modelLines: ["אני רוצה לנסוע לצפון לשבת. ספר לי על מקום שנסעת אליו, או מקום שאתה רוצה."],
    interestHints: ["travel", "trip"],
  },
  {
    id: "food_culture",
    level: "advanced",
    hint: "A food you miss or discovered, then ask them to talk about food from home or here.",
    modelLines: ["אני מתגעגע לאוכל פשוט מהבית. איזה אוכל חשוב לך, ולמה?"],
    interestHints: ["food", "cook"],
  },
  {
    id: "weekend_reflection",
    level: "advanced",
    hint: "Was the last weekend restful or busy, and why — then ask them to tell theirs.",
    modelLines: ["סוף השבוע היה שקט אצלי, בלי תוכניות. איך היה סוף השבוע שלך?"],
  },
  {
    id: "advice_tiny",
    level: "advanced",
    hint: "Tiny advice for a new Hebrew speaker, then ask what they would say.",
    modelLines: ["אני אומר: לדבר כל יום קצת, גם אם זה פשוט. מה אתה היית אומר למי שמתחיל?"],
  },
];

const SPARKS_BY_LEVEL: Record<SpeakLevel, ConversationSpark[]> = {
  beginner: BEGINNER_SPARKS,
  intermediate: INTERMEDIATE_SPARKS,
  advanced: ADVANCED_SPARKS,
};

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function matchesInterests(spark: ConversationSpark, interests: string): boolean {
  if (!spark.interestHints?.length || !interests.trim()) return false;
  const haystack = interests.toLowerCase();
  return spark.interestHints.some((hint) => haystack.includes(hint.toLowerCase()));
}

export function rememberRecentTopic(
  existing: string[],
  id: string,
  max = SPEAK_RECENT_TOPICS_MAX
): string[] {
  return [id, ...existing.filter((topic) => topic !== id)].slice(0, max);
}

export function pickConversationSparks(
  level: SpeakLevel,
  recentTopicIds: string[],
  interests?: string
): PickedConversationSparks {
  const pool = SPARKS_BY_LEVEL[level];
  const recent = new Set(recentTopicIds);
  const fresh = pool.filter((spark) => !recent.has(spark.id));
  const eligible = fresh.length > 0 ? fresh : pool;

  const preferred = interests
    ? eligible.filter((spark) => matchesInterests(spark, interests))
    : [];

  const primary = preferred.length > 0 ? pickRandom(preferred) : pickRandom(eligible);
  const rest = eligible.filter((spark) => spark.id !== primary.id);
  const backups = rest.slice().sort(() => Math.random() - 0.5).slice(0, 2);

  return { primary, backups };
}

function formatOneSpark(spark: ConversationSpark): string {
  return `${spark.id} — ${spark.hint} Model: ${spark.modelLines.join(" · ")}`;
}

export function formatSparkGuidance(picked: PickedConversationSparks): string {
  const backupLines =
    picked.backups.length > 0
      ? picked.backups.map((spark) => `- ${formatOneSpark(spark)}`).join("\n")
      : "- Invent a different open everyday question (מה / איך / ספר), not a this-or-that.";

  return `Today's spark is a starting hook, not a script. Follow the learner if they change subject.
Ask an OPEN question that invites a short sentence or two (מה, איך, ספר לי). Do not ask A-or-B or yes/no as the main question.
Primary: ${formatOneSpark(picked.primary)}
If they skip or the topic dies, use a different spark:
${backupLines}`;
}
