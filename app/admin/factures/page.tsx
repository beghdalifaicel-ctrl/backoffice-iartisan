"use client";

import { useState, useEffect } from "react";
import { CreditCard, ArrowLeft, ArrowUpRight, DollarSign, AlertTriangle, CheckCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react";

const C = {
  bg: "#f7f4ef", dark: "#1a1a14", accent: "#ff5c00", green: "#2d6a4f",
  muted: "#7a7a6a", surface: "#fff", border: "#e5e0d8", yellow: "#f4d03f",
};

const STATUS_MAP: Record<string, { label: string; bg: string; color: string; icon: any }> = {
  PAID: { label: "Payée", bg: "rgba(45,106,79,.1)", color: C.green, icon: CheckCircle },
  PENDING: { label: "En attente", bg: "rgba(244,208,63,.15)", color: "#b8860b", icon: Clock },
  PAST_DUE: { label: "Impayée", bg: "rgba(239,68,68,.1)", color: "#ef4444", icon: AlertTriangle },
  VOID: { label: "Annulée", bg: "rgba(122,122,106,.15)", color: C.muted, icon: CreditCard },
};

type Invoice = {
  id: string;
  amount: number;
  status: string;
  stripeInvoiceId?: string;
  paidAt?: string;
  createdAt: string;
  client?: { firstName: string; lastName: string; company: string; email: string };
};

export default function AdminFacturesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/stats").then(r => r.ok ? r.json() : null),
    ]).then(([s]) => {
      setStats(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = statusFilter ? invoices.filter(i => i.status === statusFilter) : invoices;

  return (
    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", background: C.bg, minHeight: "100vh", color: C.dark, fontSize: 14, maxWidth: 600, margin: "0 auto" }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/admin" style={{ width: 36, height: 36, borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
          <ArrowLeft size={18} color={C.dark} />
        </a>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>Factures</div>
          <div style={{ fontSize: 12, color: C.muted }}>Suivi facturation & paiements</div>
        </div>
      </div>

      {/* Revenue KPIs */}
      {stats && (
        <div style={{ padding: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "MRR", val: `${(stats.revenue?.mrr || 0).toLocaleString()}€`, color: C.accent },
              { label: "Encaissé ce mois", val: `${(stats.revenue?.thisMonth || 0).toLocaleString()}€`, color: C.green },
              { label: "ARR projeté", val: `${(stats.revenue?.arr || 0).toLocaleString()}€`, color: C.dark },
              { label: "Impayés", val: `${(stats.revenue?.unpaidAmount || 0).toLocaleString()}€ (${stats.revenue?.unpaidCount || 0})`, color: (stats.revenue?.unpaidCount || 0) > 0 ? "#ef4444" : C.green },
            ].map(k => (
              <div key={k.label} style={{ background: C.surface, borderRadius: 14, padding: 14, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{k.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: k.color, marginTop: 4 }}>{k.val}</div>
              </div>
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
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < 3 ? `1px solid ${C.border}` : "none" }}>
                <span style={{ fontSize: 13, color: C.muted }}>{r.l}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: r.c }}>{r.v}</span>
              </div>
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
    </div>
  );
}
