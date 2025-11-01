# Claude Rules & Memory Bank

This directory contains comprehensive rules and memory for the Forge Backend project, created from verified documentation.

## 📁 Structure

```
.claude/
├── rules/                      # Development rules (always apply)
│   ├── coding-standards.mdc    # TypeScript conventions, error handling
│   ├── architecture-patterns.mdc # System design, tech stack
│   ├── testing-standards.mdc   # Real testing philosophy
│   └── async-operations.mdc    # Simple async pattern
├── memory/                     # Project context (reference)
│   ├── productContext.md       # Complete product overview
│   ├── progress.md             # Current state & milestones
│   ├── decisionLog.md          # Technical decisions with rationale
│   └── activeContext.md        # Current session state
└── README.md                   # This file
```

## 📊 Statistics

| Category | Files | Lines | Purpose |
|----------|-------|-------|---------|
| Rules | 4 files | 2,138 lines | Development standards |
| Memory | 4 files | 1,410 lines | Project knowledge |
| **Total** | **8 files** | **3,548 lines** | **Complete documentation** |

## 🎯 Rules (.mdc files)

### coding-standards.mdc (418 lines)
**Always applies to**: `*.ts, *.tsx`

**Core Principles**:
- KISS (Keep It Simple, Stupid)
- Production-first development (NO TODOs)
- Type safety (NO `any` types)
- Comprehensive error handling

**Key Patterns**:
- Error throwing (not sending in middleware)
- Date serialization (always ISO strings)
- SQL COUNT conversion (string to number)
- Nullable fields (explicit null, not undefined)
- Zod validation (all inputs)

**Critical "Don't Do This"**:
- ❌ Don't use any or unknown types
- ❌ Don't leave TODO comments
- ❌ Don't send responses in middleware
- ❌ Don't return undefined for nullable fields
- ❌ Don't forget SQL COUNT() conversion
- ❌ Don't skip authorization checks
- ❌ Don't jump to BullMQ prematurely

### architecture-patterns.mdc (544 lines)
**Always applies**: System-wide architecture guidance

**Tech Stack Decisions**:
- Bun (runtime)
- Fastify (framework)
- Drizzle (ORM)
- PostgreSQL (database)
- Privy (auth)
- Zod (validation)

**Architectural Patterns**:
- Singleton services
- Global error handler
- Plugin-based extensions
- RESTful + pragmatic API design
- 202 Accepted for async operations

**Performance Targets**:
- P95 < 200ms for standard operations
- 20 connection pool (production)
- 50MB max file upload
- < 10 seconds test suite

### testing-standards.mdc (643 lines)
**Always applies**: All test files

**Core Philosophy**:
- **NO MOCKS** - Real database, real server
- **NO SPIES** - Test actual behavior
- **REAL TESTING** - Full HTTP cycles
- **FAIL FAST** - Find actual bugs

**Test Patterns**:
- Fastify `.inject()` for HTTP testing
- Real PostgreSQL for database tests
- Bun test framework (native)
- Integration testing focus

**Critical Bugs Found**:
1. Auth plugin sending responses (should throw)
2. SQL COUNT() returning strings
3. Date objects not serialized
4. Undefined vs null for nullable fields
5. Error response schema inconsistencies

### async-operations.mdc (533 lines)
**Always applies**: Async/long-running operations

**Core Decision**: Use simple async pattern, NOT BullMQ

