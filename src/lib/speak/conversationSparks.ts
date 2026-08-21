import type { SpeakLevel } from "./types";
import { SPEAK_RECENT_TOPICS_MAX } from "./types";

export type ConversationSpark = {
  id: string;
  level: SpeakLevel;
  hint: string;
  modelLines: string[];
  followUps: string[];
  longTurn: string;
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
    followUps: [
      "React, then ask when they drink it or with whom.",
      "Ask them to add one word about it (hot, strong, with milk).",
    ],
    longTurn: "Invite 2–3 short sentences about their whole morning. Wait. Do not add another question.",
    interestHints: ["coffee", "tea", "קפה"],
  },
  {
    id: "today_weather",
    level: "beginner",
    hint: "Say how the weather is where you are, then ask how it is where they are.",
    modelLines: ["אצלי היום חם ויש שמש. איך מזג האוויר אצלך?"],
    followUps: [
      "React, then ask what they like to do in this weather.",
      "Ask how the weather was yesterday, in one short sentence.",
    ],
    longTurn: "Invite them to describe today outside in 2–3 short sentences. Wait.",
  },
  {
    id: "this_morning",
    level: "beginner",
    hint: "Tell one thing from your morning, then ask what they did this morning.",
    modelLines: ["הבוקר אכלתי לחם ושתיתי קפה. מה עשית הבוקר?"],
    followUps: [
      "React, then ask what they did after that.",
      "Ask how they felt this morning.",
    ],
    longTurn: "Invite them to tell the morning from start to now in 2–3 short sentences. Wait.",
  },
  {
    id: "tonight_plans",
    level: "beginner",
    hint: "Say your evening plan, then ask what they are doing tonight.",
    modelLines: ["הערב אני נשאר בבית. מה אתה עושה הערב?"],
    followUps: [
      "React, then ask who they will be with, or if they will be alone.",
      "Ask what they like to do at home in the evening.",
    ],
    longTurn: "Invite them to describe a typical evening in 2–3 short sentences. Wait.",
  },
  {
    id: "favorite_food",
    level: "beginner",
    hint: "Name a food you like, then ask what they like to eat and a little why if they can.",
    modelLines: ["אני אוהב שקשוקה. מה אתה אוהב לאכול?"],
    followUps: [
      "React, then ask when they eat it or who makes it.",
      "Ask them to say one more food they like, and one they don't.",
    ],
    longTurn: "Invite them to talk about food at home in 2–3 short sentences. Wait.",
    interestHints: ["food", "cook", "אוכל"],
  },
  {
    id: "music_listen",
    level: "beginner",
    hint: "Say when you listen to music, then ask what music they like.",
    modelLines: ["בערב אני שומע מוזיקה. איזו מוזיקה אתה אוהב?"],
    followUps: [
      "React, then ask when they listen (morning, work, evening).",
      "Ask if they like to sing, or just listen.",
    ],
    longTurn: "Invite them to tell about music in their day in 2–3 short sentences. Wait.",
    interestHints: ["music", "song", "מוזיקה"],
  },
  {
    id: "saturday",
    level: "beginner",
    hint: "Say what you do on Saturday, then ask how their Saturday looks.",
    modelLines: ["בשבת אני נח בבית. מה אתה עושה בשבת?"],
    followUps: [
      "React, then ask if they go out or stay home.",
      "Ask what they like most about Saturday.",
    ],
    longTurn: "Invite them to describe last Saturday from morning to evening in 2–3 short sentences. Wait.",
  },
  {
    id: "where_today",
    level: "beginner",
    hint: "Say where you are today and what you are doing, then ask about their day.",
    modelLines: ["היום אני בבית ועובד קצת. איפה אתה היום ומה אתה עושה?"],
    followUps: [
      "React, then ask what they did before this call.",
      "Ask what they will do after the call.",
    ],
    longTurn: "Invite them to tell their day so far in 2–3 short sentences. Wait.",
  },
  {
    id: "work_study_today",
    level: "beginner",
    hint: "One sentence about work or study today, then ask what their day looks like.",
    modelLines: ["היום יש לי עבודה בבית. מה אתה עושה היום?"],
    followUps: [
      "React, then ask if the day is busy or quiet.",
      "Ask what they do after work or study.",
    ],
    longTurn: "Invite them to describe a usual work or study day in 2–3 short sentences. Wait.",
  },
  {
    id: "outside",
    level: "beginner",
    hint: "Say something you like to do outside, then ask what they like to do outside.",
    modelLines: ["אחרי הצהריים אני אוהב ללכת. מה אתה אוהב לעשות בחוץ?"],
    followUps: [
      "React, then ask where they like to go.",
      "Ask who they go with, or if they go alone.",
    ],
    longTurn: "Invite them to tell about a time they were outside this week in 2–3 short sentences. Wait.",
  },
  {
    id: "how_today",
    level: "beginner",
    hint: "Say how you feel today in one sentence, then ask how their day is going.",
    modelLines: ["היום אני קצת עייף אבל בסדר. איך היום שלך?"],
    followUps: [
      "React, then ask why — one reason is enough.",
      "Ask what would make the day nicer.",
    ],
    longTurn: "Invite them to tell about today from morning until now in 2–3 short sentences. Wait.",
  },
  {
    id: "breakfast",
    level: "beginner",
    hint: "Model a simple breakfast, then ask what they eat in the morning.",
    modelLines: ["בבוקר אני אוכל לחם עם גבינה. מה אתה אוכל בבוקר?"],
    followUps: [
      "React, then ask if they eat at home or outside.",
      "Ask what they drink with breakfast.",
    ],
    longTurn: "Invite them to describe a full morning meal in 2–3 short sentences. Wait.",
  },
  {
    id: "your_place",
    level: "beginner",
    hint: "Say one thing about where you live, then invite them to tell a little about their place.",
    modelLines: ["אני גר בעיר ליד הים. ספר לי קצת על המקום שלך."],
    followUps: [
      "React, then ask what is near the house (park, shop, sea).",
      "Ask if they like living there, and why in one word or two.",
    ],
    longTurn: "Invite them to describe their place in 2–3 short sentences. Wait.",
  },
  {
    id: "home_food",
    level: "beginner",
    hint: "What you cook or eat at home, then ask what they eat at home.",
    modelLines: ["בבית אני מבשל פסטה. מה אתה אוכל בבית?"],
    followUps: [
      "React, then ask who cooks.",
      "Ask what they ate yesterday at home.",
    ],
    longTurn: "Invite them to tell about cooking or eating at home this week in 2–3 short sentences. Wait.",
    interestHints: ["cook", "cooking", "food", "בישול"],
  },
  {
    id: "when_hot",
    level: "beginner",
    hint: "What you like when it is hot, then ask what they like to do when it is hot.",
    modelLines: ["כשחם אני אוהב את הים. מה אתה אוהב לעשות כשחם?"],
    followUps: [
      "React, then ask what they do when it is cold.",
      "Ask what they drink when it is hot.",
    ],
    longTurn: "Invite them to tell about a hot day they remember in 2–3 short sentences. Wait.",
    interestHints: ["sea", "beach", "swim", "ים"],
  },
  {
    id: "evening_habit",
    level: "beginner",
    hint: "Your evening habit, then ask what they do in the evening.",
    modelLines: ["בערב אני רואה משהו קצר. מה אתה עושה בערב?"],
    followUps: [
      "React, then ask until what time they stay up.",
      "Ask what they did last evening.",
    ],
    longTurn: "Invite them to tell last evening from dinner to bed in 2–3 short sentences. Wait.",
    interestHints: ["film", "movie", "series", "סרט"],
  },
  {
    id: "people",
    level: "beginner",
    hint: "Who you talked to lately, then ask who they talk to a lot.",
    modelLines: ["אתמול דיברתי עם חבר. עם מי אתה מדבר הרבה?"],
    followUps: [
      "React, then ask what they talk about, simply.",
      "Ask when they last met someone in person.",
    ],
    longTurn: "Invite them to tell about a person they like in 2–3 short sentences. Wait.",
  },
  {
    id: "like_doing",
    level: "beginner",
    hint: "Two simple things you like to do, then ask what they like to do.",
    modelLines: ["אני אוהב ללכת ולשמוע מוזיקה. מה אתה אוהב לעשות?"],
    followUps: [
      "React, then ask when they last did it.",
      "Ask them to add one more thing they like.",
    ],
    longTurn: "Invite them to talk about a free day and what they do in 2–3 short sentences. Wait.",
  },
  {
    id: "ate_today",
    level: "beginner",
    hint: "What you ate today, then ask what they ate today.",
    modelLines: ["היום אכלתי ארוחה פשוטה. מה אכלת היום?"],
    followUps: [
      "React, then ask where they ate.",
      "Ask what they will eat later.",
    ],
    longTurn: "Invite them to tell all the meals today in 2–3 short sentences. Wait.",
    interestHints: ["food", "אוכל"],
  },
  {
    id: "day_shape",
    level: "beginner",
    hint: "A small picture of your day, then ask them to tell about their day.",
    modelLines: ["היום עבדתי ואחר כך נחתי. ספר לי על היום שלך."],
    followUps: [
      "React, then ask what was the best small part of the day.",
      "Ask what is still left today.",
    ],
    longTurn: "Invite them to tell the day in order (morning, then, then) in 2–3 short sentences. Wait.",
  },
  {
    id: "near_home",
    level: "beginner",
    hint: "One thing near your home, then ask what is near theirs.",
    modelLines: ["ליד הבית יש פארק. מה יש ליד הבית שלך?"],
    followUps: [
      "React, then ask if they go there often.",
      "Ask what they hear or see from home.",
    ],
    longTurn: "Invite them to describe the area around home in 2–3 short sentences. Wait.",
  },
  {
    id: "after_work",
    level: "beginner",
    hint: "What you do after work or study, then ask what they do after.",
    modelLines: ["אחרי העבודה אני הולך הביתה. מה אתה עושה אחרי העבודה או הלימודים?"],
    followUps: [
      "React, then ask if they are tired then.",
      "Ask what they eat after work or study.",
    ],
    longTurn: "Invite them to tell yesterday after work or study in 2–3 short sentences. Wait.",
  },
  {
    id: "pets_home",
    level: "beginner",
    hint: "Whether you have an animal at home, then ask about animals or home life. Open, not cat-or-dog.",
    modelLines: ["אין לי חיה בבית, אבל אני אוהב שקט בבית. ספר לי על הבית שלך."],
    followUps: [
      "React, then ask who lives with them, simply.",
      "Ask what they like at home.",
    ],
    longTurn: "Invite them to describe home life in 2–3 short sentences. Wait.",
    interestHints: ["dog", "cat", "pet", "כלב", "חתול"],
  },
  {
    id: "rest_time",
    level: "beginner",
    hint: "When you rest, then ask how they like to rest.",
    modelLines: ["אחרי הצהריים אני אוהב לנוח. איך אתה אוהב לנוח?"],
    followUps: [
      "React, then ask how long they rest.",
      "Ask what they do when they cannot rest.",
    ],
    longTurn: "Invite them to tell how they rest on a free day in 2–3 short sentences. Wait.",
  },
  {
    id: "yesterday_tiny",
    level: "beginner",
    hint: "One thing from yesterday, then ask them to tell about yesterday.",
    modelLines: ["אתמול הלכתי קצת בחוץ. מה עשית אתמול?"],
    followUps: [
      "React, then ask what they did in the evening yesterday.",
      "Ask if yesterday was good, and why in a few words.",
    ],
    longTurn: "Invite them to tell yesterday from morning to night in 2–3 short sentences. Wait.",
  },
  {
    id: "favorite_place",
    level: "beginner",
    hint: "A place you like, then ask them about a place they like.",
    modelLines: ["אני אוהב מקום שקט ליד הבית. איזה מקום אתה אוהב?"],
    followUps: [
      "React, then ask when they go there.",
      "Ask what they do there.",
    ],
    longTurn: "Invite them to describe that place in 2–3 short sentences. Wait.",
  },
];

