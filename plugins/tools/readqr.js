import { handleApiTool } from '../../lib/scraper.js'

// Argumen kurang / foto belum dikirim -> balasan "Command salah" berisi format & contoh.
let handler = (m, ctx) => handleApiTool('readqr', m, ctx)

handler.command = ['readqr']
handler.help = ['readqr']
handler.tags = ['tools']

export default handler
