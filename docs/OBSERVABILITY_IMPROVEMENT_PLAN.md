# Observability Improvement Plan for Conductor-Web

This document outlines a plan to improve observability and logging within the `conductor-web` project, moving away from direct `console.log` usage towards a more structured, scalable, and maintainable approach.

## 1. The Problem

The current codebase, particularly in complex components like `screenplay-interactive.ts`, relies heavily on `console.log` for debugging. This leads to several issues:
- **Code Pollution:** The code is cluttered with logging statements.
- **Lack of Structure:** Logs have no consistent format, making them hard to parse and filter.
- **No Log Levels:** It's impossible to differentiate between critical errors and simple debug messages.
- **Maintenance Overhead:** Logs are often manually added and removed during development, which is error-prone.
- **Production Blindness:** There is no effective way to monitor and debug issues in the production environment.

## 2. Proposed Solution: A Phased Approach

We will tackle this problem in phases, starting with foundational improvements and paving the way for more advanced observability tools in the future.

### Phase 1: Create a Centralized `LoggingService`

The first step is to create a new Angular service, `LoggingService`, which will act as a centralized wrapper for all logging operations.

**Key Features:**
- **Methods for Log Levels:** It will provide methods for different severity levels:
  - `log(message: string, context?: string)`
  - `info(message: string, context?: string)`
  - `warn(message: string, context?: string)`
  - `error(message: string, error?: any, context?: string)`
  - `debug(message: string, context?: string)`
- **Structured Output:** Each log message will be prefixed with a timestamp, log level, and an optional context (e.g., the component name).
- **Environment-Aware:** The service will be configurable to show only certain log levels based on the environment (e.g., show `debug` and `info` only in development).
- **Single Point of Control:** All logs will flow through this service, making it easy to change the logging behavior for the entire application from one place.

### Phase 2: Refactor `screenplay-interactive.ts`

Once the `LoggingService` is in place, we will refactor the `screenplay-interactive.ts` component to use it instead of `console.log`.

**Process:**
1. Inject `LoggingService` into `ScreenplayInteractive` component.
2. Systematically replace every `console.log`, `console.warn`, and `console.error` with the appropriate method from our new service.
3. Assign appropriate log levels to each message (e.g., user actions might be `info`, errors from API calls will be `error`).
4. Provide the component name (`'ScreenplayInteractive'`) as the context for each log call.

This will immediately clean up the component and make its log output much more valuable.

### Phase 3: Future Enhancements (Advanced Observability)

With the `LoggingService` as a foundation, we can easily integrate more advanced tools in the future without major refactoring.

- **Remote Logging & Error Tracking:** Integrate a third-party service like Sentry, Datadog, or Logtail. We would only need to modify the `LoggingService` to send `error` and `warn` level logs to these platforms. This gives us proactive error monitoring in production.
- **Performance Monitoring:** Use these tools to track application performance metrics.
- **Session Replay:** Integrate tools like LogRocket or FullStory to get video-like replays of user sessions, which is invaluable for debugging complex user-reported issues.

## 3. Action Plan

1.  **[TODO]** Create `LoggingService` inside `projects/conductor-web/src/app/services/`.
2.  **[TODO]** Implement the log level methods and structured formatting.
3.  **[TODO]** Configure the service to be environment-aware.
4.  **[TODO]** Refactor `screenplay-interactive.ts` to use `LoggingService`.
5.  **[TODO]** Evaluate and plan for the integration of a remote logging tool (Phase 3).

By following this plan, we will significantly improve the developer experience, reduce the time it takes to debug issues, and gain crucial insights into how our application behaves in production.

