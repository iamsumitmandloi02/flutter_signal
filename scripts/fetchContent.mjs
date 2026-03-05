import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const OUT = 'src/content/questionBank.json';
const HEALTH = 'src/content/contentHealth.json';

const SOURCES = [
  {
    level: 'Junior',
    slug: 'junior',
    url: 'https://raw.githubusercontent.com/debasmitasarkar/flutter_interview_topics/main/junior/README.md'
  },
  {
    level: 'Mid',
    slug: 'mid-level',
    url: 'https://raw.githubusercontent.com/debasmitasarkar/flutter_interview_topics/main/mid-level/README.md'
  },
  {
    level: 'Senior',
    slug: 'senior',
    url: 'https://raw.githubusercontent.com/debasmitasarkar/flutter_interview_topics/main/senior/README.md'
  },
  {
    level: 'Expert',
    slug: 'expert',
    url: 'https://raw.githubusercontent.com/debasmitasarkar/flutter_interview_topics/main/expert/README.md'
  }
];

const TOPIC_RULES = [
  ['state', /\b(state|setstate|provider|bloc|riverpod|notifier|inheritedwidget)\b/i],
  ['async', /\b(async|await|future|stream|isolate|concurrency|event loop)\b/i],
  ['performance', /\b(perf|performance|jank|render|repaint|frame|optimi[sz]e|memory|gc|profil)\w*/i],
  ['testing', /\b(test|widget test|integration test|mock|golden|coverage)\b/i],
  ['architecture', /\b(architecture|clean architecture|layer|repository|dependency injection|design pattern|solid|mvvm|mvc)\b/i],
  ['platform', /\b(platform|android|ios|web|desktop|channel|plugin|ffi)\b/i],
  ['navigation', /\b(navigation|navigator|route|deep link)\b/i],
  ['build', /\b(build|release|ci\/cd|pipeline|flavor|signing|pubspec|tree shaking)\b/i],
  ['ui', /\b(widget|layout|theme|animation|material|cupertino|responsive)\b/i],
  ['data', /\b(json|serialization|database|sqlite|hive|isar|api|rest|graphql)\b/i],
  ['security', /\b(security|auth|authentication|authorization|token|encryption|secure storage)\b/i]
];

function stableHash(input) {
  return createHash('sha1').update(input).digest('hex').slice(0, 12);
}

function cleanInlineMarkdown(text) {
  return text
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[`*_>#]/g, '')
    .trim();
}

function parseHeader(headerLine) {
  const raw = headerLine.trim();
  const value = raw.replace(/^###\s*/, '').trim();
  let match = value.match(/^(\d+)\.?\s*[:\-]?\s*(.+)$/i);
  if (match) {
    return { number: match[1], title: cleanInlineMarkdown(match[2]) || cleanInlineMarkdown(value) };
  }
  match = value.match(/^Question\s*(\d+)\s*[:\-]\s*(.+)$/i);
  if (match) {
    return { number: match[1], title: cleanInlineMarkdown(match[2]) || cleanInlineMarkdown(value) };
  }
  match = value.match(/^Question\s*(\d+)\s*$/i);
  if (match) {
    return { number: match[1], title: cleanInlineMarkdown(value) };
  }
  return { number: null, title: cleanInlineMarkdown(value) };
}

function extractFirstParagraph(body) {
  const blocks = body
    .split(/\n\s*\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  for (const block of blocks) {
    if (!block.startsWith('```') && !block.startsWith('- ') && !block.startsWith('* ') && !block.startsWith('>')) {
      return cleanInlineMarkdown(block.replace(/\n+/g, ' '));
    }
  }
  return '';
}

function parseFollowups(body) {
  const out = [];
  const lines = body.split('\n');
  let inFollowupSection = false;
  for (const line of lines) {
    const t = line.trim();
    if (/^#{2,4}\s*follow[- ]?up/i.test(t)) {
      inFollowupSection = true;
      continue;
    }
    if (/^#{2,4}\s+/.test(t)) {
      inFollowupSection = false;
    }
    if (/^[-*]\s+/.test(t) && (inFollowupSection || /follow[- ]?up/i.test(t))) {
      out.push(cleanInlineMarkdown(t.replace(/^[-*]\s+/, '')));
    }
  }
  return [...new Set(out)].filter(Boolean);
}

function extractCodeFences(body) {
  return [...body.matchAll(/```[\s\S]*?```/g)].map((m) => m[0].trim());
}

function extractMistakes(body) {
  const lines = body.split('\n');
  const mistakes = [];
  let inMistakes = false;
  for (const line of lines) {
    const t = line.trim();
    if (/^#{2,4}\s*common mistakes/i.test(t)) {
      inMistakes = true;
      continue;
    }
    if (/^#{2,4}\s+/.test(t)) {
      inMistakes = false;
    }
    if (inMistakes && /^[-*]\s+/.test(t)) {
      mistakes.push(cleanInlineMarkdown(t.replace(/^[-*]\s+/, '')));
    }
  }
  return mistakes;
}

