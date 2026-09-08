import type { View } from "./types";
export function readRoute(): { view: View; id: string } {
  const [view, id = ""] = window.location.hash.slice(1).split("/");
  return {
    view: [
      "uploads",
      "review",
      "dashboard",
      "history",
      "guide",
      "account",
    ].includes(view)
      ? (view as View)
      : "uploads",
    id: /^[a-f0-9-]{36}$/.test(id) ? id : "",
  };
}
export const number = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
export const bytes = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1024 ** 2
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1024 ** 2).toFixed(1)} MB`;
export const date = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
export const label = (value: string) =>
  value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
