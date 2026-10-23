import { runSambungKata } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runSambungKata(m, ctx)

handler.tags = ['game']
handler.command = ['sambungkata']
handler.group = true

export default handler
