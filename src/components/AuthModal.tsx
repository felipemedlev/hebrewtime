"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (mode === "reset") {
        const redirectTo = `${window.location.origin}/update-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
        if (error) throw error;
        setSuccessMsg("Check your email for the password reset link.");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onClose();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        // Supabase might require email confirmation depending on settings
        // But for now we just handle it or close
        // If auto-confirm is enabled in their dashboard, they're logged in.
        onClose();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title" style={{ fontSize: "20px", color: "var(--text-main)" }}>
            {mode === "login" ? "Welcome Back" : mode === "signup" ? "Create Account" : "Reset Password"}
          </h3>
          <button onClick={onClose} className="close-btn" disabled={isLoading}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ flexDirection: "column", gap: "16px", alignItems: "stretch" }}>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", textAlign: "center" }}>
              {mode === "reset"
                ? "Enter your email and we'll send a password reset link."
                : "Log in to save vocabulary words securely."}
            </p>
            
            {successMsg && (
              <div
                style={{
                  padding: "10px",
                  background: "#ebfbee",
                  color: "#2f855a",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
              >
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div style={{ padding: "10px", background: "#ffeaee", color: "#e03131", borderRadius: "8px", fontSize: "13px" }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", outline: "none", width: "100%", fontSize: "14px" }}
                disabled={isLoading}
              />
            </div>
            
            {mode !== "reset" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500 }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", outline: "none", width: "100%", fontSize: "14px" }}
                  disabled={isLoading}
                />

                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("reset");
                      setErrorMsg("");
                      setSuccessMsg("");
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      fontSize: "13px",
                      color: "var(--accent)",
                      cursor: "pointer",
                      marginTop: "6px",
                      textAlign: "left",
                      padding: 0,
                    }}
                    disabled={isLoading}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setMode((prev) => (prev === "login" ? "signup" : prev === "signup" ? "login" : "login"));
                setErrorMsg("");
                setSuccessMsg("");
              }}
              style={{ background: "transparent", border: "none", fontSize: "13px", color: "var(--accent)", cursor: "pointer", marginTop: "4px" }}
              disabled={isLoading}
            >
              {mode === "login"
                ? "Need an account? Sign up"
                : mode === "signup"
                ? "Already have an account? Log in"
                : "Back to Log In"}
            </button>
          </div>

          <div className="modal-footer">
            <button
              type="submit"
              className="save-btn"
              disabled={isLoading || !email || (mode !== "reset" && !password)}
              style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
            >
              {isLoading && <Loader2 size={16} className="spinner" />}
              {mode === "login" ? "Log In" : mode === "signup" ? "Sign Up" : "Send Reset Link"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
