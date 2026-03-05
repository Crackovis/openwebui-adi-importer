const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";
export class ApiClientError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = "ApiClientError";
        this.code = code;
    }
}
const readJson = async (response) => {
    const payload = (await response.json());
    if (!payload.ok) {
        throw new ApiClientError(payload.error.code, payload.error.message);
    }
    return payload;
};
export const apiGet = async (path) => {
    const response = await fetch(`${API_BASE_URL}${path}`);
    const payload = await readJson(response);
    return payload.data;
};
export const apiPost = async (path, body) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    const payload = await readJson(response);
    return payload.data;
};
export const apiPut = async (path, body) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    const payload = await readJson(response);
    return payload.data;
};