function extractDiagrams(body) {
  const diagrams = [];
  const asciiCandidates = body.split(/\n\s*\n/).map((x) => x.trim());
  for (const c of asciiCandidates) {
    if (c.split('\n').length < 2) continue;
    if (/->|=>|\||\+--|\bflow\b|\bdiagram\b/i.test(c) && !c.startsWith('```')) {
      diagrams.push(c);
    }
  }
  return diagrams;
}

function inferTopics(text) {
  const topics = TOPIC_RULES.filter(([, rx]) => rx.test(text)).map(([topic]) => topic);
  return topics.length ? topics : ['general'];
}

function parseQuestionsFromMarkdown(md, source) {
  const lines = md.split('\n');
  const blocks = [];
  let current = null;

  for (const line of lines) {
    if (/^###\s+/.test(line.trim())) {
      if (current) blocks.push(current);
      current = { header: line.trim(), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) blocks.push(current);

  return blocks.map((block, index) => {
    const body = block.lines.join('\n').trim();
    const parsedHeader = parseHeader(block.header);
    const baseId = parsedHeader.number ? `${source.slug}-${parsedHeader.number}` : `${source.slug}-${stableHash(`${block.header}\n${body}`)}`;
    const firstParagraph = extractFirstParagraph(body);
    const prompt = firstParagraph ? `${cleanInlineMarkdown(block.header)}\n${firstParagraph}` : cleanInlineMarkdown(block.header);
    return {
      id: baseId,
      level: source.level,
      title: parsedHeader.title || `Question ${index + 1}`,
      prompt,
      topics: inferTopics(`${parsedHeader.title}\n${body}`),
      followups: parseFollowups(body),
      referenceAnswerSections: {
        theory: body || cleanInlineMarkdown(block.header),
        examples: extractCodeFences(body),
        mistakes: extractMistakes(body),
        diagrams: extractDiagrams(body)
      },
      sourceMarkdown: `${block.header}\n${body}`.trim()
    };
  });
}


function buildOfflineBank() {
  const titles = {
    Junior: [
      'What is a Widget and how does it differ from Element?',
      'Explain StatelessWidget vs StatefulWidget lifecycle.',
      'How does setState trigger UI updates?',
      'What are keys and when should you use them?',
      'How does BuildContext work?',
      'What is hot reload and what are its limits?',
      'How do you structure layouts with Row, Column, and Expanded?',
      'What is const constructor optimization?',
      'How do you handle user input with TextEditingController?',
      'When do you choose ListView.builder?',
      'How do you manage app themes in Flutter?',
      'How do you validate forms?',
      'What is Navigator.push/pop?',
      'How do async/await and FutureBuilder work together?',
      'How do you parse JSON in Dart?',
      'How do you call REST APIs in Flutter?',
      'What is pubspec.yaml used for?',
      'How do you add assets and fonts?',
      'What is null safety in Dart?',
      'How do you debug layout overflow?',
      'What is the purpose of MediaQuery?',
      'How do you make responsive UIs?',
      'How do you write a basic widget test?',
      'How do you persist small local settings?',
      'How do you handle platform differences?'
    ],
    Mid: [
      'How would you compare Provider, BLoC, and Riverpod?',
      'How do you design feature-based folder architecture?',
      'What are best practices for dependency injection?',
      'How do you handle offline-first sync?',
      'How do you optimize large scrolling lists?',
      'How do you profile app startup time?',
      'How do isolates help with expensive work?',
      'How do you design robust error handling for network layers?',
      'How do you paginate APIs in Flutter?',
      'How do you secure auth tokens on-device?',
      'How do you implement deep linking?',
      'How do you coordinate navigation in modular apps?',
      'How do you test repositories and services?',
      'How do you approach integration testing?',
      'How do you handle app lifecycle events?',
      'How do you migrate legacy code to null safety?',
      'How do you create reusable design-system widgets?',
      'How do you manage environment flavors?',
      'How do you set up CI/CD for Flutter?',
      'How do you reduce APK/IPA size?',
      'How do you choose between sqflite, hive, and isar?',
      'How do you manage caching and invalidation?',
      'How do you design API retry/backoff behavior?',
      'How do you prevent duplicate submissions in forms?',
      'How do you review pull requests for Flutter quality?'
    ],
    Senior: [
      'How do you architect a large Flutter app for scale?',
      'How do you define clean boundaries across layers?',
      'How do you enforce consistency across multiple teams?',
      'How do you measure and improve frame rendering performance?',
      'How do you debug memory leaks in Flutter?',
      'How do you design feature flags for staged rollouts?',
      'How do you design resilient background sync?',
      'How do you design a telemetry and observability strategy?',
      'How do you balance product speed vs code quality?',
      'How do you design robust authentication/authorization flows?',
      'How do you plan major Flutter SDK upgrades?',
      'How do you manage plugin risk across platforms?',
      'How do you architect for web + mobile parity?',
      'How do you approach accessibility at scale?',
      'How do you review architecture proposals?',
      'How do you mentor engineers through complex debugging?',
      'How do you evaluate state management tradeoffs?',
      'How do you build a performance budget program?',
      'How do you design an experimentation framework?',
      'How do you handle monorepo package boundaries?',
      'How do you reduce build times in CI?',
      'How do you design secure local data storage?',
      'How do you model domain errors and recovery UX?',
      'How do you design reusable networking primitives?',
      'How do you plan disaster recovery for backend/API outages?'
    ],
    Expert: [
      'How would you evolve architecture for 5+ year lifespan?',
      'How do you evaluate Flutter vs native for strategic bets?',
      'How do you design a cross-platform plugin ecosystem?',
      'How do you govern technical standards across squads?',
      'How do you define long-term migration strategy for core modules?',
      'How do you optimize rendering pipelines for complex animations?',
      'How do you harden apps against supply-chain attacks?',
      'How do you architect privacy-by-design in Flutter products?',
      'How do you design global release management for many regions?',
      'How do you design SLOs and reliability scorecards for mobile apps?',
      'How do you use static analysis to prevent architectural drift?',
      'How do you build an internal Flutter platform team?',
      'How do you quantify engineering productivity improvements?',
      'How do you evaluate new state-management paradigms?',
      'How do you build a governance model for app modularity?',
      'How do you design highly testable animation systems?',
      'How do you assess long-term maintainability risks?',
      'How do you align product experimentation with platform constraints?',
      'How do you design architecture for low-end devices globally?',
      'How do you approach difficult build-system migrations?',
      'How do you create guardrails for performance regressions?',
      'How do you design incident response for mobile production issues?',
      'How do you define platform abstraction boundaries?',
      'How do you scale code ownership and review responsibility?',
      'How do you create a technical roadmap for Flutter excellence?'
    ]
  };

  const bank = [];
  for (const [level, entries] of Object.entries(titles)) {
    entries.forEach((title, idx) => {
      const header = `### Question ${idx + 1}: ${title}`;
      const theory = `${title} Focus on clear tradeoffs, architecture decisions, performance impacts, and testing strategy.`;
      bank.push({
        id: `${level.toLowerCase()}-offline-${idx + 1}`,
        level,
        title,
        prompt: `${header}
Explain the concept, discuss tradeoffs, and provide implementation guidance.`,
        topics: inferTopics(`${title} ${theory}`),
        followups: ['What tradeoffs did you consider?', 'How would you test this in production?'],
        referenceAnswerSections: {
          theory,
          examples: [`\`\`\`dart\n// Example sketch\nvoid discussApproach() {}\n\`\`\``],
          mistakes: ['Answering without tradeoffs', 'Ignoring platform constraints'],
          diagrams: ['Input -> Decision -> Implementation -> Validation']
        },
        sourceMarkdown: `${header}
${theory}`
      });
    });
  }
  return bank;
}

async function fetchSource(source) {
  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`Failed ${source.slug}: ${response.status}`);
  }
  const markdown = await response.text();
  return parseQuestionsFromMarkdown(markdown, source);
}

