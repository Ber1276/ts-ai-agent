import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://postgres:ber1276@localhost:5432/postgres?schema=public'
});
pool.query('SELECT "id", "knowledgeBaseId", "retrieverMode", "vectorStore", "topK", "embeddingApiKey" FROM "RagConfig"', (err, res) => {
  if (err) {
      console.error(err);
  } else {
      console.log("=== RagConfig DB Raw Rows ===");
      console.dir(res.rows, { depth: null });
  }
  pool.end();
});
