/**
 * Utility functions for currency and numerical formatting and parsing across the application.
 */

/**
 * Safely parses any number, numeric string, or string with comma/dot decimal separators.
 * Handles cases like "1500,50", "1,500.50", "1500.5", 1500.5, etc.
 */
export function parseSafeFloat(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  // If string contains both comma and dot (e.g. "1,250.50" or "1.250,50")
  if (str.includes(",") && str.includes(".")) {
    if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
      // European/LatAm style: 1.250,50 -> remove dot, replace comma with dot
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // US style: 1,250.50 -> remove comma
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    // Only comma: replace with dot
    str = str.replace(",", ".");
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Formats a number or numeric string to always display 2 decimal places with thousands separators.
 * Example: 50 -> "50.00", 1250.5 -> "1,250.50", null/undefined/0 -> "0.00"
 */
export function formatAmount(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "0.00";
  const num = parseSafeFloat(value);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formats an amount with its currency symbol and code.
 * Example:
 * formatCurrency(150, "USD") -> "$150.00 USD"
 * formatCurrency(50.5, "EUR") -> "50.50 EUR"
 * formatCurrency(1200, "Otra", "Bs") -> "1,200.00 BS"
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = "USD",
  currencyOther?: string | null
): string {
  const formattedNum = formatAmount(amount);
  const curr = (currency === "Otra" ? (currencyOther || "Otra") : (currency || "USD")).toUpperCase();
  if (curr === "USD") {
    return `$${formattedNum} USD`;
  }
  return `${formattedNum} ${curr}`;
}
