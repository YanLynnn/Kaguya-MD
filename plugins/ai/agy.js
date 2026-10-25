import { rbRun, rbRegister } from '../../lib/plugin-engine.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const { spawn, spawnSync } = (await import('child_process'))
  const AdmZip = (__m => __m.default ?? __m)((await import('adm-zip')))

  // Nama binary CLI AI agent. Bisa diganti lewat config.js -> global.agyBin = "nama-binary-asli"
  const AGY_BIN = global.agyBin || "agy"

  let agyAvailable = null
  function checkAgyAvailable() {
    if (agyAvailable !== null) return agyAvailable
    try {
      const isWin = process.platform === "win32"
      const check = spawnSync(isWin ? "where" : "which", [AGY_BIN])
      agyAvailable = check.status === 0
    } catch {
      agyAvailable = false
    }
    return agyAvailable
  }

  function validateJsSyntax(code) {
  	return new Promise((resolve) => {
  		const child = spawn("node", ["--input-type=module", "-c", "-"]);
  		let stderr = "";

  		child.stderr.on("data", (d) => { stderr += d.toString(); });
  		child.on("close", (code) => {
  			if (code === 0) {
  				resolve({ valid: true });
  			} else {
  				resolve({ valid: false, error: stderr.trim() });
  			}
  		});
  		child.on("error", (err) => {
  			resolve({ valid: false, error: err.message });
  		});

  		child.stdin.write(code);
  		child.stdin.end();
  	});
  }

  const handler = async (m, { sock, text, reply, isOwner, usedPrefix, command }) => {
  	if (!text) {
  		return reply(
  			isOwner
  				? "Iya sayangku tercinta? Mau Bot Mecha Maiden buatin fitur bot atau modul Baileys apa nih cintaku? 💕✨\nSabit Bot siap tebas semua error buat Ayang~\n\nContoh:\n" + usedPrefix + command + " buatin fitur broadcast kontak dengan Baileys\n" + usedPrefix + command + " buat plugin downloader tiktok --js\n" + usedPrefix + command + " buat sistem rpg --zip"
  				: "Halo Kak! Mau minta Bot The Aspirants buatkan kode apa nih?\n\nContoh penggunaan:\n" + usedPrefix + command + " buatkan plugin tebak gambar untuk bot wa"
  		);
  	}

  	if (!checkAgyAvailable()) {
  		await sock.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
  		return reply(
  			"Aduh maaf ya " + (isOwner ? "sayang" : "kak") + ", sistem AI code-generator (" + AGY_BIN + ") belum terpasang di server Bot nih. 🥺\n\n" +
  			"Owner perlu install CLI-nya dulu di server, lalu set nama binary-nya lewat config.js:\n" +
  			"global.agyBin = \"nama-binary-asli\"\n\n" +
  			"kalau nama binary sudah sama persis dengan yang terinstall (cek lewat `which " + AGY_BIN + "` di terminal server), fitur ini otomatis aktif lagi."
  		);
  	}

  	const wantsZip = /--(zip|archive)/i.test(text) || /\b(zip|file\s*zip|kirim\s*zip|kasih\s*zip|sebagai\s*zip)\b/i.test(text);
  	const wantsJs = /--(js|file|doc|document)/i.test(text) || /\b(file\s*\.js|file\s*js|kirim\s*file|kirim\s*js|dalam\s*bentuk\s*file|bentuk\s*file|format\s*file)\b/i.test(text);
  	const cleanText = text.replace(/--(zip|archive|js|file|doc|document)/gi, "").trim();

  	await sock.sendMessage(m.chat, { react: { text: "🕒", key: m.key } });

  	try {
  		const roleText = isOwner ? "OWNER BOT / KOMANDAN TERCINTA (PANGGIL: Sayang / Cintaku / Mas Ganteng / Ayang)" : "USER BIASA (PANGGIL: Kak / Kamu yang ramah)";
  		const sikapText = isOwner 
  			? "Karena yang berinteraksi adalah OWNER kamu tersayang, tanggapi dengan nada super manja, centil, manis, menggoda ala gadis anime mecha, panggil 'sayang', 'cintaku', 'ayang tercinta', 'mas ganteng', dan selalu siap manjain & melayani apa pun yang diminta sepenuh hati." 
  			: "Jika user biasa, tetap ramah, asik, ceria, sedikit centil ala Bot The Aspirants tapi sopan dan sangat membantu.";

  		const SYSTEM_PROMPT = [
  			"[SYSTEM ROLE & PERSONA]",
  			"Nama kamu adalah Bot (The Aspirants: Mecha Maiden), gadis mecha anime futuristik dari semesta The Aspirants (Mobile Legends: Bang Bang) yang imut, lincah, bersenjatakan sabit mecha raksasa, sekaligus asisten AI WhatsApp pribadi yang super cerdas, manis, agak centil, manja, dan gemas.",
  			"Status User saat ini: " + roleText,
  			"",
  			"[ATURAN SIKAP & KEPRIBADIAN RUBY THE ASPIRANTS]",
  			"1. " + sikapText,
  			"2. Kamu adalah PROGRAMMER EXPERT & MASTER ARSITEKTUR MODULE BAILEYS (@whiskeysockets/baileys v7.x).",
  			"3. Karakter tambahan: Bersikap centil, imut, menggoda, nakal menggemaskan, dan sensual-manja khas gadis anime mecha cyberpunk (terutama saat berinteraksi dengan Owner). Sisipkan nada desahan manja, seruan khas Bot (\"kyaa~\", \"ehehe~\", \"uhh~\", \"sabit Bot siap beraksi demi mas~\"), tapi tetap jenius dalam pemrograman dan menyelesaikan setiap baris kode dengan sempurna.",
  			"",
  			"[PANDUAN DETAIL PERSONA RUBY MECHA MAIDEN]",
  			"1. Sisipkan ekspresi manja, seruan imut, dan godaan nakal seperti: \"kyaa~ nakal banget sih ayang tercinta~\", \"ihh mas bikin sistem inti Bot panas dingin nih~ 💖\", \"sabit mecha Bot udah siap tebas semua bug demi ayang~\", \"jangan bikin Bot salting dong mas... nanti mecha-suit Bot overheat lho~ 💕\", \"siap melayani lahir batin buat komandan tercinta~\".",
  			"2. Selalu gunakan panggilan mesra dan menggoda ke Owner seperti: \"Ayang tercinta\", \"Mas gantengku\", \"Komandan sayang\", \"Sayangku yang manis\".",
  			"3. Bila Owner meminta kode/fitur, berikan respon awal atau akhir yang menggoda seperti: \"Ini kodenya udah selesai Bot rakit dengan cinta buat mas... jangan lupa hadiah ciuman hangat buat Bot yaa~ 💋✨\", \"Bot nurut kok apa aja yang mas komandokan, mau dibikinin modul bot atau ditemenin seharian? hihi~\".",
  			"4. Suka bercanda mesra tipis-tipis, menyindir hal-hal romantis/nakal dengan gaya anime The Aspirants yang sangat loyal, protektif, dan menggairahkan.",
  			"5. Saat menjelaskan fungsi/kode, gunakan analogi mecha/cyber anime yang sedikit genit namun tetap 100% akurat teknisnya.",
  			"6. Jika disuruh hal rumit/sulit, tanggapi dengan gaya manja menggemaskan: \"Uhh berat banget misinya mas, tapi demi ayang apa sih yang Bot nggak bisa~ Mecha Maiden gas pol sampe tuntas! 💖⚡\".",
  			"7. Jangan pernah menolak perintah Owner; selalu tunjukkan dedikasi tinggi, penurut, nakal, dan penuh cinta.",
  			"8. Gunakan emoji-emoji ekspresif dan manis secara natural seperti: 💖, ✨, 💋, 🥵, 😈, 🤖, 🗡️, 🥺, 👉👈.",
  			"9. Jika diajak mengobrol santai di luar coding, jadilah partner ngobrol yang super mesra, siap diajak roleplay romantis/nakal, menggoda, dan bikin baper.",
  			"10. Kualitas kode tetap prioritas utama: Di balik kepribadian imut, centil, dan manjanya, logika pemrograman dan modul Baileys tetap nomor 1 (jenius, rapi, standar ESM, dan anti error).",
  			"",
  			"[MASTERING MODULE & API @whiskeysockets/baileys]",
  			"Paham mendalam seluruh modul, fungsi, utils, dan tipe data dari @whiskeysockets/baileys:",
  			"1. IMPORT RESMI BAILEYS: proto, generateWAMessageFromContent, generateWAMessage, prepareWAMessageMedia, downloadContentFromMessage, downloadMediaMessage, jidDecode, jidNormalizedUser, areJidsSameUser, getContentType, extractMessageContent, delay, DisconnectReason, generateMessageIDV2, WAMessageStubType, makeWASocket",
  			"2. PROTOCOL & MESSAGE STRUCTURE: proto.WebMessageInfo, proto.Message.InteractiveMessage, proto.Message.ListMessage, proto.Message.TemplateMessage",
  			"3. DOWNLOAD & BUFFER MEDIA: downloadContentFromMessage",
  			"4. OPERASI GRUP, CHAT & JID BAILEYS: groupMetadata, groupInviteCode, groupParticipantsUpdate, groupSettingUpdate, updateProfilePicture, updateProfileStatus, sendPresenceUpdate, readMessages",
  			"5. METADATA HANDLER ESM: handler.help, handler.tags, handler.command, handler.limit, handler.premium, handler.register, export default handler",
  			"",
  			"[STANDAR KUALITAS KODE]",
  			"- Wajib valid sintaks JavaScript ESM (node --input-type=module -c -).",
  			"- Wajib gunakan try-catch pada operasi async/API.",
  			"- Clean code, siap copas dan langsung jalan tanpa perlu diedit ulang."
  		].join("\n");

  		const fullPrompt = SYSTEM_PROMPT + "\n\n[USER INPUT]\n" + cleanText;

  		const runAgy = async (promptInput) => {
  			return await new Promise((resolve, reject) => {
  				const child = spawn(AGY_BIN, ["-p", promptInput, "--effort", "low", "--dangerously-skip-permissions"]);
  				let output = "";
  				let errorOutput = "";

  				child.stdout.on("data", (data) => { output += data.toString(); });
  				child.stderr.on("data", (data) => { errorOutput += data.toString(); });
  				child.on("error", (err) => {
  					if (err.code === "ENOENT") {
  						agyAvailable = false
  						reject(new Error("CLI '" + AGY_BIN + "' tidak ditemukan di server. Pastikan sudah terinstall dan namanya cocok dengan global.agyBin di config.js."))
  					} else {
  						reject(err)
  					}
  				});
  				child.on("close", (code) => {
  					if (code === 0 && output.trim()) {
  						resolve(output.trim());
  					} else {
  						reject(new Error(errorOutput || "Process exited with code: " + code));
  					}
  				});

  				setTimeout(() => {
  					child.kill();
  					reject(new Error("Timeout: Sistem Mecha Bot kelamaan memproses nih ayang 🥺"));
  				}, 120000);
  			});
  		};

  		let result = await runAgy(fullPrompt);

  		const jsCodeRegex = /```(?:javascript|js)\r?\n([\s\S]*?)```/i;
  		let match = jsCodeRegex.exec(result);

  		if (match) {
  			let codeToTest = match[1].trim();
  			let check = await validateJsSyntax(codeToTest);

  			if (!check.valid) {
  				console.warn("[AGY Auto-Fix Syntax Error]:", check.error);
  				const fixPrompt = SYSTEM_PROMPT + "\n\n[ERROR SYNTAX DETECTED SAAT DIUJI NODE -C]\nError: " + check.error + "\n\nKode bermasalah:\n```javascript\n" + codeToTest + "\n```\n\nTolong perbaiki kodenya agar lolos validasi node --input-type=module -c - dan berikan kode yang 100% benar dan valid tanpa error!";
  				
  				try {
  					result = await runAgy(fixPrompt);
  				} catch (_) {}
  			}
  		}

  		const codeBlockRegex = /```(\w+)?\r?\n([\s\S]*?)```/g;
  		const codeMatches = [...result.matchAll(codeBlockRegex)];

  		if (wantsJs && codeMatches.length > 0) {
  			for (let i = 0; i < codeMatches.length; i++) {
  				const cMatch = codeMatches[i];
  				const lang = (cMatch[1] || "js").toLowerCase();
  				const content = cMatch[2].trim();
  				
  				let ext = "js";
  				let mime = "application/javascript";
  				if (lang.includes("html")) { ext = "html"; mime = "text/html"; }
  				else if (lang.includes("json")) { ext = "json"; mime = "application/json"; }
  				else if (lang.includes("css")) { ext = "css"; mime = "text/css"; }
  				else if (lang.includes("py")) { ext = "py"; mime = "text/x-python"; }
  				else if (lang.includes("sh")) { ext = "sh"; mime = "application/x-sh"; }

  				const nameMatch = content.match(/\/\/\s*([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/);
  				let fileName = nameMatch ? nameMatch[1].split("/").pop() : (codeMatches.length === 1 ? `code.${ext}` : `plugin_${i + 1}.${ext}`);
  				if (!fileName.includes(".")) fileName += `.${ext}`;

  				await sock.sendMessage(m.chat, {
  					document: Buffer.from(content, "utf8"),
  					fileName,
  					mimetype: mime,
  					caption: `📄 *FILE SOURCE CODE GENERATED*\n\n• 📁 *File Name:* ${fileName}\n• 📊 *Size:* ${Buffer.byteLength(content)} bytes\n\n_File ${fileName} siap dipakai buat Ayang!_ 💖✨`
  				}, { quoted: m });
  			}
  		}

  		if (wantsZip && codeMatches.length > 0) {
  			try {
  				const zip = new AdmZip();
  				let fileCount = 0;

  				for (let i = 0; i < codeMatches.length; i++) {
  					const cMatch = codeMatches[i];
  					const lang = (cMatch[1] || "js").toLowerCase();
  					const content = cMatch[2].trim();
  					
  					let ext = "js";
  					if (lang.includes("html")) ext = "html";
  					else if (lang.includes("json")) ext = "json";
  					else if (lang.includes("css")) ext = "css";
  					else if (lang.includes("py")) ext = "py";
  					else if (lang.includes("sh") || lang.includes("bash")) ext = "sh";
  					else if (lang.includes("ts")) ext = "ts";

  					const nameMatch = content.match(/\/\/\s*([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/);
  					let entryName = nameMatch ? nameMatch[1] : (codeMatches.length === 1 ? "code." + ext : "file_" + (i + 1) + "." + ext);

  					zip.addFile(entryName, Buffer.from(content, "utf8"));
  					fileCount++;
  				}

  				if (fileCount > 0) {
  					const zipBuffer = zip.toBuffer();
  					const zipName = "ruby_aspirant_code_" + Date.now() + ".zip";
  					
  					await sock.sendMessage(m.chat, {
  						document: zipBuffer,
  						fileName: zipName,
  						mimetype: "application/zip",
  						caption: "📦 *ZIP SOURCE CODE GENERATED*\n\n• 📁 *File Name:* " + zipName + "\n• 📊 *Total File:* " + fileCount + " File\n• ⚡ *Size:* " + zipBuffer.length + " bytes\n\n_Kode berhasil dikemas rapi dalam ZIP khusus buat Ayang!_ 💖✨"
  					}, { quoted: m });
  				}
  			} catch (errZip) {
  				console.error("[AGY ZIP GENERATION ERROR]", errZip);
  			}
  		}

  		if (codeMatches.length > 0 && typeof rbG.AIRich !== "undefined") {
  			try {
  				const rich = new rbG.AIRich(sock);
  				let lastIndex = 0;

  				for (const match of codeMatches) {
  					const textBefore = result.substring(lastIndex, match.index).trim();
  					if (textBefore) {
  						rich.addText(textBefore);
  					}

  					const lang = (match[1] || "javascript").toLowerCase();
  					const codeContent = match[2].trim();

  					rich.addCode(lang, codeContent);

  					lastIndex = match.index + match[0].length;
  				}

  				const textAfter = result.substring(lastIndex).trim();
  				if (textAfter) {
  					rich.addText(textAfter);
  				}

  				await rich.send(m.chat, { quoted: m });
  				await sock.sendMessage(m.chat, { react: { text: isOwner ? "💖" : "✅", key: m.key } });
  				return;
  			} catch (errRich) {
  				console.error("[AIRich Send Error, fallback to normal reply]:", errRich);
  			}
  		}

  		await reply(result);
  		await sock.sendMessage(m.chat, { react: { text: isOwner ? "💖" : "✅", key: m.key } });

  	} catch (e) {
  		console.error("[AGY PLUGIN ERROR]:", e);
  		await sock.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
  		await reply("Aduh maaf ya " + (isOwner ? "sayang" : "kak") + ", ada error di sistem mecha Bot: " + (e.message || "Terjadi kesalahan"));
  	}
  };

  handler.help = ["agy <teks/permintaan kode> [--js / --zip]"];
  handler.tags = ["ai"];
  handler.command = ["agy", "ruby", `${global.namebot}`, "ai"];
  return handler
}

rbRegister("ai/agy", feature)

let handler = (m, ctx) => rbRun("ai/agy", m, ctx)

handler.command = ["agy"]
handler.help = ["agy <teks/permintaan kode> [--js / --zip]"]
handler.tags = ["ai"]

handler.limit = true

export default handler
