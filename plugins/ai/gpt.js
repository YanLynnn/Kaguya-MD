import { handleApiTool } from '../../lib/scraper.js'

// Argumen kurang / foto belum dikirim -> balasan "Command salah" berisi format & contoh.
let handler = (m, ctx) => handleApiTool('gpt', m, ctx)

handler.command = ['gpt']
handler.help = ['gpt']
handler.tags = ['ai']

handler.limit = true

export default handler
