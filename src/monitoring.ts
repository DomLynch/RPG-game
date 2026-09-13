import { init, globalHandlersIntegration, browserApiErrorsIntegration, dedupeIntegration, type BrowserOptions } from '@sentry/browser';

export function monitoringOptions(dsn: string | undefined, release: string | undefined, environment: string): BrowserOptions {
  return {
    dsn, release, environment, enabled: Boolean(dsn),
    defaultIntegrations: false,
    integrations: [globalHandlersIntegration(), browserApiErrorsIntegration(), dedupeIntegration()],
    sendDefaultPii: false, tracesSampleRate: 0,
    beforeSend(event) {
      // Keep error/stack/release evidence, never guest identity or interaction history.
      delete event.user; delete event.request; delete event.breadcrumbs; delete event.extra;
      return event;
    },
  };
}

if (import.meta.env?.VITE_SENTRY_DSN) {
  init(monitoringOptions(import.meta.env.VITE_SENTRY_DSN, import.meta.env.VITE_SENTRY_RELEASE, import.meta.env.MODE));
}
