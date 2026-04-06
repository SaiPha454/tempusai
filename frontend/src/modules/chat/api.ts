import { apiClient } from '../../api/client';
import type { ChatAnswerDto, ChatAskPayload } from './types';

const basePath = '/chat';

export async function askSchedulingChat(payload: ChatAskPayload): Promise<ChatAnswerDto> {
  const response = await apiClient.post<ChatAnswerDto>(`${basePath}/ask`, payload);
  return response.data;
}