const INTERMEDIATE_SPARKS: ConversationSpark[] = [
  {
    id: "yesterday_bit",
    level: "intermediate",
    hint: "Tell one thing from yesterday, then ask them to tell what they did yesterday.",
    modelLines: ["אתמול הלכתי לטייל אחרי העבודה. מה עשית אתמול?"],
    followUps: [
      "React, then ask what was unexpected or ordinary about it.",
      "Ask how they felt at the end of the day.",
    ],
    longTurn: "Invite a ~20 second story of yesterday. Wait. Recast lightly after, then continue.",
  },
  {
    id: "weekend_plans",
    level: "intermediate",
    hint: "Your weekend, then ask them to describe theirs.",
    modelLines: ["בסוף השבוע אני נח וגם קצת מבשל. איך נראה סוף השבוע שלך?"],
    followUps: [
      "React, then ask what they look forward to, or what already happened.",
      "Ask how this weekend compares to last weekend.",
    ],
    longTurn: "Invite them to walk through Saturday or Sunday in a short story. Wait.",
  },
  {
    id: "favorite_food_why",
    level: "intermediate",
    hint: "A food you like and why, then ask what they like and why.",
    modelLines: ["אני אוהב חומוס כי זה פשוט וטעים. מה אתה אוהב לאכול, ולמה?"],
    followUps: [
      "React, then ask about a food from home or from here.",
      "Ask when they last ate it, and with whom.",
    ],
    longTurn: "Invite them to tell about a meal they remember in a few sentences. Wait.",
    interestHints: ["food", "cook", "אוכל"],
  },
  {
    id: "work_or_study_day",
    level: "intermediate",
    hint: "A slice of a typical work or study day, then ask them to describe theirs.",
    modelLines: ["בבוקר אני עובד מהבית, ואחר כך יש לי פגישות. איך נראה יום רגיל אצלך?"],
    followUps: [
      "React, then ask what part of the day they like more.",
      "Ask what is hard this week, simply.",
    ],
    longTurn: "Invite them to describe a full typical day in a short story. Wait.",
  },
  {
    id: "neighborhood",
    level: "intermediate",
    hint: "Something you like near home, then ask them to tell about their neighborhood.",
    modelLines: ["ליד הבית יש פארק שאני אוהב. ספר לי על השכונה שלך."],
    followUps: [
      "React, then ask what they would change there.",
      "Ask where they go when they want quiet or noise.",
    ],
    longTurn: "Invite them to take you on a short walk around their neighborhood in Hebrew. Wait.",
  },
  {
    id: "last_trip",
    level: "intermediate",
    hint: "A recent trip or visit, then ask them to tell about a place they went.",
    modelLines: ["לאחרונה נסעתי לצפון ליום אחד. לאן נסעת לאחרונה, ומה עשית שם?"],
    followUps: [
      "React, then ask what they ate or saw.",
      "Ask if they want to go back, and why.",
    ],
    longTurn: "Invite a short travel story (~20 seconds). Wait.",
    interestHints: ["travel", "trip", "טיול"],
  },
  {
    id: "show_or_podcast",
    level: "intermediate",
    hint: "What you watch or listen to lately, then ask them to tell about something they like.",
    modelLines: ["בערב אני רואה סדרה קצרה. מה אתה רואה או שומע עכשיו?"],
    followUps: [
      "React, then ask why they like it, in simple words.",
      "Ask when they usually watch or listen.",
    ],
    longTurn: "Invite them to summarize one episode or song in a few sentences. Wait.",
    interestHints: ["film", "movie", "music", "series"],
  },
  {
    id: "cooking_at_home",
    level: "intermediate",
    hint: "What you cooked this week, then ask what they cook or eat at home.",
    modelLines: ["השבוע בישלתי פסטה בבית. מה אתה אוכל או מבשל השבוע?"],
    followUps: [
      "React, then ask if they like cooking or not, and why.",
      "Ask about a dish from their family or country.",
    ],
    longTurn: "Invite them to explain how they make something simple, step by step. Wait.",
    interestHints: ["cook", "food", "בישול"],
  },
  {
    id: "friends_this_week",
    level: "intermediate",
    hint: "Someone you talked to this week, then ask about their people this week.",
    modelLines: ["השבוע דיברתי עם חבר אחרי הרבה זמן. עם מי נפגשת או דיברת השבוע?"],
    followUps: [
      "React, then ask what you talked about, simply.",
      "Ask who they miss or want to see.",
    ],
    longTurn: "Invite them to tell about a friend in a few sentences. Wait.",
  },
  {
    id: "hobby_time",
    level: "intermediate",
    hint: "What you do with free time, then ask them to tell how they spend free time.",
    modelLines: ["כשיש לי זמן אני הולך ללכת בחוץ. מה אתה עושה כשיש לך זמן?"],
    followUps: [
      "React, then ask how they started liking it.",
      "Ask what they wish they had more time for.",
    ],
    longTurn: "Invite them to tell about a recent free afternoon in a short story. Wait.",
  },
  {
    id: "weather_week",
    level: "intermediate",
    hint: "This week's weather and how it changed your days, then ask about theirs.",
    modelLines: ["השבוע היה חם, אז יצאתי פחות. איך מזג האוויר משפיע על השבוע שלך?"],
    followUps: [
      "React, then ask what they do when the weather is like that.",
      "Ask which season they like, and why.",
    ],
    longTurn: "Invite them to compare two days this week because of the weather. Wait.",
  },
  {
    id: "small_win",
    level: "intermediate",
    hint: "One small good thing from today, then ask them to tell a small good thing.",
    modelLines: ["היום היה לי בוקר שקט עם קפה. מה היה דבר טוב אצלך היום או השבוע?"],
    followUps: [
      "React, then ask what made it good.",
      "Ask if something was hard too, briefly.",
    ],
    longTurn: "Invite them to tell the story of that small good thing. Wait.",
  },
  {
    id: "tell_a_day",
    level: "intermediate",
    hint: "Ask them to tell one full day from this week, after you model a short version.",
    modelLines: ["שלשום קמתי מוקדם, עבדתי, ובערב נחתי. ספר לי על יום אחד השבוע."],
    followUps: [
      "React, then ask what they would do differently.",
      "Ask what they are doing tomorrow.",
    ],
    longTurn: "If they were brief, invite them to add morning, afternoon, and evening. Wait.",
  },
];

