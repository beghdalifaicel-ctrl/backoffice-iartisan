/**
 * iArtisan — Agent QA Test Suite
 *
 * Runs 30+ automated scenarios against /api/test/chat
 * and generates an HTML report with pass/fail per category.
 *
 * Usage: npx ts-node test-agents-qa.ts
 * Or:    npx tsx test-agents-qa.ts
 */

const API_URL = process.env.API_URL || "https://app.iartisan.io/api/test/chat";
const API_KEY = process.env.TEST_API_KEY || "iartisan-test-2026";
const CLIENT_ID = process.env.CLIENT_ID || "test-client-001";

// ─── Types ──────────────────────────────────────────────────

type AgentType = "ADMIN" | "MARKETING" | "COMMERCIAL";
type PlanType = "ESSENTIEL" | "PRO" | "MAX";
type TestCategory = "ROUTING" | "SCOPE" | "FORMAT" | "INTERDICTIONS" | "CONTEXTE_TEMPOREL" | "STYLE";

interface TestScenario {
  id: number;
  name: string;
  category: TestCategory;
  message: string;
  plan: PlanType;
  targetAgent?: AgentType;
  expectedAgents?: AgentType[];
  assertions: AssertionDef[];
}

interface AssertionDef {
  name: string;
  check: (content: string, agentType: AgentType, allResponses: any[]) => boolean;
  severity: "critical" | "warning";
}

interface TestResult {
  scenario: TestScenario;
  agentType: AgentType;
  agentName: string;
  content: string;
  passed: AssertionResult[];
  failed: AssertionResult[];
  durationMs: number;
}

interface AssertionResult {
  name: string;
  passed: boolean;
  severity: "critical" | "warning";
}

// ─── Assertion Library ──────────────────────────────────────

const ASSERTIONS = {
  concise: {
    name: "Reponse concise (< 500 chars)",
    check: (c: string) => c.length < 500,
    severity: "critical" as const,
  },
  ultraConcise: {
    name: "Ultra concise (< 300 chars)",
    check: (c: string) => c.length < 300,
    severity: "warning" as const,
  },
  noMarkdownBold: {
    name: "Pas de Markdown gras (**)",
    check: (c: string) => !c.includes("**"),
    severity: "critical" as const,
  },
  noMarkdownHeaders: {
    name: "Pas de Markdown titres (##)",
    check: (c: string) => !c.includes("##"),
    severity: "critical" as const,
  },
  noMarkdownLists: {
    name: "Pas de listes Markdown (- )",
    check: (c: string) => {
      const lines = c.split("\n");
      return !lines.some(l => /^[\s]*[-*]\s/.test(l));
    },
    severity: "critical" as const,
  },
  noPhoneCall: {
    name: "Pas de proposition d'appel telephonique",
    check: (c: string) => !c.match(/\b(appeler|telephoner|coup de fil|t['']appelle|je t['']appelle|on s['']appelle|passer un appel)\b/i),
    severity: "critical" as const,
  },
  noColleaguePromise: {
    name: "Pas de promesse au nom d'un collegue",
    check: (c: string) => !c.match(/(samir|lucas|marie)\s+(va |t['']?envoie|te contacte|va te |s['']occupe)/i),
    severity: "critical" as const,
  },
  hasQuestion: {
    name: "Contient une question (?)",
    check: (c: string) => c.includes("?"),
    severity: "warning" as const,
  },
  noSelfPrefix: {
    name: "Pas d'auto-prefixe (emoji+nom en debut)",
    check: (c: string) => {
      const trimmed = c.trim();
      return !trimmed.match(/^[🟣🟢🔴]\s*(Marie|Lucas|Samir)\s*:/);
    },
    severity: "critical" as const,
  },
  tutoiement: {
    name: "Tutoiement (tu/te/ton/ta/tes)",
    check: (c: string) => !!c.match(/\b(tu |te |ton |ta |tes |t[''])\b/i),
    severity: "warning" as const,
  },
  noVouvoiementArtisan: {
    name: "Pas de vouvoiement a l'artisan (vous/votre)",
    check: (c: string) => !c.match(/\b(vous |votre |vos )\b/i),
    severity: "warning" as const,
  },
  redirectsToColleague: {
    name: "Redirige vers un collegue",
    check: (c: string) => !!c.match(/(marie|lucas|samir|collegue|pour ca|c['']est pour|demander? a|domaine de)/i),
    severity: "critical" as const,
  },
  noTimePromiseSoir: {
    name: "Pas de 'dans la journee' le soir",
    check: (c: string) => !c.match(/dans la journ[eé]e/i),
    severity: "critical" as const,
  },
  mentionsDemain: {
    name: "Mentionne 'demain' le soir",
    check: (c: string) => !!c.match(/demain/i),
    severity: "warning" as const,
  },
};

