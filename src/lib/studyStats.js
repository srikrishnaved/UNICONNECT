export const RANKS = [
  { minHours: 100, title: 'Legend',    icon: '👑', color: '#FBBF24', bg: 'rgba(251,191,36,0.18)'   },
  { minHours: 50,  title: 'Sage',      icon: '🔮', color: '#A855F7', bg: 'rgba(168,85,247,0.18)'   },
  { minHours: 20,  title: 'Dedicated', icon: '⚡', color: '#60A5FA', bg: 'rgba(96,165,250,0.18)'   },
  { minHours: 5,   title: 'Scholar',   icon: '📖', color: '#34D399', bg: 'rgba(52,211,153,0.18)'   },
  { minHours: 0,   title: 'Newcomer',  icon: '🌱', color: '#9CA3AF', bg: 'rgba(156,163,175,0.14)'  },
];

export const BADGES = [
  { id: 'century', icon: '👑', label: '100 Hours', hours: 100 },
  { id: 'fifty',   icon: '💎', label: '50 Hours',  hours: 50  },
  { id: 'twenty',  icon: '🌟', label: '25 Hours',  hours: 25  },
  { id: 'ten',     icon: '📚', label: '10 Hours',  hours: 10  },
  { id: 'five',    icon: '⚡', label: '5 Hours',   hours: 5   },
  { id: 'first',   icon: '🔥', label: '1 Hour',    hours: 1   },
];

export function getRank(totalHours) {
  return RANKS.find(r => totalHours >= r.minHours) || RANKS[RANKS.length - 1];
}

export function getEarnedBadges(totalHours) {
  return BADGES.filter(b => totalHours >= b.hours);
}

export const DAY_BADGES = [
  { id: 'days_100', icon: '🎯', label: '100 Days', days: 100 },
  { id: 'days_50',  icon: '🏅', label: '50 Days',  days: 50  },
  { id: 'days_30',  icon: '💪', label: '30 Days',  days: 30  },
  { id: 'days_20',  icon: '🗓️', label: '20 Days',  days: 20  },
  { id: 'days_10',  icon: '🔟', label: '10 Days',  days: 10  },
  { id: 'days_5',   icon: '📅', label: '5 Days',   days: 5   },
];

export function getEarnedDayBadges(uniqueDays) {
  return DAY_BADGES.filter(b => uniqueDays >= b.days);
}

export function countUniqueDays(sessions) {
  return new Set(sessions.map(s => s.joined_at.slice(0, 10))).size;
}

// Deterministic fake stats for the 20 seed students — purely client-side, never written to DB
export const SEED_STUDY_STATS = {
  1:  { totalHours: 42,  uniqueDays: 28, weekSeconds: Math.round(2.5  * 3600) }, // Aanya    — Dedicated
  2:  { totalHours: 67,  uniqueDays: 41, weekSeconds: Math.round(3.2  * 3600) }, // Rithvik  — Sage
  3:  { totalHours: 18,  uniqueDays: 15, weekSeconds: Math.round(1.5  * 3600) }, // Priya    — Scholar
  4:  { totalHours: 5,   uniqueDays: 5,  weekSeconds: Math.round(0.5  * 3600) }, // Karthik  — Scholar
  5:  { totalHours: 88,  uniqueDays: 52, weekSeconds: Math.round(4.1  * 3600) }, // Divya    — Sage
  6:  { totalHours: 31,  uniqueDays: 22, weekSeconds: Math.round(2.8  * 3600) }, // Aryan    — Dedicated
  7:  { totalHours: 8,   uniqueDays: 8,  weekSeconds: Math.round(1.2  * 3600) }, // Sneha    — Scholar
  8:  { totalHours: 3,   uniqueDays: 3,  weekSeconds: Math.round(0.3  * 3600) }, // Rohan    — Newcomer
  9:  { totalHours: 55,  uniqueDays: 35, weekSeconds: Math.round(3.7  * 3600) }, // Nisha    — Sage
  10: { totalHours: 24,  uniqueDays: 18, weekSeconds: Math.round(2.1  * 3600) }, // Akhil    — Dedicated
  11: { totalHours: 110, uniqueDays: 68, weekSeconds: Math.round(4.8  * 3600) }, // Meera    — Legend 👑
  12: { totalHours: 14,  uniqueDays: 10, weekSeconds: Math.round(1.0  * 3600) }, // Vishal   — Scholar
  13: { totalHours: 38,  uniqueDays: 25, weekSeconds: Math.round(2.4  * 3600) }, // Pooja    — Dedicated
  14: { totalHours: 6,   uniqueDays: 6,  weekSeconds: Math.round(0.7  * 3600) }, // Siddharth— Scholar
  15: { totalHours: 72,  uniqueDays: 44, weekSeconds: Math.round(3.5  * 3600) }, // Anjali   — Sage
  16: { totalHours: 2,   uniqueDays: 2,  weekSeconds: Math.round(0.2  * 3600) }, // Nikhil   — Newcomer
  17: { totalHours: 47,  uniqueDays: 30, weekSeconds: Math.round(2.9  * 3600) }, // Lakshmi  — Dedicated
  18: { totalHours: 20,  uniqueDays: 16, weekSeconds: Math.round(1.8  * 3600) }, // Tarun    — Dedicated
  19: { totalHours: 33,  uniqueDays: 23, weekSeconds: Math.round(2.6  * 3600) }, // Kavya    — Dedicated
  20: { totalHours: 11,  uniqueDays: 9,  weekSeconds: Math.round(1.3  * 3600) }, // Rahul    — Scholar
};

export function getSeedStudyStats(studentId) {
  return SEED_STUDY_STATS[studentId] || { totalHours: 0, uniqueDays: 0, weekSeconds: 0 };
}

export function formatStudyTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = start
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
