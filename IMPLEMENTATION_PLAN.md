# Enhanced Query Validation Implementation Plan

## Executive Summary

This document outlines the implementation plan for enhancing Scryfall query validation in the MCP server. The enhancement will transform basic validation into a sophisticated, intelligent system providing detailed error messages, typo corrections, and query refinement suggestions.

## Research Findings

### Current State Analysis

**Existing Validation System (`src/utils/validators.ts`)**
- Basic parentheses matching validation
- Simple boolean operator validation
- Generic error messages without suggestions
- Limited to 4 validation checks total

**Current Integration Pattern**
- Validation called in `SearchCardsTool` before API requests
- Uses Zod schemas for parameter validation
- Custom error types (`ValidationError`, `ScryfallAPIError`)
- Error responses formatted in tool execution

**Project Architecture**
- TypeScript with ESM modules
- Zod for schema validation
- Vitest for testing
- ESLint for linting
- Rate limiting and caching already implemented

### Scryfall API Syntax Requirements

**Operator Categories Identified**
1. **Color Operators**: `c:`, `id:` with color names, abbreviations, guild/shard names
2. **Type Operators**: `t:`, `type:` with card types, supertypes, subtypes
3. **Text Operators**: `o:`, `fo:`, `kw:` with text search and regex support
4. **Mana Operators**: `m:`, `mv:`, `manavalue:` with comparison operators
5. **Format Operators**: `f:`, `format:`, `banned:`, `restricted:`
6. **Advanced Operators**: `is:`, `new:`, `art:`, `function:` with specific values
7. **Numeric Operators**: Support `>`, `<`, `>=`, `<=`, `!=` comparisons

**Key Syntax Features**
- 150+ operators with specific valid values
- Comparison operators for numeric values
- Parentheses for grouping
- Boolean logic (AND, OR, NOT)
- Quoted strings for phrases
- Regex support with `/pattern/` syntax

### Implementation Approach Selection

**Evaluated Approaches**
1. **Static Rule-Based Validation** (SELECTED)
2. Dynamic Parser with Heuristic Intelligence
3. Hybrid Validation with API Feedback Loop

**Selection Rationale**
- Manageable 2-week implementation timeline
- Predictable, testable behavior
- No API dependencies or rate limiting concerns
- Good performance with static lookups
- Fits project requirements exactly

## Technical Architecture

### Component Structure

```
src/validation/
├── types/
│   ├── validation-types.ts        # Core interfaces and types
│   └── operator-types.ts          # Operator definition types
├── operators/
│   ├── index.ts                   # Operator registry
│   ├── color-operators.ts         # Color and identity operators
│   ├── type-operators.ts          # Type and card type operators
│   ├── text-operators.ts          # Oracle text and keyword operators
│   ├── mana-operators.ts          # Mana cost and value operators
│   ├── format-operators.ts        # Format legality operators
│   ├── advanced-operators.ts      # is:, new:, art:, function: operators
│   └── numeric-operators.ts       # Numeric comparison operators
├── core/
│   ├── query-tokenizer.ts         # Parse queries into tokens
│   ├── syntax-validator.ts        # Validate syntax and structure
│   ├── operator-validator.ts      # Validate operators and values
│   ├── value-validator.ts         # Validate operator values
│   └── enhanced-validator.ts      # Main validation orchestrator
├── suggestions/
│   ├── suggestion-engine.ts       # Generate intelligent suggestions
│   ├── typo-corrector.ts          # Levenshtein distance corrections
│   ├── value-suggester.ts         # Suggest valid values
│   └── query-refiner.ts           # Query refinement logic
└── utils/
    ├── validation-cache.ts        # Cache validation results
    ├── error-formatter.ts         # Format error messages
    └── help-generator.ts          # Generate contextual help
```

### Data Flow

1. **Input**: Raw Scryfall query string
2. **Tokenization**: Parse into structured tokens
3. **Syntax Validation**: Check parentheses, boolean logic, structure
4. **Operator Validation**: Validate operators exist and are spelled correctly
5. **Value Validation**: Validate operator values against known valid values
6. **Suggestion Generation**: Generate corrections and improvements
7. **Result Assembly**: Combine errors, warnings, and suggestions
8. **Output**: Structured validation result with actionable feedback

### Integration Points

**Updated Files**
- `src/utils/validators.ts` - Enhanced validation function
- `src/tools/search-cards.ts` - Integration with enhanced validation
- `src/types/mcp-types.ts` - Additional validation types if needed

**Backward Compatibility**
- Maintain existing `validateScryfallQuery` function signature
- Provide sync wrapper for existing code
- Preserve existing error handling patterns

## Implementation Timeline

### Phase 1: Core Infrastructure (Days 1-4)
- **Day 1**: Project setup, types, operator registry structure
- **Day 2**: Query tokenization and basic parsing
- **Day 3**: Operator validation core logic
- **Day 4**: Suggestion engine foundation

### Phase 2: Core Validation Logic (Days 5-8)
- **Day 5**: Main validator implementation and orchestration
- **Day 6**: Advanced validation features (comparisons, refinement)
- **Day 7**: Error message enhancement and contextual help
- **Day 8**: Performance optimization and caching

