import { STORY_LAYOUTS, getStoryLayout } from '../../shared/storyLayoutSpec.js';

export const STORY_TEMPLATES = Object.freeze(STORY_LAYOUTS.map(({ id, label, description, palette, thumbnail }) => Object.freeze({ id, label, description, background: palette.background, palette, thumbnail })));

export function getStoryTemplate(id) {
  const layout = getStoryLayout(id);
  return layout ? STORY_TEMPLATES.find((template) => template.id === layout.id) || null : null;
}

export { getStoryLayout };
