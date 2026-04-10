"use client";

import { useState, useEffect } from "react";
import { ArrowRight, ArrowLeft, Check, Mail, MessageCircle, Building, Sparkles } from "lucide-react";

// ─── DESIGN TOKENS ───────────────────
const C = {
  bg: "#f7f4ef", dark: "#1a1a14", accent: "#ff5c00", green: "#2d6a4f",
  muted: "#7a7a6a", surface: "#fff", border: "#e5e0d8",
};

const PLAN_AGENTS: Record<string, { type: string; defaultName: string; emoji: string; role: string; desc: string }[]> = {
  ESSENTIEL: [
    { type: "ADMIN", defaultName: "Alice", emoji: "📋", role: "Admin", desc: "Emails, devis, factures, relances" },
  ],
  CROISSANCE: [
    { type: "ADMIN", defaultName: "Alice", emoji: "📋", role: "Admin", desc: "Emails, devis, factures, relances" },
    { type: "MARKETING", defaultName: "Marc", emoji: "📢", role: "Marketing", desc: "Fiche Google, avis, SEO, réseaux sociaux" },
  ],
  PILOTE_AUTO: [
    { type: "ADMIN", defaultName: "Alice", emoji: "📋", role: "Admin", desc: "Emails, devis, factures, relances" },
    { type: "MARKETING", defaultName: "Marc", emoji: "📢", role: "Marketing", desc: "Fiche Google, avis, SEO, réseaux sociaux" },
    { type: "COMMERCIAL", defaultName: "Léa", emoji: "💼", role: "Commercial", desc: "Prospection, leads, recouvrement" },
  ],
};

