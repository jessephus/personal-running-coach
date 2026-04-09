export const integrationStatusCards = [
  {
    key: "strava",
    label: "Strava",
    status: "mvp",
    detail: "Primary workout import via OAuth and activity sync.",
  },
  {
    key: "telegram",
    label: "Telegram",
    status: "mvp",
    detail: "First messaging surface for coach nudges and check-ins.",
  },
  {
    key: "runna",
    label: "Runna",
    status: "deferred",
    detail: "Deferred because ICS-level sync is too shallow for the MVP.",
  },
  {
    key: "garmin",
    label: "Garmin",
    status: "deferred",
    detail: "Deferred until a cleaner supported import path is ready.",
  },
] as const;
