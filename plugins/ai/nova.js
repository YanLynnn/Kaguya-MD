import { handleApiTool } from '../../lib/scraper.js'

// Argumen kurang / foto belum dikirim -> balasan "Command salah" berisi format & contoh.
let handler = (m, ctx) => handleApiTool('nova', m, ctx)

handler.command = ['nova']
handler.help = ['nova']
handler.tags = ['ai']

handler.limit = true

export default handler
