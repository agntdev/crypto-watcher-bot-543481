const BASE_URL = "https://api.coingecko.com/api/v3";

export interface CoinPrice {
  id: string;
  symbol: string;
  name: string;
  usd: number;
  eur?: number;
  gbp?: number;
  change24h?: number;
}

const COIN_MAP: Record<string, { id: string; name: string }> = {
  bitcoin: { id: "bitcoin", name: "Bitcoin" },
  ethereum: { id: "ethereum", name: "Ethereum" },
  "the-open-network": { id: "the-open-network", name: "Toncoin" },
  toncoin: { id: "the-open-network", name: "Toncoin" },
  btc: { id: "bitcoin", name: "Bitcoin" },
  eth: { id: "ethereum", name: "Ethereum" },
  ton: { id: "the-open-network", name: "Toncoin" },
};

export function normalizeTicker(input: string): { id: string; name: string } | null {
  const lower = input.toLowerCase().trim();
  if (COIN_MAP[lower]) return COIN_MAP[lower];
  return null;
}

export async function fetchPrices(
  ids: string[],
  currency: string = "usd",
): Promise<CoinPrice[]> {
  if (ids.length === 0) return [];
  const idParam = ids.join(",");
  const url = `${BASE_URL}/simple/price?ids=${encodeURIComponent(idParam)}&vs_currencies=${encodeURIComponent(currency)}&include_24hr_change=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as Record<string, Record<string, number> & { usd_24h_change?: number }>;
    return ids.map((id) => {
      const prices = data[id];
      const info = Object.values(COIN_MAP).find((c) => c.id === id);
      return {
        id,
        symbol: info?.name?.slice(0, 3) ?? id.slice(0, 3),
        name: info?.name ?? id,
        usd: prices?.[currency] ?? 0,
        change24h: prices?.[`${currency}_24h_change`],
      };
    });
  } catch {
    return [];
  }
}

export async function fetchSinglePrice(
  id: string,
  currency: string = "usd",
): Promise<CoinPrice | null> {
  const results = await fetchPrices([id], currency);
  return results[0] ?? null;
}
