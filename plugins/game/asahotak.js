import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('asahotak', m, ctx)

handler.tags = ['game']
handler.command = ['asahotak']

export default handler
