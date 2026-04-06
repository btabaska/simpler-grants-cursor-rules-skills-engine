export interface CommonPayload {
  hook_event_name: string;
  workspace_roots: string[];
  conversation_id: string;
  generation_id: string;
}

export interface BeforeShellPayload extends CommonPayload {
  command: string;
  cwd: string;
}

export interface BeforeMCPPayload extends CommonPayload {
  tool_name: string;
  tool_input: string;
}

export interface BeforeReadFilePayload extends CommonPayload {
  file_path: string;
  content: string;
}

export interface BeforeSubmitPromptPayload extends CommonPayload {
  prompt: string;
  attachments?: Array<{ type: string; file_path?: string }>;
}

export interface AfterFileEditPayload extends CommonPayload {
  file_path: string;
  edits: Array<{ new_string: string }>;
}

export interface StopPayload extends CommonPayload {
  status: "completed" | "aborted" | "error";
  loop_count: number;
}

export interface HookResponse {
  permission?: "allow" | "deny" | "ask";
  continue?: boolean;
  userMessage?: string;
  agentMessage?: string;
}

export interface ReadFileResponse extends HookResponse {
  file_path?: string;
  content?: string;
}
