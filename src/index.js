/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// export default {
// 	async fetch(request, env, ctx) {
// 		return new Response("Hello World!");
// 	},
// };

// Robust Discord Verification Handler
async function verifyDiscordSignature(request, publicKey) {
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');
  
  if (!signature || !timestamp || !publicKey) return false;

  try {
    const body = await request.clone().arrayBuffer();
    const messageLog = new Uint8Array([...Buffer.from(timestamp), ...new Uint8Array(body)]);
    
    // Using subtle crypto with ed25519
    return await crypto.subtle.verify(
      'NODE-ED25519',
      await crypto.subtle.importKey('raw', Buffer.from(publicKey, 'hex'), { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' }, false, ['verify']),
      Buffer.from(signature, 'hex'),
      messageLog
    );
  } catch (err) {
    console.error("Crypto verification crashed:", err);
    return false;
  }
}

export default {
  async fetch(request, env, ctx) {
	const key = env.DISCORD_PUBLIC_KEY || ''
    if (request.method !== 'POST') return new Response('Method Not Allowed ' + key.length, { status: 405 });

    if (!(await verifyDiscordSignature(request, key))) {
      console.log("Validation failed");
      return new Response('Invalid Signature', { status: 401 });
    }

    const interaction = await request.json();
    if (interaction.type === 1) return new Response(JSON.stringify({ type: 1 }));

    return new Response(JSON.stringify({ type: 4, data: { content: 'OK' } }));
  }
};
