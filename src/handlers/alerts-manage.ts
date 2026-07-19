import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getItem, setItem, deleteItem, userKey, alertKey } from "../storage.js";
import type { WatchlistEntry, AlertRule } from "../types.js";
import { now } from "../clock.js";

registerMainMenuItem({ label: "🔔 Alerts", data: "alerts:manage", order: 30 });

function generateAlertId(): string {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const composer = new Composer<Ctx>();

composer.callbackQuery("alerts:manage", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const watchlist = await getItem<WatchlistEntry[]>(userKey(userId, "watchlist")) ?? [];
  if (watchlist.length === 0) {
    await ctx.editMessageText(
      "Your watchlist is empty — add coins first, then set up alerts.",
      { reply_markup: inlineKeyboard([[inlineButton("🪙 Add coins", "watchlist:add_common"), inlineButton("⬅️ Back to menu", "menu:main")]]) },
    );
    return;
  }

  const buttons = watchlist.map((w) => [
    inlineButton(w.friendlyName, `alerts:coin:${w.coingeckoId}`),
  ]);
  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.editMessageText(
    "Pick a coin to manage alerts:",
    { reply_markup: inlineKeyboard(buttons) },
  );
});

composer.callbackQuery(/^alerts:coin:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;
  const coingeckoId = ctx.match[1];

  const watchlist = await getItem<WatchlistEntry[]>(userKey(userId, "watchlist")) ?? [];
  const coin = watchlist.find((w) => w.coingeckoId === coingeckoId);
  if (!coin) {
    await ctx.reply("Couldn't find that coin on your watchlist.");
    return;
  }

  const allAlerts = await getAlertsForUser(userId);
  const coinAlerts = allAlerts.filter((a) => a.ticker === coin.ticker);

  const alertLines = coinAlerts.length > 0
    ? coinAlerts.map((a) => {
        if (a.type === "threshold") {
          return `• Price alert: $${a.thresholdPrice?.toLocaleString()} (${a.status})`;
        }
        return `• ${a.percentChange}% move in ${a.timeframe}h (${a.status})`;
      }).join("\n")
    : "No alerts set for this coin.";

  const buttons = [
    [inlineButton("🔔 Price threshold", `alerts:new:threshold:${coingeckoId}`)],
    [inlineButton("📊 Percent move", `alerts:new:percent:${coingeckoId}`)],
  ];

  if (coinAlerts.length > 0) {
    buttons.push([inlineButton("🗑 Clear all alerts", `alerts:clear:${coingeckoId}`)]);
  }
  buttons.push([inlineButton("⬅️ Back", "alerts:manage")]);

  await ctx.editMessageText(
    `Alerts for ${coin.friendlyName}:\n\n${alertLines}`,
    { reply_markup: inlineKeyboard(buttons) },
  );
});

composer.callbackQuery(/^alerts:new:threshold:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;
  const coingeckoId = ctx.match[1];

  const watchlist = await getItem<WatchlistEntry[]>(userKey(userId, "watchlist")) ?? [];
  const coin = watchlist.find((w) => w.coingeckoId === coingeckoId);
  if (!coin) return;

  ctx.session.step = "awaiting_threshold_price";
  ctx.session.flowData = { ticker: coin.ticker, alertType: "threshold" };

  await ctx.reply(
    `What price should trigger the ${coin.friendlyName} alert?\n\nSend me a dollar amount (e.g. 50000).`,
    { reply_markup: { force_reply: true, selective: false } },
  );
});

