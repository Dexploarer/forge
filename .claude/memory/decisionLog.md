# Decision Log: Forge Backend

This document tracks all major technical decisions, their rationale, alternatives considered, and outcomes.

---

## ADR-001: Runtime Selection - Bun vs Node.js

**Date**: 2024-10-15
**Status**: ✅ Accepted
**Decision Maker**: Architecture Team

### Decision
Use **Bun** as the runtime instead of Node.js.

### Context
Need a fast, TypeScript-native runtime for the backend API server. Performance and developer experience are priorities.

### Options Considered
1. **Node.js** - Industry standard, mature ecosystem
2. **Bun** - New runtime, faster, native TypeScript
3. **Deno** - Secure by default, modern APIs

### Decision Rationale
- **Performance**: Bun is 2-4x faster than Node.js
- **TypeScript**: Native support, no transpilation needed
- **Simplicity**: Single binary, simpler tooling
- **Ecosystem**: Compatible with Node.js packages
- **Testing**: Built-in test runner (no Jest/Mocha needed)

### Trade-offs
- **Maturity**: Newer, less battle-tested than Node.js
- **Support**: Smaller community, fewer resources
- **Production Use**: Limited production case studies

### Outcome
**Successful**. Bun performs excellently, test runner is fast, TypeScript experience is seamless.

---

## ADR-002: Framework Selection - Fastify vs Express

**Date**: 2024-10-15
**Status**: ✅ Accepted

### Decision
Use **Fastify** as the web framework instead of Express.

### Context
Need a performant, type-safe web framework with good plugin ecosystem.

### Options Considered
1. **Express** - Industry standard, huge ecosystem
2. **Fastify** - Performance-focused, TypeScript-first
3. **Hono** - Ultrafast, edge-ready
4. **Koa** - Minimalist, modern

### Decision Rationale
- **Performance**: 2-3x faster than Express
- **TypeScript**: First-class support with type providers
- **Validation**: Built-in schema validation
- **Plugins**: Rich ecosystem (auth, CORS, multipart, etc.)
- **Documentation**: Excellent docs and community

### Trade-offs
- **Ecosystem Size**: Smaller than Express
- **Learning Curve**: Different patterns from Express

### Outcome
**Successful**. Fastify's plugin system and type safety work excellently. Performance is noticeably better.

---

## ADR-003: ORM Selection - Drizzle vs Prisma

**Date**: 2024-10-16
**Status**: ✅ Accepted

### Decision
Use **Drizzle ORM** instead of Prisma.

### Context
Need type-safe database access with migrations and good PostgreSQL support.

### Options Considered
1. **Prisma** - Popular, great DX, comprehensive
2. **Drizzle** - Lightweight, type-safe, performant
3. **TypeORM** - Mature, feature-rich
4. **Kysely** - SQL builder, very type-safe

### Decision Rationale
- **Type Safety**: Full TypeScript inference
- **Performance**: Minimal overhead, close to raw SQL
- **Flexibility**: Direct SQL access when needed
- **Simplicity**: No code generation, no runtime magic
- **Migrations**: Built-in migration system
- **Relations**: Intuitive relational queries

### Trade-offs
- **DX**: Less polished than Prisma Studio
- **Ecosystem**: Smaller community
- **Features**: Fewer advanced features

### Outcome
**Successful**. Drizzle's type safety is excellent, migrations work well, performance is great.

---

## ADR-004: Testing Strategy - Real Tests vs Mocks

**Date**: 2024-10-20
**Status**: ✅ Accepted

### Decision
Use **real integration tests** with actual database, NO mocks or spies.

### Context
Need comprehensive testing that finds real bugs, not test bugs.

### Options Considered
1. **Unit Tests with Mocks** - Fast, isolated, common practice
2. **Integration Tests (Real DB)** - Slower, comprehensive
3. **Hybrid Approach** - Mix of unit and integration

### Decision Rationale
- **Real Bugs**: Mocks test your mocks, not your code
- **Confidence**: Integration tests prove the system works
- **Simplicity**: No mock maintenance
- **Fastify's Inject**: Excellent HTTP testing without network
- **Speed**: Bun makes tests fast enough

### Trade-offs
- **Speed**: Slower than mocked unit tests (but still < 10s)
- **Setup**: Requires database setup
- **Complexity**: More moving parts in tests

### Outcome
**Successful**. Tests have found numerous real bugs (auth plugin, SQL count, date serialization). Test suite runs in 8 seconds.

---

