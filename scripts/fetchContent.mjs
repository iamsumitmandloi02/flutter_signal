import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const OUT = 'src/content/questionBank.json';
const HEALTH = 'src/content/contentHealth.json';

const SOURCES = [
  {
    level: 'Junior',
    url: 'https://raw.githubusercontent.com/debasmitasarkar/flutter_interview_topics/main/junior/README.md'
  },
  {
    level: 'Mid',
    url: 'https://raw.githubusercontent.com/debasmitasarkar/flutter_interview_topics/main/mid-level/README.md'
  },
  {
    level: 'Senior',
    url: 'https://raw.githubusercontent.com/debasmitasarkar/flutter_interview_topics/main/senior/README.md'
  },
  {
    level: 'Expert',
    url: 'https://raw.githubusercontent.com/debasmitasarkar/flutter_interview_topics/main/expert/README.md'
  }
];

const HEADER_PATTERN = /^(###\s+\d+\.\s+|###\s+Question\s+\d+\s*:\s+)/i;
const REQUIRED_TOPIC_TAGS = ['state', 'async', 'performance', 'testing', 'architecture', 'platform', 'navigation', 'build', 'memory', 'rendering', 'networking'];

const BACKUP_FILES = {
  Junior: 'scripts/content-backup/junior.md',
  Mid: 'scripts/content-backup/mid.md',
  Senior: 'scripts/content-backup/senior.md',
  Expert: 'scripts/content-backup/expert.md'
};

const TOPIC_RULES = [
  ['state', /\b(state|setstate|provider|bloc|riverpod|notifier|inheritedwidget)\b/i],
  ['async', /\b(async|await|future|stream|isolate|event loop|microtask|concurren)\w*/i],
  ['performance', /\b(performance|optimi[sz]e|jank|profil|latency|throughput)\w*/i],
  ['testing', /\b(test|widget test|integration test|golden|mock|coverage)\b/i],
  ['architecture', /\b(architecture|clean architecture|layer|repository pattern|dependency injection|solid|mvc|mvvm)\b/i],
  ['platform', /\b(platform|android|ios|web|desktop|channel|plugin|ffi)\b/i],
  ['navigation', /\b(navigation|navigator|route|deeplink|deep link)\b/i],
  ['build', /\b(build|release|ci\/cd|pipeline|flavor|signing|pubspec)\b/i],
  ['memory', /\b(memory|leak|heap|garbage collection|gc)\b/i],
  ['rendering', /\b(render|repaint|frame|raster|layout|paint)\w*/i],
  ['networking', /\b(network|api|rest|graphql|http|socket|retry|offline)\b/i]
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stableHash(input) {
  return createHash('sha1').update(input).digest('hex').slice(0, 10);
}

async function fetchWithRetry(url, { retries = 3, timeoutMs = 15000 } = {}) {
  let attempt = 0;
  let lastError;
  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt === retries) break;
      await sleep(300 * (2 ** attempt));
      attempt += 1;
    }
  }
  throw lastError;
}

function removeCodeFences(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, '').trim();
}

function extractCodeBlocks(markdown) {
  return [...markdown.matchAll(/```(\w+)?\n([\s\S]*?)```/g)].map((match) => ({
    language: match[1] || '',
    code: match[2].trim()
  }));
}

function extractTitleAndNumber(headerLine) {
  const junior = headerLine.match(/^###\s+(\d+)\.\s+(.+)$/i);
  if (junior) return { number: junior[1], title: junior[2].trim() };
  const advanced = headerLine.match(/^###\s+Question\s+(\d+)\s*:\s+(.+)$/i);
  if (advanced) return { number: advanced[1], title: advanced[2].trim() };
  return { number: null, title: headerLine.replace(/^###\s+/, '').trim() };
}

function parseQuestionBlocks(markdown, levelTag) {
  const lines = markdown.split('\n');
  const blocks = [];
  let active = null;

  for (const line of lines) {
    if (HEADER_PATTERN.test(line.trim())) {
      if (active) blocks.push(active);
      active = { levelTag, header: line.trim(), bodyLines: [] };
      continue;
    }
    if (active) active.bodyLines.push(line);
  }

  if (active) blocks.push(active);

  if (blocks.length === 0) {
    return [{
      levelTag,
      header: `### Unparsed content (${levelTag})`,
      bodyLines: [],
      sourceMarkdown: markdown,
      unparsed: true
    }];
  }

  return blocks.map((block) => ({
    ...block,
    sourceMarkdown: [block.header, ...block.bodyLines].join('\n').trim(),
    unparsed: false
  }));
}

function extractPrompt(header, blockMarkdown) {
  const firstLine = blockMarkdown
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('```') && !line.startsWith('#') && !/^[-*]\s+/.test(line));
  return firstLine ? `${header}\n${firstLine}` : header;
}

function extractFollowups(blockMarkdown) {
  const lines = blockMarkdown.split('\n');
  const found = [];
  let inFollowupSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/follow(?:-up)?/i.test(trimmed) && /^#{1,6}\s+/.test(trimmed)) {
      inFollowupSection = true;
      continue;
    }
    if (/^#{1,6}\s+/.test(trimmed)) {
      inFollowupSection = false;
    }
    if ((inFollowupSection || /follow(?:-up)?/i.test(trimmed)) && /^[-*]\s+/.test(trimmed)) {
      found.push(trimmed.replace(/^[-*]\s+/, '').trim());
    }
  }
  return [...new Set(found)];
}

function extractMistakes(blockMarkdown) {
  const lines = blockMarkdown.split('\n');
  const mistakes = [];
  let inMistakeSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{1,6}\s+.*mistake/i.test(trimmed)) {
      inMistakeSection = true;
      continue;
    }
    if (/^#{1,6}\s+/.test(trimmed)) {
      inMistakeSection = false;
    }
    if (inMistakeSection && /^[-*]\s+/.test(trimmed)) {
      mistakes.push(trimmed.replace(/^[-*]\s+/, '').trim());
    }
  }
  return mistakes;
}

