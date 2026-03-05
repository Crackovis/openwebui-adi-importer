import { apiPost } from "../../api/client";

export type RetryJobInput = {
  confirmationText?: string;
};

export type RetryJobResponse = {
  id: string;
  status: string;
  retriedFrom: string;
};

export const retryJob = async (jobId: string, input: RetryJobInput): Promise<RetryJobResponse> => {
  return apiPost<RetryJobResponse, RetryJobInput>(`/api/jobs/${jobId}/retry`, input);
};
