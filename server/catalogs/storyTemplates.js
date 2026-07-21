export const STORY_TEMPLATES = Object.freeze([
  Object.freeze({ id: 'product-highlight', label: 'Produto em destaque', description: 'Produto, nome, preço e chamada para ação.', background: '#f4f1eb' }),
  Object.freeze({ id: 'minimal', label: 'Minimalista', description: 'Imagem predominante, chamada curta e marca discreta.', background: '#f8fafc' }),
  Object.freeze({ id: 'offer', label: 'Oferta', description: 'Preço em destaque e espaço para condição de pagamento.', background: '#111827' }),
]);

export function getStoryTemplate(id) {
  return STORY_TEMPLATES.find((template) => template.id === id) || null;
}
