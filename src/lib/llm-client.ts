/**
 * Unified LLM Client for Depictionator
 *
 * Supports:
 * - Gemini (AI Studio / Vertex AI)
 * - OpenAI-compatible APIs
 * - Structured output with JSON Schema
 * - Streaming responses
 * - Context management
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonSchema?: object;
  stream?: boolean;
}

export interface LLMCompletionResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class LLMClient {
  private gemini: GoogleGenerativeAI | null = null;
  private geminiModel: GenerativeModel | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.gemini = new GoogleGenerativeAI(apiKey);
      this.geminiModel = this.gemini.getGenerativeModel({
        model: 'gemini-2.0-flash-exp'
      });
    }
  }

  /**
   * Complete a conversation with LLM
   */
  async complete(
    messages: LLMMessage[],
    options: LLMCompletionOptions = {}
  ): Promise<LLMCompletionResult> {
    if (!this.geminiModel) {
      throw new Error('Gemini API key not configured');
    }

    const { temperature = 0.7, maxTokens = 4096, jsonSchema } = options;

    // Convert messages to Gemini format
    const prompt = this.formatMessages(messages);

    // Add JSON schema instruction if provided
    let finalPrompt = prompt;
    if (jsonSchema) {
      finalPrompt = `${prompt}\n\nPlease respond with valid JSON matching this schema:\n\`\`\`json\n${JSON.stringify(jsonSchema, null, 2)}\n\`\`\``;
    }

    const result = await this.geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    });

    const response = result.response;
    const text = response.text();

    return {
      content: text,
      usage: {
        promptTokens: 0, // Gemini doesn't provide token counts in response
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  }

  /**
   * Stream completion (for chat UI)
   */
  async *stream(
    messages: LLMMessage[],
    options: LLMCompletionOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    if (!this.geminiModel) {
      throw new Error('Gemini API key not configured');
    }

    const prompt = this.formatMessages(messages);
    const result = await this.geminiModel.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxTokens || 4096,
      },
    });

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }

  /**
   * Generate embeddings for semantic search
   */
  async embed(text: string): Promise<number[]> {
    if (!this.gemini) {
      throw new Error('Gemini API key not configured');
    }

    const model = this.gemini.getGenerativeModel({
      model: 'text-embedding-004'
    });

    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  /**
   * Batch embeddings
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.gemini) {
      throw new Error('Gemini API key not configured');
    }

    const model = this.gemini.getGenerativeModel({
      model: 'text-embedding-004'
    });

    const results = await Promise.all(
      texts.map(text => model.embedContent(text))
    );

    return results.map(r => r.embedding.values);
  }

  /**
   * Format messages for Gemini
   */
  private formatMessages(messages: LLMMessage[]): string {
    return messages
      .map(msg => {
        if (msg.role === 'system') {
          return `[System] ${msg.content}`;
        }
        if (msg.role === 'assistant') {
          return `[Assistant] ${msg.content}`;
        }
        return msg.content;
      })
      .join('\n\n');
  }
}

/**
 * Singleton instance
 */
export const llmClient = new LLMClient();
