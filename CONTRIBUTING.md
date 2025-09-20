# Contributing to Conductor Web Chat

We love your input! We want to make contributing to Conductor Web Chat as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

## Pull Requests

Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd conductor-web
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Run type checking:**
   ```bash
   npm run typecheck
   ```

5. **Run linting:**
   ```bash
   npm run lint
   ```

## Code Style

- We use TypeScript for type safety
- We use ESLint for code linting
- We use Prettier for code formatting
- Follow the existing code style in the project

### TypeScript Guidelines

- Always use proper types, avoid `any` when possible
- Use interfaces for object shapes
- Export types that might be used by other modules
- Use proper generic types for reusable components

### React Guidelines

- Use functional components with hooks
- Use meaningful component and variable names
- Keep components small and focused
- Use proper prop types with TypeScript interfaces

### File Structure

```
src/
├── components/     # Reusable UI components
├── hooks/          # Custom React hooks
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
├── App.tsx         # Main application component
└── main.tsx        # Application entry point
```

## Commit Guidelines

- Use clear and meaningful commit messages
- Reference issues and pull requests when applicable
- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")

Example:
```
Add voice recognition support

- Implement useSpeechRecognition hook
- Add microphone button to chat input
- Support Portuguese language recognition
- Add proper error handling

Fixes #123
```

## Issue Reporting

When reporting issues, please include:

1. **Environment details:**
   - OS and version
   - Browser and version
   - Node.js version
   - npm version

2. **Steps to reproduce:**
   - Clear step-by-step instructions
   - Expected behavior
   - Actual behavior

3. **Additional context:**
   - Screenshots if applicable
   - Error messages
   - Console logs

## Feature Requests

We welcome feature requests! Please:

1. Check existing issues to avoid duplicates
2. Clearly describe the feature and its benefits
3. Provide use cases and examples
4. Consider implementation complexity

## Testing

- Write tests for new features and bug fixes
- Ensure existing tests pass
- Test on different browsers and devices
- Test with different screen sizes

## Documentation

- Update README.md for new features
- Add inline comments for complex logic
- Update TypeScript interfaces and types
- Document configuration options

## Code Review Process

1. All changes require code review
2. At least one approval from a maintainer
3. All checks must pass (TypeScript, linting, build)
4. No merge conflicts

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Getting Help

- Create an issue for bugs and feature requests
- Join our Discord community for discussions
- Check existing documentation and issues first

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for significant contributions
- Special thanks in documentation

Thank you for contributing to Conductor Web Chat! 🎉