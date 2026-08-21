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
    id: "tea_or_coffee",
    level: "beginner",
    hint: "This-or-that: tea or coffee. Model your own choice, then ask.",
    modelLines: ["אני שותה קפה. תה או קפה?"],
    interestHints: ["coffee", "tea", "café", "cafe", "קפה", "תה"],
  },
  {
    id: "home_or_out",
    level: "beginner",
    hint: "This-or-that: at home or outside today.",
    modelLines: ["אני בבית היום. בבית או בחוץ?"],
  },
  {
    id: "morning_or_night",
    level: "beginner",
    hint: "This-or-that: morning person or night person.",
    modelLines: ["אני אוהב בוקר. בוקר או לילה?"],
  },
  {
    id: "sun_or_rain",
    level: "beginner",
    hint: "This-or-that: sun or rain. Tie it to today if easy.",
    modelLines: ["היום יש שמש. שמש או גשם?"],
  },
  {
    id: "sweet_or_salty",
    level: "beginner",
    hint: "This-or-that: sweet or salty food.",
    modelLines: ["אני אוהב מתוק. מתוק או מלוח?"],
  },
  {
    id: "water_or_juice",
    level: "beginner",
    hint: "This-or-that: water or juice.",
    modelLines: ["אני שותה מים. מים או מיץ?"],
  },
  {
    id: "pizza_or_pasta",
    level: "beginner",
    hint: "This-or-that: pizza or pasta.",
    modelLines: ["אני אוהב פיצה. פיצה או פסטה?"],
    interestHints: ["food", "pizza", "pasta", "cooking", "אוכל"],
  },
  {
    id: "cats_or_dogs",
    level: "beginner",
    hint: "This-or-that: cats or dogs. Keep it light; they can say neither.",
    modelLines: ["אני אוהב כלבים. חתול או כלב?"],
    interestHints: ["dog", "cat", "pet", "כלב", "חתול"],
  },
  {
    id: "morning_drink",
    level: "beginner",
    hint: "What they drink in the morning. Model first.",
    modelLines: ["בבוקר אני שותה קפה. ואתה?"],
    interestHints: ["coffee", "tea", "קפה"],
  },
  {
    id: "hot_or_cold",
    level: "beginner",
    hint: "Weather where they are: hot or cold.",
    modelLines: ["אצלי חם היום. אצלך חם או קר?"],
  },
  {
    id: "sitting_or_walking",
    level: "beginner",
    hint: "Right now: sitting or walking.",
    modelLines: ["אני יושב עכשיו. יושב או הולך?"],
  },
  {
    id: "tired_or_good",
    level: "beginner",
    hint: "How they feel: tired or good.",
    modelLines: ["אני בסדר היום. אתה עייף או בסדר?"],
  },
  {
    id: "like_music",
    level: "beginner",
    hint: "Do they like music. One follow-up at most.",
    modelLines: ["אני אוהב מוזיקה. ואתה?"],
    interestHints: ["music", "song", "מוזיקה"],
  },
  {
    id: "like_walking",
    level: "beginner",
    hint: "Do they like walking.",
    modelLines: ["אני אוהב ללכת. ואתה?"],
  },
  {
    id: "eggs_or_shakshuka",
    level: "beginner",
    hint: "Tiny Israeli everyday: eggs or shakshuka, then and you.",
    modelLines: ["אני אוהב שקשוקה. ביצים או שקשוקה?"],
    interestHints: ["food", "egg", "אוכל"],
  },
  {
    id: "tonight_rest_or_out",
    level: "beginner",
    hint: "Tonight: rest at home or go out.",
    modelLines: ["הערב אני בבית. בבית או בחוץ?"],
  },
  {
    id: "weekend_rest",
    level: "beginner",
    hint: "Saturday: rest or go out.",
    modelLines: ["בשבת אני נח. אתה נח או יוצא?"],
  },
  {
    id: "breakfast",
    level: "beginner",
    hint: "What they eat in the morning. Model a simple food.",
    modelLines: ["בבוקר אני אוכל לחם. ואתה?"],
  },
  {
    id: "like_sea",
    level: "beginner",
    hint: "Do they like the sea.",
    modelLines: ["אני אוהב את הים. ואתה?"],
    interestHints: ["sea", "beach", "swim", "ים"],
  },
  {
    id: "book_or_film",
    level: "beginner",
    hint: "This-or-that: book or film.",
    modelLines: ["אני אוהב סרטים. ספר או סרט?"],
    interestHints: ["book", "film", "movie", "ספר", "סרט"],
  },
  {
    id: "work_or_study_today",
    level: "beginner",
    hint: "Today: work or study. One word is enough.",
    modelLines: ["היום אני עובד. עבודה או לימודים?"],
  },
  {
    id: "like_cooking",
    level: "beginner",
    hint: "Do they like to cook.",
    modelLines: ["אני אוהב לבשל. ואתה?"],
    interestHints: ["cook", "cooking", "food", "בישול"],
  },
  {
    id: "city_walk",
    level: "beginner",
    hint: "Do they like walking in the city.",
    modelLines: ["אני אוהב ללכת בעיר. ואתה?"],
  },
  {
    id: "coffee_today",
    level: "beginner",
    hint: "Did they drink coffee today. Yes/no is enough.",
    modelLines: ["שתיתי קפה היום. ואתה?"],
    interestHints: ["coffee", "קפה"],
  },
];

