import axios from "axios";
import { app } from ".";

const PORTKEY_API_KEY = process.env.PORTKEY_API_KEY!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;

app.post("/standup", async (c) => {
  // Slack sends application/x-www-form-urlencoded
  const body = await c.req.parseBody();
  const username = String(body["user_name"] || "");

  const githubData = await fetchGitHubActivity(username);
  const standupText = await generateStandupSummary(githubData);

  return c.json({
    response_type: "ephemeral",
    text: `*Here's your standup summary:*\n\n${standupText}`,
  });
});

async function fetchGitHubActivity(username: string) {
  const since = new Date();
  since.setDate(since.getDate() - 1);
  const isoDate = since.toISOString().split("T")[0];

  const url = `https://api.github.com/search/issues?q=author:${username}+updated:>${isoDate}`;
  const { data } = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
  });

  return (data.items ?? []).slice(0, 5);
}

async function generateStandupSummary(githubItems: any[]) {
  if (!githubItems.length) return "No GitHub activity found for today.";

  const list = githubItems
    .map((item: any) => `- ${item.title} (${item.html_url})`)
    .join("\n");
  const prompt = `You are a software engineer writing a daily Slack standup. Based on this GitHub activity:\n${list}\nWrite a concise and clear standup report. Mention PRs, issues, and key actions. Format as bullet points.`;

  const { data } = await axios.post(
    "https://api.portkey.ai/v1/chat/completions",
    {
      model: "@openai/gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    },
    {
      headers: {
        Authorization: `Bearer ${PORTKEY_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return data.choices?.[0]?.message?.content || "No summary generated.";
}
