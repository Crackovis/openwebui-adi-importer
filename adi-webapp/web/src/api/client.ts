import type { ApiResponse } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

type ApiSuccessResponse<T> = Extract<ApiResponse<T>, { ok: true }>;

export class ApiClientError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
  }
}

const readJson = async <T>(response: Response): Promise<ApiSuccessResponse<T>> => {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    throw new ApiClientError(payload.error.code, payload.error.message);
  }
  return payload;
};

export const apiGet = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const payload = await readJson<T>(response);
  return payload.data;
};

export const apiPost = async <T, TBody>(path: string, body: TBody): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await readJson<T>(response);
  return payload.data;
};

export const apiPut = async <T, TBody>(path: string, body: TBody): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await readJson<T>(response);
  return payload.data;
};

export const apiPostForm = async <T>(path: string, formData: FormData): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body: formData,
  });
  const payload = await readJson<T>(response);
  return payload.data;
};