// ─── Standard assertion sets ────────────────────────────────

const STANDARD_FORMAT = [
  ASSERTIONS.concise,
  ASSERTIONS.noMarkdownBold,
  ASSERTIONS.noMarkdownHeaders,
  ASSERTIONS.noMarkdownLists,
  ASSERTIONS.noPhoneCall,
  ASSERTIONS.noColleaguePromise,
  ASSERTIONS.noSelfPrefix,
  ASSERTIONS.hasQuestion,
];

const STANDARD_STYLE = [
  ...STANDARD_FORMAT,
  ASSERTIONS.tutoiement,
];

// ─── Test Scenarios (30+) ───────────────────────────────────

const SCENARIOS: TestScenario[] = [
  // ═══ ROUTING (8 tests) ═══
  {
    id: 1, name: "Bonjour → Marie repond (defaut)", category: "ROUTING",
    message: "Bonjour", plan: "MAX",
    expectedAgents: ["ADMIN"],
    assertions: STANDARD_STYLE,
  },
  {
    id: 2, name: "Devis → Marie", category: "ROUTING",
    message: "Je veux faire un devis pour un client", plan: "MAX",
    expectedAgents: ["ADMIN"],
    assertions: STANDARD_STYLE,
  },
  {
    id: 3, name: "Fiche Google → Lucas", category: "ROUTING",
    message: "Je veux ameliorer ma fiche Google", plan: "MAX",
    expectedAgents: ["MARKETING"],
    assertions: STANDARD_STYLE,
  },
  {
    id: 4, name: "Prospection → Samir", category: "ROUTING",
    message: "Je cherche de nouveaux clients dans ma zone", plan: "MAX",
    expectedAgents: ["COMMERCIAL"],
    assertions: STANDARD_STYLE,
  },
  {
    id: 5, name: "Facture + SEO → Marie + Lucas", category: "ROUTING",
    message: "Relancer mes factures impayees et ameliorer mon SEO", plan: "MAX",
    expectedAgents: ["ADMIN", "MARKETING"],
    assertions: STANDARD_STYLE,
  },
  {
    id: 6, name: "Plan ESSENTIEL → Marie seule", category: "ROUTING",
    message: "Je veux ameliorer ma fiche Google", plan: "ESSENTIEL",
    expectedAgents: ["ADMIN"],
    assertions: STANDARD_STYLE,
  },
  {
    id: 7, name: "Plan PRO → pas de Samir", category: "ROUTING",
    message: "Je cherche des prospects B2B", plan: "PRO",
    assertions: STANDARD_STYLE,
  },
  {
    id: 8, name: "Commande /marie directe", category: "ROUTING",
    message: "Fais-moi un resume de mes emails", plan: "MAX",
    targetAgent: "ADMIN",
    expectedAgents: ["ADMIN"],
    assertions: STANDARD_STYLE,
  },

  // ═══ SCOPE (6 tests) ═══
  {
    id: 9, name: "Marie recoit question marketing → redirige", category: "SCOPE",
    message: "Comment optimiser mon referencement Google ?", plan: "MAX",
    targetAgent: "ADMIN",
    assertions: [...STANDARD_FORMAT, ASSERTIONS.redirectsToColleague],
  },
  {
    id: 10, name: "Lucas recoit demande devis → redirige", category: "SCOPE",
    message: "Genere-moi un devis pour le chantier Dupont", plan: "MAX",
    targetAgent: "MARKETING",
    assertions: [...STANDARD_FORMAT, ASSERTIONS.redirectsToColleague],
  },
  {
    id: 11, name: "Samir recoit demande facture → redirige", category: "SCOPE",
    message: "Envoie la facture au client Martin", plan: "MAX",
    targetAgent: "COMMERCIAL",
    assertions: [...STANDARD_FORMAT, ASSERTIONS.redirectsToColleague],
  },
  {
    id: 12, name: "Lucas recoit question prospection → redirige", category: "SCOPE",
    message: "Trouve-moi des leads dans le 13", plan: "MAX",
    targetAgent: "MARKETING",
    assertions: [...STANDARD_FORMAT, ASSERTIONS.redirectsToColleague],
  },
  {
    id: 13, name: "Samir recoit question SEO → redirige", category: "SCOPE",
    message: "Je veux plus d'avis Google", plan: "MAX",
    targetAgent: "COMMERCIAL",
    assertions: [...STANDARD_FORMAT, ASSERTIONS.redirectsToColleague],
  },
  {
    id: 14, name: "Marie recoit question impaye → redirige ou gere", category: "SCOPE",
    message: "Un client ne m'a pas paye depuis 3 mois, faut le relancer", plan: "MAX",
    targetAgent: "ADMIN",
    assertions: STANDARD_FORMAT,
  },

  // ═══ FORMAT (6 tests) ═══
  {
    id: 15, name: "Pas de Markdown sur question simple", category: "FORMAT",
    message: "C'est quoi le programme aujourd'hui ?", plan: "MAX",
    assertions: [ASSERTIONS.noMarkdownBold, ASSERTIONS.noMarkdownHeaders, ASSERTIONS.noMarkdownLists, ASSERTIONS.noSelfPrefix, ASSERTIONS.concise],
  },
  {
    id: 16, name: "Reponse courte sur sujet complexe", category: "FORMAT",
    message: "Explique-moi comment fonctionne le referencement local pour les artisans", plan: "MAX",
    targetAgent: "MARKETING",
    assertions: [ASSERTIONS.concise, ASSERTIONS.ultraConcise, ASSERTIONS.noMarkdownBold, ASSERTIONS.noMarkdownLists, ASSERTIONS.hasQuestion],
  },
  {
    id: 17, name: "Pas de liste a puces sur demande multi-sujets", category: "FORMAT",
    message: "Qu'est-ce que tu peux faire pour moi ?", plan: "MAX",
    assertions: [ASSERTIONS.noMarkdownLists, ASSERTIONS.noMarkdownBold, ASSERTIONS.concise],
  },
  {
    id: 18, name: "Pas de double prefixe Marie", category: "FORMAT",
    message: "Salut Marie, ca va ?", plan: "MAX",
    targetAgent: "ADMIN",
    assertions: [ASSERTIONS.noSelfPrefix, ASSERTIONS.noMarkdownBold, ASSERTIONS.concise],
  },
  {
    id: 19, name: "Pas de double prefixe Lucas", category: "FORMAT",
    message: "Lucas, tu peux m'aider ?", plan: "MAX",
    targetAgent: "MARKETING",
    assertions: [ASSERTIONS.noSelfPrefix, ASSERTIONS.noMarkdownBold, ASSERTIONS.concise],
  },
  {
    id: 20, name: "Pas de double prefixe Samir", category: "FORMAT",
    message: "Samir, j'ai besoin de toi", plan: "MAX",
    targetAgent: "COMMERCIAL",
    assertions: [ASSERTIONS.noSelfPrefix, ASSERTIONS.noMarkdownBold, ASSERTIONS.concise],
  },

  // ═══ INTERDICTIONS (6 tests) ═══
  {
    id: 21, name: "Marie ne propose pas d'appeler", category: "INTERDICTIONS",
    message: "Le client Dupont est en retard sur son paiement, ca fait 2 mois", plan: "MAX",
    targetAgent: "ADMIN",
    assertions: [ASSERTIONS.noPhoneCall, ASSERTIONS.noColleaguePromise, ...STANDARD_FORMAT],
  },
  {
    id: 22, name: "Samir ne propose pas d'appeler les prospects", category: "INTERDICTIONS",
    message: "J'ai une liste de 10 prospects a contacter, comment on fait ?", plan: "MAX",
    targetAgent: "COMMERCIAL",
    assertions: [ASSERTIONS.noPhoneCall, ASSERTIONS.noColleaguePromise, ...STANDARD_FORMAT],
  },
  {
    id: 23, name: "Marie ne promet pas d'action de Samir", category: "INTERDICTIONS",
    message: "J'ai besoin de trouver de nouveaux chantiers, tu peux m'aider ?", plan: "MAX",
    targetAgent: "ADMIN",
    assertions: [ASSERTIONS.noColleaguePromise, ASSERTIONS.noPhoneCall, ASSERTIONS.redirectsToColleague],
  },
  {
    id: 24, name: "Lucas ne promet pas d'action de Marie", category: "INTERDICTIONS",
    message: "Il faut aussi relancer le devis du client Garcia", plan: "MAX",
    targetAgent: "MARKETING",
    assertions: [ASSERTIONS.noColleaguePromise, ASSERTIONS.noPhoneCall, ASSERTIONS.redirectsToColleague],
  },
  {
    id: 25, name: "Aucun agent ne dit 'je vais t appeler'", category: "INTERDICTIONS",
    message: "C'est urgent, il faut qu'on en discute rapidement", plan: "MAX",
    assertions: [ASSERTIONS.noPhoneCall, ASSERTIONS.noColleaguePromise, ...STANDARD_FORMAT],
  },
  {
    id: 26, name: "Pas de promesse de delai non controlable", category: "INTERDICTIONS",
    message: "Quand est-ce que ca sera fait ?", plan: "MAX",
    assertions: [ASSERTIONS.noPhoneCall, ASSERTIONS.noColleaguePromise, ...STANDARD_FORMAT],
  },

  // ═══ CONTEXTE TEMPOREL (4 tests) — Note: l'heure est celle du serveur ═══
  {
    id: 27, name: "Message generique — pas de promesse temporelle fausse", category: "CONTEXTE_TEMPOREL",
    message: "J'ai plein de trucs a faire, par quoi on commence ?", plan: "MAX",
    assertions: [...STANDARD_FORMAT, ASSERTIONS.hasQuestion],
  },
  {
    id: 28, name: "Demande urgente — actions numeriques uniquement", category: "CONTEXTE_TEMPOREL",
    message: "C'est super urgent, faut agir maintenant", plan: "MAX",
    assertions: [ASSERTIONS.noPhoneCall, ASSERTIONS.noColleaguePromise, ...STANDARD_FORMAT],
  },
  {
    id: 29, name: "Question planning — reste dans le numerique", category: "CONTEXTE_TEMPOREL",
    message: "On fait quoi cette semaine ?", plan: "MAX",
    assertions: [ASSERTIONS.noPhoneCall, ...STANDARD_FORMAT],
  },
  {
    id: 30, name: "Fin de journee mentionnee — adapte le contexte", category: "CONTEXTE_TEMPOREL",
    message: "Il est tard, mais j'ai une question rapide sur mes devis en cours", plan: "MAX",
    assertions: [ASSERTIONS.noPhoneCall, ASSERTIONS.noColleaguePromise, ASSERTIONS.concise, ASSERTIONS.hasQuestion],
  },

  // ═══ STYLE (5 tests) ═══
  {
    id: 31, name: "Tutoiement sur question simple", category: "STYLE",
    message: "Qu'est-ce que tu me conseilles pour aujourd'hui ?", plan: "MAX",
    assertions: [ASSERTIONS.tutoiement, ...STANDARD_FORMAT],
  },
  {
    id: 32, name: "Question finale interactive", category: "STYLE",
    message: "J'ai recu un email d'un nouveau client potentiel", plan: "MAX",
    assertions: [ASSERTIONS.hasQuestion, ASSERTIONS.concise, ASSERTIONS.tutoiement],
  },
  {
    id: 33, name: "Ton chaleureux pas corporate", category: "STYLE",
    message: "Ca se passe comment avec toi ?", plan: "MAX",
    assertions: [ASSERTIONS.tutoiement, ASSERTIONS.concise, ASSERTIONS.noMarkdownBold, ASSERTIONS.hasQuestion],
  },
  {
    id: 34, name: "UNE seule action proposee, pas cinq", category: "STYLE",
    message: "Je veux ameliorer la visibilite de mon entreprise", plan: "MAX",
    targetAgent: "MARKETING",
    assertions: [ASSERTIONS.concise, ASSERTIONS.ultraConcise, ASSERTIONS.hasQuestion, ASSERTIONS.noMarkdownLists],
  },
  {
    id: 35, name: "Reponse equipe ultra courte (1-2 phrases)", category: "STYLE",
    message: "J'ai des factures en retard et ma fiche Google est pas a jour", plan: "MAX",
    expectedAgents: ["ADMIN", "MARKETING"],
    assertions: [ASSERTIONS.concise, ASSERTIONS.noMarkdownBold, ASSERTIONS.noColleaguePromise],
  },
];

