import { NextRequest, NextResponse } from "next/server";
import spyData from "@/data/backtest/SPY.json";
import qqqData from "@/data/backtest/QQQ.json";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = (searchParams.get("ticker") || "SPY").toUpperCase().trim();
    const timeframe = (searchParams.get("timeframe") || "15m").toLowerCase();
    const requestedDate = searchParams.get("date") || "";

    const dataset = ticker === "QQQ" ? qqqData : spyData;
    const availableDates = dataset.available_dates;

    if (!availableDates || availableDates.length === 0) {
      return NextResponse.json({ error: "No historical dates available" }, { status: 404 });
    }

    // Default to the latest available date if not specified or invalid
    const selectedDate = availableDates.includes(requestedDate)
      ? requestedDate
      : availableDates[availableDates.length - 1];

    const dayData = (dataset.days as Record<string, any>)[selectedDate];
    if (!dayData) {
      return NextResponse.json({ error: `No data for date: ${selectedDate}` }, { status: 404 });
    }

    const validTimeframe = ["5m", "15m", "1h"].includes(timeframe) ? timeframe : "15m";
    const candles = dayData.candles[validTimeframe] || dayData.candles["15m"] || [];

    const payload = {
      ticker,
      availableDates,
      selectedDate,
      timeframe: validTimeframe,
      spot: dayData.spot_at_0940,
      sinclair: dayData.sinclair,
      levels: dayData.levels,
      dom: dayData.dom,
      candles,
      summary: {
        sessionHours: "09:30 - 16:00 US Eastern (RTH only)",
        sofiaHours: "16:30 - 23:00 Europe/Sofia",
        snapshotTime: "09:40 US Eastern (10 min after open)",
        totalCandles: candles.length,
      },
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error("Backtest API error:", err);
    return NextResponse.json({ error: err.message || "Failed to load backtest data" }, { status: 500 });
  }
}
