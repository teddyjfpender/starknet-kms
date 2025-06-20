# Contributor Guide

Welcome to the StarKMS project! This guide will help you understand how to contribute effectively to our experimental Starknet Key Management System.

## ⚠️ Important Notice

This is a **proof of concept** project for research and educational purposes. **Do not use in production environments.**

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.1.34
- Node.js >= 18
- Basic understanding of cryptography and zero-knowledge proofs
- Familiarity with TypeScript and Starknet ecosystem

### Development Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/teddyjfpender/starkms.git
   cd starkms
   bun install
   ```

2. **Verify Setup**
   ```bash
   bun run ci  # Runs typecheck, lint, build, and test
   ```

## Project Structure

```
packages/
├── crypto/           # Core cryptographic primitives
├── key-management/   # HD wallet & key derivation
├── util/            # Utility functions
├── common/          # Shared types and functionality
└── mental-poker/    # Mental poker implementation
```

## Development Workflow

### 1. Code Quality Standards

- **TypeScript**: Strict mode enabled, full type coverage required
- **Linting**: Biome for code formatting and linting
- **Testing**: Jest/Vitest with comprehensive test coverage
- **CI/CD**: All checks must pass before merging

### 2. Making Changes

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes
# ... edit files ...

# Run the full CI pipeline
bun run ci

# Commit and push
git add .
git commit -m "feat: your descriptive commit message"
git push origin feature/your-feature-name
```

### 3. Commit Message Format

Follow conventional commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `test:` - Test additions/modifications
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

## Security Guidelines

### 🔒 Cryptographic Code

- **Never compromise on security** for convenience
- **Validate all inputs** rigorously
- **Use constant-time operations** when possible  
- **Follow established cryptographic practices**
- **Document security assumptions** clearly

### 🧪 Testing Cryptographic Code

- **Test edge cases** thoroughly
- **Include property-based tests** for mathematical operations
- **Validate against known test vectors**
- **Test error conditions** and input validation

### 🔍 Code Review Process

All cryptographic code requires:
1. **Automated security analysis** (DeepSource)
2. **Manual security review** by maintainers
3. **Comprehensive test coverage** (>95%)
4. **Documentation** of security properties

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun run build` | Build all packages |
| `bun run test:unit` | Run unit tests |
| `bun run lint` | Check code style |
| `bun run format` | Format code |
| `bun run typecheck` | Type checking |
| `bun run ci` | Complete CI pipeline |

## Package-Specific Guidelines

### @starkms/crypto

- **Zero-knowledge proofs**: Follow formal verification practices
- **Curve operations**: Use proven implementations (noble-curves)
- **Hash functions**: Stick to standardized algorithms
- **Random number generation**: Use cryptographically secure sources

### @starkms/key-management

- **HD wallets**: Follow BIP-44 standard
- **Key derivation**: Implement proper key stretching
- **Storage**: Never store private keys in plaintext
- **Access control**: Implement proper authorization

## Documentation Standards

### Code Documentation

- **Public APIs**: Complete JSDoc documentation
- **Complex algorithms**: Inline explanations
- **Security properties**: Explicit documentation
- **Examples**: Working code samples

### Mathematical Documentation

- **Formulas**: Use LaTeX notation where appropriate
- **Proofs**: Reference academic papers
- **Assumptions**: Clearly state all assumptions
- **Limitations**: Document known limitations

## Testing Guidelines

### Unit Tests

```typescript
describe('cryptographic operation', () => {
  it('should handle valid inputs correctly', () => {
    // Test happy path
  });

  it('should reject invalid inputs', () => {
    // Test input validation
  });

  it('should maintain security properties', () => {
    // Test security invariants
  });
});
```

### Property-Based Testing

```typescript
import { fc } from 'fast-check';

it('should maintain mathematical properties', () => {
  fc.assert(
    fc.property(fc.bigInt(), (input) => {
      // Test mathematical properties
      const result = operation(input);
      expect(result).toSatisfyProperty();
    })
  );
});
```

## Performance Considerations

- **Benchmark critical paths**
- **Optimize for security first, performance second**
- **Document performance characteristics**
- **Test with realistic data sizes**

## Getting Help

- **Issues**: Use GitHub issues for bug reports
- **Discussions**: Use GitHub discussions for questions
- **Security**: Email maintainers directly for security issues
- **Code Review**: Be patient - security reviews take time

## Code of Conduct

- **Be respectful** in all interactions
- **Focus on constructive feedback**
- **Assume good intentions**
- **Help newcomers** understand the codebase
- **Prioritize security** over convenience

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.

---

**Remember**: This is experimental software. Every line of code could impact security. Take time to understand the cryptographic principles before making changes. 