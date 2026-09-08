import type { Report } from "./types";
let csrf = "";
export async function startSession() {
  const data = await api<{ csrf_token: string; storage: string }>("/session");
  csrf = data.csrf_token;
  return data;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.method && options.method !== "GET")
    headers.set("X-CSRF-Token", csrf);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch("/api" + path, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  if (!response.ok) {
    let message = "The request could not be completed. Please try again.";
    try {
      const data = await response.json();
      if (typeof data.detail === "string") message = data.detail;
    } catch {
      /* Proxy error. */
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
export function uploadFile(
  file: File,
  onProgress: (percent: number) => void,
): Promise<Report> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/reports");
    xhr.setRequestHeader("X-CSRF-Token", csrf);
    xhr.timeout = 180000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      try {
        const result = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(result);
        else
          reject(
            new Error(
              typeof result.detail === "string"
                ? result.detail
                : "Upload failed. Please try again.",
            ),
          );
      } catch {
        reject(
          new Error("The upload service is unavailable. Please try again."),
        );
      }
    };
    xhr.onerror = () => reject(new Error("Connection lost. Please try again."));
    xhr.ontimeout = () =>
      reject(new Error("This upload took too long. Try a smaller dataset."));
    const body = new FormData();
    body.append("file", file);
    xhr.send(body);
  });
}
export async function downloadReport(id: string, format: "csv" | "json") {
  const response = await fetch(`/api/reports/${id}/export?format=${format}`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.detail || "Download failed.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `datadock-${id.slice(0, 8)}-${format === "csv" ? "cleaned.csv" : "report.json"}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
