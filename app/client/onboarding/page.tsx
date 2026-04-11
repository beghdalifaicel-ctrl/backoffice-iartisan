"use client";

import { useState, useEffect } from "react";
import { ArrowRight, ArrowLeft, Check, Mail, MessageCircle, Building, Sparkles, Zap, FileText, Send } from "lucide-react";

// ─── DESIGN TOKENS ───────────────────
const C = {
  bg: "#f7f4ef", dark: "#1a1a14", accent: "#ff5c00", green: "#2d6a4f",
  muted: "#7a7a6a", surface: "#fff", border: "#e5e0d8",
};

// Noms fonctionnels — plus de prénoms
const PLAN_AGENTS: Record<string, { type: string; emoji: string; role: string; desc: string }[]> = {
  ESSENTIEL: [
    { type: "ADMIN", emoji: "📋", role: "Assistant Gestion", desc: "Je m'occupe de vos devis et factures. Plus besoin d'y penser le soir." },
  ],
  CROISSANCE: [
    { type: "ADMIN", emoji: "📋", role: "Assistant Gestion", desc: "Je m'occupe de vos devis et factures. Plus besoin d'y penser le soir." },
    { type: "MARKETING", emoji: "📢", role: "Assistant Visibilité", desc: "Je gère votre fiche Google et vos avis. Vous restez visible sans effort." },
  ],
  PILOTE_AUTO: [
    { type: "ADMIN", emoji: "📋", role: "Assistant Gestion", desc: "Je m'occupe de vos devis et factures. Plus besoin d'y penser le soir." },
    { type: "MARKETING", emoji: "📢", role: "Assistant Visibilité", desc: "Je gère votre fiche Google et vos avis. Vous restez visible sans effort." },
    { type: "COMMERCIAL", emoji: "💼", role: "Assistant Prospection", desc: "Je trouve de nouveaux clients pour vous. Vous n'avez qu'à choisir." },
  ],
};

