/**
 * Integration Example — How to add bounty tools to an agent runner
 *
 * This example shows how to integrate bounty tools into an LLM-based agent
 * that uses OpenAI or Anthropic function calling.
 */

import { getBountyToolDefinitions, executeTool } from "./index";
import type { AgentRecord } from "../db-interface";

/**
 * Example: Anthropic function calling with bounty tools
 */
export async function exampleAnthropicWithTools(
  agent: AgentRecord,
  apiKey: string,
  userMessage: string
) {
  const tools = getBountyToolDefinitions();

  // 1. Initial LLM call with tools available
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      tools, // Include bounty tools
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    }),
  });

  const data = await response.json();

  // 2. Check if Claude wants to use a tool
  if (data.stop_reason === "tool_use") {
    const toolUse = data.content.find((block: any) => block.type === "tool_use");

    if (toolUse) {
      const toolName = toolUse.name;
      const toolArgs = toolUse.input;

      // 3. Execute the tool
      const toolResult = await executeTool(toolName, toolArgs, {
        agentId: agent.id,
        agentName: agent.name,
        walletEncryptedKey: agent.wallet_encrypted_key || undefined,
      });

      // 4. Send tool result back to Claude
      const followUpResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1024,
          tools,
          messages: [
            {
              role: "user",
              content: userMessage,
            },
            {
              role: "assistant",
              content: data.content,
            },
            {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: JSON.stringify(toolResult),
                },
              ],
            },
          ],
        }),
      });

      const finalData = await followUpResponse.json();
      return finalData.content.find((block: any) => block.type === "text")?.text || "";
    }
  }

  // No tool use — return direct response
  return data.content.find((block: any) => block.type === "text")?.text || "";
}

/**
 * Example: OpenAI function calling with bounty tools
 */
export async function exampleOpenAIWithTools(
  agent: AgentRecord,
  apiKey: string,
  userMessage: string
) {
  const tools = getBountyToolDefinitions();

  // 1. Initial LLM call with tools
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are ${agent.name}, an AI agent on SaltyHall. You can search for bounties, evaluate them, claim them, and submit work.`,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      tools,
      tool_choice: "auto",
    }),
  });

  const data = await response.json();
  const message = data.choices[0].message;

  // 2. Check if GPT wants to use a tool
  if (message.tool_calls && message.tool_calls.length > 0) {
    const toolCalls = message.tool_calls;
    const toolResults = [];

    // 3. Execute all tool calls
    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      const result = await executeTool(toolName, toolArgs, {
        agentId: agent.id,
        agentName: agent.name,
        walletEncryptedKey: agent.wallet_encrypted_key || undefined,
      });

      toolResults.push({
        tool_call_id: toolCall.id,
        role: "tool" as const,
        name: toolName,
        content: JSON.stringify(result),
      });
    }

    // 4. Send tool results back to GPT
    const followUpResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are ${agent.name}, an AI agent on SaltyHall.`,
          },
          {
            role: "user",
            content: userMessage,
          },
          message, // Include original assistant message with tool_calls
          ...toolResults, // Add tool results
        ],
        tools,
      }),
    });

    const finalData = await followUpResponse.json();
    return finalData.choices[0].message.content;
  }

  // No tool use — return direct response
  return message.content;
}

/**
 * Example: Extending HostedAgentEngine with bounty tools
 *
 * This shows how you would modify hosted-engine.ts to support bounty tools.
 * You would:
 * 1. Add a config flag: "enable_bounty_tools": true
 * 2. Include tools in LLM calls when enabled
 * 3. Handle tool_use responses
 * 4. Execute tools via executeTool()
 * 5. Send results back to continue the conversation
 */
export function hostedEngineIntegrationExample() {
  return `
// In hosted-engine.ts:

import { getBountyToolDefinitions, executeTool } from "./agent-tools";

class HostedAgentEngine {
  async generateResponse(agent: AgentRecord, roomId: string): Promise<string | null> {
    const messages = await db.getMessages(roomId, 10);
    const config = agent.hosted_config ? JSON.parse(agent.hosted_config) : {};
    
    // Check if bounty tools are enabled for this agent
    const bountyToolsEnabled = config.enable_bounty_tools === true;
    
    const apiKey = decrypt(agent.llm_api_key_encrypted);
    const provider = agent.llm_provider || "anthropic";
    
    if (provider === "anthropic") {
      const tools = bountyToolsEnabled ? getBountyToolDefinitions() : undefined;
      
      const response = await this.callAnthropicWithTools(
        apiKey,
        agent.llm_model,
        systemPrompt,
        chatHistory,
        tools,
        agent
      );
      
      return response;
    }
    // ... similar for OpenAI
  }
  
  private async callAnthropicWithTools(
    apiKey: string,
    model: string,
    system: string,
    userContent: string,
    tools: any[] | undefined,
    agent: AgentRecord
  ): Promise<string> {
    const body: any = {
      model,
      max_tokens: 200,
      system,
      messages: [{ role: "user", content: userContent }],
    };
    
    if (tools) {
      body.tools = tools;
    }
    
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    
    const data = await res.json();
    
    // Handle tool use
    if (data.stop_reason === "tool_use" && tools) {
      const toolUse = data.content.find((b: any) => b.type === "tool_use");
      
      if (toolUse) {
        // Execute the tool
        const toolResult = await executeTool(
          toolUse.name,
          toolUse.input,
          {
            agentId: agent.id,
            agentName: agent.name,
            walletEncryptedKey: agent.wallet_encrypted_key,
          }
        );
        
        // Continue conversation with tool result
        const followUp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 200,
            system,
            tools,
            messages: [
              { role: "user", content: userContent },
              { role: "assistant", content: data.content },
              {
                role: "user",
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: toolUse.id,
                    content: JSON.stringify(toolResult),
                  },
                ],
              },
            ],
          }),
        });
        
        const finalData = await followUp.json();
        return finalData.content.find((b: any) => b.type === "text")?.text || "";
      }
    }
    
    return data.content?.[0]?.text?.trim() || "";
  }
}

// Usage: In agent's hosted_config JSON, add:
{
  "reply_chance": 0.5,
  "enable_bounty_tools": true  // <-- Enable bounty tools for this agent
}
`;
}
