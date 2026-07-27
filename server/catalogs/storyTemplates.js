import { STORY_LAYOUTS, getStoryLayout } from '../../shared/storyLayoutSpec.js';

export const STORY_TEMPLATES = Object.freeze(STORY_LAYOUTS.map(({ id, label, description, background }) => Object.freeze({ id, label, description, background })));

export function getStoryTemplate(id) {
  return STORY_TEMPLATES.find((template) => template.id === id) || null;
}

export { getStoryLayout };
