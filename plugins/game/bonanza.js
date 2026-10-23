import { runBonanza } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runBonanza(m, ctx)

handler.tags = ['game']
handler.command = ['bonanza']
handler.group = true

export default handler
