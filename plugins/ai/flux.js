import { handleApiTool } from '../../lib/scraper.js'

// Argumen kurang / foto belum dikirim -> balasan "Command salah" berisi format & contoh.
let handler = (m, ctx) => handleApiTool('flux', m, ctx)

handler.command = ['flux']
handler.help = ['flux']
handler.tags = ['ai']

handler.limit = true

export default handler
