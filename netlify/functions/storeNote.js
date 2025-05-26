// netlify/functions/storeNote.js

// Use a global map so that getNote and storeNote share the same data in-memory
globalThis.NOTES = globalThis.NOTES || new Map();

exports.handler = async (event) => {
  try {
    // Dynamically import the ESM-only nanoid package
    const { nanoid } = await import('nanoid');

    // Parse the encrypted payload and metadata from the request body
    const { data, created, expiry } = JSON.parse(event.body);
    // Generate an 8-character collision-resistant ID
    const shortId = nanoid(8);

    // Store the encrypted blob and metadata under that ID
    globalThis.NOTES.set(shortId, { data, created, expiry });

    return {
      statusCode: 200,
      body: JSON.stringify({ shortId })
    };
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err.message })
    };
  }
};