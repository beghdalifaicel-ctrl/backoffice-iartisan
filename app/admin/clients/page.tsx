"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Phone, Mail, ArrowUpRight } from "lucide-react";
import { C } from "@/lib/design-tokens";
import AdminLayout from "@/components/admin/AdminLayout";
import PageHeader from "@/components/admin/PageHeader";
import SearchInput from "@/components/admin/SearchInput";
import FilterButton from "@/components/admin/FilterButton";
import Card from "@/components/admin/Card";
import Badge from "@/components/admin/Badge";
import ActionButton from "@/components/admin/ActionButton";
import EmptyState from "@/components/admin/EmptyState";
import Pagination from "@/components/admin/Pagination";

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  ACTIVE: { label: "Actif", bg: "rgba(45,106,79,.1)", color: C.green },
  TRIAL: { label: "Essai", bg: "rgba(255,92,0,.1)", color: C.accent },
  PAST_DUE: { label: "Impayé", bg: "rgba(239,68,68,.1)", color: "#ef4444" },
  CHURNED: { label: "Résilié", bg: "rgba(122,122,106,.15)", color: C.muted },
};

const PLAN_MAP: Record<string, string> = {
  ESSENTIEL: "Essentiel · 49€",
  PRO: "Pro · 99€",
  MAX: "Max · 179€",
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
    <AdminLayout>
      <PageHeader title="Clients" subtitle={`${total} client${total > 1 ? "s" : ""} au total`} />

      <SearchInput value={search} onChange={setSearch} placeholder="Rechercher par nom, entreprise, ville…" />

      {/* Status filters */}
      <div style={{ padding: "0 16px 8px", display: "flex", gap: 8, overflowX: "auto" }}>
        {[{ val: "", label: "Tous" }, { val: "ACTIVE", label: "Actifs" }, { val: "TRIAL", label: "Essai" }, { val: "PAST_DUE", label: "Impayés" }, { val: "CHURNED", label: "Résiliés" }].map(f => (
          <FilterButton key={f.val} label={f.label} active={statusFilter === f.val} onClick={() => setStatusFilter(f.val)} />
        ))}
      </div>

      {/* Plan filters */}
      <div style={{ padding: "0 16px 8px", display: "flex", gap: 8, overflowX: "auto" }}>
        {[{ val: "", label: "Tous plans" }, { val: "ESSENTIEL", label: "Essentiel" }, { val: "PRO", label: "Pro" }, { val: "MAX", label: "Max" }].map(f => (
          <FilterButton key={f.val} label={f.label} active={planFilter === f.val} activeColor={C.green} activeBg="rgba(45,106,79,.1)" onClick={() => setPlanFilter(f.val)} />
        ))}
      </div>

      {/* Client list */}
      <div style={{ padding: "0 16px 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.muted, fontSize: 13 }}>Chargement…</div>
        ) : clients.length === 0 ? (
          <EmptyState icon={Users} title="Aucun client trouvé" message={search || statusFilter || planFilter ? "Essayez de modifier vos filtres" : "Dès qu'un lead sera converti, il apparaîtra ici"} />
        ) : (
          clients.map((c: any) => {
            const s = STATUS_MAP[c.status] || STATUS_MAP.CHURNED;
            const isOpen = expanded === c.id;
            return (
              <Card key={c.id} active={isOpen} onClick={() => setExpanded(isOpen ? null : c.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,92,0,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: C.accent, flexShrink: 0 }}>
                    {c.firstName?.[0]}{c.lastName?.[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.firstName} {c.lastName}</div>
                    <div style={{ fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.company} · {c.ville}</div>
                  </div>
                  <Badge {...s} />
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
                      {c.phone && <ActionButton href={`tel:${c.phone}`} icon={Phone} label={c.phone} color={C.green} bg="rgba(45,106,79,.1)" />}
                      {c.email && <ActionButton href={`mailto:${c.email}`} icon={Mail} label="Email" color="#2563eb" bg="rgba(37,99,235,.1)" />}
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
              </Card>
            );
          })
        )}

        <Pagination page={page} pages={pages} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}
