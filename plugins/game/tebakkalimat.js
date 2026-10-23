import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebakkalimat', m, ctx)

handler.tags = ['game']
handler.command = ['tebakkalimat']

export default handler
