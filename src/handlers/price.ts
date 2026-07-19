import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getItem, userKey } from "../storage.js";
import { fetchPrices, normalizeTicker } from "../coingecko.js";
import type { WatchlistEntry } from "../types.js";

registerMainMenuItem({ label: "📈 Price", data: "price:show", order: 20 });

const composer = new Composer<Ctx>();

composer.command("price", async (ctx) => {
  await showPrices(ctx);
});

composer.callbackQuery("price:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showPricesEdit(ctx);
});

async function showPrices(ctx: Ctx) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const watchlist = await getItem<WatchlistEntry[]>(userKey(userId, "watchlist")) ?? [];

  if (watchlist.length === 0) {
    await ctx.reply(
      "Your watchlist is empty — tap 🪙 Watchlist to add some coins.",
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
    );
    return;
  }

  const ids = watchlist.map((w) => w.coingeckoId);
  const prices = await fetchPrices(ids);

  if (prices.length === 0) {
    await ctx.reply(
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

  await ctx.reply(
    `📈 Current prices:\n\n${lines.join("\n")}`,
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );
}

async function showPricesEdit(ctx: Ctx) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const watchlist = await getItem<WatchlistEntry[]>(userKey(userId, "watchlist")) ?? [];

  if (watchlist.length === 0) {
    await ctx.editMessageText(
      "Your watchlist is empty — tap 🪙 Watchlist to add some coins.",
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
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

  await ctx.editMessageText(
    `📈 Current prices:\n\n${lines.join("\n")}`,
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );
}

export default composer;
