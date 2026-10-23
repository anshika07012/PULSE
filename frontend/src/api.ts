import type {
  AnalyticsResponse, BedsResponse, Medicine, Meta, PharmacyResponse, QueueResponse, Role, Token, User,
} from "./types";

const TOKEN_KEY = "pulse.token";
const USER_KEY = "pulse.user";

export const session = {
  token: () => localStorage.getItem(TOKEN_KEY),
  user: (): User | null => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  },
  save: (token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = session.token();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError("Cannot reach the PULSE server. Check that the backend is running on port 5050.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) {
      session.clear();
      window.dispatchEvent(new Event("pulse:logout"));
    }
    throw new ApiError(data.message || "Request failed.", res.status);
  }
  return data as T;
}

export const api = {
  login: (body: { email: string; password: string; role: Role }) =>
    request<{ token: string; user: User }>("/auth/login", { method: "POST", body }),
  register: (body: Record<string, unknown>) =>
    request<{ token: string; user: User }>("/auth/register", { method: "POST", body }),

  meta: () => request<Meta>("/queue/meta"),
  queue: () => request<QueueResponse>("/queue"),
  bookToken: (body: { department: string; doctor: string; reason?: string; priority?: string; patientName?: string }) =>
    request<QueueResponse & { token: Token }>("/queue", { method: "POST", body }),
  callNext: () => request<QueueResponse>("/queue/call-next", { method: "POST" }),
  setTokenStatus: (id: string, status: "completed" | "cancelled") =>
    request<QueueResponse>(`/queue/${id}/status`, { method: "PATCH", body: { status } }),

  pharmacy: (q = "") => request<PharmacyResponse>(`/pharmacy${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  addMedicine: (body: Record<string, unknown>) => request<Medicine>("/pharmacy", { method: "POST", body }),
  adjustStock: (id: string, delta: number) =>
    request<Medicine>(`/pharmacy/${id}/stock`, { method: "PATCH", body: { delta } }),

  beds: () => request<BedsResponse>("/beds"),
  admit: (ward: string, patientName: string) =>
    request<BedsResponse>("/beds/admit", { method: "POST", body: { ward, patientName } }),
  setBed: (id: string, status: string, patientName?: string) =>
    request<BedsResponse>(`/beds/${id}`, { method: "PATCH", body: { status, patientName } }),

  analytics: () => request<AnalyticsResponse>("/analytics"),
};
