import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const OUT = 'src/content/questionBank.json';
const HEALTH = 'src/content/contentHealth.json';

const SOURCES = [
  {
    level: 'Junior',
    levelTag: 'junior',
    url: 'https://raw.githubusercontent.com/debasmitasarkar/flutter_interview_topics/main/junior/README.md',
    cachePath: 'scripts/content-cache/junior.md'
  },
  {
    level: 'Mid',
    levelTag: 'mid',
    url: 'https://raw.githubusercontent.com/debasmitasarkar/flutter_interview_topics/main/mid-level/README.md',
    cachePath: 'scripts/content-cache/mid-level.md'
  },
  {
    level: 'Senior',
    levelTag: 'senior',
    url: 'https://raw.githubusercontent.com/debasmitasarkar/flutter_interview_topics/main/senior/README.md',
    cachePath: 'scripts/content-cache/senior.md'
  },
  {
    level: 'Expert',
    levelTag: 'expert',
    url: 'https://raw.githubusercontent.com/debasmitasarkar/flutter_interview_topics/main/expert/README.md',
    cachePath: 'scripts/content-cache/expert.md'
  }
];

const HEADER_PATTERNS = [/^###\s+\d+\.\s+/, /^###\s+Question\s+\d+\s*:\s+/i];
const TOPIC_RULES = [
  ['state', /\b(state|setstate|provider|bloc|riverpod|cubit|notifier|inheritedwidget)\b/i],
  ['async', /\b(async|await|future|stream|isolate|concurren|microtask|event loop)\w*/i],
  ['performance', /\b(perf|jank|frame|optimi[sz]e|latency|benchmark|render cost)\w*/i],
  ['testing', /\b(test|widget test|integration test|golden|mock|coverage)\b/i],
  ['architecture', /\b(architecture|clean architecture|layer|repository|solid|separation of concerns|mvvm|mvc)\b/i],
  ['platform', /\b(platform|android|ios|web|desktop|channel|plugin|ffi)\b/i],
  ['navigation', /\b(navigation|navigator|route|router|deep link)\b/i],
  ['build', /\b(build|release|ci\/cd|pipeline|flavor|signing|pubspec|tree shaking)\b/i],
  ['memory', /\b(memory|leak|gc|garbage collection|allocation)\b/i],
  ['rendering', /\b(render|repaint|raster|shader|compositor|layout pass|paint)\w*/i],
  ['networking', /\b(network|http|rest|graphql|api|socket|retry|timeout|offline)\b/i]
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stableHash(input) {
  return createHash('sha1').update(input).digest('hex').slice(0, 12);
}

function isQuestionHeader(line) {
  const trimmed = line.trim();
  return HEADER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
}

export async function fetchWithRetry(url, { retries = 3, timeoutMs = 15000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, timeoutMs);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      const backoffMs = 500 * (2 ** attempt);
      await sleep(backoffMs);
    }
  }
  throw new Error(`Failed to fetch after retries: ${lastError?.message || String(lastError)}`);
}


async function loadSourceMarkdown(source) {
  try {
    return { markdown: await fetchWithRetry(source.url, { retries: 3, timeoutMs: 15000 }), fetched: true, fetchError: null };
  } catch (error) {
    if (source.cachePath) {
      try {
        const cachedMarkdown = await fs.readFile(source.cachePath, 'utf8');
        return { markdown: cachedMarkdown, fetched: false, fetchError: String(error?.message || error), usedCache: true };
      } catch {
        // fallthrough
      }
    }
    throw error;
  }
}

function cleanInlineMarkdown(text) {
  return text
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[`*_>#]/g, '')
    .trim();
}

export function parseQuestionBlocks(markdown, levelTag) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let current = null;

  for (const line of lines) {
    if (isQuestionHeader(line)) {
      if (current) blocks.push(current);
      current = { levelTag, header: line.trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }

  if (current) {
    blocks.push(current);
  }

  if (!blocks.length) {
    return [{
      levelTag,
      header: `### Unparsed ${levelTag}`,
      lines: [],
      sourceMarkdown: markdown,
      unparsed: true
    }];
  }

  return blocks.map((block) => ({
    ...block,
    sourceMarkdown: [block.header, ...block.lines].join('\n').trim()
  }));
}

