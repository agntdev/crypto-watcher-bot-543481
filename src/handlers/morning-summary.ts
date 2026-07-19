import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getItem, setItem, userKey, userIdIndexKey, settingsKey } from "../storage.js";
import { fetchPrices } from "../coingecko.js";
import type { WatchlistEntry, UserSettings } from "../types.js";
import { recordAlertFire } from "./owner-stats.js";
import { now } from "../clock.js";

registerMainMenuItem({ label: "🌅 Summary", data: "summary:show", order: 25 });

function isQuietHour(settings: UserSettings, currentHour: number): boolean {
  const { quietStart, quietEnd } = settings;
  if (quietStart > quietEnd) {
    return currentHour >= quietStart || currentHour < quietEnd;
  }
  return currentHour >= quietStart && currentHour < quietEnd;
}

function canFireAlert(settings: UserSettings, alertLastFired: number): boolean {
  const cooldownMs = settings.cooldownMinutes * 60 * 1000;
  return now() - alertLastFired >= cooldownMs;
}

const composer = new Composer<Ctx>();

composer.callbackQuery("summary:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  await sendMorningSummary(ctx, userId);
});

async function sendMorningSummary(ctx: Ctx, userId: number): Promise<void> {
  const watchlist = await getItem<WatchlistEntry[]>(userKey(userId, "watchlist")) ?? [];

  if (watchlist.length === 0) {
    await ctx.editMessageText(
      "Your watchlist is empty — add coins to see a morning summary.",
      { reply_markup: inlineKeyboard([[inlineButton("🪙 Add coins", "watchlist:add_common"), inlineButton("⬅️ Back to menu", "menu:main")]]) },
    );
    return;
  }

  const ids = watchlist.map((w) => w.coingeckoId);
  const prices = await fetchPrices(ids);

  if (prices.length === 0) {
    await ctx.editMessageText(
      "Couldn't fetch prices right now — try again in a moment.",
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
    );
    return;
  }

  const lines = watchlist.map((w) => {
    const price = prices.find((p) => p.id === w.coingeckoId);
    if (!price) return `${w.friendlyName}: unavailable`;
    const change = price.change24h != null
      ? ` (${price.change24h >= 0 ? "+" : ""}${price.change24h.toFixed(2)}%)`
      : "";
    return `${w.friendlyName}: $${price.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${change}`;
  });

  const date = new Date();
  const dateStr = date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  await ctx.editMessageText(
    `🌅 Morning summary — ${dateStr}\n\n${lines.join("\n")}`,
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );
}

async function checkAndFireAlerts(
  userId: number,
  prices: { id: string; usd: number }[],
): Promise<void> {
  const settings = await getItem<UserSettings>(settingsKey(userId)) ?? {
    quietStart: 22,
    quietEnd: 7,
    summaryTime: "08:00",
    cooldownMinutes: 30,
  };

  const currentHour = new Date().getHours();
  if (isQuietHour(settings, currentHour)) return;

  const alertIds = await getItem<string[]>(userKey(userId, "alert_ids")) ?? [];

  for (const alertId of alertIds) {
    const alert = await getItem<{ id: string; ticker: string; type: string; thresholdPrice?: number; percentChange?: number; timeframe?: number; status: string; lastFired: number }>(
      `alert:${userId}:${alertId}`,
    );
    if (!alert || alert.status !== "active") continue;
    if (!canFireAlert(settings, alert.lastFired)) continue;

    const price = prices.find((p) => p.id === alert.ticker.toLowerCase());
    if (!price) continue;

    let fired = false;
    let details = "";

    if (alert.type === "threshold" && alert.thresholdPrice != null) {
      if (price.usd >= alert.thresholdPrice) {
        fired = true;
        details = `Price $${price.usd.toLocaleString()} hit threshold $${alert.thresholdPrice.toLocaleString()}`;
      }
    }

    if (fired) {
      alert.lastFired = now();
      alert.status = "fired";
      await setItem(`alert:${userId}:${alertId}`, alert);
      await recordAlertFire(alert.ticker, alert.type, userId, details);
    }
  }
}

export { sendMorningSummary, checkAndFireAlerts, isQuietHour, canFireAlert };
export default composer;
