export const QUOTES = [
  {
    text: "Discipline is choosing between what you want now and what you want most.",
    author: "Abraham Lincoln",
  },
  {
    text: "The successful warrior is the average man, with laser-like focus.",
    author: "Bruce Lee",
  },
  {
    text: "You do not rise to the level of your goals. You fall to the level of your systems.",
    author: "James Clear",
  },
  {
    text: "We are what we repeatedly do. Excellence, then, is not an act but a habit.",
    author: "Aristotle",
  },
  {
    text: "The two most important days in your life are the day you are born and the day you find out why.",
    author: "Mark Twain",
  },
  {
    text: "Do the hard jobs first. The easy jobs will take care of themselves.",
    author: "Dale Carnegie",
  },
  {
    text: "Confidence is not 'they will like me'. Confidence is 'I'll be fine if they don't'.",
    author: "Christina Grimmie",
  },
  { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
  {
    text: "A person who never made a mistake never tried anything new.",
    author: "Albert Einstein",
  },
  {
    text: "The best time to plant a tree was 20 years ago. The second best time is now.",
    author: "Chinese Proverb",
  },
  { text: "Lead by example. It's the only way you can lead.", author: "Anonymous" },
  { text: "You are the average of the five people you spend most time with.", author: "Jim Rohn" },
  { text: "Be so good they can't ignore you.", author: "Steve Martin" },
  { text: "Motivation gets you started. Habit keeps you going.", author: "Jim Ryun" },
];

export const CHALLENGES = [
  "Talk to one new person today.",
  "Practice English aloud for five minutes.",
  "Ask one thoughtful question in a meeting or class.",
  "Introduce yourself confidently to someone.",
  "Give a genuine compliment to a stranger.",
  "Share an idea publicly — a comment, a post, or aloud.",
  "Make eye contact and smile at three people.",
  "Say 'no' to one request that doesn't align with your priorities.",
  "Reach out to reconnect with someone you admire.",
  "Present or explain something you know to another person.",
  "Order or ask for something in a language you're learning.",
  "Speak up first when a question is asked in a group.",
  "Stand tall and take a deep breath before entering any room today.",
  "Ask for feedback on something you're working on.",
];

export const MISSIONS = [
  "Show up before you feel ready.",
  "Do the hardest thing first — earn the rest of the day.",
  "Speak with intention. Listen with presence.",
  "Choose the harder right over the easier wrong.",
  "Move your body. Steady your mind.",
  "Finish what you started before starting something new.",
  "Be the calmest person in every room you enter.",
  "Do one thing today your future self will thank you for.",
  "Compete only with who you were yesterday.",
  "Leave every space better than you found it.",
  "Keep your word — especially the ones you gave yourself.",
  "Master a small skill for twenty focused minutes.",
  "Say less. Mean more.",
  "Lead by example, even when no one is watching.",
];

// Deterministic daily index from date string YYYY-MM-DD
export function dayIndex(dateStr: string): number {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
  return h;
}

export function quoteOfDay(dateStr: string) {
  return QUOTES[dayIndex(dateStr) % QUOTES.length];
}
export function challengeOfDay(dateStr: string) {
  return CHALLENGES[dayIndex(dateStr) % CHALLENGES.length];
}
export function missionOfDay(dateStr: string) {
  return MISSIONS[dayIndex(dateStr) % MISSIONS.length];
}

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatLongDate(d = new Date()) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}
