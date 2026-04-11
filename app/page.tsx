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
  violet: "#7c3aed",
};

// ─── PLANS (mis à jour avec prénoms terrain) ─────────────────────────────────
const PLANS = [
  {
    key: "ESSENTIEL",
    name: "Essentiel",
    price: 49,
    agent: "Marie — Votre secrétaire",
    badge: null,
    reframe: "Le prix d\u2019un plein de gasoil",
    features: [
      "Devis par vocal WhatsApp en 30s",
      "Relance clients automatique",
      "Factures et suivi paiements",
      "Résumé chaque matin sur WhatsApp",
      "Rapport hebdomadaire",
      "Support email",
    ],
  },
  {
    key: "CROISSANCE",
    name: "Pro",
    price: 99,
    agent: "Marie + Lucas — Votre commercial digital",
    badge: "Populaire",
    reframe: "Moins cher qu\u2019un stagiaire",
    features: [
      "Tout Essentiel +",
      "Fiche Google optimisée en continu",
      "Posts Google et réseaux sociaux",
      "Réponse aux avis Google",
      "Audit SEO local complet",
      "Contenu site web pro",
      "Support prioritaire 6j/7",
    ],
  },
  {
    key: "PILOTE_AUTO",
    name: "Max",
    price: 179,
    agent: "Marie + Lucas + Samir — Apporteur d\u2019affaires",
    badge: "Complet",
    reframe: "Se rembourse dès le 1er client",
    features: [
      "Tout Pro +",
      "Prospection automatisée dans votre zone",
      "Qualification leads IA",
      "Relance impayés 3 niveaux",
      "Inscription annuaires pro",
      "Emails de prospection personnalisés",
      "Conseiller dédié 7j/7",
    ],
  },
];

// ─── TÉMOIGNAGES ENRICHIS ────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    name: "Ahmed El Mansouri",
    entreprise: "SDZ BTP",
    metier: "Entreprise générale",
    ville: "Marseille",
    text: "6 nouveaux clients en 3 semaines. Je regrette de ne pas avoir commencé plus tôt.",
    result: "+6 clients/mois, 8h économisées/semaine",
    rating: 5,
  },
  {
    name: "François Fernandez",
    entreprise: "FF Électricité",
    metier: "Électricien",
    ville: "Toulon",
    text: "Je dictais mon devis en voiture, il était envoyé avant que j\u2019arrive au chantier.",
    result: "2h/jour gagnées sur les devis",
    rating: 5,
  },
  {
    name: "Djamal Bensaïd",
    entreprise: "DB Peinture",
    metier: "Peintre",
    ville: "Lyon",
    text: "En 3 semaines, je suis passé de la page 3 à #1 sur Google dans ma ville.",
    result: "+40% de demandes de devis",
    rating: 5,
  },
];

// ─── OBJECTIONS ──────────────────────────────────────────────────────────────
const OBJECTIONS = [
  {
    q: "\u00ab C\u2019est trop cher \u00bb",
    a: "49\u20AC/mois, c\u2019est le prix d\u2019un plein de gasoil. Sauf que ce plein vous rapporte en moyenne 6 clients et vous fait gagner 8h par semaine. Un seul devis perdu parce que vous étiez sur le toit = 500 à 2\u202F000\u20AC de CA en moins. iArtisan se rembourse dès le premier client gagné. Et les 14 premiers jours sont gratuits.",
  },
  {
    q: "\u00ab C\u2019est compliqué, j\u2019ai pas le temps \u00bb",
    a: "Si vous savez envoyer un vocal WhatsApp, vous savez utiliser iArtisan. On ne vous demande pas d\u2019apprendre un logiciel. Tout passe par WhatsApp et email — les outils que vous utilisez déjà. Notre équipe configure tout. Vous, vous continuez à bosser.",
  },
  {
    q: "\u00ab Je fais pas confiance à un robot \u00bb",
    a: "Vos clients ne voient jamais l\u2019IA. Ils reçoivent des devis professionnels avec votre nom, votre logo, vos prix. Comme si vous aviez une secrétaire qui connaît parfaitement votre métier. Et vous gardez le contrôle : chaque devis est validé par vous avant envoi.",
  },
  {
    q: "\u00ab J\u2019ai déjà essayé des trucs, ça marche jamais \u00bb",
    a: "On n\u2019est pas un logiciel de gestion de plus. Vous avez sûrement testé des outils où il faut tout rentrer à la main, passer 2h à configurer. iArtisan, c\u2019est l\u2019inverse : on fait le travail pour vous. Vous n\u2019ouvrez même pas d\u2019application. Tout arrive sur WhatsApp.",
  },
  {
    q: "\u00ab Et si je veux arrêter ? \u00bb",
    a: "Un clic et c\u2019est fini. Pas de préavis, pas de frais cachés. Sans engagement, résiliable quand vous voulez. Et on vous restitue toutes vos données. Mais honnêtement ? 94% de nos artisans restent après l\u2019essai gratuit.",
  },
];

