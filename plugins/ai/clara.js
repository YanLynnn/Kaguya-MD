import { handleApiTool } from '../../lib/scraper.js'

// Argumen kurang / foto belum dikirim -> balasan "Command salah" berisi format & contoh.
let handler = (m, ctx) => handleApiTool('clara', m, ctx)

handler.command = ['clara']
handler.help = ['clara']
handler.tags = ['ai']

handler.limit = true

export default handler
