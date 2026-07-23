import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

export const isAnthropicConfigured = Boolean(apiKey);
export const anthropic = isAnthropicConfigured ? new Anthropic({ apiKey }) : null;

// Pick a model you have access to on your Anthropic account — check
// https://docs.claude.com for current model names, since these change
// over time. Haiku is cheaper/faster if Sonnet-level accuracy isn't needed
// for this fairly simple structured-extraction task.
export const VOICE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
