import { apiPost } from "../../api/client";
export const retryJob = async (jobId, input) => {
    return apiPost(`/api/jobs/${jobId}/retry`, input);
};
