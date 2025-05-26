// netlify/functions/getNote.js
const { nanoid } = require('nanoid'); // make sure nanoid is in your package.json
const NOTES = require('./storeNote').NOTES;

exports.handler = async (event) => {
  const shortId = event.queryStringParameters.shortId;
  const record = NOTES.get(shortId);
  if (!record) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
  }
  if (Date.now() - record.created > record.expiry) {
    NOTES.delete(shortId);
    return { statusCode: 410, body: JSON.stringify({ error: 'Expired' }) };
  }
  return {
    statusCode: 200,
    body: JSON.stringify({
      data: record.data,
      created: record.created,
      expiry: record.expiry
    })
  };
};