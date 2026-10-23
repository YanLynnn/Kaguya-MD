import { dioRun, dioRegister } from '../../lib/plugin-engine.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = (module, exports, require) => {
// Daftar semua kartu live (versi Kaguya: daftar statis, tidak membaca pluginloader Kaguya)
const { B } = require('../../lib/style')
const ITEMS = [
      ["breakoutlive", "Breakout: pecahkan bata, 3 nyawa, level makin sulit"],
      ["calclive", "Kalkulator dasar & sains, hasil langsung, memori, riwayat"],
      ["catatanlive", "To-do list + catatan cepat"],
      ["destroylive", "Destroy Any Website: demo hancurkan situs pixel di chat (pistol, shotgun, granat) + tombol buka game aslinya"],
      ["dinolive", "Dino Run: lompati kaktus dan burung, makin lama makin cepat"],
      ["isekailive", "RPG isekai ala anime: tombol arah, kota, guild, toko, penginapan, hutan, gua, dan bos Naga Api (progres tersimpan)"],
      ["musikbot", "Pemutar musik: kartu playlist, cari, acak, favorit, top, lanjut + kirim audio"],
      ["dmp3", "Kirim lagu musik sebagai audio: .dmp3 <no|judul|acak|fav> (bisa beberapa nomor)"],
      ["flappylive", "Flappy Bird: tap untuk lompat, skor terbaik tersimpan"],
      ["gamelive", "2048, Snake, XO lawan bot, Tebak Angka"],
      ["games", "Arcade mini: Dino Runner, Tic Tac Toe, Doom, Flappy, Slot dalam satu kartu"],
      ["generatorlive", "Generator password, palet warna, lempar dadu & koin"],
      ["geodashlive", "Geo Dash v2: portal pesawat/bola/UFO/wave, 3 level + musik"],
      ["igstalk", "Stalk profil Instagram: kartu live, analisis, isi bio, foto HD, banding 2 akun"],
      ["konverterlive", "Konverter satuan: panjang, berat, volume, suhu, dll"],
      ["memorylive", "Game cocokkan kartu 3 level + rekor"],
      ["mineslive", "Minesweeper 3 level, mode bendera, timer & rekor"],
      ["paintlive", "Papan gambar: pensil, hapus, isi warna, undo"],
      ["pianolive", "Piano 2 oktaf: suara, rekam & putar, lagu demo"],
      ["pinlive", "Cari & lihat gambar/video Pinterest langsung di dalam kartu WhatsApp"],
      ["pomolive", "Pomodoro: timer fokus & istirahat dengan cincin progres dan hitungan sesi"],
      ["rodalive", "Roda putar pilihan sendiri: makan apa, truth or dare, undian"],
      ["spotifylive", "Cari & putar lagu Spotify + Dengerin Bareng langsung di dalam kartu WhatsApp"],
      ["tetrislive", "Tetris: tombol kontrol layar, ghost piece, level naik, skor terbaik tersimpan"],
      ["toolslive", "Timer, stopwatch, harga jual, diskon"],
      ["typinglive", "Tes kecepatan mengetik (WPM & akurasi), mode 30/60 detik"],
      ["wordlelive", "Tebak kata 5 huruf bahasa Indonesia, kata harian & acak"],
      ["ytlive", "Cari & putar video YouTube langsung di dalam kartu WhatsApp"]
]

module.exports = {
  name: 'livemenu',
  alias: ['menulive', 'cardmenu', 'htmlmenu'],
  category: 'live',
  desc: 'Daftar semua kartu HTML live',
  run: async ({ reply, prefix }) => {
    const list = ITEMS.map(([n, d]) => `𓏏 *${prefix}${n}*\n    ${d}`).join('\n')
    reply(`${global.namebot || 'Kaguya'}\n${B('LIVE CARD')}\n━━━━━━━━━━━━━━━━━━━━\n\n${list}\n\n_Total ${ITEMS.length} kartu, jalan langsung di dalam chat._`)
  },
}
    }

dioRegister("live/livemenu", feature)

let handler = (m, ctx) => dioRun("live/livemenu", m, ctx)

handler.command = ["livemenu", "menulive", "cardmenu", "htmlmenu"]
handler.help = ["livemenu", "menulive"]
handler.tags = ["live"]

export default handler
