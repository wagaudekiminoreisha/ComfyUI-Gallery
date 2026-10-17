PRAGMA foreign_keys = ON;
PRAGMA user_version = 1;
CREATE TABLE pack (id TEXT PRIMARY KEY, revision TEXT NOT NULL, metadata_json TEXT NOT NULL CHECK(json_valid(metadata_json)));
CREATE TABLE tag (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, category INTEGER NOT NULL);
CREATE TABLE alias (name TEXT NOT NULL, tag_id INTEGER NOT NULL REFERENCES tag(id), PRIMARY KEY(name,tag_id));
CREATE INDEX alias_name ON alias(name);
CREATE TABLE facet (id TEXT PRIMARY KEY, label TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('one','many','mix','layer')), scope_json TEXT NOT NULL CHECK(json_valid(scope_json)), rationale TEXT NOT NULL);
CREATE TABLE facet_member (facet_id TEXT NOT NULL REFERENCES facet(id), tag_id INTEGER NOT NULL REFERENCES tag(id), value TEXT NOT NULL, PRIMARY KEY(facet_id,tag_id));
CREATE INDEX facet_member_tag ON facet_member(tag_id,facet_id);
CREATE TABLE rule (id TEXT PRIMARY KEY, label TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('distinct_values','compatible_values','cross_values','compatible_facets','solo_total')), policy TEXT NOT NULL CHECK(policy IN ('inform','warn')), status TEXT NOT NULL CHECK(status = 'candidate'), scope_json TEXT NOT NULL CHECK(json_valid(scope_json)), selector_json TEXT NOT NULL CHECK(json_valid(selector_json)), rationale TEXT NOT NULL);
CREATE TABLE rule_facet (rule_id TEXT NOT NULL REFERENCES rule(id), facet_id TEXT NOT NULL REFERENCES facet(id), PRIMARY KEY(rule_id,facet_id));
CREATE INDEX rule_facet_reverse ON rule_facet(facet_id,rule_id);
CREATE TABLE rule_exception (rule_id TEXT NOT NULL REFERENCES rule(id), tag_id INTEGER NOT NULL REFERENCES tag(id), guard_json TEXT NOT NULL CHECK(json_valid(guard_json)), PRIMARY KEY(rule_id,tag_id));
CREATE TABLE topic (id TEXT PRIMARY KEY, label TEXT NOT NULL, provenance_json TEXT NOT NULL CHECK(json_valid(provenance_json)));
CREATE TABLE topic_member (topic_id TEXT NOT NULL REFERENCES topic(id), tag_id INTEGER NOT NULL REFERENCES tag(id), PRIMARY KEY(topic_id,tag_id));
CREATE INDEX topic_member_tag ON topic_member(tag_id,topic_id);
CREATE VIRTUAL TABLE tag_search USING fts5(name,aliases, tokenize='unicode61');
-- Topic memberships support discovery only. They never generate exclusion edges.
-- Local prefix policies/overrides will be separate from this reproducible candidate catalog.
