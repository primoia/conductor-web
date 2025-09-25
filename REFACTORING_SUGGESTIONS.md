# Refactoring Suggestions for ScreenplayInteractive Component Testability

## Overview
Based on the analysis of the `ScreenplayInteractive` component, here are key refactoring suggestions to improve testability while maintaining current functionality.

## 1. **Dependency Injection and Service Extraction**

### Problem
- Direct DOM manipulation and localStorage access make testing difficult
- Hard-coded dependencies on `document` and `window` objects
- Tightly coupled file operations

### Solution
Extract services for better dependency injection:

```typescript
// NEW: agent-persistence.service.ts
@Injectable({ providedIn: 'root' })
export class AgentPersistenceService {
  private readonly STORAGE_KEY = 'screenplay-agent-instances';

  saveAgentInstances(instances: Map<string, AgentInstance>): void {
    const serializableInstances = Array.from(instances.entries());
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(serializableInstances));
  }

  loadAgentInstances(): Map<string, AgentInstance> {
    const storedState = localStorage.getItem(this.STORAGE_KEY);
    if (storedState) {
      try {
        const parsedState = JSON.parse(storedState);
        return new Map<string, AgentInstance>(parsedState);
      } catch (e) {
        console.error('Error loading state:', e);
      }
    }
    return new Map();
  }
}

// NEW: dom-query.service.ts
@Injectable({ providedIn: 'root' })
export class DomQueryService {
  querySelector(selector: string): HTMLElement | null {
    return document.querySelector(selector);
  }

  findEmojiElements(container: HTMLElement, emoji: string): HTMLElement[] {
    // Extract emoji finding logic
  }
}
```

### Benefits
- Easy to mock services in tests
- Clear separation of concerns
- Reusable across components

## 2. **Extract Core Business Logic**

### Problem
- Business logic mixed with Angular lifecycle and DOM manipulation
- Hard to test synchronization logic in isolation

### Solution
Create pure functions for core logic:

```typescript
// NEW: agent-synchronization.utils.ts
export class AgentSynchronizationUtils {
  static findEmojisInText(text: string): EmojiMatch[] {
    const emojiPattern = /(\u{1F680}|\u{1F510}|\u{1F4CA}|...)/gu;
    const anchorAndEmojiRegex = new RegExp(
      `(<!--\\s*agent-id:\\s*([a-f0-9-]+)\\s*-->\\s*)?(${emojiPattern.source.slice(1, -3)})`,
      'gu'
    );

    const matches: EmojiMatch[] = [];
    let match;
    while ((match = anchorAndEmojiRegex.exec(text)) !== null) {
      matches.push({
        agentId: match[2],
        emoji: match[3],
        fullMatch: match[0],
        index: match.index
      });
    }
    return matches;
  }

  static injectAnchors(text: string, matches: EmojiMatch[]): string {
    // Pure function to inject anchors
    let result = text;
    for (const match of matches.reverse()) { // Reverse to maintain indices
      if (!match.agentId) {
        const newId = UuidGenerator.generate();
        const newFragment = `<!-- agent-id: ${newId} -->${match.fullMatch}`;
        result = result.substring(0, match.index) + newFragment + result.substring(match.index + match.fullMatch.length);
        match.agentId = newId;
      }
    }
    return result;
  }

  static reconcileInstances(
    currentInstances: Map<string, AgentInstance>,
    foundMatches: EmojiMatch[]
  ): {
    toCreate: EmojiMatch[],
    toKeep: string[],
    toRemove: string[]
  } {
    // Pure function for reconciliation logic
  }
}
```

### Benefits
- Easily testable pure functions
- Clear input/output contracts
- Reusable logic components

## 3. **Separate File Operations**

### Problem
- File I/O mixed with component logic
- Hard to test save/load functionality

### Solution
Extract file operations to a service:

