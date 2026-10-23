import { handleApiTool } from '../../lib/scraper.js'

// Argumen kurang / foto belum dikirim -> balasan "Command salah" berisi format & contoh.
let handler = (m, ctx) => handleApiTool('removewm', m, ctx)

handler.command = ['removewm']
handler.help = ['removewm']
handler.tags = ['ai']

handler.limit = true

export default handler
