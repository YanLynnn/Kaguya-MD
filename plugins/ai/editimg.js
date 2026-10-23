import { handleApiTool } from '../../lib/scraper.js'

// Argumen kurang / foto belum dikirim -> balasan "Command salah" berisi format & contoh.
let handler = (m, ctx) => handleApiTool('editimg', m, ctx)

handler.command = ['editimg']
handler.help = ['editimg']
handler.tags = ['ai']

handler.limit = true

export default handler
