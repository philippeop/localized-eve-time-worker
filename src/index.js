/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// Robust Discord Verification Handler
// async function verifyDiscordSignature(request, publicKey) {
// 	const signature = request.headers.get('X-Signature-Ed25519');
// 	const timestamp = request.headers.get('X-Signature-Timestamp');

// 	if (!signature || !timestamp || !publicKey) return false;

// 	try {
// 		const body = await request.clone().arrayBuffer();
// 		const messageLog = new Uint8Array([...Buffer.from(timestamp), ...new Uint8Array(body)]);

// 		// Using subtle crypto with ed25519
// 		return await crypto.subtle.verify(
// 			'NODE-ED25519',
// 			await crypto.subtle.importKey('raw', Buffer.from(publicKey, 'hex'), { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' }, false, ['verify']),
// 			Buffer.from(signature, 'hex'),
// 			messageLog
// 		);
// 	} catch (err) {
// 		console.error("Crypto verification crashed:", err);
// 		return false;
// 	}
// }

async function verifyDiscordSignature(request, publicKey) {
	const signature = request.headers.get('X-Signature-Ed25519');
	const timestamp = request.headers.get('X-Signature-Timestamp');

	if (!signature || !timestamp || !publicKey) return false;

	try {
		const body = await request.clone().arrayBuffer();

		// Convert timestamp string to bytes using native TextEncoder
		const encoder = new TextEncoder();
		const timestampBytes = encoder.encode(timestamp);

		// Merge timestamp bytes and body array buffer together
		const messageLog = new Uint8Array(timestampBytes.length + body.byteLength);
		messageLog.set(timestampBytes);
		messageLog.set(new Uint8Array(body), timestampBytes.length);

		// Helper to convert Hex strings to Uint8Array without Buffer
		const hexToBytes = (hex) => {
			const bytes = new Uint8Array(hex.length / 2);
			for (let i = 0; i < hex.length; i += 2) {
				bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
			}
			return bytes;
		};

		return await crypto.subtle.verify(
			'NODE-ED25519',
			await crypto.subtle.importKey(
				'raw',
				hexToBytes(publicKey),
				{ name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' },
				false,
				['verify']
			),
			hexToBytes(signature),
			messageLog
		);
	} catch (err) {
		console.error("Crypto verification crashed:", err);
		return false;
	}
}

export default {
	async fetch(request, env, ctx) {

		const validationResponse = await validate(request, env.DISCORD_PUBLIC_KEY);
		if (validationResponse) return validationResponse;

		const interaction = await request.json();
		if (interaction.type === 1) return new Response(JSON.stringify({ type: 1 }));
		if (interaction.type === 2) {
			const { name, options } = interaction.data;
			if (name === 'evetime') {
				try {
					return eveTime(options);
				}
				catch (err) {
					console.error("Error processing eveTime command:", err);
					return new Response(JSON.stringify({
						type: 4,
						data: { content: "❌ An error occurred while processing your request.", flags: 64 }
					}), { headers: { 'Content-Type': 'application/json' } });
				}
			}
		}

		return new Response(JSON.stringify({ type: 4, data: { content: 'OK' } }));
	}
};

async function validate(request, key) {
	if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

	if (!key) {
		console.log("Public key not set in environment variables");
		return new Response('Invalid configuration', { status: 500 });
	}

	if (!(await verifyDiscordSignature(request, key))) {
		console.log("Discord signature validation failed");
		return new Response('Invalid Signature', { status: 401 });
	}
}

function eveTime(options) {
	const timeOption = options ? options.find(opt => opt.name === 'time') : null;
	const userInput = timeOption ? timeOption.value : '';

	if (!/^\d{4}$/.test(userInput)) {
		return new Response(JSON.stringify({
			type: 4,
			data: { content: "❌ Invalid format. Please use a 4-digit EVE time like `1600`.", flags: 64 } // Hidden message
		}), { headers: { 'Content-Type': 'application/json' } });
	}

	const hours = parseInt(userInput.substring(0, 2), 10);
	const minutes = parseInt(userInput.substring(2, 4), 10);

	if (hours > 23 || minutes > 59) {
		return new Response(JSON.stringify({
			type: 4,
			data: { content: "❌ Invalid time value. Hours must be 00-23 and minutes 00-59.", flags: 64 }
		}), { headers: { 'Content-Type': 'application/json' } });
	}

	const targetDate = new Date();
	targetDate.setUTCHours(hours, minutes, 0, 0);

	// Convert millisecond date string to UNIX seconds
	const unixSeconds = Math.floor(targetDate.getTime() / 1000);

	return new Response(JSON.stringify({
		type: 4,
		data: {
			content: `${hours}:${minutes} = <t:${unixSeconds}:F> (<t:${unixSeconds}:R>)`
		}
	}));
}
