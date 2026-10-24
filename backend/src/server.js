import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import neo4j from 'neo4j-driver';

const app = express();
const port = Number(process.env.PORT || 4000);
const driver = process.env.NEO4J_URI && process.env.NEO4J_USERNAME && process.env.NEO4J_PASSWORD
  ? neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD))
  : null;

const resources = {
  members: { label: 'Member', fields: ['name', 'fullName', 'firstName', 'lastName', 'email', 'phone', 'gender', 'dateOfBirth', 'joinDate', 'status'] },
  plans: { label: 'MembershipPlan', fields: ['name', 'title', 'price', 'duration', 'description', 'status'] },
  trainers: { label: 'Trainer', fields: ['name', 'fullName', 'email', 'phone', 'specialization', 'status'] },
  sessions: { label: 'WorkoutSession', fields: ['name', 'title', 'date', 'time', 'duration', 'location', 'description', 'status'] },
  payments: { label: 'Payment', fields: ['amount', 'date', 'paymentDate', 'status', 'description', 'method', 'transactionId'] }
};
const relationConfig = {
  HAS_PLAN: ['Member', 'MembershipPlan'],
  CONDUCTS: ['Trainer', 'WorkoutSession'],
  ATTENDS: ['Member', 'WorkoutSession'],
  MADE_PAYMENT: ['Member', 'Payment']
};
const numericFields = new Set(['age', 'price', 'amount', 'duration']);

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));

function requireDriver() {
  if (!driver) {
    throw Object.assign(new Error('Neo4j is not configured. Copy backend/.env.example to backend/.env and add your Aura credentials.'), { status: 503 });
  }
  return driver;
}

function getResource(name) {
  const resource = resources[name];
  if (!resource) throw Object.assign(new Error('Resource not found.'), { status: 404 });
  return resource;
}

function validateProperties(resource, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw Object.assign(new Error('Request body must be an object.'), { status: 400 });
  }
  const properties = {};
  for (const field of resource.fields) {
    if (body[field] === undefined || body[field] === null || String(body[field]).trim() === '') continue;
    if (numericFields.has(field)) {
      const value = Number(body[field]);
      if (!Number.isFinite(value) || value < 0) throw Object.assign(new Error(`${field} must be a non-negative number.`), { status: 400 });
      properties[field] = value;
    } else {
      properties[field] = String(body[field]).trim();
    }
  }
  if (!Object.keys(properties).length) throw Object.assign(new Error('Provide at least one valid property.'), { status: 400 });
  return properties;
}

function serializeNode(node) {
  const properties = normalizeValue(node.properties || {});
  const id = properties.id || properties.memberId || properties.planId || properties.trainerId
    || properties.sessionId || properties.paymentId || node.elementId;
  return { id: String(id), elementId: node.elementId, label: node.labels?.[0], ...properties };
}

function normalizeValue(value) {
  if (neo4j.isInt(value)) return value.toNumber();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value.toString === 'function' && value.constructor?.name !== 'Object') return value.toString();
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizeValue(child)]));
  }
  return value;
}