const fetchResults = await Promise.allSettled(SOURCES.map(fetchSource));
const allQuestions = [];
const errors = [];

fetchResults.forEach((result, idx) => {
  const source = SOURCES[idx];
  if (result.status === 'fulfilled') {
    allQuestions.push(...result.value);
  } else {
    errors.push({ level: source.level, url: source.url, error: String(result.reason?.message || result.reason) });
  }
});

let bank = allQuestions;
if (!bank.length) {
  bank = buildOfflineBank();
}

const missingFields = bank
  .filter((q) => !q.id || !q.title || !q.level || !q.prompt || !q.sourceMarkdown)
  .map((q) => q.id || '(missing-id)');

const countsPerLevel = bank.reduce((acc, q) => {
  acc[q.level] = (acc[q.level] || 0) + 1;
  return acc;
}, {});

const health = {
  generatedAt: new Date().toISOString(),
  totalQuestions: bank.length,
  countsPerLevel,
  parsedCount: allQuestions.length,
  fallbackCount: Math.max(0, bank.length - allQuestions.length),
  usedOfflineFallback: allQuestions.length === 0,
  missingFields,
  upstreamFailures: errors
};

await fs.mkdir('src/content', { recursive: true });
await fs.writeFile(OUT, JSON.stringify(bank, null, 2));
await fs.writeFile(HEALTH, JSON.stringify(health, null, 2));
console.log(`questionBank entries: ${bank.length}`);
