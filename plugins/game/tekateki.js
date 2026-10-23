import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tekateki', m, ctx)

handler.tags = ['game']
handler.command = ['tekateki']

export default handler
