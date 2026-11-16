function createRateLimiter({ windowMs, max, keyFn }) {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) {
        hits.delete(key);
      }
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      const retry = Math.ceil((entry.resetAt - now) / 1000);
      res.set("Retry-After", String(retry));
      return res.status(429).json({
        success: false,
        message: `Too many attempts. Try again in ${Math.ceil(retry / 60)} minute(s).`,
      });
    }

    next();
  };
}

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyFn: (req) =>
    `${req.ip}|${String((req.body && req.body.username) || "").toLowerCase()}`,
});

module.exports = { createRateLimiter, loginLimiter };
