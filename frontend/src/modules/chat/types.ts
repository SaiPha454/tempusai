export type ChatAskPayload = {
  question: string;
  session_id?: string;
};

export type ChatPresentationBlock = {
  type: string;
  title?: string | null;
  data?: Record<string, unknown>;
};

export type ChatPresentation = {
  style: string;
  blocks: ChatPresentationBlock[];
};

export type ChatAnswerDto = {
  session_id: string;
  status: 'answered' | 'rejected';
  answer: string;
  presentation?: ChatPresentation | null;
  row_count?: number | null;
  sql_query?: string | null;
  rows_preview?: Array<Record<string, unknown>>;
  scope_reason?: string | null;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  meta?: {
    status?: 'answered' | 'rejected';
    rowCount?: number | null;
    sqlQuery?: string | null;
    presentation?: ChatPresentation | null;
  };
};
