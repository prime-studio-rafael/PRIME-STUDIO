// Taxonomia fixa da biblioteca de templates (Fase 6). Categorias são código versionado,
// não dado de runtime — adicionar uma nova categoria é uma entrada aqui + deploy, sem
// exigir migração: templates antigos simplesmente não referenciam o novo id até serem editados.
// Gestão de categorias via UI fica para uma fase futura.
export const DEFAULT_TEMPLATE_CATEGORY_ID = 'sem-categoria';

const categories = Object.freeze([
  Object.freeze({ id: 'moda-masculina', label: 'Moda Masculina', emoji: '👕', order: 10 }),
  Object.freeze({ id: 'moda-feminina', label: 'Moda Feminina', emoji: '👩', order: 20 }),
  Object.freeze({ id: 'tenis-masculino', label: 'Tênis Masculino', emoji: '👟', order: 30 }),
  Object.freeze({ id: 'tenis-feminino', label: 'Tênis Feminino', emoji: '👟', order: 40 }),
  Object.freeze({ id: 'acessorios', label: 'Acessórios', emoji: '⌚', order: 50 }),
  Object.freeze({ id: 'bolsas', label: 'Bolsas', emoji: '👜', order: 60 }),
  Object.freeze({ id: DEFAULT_TEMPLATE_CATEGORY_ID, label: 'Sem categoria', emoji: '📦', order: 999 }),
]);

export function listTemplateCategories() {
  return [...categories].sort((a, b) => a.order - b.order);
}

export function getTemplateCategoryById(id) {
  return categories.find((category) => category.id === id) || null;
}

export function isKnownTemplateCategory(id) {
  return categories.some((category) => category.id === id);
}
