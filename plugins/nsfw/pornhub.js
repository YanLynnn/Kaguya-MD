import { rbRun, rbRegister } from '../../lib/plugin-engine.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const axios = (__m => __m.default ?? __m)((await import('axios')))

  async function searchPornhub(query) {
  	try {
  		const searchUrl = `https://www.pornhub.com/video/search?search=${encodeURIComponent(query)}`
  		const { data: html } = await axios.get(searchUrl, {
  			headers: {
  				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  				'Accept-Language': 'en-US,en;q=0.9',
  				'Cookie': 'age_verified=1'
  			},
  			timeout: 15000
  		})

  		const results = []
  		const videoRegex = /<li class="[^"]*videoBlock[^"]*"[\s\S]*?<a href="(\/view_video\.php\?viewkey=[^"]+)" title="([^"]+)"[\s\S]*?<var class="duration">([^<]+)<\/var>[\s\S]*?<span class="views"><var>([^<]+)<\/var>/g
  		let match
  		while ((match = videoRegex.exec(html)) !== null) {
  			results.push({
  				title: match[2].trim(),
  				url: `https://www.pornhub.com${match[1]}`,
  				duration: match[3].trim(),
  				views: match[4].trim()
  			})
  		}

  		if (!results.length) {
  			const simpleRegex = /href="(\/view_video\.php\?viewkey=[a-zA-Z0-9]+)" title="([^"]+)"/g
  			let m
  			const added = new Set()
  			while ((m = simpleRegex.exec(html)) !== null) {
  				const vUrl = `https://www.pornhub.com${m[1]}`
  				if (!added.has(vUrl)) {
  					added.add(vUrl)
  					results.push({
  						title: m[2].trim(),
  						url: vUrl,
  						duration: '-',
  						views: '-'
  					})
  				}
  			}
  		}

  		return results
  	} catch (err) {
  		console.error('[Pornhub Direct Scraper Search Error]', err.message)
  		return []
  	}
  }

  async function downloadPornhub(url) {
  	try {
  		const viewkeyMatch = url.match(/viewkey=([a-zA-Z0-9]+)/i)
  		const cleanUrl = viewkeyMatch ? `https://www.pornhub.com/view_video.php?viewkey=${viewkeyMatch[1]}` : url

  		const { data: html } = await axios.get(cleanUrl, {
  			headers: {
  				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  				'Accept-Language': 'en-US,en;q=0.9',
  				'Cookie': 'age_verified=1'
  			},
  			timeout: 15000
  		})

  		const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
  		let title = titleMatch ? titleMatch[1].replace('- Pornhub.com', '').trim() : 'Pornhub Video'

  		let mediaDefinitions = []
  		let duration = '-'

  		const flashvarsMatch = html.match(/var\s+flashvars_\d+\s*=\s*(\{[\s\S]*?\});/)
  		if (flashvarsMatch) {
  			try {
  				const flashvars = JSON.parse(flashvarsMatch[1])
  				title = flashvars.video_title || title
  				duration = flashvars.video_duration ? `${flashvars.video_duration}s` : '-'
  				if (Array.isArray(flashvars.mediaDefinitions)) {
  					mediaDefinitions = flashvars.mediaDefinitions
  				}
  			} catch (e) {
  				console.error('[Flashvars parse error]', e.message)
  			}
  		}

  		if (!mediaDefinitions.length) {
  			const mediaDefMatch = html.match(/"mediaDefinitions"\s*:\s*(\[\{[\s\S]*?\}\])/)
  			if (mediaDefMatch) {
  				try {
  					mediaDefinitions = JSON.parse(mediaDefMatch[1])
  				} catch (e) {
  					console.error('[MediaDefinitions parse error]', e.message)
  				}
  			}
  		}

  		let videoUrl = null

  		const mp4Items = mediaDefinitions.filter(m => 
  			m.videoUrl && 
  			typeof m.videoUrl === 'string' && 
  			(m.format === 'mp4' || m.videoUrl.toLowerCase().includes('.mp4')) &&
  			!m.videoUrl.toLowerCase().includes('.m3u8')
  		)

  		if (mp4Items.length > 0) {
  			mp4Items.sort((a, b) => (parseInt(a.quality || 0) - parseInt(b.quality || 0)))
  			videoUrl = mp4Items[0].videoUrl
  		} else {
  			const mp4Matches = html.match(/"videoUrl"\s*:\s*"([^"]+\.mp4[^"]*)"/i)
  			if (mp4Matches) {
  				videoUrl = mp4Matches[1]
  			}
  		}

  		if (!videoUrl) {
  			const anyValidUrl = mediaDefinitions.find(m => m.videoUrl && typeof m.videoUrl === 'string' && !m.videoUrl.includes('.m3u8'))
  			if (anyValidUrl) {
  				videoUrl = anyValidUrl.videoUrl
  			}
  		}

  		if (!videoUrl) {
  			throw new Error('Berkas video MP4 langsung tidak ditemukan. Halaman ini mungkin diproteksi atau disajikan sebagai stream segment HLS.')
  		}

  		videoUrl = videoUrl.replace(/\\/g, '')

  		const videoResponse = await axios.get(videoUrl, {
  			responseType: 'arraybuffer',
  			headers: {
  				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  				'Referer': 'https://www.pornhub.com/'
  			},
  			timeout: 90000
  		})

  		const buffer = Buffer.from(videoResponse.data)

  		return {
  			title,
  			duration,
  			buffer,
  			videoUrl
  		}
  	} catch (err) {
  		console.error('[Pornhub Direct Scraper DL Error]', err.message)
  		throw err
  	}
  }

  const handler = async (m, { sock, text, reply, usedPrefix, command }) => {
  	const quotedText = m.quoted ? (m.quoted.text || m.quoted.caption || m.quoted.description || m.quoted.msg?.caption || m.quoted.msg?.text || '') : ''
  	const rawInput = (text || quotedText || '').trim()
  	const urlMatch = rawInput.match(/https?:\/\/(?:www\.)?pornhub\.com\/view_video\.php\?viewkey=[a-zA-Z0-9]+/i) || rawInput.match(/https?:\/\/[^\s]+/i)
  	const targetInput = urlMatch ? urlMatch[0] : rawInput

  	if (!targetInput) {
  		return reply(
  			`🔞 *Pornhub Scraper (Pure / Non-API)*\n\n` +
  			`Contoh Penggunaan:\n` +
  			`• *${usedPrefix}${command} <url pornhub>* : Unduh video Pornhub langsung\n` +
  			`• *${usedPrefix}${command} search <query>* : Cari video Pornhub langsung\n\n` +
  			`Contoh:\n` +
  			`${usedPrefix}${command} https://www.pornhub.com/view_video.php?viewkey=phxxx\n` +
  			`${usedPrefix}${command} search stepmother\n\n` +
  			`_Atau reply pesan yang berisi link Pornhub!_`
  		)
  	}

  	const isUrl = targetInput.match(/https?:\/\/(www\.)?pornhub\.com\/view_video\.php\?viewkey=[a-zA-Z0-9]+/i) || targetInput.startsWith('http')

  	if (isUrl) {
  		try {
  			reply(global.mess.wait)
  			const result = await downloadPornhub(targetInput)

  			const caption = `🔞 *PORNHUB DIRECT DOWNLOADER*\n\n` +
  				`📌 *Judul*: ${result.title}\n` +
  				`⏱️ *Durasi*: ${result.duration}\n\n` +
  				`© ${rbG.namaBot || 'Hirara AI'}`

  			try {
  				return await sock.sendMessage(m.chat, {
  					video: result.buffer,
  					caption: caption,
  					mimetype: 'video/mp4',
  					fileName: `${result.title}.mp4`
  				}, { quoted: m })
  			} catch (sendErr) {
  				console.error('[SEND VIDEO BUFFER FAILED, FALLBACK TO DOCUMENT]', sendErr.message)
  				return await sock.sendMessage(m.chat, {
  					document: result.buffer,
  					caption: caption,
  					mimetype: 'video/mp4',
  					fileName: `${result.title}.mp4`
  				}, { quoted: m })
  			}

  		} catch (e) {
  			console.error('[PORNHUB DL ERROR]', e.message)
  			return reply(`❌ Gagal mengunduh video Pornhub: ${e.message}`)
  		}
  	} else {
  		const searchQuery = targetInput.replace(/^search\s*/i, '').trim()
  		try {
  			reply(global.mess.wait)
  			const items = await searchPornhub(searchQuery)

  			if (!items.length) {
  				return reply(`❌ Tidak ada hasil ditemukan untuk *${searchQuery}*.`)
  			}

  			const rows = items.slice(0, 10).map((item, idx) => ({
  				title: `${idx + 1}. ${item.title || 'Video'}`,
  				description: `Durasi: ${item.duration || '-'} | Views: ${item.views || '-'}`,
  				id: `${usedPrefix}${command} ${item.url}`
  			}))

  			const caption = `🔞 *PORNHUB SEARCH*\n\nKata Kunci: *${searchQuery}*\nDitemukan: ${items.length} Video.`
  			const daftar = items.slice(0, 10).map((item, idx) => `*${idx + 1}.* ${item.title || 'Video'}\n     ⏱️ ${item.duration || '-'} | 👁️ ${item.views || '-'}\n     ➜ ${usedPrefix}${command} ${item.url}`).join('\n\n')
  			const teksDaftar = `${caption}\n\nSalin / ketik perintah di bawah untuk mengunduh:\n\n${daftar}`

  			// iPhone tidak merender tombol list (single_select) -> kirim daftar teks saja
  			const { isIosId, chatIsIos } = await import('./wa.js')
  			const ios = isIosId(m.key?.id) || (!m.isGroup && chatIsIos(m.chat))
  			if (!ios) {
  				try {
  					return await sock.sendButtons(m.chat, {
  						text: `${caption}\n\nTekan tombol *PILIH VIDEO* di bawah. Kalau tombol tidak muncul, pakai daftar teks di bawah ini.\n\n${daftar}`,
  						footer: `© ${rbG.namaBot || global.namebot || 'Bot'}`,
  						buttons: [{
  							type: 'list',
  							text: '🔞 PILIH VIDEO',
  							sections: [{
  								title: `Hasil Search: ${searchQuery}`.slice(0, 24),
  								rows: items.slice(0, 10).map((item, idx) => ({
  									title: `${idx + 1}. ${item.title || 'Video'}`.slice(0, 24),
  									description: `Durasi: ${item.duration || '-'} | Views: ${item.views || '-'}`,
  									id: `${usedPrefix}${command} ${item.url}`
  								}))
  							}]
  						}]
  					}, { quoted: m })
  				} catch (e) {
  					console.log('[PORNHUB] tombol list gagal, kirim teks:', e.message)
  				}
  			}
  			return await sock.sendMessage(m.chat, { text: teksDaftar }, { quoted: m })

  		} catch (e) {
  			console.error('[PORNHUB SEARCH ERROR]', e.message)
  			return reply('❌ Gagal melakukan pencarian di Pornhub.')
  		}
  	}
  }

  handler.help = ['pornhub <url|search query>']
  handler.tags = ['downloader', 'nsfw']
  handler.command = ['pornhub', 'ph', 'phdl']
  handler.limit = true;

  handler.register = true
  handler.premium = false
  return handler
}

rbRegister("nsfw/pornhub", feature)

let handler = (m, ctx) => rbRun("nsfw/pornhub", m, ctx)

handler.command = ["pornhub", "ph", "phdl"]
handler.help = ["pornhub <url|search query>"]
handler.tags = ["nsfw"]
handler.premium = true

export default handler
