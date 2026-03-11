/**
 * Property API endpoints.
 *
 * POST /api/property/generate-json-schema
 *   Body: { concept: "<name>" }
 *   Reads the concept's property tree and generates a JSON Schema from it.
 *   Saves the schema to the concept's JSONSchema node.
 */

const { runCypher } = require('../../lib/neo4j-driver');
const { regenerateJson } = require('../normalize/helpers');

async function handleGenerateJsonSchema(req, res) {
  try {
    const { concept } = req.body;
    if (!concept) return res.status(400).json({ success: false, error: 'Missing concept name' });

    // Find the concept header, JSON Schema, and Primary Property
    const rows = await runCypher(`
      MATCH (h:NostrEvent)
      WHERE (h:ListHeader OR h:ClassThreadHeader) AND h.kind IN [9998, 39998]
        AND h.name = $concept
      OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
      OPTIONAL MATCH (pp)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h)
      OPTIONAL MATCH (h)-[:HAS_TAG]->(st:NostrEventTag {type: 'slug'})
      RETURN h.uuid AS headerUuid, js.uuid AS schemaUuid, js.name AS schemaName,
             pp.uuid AS primaryUuid, pp.name AS primaryName, st.value AS conceptSlug
      LIMIT 1
    `, { concept });

    if (rows.length === 0) return res.json({ success: false, error: `Concept "${concept}" not found` });
    const { schemaUuid, schemaName, primaryUuid, primaryName, conceptSlug } = rows[0];
    if (!schemaUuid) return res.json({ success: false, error: `Concept "${concept}" has no JSON Schema node. Run 'tapestry normalize skeleton "${concept}"' first.` });

    // Fetch all properties in the tree (at all depths) with their direct parent
    const allProps = await runCypher(`
      MATCH (js:JSONSchema {uuid: $schemaUuid})
      MATCH (p:Property)-[:IS_A_PROPERTY_OF *1..]->(js)
      MATCH (p)-[:IS_A_PROPERTY_OF]->(directParent)
      OPTIONAL MATCH (p)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
      RETURN p.uuid AS uuid, p.name AS name, directParent.uuid AS parentUuid,
             head(collect(jt.value)) AS json
    `, { schemaUuid });

    if (allProps.length === 0) {
      return res.json({ success: false, error: `Concept "${concept}" has no properties in its property tree.` });
    }

    // Check for children of each property (to detect missing json on object types)
    const childMap = {};
    for (const p of allProps) {
      if (!childMap[p.parentUuid]) childMap[p.parentUuid] = [];
      childMap[p.parentUuid].push(p);
    }

    const warnings = [];

    // Build schema recursively
    function buildSchemaForChildren(parentUuid) {
      const children = childMap[parentUuid] || [];
      if (children.length === 0) return null;

      const properties = {};
      const required = [];

      for (const child of children) {
        const hasChildren = !!(childMap[child.uuid] && childMap[child.uuid].length > 0);
        let propDef;

        if (child.json) {
          try {
            const parsed = typeof child.json === 'string' ? JSON.parse(child.json) : child.json;
            const pd = parsed?.property || {};
            propDef = { type: pd.type || (hasChildren ? 'object' : 'string') };
            if (pd.description) propDef.description = pd.description;
            if (pd.enum && Array.isArray(pd.enum) && pd.enum.length > 0) propDef.enum = pd.enum;
            if (pd.format) propDef.format = pd.format;
            if (pd.pattern) propDef.pattern = pd.pattern;
            if (pd.default !== undefined) propDef.default = pd.default;
            if (pd.required) required.push(child.name);
          } catch {
            warnings.push(`Could not parse JSON for property "${child.name}" — defaulting to ${hasChildren ? 'object' : 'string'}`);
            propDef = { type: hasChildren ? 'object' : 'string' };
          }
        } else {
          // No json tag
          const inferredType = hasChildren ? 'object' : 'string';
          warnings.push(`Property "${child.name}" has no JSON tag — defaulting to type: ${inferredType}`);
          propDef = { type: inferredType };
        }

        // If this property has children, recurse
        if (hasChildren) {
          // Ensure type is object
          if (propDef.type !== 'object') {
            warnings.push(`Property "${child.name}" has children but type is "${propDef.type}" — overriding to "object"`);
            propDef.type = 'object';
          }
          const nested = buildSchemaForChildren(child.uuid);
          if (nested) {
            propDef.properties = nested.properties;
            if (nested.required && nested.required.length > 0) {
              propDef.required = nested.required;
            }
          }
        }

        properties[child.name] = propDef;
      }

      return { properties, required };
    }

    // If there's a primary property, its children are the inner properties of the wrapper object.
    // The schema should have one top-level property (the wrapper key) containing those children.
    let topLevel;
    if (primaryUuid && childMap[primaryUuid]?.length > 0) {
      // Build inner properties from primary property's children
      const innerProps = buildSchemaForChildren(primaryUuid);
      // Derive the wrapper key from the concept slug (camelCase)
      const wrapperKey = conceptSlug
        ? conceptSlug.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
        : concept.toLowerCase().replace(/\s+([a-z])/g, (_, c) => c.toUpperCase());
      topLevel = {
        properties: {
          [wrapperKey]: {
            type: 'object',
            name: concept,
            title: concept.replace(/\b\w/g, c => c.toUpperCase()),
            slug: conceptSlug || concept.toLowerCase().replace(/\s+/g, '-'),
            description: `data about this ${concept}`,
            ...(innerProps || {}),
          },
        },
        required: [wrapperKey],
      };
    } else {
      // No primary property or no children — build directly from schema children
      topLevel = buildSchemaForChildren(schemaUuid);
    }

    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      definitions: {},
      ...topLevel,
    };

    // Remove empty required arrays
    if (schema.required && schema.required.length === 0) delete schema.required;

    // Read existing word wrapper or build one
    const existingJsonRows = await runCypher(`
      MATCH (e:NostrEvent {uuid: $uuid})-[:HAS_TAG]->(t:NostrEventTag {type: 'json'})
      RETURN t.value AS json
    `, { uuid: schemaUuid });

    let wordWrapper;
    if (existingJsonRows.length > 0 && existingJsonRows[0].json) {
      try {
        const parsed = typeof existingJsonRows[0].json === 'string'
          ? JSON.parse(existingJsonRows[0].json) : existingJsonRows[0].json;
        if (parsed.word && parsed.jsonSchema !== undefined) {
          wordWrapper = parsed;
        }
      } catch {}
    }
    if (!wordWrapper) {
      wordWrapper = {
        word: {
          slug: schemaName ? schemaName.toLowerCase().replace(/\s+/g, '-') : 'json-schema',
          name: schemaName || `JSON schema for ${concept}`,
          title: schemaName ? schemaName.replace(/^json /i, 'JSON ') : `JSON Schema for ${concept}`,
          description: `the json schema for the concept of ${concept}`,
          wordTypes: ['word', 'jsonSchema'],
        },
        jsonSchema: {},
      };
    }
    wordWrapper.jsonSchema = schema;

    // Save to the JSON Schema node
    await regenerateJson(schemaUuid, wordWrapper);

    return res.json({
      success: true,
      message: `Generated and saved JSON Schema for "${concept}" from ${allProps.length} properties.`,
      schema,
      warnings,
      saved: true,
    });

  } catch (error) {
    console.error('property/generate-json-schema error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

function registerPropertyRoutes(app) {
  app.post('/api/property/generate-json-schema', handleGenerateJsonSchema);
}

module.exports = { registerPropertyRoutes };
