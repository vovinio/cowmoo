# Feature-Type Questions

When planning tasks for a feature, ask targeted questions based on the feature type. This produces better decisions than open-ended "any preferences?" — and it surfaces requirements the specs may not cover.

Ask **one question at a time** from the relevant category. Skip questions the specs already answer.

## UI Features (pages, dashboards, forms)

- **Layout density:** Spacious with whitespace, or compact/data-dense? (Affects component choices and spacing)
- **Primary device:** Desktop-focused, mobile-first, or equal priority? (Affects layout strategy)
- **Data volume:** How many items will typical views show? (Determines pagination vs infinite scroll vs virtualization)
- **Interactivity level:** Read-mostly, or heavy editing/drag-drop/real-time? (Affects framework needs)
- **Empty states:** What should users see when there's no data yet? (Often forgotten in specs)

## API Features (endpoints, integrations)

- **Pagination style:** Offset-based, cursor-based, or page-number? (Hard to change later)
- **Rate limiting:** Public endpoints need it. What limits make sense? (Per-user, per-IP, per-endpoint)
- **Bulk operations:** Will users need to create/update/delete many items at once? (Affects API design)
- **Error granularity:** Generic errors, or field-level validation details? (Affects frontend error handling)
- **Versioning:** Will the API need versioning? (Usually no for internal APIs, yes for external)

## Auth Features (login, permissions, roles)

- **Session strategy:** Cookie-based sessions, JWT tokens, or OAuth? (Architecture-level decision)
- **Password requirements:** Minimum length, complexity rules? (Affects validation)
- **MFA:** Required, optional, or not needed? (Significant scope impact)
- **Role management:** Fixed roles in code, or admin-configurable? (Complexity varies dramatically)
- **Session lifetime:** How long before re-auth? Remember-me option? (UX vs security tradeoff)

## Data Features (models, schemas, migrations)

- **Soft delete:** Should deleted records be recoverable? (Affects queries everywhere)
- **Audit trail:** Need to track who changed what and when? (Adds complexity to every write)
- **Search:** Full-text search needed? Which fields? (May need different indexing strategy)
- **File uploads:** What types, size limits, storage backend? (S3, local, database)
- **Data import/export:** CSV, JSON, bulk operations? (Often requested after launch)

## Integration Features (third-party APIs, webhooks)

- **Failure handling:** Retry strategy, circuit breakers, fallback behavior? (External services fail)
- **Webhook security:** Signature verification, IP allowlisting? (Prevent spoofing)
- **Data sync:** One-way or bidirectional? Real-time or periodic? (Architecture decision)
- **Rate limits:** What are the external API's limits? (Need to respect them)

## How to Use This

1. Identify the feature type(s) for each story being planned
2. Pick the 2-3 most relevant questions from the matching categories
3. Ask them during the strategy conversation, one at a time
4. Answers inform task PRDs — they'll be captured when the user runs /draft
5. If the user doesn't have a preference, recommend a sensible default with reasoning