function parseHeader(headerLine) {
  const trimmed = headerLine.trim();
  let match = trimmed.match(/^###\s+(\d+)\.\s+(.+)$/);
  if (match) {
    return { number: match[1], title: cleanInlineMarkdown(match[2]) || cleanInlineMarkdown(trimmed) };
  }
  match = trimmed.match(/^###\s+Question\s+(\d+)\s*:\s+(.+)$/i);
  if (match) {
    return { number: match[1], title: cleanInlineMarkdown(match[2]) || cleanInlineMarkdown(trimmed) };
  }
  return { number: null, title: cleanInlineMarkdown(trimmed.replace(/^###\s+/, '')) || cleanInlineMarkdown(trimmed) };
}

function extractFirstParagraphLine(lines) {
  for (const line of lines) {
    const text = line.trim();
    if (!text) continue;
    if (text.startsWith('```')) continue;
    if (/^#{1,6}\s/.test(text)) continue;
    return cleanInlineMarkdown(text);
  }
  return '';
}

function inferTopics(text) {
  const topics = TOPIC_RULES.filter(([, rule]) => rule.test(text)).map(([topic]) => topic);
  return topics.length ? topics : ['architecture'];
}

function extractFollowups(lines) {
  const followups = [];
  let inFollowupZone = false;

  for (const line of lines) {
    const text = line.trim();
    if (!text) continue;

    if (/follow(?:-up)?/i.test(text)) {
      inFollowupZone = true;
    }

    if (inFollowupZone && /^[-*]\s+/.test(text)) {
      followups.push(cleanInlineMarkdown(text.replace(/^[-*]\s+/, '')));
      continue;
    }

    if (inFollowupZone && /^#{1,6}\s+/.test(text) && !/follow(?:-up)?/i.test(text)) {
      inFollowupZone = false;
    }
  }

  return [...new Set(followups)].filter(Boolean);
}

function extractExamples(markdown) {
  return [...markdown.matchAll(/```[\w-]*\n[\s\S]*?```/g)].map((match) => match[0].trim());
}

function stripCodeFences(markdown) {
  return markdown.replace(/```[\w-]*\n[\s\S]*?```/g, '').trim();
}

function extractMistakes(lines) {
  let inMistakes = false;
  const mistakes = [];

  for (const line of lines) {
    const text = line.trim();
    if (/^#{1,6}\s+.*mistake/i.test(text)) {
      inMistakes = true;
      continue;
    }
    if (/^#{1,6}\s+/.test(text) && !/mistake/i.test(text)) {
      inMistakes = false;
    }
    if (inMistakes && /^[-*]\s+/.test(text)) {
      mistakes.push(cleanInlineMarkdown(text.replace(/^[-*]\s+/, '')));
    }
  }

  return mistakes;
}

function extractDiagrams(lines) {
  return lines
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (line.includes('->')) return true;
      return /(?:\|.{0,2}){3,}|[_-]{4,}/.test(line);
    });
}

function createQuestionFromBlock(block, index, level) {
  const parsedHeader = parseHeader(block.header);
  const questionNumber = parsedHeader.number ? parsedHeader.number.padStart(3, '0') : null;
  const id = questionNumber ? `q-${questionNumber}` : `q-x${stableHash(`${block.levelTag}:${block.header}:${index}`)}`;
  const firstParagraphLine = extractFirstParagraphLine(block.lines);
  const prompt = [cleanInlineMarkdown(block.header), firstParagraphLine].filter(Boolean).join('\n');
  const fullMarkdown = block.sourceMarkdown;

  return {
    id,
    level,
    title: parsedHeader.title || cleanInlineMarkdown(block.header),
    prompt,
    topics: inferTopics(fullMarkdown),
    followups: extractFollowups(block.lines),
    referenceAnswerSections: {
      theory: stripCodeFences(fullMarkdown),
      examples: extractExamples(fullMarkdown),
      mistakes: extractMistakes(block.lines),
      diagrams: extractDiagrams(block.lines)
    },
    sourceMarkdown: fullMarkdown
  };
}

function fallbackQuestion() {
  return [{
    id: 'q-xfallback',
    level: 'Senior',
    title: 'Content ingestion fallback',
    prompt: 'Content ingestion failed for all upstream sources.',
    topics: ['architecture'],
    followups: [],
    referenceAnswerSections: {
      theory: 'All upstream sources failed or produced zero parseable blocks. Re-run ingestion and inspect contentHealth.json.',
      examples: [],
      mistakes: [],
      diagrams: []
    },
    sourceMarkdown: 'fallback generated due to catastrophic ingestion failure'
  }];
}

const upstream = [];
const parsedQuestionHeadersFound = { Junior: 0, Mid: 0, Senior: 0, Expert: 0 };
const warnings = [];
const questions = [];

const results = await Promise.allSettled(
  SOURCES.map(async (source) => {
    const loaded = await loadSourceMarkdown(source);
    const blocks = parseQuestionBlocks(loaded.markdown, source.levelTag);
    return { source, blocks, loaded };
  })
);

results.forEach((result, index) => {
  const source = SOURCES[index];
  if (result.status === 'rejected') {
    upstream.push({
      level: source.level,
      url: source.url,
      ok: false,
      error: String(result.reason?.message || result.reason)
    });
    warnings.push(`${source.level} fetch failed: ${String(result.reason?.message || result.reason)}`);
    return;
  }

  const { blocks, loaded } = result.value;
  const parsedBlocks = blocks.filter((block) => !block.unparsed);

  parsedQuestionHeadersFound[source.level] = parsedBlocks.length;

  if (loaded.usedCache) {
    warnings.push(`${source.level} fetch failed; used cached snapshot from ${source.cachePath}.`);
  }

  if (!parsedBlocks.length) {
    upstream.push({ level: source.level, url: source.url, ok: !loaded.fetchError, error: loaded.fetchError || null });
    warnings.push(`${source.level} had zero matching question headers; retained unparsed visibility entry in health warnings.`);
    return;
  }

  parsedBlocks.forEach((block, indexInSource) => {
    questions.push(createQuestionFromBlock(block, indexInSource, source.level));
  });

  upstream.push({ level: source.level, url: source.url, ok: !loaded.fetchError, error: loaded.fetchError || null });
});

const fetchFailures = upstream.filter((entry) => !entry.ok).length;
const zeroHeaderCount = Object.values(parsedQuestionHeadersFound).filter((count) => count === 0).length;

let fallbackUsed = false;
let finalBank = questions;

if ((fetchFailures === SOURCES.length && questions.length === 0) || zeroHeaderCount === SOURCES.length) {
  fallbackUsed = true;
  finalBank = fallbackQuestion();
  warnings.push('All upstream fetches failed or all sources produced zero blocks. Using single fallback question.');
}

const countsByLevel = finalBank.reduce((acc, question) => {
  acc[question.level] = (acc[question.level] || 0) + 1;
  return acc;
}, {});

const health = {
  generatedAt: new Date().toISOString(),
  totalQuestions: finalBank.length,
  countsByLevel,
  upstream,
  parsedQuestionHeadersFound,
  fallbackUsed,
  warnings
};

await fs.mkdir('src/content', { recursive: true });
await fs.writeFile(OUT, JSON.stringify(finalBank, null, 2));
await fs.writeFile(HEALTH, JSON.stringify(health, null, 2));

if (finalBank.length < 50) {
  console.warn('⚠️ Content ingestion warning: fewer than 50 questions generated.');
  console.warn('⚠️ Upstream status:', JSON.stringify(upstream, null, 2));
  console.warn('⚠️ Header counts:', JSON.stringify(parsedQuestionHeadersFound, null, 2));
}

if (finalBank.length === 1 && fallbackUsed) {
  console.error('❌ Catastrophic ingestion failure: only fallback question present.');
  process.exit(1);
}

console.log(`Generated ${finalBank.length} questions.`);
