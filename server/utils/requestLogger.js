export function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.once('finish', () => {
    const durationMs = Date.now() - startedAt;
    console.info(
      JSON.stringify({
        time: new Date().toISOString(),
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs,
      }),
    );
  });

  next();
}