// ─── FAQ TECHNIQUE ──────────────────────────────────────────────────────────
const FAQ = [
  { q: "Mes données sont-elles sécurisées ?", a: "Oui. Connexion Gmail via OAuth (on ne stocke jamais votre mot de passe). Données hébergées en France, chiffrement bout en bout. Conforme RGPD." },
  { q: "Je peux changer de plan à tout moment ?", a: "Oui, montez ou descendez quand vous voulez depuis votre espace. La différence est ajustée au prorata." },
  { q: "Les agents remplacent-ils un employé ?", a: "Non, ils automatisent les tâches répétitives pour vous libérer du temps sur vos chantiers. Vous restez le patron, ils sont vos bras droits." },
  { q: "Ça marche avec quel téléphone ?", a: "Tout smartphone avec WhatsApp et Telegram. iPhone ou Android, peu importe. Pas besoin d\u2019ordinateur." },
];

export default function LandingPage() {
  const [openObj, setOpenObj] = useState<number>(0); // First open by default
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: C.dark, background: C.bg }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* ─── NAV ─── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(247,244,239,0.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 16 }}>iA</div>
            <span style={{ fontWeight: 800, fontSize: 20 }}>iArtisan</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Nav links — hidden on small mobile */}
            <div style={{ display: "flex", gap: 20 }} className="nav-links-desktop">
              <a href="#comment-ca-marche" style={{ color: C.dark, textDecoration: "none", fontWeight: 600, fontSize: 14 }}>Comment ça marche</a>
              <a href="#pricing" style={{ color: C.dark, textDecoration: "none", fontWeight: 600, fontSize: 14 }}>Tarifs</a>
              <a href="#temoignages" style={{ color: C.dark, textDecoration: "none", fontWeight: 600, fontSize: 14 }}>Témoignages</a>
            </div>
            <a href="tel:+33176340256" style={{ color: C.dark, fontWeight: 600, fontSize: 14, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              📞 01 76 34 02 56
            </a>
            <a href="/client/login" style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.dark, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>Connexion</a>
            <a href="/client/signup" style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>Essai gratuit</a>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 20px 40px" }}>
        {/* Proof bar */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <span style={{ display: "inline-block", background: `${C.green}12`, color: C.green, padding: "6px 18px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
            Déjà 247 artisans qui ne ratent plus un client
          </span>
        </div>

        <div style={{ display: "flex", gap: 48, alignItems: "center", flexWrap: "wrap" }}>
          {/* Left — copy */}
          <div style={{ flex: "1 1 440px", minWidth: 0 }}>
            <h1 style={{ fontSize: "clamp(30px, 4.5vw, 50px)", fontWeight: 800, lineHeight: 1.12, margin: "0 0 20px" }}>
              Vos clients appellent.<br />
              Vous êtes sur le chantier.<br />
              <span style={{ color: C.accent }}>On s&apos;occupe de tout.</span>
            </h1>
            <p style={{ fontSize: "clamp(15px, 1.8vw, 18px)", color: C.muted, lineHeight: 1.7, margin: "0 0 28px", maxWidth: 520 }}>
              iArtisan répond à vos demandes de devis, relance vos clients et vous envoie un résumé chaque matin sur WhatsApp.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <a href="/client/signup" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 28px", borderRadius: 12, background: C.accent, color: "#fff", fontWeight: 700, fontSize: 16, textDecoration: "none", boxShadow: "0 4px 16px rgba(255,92,0,0.3)" }}>
                Essai gratuit 14 jours →
              </a>
              <a href="#demo" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 28px", borderRadius: 12, background: C.surface, color: C.dark, fontWeight: 600, fontSize: 16, textDecoration: "none", border: `1px solid ${C.border}` }}>
                Voir une démo en 2 min
              </a>
            </div>
            <p style={{ fontSize: 13, color: C.muted }}>Sans carte bancaire · Sans engagement · Résiliable en 1 clic</p>
          </div>

          {/* Right — WhatsApp simulation */}
          <div style={{ flex: "1 1 360px", minWidth: 280, maxWidth: 420 }}>
            <div style={{ background: "#075e54", borderRadius: 20, padding: "16px 14px 20px", boxShadow: "0 8px 40px rgba(0,0,0,0.12)" }}>
              {/* WA header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "0 4px" }}>
                <div style={{ width: 36, height: 36, borderRadius: 18, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14 }}>iA</div>
                <div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Marie — iArtisan</div>
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>en ligne</div>
                </div>
              </div>
              {/* Messages */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ background: "#dcf8c6", borderRadius: "10px 10px 10px 2px", padding: "10px 14px", fontSize: 13, lineHeight: 1.5, maxWidth: "88%", alignSelf: "flex-end", color: "#111" }}>
                  Marie, fais un devis pour M. Durand, rénovation salle de bain, 3500€ HT 🎤
                  <div style={{ fontSize: 10, color: "#7a7a6a", textAlign: "right", marginTop: 4 }}>09:14 ✓✓</div>
                </div>
                <div style={{ background: "#fff", borderRadius: "10px 10px 2px 10px", padding: "10px 14px", fontSize: 13, lineHeight: 1.5, maxWidth: "88%", color: "#111" }}>
                  ✅ C&apos;est fait ! Devis #127 envoyé à M. Durand par email.
                  <br /><br />
                  <strong>Votre matinée :</strong><br />
                  📩 3 nouvelles demandes de devis<br />
                  💰 1 facture payée (M. Leblanc, 2 800€)<br />
                  ⭐ 1 nouvel avis Google 5 étoiles
                  <div style={{ fontSize: 10, color: "#7a7a6a", marginTop: 4 }}>09:15</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: "flex", justifyContent: "center", gap: 32, marginTop: 48, flexWrap: "wrap" }}>
          {[
            { value: "247", label: "artisans actifs" },
            { value: "1 200+", label: "leads générés" },
            { value: "4,8★", label: "satisfaction" },
            { value: "8h", label: "gagnées/semaine" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.dark }}>{s.value}</div>
              <div style={{ fontSize: 13, color: C.muted }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── COMMENT ÇA MARCHE ─── */}
      <section id="comment-ca-marche" style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "80px 20px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, margin: "0 0 12px" }}>Comment ça marche ? Simple comme un coup de fil.</h2>
            <p style={{ color: C.muted, fontSize: 16, maxWidth: 520, margin: "0 auto" }}>Pas de logiciel à installer. Pas de formation. On fait tout pour vous.</p>
          </div>
          <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { step: "1", title: "Choisissez votre formule", desc: "Répondez à 5 questions sur votre activité. Ça prend 3 minutes, ça marche sur le téléphone.", icon: "📱", quote: "J\u2019ai fait ça un dimanche soir en 5 min." },
              { step: "2", title: "On configure tout", desc: "Notre équipe crée votre site, optimise votre fiche Google et programme vos assistants. Vous n\u2019avez rien à faire.", icon: "⚙️", quote: "Je m\u2019attendais à galérer, en fait j\u2019ai rien eu à faire." },
              { step: "3", title: "Les clients arrivent", desc: "Vous recevez vos premières demandes de devis sur WhatsApp. Répondez d\u2019un vocal, on s\u2019occupe du reste.", icon: "🎉", quote: "Le mardi j\u2019avais mon premier lead." },
            ].map(s => (
              <div key={s.step} style={{ flex: "1 1 280px", maxWidth: 320, background: C.bg, borderRadius: 16, padding: "28px 24px", border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.accent, color: "#fff", fontWeight: 800, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.step}</div>
                  <span style={{ fontSize: 28 }}>{s.icon}</span>
                </div>
                <h3 style={{ fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>{s.title}</h3>
                <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, margin: "0 0 14px" }}>{s.desc}</p>
                <div style={{ fontSize: 13, fontStyle: "italic", color: C.green, lineHeight: 1.5 }}>
                  &ldquo;{s.quote}&rdquo;
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 36 }}>
            <a href="/client/signup" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 10, background: C.accent, color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
              Démarrer mon essai gratuit — ça prend 3 minutes
            </a>
          </div>
        </div>
      </section>

      {/* ─── AGENTS / ÉQUIPE — JTBD ─── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, margin: "0 0 12px" }}>Votre équipe, sans les charges</h2>
          <p style={{ color: C.muted, fontSize: 16, maxWidth: 540, margin: "0 auto" }}>Chaque assistant remplace un travail que vous faites aujourd&apos;hui à contrecœur.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Marie */}
          <div style={{ background: C.surface, borderRadius: 16, padding: "28px 24px", border: `2px solid ${C.blue}20` }}>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 400px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 36 }}>👩‍💼</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 20 }}>Marie</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.blue }}>Votre secrétaire · Incluse dans toutes les formules</div>
                  </div>
                </div>
                <p style={{ fontSize: 15, color: C.accent, fontWeight: 700, fontStyle: "italic", margin: "0 0 14px", lineHeight: 1.5 }}>
                  &ldquo;Vous perdez 5h/semaine à faire des devis et à relancer vos clients.&rdquo;
                </p>
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    "Génère vos devis depuis un simple vocal WhatsApp",
                    "Relance les clients qui n\u2019ont pas répondu",
                    "Vous envoie un résumé chaque matin",
                    "Gère vos factures et suit les paiements",
                  ].map(f => (
                    <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
                      <span style={{ color: C.green, fontWeight: 700, marginTop: 1 }}>✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ flex: "0 0 280px", background: C.bg, borderRadius: 12, padding: "18px 20px", alignSelf: "center" }}>
                <div style={{ fontSize: 13, fontStyle: "italic", color: C.dark, lineHeight: 1.6, marginBottom: 10 }}>
                  &ldquo;Je dictais mon devis en voiture, il était envoyé avant que j&apos;arrive au chantier.&rdquo;
                </div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>François F. — FF Électricité, Toulon</div>
              </div>
            </div>
          </div>

          {/* Lucas */}
          <div style={{ background: C.surface, borderRadius: 16, padding: "28px 24px", border: `2px solid ${C.green}20` }}>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 400px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 36 }}>📢</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 20 }}>Lucas</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.green }}>Votre commercial digital · Formules Pro et Max</div>
                  </div>
                </div>
                <p style={{ fontSize: 15, color: C.accent, fontWeight: 700, fontStyle: "italic", margin: "0 0 14px", lineHeight: 1.5 }}>
                  &ldquo;Votre fiche Google a 2 avis et votre site date de 2019. Les clients passent à côté de vous.&rdquo;
                </p>
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    "Crée et maintient votre site web professionnel",
                    "Optimise votre fiche Google pour être #1 local",
                    "Répond aux avis Google (positifs et négatifs)",
                    "Vous rend visible dans votre zone",
                  ].map(f => (
                    <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
                      <span style={{ color: C.green, fontWeight: 700, marginTop: 1 }}>✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ flex: "0 0 280px", background: C.bg, borderRadius: 12, padding: "18px 20px", alignSelf: "center" }}>
                <div style={{ fontSize: 13, fontStyle: "italic", color: C.dark, lineHeight: 1.6, marginBottom: 10 }}>
                  &ldquo;En 3 semaines, je suis passé de la page 3 à #1 sur Google à Lyon.&rdquo;
                </div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Djamal B. — DB Peinture, Lyon</div>
              </div>
            </div>
          </div>

          {/* Samir */}
          <div style={{ background: C.surface, borderRadius: 16, padding: "28px 24px", border: `2px solid ${C.accent}20` }}>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 400px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 36 }}>🎯</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 20 }}>Samir</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.accent }}>Votre apporteur d&apos;affaires · Formule Max</div>
                  </div>
                </div>
                <p style={{ fontSize: 15, color: C.accent, fontWeight: 700, fontStyle: "italic", margin: "0 0 14px", lineHeight: 1.5 }}>
                  &ldquo;Vous attendez que le téléphone sonne. Samir va chercher les clients pour vous.&rdquo;
                </p>
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    "Génère des leads qualifiés dans votre zone",
                    "Vous inscrit sur les annuaires pro",
                    "Relance les devis sans réponse",
                    "Suit les impayés jusqu\u2019au paiement",
                  ].map(f => (
                    <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
                      <span style={{ color: C.green, fontWeight: 700, marginTop: 1 }}>✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ flex: "0 0 280px", background: C.bg, borderRadius: 12, padding: "18px 20px", alignSelf: "center" }}>
                <div style={{ fontSize: 13, fontStyle: "italic", color: C.dark, lineHeight: 1.6, marginBottom: 10 }}>
                  &ldquo;6 nouveaux clients en 3 semaines. Le meilleur investissement de l&apos;année.&rdquo;
                </div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Ahmed E.M. — SDZ BTP, Marseille</div>
              </div>
            </div>
          </div>
        </div>

        {/* Transition vers pricing */}
        <div style={{ textAlign: "center", marginTop: 40, padding: "24px 0" }}>
          <p style={{ fontSize: "clamp(18px, 2.5vw, 24px)", fontWeight: 800, margin: "0 0 8px" }}>
            Combien ça coûte d&apos;embaucher Marie, Lucas et Samir ?
          </p>
          <p style={{ fontSize: 15, color: C.muted, margin: "0 0 16px" }}>Moins cher qu&apos;un stagiaire. Sans les charges. Et ils bossent 24h/24.</p>
          <a href="#pricing" style={{ color: C.accent, fontWeight: 700, fontSize: 16, textDecoration: "none" }}>Voir les tarifs ↓</a>
        </div>
      </section>

      {/* ─── TÉMOIGNAGES ─── */}
      <section id="temoignages" style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "80px 20px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, margin: "0 0 12px" }}>Ils ont essayé. Ils sont restés.</h2>
            <p style={{ color: C.muted, fontSize: 15 }}>94% de nos artisans restent après l&apos;essai gratuit.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} style={{ background: C.bg, borderRadius: 16, padding: "28px 24px", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 18, marginBottom: 14 }}>{"⭐".repeat(t.rating)}</div>
                <p style={{ fontSize: 16, lineHeight: 1.6, margin: "0 0 14px", fontWeight: 700 }}>&ldquo;{t.text}&rdquo;</p>
                <div style={{ fontSize: 13, color: C.green, fontWeight: 600, marginBottom: 14, background: `${C.green}10`, display: "inline-block", padding: "4px 12px", borderRadius: 6 }}>
                  📈 {t.result}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                  <div style={{ fontSize: 13, color: C.muted }}>{t.entreprise} — {t.metier}, {t.ville}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Réassurance badges */}
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 32, flexWrap: "wrap" }}>
            {[
              "🇫🇷 Données hébergées en France",
              "🔒 Conforme RGPD",
              "💬 Support 100% français",
              "⚡ Résiliable en 1 clic",
            ].map(badge => (
              <span key={badge} style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>{badge}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, margin: "0 0 12px" }}>Tarifs simples, sans surprise</h2>
          <p style={{ color: C.muted, fontSize: 16, maxWidth: 500, margin: "0 auto" }}>14 jours d&apos;essai gratuit sur tous les plans. Sans carte bancaire.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, alignItems: "start" }}>
          {PLANS.map(plan => (
            <div key={plan.key} style={{
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
                <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, marginTop: 4 }}>{plan.reframe}</div>
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
              <p style={{ textAlign: "center", fontSize: 11, color: C.muted, margin: "8px 0 0" }}>Sans carte bancaire</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── OBJECTIONS — Section dédiée ─── */}
      <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "80px 20px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, margin: "0 0 12px" }}>Vos questions, nos réponses honnêtes</h2>
            <p style={{ color: C.muted, fontSize: 15 }}>On sait ce que vous pensez. Et on a les réponses.</p>
          </div>
          {OBJECTIONS.map((obj, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${C.border}`, background: openObj === i ? `${C.accent}04` : "transparent", borderRadius: openObj === i ? 12 : 0, marginBottom: 4 }}>
              <button
                onClick={() => setOpenObj(openObj === i ? -1 : i)}
                style={{
                  width: "100%",
                  padding: "18px 16px",
                  background: "none",
                  border: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  fontSize: 17,
                  fontWeight: 700,
                  color: C.dark,
                }}
              >
                {obj.q}
                <span style={{ fontSize: 20, color: C.muted, transition: "transform 0.2s", transform: openObj === i ? "rotate(45deg)" : "none", flexShrink: 0, marginLeft: 12 }}>+</span>
              </button>
              {openObj === i && (
                <div style={{ padding: "0 16px 18px", fontSize: 15, color: "#444", lineHeight: 1.7 }}>
                  {obj.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── FAQ TECHNIQUE ─── */}
      <section style={{ maxWidth: 700, margin: "0 auto", padding: "60px 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Questions techniques</h3>
        </div>
        {FAQ.map((faq, i) => (
          <div key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
            <button
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              style={{
                width: "100%",
                padding: "16px 0",
                background: "none",
                border: "none",
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: 15,
                fontWeight: 600,
                color: C.dark,
              }}
            >
              {faq.q}
              <span style={{ fontSize: 18, color: C.muted, transition: "transform 0.2s", transform: openFaq === i ? "rotate(45deg)" : "none" }}>+</span>
            </button>
            {openFaq === i && (
              <div style={{ paddingBottom: 16, fontSize: 14, color: C.muted, lineHeight: 1.7 }}>
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* ─── CTA FINAL ─── */}
      <section style={{ background: C.dark, padding: "80px 20px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 800, margin: "0 0 16px", color: "#fff" }}>
            Demain matin, vous pourriez recevoir vos demandes de devis sur WhatsApp.
          </h2>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, margin: "0 0 32px", lineHeight: 1.6 }}>
            Essai gratuit 14 jours — sans carte bancaire — sans engagement
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
            <a href="/client/signup" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "18px 36px",
              borderRadius: 12,
              background: C.accent,
              color: "#fff",
              fontWeight: 700,
              fontSize: 17,
              textDecoration: "none",
              boxShadow: "0 4px 20px rgba(255,92,0,0.4)",
            }}>
              Démarrer mon essai gratuit →
            </a>
            <a href="tel:+33176340256" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "18px 28px",
              borderRadius: 12,
              background: "transparent",
              color: "#fff",
              fontWeight: 600,
              fontSize: 16,
              textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.3)",
            }}>
              📞 Être rappelé
            </a>
          </div>
          {/* Micro testimonial */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24 }}>
            <span style={{ fontSize: 14 }}>⭐⭐⭐⭐⭐</span>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>&ldquo;Le meilleur investissement de l&apos;année&rdquo; — Ahmed, SDZ BTP</span>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 20, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>🇫🇷 Données hébergées en France</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>🔒 Conforme RGPD</span>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{ background: C.dark, borderTop: "1px solid rgba(255,255,255,0.1)", padding: "48px 20px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 32, marginBottom: 32 }}>
            {/* Branding */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14 }}>iA</div>
                <span style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>iArtisan</span>
              </div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                L&apos;assistant IA des artisans du bâtiment.
              </p>
              <div style={{ marginTop: 12 }}>
                <a href="tel:+33176340256" style={{ color: "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>📞 01 76 34 02 56</a>
              </div>
              <div style={{ marginTop: 6 }}>
                <a href="mailto:contact@iartisan.io" style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, textDecoration: "none" }}>contact@iartisan.io</a>
              </div>
            </div>
            {/* Produit */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", marginBottom: 12 }}>Produit</div>
              {["Comment ça marche", "Tarifs", "Témoignages"].map(link => (
                <a key={link} href={`#${link.toLowerCase().replace(/[^a-z]/g, "-")}`} style={{ display: "block", color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: 13, marginBottom: 8 }}>{link}</a>
              ))}
            </div>
            {/* Métiers */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", marginBottom: 12 }}>Métiers</div>
              {["Plombier", "Électricien", "Peintre", "Menuisier", "Maçon", "Carreleur"].map(m => (
                <span key={m} style={{ display: "block", color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 8 }}>{m}</span>
              ))}
            </div>
            {/* Légal */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", marginBottom: 12 }}>Légal</div>
              {["CGV", "Mentions légales", "Politique de confidentialité"].map(l => (
                <span key={l} style={{ display: "block", color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 8 }}>{l}</span>
              ))}
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 20, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            &copy; {new Date().getFullYear()} iArtisan · Fait en France 🇫🇷 · Données hébergées en Europe
          </div>
        </div>
      </footer>

      {/* ─── STICKY MOBILE CTA ─── */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 90,
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        padding: "10px 16px calc(10px + env(safe-area-inset-bottom))",
        display: "flex",
        gap: 10,
      }} className="sticky-mobile-cta">
        <a href="/client/signup" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 0", borderRadius: 10, background: C.accent, color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
          Essai gratuit 14j
        </a>
        <a href="tel:+33176340256" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 18px", borderRadius: 10, background: C.surface, color: C.dark, fontWeight: 600, fontSize: 14, textDecoration: "none", border: `1px solid ${C.border}` }}>
          📞 Appeler
        </a>
      </div>

      {/* ─── STYLE OVERRIDES FOR RESPONSIVE ─── */}
      <style>{`
        @media (min-width: 768px) {
          .sticky-mobile-cta { display: none !important; }
        }
        @media (max-width: 767px) {
          .nav-links-desktop { display: none !important; }
          footer + .sticky-mobile-cta ~ * { padding-bottom: 80px; }
        }
        @media (max-width: 480px) {
          section { padding-left: 16px !important; padding-right: 16px !important; }
        }
      `}</style>
    </div>
  );
}
