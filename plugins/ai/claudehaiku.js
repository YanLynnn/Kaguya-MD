import { handleApiTool } from '../../lib/scraper.js'

// Argumen kurang / foto belum dikirim -> balasan "Command salah" berisi format & contoh.
let handler = (m, ctx) => handleApiTool('claudehaiku', m, ctx)

handler.command = ['claudehaiku']
handler.help = ['claudehaiku']
handler.tags = ['ai']

handler.limit = true

export default handler
