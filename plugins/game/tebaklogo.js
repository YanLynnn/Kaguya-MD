import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebaklogo', m, ctx)

handler.tags = ['game']
handler.command = ['tebaklogo']

export default handler
