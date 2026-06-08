"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n/LanguageProvider";

function UpdatePasswordForm() {
  const router = useRouter();
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!password || password.length < 6) {
      setErrorMsg(t("passwordMinLength"));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(t("passwordsNoMatch"));
      return;
    }

    setIsLoading(true);
    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        throw new Error(t("authError"));
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;

      setSuccessMsg(t("passwordUpdated"));
      setTimeout(() => {
        router.push("/");
      }, 800);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t("authError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div className="modal-content" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3
            className="modal-title"
            style={{ fontSize: "20px", color: "var(--text-main)" }}
          >
            {t("updatePassword")}
          </h3>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            className="modal-body"
            style={{ flexDirection: "column", gap: "16px", alignItems: "stretch" }}
          >
            <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", textAlign: "center" }}>
              {t("resetPasswordDesc")}
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
              <div
                style={{
                  padding: "10px",
                  background: "#ffeaee",
                  color: "#e03131",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
              >
                {errorMsg}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500 }}>
                {t("newPassword")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  outline: "none",
                  width: "100%",
                  fontSize: "14px",
                }}
                disabled={isLoading}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500 }}>
                {t("confirmPassword")}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  outline: "none",
                  width: "100%",
                  fontSize: "14px",
                }}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="submit"
              className="save-btn"
              disabled={isLoading || !password || !confirmPassword}
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {isLoading && <Loader2 size={16} className="spinner" />}
              {t("updatePasswordBtn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />;
}
