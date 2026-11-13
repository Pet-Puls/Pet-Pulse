import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@/components/error-boundary';
import { DemoApp } from './DemoApp';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <DemoApp standalone />
  </ErrorBoundary>,
);
