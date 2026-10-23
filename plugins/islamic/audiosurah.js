import { rbRun, rbRegister } from '../../lib/plugin-engine.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const axios = (__m => __m.default ?? __m)((await import('axios')))

  let quranCache = null;

  const getQuranData = async () => {
  	if (quranCache) return quranCache;
  	const res = await axios.get('https://raw.githubusercontent.com/penggguna/QuranJSON/master/quran.json', { timeout: 20000 });
  	if (Array.isArray(res.data)) {
  		quranCache = res.data;
  		return quranCache;
  	}
  	throw new Error('Data Al-Quran tidak valid.');
  };

  const handler = async (m, { sock, conn, hirara, text, usedPrefix, command, reply }) => {
  	const client = sock || conn || hirara || rbG.mainSock;

  	if (!text || !text.trim()) {
  		const exampleText = `📖 *AUDIO MUROTTAL SURAH AL-QURAN*\n\n` +
  			`Gunakan nomor surah *(1 - 114)* atau nama surah.\n\n` +
  			`• *Contoh:* \`${usedPrefix + command} 1\`\n` +
  			`• *Contoh:* \`${usedPrefix + command} Al-Fatihah\`\n` +
  			`• *Contoh:* \`${usedPrefix + command} Yasin\`\n\n` +
  			`*Daftar Surah Populer:*\n` +
  			`• 1 : Al-Fatihah (Pembuka)\n` +
  			`• 2 : Al-Baqarah (Sapi Betina)\n` +
  			`• 3 : Ali 'Imran (Keluarga Imran)\n` +
  			`• 4 : An-Nisa' (Wanita)\n` +
  			`• 18 : Al-Kahf (Penghuni Gua)\n` +
  			`• 36 : Yasin (Yasin)\n` +
  			`• 55 : Ar-Rahman (Maha Pengasih)\n` +
  			`• 56 : Al-Waqi'ah (Hari Kiamat)\n` +
  			`• 67 : Al-Mulk (Kerajaan)\n` +
  			`• 112 : Al-Ikhlas (Ikhlas)\n` +
  			`• 113 : Al-Falaq (Waktu Subuh)\n` +
  			`• 114 : An-Nas (Manusia)`;
  		return reply(exampleText);
  	}

  	reply(global.mess?.loading || global.mess?.wait || '⏳ _Sedang mengambil data murottal surah..._');

  	try {
  		const surahData = await getQuranData();
  		const input = text.trim();
  		let selectedSurah = null;

  		if (!isNaN(input) && Number(input) >= 1 && Number(input) <= 114) {
  			const num = Number(input);
  			selectedSurah = surahData.find(s => s.number_of_surah == num);
  		} else {
  			const inputClean = input.toLowerCase().replace(/[^a-z0-9]/g, '');
  			selectedSurah = surahData.find(s => {
  				const nameClean = (s.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  				const idClean = (s.name_translations?.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  				const enClean = (s.name_translations?.en || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  				return nameClean === inputClean || idClean === inputClean || enClean === inputClean;
  			});
  		}

  		if (!selectedSurah) {
  			return reply(`❌ Surah *"${text}"* tidak ditemukan!\n\nPastikan nomor berada di rentang 1 - 114 atau nama surah tepat. Contoh: *${usedPrefix + command} Al-Mulk*`);
  		}

  		const audioUrl = selectedSurah.recitation;
  		const surahNum = selectedSurah.number_of_surah;
  		const surahNameLatin = selectedSurah.name;
  		const surahNameAr = selectedSurah.name_translations?.ar || '';
  		const surahMeaning = selectedSurah.name_translations?.id || selectedSurah.name_translations?.en || '';
  		const totalAyah = selectedSurah.number_of_ayah;
  		const place = selectedSurah.place === 'Mecca' ? 'Makkiyah' : 'Madaniyah';

  		const infoCaption = `🎧 *AUDIO MUROTTAL AL-QURAN* 📖\n\n` +
  			`• 🔢 *Surah Ke:* ${surahNum} dari 114\n` +
  			`• 📜 *Nama Surah:* ${surahNameLatin} (${surahNameAr})\n` +
  			`• 💡 *Arti Surah:* ${surahMeaning}\n` +
  			`• 🔢 *Jumlah Ayat:* ${totalAyah} Ayat\n` +
  			`• 📍 *Tempat Turun:* ${place}\n\n` +
  			`_Mengirimkan audio murottal lengkap..._ 🎙️`;

  		await reply(infoCaption);

  		await client.sendMessage(m.chat, {
  			audio: { url: audioUrl },
  			mimetype: 'audio/mpeg',
  			ptt: false,
  			fileName: `Surah_${surahNum}_${surahNameLatin.replace(/\s+/g, '_')}.mp3`
  		}, { quoted: m });

  	} catch (error) {
  		console.error('[AUDIOSURAH ERROR]', error);
  		reply(`❌ Gagal mengambil audio surah: ${error.message || error}`);
  	}
  };

  handler.help = ['audiosurah <nomor/nama>', 'audiosurat <nomor/nama>'];
  handler.tags = ['islamic'];
  handler.command = ['audiosurah', 'audiosurat', 'murottal', 'murotalsurah', 'quranaudio'];
  handler.category = 'islamic';
  handler.description = 'Dengarkan lantunan audio murottal Al-Quran per surah (1 - 114)';
  handler.limit = true;
  handler.register = true;
  return handler
}

rbRegister("islamic/audiosurah", feature)

let handler = (m, ctx) => rbRun("islamic/audiosurah", m, ctx)

handler.command = ["audiosurah", "audiosurat", "murottal", "murotalsurah", "quranaudio"]
handler.help = ["audiosurah <nomor/nama>", "audiosurat <nomor/nama>"]
handler.tags = ["islamic"]

export default handler
