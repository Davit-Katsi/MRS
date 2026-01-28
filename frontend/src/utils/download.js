import { api } from "../api/client";

export async function downloadWithAuth(urlPath, filename) {
  const res = await api.get(urlPath, { responseType: "blob" });

  const blob = new Blob([res.data]);
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();

  window.URL.revokeObjectURL(url);
}

// ✅ NEW: POST download (upload FormData -> get blob -> save file)
export async function downloadPostWithAuth(urlPath, formData, filename) {
  const res = await api.post(urlPath, formData, { responseType: "blob" });

  // Try to read filename from Content-Disposition if not provided
  let finalName = filename || "download";
  const cd = res?.headers?.["content-disposition"] || res?.headers?.["Content-Disposition"];
  if (!filename && cd) {
    const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(cd);
    if (match?.[1]) finalName = decodeURIComponent(match[1]);
  }

  const blob = new Blob([res.data]);
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  a.remove();

  window.URL.revokeObjectURL(url);
}
