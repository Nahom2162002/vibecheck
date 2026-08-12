// Intentionally vulnerable fixture: string-built SQL for vibecheck's sql-injection rule to catch.
const { Pool } = require('pg');
const pool = new Pool();

async function getUserByName(username) {
  // VULNERABLE: template-literal interpolation straight into the query.
  const result = await pool.query(`SELECT * FROM users WHERE username = '${username}'`);
  return result.rows[0];
}

async function deletePost(postId) {
  // VULNERABLE: string concatenation.
  const result = await pool.query('DELETE FROM posts WHERE id = ' + postId);
  return result.rowCount > 0;
}

async function getPostsByUserSafe(userId) {
  // SAFE: parameterized query, should NOT be flagged.
  const result = await pool.query('SELECT * FROM posts WHERE user_id = $1', [userId]);
  return result.rows;
}

module.exports = { getUserByName, deletePost, getPostsByUserSafe };
