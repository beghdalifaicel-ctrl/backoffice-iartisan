"use client";

import { useState, useEffect, useCallback } from "react";
import { Zap, Search, Phone, Mail, ArrowLeft, ChevronLeft, ChevronRight, UserPlus, ArrowUpRight, Loader2 } from "lucide-react";

const C = {
  bg: "#f7f4ef", dark: "#1a1a14", accent: "#ff5c00", green: "#2d6a4f",
  muted: "#7a7a6a", surface: "#fff", border: "#e5e0d8", yellow: "#f4d03f",
};

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  NEW: { label: "Nouveau", bg: "rgba(255,92,0,.1)", color: C.accent },
  CONTACTED: { label: "Contacté", bg: "rgba(37,99,235,.1)", color: "#2563eb" },
  DEMO_BOOKED: { label: "Démo prévue", bg: "rgba(168,85,247,.1)", color: "#a855f7" },
  CONVERTED: { label: "Converti", bg: "rgba(45,106,79,.1)", color: C.green },
  LOST: { label: "Perdu", bg: "rgba(122,122,106,.15)", color: C.muted },
};

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [converting, setConverting] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "15" });
    if (statusFilter) params.set("status", statusFilter);
    try {
      const res = await fetch(`/api/leads?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
      }
    } catch {}
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  const convertLead = async (lead: any) => {
    setConverting(lead.id);
    try {
      const res = await fetch("/api/admin/convert-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          company: lead.company || `${lead.firstName} ${lead.lastName}`,
          metier: lead.metier,
          ville: lead.ville,
          plan: lead.plan || "ESSENTIEL",
          leadId: lead.id,
        }),
      });
      if (res.ok) {
        fetchLeads(); // Refresh
      } else {
        alert("Erreur lors de la conversion");
      }
    } catch {
      alert("Erreur réseau");
    }
    setConverting(null);
  };

  // KPI bar
  const statusCounts = leads.reduce((acc: any, l: any) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", background: C.bg, minHeight: "100vh", color: C.dark, fontSize: 14, maxWidth: 600, margin: "0 auto" }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/admin" style={{ width: 36, height: 36, borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
          <ArrowLeft size={18} color={C.dark} />
        </a>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>Leads</div>
          <div style={{ fontSize: 12, color: C.muted }}>{total} lead{total > 1 ? "s" : ""} au total</div>
        </div>
      </div>

      {/* KPI mini */}
      {!loading && total > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, padding: "12px 16px" }}>
          {[
            { label: "Nouveaux", val: statusCounts.NEW || 0, color: C.accent },
            { label: "Contactés", val: statusCounts.CONTACTED || 0, color: "#2563eb" },
            { label: "Démo", val: statusCounts.DEMO_BOOKED || 0, color: "#a855f7" },
            { label: "Convertis", val: statusCounts.CONVERTED || 0, color: C.green },
          ].map(k => (
            <div key={k.label} style={{ background: C.surface, borderRadius: 12, padding: "8px 10px", border: `1px solid ${C.border}`, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.val}</div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ padding: "0 16px 8px", display: "flex", gap: 8, overflowX: "auto" }}>
        {[
          { val: "", label: "Tous" },
          { val: "NEW", label: "Nouveaux" },
          { val: "CONTACTED", label: "Contactés" },
          { val: "DEMO_BOOKED", label: "Démo" },
          { val: "CONVERTED", label: "Convertis" },
          { val: "LOST", label: "Perdus" },
        ].map(f => (
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

      {/* Lead list */}
      <div style={{ padding: "0 16px 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.muted, fontSize: 13 }}>Chargement…</div>
        ) : leads.length === 0 ? (
          <div style={{ background: C.surface, borderRadius: 16, padding: "32px 20px", border: `1px solid ${C.border}`, textAlign: "center" }}>
            <Zap size={32} color={C.muted} style={{ margin: "0 auto 12px", display: "block" }} />
            <p style={{ fontSize: 14, fontWeight: 700 }}>Aucun lead trouvé</p>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              {statusFilter ? "Essayez un autre filtre" : "Les leads arrivent via le formulaire iartisan.io"}
            </p>
          </div>
        ) : (
          leads.map((l: any) => {
            const s = STATUS_MAP[l.status] || STATUS_MAP.LOST;
            const isOpen = expanded === l.id;
            return (
              <div key={l.id} onClick={() => setExpanded(isOpen ? null : l.id)} style={{
                background: C.surface, borderRadius: 16, padding: 14, marginBottom: 10,
                boxShadow: "0 4px 20px rgba(26,26,20,.06)", border: `1px solid ${isOpen ? C.accent : C.border}`,
                cursor: "pointer", transition: "border-color .2s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l.firstName} {l.lastName}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l.company || "—"} · {l.metier} · {l.ville}
                    </div>
                  </div>
                  <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, whiteSpace: "nowrap", marginLeft: 8 }}>
                    {s.label}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: C.muted }}>
                    {l.email} · {new Date(l.createdAt).toLocaleDateString("fr-FR")}
                    {l.source && ` · ${l.source}`}
                  </span>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                      <div><span style={{ color: C.muted }}>Plan souhaité :</span> <strong>{l.plan || "Essentiel"}</strong></div>
                      <div><span style={{ color: C.muted }}>Source :</span> <strong>{l.source || "Direct"}</strong></div>
                      <div><span style={{ color: C.muted }}>Reçu le :</span> <strong>{new Date(l.createdAt).toLocaleString("fr-FR")}</strong></div>
                      <div><span style={{ color: C.muted }}>Statut :</span> <strong>{s.label}</strong></div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      {l.phone && (
                        <a href={`tel:${l.phone}`} onClick={(e) => e.stopPropagation()} style={{
                          flex: 1, padding: "10px 0", borderRadius: 10, background: "rgba(45,106,79,.1)",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          textDecoration: "none", color: C.green, fontWeight: 600, fontSize: 13,
                        }}>
                          <Phone size={14} /> Appeler
                        </a>
                      )}
                      <a href={`mailto:${l.email}`} onClick={(e) => e.stopPropagation()} style={{
                        flex: 1, padding: "10px 0", borderRadius: 10, background: "rgba(37,99,235,.1)",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        textDecoration: "none", color: "#2563eb", fontWeight: 600, fontSize: 13,
                      }}>
                        <Mail size={14} /> Email
                      </a>
                    </div>
                    {l.status === "NEW" || l.status === "CONTACTED" || l.status === "DEMO_BOOKED" ? (
                      <button onClick={(e) => { e.stopPropagation(); convertLead(l); }} disabled={converting === l.id} style={{
                        width: "100%", marginTop: 8, padding: "10px 0", borderRadius: 10, border: "none",
                        background: C.accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        opacity: converting === l.id ? 0.7 : 1, fontFamily: "inherit",
                      }}>
                        {converting === l.id ? <><Loader2 size={14} style={{ animation: "spin .8s linear infinite" }} /> Conversion…</> : <><UserPlus size={14} /> Convertir en client</>}
                      </button>
                    ) : null}
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
