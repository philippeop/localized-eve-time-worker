// Function to hex-encode byte arrays
function hexToBytes(hex) {
  let bytes = [];
  for (let c = 0; c < hex.length; c += 2) {
    bytes.push(parseInt(hex.substr(c, 2), 16));
  }
  return new Uint8Array(bytes);
}

// Security verification for Discord interactions
async function verifyDiscordSignature(request, publicKey) {
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');
  
  if (!signature || !timestamp) return false;

  try {
    const body = await request.clone().text();
    const encoder = new TextEncoder();
    const messageLog = encoder.encode(timestamp + body);
    
    const key = await crypto.subtle.importKey(
      'raw',
      hexToBytes(publicKey),
      { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' },
      false,
      ['verify']
    );

    return await crypto.subtle.verify(
      'NODE-ED25519',
      key,
      hexToBytes(signature),
      messageLog
    );
  } catch (err) {
    return false;
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Verify incoming headers using your saved environment variable
    const isValid = await verifyDiscordSignature(request, env.DISCORD_PUBLIC_KEY);
    if (!isValid) {
      return new Response('Invalid Request Signature', { status: 401 });
    }

    const interaction = await request.json();

    // 1. Handle Discord Ping (Required for endpoint verification)
    if (interaction.type === 1) {
      return new Response(JSON.stringify({ type: 1 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Handle Slash Commands (Interaction Type 2)
    if (interaction.type === 2) {
      const { name } = interaction.data;

      if (name === 'hello') {
        return new Response(JSON.stringify({
          type: 4, // Respond immediately with a message
          data: {
            content: `👋 Hello! You ran this as a user-installed app. Context: ${interaction.context === 1 ? 'Direct Message' : 'Server/Group Chat'}`
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ type: 4, data: { content: 'Unknown command' } }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