function extractDiagrams(blockMarkdown) {
  return blockMarkdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && (/->/.test(line) || /[|_-]{3,}/.test(line)));
}

function inferTopics(blockMarkdown) {
  const topics = TOPIC_RULES.filter(([, regex]) => regex.test(blockMarkdown)).map(([tag]) => tag);
  if (topics.length) return topics;
  return ['architecture'];
}

function buildQuestion(block, index) {
  const sourceMarkdown = block.sourceMarkdown || [block.header, ...block.bodyLines].join('\n').trim();
  const { number, title } = extractTitleAndNumber(block.header);
  const parsedTitle = title || block.header.replace(/^###\s+/, '').trim();
  const id = number ? `q-${number.padStart(3, '0')}` : `q-x${stableHash(`${block.levelTag}:${block.header}:${index}`)}`;

  return {
    id,
    level: block.levelTag,
    title: parsedTitle,
    prompt: extractPrompt(block.header, sourceMarkdown),
    topics: inferTopics(sourceMarkdown),
    followups: extractFollowups(sourceMarkdown),
    referenceAnswerSections: {
      theory: removeCodeFences(sourceMarkdown),
      examples: extractCodeBlocks(sourceMarkdown),
      mistakes: extractMistakes(sourceMarkdown),
      diagrams: extractDiagrams(sourceMarkdown)
    },
    sourceMarkdown
  };
}

function ensureUniqueIds(questions) {
  const seen = new Map();
  return questions.map((question) => {
    const count = seen.get(question.id) || 0;
    seen.set(question.id, count + 1);
    if (count === 0) return question;
    return { ...question, id: `${question.id}-${count + 1}` };
  });
}

function fallbackQuestion() {
  return [{
    id: 'q-xfallback',
    level: 'Senior',
    title: 'Content ingestion fallback',
    prompt: 'The upstream content could not be loaded during build.',
    topics: ['build'],
    followups: [],
    referenceAnswerSections: {
      theory: 'Upstream sources failed. Review contentHealth.json for details.',
      examples: [],
      mistakes: [],
      diagrams: []
    },
    sourceMarkdown: 'fallback generated by scripts/fetchContent.mjs'
  }];
}

async function main() {
  const upstream = [];
  const parsedQuestionHeadersFound = {};
  const warnings = [];

  const fetchResults = await Promise.all(SOURCES.map(async (source) => {
    try {
      const markdown = await fetchWithRetry(source.url, { retries: 3, timeoutMs: 15000 });
      upstream.push({ level: source.level, url: source.url, ok: true, error: null });
      return { source, markdown, ok: true };
    } catch (error) {
      const message = String(error?.message || error);
      upstream.push({ level: source.level, url: source.url, ok: false, error: message });
      warnings.push(`Failed to fetch ${source.level}: ${message}`);

      const backupPath = BACKUP_FILES[source.level];
      if (backupPath) {
        try {
          const markdown = await fs.readFile(backupPath, 'utf8');
          warnings.push(`Using local backup for ${source.level}: ${backupPath}`);
          return { source, markdown, ok: true, backupUsed: true };
        } catch {
          // no-op, keep failure below
        }
      }

      return { source, markdown: '', ok: false };
    }
  }));

  const allQuestions = [];
  let zeroBlockFiles = 0;

  for (const result of fetchResults) {
    const { source, markdown, ok } = result;
    if (!ok) {
      parsedQuestionHeadersFound[source.level] = 0;
      continue;
    }

    const blocks = parseQuestionBlocks(markdown, source.level);
    const matched = blocks.filter((block) => !block.unparsed).length;
    parsedQuestionHeadersFound[source.level] = matched;
    if (matched === 0) {
      zeroBlockFiles += 1;
      warnings.push(`${source.level} had zero matching question headers.`);
    }

    blocks.forEach((block, index) => allQuestions.push(buildQuestion(block, index)));
  }

  const allFetchFailed = fetchResults.every((x) => !x.ok);
  const allZeroBlocks = zeroBlockFiles === SOURCES.length;
  const fallbackUsed = allFetchFailed || allZeroBlocks;

  const questions = fallbackUsed ? fallbackQuestion() : ensureUniqueIds(allQuestions);
  const countsByLevel = questions.reduce((acc, question) => {
    acc[question.level] = (acc[question.level] || 0) + 1;
    return acc;
  }, {});

  if (!fallbackUsed && questions.length < 50) {
    warnings.push('WARNING: totalQuestions < 50. Check failed/empty levels in upstream and parsedQuestionHeadersFound.');
    console.warn('⚠️ WARNING: totalQuestions < 50. Upstream summary:', upstream, 'Headers:', parsedQuestionHeadersFound);
  }

  const health = {
    generatedAt: new Date().toISOString(),
    totalQuestions: questions.length,
    countsByLevel,
    upstream,
    parsedQuestionHeadersFound,
    fallbackUsed,
    warnings
  };

  await fs.writeFile(OUT, `${JSON.stringify(questions, null, 2)}\n`, 'utf8');
  await fs.writeFile(HEALTH, `${JSON.stringify(health, null, 2)}\n`, 'utf8');

  console.log(`Generated ${questions.length} questions.`);

  if (questions.length === 1 && fallbackUsed) {
    console.error('Catastrophic ingestion failure: fallback-only dataset generated. Failing build.');
    process.exit(1);
  }
}

await main();