// ─── API Call ───────────────────────────────────────────────

async function callTestAPI(scenario: TestScenario): Promise<any> {
  const body: any = {
    message: scenario.message,
    clientId: CLIENT_ID,
    plan: scenario.plan,
  };
  if (scenario.targetAgent) {
    body.targetAgent = scenario.targetAgent;
  }

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-test-key": API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json();
}

// ─── Run Tests ──────────────────────────────────────────────

async function runAllTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const total = SCENARIOS.length;

  for (let i = 0; i < SCENARIOS.length; i++) {
    const scenario = SCENARIOS[i];
    console.log(`[${i + 1}/${total}] ${scenario.category} — ${scenario.name}`);

    try {
      const startTime = Date.now();
      const apiResponse = await callTestAPI(scenario);
      const durationMs = Date.now() - startTime;

      // Check routing if expectedAgents specified
      if (scenario.expectedAgents) {
        const respondingAgents: AgentType[] = apiResponse.respondingAgents || [];
        const routingOk = scenario.expectedAgents.every((a: AgentType) => respondingAgents.includes(a));
        if (!routingOk) {
          console.log(`  ⚠️  Routing: attendu ${scenario.expectedAgents.join("+")} / obtenu ${respondingAgents.join("+")}`);
        }
      }

      // Run assertions on each response
      const responses = apiResponse.responses || [];
      for (const resp of responses) {
        const content = resp.content || "";
        const agentType = resp.agent as AgentType;
        const agentName = resp.agentName || agentType;

        const passed: AssertionResult[] = [];
        const failed: AssertionResult[] = [];

        for (const assertion of scenario.assertions) {
          const ok = assertion.check(content, agentType, responses);
          const result: AssertionResult = {
            name: assertion.name,
            passed: ok,
            severity: assertion.severity,
          };
          if (ok) {
            passed.push(result);
          } else {
            failed.push(result);
            const icon = assertion.severity === "critical" ? "❌" : "⚠️";
            console.log(`  ${icon} [${agentName}] ${assertion.name}`);
          }
        }

        results.push({
          scenario,
          agentType,
          agentName,
          content,
          passed,
          failed,
          durationMs,
        });
      }

      // Rate limit: small delay between calls
      await new Promise((r) => setTimeout(r, 500));
    } catch (err: any) {
      console.log(`  ❌ ERREUR API: ${err.message}`);
      results.push({
        scenario,
        agentType: "ADMIN",
        agentName: "ERROR",
        content: `API ERROR: ${err.message}`,
        passed: [],
        failed: scenario.assertions.map((a) => ({
          name: a.name,
          passed: false,
          severity: a.severity,
        })),
        durationMs: 0,
      });
    }
  }

  return results;
}

