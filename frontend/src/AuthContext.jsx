import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  async function restoreSession() {
    setLoading(true);
    setConnectionError("");
    try {
      setUser(await api("/auth/me"));
    } catch (error) {
      if (error.status !== 401) setConnectionError(error.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    restoreSession();
    const expire = () => setUser(null);
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);
  async function authenticate(mode, values) {
    const result = await api(`/auth/${mode}`, {
      method: "POST",
      body: JSON.stringify(values),
    });
    setUser(result);
    setConnectionError("");
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch (error) {
      if (error.status !== 401) throw error;
    }
    setUser(null);
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        connectionError,
        restoreSession,
        authenticate,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
