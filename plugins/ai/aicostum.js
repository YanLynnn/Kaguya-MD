import { handleApiTool } from '../../lib/scraper.js'

// Argumen kurang / foto belum dikirim -> balasan "Command salah" berisi format & contoh.
let handler = (m, ctx) => handleApiTool('aicostum', m, ctx)

handler.command = ['aicostum']
handler.help = ['aicostum']
handler.tags = ['ai']

handler.limit = true

export default handler
