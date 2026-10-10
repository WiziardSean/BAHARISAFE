import { describe, expect, it, vi } from "vitest";
import {
  ForecastCache,
  OpenMeteoClient,
  buildForecastUrl,
  cacheKey,
  parseForecast,
  summarizeHours,
  thunderstormRiskFromCode,
  toWeatherMetrics,
} from "./index";
import { evaluateRisk } from "../riskEngine";
import { weatherConfig } from "../../config/env";

const KISUMU = { latitude: -0.1022, longitude: 34.7617 };

const apiBody = (overrides: Record<string, unknown> = {}) => ({
  timezone: "Africa/Nairobi",
  hourly: {
    time: ["2026-10-09T12:00", "2026-10-09T13:00", "2026-10-09T14:00"],
    wind_gusts_10m: [18.4, 36.2, null],
    precipitation: [0, 1.2, 3.5],
    weather_code: [1, 95, 99],
    visibility: [24140, 8000, 1500],
    ...overrides,
  },
});

const okResponse = (body: unknown = apiBody()) =>
  Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

function makeClient(fetchImpl: typeof fetch, extra: { now?: () => number; online?: boolean } = {}) {
  return new OpenMeteoClient({
    fetchImpl,
    cache: new ForecastCache(),
    retryDelayMs: 0,
    now: extra.now,
    isOnline: () => extra.online ?? true,
  });
}

describe("thunderstorm code mapping (Issue #2 checklist item 2)", () => {
  it("scores codes 95, 96 and 99 as HIGH RISK range (>= 60)", () => {
    for (const code of [95, 96, 99]) expect(thunderstormRiskFromCode(code)).toBeGreaterThanOrEqual(60);
  });
  it("scores other codes and missing values as 0", () => {
    for (const code of [0, 3, 61, 80, 94, 97]) expect(thunderstormRiskFromCode(code)).toBe(0);
    expect(thunderstormRiskFromCode(null)).toBe(0);
    expect(thunderstormRiskFromCode(undefined)).toBe(0);
  });
});

describe("request URL", () => {
  it("asks for gusts, precipitation and weather code in km/h and mm", () => {
    const url = new URL(buildForecastUrl(weatherConfig, KISUMU, 2));
    expect(url.pathname).toBe("/v1/forecast");
    expect(url.searchParams.get("hourly")).toBe("wind_gusts_10m,precipitation,weather_code,visibility");
    expect(url.searchParams.get("wind_speed_unit")).toBe("kmh");
    expect(url.searchParams.get("latitude")).toBe("-0.1022");
    expect(url.searchParams.get("timezone")).toBe("Africa/Nairobi");
  });
});

describe("parsing", () => {
  it("builds one object per hour and keeps nulls as null", () => {
    const f = parseForecast(apiBody(), KISUMU);
    expect(f.hours).toHaveLength(3);
    expect(f.hours[1]).toMatchObject({ windGustKmh: 36.2, weatherCode: 95, thunderstormRisk: 70 });
    expect(f.hours[2].windGustKmh).toBeNull();
    expect(f.hours[2].thunderstormRisk).toBe(95);
  });
  it("converts visibility from metres to km, and tolerates it being absent", () => {
    const f = parseForecast(apiBody(), KISUMU);
    expect(f.hours[0].visibilityKm).toBeCloseTo(24.14);
    const noVis = parseForecast(apiBody({ visibility: undefined }), KISUMU);
    expect(noVis.hours.every((h) => h.visibilityKm === null)).toBe(true);
  });
  it("rejects arrays of different lengths", () => {
    expect(() => parseForecast(apiBody({ precipitation: [0] }), KISUMU)).toThrow();
  });
  it("rejects a body with no hourly data", () => {
    expect(() => parseForecast({}, KISUMU)).toThrow();
  });
});

describe("summarizeHours", () => {
  it("returns worst-case values and skips missing data", () => {
    const s = summarizeHours(parseForecast(apiBody(), KISUMU).hours);
    expect(s.maxWindGustKmh).toBe(36.2);
    expect(s.totalPrecipitationMm).toBeCloseTo(4.7);
    expect(s.maxPrecipitationMmPerHour).toBe(3.5);
    expect(s.maxThunderstormRisk).toBe(95);
    expect(s.minVisibilityKm).toBe(1.5);
  });
  it("returns nulls for an empty list instead of 0", () => {
    const s = summarizeHours([]);
    expect(s.maxWindGustKmh).toBeNull();
    expect(s.totalPrecipitationMm).toBeNull();
  });
});

