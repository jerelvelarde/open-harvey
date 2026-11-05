// Display helpers shared by the panels and the chat cards.

import { getPerson } from "@/lib/company";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const usd = (amount: number) => currency.format(amount);

const date = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

/** "Nov 5, 2026" */
export const dateLabel = (iso: string) => date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "Nov 13" */
export const shortDate = (iso: string) => date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "Thu Nov 5" */
export const dayLabel = (iso: string) => date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** "9:12" from "2026-11-05T09:12" */
export const timeLabel = (iso: string) => {
  const [h, m] = iso.slice(11, 16).split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

/** Whole days from one date to another. */
export const daysBetween = (from: string, to: string) => Math.round((date(to).getTime() - date(from).getTime()) / 86_400_000);

export const personName = (id: string) => getPerson(id).name;
export const firstName = (id: string) => getPerson(id).name.split(" ")[0];

export const plural = (n: number, noun: string, many = `${noun}s`) => `${n} ${n === 1 ? noun : many}`;
