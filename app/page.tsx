"use client";

import { useState } from "react";

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const C = {
  bg: "#f7f4ef",
  dark: "#1a1a14",
  accent: "#ff5c00",
  green: "#2d6a4f",
  muted: "#7a7a6a",
  surface: "#ffffff",
  border: "#e5e0d8",
  blue: "#2563eb",
};

const PLANS = [
  {
    key: "ESSENTIEL",
    name: "Essentiel",
    price: 49,
    agent: "Alice — Admin",
    badge: null,
    features: [
      "1 assistante IA (Alice)",
      "Gestion emails automatisée",
      "Devis & factures IA",
      "Relances clients auto",
      "Rapport hebdomadaire",
      "Support email",
    ],
  },
  {
    key: "CROISSANCE",
    name: "Pro",
    price: 99,
    agent: "Alice + Marc — Marketing",
    badge: "Populaire",
    features: [
      "Tout Essentiel +",
      "Agent Marketing (Marc)",
      "Fiche Google optimisée",
      "Posts Google & réseaux sociaux",
      "Audit SEO local",
      "Réponse aux avis Google",
      "Contenu site web IA",
      "Support prioritaire 6j/7",
    ],
  },
  {
    key: "PILOTE_AUTO",
    name: "Max",
    price: 179,
    agent: "Alice + Marc + Léa — Commercial",
    badge: "Complet",
    features: [
      "Tout Pro +",
      "Agent Commercial (Léa)",
      "Prospection automatisée",
      "Qualification leads IA",
      "Relance impayés 3 niveaux",
      "Inscription annuaires",
      "Emails de prospection IA",
      "Conseiller dédié 24h/7j",
    ],
  },
];

const TESTIMONIALS = [
  { name: "Laurent B.", metier: "Plombier", ville: "Lyon", text: "Alice me fait gagner 2h par jour sur les devis et relances. Je me concentre sur mes chantiers.", rating: 5 },
  { name: "Sophie M.", metier: "Électricienne", ville: "Bordeaux", text: "Marc a boosté ma fiche Google en 2 semaines. +40% de demandes de devis.", rating: 5 },
  { name: "Karim D.", metier: "Peintre", ville: "Marseille", text: "Léa m'a trouvé 12 nouveaux clients le premier mois. Le retour sur investissement est immédiat.", rating: 5 },
];

const FEATURES = [
  { emoji: "📧", title: "Emails automatisés", desc: "Alice lit, trie et répond à vos emails. Devis, relances, suivi — tout est géré." },
  { emoji: "📊", title: "Devis & factures IA", desc: "Générez des devis pro en 30 secondes. Factures avec relance impayés automatique." },
  { emoji: "🏪", title: "Google Business", desc: "Marc optimise votre fiche, publie des posts hebdo et répond aux avis clients." },
  { emoji: "🔍", title: "SEO local", desc: "Audit complet de votre référencement local. Soyez trouvé par vos futurs clients." },
  { emoji: "🎯", title: "Prospection IA", desc: "Léa trouve des prospects, les qualifie et envoie des emails personnalisés." },
  { emoji: "📱", title: "Pilotez depuis Telegram", desc: "Parlez à vos agents depuis votre téléphone. Dictez, ils exécutent." },
];

