export class Config {
  constructor(
    public model = "gpt-4o",
    public apiKey = "",
    public baseUrl: string | undefined = undefined,
    public provider = "openai",
    public temperature = 0,
    public maxTokens = 4096,
    public maxContextTokens = 128_000
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): Config {
    return new Config(
      env.CORECODER_MODEL ?? "gpt-4o",
      env.CORECODER_API_KEY ?? env.OPENAI_API_KEY ?? env.DEEPSEEK_API_KEY ?? "",
      env.OPENAI_BASE_URL,
      env.CORECODER_PROVIDER ?? "openai",
      parseNumber(env.CORECODER_TEMPERATURE, 0),
      parseNumber(env.CORECODER_MAX_TOKENS, 4096),
      parseNumber(env.CORECODER_MAX_CONTEXT_TOKENS, 128_000)
    );
  }
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
