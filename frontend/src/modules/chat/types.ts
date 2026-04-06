export type ChatAskPayload = {
  question: string;
  session_id?: string;
};

export type ChatAnswerDto = {
  session_id: string;
  status: 'answered' | 'rejected';
  answer: string;
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
  };
};