const FAQ = [
  { q: "Comment ça marche concrètement ?", a: "Vous vous inscrivez, vous nommez vos agents IA, vous connectez votre Gmail. C'est tout. Vos agents commencent à travailler immédiatement : emails, devis, prospection, marketing." },
  { q: "Mes données sont-elles sécurisées ?", a: "Oui. Connexion Gmail via OAuth (on ne stocke jamais votre mot de passe), données hébergées en Europe, chiffrement bout en bout." },
  { q: "Je peux changer de plan à tout moment ?", a: "Oui, montez ou descendez de plan quand vous voulez depuis votre espace client. La différence est ajustée au prorata." },
  { q: "Et si je ne suis pas satisfait ?", a: "14 jours d'essai gratuit, sans engagement. Annulez en un clic depuis votre espace." },
  { q: "Les agents remplacent-ils un employé ?", a: "Non, ils automatisent les tâches répétitives (emails, devis, relances, posts...) pour vous libérer du temps sur vos chantiers." },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: C.dark, background: C.bg }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* ─── NAV ─── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(247,244,239,0.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 16 }}>iA</div>
            <span style={{ fontWeight: 800, fontSize: 20 }}>iArtisan</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/client/login" style={{ padding: "10px 18px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.dark, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Connexion</a>
            <a href="/client/signup" style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: C.accent, color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Essai gratuit</a>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 20px 60px", textAlign: "center" }}>
        <div className="animate-fade-in" style={{ display: "inline-block", background: `${C.green}15`, color: C.green, padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
          14 jours d'essai gratuit — sans engagement
        </div>
        <h1 className="animate-fade-in-up delay-100" style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 800, lineHeight: 1.15, margin: "0 0 20px", maxWidth: 800, marginLeft: "auto", marginRight: "auto" }}>
          Vos assistants IA gèrent votre <span style={{ color: C.accent }}>administratif</span>, <span style={{ color: C.green }}>marketing</span> et <span style={{ color: C.blue }}>commercial</span>
        </h1>
        <p className="animate-fade-in-up delay-200" style={{ fontSize: "clamp(16px, 2vw, 20px)", color: C.muted, maxWidth: 600, margin: "0 auto 32px", lineHeight: 1.6 }}>
          Pendant que vous êtes sur vos chantiers, Alice, Marc et Léa gèrent vos emails, devis, Google Business, prospection et relances.
        </p>
        <div className="animate-fade-in-up delay-300" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/client/signup" className="cta-pulse" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 32px", borderRadius: 12, background: C.accent, color: "#fff", fontWeight: 700, fontSize: 17, textDecoration: "none", boxShadow: "0 4px 16px rgba(255,92,0,0.3)" }}>
            Démarrer gratuitement →
          </a>
          <a href="#pricing" className="hover-lift" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 32px", borderRadius: 12, background: C.surface, color: C.dark, fontWeight: 600, fontSize: 17, textDecoration: "none", border: `1px solid ${C.border}` }}>
            Voir les tarifs
          </a>
        </div>

        {/* Agent cards */}
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 60, flexWrap: "wrap" }}>
          {[
            { name: "Alice", role: "Admin", emoji: "📋", color: C.blue, tasks: "Emails · Devis · Factures · Relances" },
            { name: "Marc", role: "Marketing", emoji: "📢", color: C.green, tasks: "Google Business · SEO · Avis · Réseaux sociaux" },
            { name: "Léa", role: "Commercial", emoji: "💼", color: C.accent, tasks: "Prospection · Qualification · Emails · Annuaires" },
          ].map((agent, idx) => (
            <div key={agent.name} className="hover-lift hover-glow animate-fade-in-up" style={{ background: C.surface, borderRadius: 16, padding: "24px 20px", border: `2px solid ${C.border}`, width: 260, textAlign: "center", animationDelay: `${0.3 + idx * 0.15}s` }}>
              <div style={{ fontSize: 44, marginBottom: 8 }}>{agent.emoji}</div>
              <div style={{ fontWeight: 800, fontSize: 20 }}>{agent.name}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: agent.color, marginBottom: 8 }}>Agent {agent.role}</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{agent.tasks}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "80px 20px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, margin: "0 0 12px" }}>Ce que vos agents font pour vous</h2>
            <p style={{ color: C.muted, fontSize: 16, maxWidth: 500, margin: "0 auto" }}>Automatisez les tâches qui vous prennent des heures chaque semaine.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="hover-lift" style={{ background: C.bg, borderRadius: 14, padding: "24px 20px", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{f.emoji}</div>
                <h3 style={{ fontWeight: 700, fontSize: 17, margin: "0 0 6px" }}>{f.title}</h3>
                <p style={{ color: C.muted, fontSize: 14, margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, margin: "0 0 12px" }}>Opérationnel en 5 minutes</h2>
          <p style={{ color: C.muted, fontSize: 16 }}>Pas de formation, pas d'intégration complexe.</p>
        </div>
        <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { step: "1", title: "Inscription", desc: "Choisissez votre plan et créez votre compte en 2 minutes." },
            { step: "2", title: "Configuration", desc: "Nommez vos agents, connectez Gmail et Telegram." },
            { step: "3", title: "C'est parti", desc: "Vos agents commencent à travailler. Suivez tout depuis votre tableau de bord." },
          ].map(s => (
            <div key={s.step} style={{ textAlign: "center", flex: "1 1 250px", maxWidth: 300 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.accent, color: "#fff", fontWeight: 800, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>{s.step}</div>
              <h3 style={{ fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>{s.title}</h3>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "80px 20px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, margin: "0 0 12px" }}>Ils utilisent iArtisan</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} style={{ background: C.bg, borderRadius: 14, padding: "24px 20px", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 18, marginBottom: 12 }}>{"⭐".repeat(t.rating)}</div>
                <p style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 16px", fontStyle: "italic" }}>&ldquo;{t.text}&rdquo;</p>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{t.metier} — {t.ville}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, margin: "0 0 12px" }}>Tarifs simples, sans surprise</h2>
          <p style={{ color: C.muted, fontSize: 16, maxWidth: 500, margin: "0 auto" }}>14 jours d'essai gratuit sur tous les plans. Annulez quand vous voulez.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, alignItems: "start" }}>
          {PLANS.map(plan => (
            <div key={plan.key} className="hover-lift" style={{
              background: C.surface,
              borderRadius: 16,
              padding: "28px 24px",
              border: plan.badge === "Populaire" ? `2px solid ${C.accent}` : `1px solid ${C.border}`,
              position: "relative",
              boxShadow: plan.badge === "Populaire" ? "0 4px 24px rgba(255,92,0,0.12)" : "none",
            }}>
              {plan.badge && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: plan.badge === "Populaire" ? C.accent : C.dark, color: "#fff", padding: "4px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                  {plan.badge}
                </div>
              )}
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <h3 style={{ fontWeight: 800, fontSize: 24, margin: "8px 0 4px" }}>{plan.name}</h3>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>{plan.agent}</div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
                  <span style={{ fontSize: 44, fontWeight: 800 }}>{plan.price}€</span>
                  <span style={{ color: C.muted, fontSize: 14 }}>/mois</span>
                </div>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px" }}>
                {plan.features.map((f, i) => (
                  <li key={i} style={{ padding: "8px 0", fontSize: 14, display: "flex", alignItems: "flex-start", gap: 10, borderBottom: i < plan.features.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <span style={{ color: C.green, fontWeight: 700, marginTop: 1 }}>✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a href="/client/signup" style={{
                display: "block",
                textAlign: "center",
                padding: "14px 20px",
                borderRadius: 10,
                background: plan.badge === "Populaire" ? C.accent : C.dark,
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
                textDecoration: "none",
              }}>
                Essayer 14 jours gratuit
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "80px 20px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, margin: "0 0 12px" }}>Questions fréquentes</h2>
          </div>
          {FAQ.map((faq, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: "100%",
                  padding: "18px 0",
                  background: "none",
                  border: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  fontSize: 16,
                  fontWeight: 600,
                  color: C.dark,
                }}
              >
                {faq.q}
                <span style={{ fontSize: 20, color: C.muted, transition: "transform 0.2s", transform: openFaq === i ? "rotate(45deg)" : "none" }}>+</span>
              </button>
              {openFaq === i && (
                <div style={{ paddingBottom: 18, fontSize: 14, color: C.muted, lineHeight: 1.7 }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 800, margin: "0 0 16px" }}>
          Prêt à libérer du temps sur vos chantiers ?
        </h2>
        <p style={{ color: C.muted, fontSize: 17, maxWidth: 500, margin: "0 auto 32px", lineHeight: 1.6 }}>
          Rejoignez les artisans qui laissent l'IA gérer leur administratif.
        </p>
        <a href="/client/signup" className="cta-pulse" style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "18px 40px",
          borderRadius: 12,
          background: C.accent,
          color: "#fff",
          fontWeight: 700,
          fontSize: 18,
          textDecoration: "none",
          boxShadow: "0 4px 20px rgba(255,92,0,0.3)",
        }}>
          Commencer l'essai gratuit →
        </a>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 12 }}>14 jours gratuit · Sans carte bancaire · Annulation en 1 clic</p>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{ background: C.dark, color: "rgba(255,255,255,0.6)", padding: "40px 20px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14 }}>iA</div>
            <span style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>iArtisan</span>
          </div>
          <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
            <a href="/client/login" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>Connexion</a>
            <a href="/client/signup" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>Inscription</a>
            <a href="mailto:contact@iartisan.io" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>Contact</a>
          </div>
          <div style={{ fontSize: 12 }}>
            &copy; {new Date().getFullYear()} iArtisan. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
