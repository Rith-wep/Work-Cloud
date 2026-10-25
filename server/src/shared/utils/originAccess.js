const parseOrigins = (...values) =>
  values
    .flatMap((value) => String(value || "").split(","))
    .map((origin) => origin.trim())
    .filter(Boolean);

export const getAllowedOrigins = () =>
  Array.from(
    new Set(
      parseOrigins(
        process.env.CLIENT_ORIGINS,
        process.env.CLIENT_ORIGIN,
        process.env.ADMIN_ORIGINS,
        process.env.ADMIN_ORIGIN,
        "https://admin.workcloud.com",
        "http://localhost:5173"
      )
    )
  );

export const isAllowedOrigin = (origin, allowedOrigins = getAllowedOrigins()) => {
  if (!origin) {
    return true;
  }

  return allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin);
};
