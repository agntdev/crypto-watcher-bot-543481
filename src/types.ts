export interface UserProfile {
  telegramId: number;
  displayName: string;
  timezone: string;
}

export interface WatchlistEntry {
  ticker: string;
  friendlyName: string;
  coingeckoId: string;
}

export interface AlertRule {
  id: string;
  ticker: string;
  type: "threshold" | "percent";
  thresholdPrice?: number;
  percentChange?: number;
  timeframe?: number;
  status: "active" | "fired" | "suppressed";
  lastFired: number;
}

export interface UserSettings {
  quietStart: number;
  quietEnd: number;
  summaryTime: string;
  cooldownMinutes: number;
}

export interface OwnerStats {
  userCount: number;
  alertFiresByTicker: Record<string, number>;
  alertFiresByType: Record<string, number>;
}

export interface AlertEvent {
  ticker: string;
  type: string;
  timestamp: number;
  userId: number;
  details: string;
}