describe("caching (Issue #2 checklist item 3)", () => {
  it("uses the same cache key for nearly identical coordinates", () => {
    expect(cacheKey(-0.1022, 34.7617)).toBe(cacheKey(-0.1024, 34.7619));
  });
  it("does not call the network again while the forecast is fresh", async () => {
    const fetchMock = vi.fn(() => okResponse());
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await client.getForecast(KISUMU);
    const second = await client.getForecast(KISUMU);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.status).toBe("fresh");
  });
  it("shares one request when the same site is requested twice at once", async () => {
    const fetchMock = vi.fn(() => okResponse());
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await Promise.all([client.getForecast(KISUMU), client.getForecast(KISUMU), client.getForecast(KISUMU)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("fetches again after the cache expires", async () => {
    let t = 1_000_000;
    const fetchMock = vi.fn(() => okResponse());
    const client = makeClient(fetchMock as unknown as typeof fetch, { now: () => t });
    await client.getForecast(KISUMU);
    t += weatherConfig.cacheTtlMs + 1;
    await client.getForecast(KISUMU);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("forceRefresh skips the fresh cache", async () => {
    const fetchMock = vi.fn(() => okResponse());
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await client.getForecast(KISUMU);
    await client.getForecast(KISUMU, { forceRefresh: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("fallback and degraded states (Issue #2 checklist item 4)", () => {
  it("returns 'unavailable' with a reason when offline and nothing is saved", async () => {
    const fetchMock = vi.fn();
    const client = makeClient(fetchMock as unknown as typeof fetch, { online: false });
    const r = await client.getForecast(KISUMU);
    expect(r.status).toBe("unavailable");
    if (r.status === "unavailable") expect(r.reason).toBe("offline");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a 'stale' saved forecast when the network fails after a good fetch", async () => {
    let t = 1_000_000;
    let fail = false;
    const fetchMock = vi.fn(() => (fail ? Promise.reject(new TypeError("fetch failed")) : okResponse()));
    const client = makeClient(fetchMock as unknown as typeof fetch, { now: () => t });
    await client.getForecast(KISUMU);
    fail = true;
    t += weatherConfig.cacheTtlMs + 1;
    const r = await client.getForecast(KISUMU);
    expect(r.status).toBe("stale");
    if (r.status === "stale") {
      expect(r.reason).toBe("offline");
      expect(r.data.hours).toHaveLength(3);
    }
  });

  it("does not show a forecast older than the stale limit", async () => {
    let t = 1_000_000;
    let fail = false;
    const fetchMock = vi.fn(() => (fail ? Promise.reject(new TypeError("fetch failed")) : okResponse()));
    const client = makeClient(fetchMock as unknown as typeof fetch, { now: () => t });
    await client.getForecast(KISUMU);
    fail = true;
    t += weatherConfig.staleMaxMs + 1;
    const r = await client.getForecast(KISUMU);
    expect(r.status).toBe("unavailable");
  });

  it("retries once after a server error, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("oops", { status: 503 }))
      .mockImplementationOnce(() => okResponse());
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const r = await client.getForecast(KISUMU);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.status).toBe("fresh");
  });

  it("reports server_error when the retry also fails", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response("oops", { status: 503 })));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const r = await client.getForecast(KISUMU);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ status: "unavailable", reason: "server_error" });
  });

  it("does not retry when rate limited (429)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response("slow down", { status: 429 })));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const r = await client.getForecast(KISUMU);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ status: "unavailable", reason: "rate_limited" });
  });

  it("reports bad_response for unreadable data and never throws", async () => {
    const fetchMock = vi.fn(() => okResponse({ hourly: { time: [] } }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const r = await client.getForecast(KISUMU);
    expect(r).toMatchObject({ status: "unavailable", reason: "bad_response" });
  });

  it("reports timeout when the request is aborted", async () => {
    const abortErr = Object.assign(new Error("aborted"), { name: "AbortError" });
    const fetchMock = vi.fn(() => Promise.reject(abortErr));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const r = await client.getForecast(KISUMU);
    expect(r).toMatchObject({ status: "unavailable", reason: "timeout" });
  });
});

describe("bridge to the risk engine (riskEngine.ts)", () => {
  const summary = summarizeHours(parseForecast(apiBody(), KISUMU).hours);

  it("converts km/h to knots, takes the worst visibility, and flags a squall for storm codes", () => {
    const r = toWeatherMetrics(summary, 0.5)!;
    expect(r.metrics.windSpeedKnots).toBeCloseTo(36.2 / 1.852, 1);
    expect(r.metrics.visibilityKm).toBe(1.5);
    expect(r.metrics.waveHeightMeters).toBe(0.5);
    expect(r.metrics.isSquallWarning).toBe(true);
    expect(r.assumptions).toEqual([]);
  });
  it("does not flag a squall when there is no thunderstorm code", () => {
    const calm = summarizeHours(
      parseForecast(apiBody({ weather_code: [1, 2, 3], wind_gusts_10m: [10, 12, 11] }), KISUMU).hours,
    );
    expect(toWeatherMetrics(calm, 0.3)!.metrics.isSquallWarning).toBe(false);
  });
  it("returns null when there is no wind data", () => {
    expect(toWeatherMetrics(summarizeHours([]), 0.5)).toBeNull();
  });
  it("says so when visibility had to be assumed", () => {
    const s = summarizeHours(parseForecast(apiBody({ visibility: undefined }), KISUMU).hours);
    const r = toWeatherMetrics(s, 0.5)!;
    expect(r.assumptions).toHaveLength(1);
    expect(r.metrics.visibilityKm).toBe(10);
  });
  it("produces input the real risk engine accepts (end to end)", () => {
    const stormy = evaluateRisk(toWeatherMetrics(summary, 0.5)!.metrics);
    expect(stormy.level).toBe("EXTREME");
    expect(stormy.canGoFishing).toBe(false);
    const calm = summarizeHours(
      parseForecast(apiBody({ weather_code: [1, 2, 3], wind_gusts_10m: [8, 9, 8], visibility: [20000, 20000, 20000] }), KISUMU).hours,
    );
    expect(evaluateRisk(toWeatherMetrics(calm, 0.4)!.metrics).level).toBe("SAFE");
  });
});
