import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebaklirik', m, ctx)

handler.tags = ['game']
handler.command = ['tebaklirik']

export default handler