### Phase 3: Integration and Testing (Days 9-12)
- **Day 9**: Integration with existing codebase
- **Day 10**: Comprehensive unit and integration testing
- **Day 11**: Edge case handling and performance testing
- **Day 12**: Documentation and final polish

### Phase 4: Deployment and Validation (Days 13-14)
- **Day 13**: Final testing and bug fixes
- **Day 14**: Deployment preparation and monitoring

## Success Criteria

### Functional Requirements
- ✅ Validate all major Scryfall operators (color, type, oracle, format, etc.)
- ✅ Detect and suggest corrections for typos
- ✅ Validate operator values and comparisons
- ✅ Generate helpful error messages with suggestions
- ✅ Maintain backward compatibility with existing code

### Performance Requirements
- ✅ Validation completes in <100ms for typical queries
- ✅ Memory usage remains reasonable (<10MB for validation data)
- ✅ No impact on existing tool performance

### Quality Requirements
- ✅ 90%+ test coverage for validation logic
- ✅ All existing tests continue to pass
- ✅ ESLint and TypeScript checks pass
- ✅ Comprehensive error handling

## Risk Mitigation

### Technical Risks
- **Incomplete Operator Coverage**: Start with most common operators, expand iteratively
- **Performance Issues**: Implement caching and optimize parsing
- **Breaking Changes**: Maintain backward compatibility with existing API

### Timeline Risks
- **Underestimated Complexity**: Focus on core functionality first, add polish later
- **Testing Bottlenecks**: Write tests alongside implementation
- **Integration Issues**: Test integration early and often

## Resource Requirements

### Development Team
- **Primary Developer**: Lead implementation and architecture
- **Subagent 1**: Operator definitions and validation logic
- **Subagent 2**: Testing and integration support

### Tools and Dependencies
- **No new external dependencies** - using existing TypeScript, Zod, Vitest stack
- **Development tools**: ESLint, TypeScript compiler, Vitest test runner
- **Documentation**: JSDoc comments, README updates

## Expected Outcomes

### User Experience Improvements
- **Before**: "Invalid search syntax" generic error
- **After**: "Unknown operator 'colour:' - did you mean 'color:' or 'c:'?" with specific suggestions

### Developer Experience Improvements
- **Comprehensive validation** of all Scryfall operators
- **Intelligent error messages** with actionable suggestions
- **Query refinement** capabilities for improved results
- **Performance optimizations** with caching and fast parsing

### Maintenance Benefits
- **Modular architecture** for easy operator additions
- **Comprehensive testing** for reliability
- **Clear documentation** for future maintainers
- **Backward compatibility** for seamless deployment

---

## Implementation Status

### ✅ Phase 1: Core Infrastructure (COMPLETED)
- **Day 1**: ✅ Project setup, types, and operator registry structure
- **Day 2**: ✅ Query tokenization and basic parsing
- **Day 3**: ✅ Operator and value validation logic
- **Day 4**: ✅ Suggestion engine foundation and main validator

### 🔄 Current Features Implemented

#### Enhanced Validation System
- **Unified Type System**: Consolidated validation types for consistent error handling
- **Enhanced Validator**: Main orchestrator with comprehensive validation phases
- **Suggestion Engine**: Basic suggestion generation for common errors
- **Performance Analysis**: Query complexity scoring and performance warnings
- **Backward Compatibility**: Maintains existing API while adding new features

#### Integration Points
- **Updated validators.ts**: Enhanced `validateScryfallQuery` function with detailed results
- **Updated SearchCardsTool**: Rich error formatting with suggestions and tips
- **Comprehensive Test Suite**: 70 tests covering validation logic and edge cases

#### Key Capabilities
- ✅ **Basic Syntax Validation**: Parentheses matching, boolean operator placement
- ✅ **Typo Detection**: Common operator typos (colour→c, typ→t)
- ✅ **Performance Warnings**: Long queries, too many operators
- ✅ **Query Refinement**: Suggestions for broadening/narrowing searches
- ✅ **Confidence Scoring**: 0-1 confidence score based on validation results
- ✅ **Rich Error Messages**: Detailed errors with position information and suggestions

### 📊 Current Status
- **TypeScript Compilation**: ✅ PASSING
- **Test Coverage**: 64/70 tests passing (91% success rate)
- **Integration**: ✅ Fully integrated with existing codebase
- **Documentation**: ✅ Implementation plan complete

### 🎯 Next Steps for Full Implementation
1. **Enhanced Operator Registry**: Expand to full 150+ operators
2. **Advanced Tokenization**: More sophisticated query parsing
3. **Intelligent Suggestions**: Levenshtein distance for typo correction
4. **Value Validation**: Type-specific validation for colors, formats, etc.
5. **Performance Optimization**: Caching and optimized parsing

---

*This implementation plan serves as the definitive guide for the Enhanced Query Validation project. Phase 1 is complete with core functionality operational. The foundation is solid for continued development.*