const INTERMEDIATE_SPARKS: ConversationSpark[] = [
  {
    id: "yesterday_bit",
    level: "intermediate",
    hint: "Ask one thing they did yesterday, then recast and continue.",
    modelLines: ["אתמול הלכתי לטייל. מה עשית אתמול?"],
  },
  {
    id: "weekend_plans",
    level: "intermediate",
    hint: "Weekend plans in one or two sentences.",
    modelLines: ["בסוף השבוע אני נח. מה אתה עושה?"],
  },
  {
    id: "favorite_food_why",
    level: "intermediate",
    hint: "Favorite food and why, keep it short.",
    modelLines: ["אני אוהב חומוס כי זה פשוט. ואתה?"],
    interestHints: ["food", "cook", "אוכל"],
  },
  {
    id: "work_or_study_day",
    level: "intermediate",
    hint: "A typical work or study day, one slice of it.",
    modelLines: ["בבוקר אני עובד מהבית. איך נראה היום שלך?"],
  },
  {
    id: "neighborhood",
    level: "intermediate",
    hint: "Something they like near home.",
    modelLines: ["ליד הבית יש פארק. מה יש אצלך?"],
  },
  {
    id: "last_trip",
    level: "intermediate",
    hint: "A recent trip or visit, even a short one.",
    modelLines: ["לאחרונה נסעתי לצפון. ואתה?"],
    interestHints: ["travel", "trip", "טיול"],
  },
  {
    id: "show_or_podcast",
    level: "intermediate",
    hint: "A show, film, or podcast they like lately.",
    modelLines: ["אני רואה סדרה בערב. ואתה?"],
    interestHints: ["film", "movie", "music", "series"],
  },
  {
    id: "cooking_at_home",
    level: "intermediate",
    hint: "What they cook or eat at home this week.",
    modelLines: ["השבוע בישלתי פסטה. ואתה?"],
    interestHints: ["cook", "food", "בישול"],
  },
  {
    id: "friends_this_week",
    level: "intermediate",
    hint: "Did they see friends this week. Keep it light.",
    modelLines: ["השבוע דיברתי עם חבר. ואתה?"],
  },
  {
    id: "hobby_time",
    level: "intermediate",
    hint: "When they have free time, what they do.",
    modelLines: ["כשיש לי זמן אני הולך ללכת. ואתה?"],
  },
  {
    id: "weather_week",
    level: "intermediate",
    hint: "This week's weather and how it changes their day.",
    modelLines: ["השבוע חם אצלי. אצלך?"],
  },
  {
    id: "small_win",
    level: "intermediate",
    hint: "One small good thing from today or this week.",
    modelLines: ["היום היה לי בוקר טוב. מה היה טוב אצלך?"],
  },
];

const ADVANCED_SPARKS: ConversationSpark[] = [
  {
    id: "city_opinion",
    level: "advanced",
    hint: "An opinion about their city or a city they know.",
    modelLines: ["אני חושב שתל אביב רועשת אבל חיה. מה אתה אומר על העיר שלך?"],
  },
  {
    id: "learning_hebrew",
    level: "advanced",
    hint: "What is hard or fun about speaking Hebrew lately.",
    modelLines: ["לדבר זה החלק הקשה בשבילי. ומה אצלך?"],
  },
  {
    id: "culture_compare",
    level: "advanced",
    hint: "One everyday difference between their place and Israel.",
    modelLines: ["אצלנו אוכלים ארוחת צהריים מאוחר. אצלך?"],
  },
  {
    id: "work_challenge",
    level: "advanced",
    hint: "A current work or study challenge, not a lecture.",
    modelLines: ["השבוע יש לי הרבה פגישות. מה קורה אצלך?"],
  },
  {
    id: "travel_story",
    level: "advanced",
    hint: "A short travel story or a place they want to go.",
    modelLines: ["אני רוצה לנסוע לצפון. לאן אתה רוצה לנסוע?"],
    interestHints: ["travel", "trip"],
  },
  {
    id: "food_culture",
    level: "advanced",
    hint: "A food they miss, or a food they discovered.",
    modelLines: ["אני מתגעגע לאוכל פשוט מהבית. ואתה?"],
    interestHints: ["food", "cook"],
  },
  {
    id: "weekend_reflection",
    level: "advanced",
    hint: "Was the last weekend restful or busy, and why.",
    modelLines: ["סוף השבוע היה שקט אצלי. ומה אצלך?"],
  },
  {
    id: "advice_tiny",
    level: "advanced",
    hint: "One tiny piece of advice they would give a new Hebrew learner.",
    modelLines: ["אני אומר: לדבר כל יום קצת. מה אתה אומר?"],
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
      : "- Invent a different everyday this-or-that; still not a roleplay.";

  return `Today's spark is a starting hook, not a script. Follow the learner if they change subject.
Primary: ${formatOneSpark(picked.primary)}
If they skip or the topic dies, use a different spark:
${backupLines}`;
}
