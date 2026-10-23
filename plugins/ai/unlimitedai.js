import { handleApiTool } from '../../lib/scraper.js'

// Argumen kurang / foto belum dikirim -> balasan "Command salah" berisi format & contoh.
let handler = (m, ctx) => handleApiTool('unlimitedai', m, ctx)

handler.command = ['unlimitedai']
handler.help = ['unlimitedai']
handler.tags = ['ai']

handler.limit = true

export default handler
