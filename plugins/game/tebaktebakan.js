import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebaktebakan', m, ctx)

handler.tags = ['game']
handler.command = ['tebaktebakan']

export default handler
