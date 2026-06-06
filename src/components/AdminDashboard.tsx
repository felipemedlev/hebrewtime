"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Clock3,
  Crown,
  GraduationCap,
  Loader2,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { formatAdminDuration } from "@/lib/adminFormat";
import { listAdminUserStats, setPremiumStatus } from "@/app/actions";
import type { AdminDashboardSummary, AdminUserStat } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useUser } from "@/hooks/useUser";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="admin-summary-card">
      <div className="admin-summary-label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="admin-summary-value">{value}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, isLoading: isLoadingUser } = useUser();
  const { entitlements, isLoading: isLoadingEntitlements } = useEntitlements();
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [users, setUsers] = useState<AdminUserStat[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "done">("idle");
  const [isSaving, setIsSaving] = useState(false);

  const isBootLoading = isLoadingUser || isLoadingEntitlements;
  const canAccessAdmin = Boolean(user && entitlements.isAdmin);

  const loadStats = useCallback(async () => {
    setFetchState("loading");
    setError(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const res = await listAdminUserStats(token);
    if (!res.ok) {
      setError(res.message ?? "Failed to load admin stats.");
      setSummary(null);
      setUsers([]);
    } else {
      setSummary(res.summary ?? null);
      setUsers(res.users ?? []);
    }
    setFetchState("done");
  }, []);

  useEffect(() => {
    if (isBootLoading || !canAccessAdmin) return;
    const timer = window.setTimeout(() => {
      void loadStats();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isBootLoading, canAccessAdmin, loadStats]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((row) => row.email.includes(q));
  }, [users, searchQuery]);

  const applyPremiumStatus = async (email: string, isPremium: boolean) => {
    setIsSaving(true);
    setMessage(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const res = await setPremiumStatus(token, email, isPremium);
    setMessage(res.message);
    if (res.ok) {
      setTargetEmail("");
      await loadStats();
    }
    setIsSaving(false);
  };

  if (isBootLoading) {
    return (
      <div className="admin-page">
        <div className="admin-shell admin-loading">
          <Loader2 size={20} className="spinner" /> Loading admin dashboard…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="admin-page">
        <div className="admin-shell admin-error">
          <p>Sign in with an admin account to open this dashboard.</p>
          <Link href="/" className="admin-link-btn">
            <ArrowLeft size={16} /> Back to Hebrew Time
          </Link>
        </div>
      </div>
    );
  }

  if (!entitlements.isAdmin) {
    return (
      <div className="admin-page">
        <div className="admin-shell admin-error">
          <p>Your account does not have admin access.</p>
          <Link href="/" className="admin-link-btn">
            <ArrowLeft size={16} /> Back to Hebrew Time
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-shell">
        <header className="admin-header">
          <div className="admin-header-left">
            <span className="admin-eyebrow">Hebrew Time</span>
            <h1 className="admin-title">Admin Dashboard</h1>
            <p className="admin-subtitle">
              Monitor platform usage, review learner activity, and manage premium access.
            </p>
          </div>
          <div className="admin-header-actions">
            <Link href="/" className="admin-link-btn">
              <ArrowLeft size={16} /> Back to app
            </Link>
            <button
              className="admin-refresh-btn"
              onClick={() => void loadStats()}
              disabled={fetchState === "loading" || isSaving}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </header>

        {summary && (
          <section className="admin-summary-grid" aria-label="Platform summary">
            <SummaryCard label="Total users" value={summary.totalUsers} icon={<Users size={16} />} />
            <SummaryCard label="Premium users" value={summary.premiumUsers} icon={<Crown size={16} />} />
            <SummaryCard
              label="Active time"
              value={formatAdminDuration(summary.totalActiveSeconds)}
              icon={<Clock3 size={16} />}
            />
            <SummaryCard
              label="Episodes completed"
              value={summary.totalEpisodesCompleted}
              icon={<BookOpen size={16} />}
            />
            <SummaryCard
              label="Words saved"
              value={summary.totalWordsSaved}
              icon={<GraduationCap size={16} />}
            />
          </section>
        )}

        <section className="admin-panel">
          <div className="admin-panel-header">
            <h2 className="admin-panel-title">Users</h2>
            <label htmlFor="admin-user-search" className="sr-only">
              Search users
            </label>
            <div style={{ position: "relative" }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
              <input
                id="admin-user-search"
                type="search"
                className="admin-search"
                placeholder="Search by email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 34 }}
              />
            </div>
          </div>

          <div className="admin-grant-row">
            <label htmlFor="admin-grant-email" className="sr-only">
              Grant premium email
            </label>
            <input
              id="admin-grant-email"
              type="email"
              className="admin-grant-input"
              placeholder="user@email.com"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
            />
            <button
              className="admin-grant-btn"
              disabled={isSaving || !targetEmail.trim()}
              onClick={() => void applyPremiumStatus(targetEmail, true)}
            >
              Grant premium
            </button>
          </div>

          {message && <p className="admin-message">{message}</p>}

          {fetchState === "loading" ? (
            <div className="admin-loading">
              <Loader2 size={18} className="spinner" /> Loading user stats…
            </div>
          ) : error ? (
            <div className="admin-error">{error}</div>
          ) : filteredUsers.length === 0 ? (
            <div className="admin-empty">No users match your search.</div>
          ) : (
            <>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th>Last seen</th>
                      <th>Active time</th>
                      <th>Episodes</th>
                      <th>Words</th>
                      <th>Reviews</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((row) => (
                      <tr key={row.userId}>
                        <td className="admin-email-cell">{row.email}</td>
                        <td>
                          <span className={`admin-badge ${row.isPremium ? "premium" : "free"}`}>
                            {row.isPremium ? "Premium" : "Free"}
                          </span>
                        </td>
                        <td>{formatDate(row.createdAt)}</td>
                        <td>{formatDate(row.lastSeenAt)}</td>
                        <td>{formatAdminDuration(row.activeSeconds)}</td>
                        <td>{row.episodesCompleted}</td>
                        <td>{row.wordsSaved}</td>
                        <td>{row.flashcardReviews}</td>
                        <td>
                          {row.isPremium ? (
                            <button
                              className="admin-action-btn danger"
                              disabled={isSaving}
                              onClick={() => void applyPremiumStatus(row.email, false)}
                            >
                              Revoke
                            </button>
                          ) : (
                            <button
                              className="admin-action-btn success"
                              disabled={isSaving}
                              onClick={() => void applyPremiumStatus(row.email, true)}
                            >
                              Grant
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="admin-card-list">
                {filteredUsers.map((row) => (
                  <article key={row.userId} className="admin-user-card">
                    <div className="admin-user-card-header">
                      <div>
                        <strong>{row.email}</strong>
                        <div style={{ marginTop: 6 }}>
                          <span className={`admin-badge ${row.isPremium ? "premium" : "free"}`}>
                            {row.isPremium ? "Premium" : "Free"}
                          </span>
                        </div>
                      </div>
                      {row.isPremium ? (
                        <button
                          className="admin-action-btn danger"
                          disabled={isSaving}
                          onClick={() => void applyPremiumStatus(row.email, false)}
                        >
                          Revoke
                        </button>
                      ) : (
                        <button
                          className="admin-action-btn success"
                          disabled={isSaving}
                          onClick={() => void applyPremiumStatus(row.email, true)}
                        >
                          Grant
                        </button>
                      )}
                    </div>
                    <div className="admin-user-card-stats">
                      <div>
                        <span className="admin-user-card-stat-label">Active time</span>
                        {formatAdminDuration(row.activeSeconds)}
                      </div>
                      <div>
                        <span className="admin-user-card-stat-label">Last seen</span>
                        {formatDate(row.lastSeenAt)}
                      </div>
                      <div>
                        <span className="admin-user-card-stat-label">Episodes</span>
                        {row.episodesCompleted}
                      </div>
                      <div>
                        <span className="admin-user-card-stat-label">Words saved</span>
                        {row.wordsSaved}
                      </div>
                      <div>
                        <span className="admin-user-card-stat-label">Flashcard reviews</span>
                        {row.flashcardReviews}
                      </div>
                      <div>
                        <span className="admin-user-card-stat-label">Joined</span>
                        {formatDate(row.createdAt)}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
