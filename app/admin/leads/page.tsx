"use client";

import { useState, useEffect, useCallback } from "react";
import { Zap, Phone, Mail, UserPlus, Loader2 } from "lucide-react";
import { C } from "@/lib/design-tokens";
import AdminLayout from "@/components/admin/AdminLayout";
import PageHeader from "@/components/admin/PageHeader";
import FilterButton from "@/components/admin/FilterButton";
import Card from "@/components/admin/Card";
import Badge from "@/components/admin/Badge";
import KPICard from "@/components/admin/KPICard";
import ActionButton from "@/components/admin/ActionButton";
import EmptyState from "@/components/admin/EmptyState";
import Pagination from "@/components/admin/Pagination";

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
          firstName: lead.firstName, lastName: lead.lastName, email: lead.email,
          phone: lead.phone, company: lead.company || `${lead.firstName} ${lead.lastName}`,
          metier: lead.metier, ville: lead.ville, plan: lead.plan || "ESSENTIEL", leadId: lead.id,
        }),
      });
      if (res.ok) fetchLeads();
      else alert("Erreur lors de la conversion");
    } catch { alert("Erreur réseau"); }
    setConverting(null);
  };

  const statusCounts = leads.reduce((acc: any, l: any) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <AdminLayout>
      <PageHeader title="Leads" subtitle={`${total} lead${total > 1 ? "s" : ""} au total`} />

      {/* KPI mini */}
      {!loading && total > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, padding: "12px 16px" }}>
          {[
            { label: "Nouveaux", val: statusCounts.NEW || 0, color: C.accent },
            { label: "Contactés", val: statusCounts.CONTACTED || 0, color: "#2563eb" },
            { label: "Démo", val: statusCounts.DEMO_BOOKED || 0, color: "#a855f7" },
            { label: "Convertis", val: statusCounts.CONVERTED || 0, color: C.green },
          ].map(k => (
            <KPICard key={k.label} label={k.label} value={k.val} color={k.color} />
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ padding: "0 16px 8px", display: "flex", gap: 8, overflowX: "auto" }}>
        {[
          { val: "", label: "Tous" }, { val: "NEW", label: "Nouveaux" }, { val: "CONTACTED", label: "Contactés" },
          { val: "DEMO_BOOKED", label: "Démo" }, { val: "CONVERTED", label: "Convertis" }, { val: "LOST", label: "Perdus" },
        ].map(f => (
          <FilterButton key={f.val} label={f.label} active={statusFilter === f.val} onClick={() => setStatusFilter(f.val)} />
        ))}
      </div>

      {/* Lead list */}
      <div style={{ padding: "0 16px 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.muted, fontSize: 13 }}>Chargement…</div>
        ) : leads.length === 0 ? (
          <EmptyState icon={Zap} title="Aucun lead trouvé" message={statusFilter ? "Essayez un autre filtre" : "Les leads arrivent via le formulaire iartisan.io"} />
        ) : (
          leads.map((l: any) => {
            const s = STATUS_MAP[l.status] || STATUS_MAP.LOST;
            const isOpen = expanded === l.id;
            return (
              <Card key={l.id} active={isOpen} onClick={() => setExpanded(isOpen ? null : l.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l.firstName} {l.lastName}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l.company || "—"} · {l.metier} · {l.ville}
                    </div>
                  </div>
                  <Badge {...s} style={{ marginLeft: 8 }} />
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
                      {l.phone && <ActionButton href={`tel:${l.phone}`} icon={Phone} label="Appeler" color={C.green} bg="rgba(45,106,79,.1)" />}
                      <ActionButton href={`mailto:${l.email}`} icon={Mail} label="Email" color="#2563eb" bg="rgba(37,99,235,.1)" />
                    </div>
                    {(l.status === "NEW" || l.status === "CONTACTED" || l.status === "DEMO_BOOKED") && (
                      <button onClick={(e) => { e.stopPropagation(); convertLead(l); }} disabled={converting === l.id} style={{
                        width: "100%", marginTop: 8, padding: "10px 0", borderRadius: 10, border: "none",
                        background: C.accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        opacity: converting === l.id ? 0.7 : 1, fontFamily: "inherit",
                      }}>
                        {converting === l.id ? <><Loader2 size={14} style={{ animation: "spin .8s linear infinite" }} /> Conversion…</> : <><UserPlus size={14} /> Convertir en client</>}
                      </button>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}

        <Pagination page={page} pages={pages} onPageChange={setPage} />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AdminLayout>
  );
}
