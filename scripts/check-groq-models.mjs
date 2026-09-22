import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const response = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }, signal: AbortSignal.timeout(15000) });
const data = await response.json();
console.log(JSON.stringify({ status: response.status, models: data.data?.map(model => model.id) }));