**Pattern**:
1. Return 202 Accepted immediately
2. Process in background (don't await)
3. Store status in database
4. Provide status check endpoint

**When to Upgrade**:
- Only when > 10,000 ops/day
- Use Inngest/Trigger.dev (NOT BullMQ)
- Cost: $0-20/month vs $15-50 for Redis
- Time: 2-3 days vs 3-4 days + maintenance

## 🧠 Memory (.md files)

### productContext.md (298 lines)
Complete product overview including:
- Project purpose and goals
- Technology stack with rationale
- Database schema (20 tables)
- API surface (87 endpoints)
- Feature status and roadmap
- Current scale and metrics
- Key design decisions

### progress.md (370 lines)
Current project state:
- Sprint tracking
- Test status breakdown (85% passing)
- Feature completion status
- Technical debt register
- Next milestones
- Performance metrics
- Code statistics

### decisionLog.md (432 lines)
All major technical decisions (ADRs):
- ADR-001: Bun vs Node.js
- ADR-002: Fastify vs Express
- ADR-003: Drizzle vs Prisma
- ADR-004: Real tests vs mocks
- ADR-005: Simple async vs job queue
- ADR-006: Privy vs custom JWT
- ADR-007: Zod for validation
- ADR-008: Railway deployment
- ADR-009: Pino logging
- ADR-010: File server storage
- ADR-011: Defer vector database
- ADR-012: Global error handler

Each with: context, options, rationale, trade-offs, outcomes

### activeContext.md (310 lines)
Current session state:
- What we're working on now
- Recent changes
- Known issues & blockers
- Environment setup
- Next actions
- Quick reference commands

## 🔍 How to Use

### For Development
```bash
# Before coding, review relevant rule
cat .claude/rules/coding-standards.mdc

# Check architectural patterns
cat .claude/rules/architecture-patterns.mdc

# Before writing tests
cat .claude/rules/testing-standards.mdc

# For async operations
cat .claude/rules/async-operations.mdc
```

### For Context
```bash
# Understand the product
cat .claude/memory/productContext.md

# Check current progress
cat .claude/memory/progress.md

# Review past decisions
cat .claude/memory/decisionLog.md

# See what's happening now
cat .claude/memory/activeContext.md
```

### For AI Assistants
These files provide comprehensive context for AI code assistants. They know:
- Coding standards to follow
- Architecture patterns to use
- Testing philosophy to apply
- Decisions already made
- Current project state

## 📖 Documentation Sources

Rules and memory created from verified documentation:
- ✅ ARCHITECTURE.md
- ✅ MIGRATION.md
- ✅ QUICK_START.md
- ✅ DEPLOY_RAILWAY.md
- ✅ TESTING.md
- ✅ GUIDE_01_AUTH.md
- ✅ IMPLEMENTATION_SUMMARY.md
- ✅ CAPABILITY_COMPARISON.md
- ✅ MIGRATION_SUMMARY.md
- ✅ FINAL_INTEGRATION_REPORT.md
- ✅ IMPLEMENTATION_ROADMAP.md
- ✅ TEAMS_IMPLEMENTATION.md
- ✅ COMPLETE_TEST_COVERAGE.md
- ✅ SIMPLE_ASYNC_IMPLEMENTATION_GUIDE.md
- ✅ CRITICAL_ANALYSIS_JOB_QUEUE.md

All documentation verified for accuracy and consolidated into rules/memory.

## ✅ Verification

All rules and memory files have been:
- Created from actual project documentation
- Verified against running codebase
- Tested for accuracy
- Organized for easy reference
- Written in production-ready format

## 🚀 Quick Reference

### Critical Patterns
```typescript
// ✅ GOOD: Throw errors
throw new NotFoundError('Resource not found')

// ✅ GOOD: Serialize dates
createdAt: data.createdAt.toISOString()

// ✅ GOOD: Convert SQL COUNT
const total = Number(count ?? 0)

// ✅ GOOD: Explicit null
thumbnailUrl: asset.thumbnailUrl ?? null

// ✅ GOOD: Simple async
reply.code(202).send({ taskId, statusUrl })
processAsync(taskId).catch(...)
```

### Critical Don'ts
```typescript
// ❌ BAD: Sending in middleware
if (!auth) return reply.code(401).send(...)

// ❌ BAD: Using any
function process(data: any) { }

// ❌ BAD: Returning Date
return { createdAt: data.createdAt }

// ❌ BAD: Using undefined
return { optional: data.optional }
```

## 📝 Maintenance

### When to Update

Update rules when:
- New architectural patterns established
- New coding standards adopted
- Testing practices evolve
- Major technical decisions made

Update memory when:
- Significant progress made
- Major features completed
- Important decisions made
- Project state changes

### How to Update

```bash
# Edit relevant file
vim .claude/rules/coding-standards.mdc

# Or memory file
vim .claude/memory/progress.md

# Commit changes
git add .claude/
git commit -m "docs: update rules/memory"
```

## 🎓 Learning Path

**New Team Members**:
1. Start with `productContext.md` - Understand the product
2. Read `architecture-patterns.mdc` - Learn the system
3. Read `coding-standards.mdc` - Learn conventions
4. Read `testing-standards.mdc` - Learn testing
5. Check `progress.md` - See current state
6. Review `decisionLog.md` - Understand why

**Before New Features**:
1. Review relevant rules
2. Check decision log for related decisions
3. Update progress tracker
4. Follow established patterns

**After Completion**:
1. Update progress.md
2. Document decisions in decisionLog.md
3. Update activeContext.md
4. Commit documentation changes

---

**Created**: 2025-11-01
**Status**: Complete and Verified
**Total Documentation**: 3,548 lines across 8 files
**Source**: 15 verified documentation files
