"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { listPremiumUsers, setPremiumStatus } from "@/app/actions";
import { supabase } from "@/lib/supabase";

type PremiumRow = {
  email: string;
  is_premium: boolean;
};

type AdminPremiumModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AdminPremiumModal({ isOpen, onClose }: AdminPremiumModalProps) {
  const [rows, setRows] = useState<PremiumRow[]>([]);
  const [targetEmail, setTargetEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadRows = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const items = await listPremiumUsers(token);
    setRows(items.filter((row) => row.is_premium));
  };

  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      await loadRows();
    })();
  }, [isOpen]);

  if (!isOpen) return null;

  const applyStatus = async (email: string, isPremium: boolean) => {
    setIsLoading(true);
    setMessage(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const res = await setPremiumStatus(token, email, isPremium);
    setMessage(res.message);
    if (res.ok) {
      setTargetEmail("");
      await loadRows();
      setIsLoading(false);
    } else {
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
          <h3 className="modal-title">Premium Users Admin</h3>
          <button onClick={onClose} className="close-btn">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: "block" }}>
          <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
            Grant or remove premium access by email.
          </p>

          {message && (
            <div
              style={{
                marginBottom: "12px",
                padding: "10px",
                borderRadius: "8px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                fontSize: "13px",
              }}
            >
              {message}
            </div>
          )}

          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <input
              type="email"
              placeholder="user@email.com"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              style={{
                flex: 1,
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "14px",
              }}
            />
            <button
              className="save-btn"
              disabled={isLoading || !targetEmail.trim()}
              onClick={() => applyStatus(targetEmail, true)}
            >
              Grant
            </button>
          </div>

          <div style={{ maxHeight: "220px", overflowY: "auto", borderTop: "1px solid var(--border)" }}>
            {isLoading ? (
              <div style={{ padding: "16px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Loader2 size={16} className="spinner" />
                Loading...
              </div>
            ) : rows.length === 0 ? (
              <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "13px" }}>
                No premium users yet.
              </div>
            ) : (
              rows.map((row) => (
                <div
                  key={row.email}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span style={{ fontSize: "14px" }}>{row.email}</span>
                  <button
                    onClick={() => applyStatus(row.email, false)}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      padding: "4px 10px",
                      cursor: "pointer",
                    }}
                    disabled={isLoading}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