## ADR-005: Async Operations - Simple Pattern vs Job Queue

**Date**: 2024-11-01
**Status**: ✅ Accepted

### Decision
Use **simple async pattern** (202 Accepted + background processing) instead of BullMQ + Redis job queue.

### Context
Long-running AI operations (30-90s) need async processing. Need to decide between simple solution and full job queue.

### Options Considered
1. **Simple Async** - Return 202, process in background, store status in DB
2. **BullMQ + Redis** - Full job queue with persistence and retries
3. **Inngest** - Managed job queue service
4. **Trigger.dev** - Managed workflow service

### Decision Rationale
- **Simplicity**: 1-2 days vs 3-4 days implementation
- **Cost**: $0 vs $15-50/month for Redis
- **Scale**: Handles < 10,000 ops/day easily
- **MVP Focus**: Get to market faster
- **Upgrade Path**: Easy to migrate to Inngest later

### Trade-offs
- **Reliability**: Jobs lost on server restart (acceptable for MVP)
- **Retries**: No automatic retries (add later if needed)
- **Monitoring**: Basic logging only
- **Concurrency**: Limited by single server

### Outcome
**Successful**. Simple async pattern works great. Users understand occasional failures. Will upgrade to Inngest when > 10k ops/day.

### When to Reconsider
- Traffic exceeds 10,000 operations/day
- User complaints about lost jobs
- Need scheduled job execution
- Require complex workflows

---

## ADR-006: Authentication - Privy vs Custom JWT

**Date**: 2024-10-16
**Status**: ✅ Accepted

### Decision
Use **Privy** for authentication instead of building custom JWT system.

### Context
Need authentication that supports Web3 (wallets), Web2 (email), and Farcaster.

### Options Considered
1. **Custom JWT** - Full control, no vendor lock-in
2. **Privy** - Managed auth with Web3 support
3. **Clerk** - Managed auth, primarily Web2
4. **Auth0** - Enterprise-grade auth

### Decision Rationale
- **Web3 Support**: Native wallet authentication
- **Farcaster**: Built-in Farcaster integration
- **Simplicity**: No auth infrastructure to maintain
- **Security**: Professional security implementation
- **DX**: Simple SDK, good documentation

### Trade-offs
- **Vendor Lock-in**: Dependent on Privy
- **Cost**: Free tier limits (upgrade needed at scale)
- **Flexibility**: Less control than custom solution

### Outcome
**Successful**. Privy integration works seamlessly. Users can authenticate with wallets, email, or Farcaster.

---

## ADR-007: Validation - Zod for Runtime Validation

**Date**: 2024-10-16
**Status**: ✅ Accepted

### Decision
Use **Zod** for all input validation and schema definition.

### Context
Need runtime validation that works with TypeScript types and Fastify.

### Options Considered
1. **Zod** - TypeScript-first, runtime validation
2. **Joi** - Popular, mature validation library
3. **Yup** - Schema builder, React Form integration
4. **JSON Schema** - Standard, verbose

### Decision Rationale
- **TypeScript**: Infers types automatically
- **Fastify Integration**: Excellent Fastify support
- **DX**: Intuitive API, great error messages
- **Performance**: Fast validation
- **Composability**: Easy to reuse and extend schemas

### Trade-offs
- **Bundle Size**: Larger than minimal validators
- **Learning Curve**: Zod-specific API

### Outcome
**Successful**. Zod validation catches bugs early, types are always in sync with schemas.

---

## ADR-008: Deployment - Railway vs Vercel/AWS

**Date**: 2024-10-28
**Status**: ✅ Accepted

### Decision
Deploy to **Railway** instead of Vercel or AWS.

### Context
Need production hosting with PostgreSQL, easy deployment, reasonable cost.

### Options Considered
1. **Railway** - PaaS with PostgreSQL, simple deployment
2. **Vercel** - Optimized for Next.js, serverless
3. **AWS** - Full control, complex setup
4. **Fly.io** - Docker-based, global deployment

### Decision Rationale
- **PostgreSQL**: Built-in PostgreSQL service
- **Simplicity**: One-command deployment
- **Cost**: Predictable pricing, free tier
- **Bun Support**: Nixpacks auto-detects Bun
- **Monitoring**: Built-in logs and metrics

### Trade-offs
- **Scale**: Less scalable than AWS
- **Features**: Fewer services than AWS
- **Control**: Less infrastructure control

### Outcome
**Successful**. Railway deployment is simple, PostgreSQL works great, monitoring is adequate.