const ADVANCED_SPARKS: ConversationSpark[] = [
  {
    id: "city_opinion",
    level: "advanced",
    hint: "An opinion about a city, then ask them to talk about theirs.",
    modelLines: ["אני חושב שתל אביב רועשת אבל חיה. מה אתה אומר על העיר שלך?"],
    followUps: [
      "React, then ask what they would keep and what they would change.",
      "Ask how it feels different from another place they know.",
    ],
    longTurn: "Invite a short opinion (why they like or don't like living there). Wait.",
  },
  {
    id: "learning_hebrew",
    level: "advanced",
    hint: "What is hard or fun about speaking Hebrew lately, then ask them to talk about their learning.",
    modelLines: ["לדבר זה עדיין החלק הקשה בשבילי, אבל כיף. מה קשה או כיף לך עכשיו בעברית?"],
    followUps: [
      "React, then ask what they do when they don't know a word.",
      "Ask where they feel progress.",
    ],
    longTurn: "Invite them to tell a short story of a time they used Hebrew outside this app. Wait.",
  },
  {
    id: "culture_compare",
    level: "advanced",
    hint: "One everyday difference between places, then invite their comparison.",
    modelLines: ["אצלנו אוכלים ארוחת צהריים מאוחר. איך נראה יום רגיל אצלך לעומת זה?"],
    followUps: [
      "React, then ask what surprised them here or there.",
      "Ask what they miss from home, simply.",
    ],
    longTurn: "Invite a short comparison of two ordinary days in two places. Wait.",
  },
  {
    id: "work_challenge",
    level: "advanced",
    hint: "A current work or study stretch, then ask what is going on for them.",
    modelLines: ["השבוע יש לי הרבה פגישות ואני קצת עייף. מה קורה אצלך בעבודה או בלימודים?"],
    followUps: [
      "React, then ask how they handle a busy week.",
      "Ask what they want next month to look like.",
    ],
    longTurn: "Invite them to tell the story of this week at work or study. Wait.",
  },
  {
    id: "travel_story",
    level: "advanced",
    hint: "A place you want to go or went, then ask them to tell a short travel story.",
    modelLines: ["אני רוצה לנסוע לצפון לשבת. ספר לי על מקום שנסעת אליו, או מקום שאתה רוצה."],
    followUps: [
      "React, then ask what they would do there for one day.",
      "Ask what kind of trip they like, and why.",
    ],
    longTurn: "Invite a travel story with a beginning, middle, and end. Wait.",
    interestHints: ["travel", "trip"],
  },
  {
    id: "food_culture",
    level: "advanced",
    hint: "A food you miss or discovered, then ask them to talk about food from home or here.",
    modelLines: ["אני מתגעגע לאוכל פשוט מהבית. איזה אוכל חשוב לך, ולמה?"],
    followUps: [
      "React, then ask who they eat it with.",
      "Ask how food here is different, in their view.",
    ],
    longTurn: "Invite them to describe a meal that means something to them. Wait.",
    interestHints: ["food", "cook"],
  },
  {
    id: "weekend_reflection",
    level: "advanced",
    hint: "Was the last weekend restful or busy, and why — then ask them to tell theirs.",
    modelLines: ["סוף השבוע היה שקט אצלי, בלי תוכניות. איך היה סוף השבוע שלך?"],
    followUps: [
      "React, then ask what they needed more of — rest or people.",
      "Ask what they want next weekend to be like.",
    ],
    longTurn: "Invite them to tell last weekend as a short story. Wait.",
  },
  {
    id: "advice_tiny",
    level: "advanced",
    hint: "Tiny advice for a new Hebrew speaker, then ask what they would say.",
    modelLines: ["אני אומר: לדבר כל יום קצת, גם אם זה פשוט. מה אתה היית אומר למי שמתחיל?"],
    followUps: [
      "React, then ask what didn't work for them.",
      "Ask what they wish they had started earlier.",
    ],
    longTurn: "Invite them to give advice as if talking to a friend, in a few sentences. Wait.",
  },
  {
    id: "describe_someone",
    level: "advanced",
    hint: "Describe someone you spoke with lately, then ask them to describe a person in their life.",
    modelLines: ["יש לי חבר שמדבר לאט וזה עוזר לי. ספר לי על מישהו בחיים שלך."],
    followUps: [
      "React, then ask how they met.",
      "Ask what they like doing together.",
    ],
    longTurn: "Invite a short portrait of that person. Wait.",
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
  const follow = spark.followUps.map((item) => `    · ${item}`).join("\n");
  return `${spark.id} — ${spark.hint}
  Model: ${spark.modelLines.join(" · ")}
  Follow-ups (use after they answer; stay on this topic):
${follow}
  Longer turn (use once this session, then wait): ${spark.longTurn}`;
}

export function formatSparkGuidance(picked: PickedConversationSparks): string {
  const backupLines =
    picked.backups.length > 0
      ? picked.backups.map((spark) => `- ${formatOneSpark(spark)}`).join("\n")
      : "- Invent a different open everyday question (מה / איך / ספר), not a this-or-that.";

  return `Today's spark is a starting hook, not a script. Stay on it for several turns. Follow the learner if they change subject.
Ask an OPEN question that invites a sentence or two (מה, איך, ספר לי). Do not ask A-or-B or yes/no as the main question.
After they answer: react in one short Hebrew sentence, recast if needed, then use a follow-up from the ladder. Do not jump to a new spark after one exchange.
Primary:
${formatOneSpark(picked.primary)}
If they skip or the topic is truly finished, use a different spark:
${backupLines}`;
}
