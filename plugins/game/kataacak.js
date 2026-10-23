import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('kataacak', m, ctx)

handler.tags = ['game']
handler.command = ['kataacak']

export default handler
