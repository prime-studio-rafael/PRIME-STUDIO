import { generationConfig } from '../config/generationConfig.js';

const models = Object.freeze([
  {
    id: generationConfig.modelId,
    providerModel: generationConfig.providerModel,
    label: 'Nano Banana 2 Lite',
    description: 'Geração de imagem para troca de roupas superiores.',
  },
]);

export function listModels() {
  return models;
}

export function getModelById(id) {
  return models.find((model) => model.id === id) || null;
}