---

## ADR-009: Logging - Pino for Structured Logging

**Date**: 2024-10-17
**Status**: ✅ Accepted

### Decision
Use **Pino** for structured logging.

### Context
Need fast, structured logging for production debugging.

### Options Considered
1. **Pino** - Fast, JSON-structured, Fastify default
2. **Winston** - Feature-rich, popular
3. **Console** - Simple, no dependencies

### Decision Rationale
- **Performance**: Fastest Node.js logger
- **Fastify**: Native Fastify integration
- **Pretty Printing**: pino-pretty for development
- **JSON**: Structured logs for production
- **Ecosystem**: Good transport options

### Outcome
**Successful**. Logs are readable in dev, structured in production, performance is excellent.

---

## ADR-010: File Storage - File Server vs S3

**Date**: 2024-10-30
**Status**: ✅ Accepted (Pending Implementation)

### Decision
Use dedicated **Railway file server** for file storage instead of AWS S3 or local storage.

### Context
Need reliable storage for large files (GLB models 5-50MB, audio files).

### Options Considered
1. **Local Storage** - Simple, no cost
2. **AWS S3** - Industry standard, scalable
3. **Railway File Server** - Dedicated service, Railway network
4. **Cloudflare R2** - S3-compatible, no egress fees

### Decision Rationale
- **Simplicity**: Deploy alongside backend
- **Cost**: No egress fees within Railway
- **Performance**: Internal network transfer
- **Integration**: Easy to integrate

### Trade-offs
- **Scalability**: Less scalable than S3
- **Features**: Fewer features than S3
- **Redundancy**: Less redundant than S3

### Outcome
**Pending**. File server client service implemented, not yet fully integrated.

---

## ADR-011: Vector Database - Defer Until Proven Need

**Date**: 2024-11-01
**Status**: 🔄 Deferred

### Decision
**Defer** Qdrant vector database integration until semantic search is actively needed.

### Context
Vector database would enable semantic search across lore, NPCs, quests. Qdrant service implemented but not integrated.

### Options Considered
1. **Implement Now** - Qdrant service ready, add routes
2. **Defer** - Wait for user demand, simpler MVP
3. **Never** - Use PostgreSQL full-text search only

### Decision Rationale
- **MVP Focus**: Not critical for initial launch
- **Complexity**: Additional service to maintain
- **Cost**: Qdrant Cloud pricing unclear
- **Demand**: No user requests for semantic search yet
- **Alternative**: PostgreSQL full-text search sufficient

### Decision
Defer until:
- User requests for semantic search
- Content volume makes search difficult
- Budget allows for additional service

### Outcome
**Deferred**. Service code exists, can be enabled quickly when needed.

---

## ADR-012: Error Handling - Global Handler Pattern

**Date**: 2024-10-18
**Status**: ✅ Accepted

### Decision
Use **global error handler** with typed error classes, throw errors in routes/middleware.

### Context
Need consistent error responses, proper HTTP status codes, security (no leak of internals).

### Options Considered
1. **Global Handler** - Centralized error formatting
2. **Per-Route Handling** - Explicit error responses
3. **Middleware Chain** - Error catching middleware

### Decision Rationale
- **Consistency**: All errors formatted the same way
- **DRY**: No repeated error response code
- **Security**: Production errors sanitized automatically
- **Logging**: Centralized error logging with context
- **Type Safety**: Typed error classes with status codes

### Outcome
**Successful**. Error handling is consistent, secure, and maintainable. Found bug: don't send responses in middleware, throw instead.

---

## Lessons Learned

### What Worked Well
1. **Real Testing** - Found numerous real bugs (auth, SQL, dates)
2. **Simple Async** - MVP doesn't need job queue complexity
3. **Type Safety** - Caught many bugs at compile time
4. **Fastify Plugins** - Clean separation of concerns
5. **Drizzle ORM** - Type-safe queries, good performance

### What Could Be Improved
1. **Test Setup** - Audio tests need better auth patterns
2. **Documentation** - More inline code comments
3. **Monitoring** - Need production monitoring plan
4. **Performance** - No load testing yet

### Future Decision Points
1. **Job Queue** - When to upgrade from simple async?
2. **Caching** - When to add Redis?
3. **Vector DB** - When to integrate Qdrant?
4. **Scaling** - When to add horizontal scaling?
5. **Real-time** - When to add WebSockets?

---

**Last Updated**: 2025-11-01
**Next Review**: After production deployment or when > 10k ops/day
