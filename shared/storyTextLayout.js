import { getStoryTypographyLimits } from './storyTypographySpec.js';
import { getStoryLayoutTextLimit } from './storyLayoutSpec.js';

export function normalizeStoryText(value) { return String(value || '').trim().replace(/\s+/g, ' '); }

export function layoutStoryText(value, field, typographyPreset, layoutId) {
  const typographyRules = getStoryTypographyLimits(typographyPreset, field);
  const layoutMaxLines = getStoryLayoutTextLimit(layoutId, field);
  const rules = typographyRules && Object.freeze({ ...typographyRules, maxLines: layoutMaxLines || typographyRules.maxLines });
  const text = normalizeStoryText(value);
  if (!rules || !text) return Object.freeze({ text, lines: [], warning: null, blocked: false });
  const words = text.split(' ');
  const tooLong = text.length > rules.maxChars || (rules.maxWords && words.length > rules.maxWords);
  const maxPerLine = Math.max(1, Math.ceil(rules.maxChars / rules.maxLines));
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxPerLine || !line) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  const overflow = lines.length > rules.maxLines;
  return Object.freeze({ text, lines: overflow ? lines.slice(0, rules.maxLines) : lines, warning: tooLong || overflow ? 'Este texto pode não caber com segurança no layout selecionado.' : null, blocked: tooLong || overflow });
}

export function storyTextWarnings(story, typographyPreset, layoutId) {
  return ['productLabel', 'calloutText', 'headline', 'subheadline', 'priceText', 'ctaText'].flatMap((field) => {
    const result = layoutStoryText(story?.[field], field, typographyPreset, layoutId || story?.storyTemplateId);
    return result.warning ? [{ field, ...result }] : [];
  });
}
