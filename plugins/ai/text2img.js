import { handleApiTool } from '../../lib/scraper.js'

// Argumen kurang / foto belum dikirim -> balasan "Command salah" berisi format & contoh.
let handler = (m, ctx) => handleApiTool('text2img', m, ctx)

handler.command = ['text2img']
handler.help = ['text2img']
handler.tags = ['ai']

handler.limit = true

export default handler
