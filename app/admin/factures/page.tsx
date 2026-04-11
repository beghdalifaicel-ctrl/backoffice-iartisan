"use client";

import { useState, useEffect } from "react";
import { CreditCard, ArrowUpRight } from "lucide-react";
import { C } from "@/lib/design-tokens";
import AdminLayout from "@/components/admin/AdminLayout";
import PageHeader from "@/components/admin/PageHeader";
import KPICard from "@/components/admin/KPICard";
import TableRow from "@/components/admin/TableRow";

export default function AdminFacturesPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats").then(r => r.ok ? r.json() : null)
      .then(s => { setStats(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <AdminLayout>
      <PageHeader title="Factures" subtitle="Suivi facturation & paiements" />

      {stats && (
        <div style={{ padding: "16px" }}>
          {/* Revenue KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "MRR", val: `${(stats.revenue?.mrr || 0).toLocaleString()}€`, color: C.accent },
              { label: "Encaissé ce mois", val: `${(stats.revenue?.thisMonth || 0).toLocaleString()}€`, color: C.green },
              { label: "ARR projeté", val: `${(stats.revenue?.arr || 0).toLocaleString()}€`, color: C.dark },
              { label: "Impayés", val: `${(stats.revenue?.unpaidAmount || 0).toLocaleString()}€ (${stats.revenue?.unpaidCount || 0})`, color: (stats.revenue?.unpaidCount || 0) > 0 ? "#ef4444" : C.green },
            ].map(k => (
              <KPICard key={k.label} label={k.label} value={k.val} color={k.color} variant="full" />
            ))}
          </div>

          {/* Revenue detail */}
          <div style={{ background: C.surface, borderRadius: 16, padding: 16, marginTop: 12, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Détail revenus</div>
            {[
              { l: "ARPU", v: `${stats.revenue?.arpu || 0}€ / client`, c: C.dark },
              { l: "Clients actifs", v: `${stats.clients?.active || 0}`, c: C.green },
              { l: "Clients en essai", v: `${stats.clients?.trial || 0}`, c: C.accent },
              { l: "Résiliés", v: `${stats.clients?.churned || 0}`, c: C.muted },
            ].map((r, i, arr) => (
              <TableRow key={i} label={r.l} value={r.v} color={r.c} isLast={i === arr.length - 1} />
            ))}
          </div>

          {/* Plan revenue breakdown */}
          {stats.plans && (
            <div style={{ background: C.surface, borderRadius: 16, padding: 16, marginTop: 12, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Revenu par offre</div>
              {[
                { plan: "Essentiel", count: stats.plans.ESSENTIEL || 0, price: 49, color: C.muted },
                { plan: "Pro", count: stats.plans.CROISSANCE || 0, price: 99, color: C.accent },
                { plan: "Max", count: stats.plans.PILOTE_AUTO || 0, price: 179, color: C.green },
              ].map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: i < 2 ? `1px solid ${C.border}` : "none", gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.plan}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{p.count} client{p.count > 1 ? "s" : ""} × {p.price}€</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.dark }}>
                    {(p.count * p.price).toLocaleString()}€<span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>/mois</span>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, marginTop: 4, borderTop: `2px solid ${C.dark}` }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>Total MRR</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: C.accent }}>{(stats.revenue?.mrr || 0).toLocaleString()}€/mois</span>
              </div>
            </div>
          )}

          {/* Stripe link */}
          <a href="https://dashboard.stripe.com/invoices" target="_blank" rel="noopener" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            marginTop: 16, padding: "14px 0", borderRadius: 12, background: C.dark,
            textDecoration: "none", color: "#fff", fontWeight: 700, fontSize: 14,
          }}>
            <CreditCard size={16} /> Voir toutes les factures sur Stripe <ArrowUpRight size={14} />
          </a>

          <p style={{ textAlign: "center", fontSize: 12, color: C.muted, marginTop: 12, lineHeight: 1.5 }}>
            Les factures détaillées sont gérées automatiquement par Stripe.
            Ce tableau de bord affiche les KPIs financiers en temps réel.
          </p>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: C.muted, fontSize: 13 }}>Chargement…</div>
      )}
    </AdminLayout>
  );
}