```typescript
// NEW: file-operations.service.ts
@Injectable({ providedIn: 'root' })
export class FileOperationsService {
  loadMarkdownFile(): Promise<{ content: string, filename: string }> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,.txt';
      input.onchange = (event: any) => {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({
              content: e.target?.result as string,
              filename: file.name
            });
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        }
      };
      input.click();
    });
  }

  saveMarkdownFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

## 4. **Improve Component Structure**

### Problem
- Large monolithic component with multiple responsibilities
- Mixed async operations and synchronous state updates

### Solution
Break down into focused methods:

```typescript
export class ScreenplayInteractive {
  // IMPROVED: Clear method responsibilities

  async loadMarkdownFile(): Promise<void> {
    try {
      const { content, filename } = await this.fileOperationsService.loadMarkdownFile();
      await this.processNewMarkdownContent(content, filename);
    } catch (error) {
      console.error('Failed to load file:', error);
    }
  }

  private async processNewMarkdownContent(content: string, filename: string): Promise<void> {
    // Clear previous state
    this.clearAgentState();

    // Update content
    this.editorContent = content;
    this.currentFileName = filename;

    // Wait for DOM update, then synchronize
    await this.waitForDomUpdate();
    this.synchronizeAgentsWithMarkdown();
  }

  private async waitForDomUpdate(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  private synchronizeAgentsWithMarkdown(): void {
    // Call the extracted pure functions
    const matches = AgentSynchronizationUtils.findEmojisInText(this.editorContent);
    const updatedText = AgentSynchronizationUtils.injectAnchors(this.editorContent, matches);
    const reconciliation = AgentSynchronizationUtils.reconcileInstances(this.agentInstances, matches);

    // Apply changes
    this.applyReconciliation(reconciliation, matches);
    this.editorContent = updatedText;
    this.positionAgentsOverEmojis();
    this.persistenceService.saveAgentInstances(this.agentInstances);
  }
}
```

## 5. **Add Configuration Interface**

### Problem
- Hard-coded values scattered throughout the code
- Difficult to test edge cases with different configurations

### Solution
Centralize configuration:

```typescript
interface ScreenplayConfig {
  debounceMs: number;
  positioningRetries: number;
  defaultAgentPosition: { x: number, y: number };
  emojiSize: number;
  storageKey: string;
}

const DEFAULT_CONFIG: ScreenplayConfig = {
  debounceMs: 1000,
  positioningRetries: 3,
  defaultAgentPosition: { x: 100, y: 100 },
  emojiSize: 30,
  storageKey: 'screenplay-agent-instances'
};
```

## 6. **Improve Error Handling**

### Problem
- Inconsistent error handling
- Hard to test error scenarios

### Solution
Standardize error handling:

```typescript
private async handleAsyncOperation<T>(
  operation: () => Promise<T>,
  errorContext: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    console.error(`${errorContext}:`, error);
    // Could emit to error service for centralized handling
    return null;
  }
}
```

## 7. **Test-Friendly Positioning Logic**

### Problem
- DOM positioning logic is hard to test
- Tightly coupled to specific DOM structure

### Solution
Extract positioning calculations:

```typescript
export class PositionCalculator {
  static calculateAgentPosition(
    emojiRect: DOMRect,
    containerRect: DOMRect,
    config: ScreenplayConfig
  ): CirclePosition {
    return {
      x: emojiRect.left - containerRect.left,
      y: emojiRect.top - containerRect.top
    };
  }

  static findEmojiInstances(
    container: HTMLElement,
    emoji: string
  ): HTMLElement[] {
    // Extract emoji finding logic with proper error handling
  }
}
```

## Implementation Priority

1. **High Priority**: Extract AgentSynchronizationUtils (enables testing core logic)
2. **High Priority**: Create AgentPersistenceService (enables testing state management)
3. **Medium Priority**: Extract FileOperationsService (improves file testing)
4. **Medium Priority**: Improve component structure (better maintainability)
5. **Low Priority**: Add configuration interface (nice-to-have for testing edge cases)

## Benefits Summary

- **Testability**: Pure functions and injected dependencies are easily mockable
- **Maintainability**: Smaller, focused methods with clear responsibilities
- **Reusability**: Extracted services can be used in other components
- **Debugging**: Cleaner separation makes issues easier to isolate
- **Future-proofing**: Better architecture for adding features

These changes maintain full backward compatibility while making the codebase significantly more testable and maintainable.