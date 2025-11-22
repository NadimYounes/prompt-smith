export enum MessageType {
  GET_SELECTION = 'GET_SELECTION',
  SELECTION_RESPONSE = 'SELECTION_RESPONSE',
  INJECT_TEXT = 'INJECT_TEXT',
  ERROR = 'ERROR'
}

export interface ExtensionMessage {
  type: MessageType;
  payload?: string;
  error?: string;
}

export interface RefinementResponse {
  refinedPrompt: string;
  critique: string;
  score: number;
}

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface PersistedPopupState {
  originalPrompt: string;
  refinedData: RefinementResponse | null;
  status: AppStatus;
  errorMsg: string;
}
