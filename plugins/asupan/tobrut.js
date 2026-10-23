import { rbRun, rbRegister } from '../../lib/plugin-engine.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const axios = (__m => __m.default ?? __m)((await import('axios')))

  const PASTEBIN_URL = 'https://pastebin.com/raw/iLJ69Qsr'

  const WORKING_CATBOX_VIDEOS = [
  	'https://files.catbox.moe/gcyk70.mp4',
  	'https://files.catbox.moe/zm0p4a.mp4',
  	'https://files.catbox.moe/k9pg17.mp4',
  	'https://files.catbox.moe/l4i0gn.mp4',
  	'https://files.catbox.moe/ap31lj.mp4',
  	'https://files.catbox.moe/3a7beg.mp4',
  	'https://files.catbox.moe/osgu8o.mp4',
  	'https://files.catbox.moe/ysedtl.mp4',
  	'https://files.catbox.moe/i8sewv.mp4',
  	'https://files.catbox.moe/3i9kq4.mp4',
  	'https://files.catbox.moe/nq4v6b.mp4',
  	'https://files.catbox.moe/39yyc7.mp4',
  	'https://files.catbox.moe/053cbw.mp4',
  	'https://files.catbox.moe/fke4ht.mp4',
  	'https://files.catbox.moe/mi8ouf.mp4',
  	'https://files.catbox.moe/wtc2c9.mp4',
  	'https://files.catbox.moe/j40xwe.mp4',
  	'https://files.catbox.moe/l7shcw.mp4',
  	'https://files.catbox.moe/18izfd.mp4',
  	'https://files.catbox.moe/malsfc.mp4',
  	'https://files.catbox.moe/xgfmr2.mp4',
  	'https://files.catbox.moe/n317h3.mp4',
  	'https://files.catbox.moe/lrffgg.mp4',
  	'https://files.catbox.moe/z6pt9y.mp4',
  	'https://files.catbox.moe/urdave.mp4'
  ]

  const handler = async (m, { sock, conn, reply }) => {
  	const client = sock || conn || (m && m.sock) || rbG.conn

  	let videoList = WORKING_CATBOX_VIDEOS
  	try {
  		const { data } = await axios.get(PASTEBIN_URL, { timeout: 3000 })
  		if (data && Array.isArray(data.videos) && data.videos.length > 0) {
  			const valid = data.videos.filter(u => typeof u === 'string' && u.includes('catbox.moe'))
  			if (valid.length > 0) videoList = valid
  		}
  	} catch (e) {}

  	const selectedVideoUrl = videoList[Math.floor(Math.random() * videoList.length)]

  	if (reply) reply('⏳ Mengirimkan video Asupan Tobrut...')

  	await client.sendMessage(m.chat, {
  		video: { url: selectedVideoUrl },
  		caption: `🎥 *Asupan Tobrut Video*\n\n© ${rbG.namaBot || 'Hirara AI'}`
  	}, { quoted: m })
  }

  handler.help = ['tobrut', 'tobrutvid', 'tobrutplayer', 'tobruthtml']
  handler.tags = ['asupan']
  handler.command = ['tobrut']
  handler.limit = true;
  handler.premium = true
  handler.register = true
  return handler
}

rbRegister("asupan/tobrut", feature)

let handler = (m, ctx) => rbRun("asupan/tobrut", m, ctx)

handler.command = ["tobrut"]
handler.help = ["tobrut", "tobrutvid", "tobrutplayer", "tobruthtml"]
handler.tags = ["asupan"]
handler.premium = true

export default handler
