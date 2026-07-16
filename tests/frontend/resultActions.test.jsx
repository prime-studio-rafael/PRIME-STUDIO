/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ResultActions from '../../src/features/generation/components/ResultActions.jsx';

const baseResult = {
  metrics: { costUsd: 0.034, durationMs: 1200 },
  image: { dataUrl: 'data:image/png;base64,AA==', downloadFilename: 'result.png' },
};

describe('result request id', () => {
  it('shows the request id returned by the backend', () => {
    render(<ResultActions result={{ ...baseResult, requestId: 'req_test_123' }} />);
    expect(screen.getByTestId('request-id')).toHaveTextContent('Request ID: req_test_123');
  });

  it('shows a safe fallback when the request id is absent', () => {
    render(<ResultActions result={baseResult} />);
    expect(screen.getByTestId('request-id')).toHaveTextContent('Request ID: Não informado');
  });
});
