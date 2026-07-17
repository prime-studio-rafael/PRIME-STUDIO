import { AppError } from '../utils/errors.js';

// A única porta de entrada para qualquer chamada paga do processo local.
export function createGenerationCoordinator() {
  let pending = 0;
  let tail = Promise.resolve();

  function run(task, { wait = false } = {}) {
    if (!wait && pending > 0) {
      return Promise.reject(new AppError('GENERATION_IN_PROGRESS', 'Já existe uma geração em andamento.', { status: 409 }));
    }
    pending += 1;
    const execution = tail.then(task);
    tail = execution.catch(() => {});
    return execution.finally(() => { pending -= 1; });
  }

  return Object.freeze({ run, isBusy: () => pending > 0 });
}