export default function ClientOnboardingPage() {
  const [step, setStep] = useState(0); // Start at 0 = welcome/simulation
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState("");
  const [plan, setPlan] = useState("PILOTE_AUTO");

  // Step 1 — Company info (réduit)
  const [company, setCompany] = useState("");
  const [metier, setMetier] = useState("");
  const [ville, setVille] = useState("");
  const [siret, setSiret] = useState("");

  // Load onboarding state
  useEffect(() => {
    fetch("/api/client/onboarding")
      .then(r => {
        if (r.status === 401) { window.location.href = "/client/login"; return null; }
        return r.json();
      })
      .then(data => {
        if (!data?.client) return;
        setClientId(data.client.id);
        setPlan(data.client.plan || "PILOTE_AUTO");
        setCompany(data.client.company || "");
        setMetier(data.client.metier || "");
        setVille(data.client.ville || "");
        setSiret(data.client.siret || "");
        if (data.onboardingCompleted) { window.location.href = "/client"; return; }
        if (data.onboardingStep > 0) setStep(data.onboardingStep + 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const agents = PLAN_AGENTS[plan] || PLAN_AGENTS.PILOTE_AUTO;

  const saveStep = async (stepNum: number, data: any) => {
    setSaving(true);
    try {
      await fetch("/api/client/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: stepNum, data }),
      });
      setStep(stepNum + 1);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: C.muted, fontSize: 15 }}>Chargement...</div>
      </div>
    );
  }

  // 5 étapes : 0=Welcome, 1=Infos, 2=Équipe, 3=Gmail, 4=Telegram, 5=Done
  const totalSteps = 5;
  const progressWidth = `${(Math.min(step, totalSteps) / totalSteps) * 100}%`;

  return (
    <div style={{ minHeight: "100dvh" as any, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowX: "hidden" as any }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{
        width: "100%", maxWidth: 440, background: C.surface, borderRadius: 16,
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)", overflow: "hidden",
        fontFamily: "'Bricolage Grotesque', sans-serif",
      }}>

        {/* Progress bar */}
        <div style={{ height: 4, background: C.border }}>
          <div style={{ height: 4, background: C.accent, width: progressWidth, transition: "width 0.3s ease" }} />
        </div>

        {/* Header */}
        <div style={{ padding: "24px 20px 0", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 15 }}>iA</div>
            <span style={{ fontSize: 22, fontWeight: 800, color: C.dark }}>iArtisan</span>
          </div>
          {step > 0 && <p style={{ color: C.muted, marginTop: 4, fontSize: 13 }}>Étape {Math.min(step, totalSteps)} sur {totalSteps}</p>}
        </div>

        <div style={{ padding: "20px 20px 24px" }}>

          {/* ── ÉTAPE 0 : Bienvenue + Simulation live (quick win) ── */}
          {step === 0 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: C.dark, marginBottom: 8, textAlign: "center" }}>
                Bienvenue chez iArtisan
              </h2>
              <p style={{ color: C.muted, marginBottom: 20, fontSize: 14, lineHeight: 1.6, textAlign: "center" }}>
                Vos assistants sont prêts à bosser.<br />Voici ce qu&apos;ils feront pour vous dès demain :
              </p>

              {/* Simulation : aperçu d'un email de relance */}
              <div style={{
                background: "#fafaf8", borderRadius: 12, padding: 16, marginBottom: 16,
                border: `1px solid ${C.border}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: `${C.accent}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Send size={14} color={C.accent} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.dark }}>📋 Assistant Gestion</div>
                    <div style={{ fontSize: 11, color: C.muted }}>Relance automatique</div>
                  </div>
                </div>
                <div style={{ background: C.surface, borderRadius: 10, padding: 14, fontSize: 13, lineHeight: 1.6, color: C.dark, border: `1px solid ${C.border}` }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Objet : Votre devis en attente</div>
                  <div style={{ color: "#555" }}>
                    Bonjour M. Durand,<br /><br />
                    Vous aviez reçu un devis de <strong>{company || "votre entreprise"}</strong> le 5 avril pour des travaux de rénovation.
                    Souhaitez-vous qu&apos;on planifie une date de début ?<br /><br />
                    Cordialement,<br />
                    <em>{company || "Votre entreprise"}</em>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: C.green, fontWeight: 600, marginTop: 8, textAlign: "center" }}>
                  ✅ Envoyé automatiquement — sans que vous n&apos;ayez rien à faire
                </div>
              </div>

              {/* Quick preview of other capabilities */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {[
                  { emoji: "📄", label: "Devis auto" },
                  { emoji: "⭐", label: "Avis Google" },
                  { emoji: "🎯", label: "Nouveaux clients" },
                ].map(item => (
                  <div key={item.label} style={{ flex: 1, background: "#fafaf8", borderRadius: 10, padding: "10px 6px", textAlign: "center", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{item.emoji}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.dark }}>{item.label}</div>
                  </div>
                ))}
              </div>

              <Btn onClick={() => setStep(1)}>
                C&apos;est parti, on configure ! <ArrowRight size={18} />
              </Btn>
            </div>
          )}

          {/* ── ÉTAPE 1 : Infos entreprise (simplifié — 4 champs au lieu de 7) ── */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.dark, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <Building size={20} />
                Votre entreprise
              </h2>
              <p style={{ color: C.muted, marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
                Le strict minimum pour démarrer. Vous compléterez le reste plus tard.
              </p>

              <div style={{ display: "grid", gap: 14 }}>
                <Input label="Nom de l'entreprise *" value={company} onChange={setCompany} placeholder="Ex: Dupont Plomberie" />
                <Input label="Métier *" value={metier} onChange={setMetier} placeholder="Ex: Plombier, Électricien..." />
                <Input label="Ville *" value={ville} onChange={setVille} placeholder="Lyon" />
                <Input label="SIRET (optionnel)" value={siret} onChange={setSiret} placeholder="123 456 789 00012" inputMode="numeric" />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <BtnSecondary onClick={() => setStep(0)}>
                  <ArrowLeft size={16} /> Retour
                </BtnSecondary>
                <Btn
                  disabled={!company || !metier || !ville || saving}
                  onClick={() => saveStep(1, { company, metier, ville, siret })}
                >
                  {saving ? "..." : "Continuer"} <ArrowRight size={18} />
                </Btn>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 2 : Rencontrez votre équipe (pas "Nommez vos agents") ── */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.dark, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={20} />
                Votre équipe IA
              </h2>
              <p style={{ color: C.muted, marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
                Ils bossent pendant que vous êtes sur le chantier.
              </p>

              <div style={{ display: "grid", gap: 12 }}>
                {agents.map(agent => (
                  <div key={agent.type} style={{
                    border: `2px solid ${C.border}`, borderRadius: 12, padding: 16,
                    background: "#fafaf8",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <span style={{ fontSize: 32 }}>{agent.emoji}</span>
                      <div>
                        <div style={{ fontWeight: 700, color: C.dark, fontSize: 15 }}>{agent.role}</div>
                        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginTop: 4 }}>
                          &ldquo;{agent.desc}&rdquo;
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <BtnSecondary onClick={() => setStep(1)}>
                  <ArrowLeft size={16} /> Retour
                </BtnSecondary>
                <Btn
                  disabled={saving}
                  onClick={() => saveStep(2, {
                    agents: agents.map(a => ({
                      agentType: a.type,
                      displayName: a.role,
                    }))
                  })}
                >
                  {saving ? "..." : "Continuer"} <ArrowRight size={18} />
                </Btn>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 3 : Connecter Gmail ── */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.dark, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <Mail size={20} />
                Connectez votre email
              </h2>
              <p style={{ color: C.muted, marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
                Pour que votre Assistant Gestion puisse lire et envoyer vos emails pro.
              </p>

              <div style={{ background: "#f8f9fa", borderRadius: 12, padding: 20, textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>📧</div>
                <a
                  href={`/api/integrations/gmail/auth?clientId=${clientId}`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: "#4285F4", color: "#fff", padding: "14px 24px",
                    borderRadius: 10, fontWeight: 600, textDecoration: "none", fontSize: 15,
                    WebkitTapHighlightColor: "transparent", minHeight: 48,
                  }}
                >
                  <Mail size={18} /> Connecter Gmail
                </a>
                <p style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>Connexion sécurisée via Google OAuth.</p>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <BtnSecondary onClick={() => setStep(2)}>
                  <ArrowLeft size={16} /> Retour
                </BtnSecondary>
                <Btn disabled={saving} onClick={() => saveStep(3, {})}>
                  {saving ? "..." : "Continuer"} <ArrowRight size={18} />
                </Btn>
              </div>
              <p style={{ fontSize: 12, color: C.muted, textAlign: "center", marginTop: 10 }}>
                Vous pourrez connecter Gmail plus tard depuis votre profil.
              </p>
            </div>
          )}

          {/* ── ÉTAPE 4 : Connecter Telegram ── */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.dark, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <MessageCircle size={20} />
                Parlez à vos assistants
              </h2>
              <p style={{ color: C.muted, marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
                Connectez Telegram pour discuter avec eux depuis votre téléphone.
              </p>

              <div style={{ background: "#f8f9fa", borderRadius: 12, padding: 20, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ fontSize: 32 }}>✈️</div>
                  <div>
                    <div style={{ fontWeight: 700, color: C.dark, fontSize: 15 }}>Telegram</div>
                    <div style={{ fontSize: 12, color: C.muted }}>Gratuit, rapide, illimité</div>
                  </div>
                </div>

                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <div style={{ display: "inline-block", background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                    {clientId && (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://t.me/iartisan_agent_bot?start=${clientId}`)}&margin=0`}
                        alt="QR Code Telegram"
                        width={180} height={180}
                        style={{ display: "block", borderRadius: 4 }}
                      />
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: C.dark, fontWeight: 600, marginTop: 10 }}>Scannez pour ouvrir Telegram</p>
                </div>

                <div style={{ fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 1.7, marginBottom: 4 }}>ou ouvrez directement :</div>
                <a
                  href={`https://t.me/iartisan_agent_bot?start=${clientId}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: "#0088cc", color: "#fff", padding: "14px 20px",
                    borderRadius: 10, fontWeight: 600, textDecoration: "none", fontSize: 15,
                    WebkitTapHighlightColor: "transparent", minHeight: 48,
                  }}
                >
                  <MessageCircle size={18} /> Ouvrir dans Telegram
                </a>
                <p style={{ fontSize: 12, color: C.muted, textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
                  Votre compte sera lié automatiquement.
                  <br />Essayez : <em style={{ color: C.accent }}>&quot;Aide&quot;</em> ou <em style={{ color: C.accent }}>&quot;Fais-moi un devis&quot;</em>
                </p>
              </div>

              <div style={{ background: "#e8f5e9", borderRadius: 12, padding: 14, marginBottom: 14, opacity: 0.7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 22 }}>💬</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>WhatsApp</div>
                    <div style={{ fontSize: 11, color: C.muted }}>Bientôt disponible</div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <BtnSecondary onClick={() => setStep(3)}>
                  <ArrowLeft size={16} /> Retour
                </BtnSecondary>
                <Btn disabled={saving} onClick={() => saveStep(4, {})}>
                  {saving ? "..." : "Terminer"} <Check size={18} />
                </Btn>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 5 : C'est prêt — CTA "Lancez votre premier outil" ── */}
          {step === 5 && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 56, marginBottom: 14 }}>🚀</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
                C&apos;est prêt !
              </h2>
              <p style={{ color: C.muted, marginBottom: 20, lineHeight: 1.6, fontSize: 14 }}>
                Votre équipe IA est configurée et prête à bosser pour vous.
              </p>

              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
                {agents.map(a => (
                  <div key={a.type} style={{
                    background: C.bg, borderRadius: 12, padding: "14px 12px",
                    textAlign: "center", minWidth: 80, flex: "1 1 0", maxWidth: 140,
                  }}>
                    <div style={{ fontSize: 26 }}>{a.emoji}</div>
                    <div style={{ fontWeight: 700, color: C.dark, marginTop: 4, fontSize: 13 }}>{a.role}</div>
                  </div>
                ))}
              </div>

              {/* CTA : Lancer le premier outil (pas juste "Mon tableau de bord") */}
              <a href="/client" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: C.accent, color: "#fff", padding: "14px 28px",
                borderRadius: 10, fontWeight: 700, textDecoration: "none",
                fontSize: 15, WebkitTapHighlightColor: "transparent", minHeight: 48,
              }}>
                <Zap size={18} /> C&apos;est parti, lancez votre premier outil
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── UI Components ────────────────────────────────────────────
function Input({ label, value, onChange, placeholder, inputMode }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; inputMode?: "text" | "numeric" | "tel" | "email";
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 4 }}>{label}</label>
      <input
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} inputMode={inputMode}
        style={{
          width: "100%", padding: "12px 14px", borderRadius: 10,
          border: `1px solid #e5e0d8`, fontSize: 16,
          outline: "none", background: "#fafaf8", boxSizing: "border-box",
          WebkitAppearance: "none", fontFamily: "'Bricolage Grotesque', sans-serif",
          minHeight: 48,
        }}
      />
    </div>
  );
}

function Btn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        background: disabled ? "#7a7a6a" : "#ff5c00", color: "#fff",
        padding: "14px 20px", borderRadius: 10, border: "none",
        fontWeight: 700, fontSize: 15, cursor: disabled ? "not-allowed" : "pointer",
        marginTop: 20, opacity: disabled ? 0.6 : 1,
        WebkitTapHighlightColor: "transparent",
        fontFamily: "'Bricolage Grotesque', sans-serif", minHeight: 48,
      }}
    >
      {children}
    </button>
  );
}

function BtnSecondary({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "transparent", color: "#7a7a6a",
        padding: "14px 14px", borderRadius: 10,
        border: "1px solid #e5e0d8", fontWeight: 600, fontSize: 14,
        cursor: "pointer", marginTop: 20,
        WebkitTapHighlightColor: "transparent",
        fontFamily: "'Bricolage Grotesque', sans-serif", minHeight: 48,
      }}
    >
      {children}
    </button>
  );
}
