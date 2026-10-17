-- Proposal only. Run in a NEW database, not an existing Gallery database.
PRAGMA foreign_keys = ON;
PRAGMA user_version = 1;

CREATE TABLE pack (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, version TEXT NOT NULL,
  source_uri TEXT, checksum TEXT, UNIQUE(name, version)
);
CREATE TABLE provenance (
  id INTEGER PRIMARY KEY, pack_id INTEGER REFERENCES pack(id),
  source_uri TEXT, source_revision TEXT, retrieved_at TEXT, rationale TEXT NOT NULL
);
CREATE TABLE tag (
  id INTEGER PRIMARY KEY, canonical_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  provenance_id INTEGER REFERENCES provenance(id)
);
CREATE TABLE alias (
  name TEXT PRIMARY KEY, tag_id INTEGER NOT NULL REFERENCES tag(id),
  provenance_id INTEGER REFERENCES provenance(id)
);
CREATE INDEX alias_target ON alias(tag_id);
CREATE TABLE facet (
  id TEXT PRIMARY KEY, label TEXT NOT NULL, scope_kind TEXT NOT NULL,
  cardinality TEXT NOT NULL CHECK(cardinality IN ('one','many','contextual')),
  description TEXT NOT NULL
);
CREATE TABLE tag_facet (
  id INTEGER PRIMARY KEY, tag_id INTEGER NOT NULL REFERENCES tag(id),
  facet_id TEXT NOT NULL REFERENCES facet(id), value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK(status IN ('candidate','reviewed','rejected')),
  provenance_id INTEGER NOT NULL REFERENCES provenance(id),
  UNIQUE(tag_id, facet_id, value, provenance_id)
);
CREATE INDEX tag_facet_lookup ON tag_facet(facet_id, value, status);
CREATE TABLE relation (
  id TEXT PRIMARY KEY, subject_tag_id INTEGER NOT NULL REFERENCES tag(id),
  predicate TEXT NOT NULL CHECK(predicate IN ('is_a','implies','compatible','excludes','requires')),
  object_tag_id INTEGER NOT NULL REFERENCES tag(id),
  scope_json TEXT NOT NULL CHECK(json_valid(scope_json)),
  status TEXT NOT NULL DEFAULT 'candidate' CHECK(status IN ('candidate','reviewed','rejected')),
  provenance_id INTEGER NOT NULL REFERENCES provenance(id),
  CHECK(subject_tag_id != object_tag_id)
);
-- Symmetric edges must be canonicalised by the importer; do not double-store them.
CREATE INDEX relation_forward ON relation(subject_tag_id, predicate, status);
CREATE INDEX relation_reverse ON relation(object_tag_id, predicate, status);
CREATE TABLE rule (
  id TEXT PRIMARY KEY, label TEXT NOT NULL,
  condition_json TEXT NOT NULL CHECK(json_valid(condition_json)),
  effect_json TEXT NOT NULL CHECK(json_valid(effect_json)),
  scope_json TEXT NOT NULL CHECK(json_valid(scope_json)),
  exception_json TEXT NOT NULL DEFAULT '{"any":[]}' CHECK(json_valid(exception_json)),
  policy TEXT NOT NULL DEFAULT 'warn' CHECK(policy IN ('inform','warn','enforce')),
  status TEXT NOT NULL DEFAULT 'candidate' CHECK(status IN ('candidate','reviewed','rejected')),
  provenance_id INTEGER NOT NULL REFERENCES provenance(id),
  CHECK(policy != 'enforce' OR status = 'reviewed')
);
CREATE TABLE rule_dependency (
  rule_id TEXT NOT NULL REFERENCES rule(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tag(id), PRIMARY KEY(rule_id, tag_id)
);
CREATE INDEX rule_by_tag ON rule_dependency(tag_id, rule_id);
-- Facet-only rules also need an index; tag dependencies alone are insufficient.
CREATE TABLE rule_facet_dependency (
  rule_id TEXT NOT NULL REFERENCES rule(id) ON DELETE CASCADE,
  facet_id TEXT NOT NULL REFERENCES facet(id), PRIMARY KEY(rule_id, facet_id)
);
CREATE INDEX rule_by_facet ON rule_facet_dependency(facet_id, rule_id);
CREATE TABLE assessment (
  id INTEGER PRIMARY KEY, rule_id TEXT REFERENCES rule(id),
  relation_id TEXT REFERENCES relation(id), reviewer TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('approve','reject','needs_context')),
  reason TEXT NOT NULL, examples_json TEXT NOT NULL CHECK(json_valid(examples_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK((rule_id IS NOT NULL) + (relation_id IS NOT NULL) = 1)
);
CREATE TABLE user_override (
  id INTEGER PRIMARY KEY, user_id TEXT NOT NULL,
  rule_id TEXT REFERENCES rule(id), relation_id TEXT REFERENCES relation(id),
  action TEXT NOT NULL CHECK(action IN ('disable','inform','warn','enforce')),
  context_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(context_json)),
  reason TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
  CHECK((rule_id IS NOT NULL) + (relation_id IS NOT NULL) = 1)
);
CREATE INDEX override_user ON user_override(user_id);
CREATE TABLE corpus (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, revision TEXT NOT NULL,
  sample_count INTEGER NOT NULL CHECK(sample_count >= 0),
  scope_kind TEXT NOT NULL, extraction_version TEXT NOT NULL,
  UNIQUE(name, revision, scope_kind, extraction_version)
);
CREATE TABLE tag_frequency (
  corpus_id INTEGER NOT NULL REFERENCES corpus(id), tag_id INTEGER NOT NULL REFERENCES tag(id),
  occurrence_count INTEGER NOT NULL CHECK(occurrence_count >= 0),
  PRIMARY KEY(corpus_id, tag_id)
);
CREATE TABLE cooccurrence (
  corpus_id INTEGER NOT NULL REFERENCES corpus(id),
  tag_a INTEGER NOT NULL REFERENCES tag(id), tag_b INTEGER NOT NULL REFERENCES tag(id),
  joint_count INTEGER NOT NULL CHECK(joint_count >= 0),
  PRIMARY KEY(corpus_id, tag_a, tag_b), CHECK(tag_a < tag_b)
);
CREATE INDEX cooccurrence_reverse ON cooccurrence(corpus_id, tag_b, tag_a);
CREATE TABLE generation_observation (
  id INTEGER PRIMARY KEY, model_fingerprint TEXT NOT NULL,
  workflow_fingerprint TEXT NOT NULL, resolved_prompt TEXT NOT NULL,
  requested_json TEXT NOT NULL CHECK(json_valid(requested_json)),
  observed_json TEXT NOT NULL CHECK(json_valid(observed_json)),
  assessor TEXT NOT NULL, seed TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE VIRTUAL TABLE tag_search USING fts5(canonical_name, description, aliases, tokenize='unicode61');
-- Importer maintains tag_search.rowid = tag.id in the same transaction as tag/alias changes.
-- Runtime enables WAL only on a local disk and uses the SQLite backup API for live backups.
-- Corpus count consistency, AST validation, override policy and review authorisation
-- are enforced by the application/importer; json_valid checks syntax only.
