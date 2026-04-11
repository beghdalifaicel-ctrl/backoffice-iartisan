"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Search, Phone, Mail, ArrowLeft, ChevronLeft, ChevronRight, Filter, ArrowUpRight, Download } from "lucide-react";

const C = {
  bg: "#f7f4ef", dark: "#1a1a14", accent: "#ff5c00", green: "#2d6a4f",
  muted: "#7a7a6a", surface: "#fff", border: "#e5e0d8", yellow: "#f4d03f",
};

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  ACTIVE: { label: "Actif", bg: "rgba(45,106,79,.1)", color: C.green },
  TRIAL: { label: "Essai", bg: "rgba(255,92,0,.1)", color: C.accent },
  PAST_DUE: { label: "Impayé", bg: "rgba(239,68,68,.1)", color: "#ef4444" },
  CHURNED: { label: "Résilié", bg: "rgba(122,122,106,.15)", color: C.muted },
};

const PLAN_MAP: Record<string, string> = {
  ESSENTIEL: "Essentiel · 49€",
  CROISSANCE: "Pro · 99€",
  PILOTE_AUTO: "Max · 179€",
};

export default function AdminClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "15" });
    if (search) params.set("q", search);
    if (statusFilter) params.set("status", statusFilter);
    if (planFilter) params.set("plan", planFilter);
    try {
      const res = await fetch(`/api/clients?${params}`);
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
      }
    } catch {}
    setLoading(false);
  }, [page, search, statusFilter, planFilter]);

  useEffect(() => { fetchClients(); }, [fetchClients]);
  useEffect(() => { setPage(1); }, [search, statusFilter, planFilter]);

  return (
    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", background: C.bg, minHeight: "100vh", color: C.dark, fontSize: 14, maxWidth: 600, margin: "0 auto" }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/admin" style={{ width: 36, height: 36, borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
          <ArrowLeft size={18} color={C.dark} />
        </a>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>Clients</div>
          <div style={{ fontSize: 12, color: C.muted }}>{total} client{total > 1 ? "s" : ""} au total</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: "12px 16px" }}>
        <div style={{ position: "relative" }}>
          <Search size={16} color={C.muted} style={{ position: "absolute", left: 12, top: 12 }} />
          <input
            type="text"
            placeholder="Rechercher par nom, entreprise, ville…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px 10px 36px", borderRadius: 12, border: `1px solid ${C.border}`,
              background: C.surface, fontSize: 14, outline: "none", boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: "0 16px 8px", display: "flex", gap: 8, overflowX: "auto" }}>
        {[{ val: "", label: "Tous" }, { val: "ACTIVE", label: "Actifs" }, { val: "TRIAL", label: "Essai" }, { val: "PAST_DUE", label: "Impayés" }, { val: "CHURNED", label: "Résiliés" }].map(f => (
          <button key={f.val} onClick={() => setStatusFilter(f.val)} style={{
            padding: "6px 14px", borderRadius: 20, border: `1px solid ${statusFilter === f.val ? C.accent : C.border}`,
            background: statusFilter === f.val ? "rgba(255,92,0,.1)" : C.surface,
            color: statusFilter === f.val ? C.accent : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer",
            whiteSpace: "nowrap", fontFamily: "inherit",
          }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 16px 8px", display: "flex", gap: 8, overflowX: "auto" }}>
        {[{ val: "", label: "Tous plans" }, { val: "ESSENTIEL", label: "Essentiel" }, { val: "CROISSANCE", label: "Pro" }, { val: "PILOTE_AUTO", label: "Max" }].map(f => (
          <button key={f.val} onClick={() => setPlanFilter(f.val)} style={{
            padding: "6px 14px", borderRadius: 20, border: `1px solid ${planFilter === f.val ? C.green : C.border}`,
            background: planFilter === f.val ? "rgba(45,106,79,.1)" : C.surface,
            color: planFilter === f.val ? C.green : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer",
            whiteSpace: "nowrap", fontFamily: "inherit",
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Client list */}
      <div style={{ padding: "0 16px 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.muted, fontSize: 13 }}>Chargement…</div>
        ) : clients.length === 0 ? (
          <div style={{ background: C.surface, borderRadius: 16, padding: "32px 20px", border: `1px solid ${C.border}`, textAlign: "center" }}>
            <Users size={32} color={C.muted} style={{ margin: "0 auto 12px", display: "block" }} />
            <p style={{ fontSize: 14, fontWeight: 700 }}>Aucun client trouvé</p>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              {search || statusFilter || planFilter ? "Essayez de modifier vos filtres" : "Dès qu'un lead sera converti, il apparaîtra ici"}
            </p>
          </div>
        ) : (
          clients.map((c: any) => {
            const s = STATUS_MAP[c.status] || STATUS_MAP.CHURNED;
            const isOpen = expanded === c.id;
            return (
              <div key={c.id} onClick={() => setExpanded(isOpen ? null : c.id)} style={{
                background: C.surface, borderRadius: 16, padding: 14, marginBottom: 10,
                boxShadow: "0 4px 20px rgba(26,26,20,.06)", border: `1px solid ${isOpen ? C.accent : C.border}`,
                cursor: "pointer", transition: "border-color .2s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,92,0,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: C.accent, flexShrink: 0 }}>
                    {c.firstName?.[0]}{c.lastName?.[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.firstName} {c.lastName}</div>
                    <div style={{ fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.company} · {c.ville}</div>
                  </div>
                  <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
                    {s.label}
                  </span>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                      <div><span style={{ color: C.muted }}>Plan :</span> <strong>{PLAN_MAP[c.plan] || c.plan}</strong></div>
                      <div><span style={{ color: C.muted }}>Métier :</span> <strong>{c.metier || "—"}</strong></div>
                      <div><span style={{ color: C.muted }}>Inscrit :</span> <strong>{new Date(c.createdAt).toLocaleDateString("fr-FR")}</strong></div>
                      <div><span style={{ color: C.muted }}>Essai fin :</span> <strong>{c.trialEndsAt ? new Date(c.trialEndsAt).toLocaleDateString("fr-FR") : "—"}</strong></div>
                      {c.siret && <div style={{ gridColumn: "1/3" }}><span style={{ color: C.muted }}>SIRET :</span> <strong>{c.siret}</strong></div>}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      {c.phone && (
                        <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} style={{
                          flex: 1, padding: "10px 0", borderRadius: 10, background: "rgba(45,106,79,.1)",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          textDecoration: "none", color: C.green, fontWeight: 600, fontSize: 13,
                        }}>
                          <Phone size={14} /> {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()} style={{
                          flex: 1, padding: "10px 0", borderRadius: 10, background: "rgba(37,99,235,.1)",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          textDecoration: "none", color: "#2563eb", fontWeight: 600, fontSize: 13,
                        }}>
                          <Mail size={14} /> Email
                        </a>
                      )}
                    </div>
                    {c.stripeCustomerId && (
                      <a href={`https://dashboard.stripe.com/customers/${c.stripeCustomerId}`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        marginTop: 8, padding: "8px 0", borderRadius: 10, background: C.bg,
                        textDecoration: "none", color: C.muted, fontWeight: 600, fontSize: 12,
                      }}>
                        Voir sur Stripe <ArrowUpRight size={12} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 12 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{
              width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: page === 1 ? "default" : "pointer",
              opacity: page === 1 ? 0.4 : 1,
            }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{page} / {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={{
              width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: page === pages ? "default" : "pointer",
              opacity: page === pages ? 0.4 : 1,
            }}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
