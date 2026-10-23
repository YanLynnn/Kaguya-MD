import { runTicTacToe } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runTicTacToe(m, ctx)

handler.tags = ['game']
handler.command = ['tictactoe']

export default handler
