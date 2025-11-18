import { useEffect, useState } from "react";

export const useNotificationsUnread = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchCount = async () => {
      try {
        const { api } = await import("@/lib/api");
        const res = await api.get("notifications/unread-count");
        if (!res || !res.data || !res.data.data) return;
        if (active) setCount(Number(res.data.data.unread || 0));
      } catch (e) {
        // Swallow errors to avoid UI noise
        console.warn("notifications unread fetch failed:", e?.message || e);
      }
    };

    fetchCount();
    const id = setInterval(fetchCount, 10000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return count;
};