composer.callbackQuery(/^alerts:new:percent:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;
  const coingeckoId = ctx.match[1];

  const watchlist = await getItem<WatchlistEntry[]>(userKey(userId, "watchlist")) ?? [];
  const coin = watchlist.find((w) => w.coingeckoId === coingeckoId);
  if (!coin) return;

  ctx.session.step = "awaiting_percent_change";
  ctx.session.flowData = { ticker: coin.ticker, alertType: "percent" };

  await ctx.reply(
    `What percentage change should trigger the ${coin.friendlyName} alert?\n\nSend me a number (e.g. 5 for 5%).`,
    { reply_markup: { force_reply: true, selective: false } },
  );
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_threshold_price") return next();
  const userId = ctx.from?.id;
  if (!userId) return;

  const text = ctx.message.text.trim();
  const price = parseFloat(text.replace(/[$,]/g, ""));

  if (isNaN(price) || price <= 0) {
    await ctx.reply("That doesn't look like a valid price. Send a number like 50000.");
    return;
  }

  ctx.session.flowData = { ...ctx.session.flowData, thresholdPrice: price };
  ctx.session.step = "confirming_alert";

  const coin = ctx.session.flowData?.ticker ?? "the coin";
  const kb = inlineKeyboard([
    [inlineButton("✅ Confirm", "alerts:confirm"), inlineButton("❌ Cancel", "alerts:cancel")],
  ]);

  await ctx.reply(
    `Set a ${coin} alert when price hits $${price.toLocaleString()}?`,
    { reply_markup: kb },
  );
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_percent_change") return next();
  const userId = ctx.from?.id;
  if (!userId) return;

  const text = ctx.message.text.trim();
  const pct = parseFloat(text);

  if (isNaN(pct) || pct <= 0) {
    await ctx.reply("That doesn't look like a valid percentage. Send a number like 5.");
    return;
  }

  ctx.session.flowData = { ...ctx.session.flowData, percentChange: pct };
  ctx.session.step = "awaiting_percent_timeframe";

  await ctx.reply(
    `Over what time period? Send hours (e.g. 1 for 1 hour, 24 for daily).`,
    { reply_markup: { force_reply: true, selective: false } },
  );
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_percent_timeframe") return next();
  const userId = ctx.from?.id;
  if (!userId) return;

  const text = ctx.message.text.trim();
  const hours = parseInt(text, 10);

  if (isNaN(hours) || hours <= 0 || hours > 720) {
    await ctx.reply("Send a number of hours between 1 and 720.");
    return;
  }

  ctx.session.flowData = { ...ctx.session.flowData, timeframe: hours };
  ctx.session.step = "confirming_alert";

  const coin = ctx.session.flowData?.ticker ?? "the coin";
  const pct = ctx.session.flowData?.percentChange ?? 0;
  const kb = inlineKeyboard([
    [inlineButton("✅ Confirm", "alerts:confirm"), inlineButton("❌ Cancel", "alerts:cancel")],
  ]);

  await ctx.reply(
    `Set a ${coin} alert for ${pct}% move over ${hours}h?`,
    { reply_markup: kb },
  );
});

composer.callbackQuery("alerts:confirm", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const flow = ctx.session.flowData;
  if (!flow?.ticker || !flow.alertType) {
    ctx.session.step = "idle";
    await ctx.reply("Something went wrong — start over from the menu.");
    return;
  }

  const alertId = generateAlertId();
  const alert: AlertRule = {
    id: alertId,
    ticker: flow.ticker,
    type: flow.alertType,
    thresholdPrice: flow.thresholdPrice,
    percentChange: flow.percentChange,
    timeframe: flow.timeframe,
    status: "active",
    lastFired: 0,
  };

  await setItem(alertKey(userId, alertId), alert);

  const userAlerts = await getItem<string[]>(userKey(userId, "alert_ids")) ?? [];
  userAlerts.push(alertId);
  await setItem(userKey(userId, "alert_ids"), userAlerts);

  ctx.session.step = "idle";
  ctx.session.flowData = {};

  const desc = alert.type === "threshold"
    ? `when ${alert.ticker} hits $${alert.thresholdPrice?.toLocaleString()}`
    : `${alert.percentChange}% move over ${alert.timeframe}h on ${alert.ticker}`;

  await ctx.editMessageText(
    `✅ Alert set: ${desc}`,
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );
});

composer.callbackQuery("alerts:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "idle";
  ctx.session.flowData = {};
  await ctx.editMessageText(
    "Alert cancelled.",
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );
});

composer.callbackQuery(/^alerts:clear:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;
  const coingeckoId = ctx.match[1];

  const watchlist = await getItem<WatchlistEntry[]>(userKey(userId, "watchlist")) ?? [];
  const coin = watchlist.find((w) => w.coingeckoId === coingeckoId);

  const allAlerts = await getAlertsForUser(userId);
  const coinAlerts = allAlerts.filter((a) => a.ticker === coin?.ticker);

  for (const a of coinAlerts) {
    await deleteItem(alertKey(userId, a.id));
  }

  const remaining = allAlerts.filter((a) => a.ticker !== coin?.ticker);
  await setItem(userKey(userId, "alert_ids"), remaining.map((a) => a.id));

  await ctx.editMessageText(
    `✅ Cleared all ${coin?.friendlyName ?? "coin"} alerts.`,
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );
});

async function getAlertsForUser(userId: number): Promise<AlertRule[]> {
  const ids = await getItem<string[]>(userKey(userId, "alert_ids")) ?? [];
  const alerts: AlertRule[] = [];
  for (const id of ids) {
    const alert = await getItem<AlertRule>(alertKey(userId, id));
    if (alert) alerts.push(alert);
  }
  return alerts;
}

export { getAlertsForUser };
export default composer;
