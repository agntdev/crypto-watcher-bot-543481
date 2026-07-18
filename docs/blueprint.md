# Crypto Watcher — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A private Telegram bot for tracking crypto prices with customizable alerts (price-threshold and percentage-movement) and optional morning summaries. Users manage watchlists with inline buttons and text commands, with quiet hours and cooldowns to prevent spam. Owner view shows user count and alert statistics.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- individual crypto investors
- price-sensitive traders
- casual crypto watchers

## Success criteria

- users can create and manage private watchlists with alerts
- alerts are delivered without spamming during quiet hours/cooldowns
- owner can view aggregate alert statistics

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Initialize profile and show main menu
- **/price** (command, actor: user, command: /price) — Show current prices for watchlist or specific ticker
- **Add common coin** (button, actor: user, callback: watchlist:add_common) — Add Bitcoin/Ethereum/Toncoin to watchlist
  - inputs: coin selection
  - outputs: updated watchlist confirmation
- **Manage alerts** (button, actor: user, callback: alerts:manage) — View and configure active alerts for watchlist items

## Flows

### Onboarding
_Trigger:_ /start

1. display welcome message
2. create user profile
3. show coin suggestion buttons

_Data touched:_ user profile

### Add threshold alert
_Trigger:_ watchlist item interaction

1. select coin
2. choose alert type
3. enter price threshold
4. confirm alert parameters

_Data touched:_ alert rule

### Morning summary
_Trigger:_ scheduled time

1. check user preferences
2. compile price data
3. deliver summary if not in quiet hours

_Data touched:_ user settings

### Alert suppression
_Trigger:_ alert condition met

1. check quiet hours
2. check cooldown status
3. deliver alert if allowed

_Data touched:_ alert rule, user settings

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **user profile** _(retention: persistent)_ — Telegram user ID, display name, timezone
  - fields: telegram_id, display_name, timezone
- **watchlist entry** _(retention: persistent)_ — User-specific crypto ticker with alert rules
  - fields: ticker, friendly_name, exchange, enabled_alerts
- **alert rule** _(retention: persistent)_ — Price threshold or percent-move monitoring parameters
  - fields: type, threshold_price, percent_change, timeframe, status, last_fired
- **user settings** _(retention: persistent)_ — Quiet hours, cooldowns, morning summary preferences
  - fields: quiet_start, quiet_end, summary_time, cooldown_duration
- **owner stats** _(retention: persistent)_ — Aggregate alert fire counts and user metrics
  - fields: user_count, alert_fires_by_ticker, alert_fires_by_type

## Integrations

- **Telegram** (required) — Bot API messaging
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- view user count
- view top 20 most-fired alerts
- view recent alert events

## Notifications

- price alerts with current price and timestamp
- morning summary with watchlist prices
- alert re-arm notifications
- quiet hours start/end notifications

## Permissions & privacy

- all user data is private and not shared
- watchlist contents are user-specific
- owner view only shows aggregate statistics

## Edge cases

- unknown ticker normalization and suggestions
- price feed failures with retries
- alert cooldown during price volatility
- quiet hours overlapping alert conditions

## Required tests

- alert suppression during quiet hours
- cooldown enforcement for percent alerts
- morning summary delivery outside quiet hours
- unknown ticker handling

## Assumptions

- price feed has 99%+ uptime
- users will manually re-arm threshold alerts
- default quiet hours are 22:00-07:00 local time
- price feed failures are retried silently
