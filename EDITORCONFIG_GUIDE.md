# EditorConfig Configuration Guide

## Overview

This `.editorconfig` file provides consistent formatting rules across different editors and IDEs, specifically optimized for your TypeScript MCP server project. It ensures seamless collaboration between JetBrains IntelliJ IDEA and VS Code users.

## Key Design Principles

### 1. **Cross-Platform Compatibility**
- **Line Endings**: `end_of_line = lf` ensures consistent line endings across Windows, macOS, and Linux
- **Character Encoding**: `charset = utf-8` provides universal character support
- **File Endings**: `insert_final_newline = true` ensures proper git diffs and POSIX compliance

### 2. **TypeScript Best Practices**
- **Indentation**: 2 spaces (industry standard for TypeScript/JavaScript)
- **Line Length**: 100 characters (balances readability with modern screen sizes)
- **Whitespace**: Automatic trailing whitespace removal prevents git diff noise

### 3. **IDE Compatibility**
- **IntelliJ IDEA**: Fully supports all EditorConfig settings
- **VS Code**: Native EditorConfig support via built-in extension
- **Rearrange Code**: Settings won't conflict with IntelliJ's code formatting

## Setting Explanations

### Universal Settings (`[*]`)
```ini
charset = utf-8                    # Universal character encoding
end_of_line = lf                   # Unix-style line endings (cross-platform)
insert_final_newline = true       # POSIX compliance, better git diffs
trim_trailing_whitespace = true   # Clean code, no diff noise
max_line_length = 100            # Modern standard (was 80, now 100-120)
```

### TypeScript/JavaScript (`[*.{ts,js,mts,cts,mjs,cjs}]`)
```ini
indent_style = space              # Spaces over tabs (TS community standard)
indent_size = 2                   # 2 spaces (Angular style guide, Prettier default)
```

**Why 2 spaces?**
- Angular style guide recommendation
- Prettier default configuration
- Better for nested code structures
- Consistent with your existing ESLint setup

### JSON Files (`[*.json]`, `[*.jsonc]`)
```ini
indent_size = 2                   # Consistent with TypeScript files
```
Covers `package.json`, `tsconfig.json`, and other configuration files.

### Markdown (`[*.{md,markdown}]`)
```ini
trim_trailing_whitespace = false  # Preserves markdown line breaks (two spaces)
max_line_length = 120            # Longer lines for documentation
```

**Special handling**: Markdown uses trailing spaces for line breaks, so we preserve them.

## Alignment with Your Project

### 1. **ESLint Compatibility**
Your `.eslintrc.json` doesn't specify indentation rules, so EditorConfig provides the foundation:
- No conflicts with existing ESLint rules
- Complements your `@typescript-eslint` setup
- Works with `eslint --fix` command

### 2. **TypeScript Configuration**
Aligns with your `tsconfig.json` settings:
- ES2022 target compatibility
- ESNext module system
- Strict mode compliance

### 3. **VS Code Integration**
Works seamlessly with your existing VS Code configuration:
- Prettier extension compatibility
- ESLint extension integration
- GitLens and other extensions

### 4. **Development Workflow**
Supports your npm scripts:
- `npm run lint` - No formatting conflicts
- `npm run build` - Consistent code style
- `npm run dev` - Clean development experience

## IDE-Specific Recommendations

### IntelliJ IDEA
1. **Enable EditorConfig**: File → Settings → Editor → Code Style → Enable EditorConfig support
2. **Rearrange Code**: The settings won't interfere with "Rearrange Code" action
3. **TypeScript**: Settings align with IntelliJ's TypeScript formatting defaults

### VS Code
1. **EditorConfig Extension**: Install `EditorConfig.EditorConfig` (if not already installed)
2. **Prettier Integration**: Settings complement Prettier configuration
3. **Auto-formatting**: Works with "Format on Save" feature

## File Coverage

The configuration covers all relevant file types in your project:

- **Source Code**: `.ts`, `.js` files
- **Configuration**: `.json`, `.jsonc` files  
- **Documentation**: `.md` files
- **Environment**: `.env` files
- **Build Tools**: `Dockerfile`, `Makefile`
- **Version Control**: `.gitignore`, `.gitattributes`
- **Editor Settings**: `.vscode/**` files

## Verification

To verify the configuration is working:

1. **Create a test file** with inconsistent formatting
2. **Open in your IDE** and check if formatting is applied
3. **Run your linting** with `npm run lint`
4. **Check git diffs** for clean, consistent changes

## Best Practices

1. **Commit the .editorconfig** to version control
2. **Ensure team members** have EditorConfig support enabled
3. **Don't override** these settings in IDE-specific configurations
4. **Update as needed** when adding new file types to your project

## Troubleshooting

### Common Issues
- **Settings not applied**: Restart your IDE after adding .editorconfig
- **Conflicts with Prettier**: This configuration is Prettier-compatible
- **Git line ending issues**: The `end_of_line = lf` setting resolves this

### Verification Commands
```bash
# Check if EditorConfig is working
npm run lint                    # Should pass without formatting issues
npm run type-check             # Should pass without errors
```

This configuration provides a solid foundation for consistent code formatting across your development team while maintaining compatibility with your existing toolchain.
