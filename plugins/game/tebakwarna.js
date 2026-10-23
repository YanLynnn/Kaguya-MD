import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebakwarna', m, ctx)

handler.tags = ['game']
handler.command = ['tebakwarna']

export default handler
