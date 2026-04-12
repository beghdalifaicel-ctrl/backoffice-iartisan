"use client";

import { useState, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Home, Users, TrendingUp, DollarSign, FileText, Activity, Settings, Bell, Star, ArrowUpRight, ArrowDownRight, Zap, UserPlus, CreditCard, AlertCircle, X as XIcon, Globe, Plus, Search, Eye, Edit, Trash2, Phone, Mail, Download, ChevronRight, RefreshCw, Send, CheckCircle, Clock, LogOut, Menu, Bot, AlertTriangle, Loader2 } from "lucide-react";

import { C } from "@/lib/design-tokens";

type Stats = {
  clients: { total: number; active: number; trial: number; churned: number; pastDue: number };
  revenue: { mrr: number; arr: number; arpu: number; thisMonth: number; unpaidCount: number; unpaidAmount: number };
  plans: { ESSENTIEL: number; PRO: number; MAX: number };
  leads: { thisMonth: number; lastMonth: number; total: number; byStatus: any; conversionRate: number };
} | null;

export default function AdminDashboard() {
  const [page, setPage] = useState("dashboard");
  const [stats, setStats] = useState<Stats>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentsData, setAgentsData] = useState<any>(null);

  // Fetch data
  useEffect(() => {
    Promise.all([
      fetch("/api/stats").then(r => r.ok ? r.json() : null),
      fetch("/api/clients").then(r => r.ok ? r.json() : { clients: [] }),
      fetch("/api/leads").then(r => r.ok ? r.json() : { leads: [] }),
      fetch("/api/admin/agents").then(r => r.ok ? r.json() : null),
    ]).then(([s, c, l, ag]) => {
      setStats(s && s.plans ? s : {
        clients: { total: 0, active: 0, trial: 0, churned: 0, pastDue: 0 },
        revenue: { mrr: 0, arr: 0, arpu: 0, thisMonth: 0, unpaidCount: 0, unpaidAmount: 0 },
        plans: { ESSENTIEL: 0, PRO: 0, MAX: 0 },
        leads: { thisMonth: 0, lastMonth: 0, total: 0, byStatus: {}, conversionRate: 0 },
      });
      setClients(c.clients || []);
      setLeads(l.leads || []);
      setAgentsData(ag);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Plan distribution for chart
  const planDist = stats ? [
    { name: "Essentiel", value: stats.plans.ESSENTIEL, color: C.muted },
    { name: "Pro", value: stats.plans.PRO, color: C.accent },
    { name: "Max", value: stats.plans.MAX, color: C.green },
  ] : [];

  // ─── BOTTOM NAV ──────────────────────────────────────────────────────────
  const navItems = [
    { id: "dashboard", label: "Accueil", icon: Home },
    { id: "clients", label: "Clients", icon: Users },
    { id: "leads", label: "Leads", icon: TrendingUp },
    { id: "agents", label: "Agents", icon: Bot },
    { id: "factures", label: "Factures", icon: FileText },
    { id: "settings", label: "Réglages", icon: Settings },
  ];

  if (loading) {
    return (
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 20 }}>iA</div>
        <div style={{ color: C.muted, fontSize: 14 }}>Chargement du back-office...</div>
      </div>
    );
  }

  // Empty state (no data yet)
  const isEmpty = stats && stats.clients.total === 0 && stats.leads.total === 0;

  return (
    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", background: C.bg, minHeight: "100vh", color: C.dark, fontSize: 14, maxWidth: 480, margin: "0 auto", position: "relative" }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div style={{ paddingBottom: 80 }}>
        {/* ─── HEADER ──────────────────────────────────────── */}
        <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.dark, letterSpacing: "-0.5px" }}>
              {page === "dashboard" && "Dashboard"}
              {page === "clients" && "Clients"}
              {page === "leads" && "Leads"}
              {page === "agents" && "Agents IA"}
              {page === "factures" && "Factures"}
              {page === "settings" && "Réglages"}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {page === "dashboard" && "Back-office iArtisan · Données réelles"}
              {page === "clients" && `${stats?.clients.total || 0} clients au total`}
              {page === "leads" && `${stats?.leads.total || 0} leads au total`}
              {page === "agents" && "Monitoring global des agents"}
              {page === "factures" && "Facturation Stripe"}
              {page === "settings" && "Configuration"}
            </div>
          </div>
          <div style={{ position: "relative", width: 40, height: 40, borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Bell size={18} color={C.dark} />
            {(stats?.clients.pastDue || 0) > 0 && <div style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: `2px solid ${C.surface}` }} />}
          </div>
        </div>

        {/* ─── EMPTY STATE ─────────────────────────────────── */}
        {isEmpty && page === "dashboard" && (
          <div style={{ margin: 16, padding: "32px 20px", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(255,92,0,.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Zap size={28} color={C.accent} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: C.dark, margin: "0 0 8px" }}>Prêt à démarrer</h2>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, margin: "0 0 20px" }}>
              Ton back-office iArtisan est connecté. Dès que tu auras ton premier lead ou client, les KPIs s'afficheront ici en temps réel.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ padding: "12px 16px", borderRadius: 10, background: C.bg, display: "flex", alignItems: "center", gap: 10 }}>
                <CheckCircle size={16} color={C.green} />
                <span style={{ fontSize: 13, color: C.dark }}>Base de données connectée</span>
              </div>
              <div style={{ padding: "12px 16px", borderRadius: 10, background: C.bg, display: "flex", alignItems: "center", gap: 10 }}>
                <CheckCircle size={16} color={C.green} />
                <span style={{ fontSize: 13, color: C.dark }}>API leads prête ({`POST /api/leads`})</span>
              </div>
              <div style={{ padding: "12px 16px", borderRadius: 10, background: C.bg, display: "flex", alignItems: "center", gap: 10 }}>
                <Clock size={16} color={C.yellow} />
                <span style={{ fontSize: 13, color: C.dark }}>Stripe webhook à configurer</span>
              </div>
              <div style={{ padding: "12px 16px", borderRadius: 10, background: C.bg, display: "flex", alignItems: "center", gap: 10 }}>
                <Clock size={16} color={C.yellow} />
                <span style={{ fontSize: 13, color: C.dark }}>Formulaire à brancher sur iartisan.io</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── DASHBOARD KPIs ─────────────────────────────── */}
        {page === "dashboard" && !isEmpty && stats && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: 16 }}>
              {[
                { label: "MRR", val: `${stats.revenue.mrr.toLocaleString()}€`, dot: C.accent },
                { label: "Clients actifs", val: stats.clients.active + stats.clients.trial, dot: C.green },
                { label: "Leads ce mois", val: stats.leads.thisMonth, dot: C.yellow },
                { label: "Conversion", val: `${stats.leads.conversionRate}%`, dot: "#a855f7" },
              ].map(k => (
                <div key={k.label} style={{ background: C.surface, borderRadius: 16, padding: 14, boxShadow: "0 8px 32px rgba(26,26,20,.08)", border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: k.dot }} />
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{k.label}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.dark, marginTop: 4 }}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Plan distribution */}
            <div style={{ margin: "0 16px", background: C.surface, borderRadius: 16, padding: "16px 8px 8px", boxShadow: "0 8px 32px rgba(26,26,20,.08)", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.dark, padding: "0 8px", marginBottom: 12 }}>Répartition par offre</div>
              {planDist.some(p => p.value > 0) ? (
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={planDist} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={4} dataKey="value">
                        {planDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8, paddingBottom: 8 }}>
                    {planDist.map(p => (
                      <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: p.color }} />
                        <span style={{ color: C.muted, fontWeight: 600 }}>{p.name}</span>
                        <span style={{ fontWeight: 700, color: C.dark }}>{p.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ padding: "24px 16px", textAlign: "center", color: C.muted, fontSize: 13 }}>Aucun client pour l'instant</div>
              )}
            </div>

            {/* Revenue breakdown */}
            <div style={{ padding: "16px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.dark, marginBottom: 12 }}>Revenus</div>
              <div style={{ background: C.surface, borderRadius: 16, padding: 16, boxShadow: "0 8px 32px rgba(26,26,20,.08)", border: `1px solid ${C.border}` }}>
                {[
                  { l: "MRR", v: `${stats.revenue.mrr.toLocaleString()}€/mois`, c: C.accent },
                  { l: "ARR projeté", v: `${stats.revenue.arr.toLocaleString()}€/an`, c: C.green },
                  { l: "ARPU", v: `${stats.revenue.arpu}€`, c: C.dark },
                  { l: "Encaissé ce mois", v: `${stats.revenue.thisMonth.toLocaleString()}€`, c: C.green },
                  { l: "Impayés", v: `${stats.revenue.unpaidAmount.toLocaleString()}€ (${stats.revenue.unpaidCount})`, c: stats.revenue.unpaidCount > 0 ? "#ef4444" : C.green },
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < 4 ? `1px solid ${C.border}` : "none" }}>
                    <span style={{ fontSize: 13, color: C.muted }}>{r.l}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: r.c }}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ─── CLIENTS PAGE ───────────────────────────────── */}
        {page === "clients" && (
          <div style={{ padding: "16px" }}>
            {clients.length === 0 ? (
              <div style={{ background: C.surface, borderRadius: 16, padding: "32px 20px", border: `1px solid ${C.border}`, textAlign: "center" }}>
                <Users size={32} color={C.muted} style={{ margin: "0 auto 12px", display: "block" }} />
                <p style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>Aucun client pour l'instant</p>
                <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Dès qu'un lead sera converti, il apparaîtra ici</p>
              </div>
            ) : (
              clients.map((c: any) => (
                <div key={c.id} style={{ background: C.surface, borderRadius: 16, padding: 14, marginBottom: 10, boxShadow: "0 8px 32px rgba(26,26,20,.08)", border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,92,0,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: C.accent }}>
                      {c.firstName?.[0]}{c.lastName?.[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>{c.firstName} {c.lastName}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{c.company} · {c.ville}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.status === "ACTIVE" ? "rgba(45,106,79,.1)" : c.status === "TRIAL" ? "rgba(255,92,0,.1)" : "rgba(239,68,68,.1)", color: c.status === "ACTIVE" ? C.green : c.status === "TRIAL" ? C.accent : "#ef4444" }}>
                        {c.status === "ACTIVE" ? "Actif" : c.status === "TRIAL" ? "Essai" : c.status === "PAST_DUE" ? "Impayé" : "Résilié"}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── LEADS PAGE ─────────────────────────────────── */}
        {page === "leads" && (
          <div style={{ padding: "16px" }}>
            {leads.length === 0 ? (
              <div style={{ background: C.surface, borderRadius: 16, padding: "32px 20px", border: `1px solid ${C.border}`, textAlign: "center" }}>
                <Zap size={32} color={C.muted} style={{ margin: "0 auto 12px", display: "block" }} />
                <p style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>Aucun lead reçu</p>
                <p style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
                  Branche le formulaire d'inscription d'iartisan.io sur<br />
                  <code style={{ fontFamily: "'DM Mono', monospace", background: C.bg, padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>POST /api/leads</code>
                </p>
              </div>
            ) : (
              leads.map((l: any) => (
                <div key={l.id} style={{ background: C.surface, borderRadius: 16, padding: 14, marginBottom: 10, boxShadow: "0 8px 32px rgba(26,26,20,.08)", border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>{l.firstName} {l.lastName}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{l.company} · {l.metier} · {l.ville}</div>
                    </div>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: l.status === "NEW" ? "rgba(255,92,0,.1)" : l.status === "CONVERTED" ? "rgba(45,106,79,.1)" : "rgba(122,122,106,.1)", color: l.status === "NEW" ? C.accent : l.status === "CONVERTED" ? C.green : C.muted }}>
                      {l.status === "NEW" ? "Nouveau" : l.status === "CONTACTED" ? "Contacté" : l.status === "DEMO_BOOKED" ? "Démo" : l.status === "CONVERTED" ? "Converti" : "Perdu"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: C.muted }}>{l.email} · {new Date(l.createdAt).toLocaleDateString("fr-FR")}</span>
                    {l.phone && (
                      <a href={`tel:${l.phone}`} style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(45,106,79,.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Phone size={16} color={C.green} />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── AGENTS MONITORING ──────────────────────────── */}
        {page === "agents" && (
          <div style={{ padding: "16px" }}>
            {!agentsData ? (
              <div style={{ background: C.surface, borderRadius: 16, padding: "32px 20px", border: `1px solid ${C.border}`, textAlign: "center" }}>
                <Bot size={32} color={C.muted} style={{ margin: "0 auto 12px", display: "block" }} />
                <p style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>Aucune donnée agent</p>
                <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Les stats apparaîtront quand les clients utiliseront les outils agents.</p>
              </div>
            ) : (
              <>
                {/* KPI Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  {[
                    { label: "Tâches total", val: agentsData.kpis.totalTasks, dot: C.dark },
                    { label: "Taux succès", val: `${agentsData.kpis.successRate}%`, dot: C.green },
                    { label: "Aujourd'hui", val: agentsData.kpis.todayTotal, dot: C.accent },
                    { label: "En attente", val: agentsData.kpis.pending, dot: C.yellow },
                  ].map(k => (
                    <div key={k.label} style={{ background: C.surface, borderRadius: 14, padding: 14, border: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: k.dot }} />
                        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{k.label}</span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: C.dark, marginTop: 4 }}>{k.val}</div>
                    </div>
                  ))}
                </div>

                {/* Cost + Tokens row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                  <div style={{ background: C.surface, borderRadius: 12, padding: "10px 12px", border: `1px solid ${C.border}`, textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{(agentsData.kpis.totalTokens / 1000).toFixed(0)}k</div>
                    <div style={{ fontSize: 10, color: C.muted }}>Tokens (mois)</div>
                  </div>
                  <div style={{ background: C.surface, borderRadius: 12, padding: "10px 12px", border: `1px solid ${C.border}`, textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{(agentsData.kpis.totalCostCents / 100).toFixed(2)}€</div>
                    <div style={{ fontSize: 10, color: C.muted }}>Coût (mois)</div>
                  </div>
                  <div style={{ background: C.surface, borderRadius: 12, padding: "10px 12px", border: `1px solid ${C.border}`, textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{(agentsData.kpis.avgDurationMs / 1000).toFixed(1)}s</div>
                    <div style={{ fontSize: 10, color: C.muted }}>Durée moy.</div>
                  </div>
                </div>

                {/* Daily trend chart */}
                {agentsData.dailyTrend && agentsData.dailyTrend.some((d: any) => d.total > 0) && (
                  <div style={{ background: C.surface, borderRadius: 14, padding: "14px 8px 8px", border: `1px solid ${C.border}`, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, padding: "0 8px", marginBottom: 10 }}>Activité (7 jours)</div>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={agentsData.dailyTrend}>
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => new Date(v).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} />
                        <Tooltip labelFormatter={(v: string) => new Date(v).toLocaleDateString("fr-FR")} />
                        <Bar dataKey="completed" fill={C.green} radius={[4, 4, 0, 0]} stackId="a" name="OK" />
                        <Bar dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} stackId="a" name="Fail" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* By agent type */}
                {Object.keys(agentsData.byAgent).length > 0 && (
                  <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 16 }}>
                    <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 13 }}>Par type d'agent</div>
                    {Object.entries(agentsData.byAgent).map(([type, data]: [string, any]) => {
                      const rate = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
                      const agentColor = type === "ADMIN" ? "#2563eb" : type === "MARKETING" ? C.green : C.accent;
                      return (
                        <div key={type} style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${agentColor}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Bot size={14} color={agentColor} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{type === "ADMIN" ? "Alice (Admin)" : type === "MARKETING" ? "Marc (Marketing)" : "Léa (Commercial)"}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{data.total} tâches · {rate}% succès</div>
                          </div>
                          <div style={{ display: "flex", gap: 6, fontSize: 11 }}>
                            <span style={{ color: C.green, fontWeight: 700 }}>{data.completed}</span>
                            <span style={{ color: C.muted }}>/</span>
                            <span style={{ color: "#ef4444", fontWeight: 700 }}>{data.failed}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Top task types */}
                {agentsData.topTaskTypes && agentsData.topTaskTypes.length > 0 && (
                  <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 16 }}>
                    <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 13 }}>Top tâches (ce mois)</div>
                    {agentsData.topTaskTypes.map((t: any, i: number) => (
                      <div key={i} style={{ padding: "8px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12 }}>{t.type.replace(/\./g, " → ")}</span>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{t.count}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recent tasks log */}
                <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 13 }}>Dernières tâches</div>
                  {agentsData.recentTasks.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 12 }}>Aucune tâche</div>
                  ) : (
                    agentsData.recentTasks.slice(0, 15).map((t: any) => {
                      const statusMap: Record<string, { label: string; color: string }> = {
                        COMPLETED: { label: "OK", color: C.green },
                        FAILED: { label: "Fail", color: "#ef4444" },
                        PENDING: { label: "Attente", color: C.yellow },
                        PROCESSING: { label: "En cours", color: "#2563eb" },
                      };
                      const s = statusMap[t.status] || { label: t.status, color: C.muted };
                      return (
                        <div key={t.id} style={{ padding: "8px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 12 }}>{t.taskType?.replace(/\./g, " → ")}</div>
                            <div style={{ fontSize: 10, color: C.muted }}>
                              {t.agentType} · {t.clientId?.slice(0, 8)} · {new Date(t.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              {t.retryCount > 0 && ` · ${t.retryCount} retry`}
                            </div>
                            {t.error && <div style={{ fontSize: 10, color: "#ef4444", marginTop: 2 }}>{t.error.slice(0, 80)}</div>}
                          </div>
                          <span style={{ fontSize: 10, background: `${s.color}15`, color: s.color, padding: "2px 8px", borderRadius: 6, fontWeight: 700, whiteSpace: "nowrap" }}>
                            {s.label}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── FACTURES PAGE ──────────────────────────────── */}
        {page === "factures" && (
          <div style={{ padding: "16px" }}>
            <div style={{ background: C.surface, borderRadius: 16, padding: "32px 20px", border: `1px solid ${C.border}`, textAlign: "center" }}>
              <CreditCard size={32} color={C.muted} style={{ margin: "0 auto 12px", display: "block" }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>Facturation Stripe</p>
              <p style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
                Les factures sont gérées automatiquement par Stripe.<br />
                Elles apparaîtront ici dès le premier paiement.
              </p>
              <a href="https://dashboard.stripe.com" target="_blank" rel="noopener" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 16, padding: "10px 20px", borderRadius: 10, background: C.accent, color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                Ouvrir Stripe <ArrowUpRight size={14} />
              </a>
            </div>
          </div>
        )}

        {/* ─── SETTINGS PAGE ─────────────────────────────── */}
        {page === "settings" && (
          <div style={{ padding: "16px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.dark, marginBottom: 12 }}>Configuration API</div>
            <div style={{ background: C.surface, borderRadius: 16, padding: 16, border: `1px solid ${C.border}` }}>
              {[
                { l: "Endpoint leads", v: "/api/leads", m: "POST" },
                { l: "Endpoint clients", v: "/api/clients", m: "GET/POST" },
                { l: "Endpoint stats", v: "/api/stats", m: "GET" },
                { l: "Webhook Stripe", v: "/api/webhooks/stripe", m: "POST" },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < 3 ? `1px solid ${C.border}` : "none" }}>
                  <span style={{ fontSize: 13, color: C.muted }}>{r.l}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <code style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, background: C.bg, padding: "2px 8px", borderRadius: 4 }}>{r.v}</code>
                    <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "rgba(45,106,79,.1)", color: C.green }}>{r.m}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 15, fontWeight: 700, color: C.dark, marginBottom: 12, marginTop: 20 }}>Exemple d'appel formulaire</div>
            <div style={{ background: C.surface, borderRadius: 16, padding: 16, border: `1px solid ${C.border}` }}>
              <pre style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.dark, lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>
{`fetch('/api/leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    firstName: 'Jean',
    lastName: 'Dupont',
    email: 'jean@dupont-plomberie.fr',
    phone: '06 12 34 56 78',
    company: 'Dupont Plomberie',
    metier: 'Plombier',
    ville: 'Lyon',
    plan: 'CROISSANCE'
  })
})`}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* ─── BOTTOM NAV ───────────────────────────────────── */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "6px 0 8px", zIndex: 100, boxShadow: "0 -4px 20px rgba(26,26,20,.06)" }}>
        {navItems.map(n => {
          const href = n.id === "clients" ? "/admin/clients" : n.id === "leads" ? "/admin/leads" : n.id === "factures" ? "/admin/factures" : n.id === "agents" ? "/admin/agents" : undefined;
          if (href) {
            return (
              <a key={n.id} href={href} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 8px", textDecoration: "none", color: C.muted, fontSize: 10, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 500 }}>
                <n.icon size={20} color={C.muted} />
                <span>{n.label}</span>
              </a>
            );
          }
          return (
            <button key={n.id} onClick={() => setPage(n.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 8px", border: "none", background: "transparent", cursor: "pointer", color: page === n.id ? C.accent : C.muted, fontSize: 10, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: page === n.id ? 700 : 500 }}>
              <n.icon size={20} color={page === n.id ? C.accent : C.muted} />
              <span>{n.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
