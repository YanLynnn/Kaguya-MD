import { runSuitPvp } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runSuitPvp(m, ctx)

handler.tags = ['game']
handler.command = ['suitpvp']
handler.group = true

export default handler
