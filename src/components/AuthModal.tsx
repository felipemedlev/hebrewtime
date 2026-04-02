"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    try {
      if (isLogin) {
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
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
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
            {isLogin ? "Welcome Back" : "Create Account"}
          </h3>
          <button onClick={onClose} className="close-btn" disabled={isLoading}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ flexDirection: "column", gap: "16px", alignItems: "stretch" }}>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", textAlign: "center" }}>
              Log in to save vocabulary words securely.
            </p>
            
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
            </div>

            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setErrorMsg("");
              }}
              style={{ background: "transparent", border: "none", fontSize: "13px", color: "var(--accent)", cursor: "pointer", marginTop: "4px" }}
              disabled={isLoading}
            >
              {isLogin ? "Need an account? Sign up" : "Already have an account? Log in"}
            </button>
          </div>

          <div className="modal-footer">
            <button
              type="submit"
              className="save-btn"
              disabled={isLoading || !email || !password}
              style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
            >
              {isLoading && <Loader2 size={16} className="spinner" />}
              {isLogin ? "Log In" : "Sign Up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
