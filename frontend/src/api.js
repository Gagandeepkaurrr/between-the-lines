// All requests go through Vite's /api proxy to FastAPI.
// credentials includes the HttpOnly login cookie; we never read or store a JWT in JS.
export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: "include",
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new Error("Cannot reach the server. Check that FastAPI is running.");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = Array.isArray(data.detail)
      ? data.detail
          .map((error) => `${error.loc?.at(-1) || "Input"}: ${error.msg}`)
          .join(". ")
      : data.detail;
    const error = new Error(
      detail || "Something went wrong. Please try again.",
    );
    error.status = response.status;
    // The auth context listens for expired sessions, including in other pages.
    if (response.status === 401 && !path.startsWith("/auth/")) {
      window.dispatchEvent(new Event("session-expired"));
    }
    throw error;
  }
  return response.status === 204 ? null : response.json();
}
