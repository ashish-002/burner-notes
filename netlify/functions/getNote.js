// netlify/functions/getNote.js

exports.handler = async (event) => {
  // Access the same global NOTES map
  const NOTES = globalThis.NOTES || new Map();

  // Read the shortId from the query string
  const shortId = event.queryStringParameters.shortId;
  const record  = NOTES.get(shortId);

  // If not found, return 404
  if (!record) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not found' })
    };
  }

  // Enforce TTL: delete and return 410 if expired
  if (Date.now() - record.created > record.expiry) {
    NOTES.delete(shortId);
    return {
      statusCode: 410,
      body: JSON.stringify({ error: 'Expired' })
    };
  }

  // Return the encrypted data and metadata
  return {
    statusCode: 200,
    body: JSON.stringify({
      data:    record.data,
      created: record.created,
      expiry:  record.expiry
    })
  };
};