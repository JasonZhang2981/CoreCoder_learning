#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Agent } from "./agent.js";
import { Config } from "./config.js";
import { LLM } from "./llm.js";
import { listSessions, loadSession, saveSession } from "./session.js";
import { changedFiles } from "./tools/index.js";

type Args = {
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  prompt?: string;
  resume?: string;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = Config.fromEnv();
  if (args.model) config.model = args.model;
  if (args.apiKey) config.apiKey = args.apiKey;
  if (args.baseUrl) config.baseUrl = args.baseUrl;

  if (!config.apiKey) {
    console.error("No API key found. Set OPENAI_API_KEY or pass --api-key.");
    process.exitCode = 1;
    return;
  }

  const llmOptions = {
    model: config.model,
    apiKey: config.apiKey,
    temperature: config.temperature,
    maxTokens: config.maxTokens
  };
  const llm = new LLM(config.baseUrl ? { ...llmOptions, baseUrl: config.baseUrl } : llmOptions);
  const agent = new Agent(llm, undefined, config.maxContextTokens);

  if (args.resume) {
    const loaded = await loadSession(args.resume);
    if (!loaded) {
      console.error(`Session '${args.resume}' not found.`);
      process.exitCode = 1;
      return;
    }
    agent.messages = loaded[0];
    if (!args.model) {
      agent.llm.model = loaded[1];
      config.model = loaded[1];
    }
  }

  if (args.prompt) {
    await runOnce(agent, args.prompt);
    return;
  }

  await repl(agent, config.model);
}

async function runOnce(agent: Agent, prompt: string): Promise<void> {
  const response = await agent.chat(
    prompt,
    (token) => process.stdout.write(token),
    (name, args) => console.log(`\n> ${name}(${brief(args)})`)
  );
  if (response) {
    console.log();
  }
}

async function repl(agent: Agent, model: string): Promise<void> {
  console.log(`CoreCoder TS learning mirror\nModel: ${model}\nType /help for commands, quit to exit.`);
  const rl = createInterface({ input, output });
  while (true) {
    const line = (await rl.question("You > ")).trim();
    if (!line) continue;
    if (["quit", "exit", "/quit", "/exit"].includes(line.toLowerCase())) break;
    if (line === "/help") {
      console.log("/reset /tokens /save /sessions /diff quit");
      continue;
    }
    if (line === "/reset") {
      agent.reset();
      console.log("Conversation reset.");
      continue;
    }
    if (line === "/tokens") {
      const cost = agent.llm.estimatedCost;
      console.log(`Tokens: ${agent.llm.totalPromptTokens} prompt + ${agent.llm.totalCompletionTokens} completion`
        + (cost === undefined ? "" : ` (~$${cost.toFixed(4)})`));
      continue;
    }
    if (line === "/save") {
      const id = await saveSession(agent.messages, agent.llm.model);
      console.log(`Session saved: ${id}`);
      continue;
    }
    if (line === "/sessions") {
      console.table(await listSessions());
      continue;
    }
    if (line === "/diff") {
      console.log([...changedFiles].sort().join("\n") || "No files modified this session.");
      continue;
    }

    try {
      const response = await agent.chat(
        line,
        (token) => process.stdout.write(token),
        (name, args) => console.log(`\n> ${name}(${brief(args)})`)
      );
      if (response) console.log();
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
  }
  rl.close();
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];
    if ((current === "-m" || current === "--model") && next) {
      args.model = next;
      i += 1;
    } else if (current === "--api-key" && next) {
      args.apiKey = next;
      i += 1;
    } else if (current === "--base-url" && next) {
      args.baseUrl = next;
      i += 1;
    } else if ((current === "-p" || current === "--prompt") && next) {
      args.prompt = next;
      i += 1;
    } else if ((current === "-r" || current === "--resume") && next) {
      args.resume = next;
      i += 1;
    }
  }
  return args;
}

function brief(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(", ")
    .slice(0, 80);
}

await main();
