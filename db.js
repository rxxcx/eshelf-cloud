const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Put it in .env (locally) or in Render > Environment.');
  process.exit(1);
}

// Aiven's URI ends with ?sslmode=require. If it stays on, the pg driver ignores
// the CA below and rejects Aiven's certificate, so strip it here.
const url = new URL(process.env.DATABASE_URL);
url.searchParams.delete('sslmode');

// Aiven requires SSL. ca.pem is the CA certificate downloaded from the Aiven console.
// Without it (e.g. a local PostgreSQL for testing) the app connects without SSL.
const caPath = path.join(__dirname, 'ca.pem');
let ssl;
if (fs.existsSync(caPath)) {
  ssl = { ca: fs.readFileSync(caPath, 'utf8') };
} else {
  console.warn('ca.pem not found: connecting without SSL. Aiven needs ca.pem in the project root.');
}

const pool = new Pool({ connectionString: url.toString(), ssl });

module.exports = pool;
