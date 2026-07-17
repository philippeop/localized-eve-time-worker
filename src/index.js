/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { 
	InteractionResponseType,
	verifyKey } from 'discord-interactions';

async function verifyDiscordSignature(request, publicKey) {
	if (request.method !== 'POST') {
		console.error("Method not allowed");
		return false;
	}
	if (!publicKey) {
		console.error("Public key not set in environment variables");
		return false;
	}
	try {
		console.debug("Validation start");
		console.debug("Validation publicKey", publicKey.length);
		const signature = request.headers.get('X-Signature-Ed25519');
		console.debug("Validation signature", signature.length);
		const timestamp = request.headers.get('X-Signature-Timestamp');
		console.debug("Validation timestap", timestamp.length	);
		const body = await request.text();
		console.debug("Validation body", body.length);
		const verified = await verifyKey(body, signature, timestamp, publicKey);
		console.debug("Validation verified", verified);

		const isValidRequest = signature && timestamp && verified;
		if (!isValidRequest) {
			console.debug("Validation failed");
			return false;
		}
		return JSON.parse(body);
	}
	catch (err) {
		console.error("Validation crashed:", err);
		return false;
	}
}

export default {
	async fetch(request, env, ctx) {

		const json = await verifyDiscordSignature(request, env.DISCORD_PUBLIC_KEY);
		if (!json) return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: 'Validation failed', flags: 64 } });

		console.debug("Received request type", json.type);

		if (json.type === 2) {
			const { name, options } = json.data;
			if (name === 'evetime') {
				try {
					return eveTime(options);
				}
				catch (err) {
					console.error("Error processing eveTime command:", err);
					return new JsonResponse({
						type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
						data: { content: "❌ An error occurred while processing your request.", flags: 64 }
					});
				}
			}
			console.debug("Unknown command:", name);
		}
		else return new JsonResponse({ type: InteractionResponseType.PONG });

		return new JsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: { content: 'OK' }
		});
	}
};

function eveTime(options) {
	console.debug("Processing eveTime command with options:", JSON.stringify(options));
	const timeOption = options ? options.find(opt => opt.name === 'time') : null;
	const userInput = timeOption ? timeOption.value : '';

	console.debug("User input for time:", userInput);

	if (!/^\d{4}$/.test(userInput)) {
		return new JsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: { content: "❌ Invalid format. Please use a 4-digit EVE time like `1600`.", flags: 64 } // Hidden message
		});
	}

	const hours = parseInt(userInput.substring(0, 2), 10);
	const minutes = parseInt(userInput.substring(2, 4), 10);

	console.debug("Parsed hours:", hours, "Parsed minutes:", minutes);

	if (hours > 23 || minutes > 59) {
		return new JsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: { content: "❌ Invalid time value. Hours must be 00-23 and minutes 00-59.", flags: 64 }
		});
	}

	const targetDate = new Date();
	targetDate.setUTCHours(hours, minutes, 0, 0);

	// Convert millisecond date string to UNIX seconds
	const unixSeconds = Math.floor(targetDate.getTime() / 1000);

	console.debug("Calculated UNIX seconds:", unixSeconds);

	return new JsonResponse({
		type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		data: {
			content: `${hours}:${minutes} = <t:${unixSeconds}:F> (<t:${unixSeconds}:R>)`
		}
	});
}
