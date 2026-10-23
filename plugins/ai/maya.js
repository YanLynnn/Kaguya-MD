import { handleApiTool } from '../../lib/scraper.js'

// Argumen kurang / foto belum dikirim -> balasan "Command salah" berisi format & contoh.
let handler = (m, ctx) => handleApiTool('maya', m, ctx)

handler.command = ['maya']
handler.help = ['maya']
handler.tags = ['ai']

handler.limit = true

export default handler