export default function ClientOnboardingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState("");
  const [plan, setPlan] = useState("PILOTE_AUTO");

  // Step 1 — Company info
  const [company, setCompany] = useState("");
  const [metier, setMetier] = useState("");
  const [ville, setVille] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [siret, setSiret] = useState("");
  const [phone, setPhone] = useState("");
  const [adresse, setAdresse] = useState("");

  // Step 2 — Agent names
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});

  // Load onboarding state from session (no clientId param needed)
  useEffect(() => {
    fetch("/api/client/onboarding")
      .then(r => {
        if (r.status === 401) {
          window.location.href = "/client/login";
          return null;
        }
        return r.json();
      })
      .then(data => {
        if (!data?.client) return;
        setClientId(data.client.id);
        setPlan(data.client.plan || "PILOTE_AUTO");
        setCompany(data.client.company || "");
        setMetier(data.client.metier || "");
        setVille(data.client.ville || "");
        setCodePostal(data.client.codePostal || data.client.code_postal || "");
        setSiret(data.client.siret || "");
        setPhone(data.client.phone || "");
        setAdresse(data.client.adresse || "");

        // Restore agent names
        const names: Record<string, string> = {};
        (data.agents || []).forEach((a: any) => {
          names[a.agent_type] = a.display_name || "";
        });
        setAgentNames(names);

        // If already completed, redirect to dashboard
        if (data.onboardingCompleted) {
          window.location.href = "/client";
          return;
        }

        if (data.onboardingStep > 0) setStep(data.onboardingStep + 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const agents = PLAN_AGENTS[plan] || PLAN_AGENTS.PILOTE_AUTO;

  // Initialize default names
  useEffect(() => {
    const defaults: Record<string, string> = {};
    agents.forEach(a => {
      if (!agentNames[a.type]) defaults[a.type] = a.defaultName;
    });
    if (Object.keys(defaults).length > 0) {
      setAgentNames(prev => ({ ...defaults, ...prev }));
    }
  }, [plan]);

  const saveStep = async (stepNum: number, data: any) => {
    setSaving(true);
    try {
      await fetch("/api/client/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: stepNum, data }),
      });
      setStep(stepNum + 1);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: C.muted, fontSize: 15 }}>Chargement...</div>
      </div>
    );
  }

  const progressWidth = `${(step / 4) * 100}%`;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{
        width: "100%",
        maxWidth: 440,
        background: C.surface,
        borderRadius: 16,
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        overflow: "hidden",
        fontFamily: "'Bricolage Grotesque', sans-serif",
      }}>

        {/* Progress bar */}
        <div style={{ height: 4, background: C.border }}>
          <div style={{ height: 4, background: C.accent, width: progressWidth, transition: "width 0.3s ease" }} />
        </div>

        {/* Header */}
        <div style={{ padding: "24px 20px 0", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 15 }}>
              iA
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, color: C.dark }}>iArtisan</span>
          </div>
          <p style={{ color: C.muted, marginTop: 4, fontSize: 13 }}>Étape {Math.min(step, 4)} sur 4</p>
        </div>

        <div style={{ padding: "20px 20px 24px" }}>

          {/* ── STEP 1: Company Info ── */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.dark, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <Building size={20} />
                Votre entreprise
              </h2>
              <p style={{ color: C.muted, marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
                Ces infos apparaîtront sur vos devis et factures.
              </p>

              <div style={{ display: "grid", gap: 14 }}>
                <Input label="Nom de l'entreprise *" value={company} onChange={setCompany} placeholder="Ex: Dupont Plomberie" />
                <Input label="Métier *" value={metier} onChange={setMetier} placeholder="Ex: Plombier, Électricien..." />
                <Input label="Ville *" value={ville} onChange={setVille} placeholder="Lyon" />
                <Input label="Code postal" value={codePostal} onChange={setCodePostal} placeholder="69001" inputMode="numeric" />
                <Input label="Adresse" value={adresse} onChange={setAdresse} placeholder="12 rue des Artisans" />
                <Input label="Téléphone" value={phone} onChange={setPhone} placeholder="06 12 34 56 78" inputMode="tel" />
                <Input label="SIRET" value={siret} onChange={setSiret} placeholder="123 456 789 00012" inputMode="numeric" />
              </div>

              <Btn
                disabled={!company || !metier || !ville || saving}
                onClick={() => saveStep(1, { company, metier, ville, codePostal, siret, phone, adresse })}
              >
                {saving ? "..." : "Continuer"} <ArrowRight size={18} />
              </Btn>
            </div>
          )}

          {/* ── STEP 2: Name Your Agents ── */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.dark, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={20} />
                Nommez vos assistants
              </h2>
              <p style={{ color: C.muted, marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
                Choisissez un prénom pour {agents.length > 1 ? "chacun de vos" : "votre"} assistant{agents.length > 1 ? "s" : ""} IA.
              </p>

              <div style={{ display: "grid", gap: 14 }}>
                {agents.map(agent => (
                  <div key={agent.type} style={{
                    border: `2px solid ${C.border}`,
                    borderRadius: 12,
                    padding: 16,
                    transition: "border-color 0.2s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 28 }}>{agent.emoji}</span>
                      <div>
                        <div style={{ fontWeight: 700, color: C.dark, fontSize: 15 }}>Agent {agent.role}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{agent.desc}</div>
                      </div>
                    </div>
                    <Input
                      label="Prénom de l'assistant"
                      value={agentNames[agent.type] || agent.defaultName}
                      onChange={(v) => setAgentNames(prev => ({ ...prev, [agent.type]: v }))}
                      placeholder={agent.defaultName}
                    />
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
                      displayName: agentNames[a.type] || a.defaultName,
                    }))
                  })}
                >
                  {saving ? "..." : "Continuer"} <ArrowRight size={18} />
                </Btn>
              </div>
            </div>
          )}

          {/* ── STEP 3: Connect Email ── */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.dark, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <Mail size={20} />
                Connectez votre email
              </h2>
              <p style={{ color: C.muted, marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
                Pour que <strong>{agentNames.ADMIN || "Alice"}</strong> puisse lire et envoyer vos emails professionnels.
              </p>

              <div style={{
                background: "#f8f9fa",
                borderRadius: 12,
                padding: 20,
                textAlign: "center",
                marginBottom: 16,
              }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>📧</div>
                <a
                  href={`/api/integrations/gmail/auth?clientId=${clientId}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#4285F4",
                    color: "#fff",
                    padding: "14px 24px",
                    borderRadius: 10,
                    fontWeight: 600,
                    textDecoration: "none",
                    fontSize: 15,
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <Mail size={18} />
                  Connecter Gmail
                </a>
                <p style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>
                  Connexion sécurisée via Google OAuth.
                </p>
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
                Vous pourrez connecter Gmail plus tard.
              </p>
            </div>
          )}

          {/* ── STEP 4: Connect Telegram ── */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.dark, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <MessageCircle size={20} />
                Parlez à {agentNames.ADMIN || "Alice"}
              </h2>
              <p style={{ color: C.muted, marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
                Connectez Telegram pour discuter avec vos assistants depuis votre téléphone.
              </p>

              <div style={{
                background: "#f8f9fa",
                borderRadius: 12,
                padding: 20,
                marginBottom: 14,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 32 }}>✈️</div>
                  <div>
                    <div style={{ fontWeight: 700, color: C.dark, fontSize: 15 }}>Telegram</div>
                    <div style={{ fontSize: 12, color: C.muted }}>Gratuit, rapide, illimité</div>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.9 }}>
                  <strong>1.</strong> Ouvrez{" "}
                  <a href="https://t.me/iartisan_agent_bot" target="_blank" rel="noopener noreferrer" style={{ color: C.accent, fontWeight: 600 }}>
                    t.me/iartisan_agent_bot
                  </a><br />
                  <strong>2.</strong> Envoyez ce code :<br />
                  <div style={{
                    background: C.dark,
                    color: "#fff",
                    padding: "10px 16px",
                    borderRadius: 8,
                    fontFamily: "monospace",
                    fontSize: 15,
                    fontWeight: 700,
                    display: "inline-block",
                    margin: "8px 0",
                    letterSpacing: 1,
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                    onClick={() => navigator.clipboard?.writeText(clientId)}
                    title="Cliquer pour copier"
                  >
                    {clientId || "..."}
                  </div>
                  <br />
                  <strong>3.</strong> Essayez : <em style={{ color: C.accent }}>"Aide"</em> ou <em style={{ color: C.accent }}>"Lis mes emails"</em>
                </div>
              </div>

              {/* WhatsApp teaser */}
              <div style={{
                background: "#e8f5e9",
                borderRadius: 12,
                padding: 14,
                marginBottom: 14,
                opacity: 0.7,
              }}>
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

          {/* ── DONE ── */}
          {step === 5 && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 56, marginBottom: 14 }}>🎉</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
                C'est prêt !
              </h2>
              <p style={{ color: C.muted, marginBottom: 20, lineHeight: 1.6, fontSize: 14 }}>
                {agents.length > 1 ? "Vos assistants sont" : "Votre assistant est"} configuré{agents.length > 1 ? "s" : ""} et prêt{agents.length > 1 ? "s" : ""} à travailler.
              </p>

              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                {agents.map(a => (
                  <div key={a.type} style={{
                    background: C.bg,
                    borderRadius: 12,
                    padding: "14px 16px",
                    textAlign: "center",
                    minWidth: 100,
                    flex: "1 1 0",
                  }}>
                    <div style={{ fontSize: 26 }}>{a.emoji}</div>
                    <div style={{ fontWeight: 700, color: C.dark, marginTop: 4, fontSize: 14 }}>
                      {agentNames[a.type] || a.defaultName}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>{a.role}</div>
                  </div>
                ))}
              </div>

              <a href="/client" style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: C.accent,
                color: "#fff",
                padding: "14px 28px",
                borderRadius: 10,
                fontWeight: 700,
                textDecoration: "none",
                marginTop: 24,
                fontSize: 15,
                WebkitTapHighlightColor: "transparent",
              }}>
                Mon tableau de bord <ArrowRight size={18} />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── UI Components (mobile-optimized) ───────────────────
function Input({ label, value, onChange, placeholder, inputMode }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 4 }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          fontSize: 16, // 16px prevents iOS zoom on focus
          outline: "none",
          background: "#fafaf8",
          boxSizing: "border-box",
          WebkitAppearance: "none",
          fontFamily: "'Bricolage Grotesque', sans-serif",
        }}
      />
    </div>
  );
}

function Btn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        background: disabled ? C.muted : C.accent,
        color: "#fff",
        padding: "14px 20px",
        borderRadius: 10,
        border: "none",
        fontWeight: 700,
        fontSize: 15,
        cursor: disabled ? "not-allowed" : "pointer",
        marginTop: 20,
        opacity: disabled ? 0.6 : 1,
        WebkitTapHighlightColor: "transparent",
        fontFamily: "'Bricolage Grotesque', sans-serif",
        minHeight: 48, // touch target
      }}
    >
      {children}
    </button>
  );
}

function BtnSecondary({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "transparent",
        color: C.muted,
        padding: "14px 14px",
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        fontWeight: 600,
        fontSize: 14,
        cursor: "pointer",
        marginTop: 20,
        WebkitTapHighlightColor: "transparent",
        fontFamily: "'Bricolage Grotesque', sans-serif",
        minHeight: 48, // touch target
      }}
    >
      {children}
    </button>
  );
}