async function query(cypher, params = {}) {
  const session = requireDriver().session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

function sendError(error, res) {
  const status = error.status || 500;
  console.error(`${status}: ${error.message}`);
  res.status(status).json({ error: error.message });
}

function nodeMatch(alias = 'n') {
  return `(toString(${alias}.id) = $id OR elementId(${alias}) = $id OR toString(${alias}.memberId) = $id OR toString(${alias}.planId) = $id OR toString(${alias}.trainerId) = $id OR toString(${alias}.sessionId) = $id OR toString(${alias}.paymentId) = $id)`;
}

app.get('/api/health', async (_req, res) => {
  try {
    await query('RETURN 1 AS ok');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(error.status || 503).json({ status: 'error', database: 'disconnected', error: error.message });
  }
});

app.get('/api/dashboard', async (_req, res) => {
  try {
    const records = await query(`
      CALL {
        MATCH (n:Member) RETURN count(n) AS members
      }
      CALL {
        MATCH (n:MembershipPlan) RETURN count(n) AS plans
      }
      CALL {
        MATCH (n:Trainer) RETURN count(n) AS trainers
      }
      CALL {
        MATCH (n:WorkoutSession) RETURN count(n) AS sessions
      }
      CALL {
        MATCH (n:Payment) RETURN count(n) AS payments
      }
      CALL {
        MATCH ()-[r]->() RETURN count(r) AS relationships
      }
      RETURN members, plans, trainers, sessions, payments, relationships
    `);
    res.json(normalizeValue(records[0]?.toObject() || {}));
  } catch (error) { sendError(error, res); }
});

app.get('/api/schema', async (_req, res) => {
  try {
    const records = await query(`
      CALL db.schema.nodeTypeProperties()
      YIELD nodeType, propertyName, propertyTypes
      RETURN nodeType, collect({ name: propertyName, types: propertyTypes }) AS properties
    `);
    res.json(records.map((record) => normalizeValue(record.toObject())));
  } catch (error) { sendError(error, res); }
});

app.get('/api/:resource(members|plans|trainers|sessions|payments)', async (req, res) => {
  try {
    const { label } = getResource(req.params.resource);
    const search = String(req.query.search || '').trim();
    const records = await query(`
      MATCH (n:${label})
      WHERE $search = '' OR any(key IN keys(n) WHERE toLower(toString(n[key])) CONTAINS toLower($search))
      RETURN n
      ORDER BY coalesce(n.name, n.fullName, n.title, n.date, n.paymentDate, elementId(n))
    `, { search });
    res.json(records.map((record) => serializeNode(record.get('n'))));
  } catch (error) { sendError(error, res); }
});

app.post('/api/:resource(members|plans|trainers|sessions|payments)', async (req, res) => {
  try {
    const resource = getResource(req.params.resource);
    const properties = validateProperties(resource, req.body);
    const records = await query(`CREATE (n:${resource.label} $properties) RETURN n`, { properties });
    res.status(201).json(serializeNode(records[0].get('n')));
  } catch (error) { sendError(error, res); }
});

app.patch('/api/:resource(members|plans|trainers|sessions|payments)/:id', async (req, res) => {
  try {
    const resource = getResource(req.params.resource);
    const properties = validateProperties(resource, req.body);
    const records = await query(`MATCH (n:${resource.label}) WHERE ${nodeMatch()} SET n += $properties RETURN n`, {
      id: String(req.params.id), properties
    });
    if (!records.length) return res.status(404).json({ error: 'Record not found.' });
    res.json(serializeNode(records[0].get('n')));
  } catch (error) { sendError(error, res); }
});

app.delete('/api/:resource(members|plans|trainers|sessions|payments)/:id', async (req, res) => {
  try {
    const resource = getResource(req.params.resource);
    const records = await query(`
      MATCH (n:${resource.label}) WHERE ${nodeMatch()}
      OPTIONAL MATCH (n)-[r]-()
      WITH n, count(r) AS links
      WHERE links = 0
      DELETE n
      RETURN n
    `, { id: String(req.params.id) });
    if (!records.length) return res.status(409).json({ error: 'Record was not found or still has relationships. Remove connected relationships first.' });
    res.status(204).end();
  } catch (error) { sendError(error, res); }
});

app.get('/api/relationships', async (_req, res) => {
  try {
    const records = await query(`
      MATCH (a)-[r]->(b)
      WHERE type(r) IN $types
      RETURN elementId(a) AS fromId, labels(a)[0] AS fromLabel, properties(a) AS from,
        type(r) AS relationship, elementId(b) AS toId, labels(b)[0] AS toLabel, properties(b) AS to
      ORDER BY relationship, fromId
    `, { types: Object.keys(relationConfig) });
    res.json(records.map((record) => normalizeValue(record.toObject())));
  } catch (error) { sendError(error, res); }
});

app.post('/api/relationships', async (req, res) => {
  const { type, fromId, toId } = req.body || {};
  if (!relationConfig[type] || !String(fromId || '').trim() || !String(toId || '').trim()) {
    return res.status(400).json({ error: 'A valid relationship type, fromId, and toId are required.' });
  }
  const [fromLabel, toLabel] = relationConfig[type];
  try {
    const records = await query(`
      MATCH (a:${fromLabel}), (b:${toLabel})
      WHERE elementId(a) = $fromId AND elementId(b) = $toId
        AND NOT (a)-[:${type}]->(b)
      CREATE (a)-[r:${type}]->(b)
      RETURN type(r) AS relationship, elementId(a) AS fromId, elementId(b) AS toId
    `, { fromId: String(fromId), toId: String(toId) });
    if (!records.length) return res.status(409).json({ error: 'The records do not exist or this relationship already exists.' });
    res.status(201).json(normalizeValue(records[0].toObject()));
  } catch (error) { sendError(error, res); }
});

app.delete('/api/relationships', async (req, res) => {
  const { type, fromId, toId } = req.body || {};
  if (!relationConfig[type] || !fromId || !toId) return res.status(400).json({ error: 'A valid relationship type, fromId, and toId are required.' });
  const [fromLabel, toLabel] = relationConfig[type];
  try {
    const records = await query(`
      MATCH (a:${fromLabel})-[r:${type}]->(b:${toLabel})
      WHERE elementId(a) = $fromId AND elementId(b) = $toId
      DELETE r
      RETURN count(r) AS deleted
    `, { fromId: String(fromId), toId: String(toId) });
    if (!records[0] || records[0].get('deleted').toNumber() === 0) return res.status(404).json({ error: 'Relationship not found.' });
    res.status(204).end();
  } catch (error) { sendError(error, res); }
});

app.listen(port, () => console.log(`Fitness Club API listening on http://localhost:${port}`));
process.on('SIGTERM', async () => { if (driver) await driver.close(); process.exit(0); });
