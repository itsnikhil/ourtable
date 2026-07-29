/**
 * Built-in smart-list definitions (PRD §3.2 / HLD §6.4 / LLD §6).
 * Query implementations live in Phase 6; seeding only stores metadata rows.
 */
export const DEFAULT_SMART_LISTS = [
  { name: "Top Rated", icon: "⭐", smartRule: { key: "TOP_RATED" } },
  { name: "Hidden Gems", icon: "💎", smartRule: { key: "HIDDEN_GEMS" } },
  { name: "Most Visited", icon: "🔁", smartRule: { key: "MOST_VISITED" } },
  {
    name: "Date Night Spots",
    icon: "🌙",
    smartRule: { key: "DATE_NIGHT" },
  },
  { name: "To Revisit", icon: "📌", smartRule: { key: "TO_REVISIT" } },
  {
    name: "Not Visited in 1+ Year",
    icon: "📅",
    smartRule: { key: "NOT_VISITED_1Y" },
  },
] as const;

export type SmartListKey =
  (typeof DEFAULT_SMART_LISTS)[number]["smartRule"]["key"];
