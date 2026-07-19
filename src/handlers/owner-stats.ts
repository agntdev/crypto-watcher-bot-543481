import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getItem, setItem, ownerStatsKey, alertEventsKey, userIdIndexKey } from "../storage.js";
import type { OwnerStats, AlertEvent } from "../types.js";

registerMainMenuItem({ label: "📊 Owner stats", data: "owner:stats", order: 50 });

const composer = new Composer<Ctx>();

composer.callbackQuery("owner:stats", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const stats = await getItem<OwnerStats>(ownerStatsKey()) ?? {
    userCount: 0,
    alertFiresByTicker: {},
    alertFiresByType: {},
  };

  const userIds = await getItem<number[]>(userIdIndexKey()) ?? [];
  stats.userCount = userIds.length;

  const tickerLines = Object.entries(stats.alertFiresByTicker)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([ticker, count]) => `  ${ticker}: ${count} fires`)
    .join("\n");

  const typeLines = Object.entries(stats.alertFiresByType)
    .map(([type, count]) => `  ${type}: ${count}`)
    .join("\n");

  const events = await getItem<AlertEvent[]>(alertEventsKey()) ?? [];
  const recentEvents = events
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)
    .map((e) => {
      const date = new Date(e.timestamp);
      const timeStr = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      return `  ${timeStr} — ${e.ticker} ${e.type}: ${e.details}`;
    })
    .join("\n");

  const lines = [
    `📊 Owner Dashboard`,
    ``,
    `👥 Active users: ${stats.userCount}`,
    ``,
    `🔔 Top alerts (by fires):`,
    tickerLines || "  No alerts fired yet.",
    ``,
    `📋 Alerts by type:`,
    typeLines || "  No data yet.",
    ``,
    `📜 Recent alert events:`,
    recentEvents || "  No recent events.",
  ];

  await ctx.editMessageText(
    lines.join("\n"),
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );
});

export async function recordAlertFire(
  ticker: string,
  alertType: string,
  userId: number,
  details: string,
): Promise<void> {
  const stats = await getItem<OwnerStats>(ownerStatsKey()) ?? {
    userCount: 0,
    alertFiresByTicker: {},
    alertFiresByType: {},
  };

  stats.alertFiresByTicker[ticker] = (stats.alertFiresByTicker[ticker] ?? 0) + 1;
  stats.alertFiresByType[alertType] = (stats.alertFiresByType[alertType] ?? 0) + 1;

  const userIds = await getItem<number[]>(userIdIndexKey()) ?? [];
  stats.userCount = userIds.length;
  await setItem(ownerStatsKey(), stats);

  const events = await getItem<AlertEvent[]>(alertEventsKey()) ?? [];
  events.push({
    ticker,
    type: alertType,
    timestamp: Date.now(),
    userId,
    details,
  });
  if (events.length > 100) events.splice(0, events.length - 100);
  await setItem(alertEventsKey(), events);
}

export default composer;
