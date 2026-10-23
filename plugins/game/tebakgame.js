import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebakgame', m, ctx)

handler.tags = ['game']
handler.command = ['tebakgame']

export default handler
