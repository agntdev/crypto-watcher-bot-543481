import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getItem, setItem, settingsKey } from "../storage.js";
import type { UserSettings } from "../types.js";

registerMainMenuItem({ label: "⚙️ Settings", data: "settings:show", order: 40 });

const DEFAULT_SETTINGS: UserSettings = {
  quietStart: 22,
  quietEnd: 7,
  summaryTime: "08:00",
  cooldownMinutes: 30,
};

function formatHour(h: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:00 ${ampm}`;
}

const composer = new Composer<Ctx>();

composer.callbackQuery("settings:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const settings = await getItem<UserSettings>(settingsKey(userId)) ?? DEFAULT_SETTINGS;

  await ctx.editMessageText(
    `⚙️ Your settings:\n\n` +
    `🔕 Quiet hours: ${formatHour(settings.quietStart)} – ${formatHour(settings.quietEnd)}\n` +
    `📊 Cooldown: ${settings.cooldownMinutes} min between alerts\n` +
    `🌅 Morning summary: ${settings.summaryTime}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("🔕 Quiet hours", "settings:quiet")],
        [inlineButton("📊 Cooldown", "settings:cooldown")],
        [inlineButton("🌅 Summary time", "settings:summary")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
});

composer.callbackQuery("settings:quiet", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_settings_time";
  ctx.session.flowData = { settingsKey: "quiet" };

  await ctx.reply(
    "Send the quiet hours start (24h format, e.g. 22 for 10 PM).",
    { reply_markup: { force_reply: true, selective: false } },
  );
});

composer.callbackQuery("settings:cooldown", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_settings_time";
  ctx.session.flowData = { settingsKey: "cooldown" };

  await ctx.reply(
    "Send the cooldown in minutes between alerts (e.g. 30).",
    { reply_markup: { force_reply: true, selective: false } },
  );
});

composer.callbackQuery("settings:summary", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_settings_time";
  ctx.session.flowData = { settingsKey: "summary" };

  await ctx.reply(
    "Send the morning summary time (24h format, e.g. 08:00).",
    { reply_markup: { force_reply: true, selective: false } },
  );
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_settings_time") return next();
  const userId = ctx.from?.id;
  if (!userId) return;

  const text = ctx.message.text.trim();
  const key = ctx.session.flowData?.settingsKey;
  const settings = await getItem<UserSettings>(settingsKey(userId)) ?? { ...DEFAULT_SETTINGS };

  if (key === "quiet") {
    const hour = parseInt(text, 10);
    if (isNaN(hour) || hour < 0 || hour > 23) {
      await ctx.reply("Send an hour between 0 and 23.");
      return;
    }
    settings.quietStart = hour;
  } else if (key === "cooldown") {
    const mins = parseInt(text, 10);
    if (isNaN(mins) || mins < 5 || mins > 1440) {
      await ctx.reply("Send a cooldown between 5 and 1440 minutes.");
      return;
    }
    settings.cooldownMinutes = mins;
  } else if (key === "summary") {
    const match = /^(\d{1,2}):(\d{2})$/.exec(text);
    if (!match) {
      await ctx.reply("Send the time in HH:MM format (e.g. 08:00).");
      return;
    }
    settings.summaryTime = `${match[1].padStart(2, "0")}:${match[2]}`;
  } else {
    ctx.session.step = "idle";
    return next();
  }

  await setItem(settingsKey(userId), settings);
  ctx.session.step = "idle";
  ctx.session.flowData = {};

  const label = key === "quiet" ? "Quiet hours"
    : key === "cooldown" ? "Cooldown"
    : "Summary time";

  await ctx.reply(
    `✅ ${label} updated.`,
    { reply_markup: inlineKeyboard([[inlineButton("⚙️ Back to settings", "settings:show"), inlineButton("⬅️ Menu", "menu:main")]]) },
  );
});

export default composer;
