import "dotenv/config";

const apiKey = process.env.CRON_JOB_ORG_API_KEY?.trim();
const cronSecret = process.env.CRON_SECRET?.trim();
const jobUrl =
  process.env.CRON_JOB_ORG_URL?.trim() ||
  "https://natopup.com/api/internal/cron/all";
const title = "NA TOPUP - payment and fulfilment recovery";

if (!apiKey) {
  throw new Error(
    "CRON_JOB_ORG_API_KEY is missing. Generate it in cron-job.org Console > Settings."
  );
}

if (!cronSecret) {
  throw new Error("CRON_SECRET is missing.");
}

const apiOrigin = "https://api.cron-job.org";
const apiHeaders = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};

const job = {
  title,
  url: jobUrl,
  enabled: true,
  saveResponses: true,
  requestMethod: 1,
  requestTimeout: 120,
  redirectSuccess: false,
  schedule: {
    timezone: "Asia/Bangkok",
    expiresAt: 0,
    hours: [-1],
    mdays: [-1],
    minutes: [-1],
    months: [-1],
    wdays: [-1],
  },
  notification: {
    onFailure: true,
    onFailureCount: 1,
    onSuccess: true,
    onDisable: true,
    onSslCertExpiry: true,
    onSslCertExpirySeconds: 604800,
  },
  extendedData: {
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  },
};

async function apiRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${apiOrigin}${path}`, {
    ...init,
    headers: apiHeaders,
  });
  const responseText = await response.text();
  const data = responseText ? JSON.parse(responseText) : {};

  if (!response.ok) {
    throw new Error(
      `cron-job.org request failed (${response.status}): ${JSON.stringify(data)}`
    );
  }

  return data;
}

async function main() {
  const existing = await apiRequest("/jobs");
  const matchingJob = existing.jobs?.find(
    (entry: { jobId: number; title?: string; url?: string }) =>
      entry.title === title || entry.url === jobUrl
  );

  if (matchingJob) {
    await apiRequest(`/jobs/${matchingJob.jobId}`, {
      method: "PATCH",
      body: JSON.stringify({ job }),
    });
    console.log(`Updated cron-job.org job ${matchingJob.jobId}: ${jobUrl}`);
    return;
  }

  const created = await apiRequest("/jobs", {
    method: "PUT",
    body: JSON.stringify({ job }),
  });
  console.log(`Created cron-job.org job ${created.jobId}: ${jobUrl}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
