import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getItem, setItem, userKey, userIdIndexKey } from "../storage.js";
import type { WatchlistEntry, UserProfile } from "../types.js";

registerMainMenuItem({ label: "🪙 Watchlist", data: "watchlist:add_common", order: 10 });

const COMMON_COINS = [
  { ticker: "BTC", name: "Bitcoin", coingeckoId: "bitcoin" },
  { ticker: "ETH", name: "Ethereum", coingeckoId: "ethereum" },
  { ticker: "TON", name: "Toncoin", coingeckoId: "the-open-network" },
];

const composer = new Composer<Ctx>();

composer.callbackQuery("watchlist:add_common", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const existing = await getItem<WatchlistEntry[]>(userKey(userId, "watchlist"));
  const watchlist = existing ?? [];

  const buttons = COMMON_COINS.map((coin) => {
    const inList = watchlist.some((w) => w.coingeckoId === coin.coingeckoId);
    return [inlineButton(
      inList ? `✅ ${coin.name}` : coin.name,
      inList ? `watchlist:already:${coin.coingeckoId}` : `watchlist:add:${coin.coingeckoId}`,
    )];
  });

  buttons.push([inlineButton("➕ Custom ticker", "watchlist:custom")]);
  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.editMessageText(
    "Pick coins to add to your watchlist:", 
    { reply_markup: inlineKeyboard(buttons) },
  );
});

composer.callbackQuery(/^watchlist:add:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;
  const coingeckoId = ctx.match[1];

  const coin = COMMON_COINS.find((c) => c.coingeckoId === coingeckoId);
  if (!coin) {
    await ctx.reply("Couldn't find that coin — check the spelling and try again.");
    return;
  }

  const existing = await getItem<WatchlistEntry[]>(userKey(userId, "watchlist"));
  const watchlist = existing ?? [];

  if (watchlist.some((w) => w.coingeckoId === coingeckoId)) {
    await ctx.reply(`${coin.name} is already on your watchlist.`);
    return;
  }

  watchlist.push({ ticker: coin.ticker, friendlyName: coin.name, coingeckoId });
  await setItem(userKey(userId, "watchlist"), watchlist);

  const idx = await getItem<number[]>(userIdIndexKey()) ?? [];
  if (!idx.includes(userId)) {
    idx.push(userId);
    await setItem(userIdIndexKey(), idx);
  }

  const buttons = COMMON_COINS.map((c) => {
    const inList = watchlist.some((w) => w.coingeckoId === c.coingeckoId);
    return [inlineButton(
      inList ? `✅ ${c.name}` : c.name,
      inList ? `watchlist:already:${c.coingeckoId}` : `watchlist:add:${c.coingeckoId}`,
    )];
  });
  buttons.push([inlineButton("➕ Custom ticker", "watchlist:custom")]);
  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.editMessageText(
    `✅ Added ${coin.name} to your watchlist.`,
    { reply_markup: inlineKeyboard(buttons) },
  );
});

composer.callbackQuery(/^watchlist:already:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Already on your watchlist" });
});

composer.callbackQuery("watchlist:custom", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_custom_ticker";
  await ctx.reply(
    "Send me the coin name or ticker symbol (e.g. \"solana\" or \"SOL\"):",
    { reply_markup: { force_reply: true, selective: false } },
  );
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_custom_ticker") return next();
  const userId = ctx.from?.id;
  if (!userId) return;

  const input = ctx.message.text.trim();
  const ticker = input.toUpperCase();
  const coingeckoId = input.toLowerCase().replace(/\s+/g, "-");

  const existing = await getItem<WatchlistEntry[]>(userKey(userId, "watchlist"));
  const watchlist = existing ?? [];

  if (watchlist.some((w) => w.coingeckoId === coingeckoId)) {
    await ctx.reply(`${ticker} is already on your watchlist.`);
    ctx.session.step = "idle";
    return;
  }

  watchlist.push({ ticker, friendlyName: input, coingeckoId });
  await setItem(userKey(userId, "watchlist"), watchlist);

  const idx = await getItem<number[]>(userIdIndexKey()) ?? [];
  if (!idx.includes(userId)) {
    idx.push(userId);
    await setItem(userIdIndexKey(), idx);
  }

  ctx.session.step = "idle";
  await ctx.reply(`✅ Added ${ticker} to your watchlist.`);
});

export default composer;
