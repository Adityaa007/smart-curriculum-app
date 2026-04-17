/**
 * Safely formats a date or ISO string into a localized time string.
 * @param {string | number | Date} timestamp - The timestamp to format.
 * @param {string} fallback - The fallback string if the date is invalid.
 * @returns {string} Formatted time string or fallback.
 */
export const formatSafeTime = (timestamp, fallback = " — ") => {
  if (!timestamp) return fallback;
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return fallback;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Safely formats a date string (DD/MM/YYYY) or ISO string into a localized date string.
 * @param {string} dateStr - The date string to format.
 * @param {string} fallback - The fallback string if the date is invalid.
 * @returns {string} Formatted date string or fallback.
 */
export const formatSafeDate = (dateStr, fallback = " — ") => {
  if (!dateStr) return fallback;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    // Check if it's in DD/MM/YYYY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const parsedDate = new Date(`${y}-${m}-${d}`);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleDateString("en-IN");
      }
    }
    return fallback;
  }
  return date.toLocaleDateString("en-IN");
};

/**
 * Safely formats a time string (HH:mm) into a localized string (h:mm AM/PM).
 * @param {string} t - Time string in HH:mm format.
 * @param {string} fallback - The fallback string if empty or invalid.
 * @returns {string} Formatted time or fallback.
 */
export const formatHM = (t, fallback = " — ") => {
  if (!t) return fallback;
  const parts = t.split(":");
  if (parts.length < 2) return t;
  const hour = parseInt(parts[0], 10);
  const min = parts[1];
  if (isNaN(hour)) return fallback;
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${min} ${ampm}`;
};
