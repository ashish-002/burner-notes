// netlify/functions/storeNote.js
const { nanoid } = require('nanoid');
const NOTES = new Map();

exports.handler = async (event) => {
  try {
    const { data, created, expiry } = JSON.parse(event.body);
    const shortId = nanoid(8);
    NOTES.set(shortId, { data, created, expiry });
    return {
      statusCode: 200,
      body: JSON.stringify({ shortId })
    };
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
  }
};