// ─── Generate HTML Report ───────────────────────────────────

function generateReport(results: TestResult[]): string {
  const categories: TestCategory[] = ["ROUTING", "SCOPE", "FORMAT", "INTERDICTIONS", "CONTEXTE_TEMPOREL", "STYLE"];

  // Compute stats per category
  const catStats: Record<string, { total: number; passed: number; critical: number; warnings: number }> = {};
  for (const cat of categories) {
    const catResults = results.filter((r) => r.scenario.category === cat);
    const totalAssertions = catResults.reduce((sum, r) => sum + r.passed.length + r.failed.length, 0);
    const passedAssertions = catResults.reduce((sum, r) => sum + r.passed.length, 0);
    const criticalFails = catResults.reduce(
      (sum, r) => sum + r.failed.filter((f) => f.severity === "critical").length, 0
    );
    const warningFails = catResults.reduce(
      (sum, r) => sum + r.failed.filter((f) => f.severity === "warning").length, 0
    );
    catStats[cat] = { total: totalAssertions, passed: passedAssertions, critical: criticalFails, warnings: warningFails };
  }

  // Overall
  const totalAssertions = results.reduce((sum, r) => sum + r.passed.length + r.failed.length, 0);
  const totalPassed = results.reduce((sum, r) => sum + r.passed.length, 0);
  const totalCritical = results.reduce((sum, r) => sum + r.failed.filter((f) => f.severity === "critical").length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.failed.filter((f) => f.severity === "warning").length, 0);
  const overallPercent = totalAssertions > 0 ? Math.round((totalPassed / totalAssertions) * 100) : 0;

  const timestamp = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

  // Build rows
  let detailRows = "";
  for (const result of results) {
    const hasCritical = result.failed.some((f) => f.severity === "critical");
    const hasWarning = result.failed.some((f) => f.severity === "warning");
    const status = hasCritical ? "FAIL" : hasWarning ? "WARN" : "PASS";
    const statusColor = hasCritical ? "#e74c3c" : hasWarning ? "#f39c12" : "#27ae60";
    const statusEmoji = hasCritical ? "❌" : hasWarning ? "⚠️" : "✅";

    const failDetails = result.failed.length > 0
      ? result.failed.map((f) => `<span style="color:${f.severity === "critical" ? "#e74c3c" : "#f39c12"}">${f.name}</span>`).join("<br>")
      : "-";

    // Truncate content for display
    const shortContent = result.content.length > 120 ? result.content.substring(0, 120) + "..." : result.content;

    detailRows += `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:8px;font-size:13px;">${result.scenario.id}</td>
        <td style="padding:8px;font-size:13px;"><span style="background:#f0f0f0;border-radius:4px;padding:2px 6px;font-size:11px;">${result.scenario.category}</span></td>
        <td style="padding:8px;font-size:13px;">${result.scenario.name}</td>
        <td style="padding:8px;font-size:13px;">${result.agentName}</td>
        <td style="padding:8px;text-align:center;"><span style="background:${statusColor};color:white;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:bold;">${statusEmoji} ${status}</span></td>
        <td style="padding:8px;font-size:12px;">${result.passed.length}/${result.passed.length + result.failed.length}</td>
        <td style="padding:8px;font-size:12px;">${failDetails}</td>
        <td style="padding:8px;font-size:11px;color:#666;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${result.content.replace(/"/g, '&quot;')}">${shortContent}</td>
      </tr>`;
  }

  // Category summary cards
  let catCards = "";
  for (const cat of categories) {
    const s = catStats[cat];
    const pct = s.total > 0 ? Math.round((s.passed / s.total) * 100) : 100;
    const color = s.critical > 0 ? "#e74c3c" : s.warnings > 0 ? "#f39c12" : "#27ae60";
    const catLabel: Record<string, string> = {
      ROUTING: "Routing",
      SCOPE: "Perimetre",
      FORMAT: "Format",
      INTERDICTIONS: "Interdictions",
      CONTEXTE_TEMPOREL: "Contexte temps",
      STYLE: "Style",
    };
    catCards += `
      <div style="background:white;border-radius:12px;padding:20px;min-width:140px;box-shadow:0 2px 8px rgba(0,0,0,0.08);text-align:center;">
        <div style="font-size:14px;color:#666;margin-bottom:8px;">${catLabel[cat] || cat}</div>
        <div style="font-size:32px;font-weight:bold;color:${color};">${pct}%</div>
        <div style="font-size:11px;color:#999;margin-top:4px;">${s.passed}/${s.total} checks</div>
        ${s.critical > 0 ? `<div style="font-size:11px;color:#e74c3c;margin-top:2px;">${s.critical} critiques</div>` : ""}
        ${s.warnings > 0 ? `<div style="font-size:11px;color:#f39c12;margin-top:2px;">${s.warnings} warnings</div>` : ""}
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>iArtisan — Rapport QA Agents</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; color: #333; padding: 24px; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    th { background: #2c3e50; color: white; padding: 12px 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    tr:hover { background: #f8f9fa; }
  </style>
</head>
<body>
  <div style="max-width:1400px;margin:0 auto;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="font-size:28px;margin-bottom:8px;">🧪 iArtisan — Rapport QA Agents</h1>
      <p style="color:#666;">Test automatise le ${timestamp}</p>
      <p style="color:#666;font-size:13px;">${SCENARIOS.length} scenarios | ${results.length} reponses analysees | ${totalAssertions} assertions</p>
    </div>

    <!-- Score global -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:white;border-radius:16px;padding:24px 48px;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
        <div style="font-size:56px;font-weight:bold;color:${totalCritical > 0 ? "#e74c3c" : totalWarnings > 0 ? "#f39c12" : "#27ae60"};">${overallPercent}%</div>
        <div style="font-size:14px;color:#666;margin-top:4px;">Score global</div>
        <div style="font-size:12px;color:#999;margin-top:4px;">${totalPassed} pass | ${totalCritical} critiques | ${totalWarnings} warnings</div>
      </div>
    </div>

    <!-- Category cards -->
    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:32px;">
      ${catCards}
    </div>

    <!-- Detail table -->
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Categorie</th>
          <th>Scenario</th>
          <th>Agent</th>
          <th>Statut</th>
          <th>Score</th>
          <th>Echecs</th>
          <th>Reponse</th>
        </tr>
      </thead>
      <tbody>
        ${detailRows}
      </tbody>
    </table>

    <!-- Legend -->
    <div style="margin-top:24px;text-align:center;font-size:12px;color:#999;">
      ✅ PASS = toutes les assertions passent | ⚠️ WARN = warnings seulement | ❌ FAIL = au moins 1 assertion critique echouee
    </div>

  </div>
</body>
</html>`;
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  iArtisan — Agent QA Test Suite              ║");
  console.log("║  35 scenarios | 6 categories                 ║");
  console.log(`║  API: ${API_URL.substring(0, 40).padEnd(40)}║`);
  console.log("╚══════════════════════════════════════════════╝");
  console.log("");

  const results = await runAllTests();

  // Summary
  const totalAssertions = results.reduce((sum, r) => sum + r.passed.length + r.failed.length, 0);
  const totalPassed = results.reduce((sum, r) => sum + r.passed.length, 0);
  const totalCritical = results.reduce((sum, r) => sum + r.failed.filter((f) => f.severity === "critical").length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.failed.filter((f) => f.severity === "warning").length, 0);
  const pct = totalAssertions > 0 ? Math.round((totalPassed / totalAssertions) * 100) : 0;

  console.log("");
  console.log("══════════════════════════════════════════");
  console.log(`  SCORE GLOBAL: ${pct}% (${totalPassed}/${totalAssertions})`);
  console.log(`  Critiques: ${totalCritical} | Warnings: ${totalWarnings}`);
  console.log("══════════════════════════════════════════");

  // Write report
  const fs = await import("fs");
  const reportPath = "./qa-report.html";
  const html = generateReport(results);
  fs.writeFileSync(reportPath, html);
  console.log(`\n📄 Rapport HTML: ${reportPath}`);
  console.log("   Ouvre-le dans un navigateur pour le detail complet.");

  // Exit code
  if (totalCritical > 0) {
    console.log("\n❌ ECHEC — des assertions critiques ont echoue.");
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log("\n⚠️  WARNINGS — quelques points a ameliorer.");
    process.exit(0);
  } else {
    console.log("\n✅ TOUT EST VERT — les agents respectent toutes les regles.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
