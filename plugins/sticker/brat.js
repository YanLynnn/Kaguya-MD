// ───────── brat ─────────
// Gabungan plugin: animebrat, brat, bratcewek, bratextra, bratgreen, bratgura, bratlocal, bratvid, bratvid2

import axios from 'axios'
import { config, te, wrapPlugin, mergePlugins } from '../../lib/plugin-engine.js'
import { f, getAssetBuffer, drawBrat } from '../../lib/plugin-engine.js'
import fs from 'fs'
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import path from 'path'
import fetch from 'node-fetch'
import { createRequire } from 'node:module'
import fsp from 'fs/promises'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { bratVid } from 'brat-canvas/video'

// ── animebrat ──
const _animebrat = (() => {
const pluginConfig = {
    name: 'bratanime',
    alias: [],
    category: 'sticker',
    description: 'Membuat sticker brat',
    usage: '.bratanime <text>',
    example: '.bratanime Hai semua',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.args.join(' ')
    if (!text) {
        return m.reply(`🖼️ *ʙʀᴀᴛ ᴀɴɪᴍᴇ sᴛɪᴄᴋᴇʀ*\n\n> Masukkan teks\n\n\`Contoh: ${m.prefix}bratanime Hai semua\``)
    }
    
    m.react('🕕')
    
    try {
        const url = `https://api.nexray.web.id/maker/bratanime?text=${encodeURIComponent(text)}`
        await sock.sendImageAsSticker(m.chat, url, m, {
            packname: config.sticker.packname,
            author: config.sticker.author
        })
        m.react('✅')
    } catch (error) {
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── brat ──
const _brat = (() => {
const pluginConfig = {
  name: "brat",
  alias: ["bratimg"],
  category: "sticker",
  description: "Menu variant brat dan generator sticker brat",
  usage: ".brat | .bratimg <text>",
  example: ".bratimg Hai semua",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

const BRAT_VARIANTS = [
  {
    title: "Brat Default",
    description: "Sticker brat versi biasa",
    command: "bratimg",
  },
  {
    title: "Brat Green",
    description: "Variant brat warna hijau",
    command: "bratgreen",
  },
  {
    title: "Brat Cewek",
    description: "Variant brat cewek",
    command: "bratcewek",
  },
  {
    title: "Brat Vermeil",
    description: "Variant brat Vermeil",
    command: "bratvermeil",
  },
  { title: "Brat HD", description: "Variant brat HD", command: "brathd" },
  {
    title: "Brat Video",
    description: "Sticker brat animated",
    command: "bratvid",
  },
  {
    title: "Brat Video V2",
    description: "Sticker brat video v2",
    command: "bratvid2",
  },
  {
    title: "Brat Vermeil Video",
    description: "Variant brat Vermeil video",
    command: "bratvermeilvid",
  },
  {
    title: "Brat Gojo",
    description: "Variant brat Gojo",
    command: "bratgojo",
  },
  {
    title: "Brat Gojo Video",
    description: "Variant brat Gojo video",
    command: "bratgojovid",
  },
];

async function sendBratMenu(m, sock, text) {
  const list = BRAT_VARIANTS.map(
    (item) => `-▢ ${m.prefix}${item.command} _(${item.description})_`,
  ).join("\n");

  const caption =
    "🌿 *kamu mau buat brat yak, silahkan pilih variant brat di bawah*\n\n" +
    list +
    `\n\nContoh: ${m.prefix}bratimg ${text || "Hai semua"}`;

  const logo = getAssetBuffer("logo");
  if (logo) {
    return sock.sendMessage(m.chat, { image: logo, caption }, { quoted: m });
  }
  return sock.sendMessage(m.chat, { text: caption }, { quoted: m });
}

async function handler(m, { sock }) {
  const text = m.text;
  const command = String(m.command || "").toLowerCase();

  if (command === "brat") {
    await sendBratMenu(m, sock, text);
    return;
  }

  if (!text) {
    return m.reply(
      `🖼️ *ʙʀᴀᴛ ɪᴍᴀɢᴇ*\n\n> Masukkan teks\n\n\`Contoh: ${m.prefix}bratimg Hai semua\``,
    );
  }

  m.react("🕕");

  try {
    await sock.sendImageAsSticker(m.chat, `https://api.nexray.eu.cc/maker/brat?text=${encodeURIComponent(text)}`, m, {
      packname: config.sticker.packname,
      author: config.sticker.author,
    });

    m.react("✅");
  } catch (error) {
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── bratcewek ──
const _bratcewek = (() => {
const pluginConfig = {
    name: 'bratcewek',
    alias: [],
    category: 'sticker',
    description: 'Membuat sticker brat',
    usage: '.bratcewek <text>',
    example: '.bratcewek Hai semua',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.args.join(' ')
    if (!text) {
        return m.reply(`🖼️ *ʙʀᴀᴛ cᴇᴡᴇᴋ sᴛɪᴄᴋᴇʀ*\n\n> Masukkan teks\n\n\`Contoh: ${m.prefix}bratcewek Hai semua\``)
    }
    
    m.react('🕕')
    
    try {
        const url = `https://api.deline.web.id/maker/cewekbrat?text=${encodeURIComponent(text)}`
        await sock.sendImageAsSticker(m.chat, url, m, {
            packname: config.sticker.packname,
            author: config.sticker.author
        })
        m.react('✅')
    } catch (error) {
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── bratextra ──
const _bratextra = (() => {
const pluginConfig = {
  name: "bratbahlil",
  alias: ["brathd", "bratpatrick", "bratsquidward", "bratwhite", "bratchika", "bratkobato", "bratmenhera", "bratnezuko", "bratqiqi", "bratruromiya", "bratumaru"],
  category: "sticker",
  description: "Bikin brat versi custom",
  usage: ".bratanime <teks>",
  example: ".bratanime Halo",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 2,
  isEnabled: true,
};

const BRAT_FONT_URL = "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Poppins.ttf";
let isFontLoaded = false;

const TEMPLATES = {
  bratanime: {
    url: "https://raw.githubusercontent.com/kayzzaoshi-code/Uploader/main/file_1772989415819.jpeg",
    areaX: 170, areaW: 460, areaCY: 530, areaMaxH: 210, fontSize: 72, minFontSize: 20
  },
  bratbahlil: {
    url: "https://raw.githubusercontent.com/kayzzaoshi-code/Uploader/main/file_1772229450331.jpeg",
    centerX: 460, centerY: 840, maxWidth: 660, maxHeight: 140, fontSize: 110, minFontSize: 40
  },
  bratpatrick: {
    url: "https://raw.githubusercontent.com/kayzzaoshi-code/Uploader/main/file_1772794292812.jpeg",
    centerX: 460, centerY: 599, maxWidth: 260, maxHeight: 160, fontSize: 70, minFontSize: 8
  },
  bratsquidward: {
    url: "https://raw.githubusercontent.com/kayzzaoshi-code/Uploader/main/file_1772794955890.jpeg",
    centerX: 370, centerY: 370, maxWidth: 230, maxHeight: 110, fontSize: 50, minFontSize: 10
  },
  bratwhite: {
    url: "https://raw.githubusercontent.com/kayzzaoshi-code/Uploader/main/file_1771727655279.jpeg",
    centerX: (w) => w / 2 + 10, centerY: (w, h) => h / 2 + 285, maxWidth: 480, maxHeight: 280, rotationAngle: -7.5 * Math.PI / 180, fontSize: 130, minFontSize: 10
  },
  bratchika: {
    url: "https://raw.githubusercontent.com/kayzzaoshi-code/Uploader/main/file_1771527351581.jpeg",
    centerX: 500, centerY: 810, maxWidth: 450, maxHeight: 250, fontSize: 75, minFontSize: 15, lineHeightMultiplier: 1.2
  },
  bratkobato: {
    url: "https://raw.githubusercontent.com/kayzzaoshi-code/Uploader/main/file_1771728510134.jpeg",
    centerX: (w) => w / 2 + 175, centerY: (w, h) => h / 2 + 75, maxWidth: 350, maxHeight: 250, fontSize: 120, minFontSize: 10, lineHeightMultiplier: 1.2
  },
  bratmenhera: {
    url: "https://c.termai.cc/i145/qJsN.jpg",
    centerX: (w) => w / 2 + 25, centerY: 260, maxWidth: 480, maxHeight: 310, fontSize: 400, minFontSize: 25, lineHeightMultiplier: 0.92
  },
  bratnezuko: {
    url: "https://raw.githubusercontent.com/kayzzaoshi-code/Uploader/main/file_1772793912974.jpeg",
    centerX: (w) => w / 2, centerY: 1245, maxWidth: 820, maxHeight: 480, fontSize: 140, minFontSize: 20, lineHeightMultiplier: 1.25
  },
  bratqiqi: {
    url: "https://raw.githubusercontent.com/kayzzaoshi-code/Uploader/main/file_1771532869746.jpeg",
    centerX: (w) => w / 2 + 5, centerY: (w, h) => h / 2 + 108, maxWidth: 210, maxHeight: 95, fontSize: 40, minFontSize: 5, rotationAngle: -7.5 * Math.PI / 180, lineHeightMultiplier: 1.1
  },
  bratruromiya: {
    url: "https://raw.githubusercontent.com/kayzzaoshi-code/Uploader/main/file_1771827988894.jpeg",
    centerX: 810, centerY: 1310, maxWidth: 650, maxHeight: 450, fontSize: 120, minFontSize: 15, lineHeightMultiplier: 1.2
  },
  bratumaru: {
    url: "https://raw.githubusercontent.com/kayzzaoshi-code/Uploader/main/file_1771524973616.jpeg",
    centerX: 375, centerY: 565, maxWidth: 450, maxHeight: 250, fontSize: 75, minFontSize: 15, lineHeightMultiplier: 1.2
  }
};

function toUnified(str) {
  return Array.from(str)
    .map(e => e.codePointAt(0).toString(16))
    .join("-")
    .toLowerCase();
}

function tokenize(text) {
  const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
  const raw = [];
  let lastIndex = 0;
  let match;

  while ((match = emojiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      raw.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    raw.push({ type: "emoji", value: match[0] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    raw.push({ type: "text", value: text.slice(lastIndex) });
  }

  const tokens = [];
  for (const seg of raw) {
    if (seg.type === "emoji") {
      tokens.push(seg);
    } else {
      const words = seg.value.split(/\s+/).filter(w => w.length > 0);
      words.forEach(w => {
        if (tokens.length > 0) tokens.push({ type: "space" });
        tokens.push({ type: "text", value: w });
      });
    }
  }

  return tokens;
}

async function getEmojiImage(emoji) {
  const unified = toUnified(emoji);
  const filePath = path.join(
    process.cwd(),
    "node_modules",
    "emoji-datasource-apple",
    "img",
    "apple",
    "64",
    `${unified}.png`
  );
  if (!fs.existsSync(filePath)) return null;
  return await loadImage(fs.readFileSync(filePath));
}

function getTokenWidth(ctx, token, fontSize) {
  if (token.type === "space") return ctx.measureText(" ").width;
  if (token.type === "emoji") return fontSize * 1.15;
  return ctx.measureText(token.value).width;
}

function buildLines(ctx, tokens, fontSize, maxW) {
  ctx.font = `bold ${fontSize}px sans-serif`;
  const lines = [];
  let line = [];
  let lineW = 0;

  for (const token of tokens) {
    const w = getTokenWidth(ctx, token, fontSize);

    if (token.type === "space") {
      if (line.length > 0) {
        line.push({ ...token, w });
        lineW += w;
      }
      continue;
    }

    if (line.length > 0 && lineW + w > maxW) {
      while (line.length > 0 && line[line.length - 1].type === "space") {
        lineW -= line[line.length - 1].w;
        line.pop();
      }
      lines.push({ items: line, width: lineW });
      line = [{ ...token, w }];
      lineW = w;
    } else {
      line.push({ ...token, w });
      lineW += w;
    }
  }

  if (line.length > 0) {
    while (line.length > 0 && line[line.length - 1].type === "space") {
      lineW -= line[line.length - 1].w;
      line.pop();
    }
    lines.push({ items: line, width: lineW });
  }

  return lines;
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}

async function handler(m, { sock }) {
  const text = m.text;
  if (!text) {
    return m.reply(`⚠️ Harap masukkan teksnya!\nContoh: \`${m.prefix}${m.command} Halo semuanya\``);
  }

  await m.react("🕕");

  try {
    const cmd = m.command.toLowerCase();
    
    if (cmd === "brathd") {
      const url = `https://aqul-brat.hf.space/?text=${encodeURIComponent(text)}`;
      const response = await axios.get(url, {
          responseType: 'arraybuffer',
          headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'image/png,image/*,*/*;q=0.8',
              'Referer': 'https://aqul-brat.hf.space/',
              'Connection': 'keep-alive'
          }
      });
      await sock.sendImageAsSticker(m.chat, Buffer.from(response.data), m, {
        packname: config.sticker.packname,
        author: config.sticker.author
      });
      await m.react("✅");
      return;
    }

    const template = TEMPLATES[cmd];
    if (!template) {
      throw new Error("Template tidak ditemukan");
    }

    if (!isFontLoaded) {
      const fontBuffer = await fetchBuffer(BRAT_FONT_URL);
      GlobalFonts.register(fontBuffer, "Poppins");
      isFontLoaded = true;
    }

    const bgBuffer = await fetchBuffer(template.url);
    const bg = await loadImage(bgBuffer);

    const canvas = createCanvas(bg.width, bg.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

    const tokens = tokenize(text);
    let fontSize = template.fontSize;
    let lines = [];
    
    let areaW = template.areaW || template.maxWidth;
    let areaMaxH = template.areaMaxH || template.maxHeight;
    const lhMult = template.lineHeightMultiplier || 1.45;

    lines = buildLines(ctx, tokens, fontSize, areaW);

    while (fontSize > template.minFontSize) {
      lines = buildLines(ctx, tokens, fontSize, areaW);
      const totalH = lines.length * fontSize * lhMult;
      if (totalH <= areaMaxH) break;
      fontSize -= 2;
    }

    const lineHeight = fontSize * lhMult;
    const totalHeight = lines.length * lineHeight;
    
    let startY = 0;
    
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "middle";

    if (cmd === "bratanime") {
        let y = template.areaCY - totalHeight / 2 + fontSize * 0.85;
        ctx.textBaseline = "alphabetic";
        
        for (const line of lines) {
          ctx.font = `bold ${fontSize}px sans-serif`;
          let x = template.areaX + (template.areaW - line.width) / 2;
    
          for (const token of line.items) {
            if (token.type === "text") {
              ctx.fillText(token.value, x, y);
              x += token.w;
            } else if (token.type === "space") {
              x += token.w;
            } else if (token.type === "emoji") {
              const img = await getEmojiImage(token.value);
              const size = fontSize * 1.15;
              if (img) ctx.drawImage(img, x, y - size * 0.85, size, size);
              x += token.w;
            }
          }
          y += lineHeight;
        }
    } else {
        const centerX = typeof template.centerX === 'function' ? template.centerX(canvas.width) : template.centerX;
        const centerY = typeof template.centerY === 'function' ? template.centerY(canvas.width, canvas.height) : template.centerY;
        
        if (template.rotationAngle) {
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(template.rotationAngle);
            
            startY = -(totalHeight / 2) + (lineHeight / 2);
            
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const y = startY + i * lineHeight;
              ctx.font = `bold ${fontSize}px sans-serif`;
              let currentX = -line.width / 2;
        
              for (const token of line.items) {
                if (token.type === "text") {
                  ctx.fillText(token.value, currentX, y);
                  currentX += token.w;
                } else if (token.type === "space") {
                  currentX += token.w;
                } else if (token.type === "emoji") {
                  const img = await getEmojiImage(token.value);
                  const size = fontSize * 1.15;
                  if (img) ctx.drawImage(img, currentX, y - size / 2, size, size);
                  currentX += token.w;
                }
              }
            }
            ctx.restore();
        } else {
            startY = centerY - totalHeight / 2 + lineHeight / 2;
    
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const y = startY + i * lineHeight;
          
                ctx.font = `bold ${fontSize}px sans-serif`;
                let currentX = centerX - line.width / 2;
          
                for (const token of line.items) {
                  if (token.type === "text") {
                    ctx.fillText(token.value, currentX, y);
                    currentX += token.w;
                  } else if (token.type === "space") {
                    currentX += token.w;
                  } else if (token.type === "emoji") {
                    const img = await getEmojiImage(token.value);
                    const size = fontSize * 1.15;
                    if (img) ctx.drawImage(img, currentX, y - size / 2, size, size);
                    currentX += token.w;
                  }
                }
            }
        }
    }

    const buffer = await canvas.encode("png");
    await sock.sendImageAsSticker(m.chat, buffer, m, {
        packname: config.sticker.packname,
        author: config.sticker.author
    });
    
    await m.react("✅");
  } catch (error) {
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── bratgreen ──
const _bratgreen = (() => {
const pluginConfig = {
  name: "bratgreen",
  alias: [],
  category: "sticker",
  description: "Membuat sticker brat ijo",
  usage: ".bratgreen <text>",
  example: ".bratgreen Hai semua",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const text = m.args.join(" ").trim();
  if (!text) {
    return m.reply(`🖼️ *BRAT GREEN*\n\n> Masukkan teks\n\n\`Contoh: ${m.prefix}bratgreen Hai semua\``);
  }

  m.react("🕕");

  try {
    const buffer = await drawBrat({
      text,
      bgColor: "#8ACE00",
      width: 512,
      height: 512,
      maxWidth: 450,
      maxHeight: 450,
      centerX: 256,
      centerY: 256,
      maxFontSize: 130,
      fontDecrement: 5,
      lineHeightMult: 1.1,
      textColor: "#000000"
    });

    await sock.sendImageAsSticker(m.chat, buffer, m, {
      packname: config.sticker.packname,
      author: config.sticker.author,
    });
    m.react("✅");
  } catch (error) {
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── bratgura ──
const _bratgura = (() => {
const require = createRequire(import.meta.url);
const { createCanvas, loadImage } = require('@napi-rs/canvas')
const axios = require('axios')
const pluginConfig = {
    name: 'bratgura',
    alias: [],
    category: 'sticker',
    description: 'Membuat sticker anime chibi dengan teks brat style',
    usage: '.bratanime4 <text>',
    example: '.bratanime4 Besok cenin',
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

function getWrappedLines(ctx, text, maxWidth) {
    const words = text.split(' ')
    const lines = []
    let currentLine = ''

    for (const word of words) {
        if (ctx.measureText(word).width > maxWidth) {
            if (currentLine) { lines.push(currentLine); currentLine = '' }
            let charLine = ''
            for (const char of word) {
                if (ctx.measureText(charLine + char).width > maxWidth) {
                    lines.push(charLine)
                    charLine = char
                } else {
                    charLine += char
                }
            }
            if (charLine) currentLine = charLine
        } else {
            const test = currentLine ? `${currentLine} ${word}` : word
            if (ctx.measureText(test).width > maxWidth && currentLine) {
                lines.push(currentLine)
                currentLine = word
            } else {
                currentLine = test
            }
        }
    }
    if (currentLine) lines.push(currentLine)
    return lines
}

async function handler(m, { sock }) {
    const text = m.args.join(' ')
    if (!text) {
        return m.reply(`🎀 *ʙʀᴀᴛᴀɴɪᴍᴇ4 sᴛɪᴄᴋᴇʀ*\n\n> Masukkan teks\n\n\`Contoh: ${m.prefix}bratanime4 Besok cenin\``)
    }

    m.react('🕕')

    try {

        const bgUrls = [
            'https://files.catbox.moe/m9teca.jpg',
            'https://litter.catbox.moe/akn5gg.jpg',
            'https://tmpfiles.org/dl/wvwAALkspgUu/file.jpg',
            'https://gofile.io/d/s5gzIu',
            'https://put.icu/s/l9b7k5sm.png',
            'https://c.termai.cc/i132/s2x.png'
        ]

        let bgImage = null
        for (const url of bgUrls) {
            try {
                const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 })
                bgImage = await loadImage(Buffer.from(response.data))
                break
            } catch (e) {
                console.warn(`Bratanime4: Gagal load dari ${url}, mencoba link berikutnya...`)
            }
        }

        if (!bgImage) throw new Error('Semua link gambar gagal dimuat')

        const canvas = createCanvas(bgImage.width, bgImage.height)
        const ctx = canvas.getContext('2d')


        ctx.drawImage(bgImage, 0, 0)

        const W = bgImage.width
        const H = bgImage.height



        const textAreaX = Math.floor(W * 0.55)
        const textAreaY = Math.floor(H * 0.08)
        const textAreaW = Math.floor(W * 0.42)
        const textAreaH = Math.floor(H * 0.80)

        const padding = 10


        let fontSize = 80
        let lines = []

        while (fontSize >= 12) {
            ctx.font = `bold ${fontSize}px Arial`
            lines = getWrappedLines(ctx, text, textAreaW - padding * 2)
            const lineHeight = fontSize * 1.2
            const totalH = lines.length * lineHeight
            if (totalH <= textAreaH - padding * 2) break
            fontSize -= 2
        }

        const lineHeight = fontSize * 1.2
        const totalTextH = lines.length * lineHeight


        const startY = textAreaY + padding + (textAreaH - totalTextH) / 2 + fontSize
        const centerX = textAreaX + (textAreaW / 2)


        ctx.font = `bold ${fontSize}px Arial`
        ctx.fillStyle = '#000000'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'alphabetic'

        lines.forEach((line, i) => {
            ctx.fillText(line, centerX, startY + i * lineHeight)
        })

        const buffer = canvas.toBuffer('image/jpeg')

        await sock.sendImageAsSticker(m.chat, buffer, m, {
            packname: config.sticker.packname,
            author: config.sticker.author
        })

        m.react('✅')
    } catch (err) {
        console.error('Bratanime4 error:', err)
        m.react('❌')
        m.reply('❌ Gagal membuat sticker bratanime4, coba lagi nanti.\n> ' + err.message)
    }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── bratlocal ──
const _bratlocal = (() => {
const execFileAsync = promisify(execFile);

const pluginConfig = {
  name: "bratgojo",
  alias: ["bratgojovid", "bratvermeil", "bratvermeilvid"],
  category: "canvas",
  description: "Bikin brat versi lokal (Gojo & Vermeil)",
  usage: ".bratgojo <teks>",
  example: ".bratgojo Halo",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 15,
  energi: 2,
  isEnabled: true,
};

const BRAT_FONT_URL = "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Poppins.ttf";
let isFontLoaded = false;

const TEMPLATES = {
  vermeil: {
    url: "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Vermile.jpg",
    safeZone: { a: 655, b: 1118, c: 282, d: 993 }
  },
  gojo: {
    url: "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Gojo.jpeg",
    safeZone: { a: 660, b: 1180, c: 270, d: 990 }
  }
};

const CANVAS = { width: 1254, height: 1254 };

const TEXT_STYLE = {
  fontFamily: "Poppins",
  maxFontSize: 90,
  minFontSize: 22,
  lineHeight: 1.18,
  color: "#111111",
  align: "center"
};

const VIDEO_CONFIG = {
  outputFormat: "mp4",
  fast_progress: true,
  fps: 15,
  width: 512,
  height: 512,
  lyric: {
    maxWordPerLayer: 5,
    frameDuration: 0.7,
    lastFrameDuration: 1.5
  }
};

async function downloadBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Gagal download: ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .replace(/[,，]/g, " ")
    .split(/\s+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function splitIntoLayers(tokens, maxWordPerLayer) {
  if (!Number.isFinite(maxWordPerLayer) || maxWordPerLayer <= 0) {
    return [tokens];
  }
  const layers = [];
  for (let i = 0; i < tokens.length; i += maxWordPerLayer) {
    layers.push(tokens.slice(i, i + maxWordPerLayer));
  }
  return layers;
}

function resolveDurations(frames, lyric) {
  return frames.map((frame) => {
    return frame.isLastInLayer
      ? Math.max(0.05, lyric.lastFrameDuration)
      : Math.max(0.05, lyric.frameDuration);
  });
}

function buildRevealFrames(text, configObj) {
  const tokens = tokenize(text);
  const layers = splitIntoLayers(tokens, configObj.lyric.maxWordPerLayer);
  const frames = [];

  for (const layer of layers) {
    let current = "";
    for (let i = 0; i < layer.length; i++) {
      current += (current ? " " : "") + layer[i];
      frames.push({
        text: current,
        isLastInLayer: i === layer.length - 1
      });
    }
  }

  const durations = resolveDurations(frames, configObj.lyric);
  return frames.map((frame, index) => ({
    ...frame,
    duration: durations[index]
  }));
}

function getSafeRect(zone) {
  return {
    x: zone.c,
    y: zone.a,
    w: zone.d - zone.c,
    h: zone.b - zone.a,
    centerX: (zone.c + zone.d) / 2,
    centerY: (zone.a + zone.b) / 2
  };
}

function setFont(ctx, size) {
  ctx.font = `${size}px ${TEXT_STYLE.fontFamily}`;
}

function splitLongWord(ctx, word, maxWidth) {
  const chars = [...word];
  const parts = [];
  let current = "";

  for (const char of chars) {
    const test = current + char;
    if (ctx.measureText(test).width <= maxWidth || !current) {
      current = test;
    } else {
      parts.push(current);
      current = char;
    }
  }

  if (current) {
    parts.push(current);
  }
  return parts;
}

function wrapParagraph(ctx, paragraph, maxWidth) {
  const words = paragraph.split(" ").filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    if (ctx.measureText(word).width <= maxWidth) {
      current = word;
    } else {
      const parts = splitLongWord(ctx, word, maxWidth);
      lines.push(...parts.slice(0, -1));
      current = parts.at(-1) || "";
    }
  }

  if (current) {
    lines.push(current);
  }
  return lines;
}

function wrapText(ctx, text, maxWidth) {
  return text
    .split("\n")
    .flatMap((paragraph) => {
      const clean = paragraph.trim();
      if (!clean) {
        return [""];
      }
      return wrapParagraph(ctx, clean, maxWidth);
    });
}

function fitText(ctx, text, rect) {
  for (let size = TEXT_STYLE.maxFontSize; size >= TEXT_STYLE.minFontSize; size--) {
    setFont(ctx, size);
    const lineHeight = Math.ceil(size * TEXT_STYLE.lineHeight);
    const lines = wrapText(ctx, text, rect.w);
    const totalHeight = lines.length * lineHeight;

    if (totalHeight <= rect.h) {
      return { size, lines, lineHeight, totalHeight };
    }
  }

  const size = TEXT_STYLE.minFontSize;
  setFont(ctx, size);
  const lineHeight = Math.ceil(size * TEXT_STYLE.lineHeight);
  const lines = wrapText(ctx, text, rect.w);
  const maxLines = Math.max(1, Math.floor(rect.h / lineHeight));
  const clipped = lines.slice(0, maxLines);

  if (lines.length > maxLines && clipped.length) {
    let last = clipped[clipped.length - 1];
    while (last.length > 0 && ctx.measureText(`${last}...`).width > rect.w) {
      last = last.slice(0, -1);
    }
    clipped[clipped.length - 1] = `${last}...`;
  }

  return {
    size,
    lines: clipped,
    lineHeight,
    totalHeight: clipped.length * lineHeight
  };
}

function drawCenteredText(ctx, text, zone) {
  const rect = getSafeRect(zone);
  const fitted = fitText(ctx, text, rect);
  const startY = rect.y + (rect.h - fitted.totalHeight) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  setFont(ctx, fitted.size);
  ctx.fillStyle = TEXT_STYLE.color;
  ctx.textAlign = TEXT_STYLE.align;
  ctx.textBaseline = "top";

  fitted.lines.forEach((line, index) => {
    const y = startY + index * fitted.lineHeight;
    ctx.fillText(line, rect.centerX, y);
  });

  ctx.restore();
}

async function createBratImage(text, template) {
  if (!isFontLoaded) {
    const fontBuffer = await downloadBuffer(BRAT_FONT_URL);
    GlobalFonts.register(fontBuffer, TEXT_STYLE.fontFamily);
    isFontLoaded = true;
  }

  const imageBuffer = await downloadBuffer(template.url);
  const image = await loadImage(imageBuffer);
  const canvas = createCanvas(CANVAS.width, CANVAS.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(image, 0, 0, CANVAS.width, CANVAS.height);
  drawCenteredText(ctx, text, template.safeZone);

  return await canvas.encode("png");
}

async function createFrame(image, text, filePath, template) {
  const canvas = createCanvas(CANVAS.width, CANVAS.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(image, 0, 0, CANVAS.width, CANVAS.height);
  drawCenteredText(ctx, text, template.safeZone);

  fs.writeFileSync(filePath, await canvas.encode("png"));
}

function escapeConcatPath(filePath) {
  return filePath.replace(/'/g, "'\\''");
}

function buildManifest(frames, framePaths) {
  const lines = [];
  for (let i = 0; i < frames.length; i++) {
    lines.push(`file '${escapeConcatPath(framePaths[i])}'`);
    lines.push(`duration ${frames[i].duration}`);
  }
  lines.push(`file '${escapeConcatPath(framePaths[framePaths.length - 1])}'`);
  return lines.join("\n");
}

async function encodeVideo(concatPath, outputPath, configObj) {
  if (configObj.outputFormat !== "mp4") {
    throw new Error("Saat ini output hanya support mp4");
  }

  const args = [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concatPath,
    "-vf", `fps=${configObj.fps},scale=${configObj.width}:${configObj.height}:flags=lanczos`,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "32",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outputPath
  ];

  await execFileAsync("ffmpeg", args, { maxBuffer: 1024 * 1024 * 10 });
}

async function createBratVideo(text, template) {
  const frames = buildRevealFrames(text, VIDEO_CONFIG);
  if (!frames.length) {
    throw new Error("Teks kosong");
  }

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "bratvid-"));
  const outputPath = path.join(tmpDir, "output.mp4");

  try {
    if (!isFontLoaded) {
      const fontBuffer = await downloadBuffer(BRAT_FONT_URL);
      GlobalFonts.register(fontBuffer, TEXT_STYLE.fontFamily);
      isFontLoaded = true;
    }

    const imageBuffer = await downloadBuffer(template.url);
    const image = await loadImage(imageBuffer);

    const framePaths = frames.map((_, index) => {
      return path.join(tmpDir, `frame-${String(index + 1).padStart(4, "0")}.png`);
    });

    if (VIDEO_CONFIG.fast_progress) {
      const batchSize = 5;
      for (let start = 0; start < frames.length; start += batchSize) {
        const batch = frames.slice(start, start + batchSize);
        await Promise.all(batch.map((frame, i) => {
          const index = start + i;
          return createFrame(image, frame.text, framePaths[index], template);
        }));
      }
    } else {
      for (let i = 0; i < frames.length; i++) {
        await createFrame(image, frames[i].text, framePaths[i], template);
      }
    }

    const concatPath = path.join(tmpDir, "concat.txt");
    fs.writeFileSync(concatPath, buildManifest(frames, framePaths));

    await encodeVideo(concatPath, outputPath, VIDEO_CONFIG);

    const videoBuffer = fs.readFileSync(outputPath);
    return videoBuffer;
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => { });
  }
}

async function handler(m, { sock }) {
  const text = m.text;
  if (!text) {
    return m.reply(`⚠️ Harap masukkan teksnya!\nContoh: \`${m.prefix}${m.command} Halo semuanya\``);
  }

  await m.react("🕕");

  try {
    const cmd = m.command.toLowerCase();
    let template;
    let isVideo = false;

    if (cmd === "bratgojo") {
      template = TEMPLATES.gojo;
    } else if (cmd === "bratgojovid") {
      template = TEMPLATES.gojo;
      isVideo = true;
    } else if (cmd === "bratvermeil") {
      template = TEMPLATES.vermeil;
    } else if (cmd === "bratvermeilvid") {
      template = TEMPLATES.vermeil;
      isVideo = true;
    } else {
      throw new Error("Command tidak valid");
    }

    const inputText = normalizeText(text);

    if (isVideo) {
      const videoBuffer = await createBratVideo(inputText, template);
      const tempPath = path.join(os.tmpdir(), `bratvid-${Date.now()}.mp4`);
      fs.writeFileSync(tempPath, videoBuffer);

      await sock.sendVideoAsSticker(m.chat, tempPath, m, {
        packname: config.sticker.packname,
        author: config.sticker.author
      });

      try { fs.unlinkSync(tempPath); } catch (e) { }
    } else {
      const imageBuffer = await createBratImage(inputText, template);
      await sock.sendImageAsSticker(m.chat, imageBuffer, m, {
        packname: config.sticker.packname,
        author: config.sticker.author
      });
    }

    await m.react("✅");
  } catch (error) {
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── bratvid ──
const _bratvid = (() => {
const pluginConfig = {
    name: 'bratvid',
    alias: [],
    category: 'sticker',
    description: 'Membuat sticker brat animated',
    usage: '.bratvid <text>',
    example: '.bratvid Hai semua',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.args.join(' ')
    if (!text) {
        return m.reply(`🎬 *ʙʀᴀᴛ ᴀɴɪᴍᴀᴛᴇᴅ*\n\n> Masukkan teks\n\n\`Contoh: ${m.prefix}bratvid Hai semua\``)
    }
    
    m.react('🕕')
    
    try {
        const tempFile = path.join(os.tmpdir(), `brat-${Date.now()}.webp`)
        const url = await bratVid(text, {
            outputFormat: 'mp4',
        })
        await fs.promises.writeFile(tempFile, url)
        await sock.sendVideoAsSticker(m.chat, tempFile, m, {
            packname: config.sticker.packname,
            author: config.sticker.author
        })
        await fs.promises.unlink(tempFile)
        m.react('✅')
    } catch (error) {
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── bratvid2 ──
const _bratvid2 = (() => {
const pluginConfig = {
    name: 'bratvid2',
    alias: [],
    category: 'sticker',
    description: 'Generate brat video v2',
    usage: '.bratvid2 <text>',
    example: '.bratvid2 hello world',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.args.join(' ')
    
    if (!text) {
        return m.reply(`🎬 *ʙʀᴀᴛ ᴠɪᴅᴇᴏ ᴠ2*\n\n> Masukkan teks\n\n\`Contoh: ${m.prefix}bratvid2 hello world\``)
    }
    
    m.react('🕕')
    
    try {
        const url = `https://api-faa.my.id/faa/bratvid?text=${encodeURIComponent(text)}`
        await sock.sendVideoAsSticker(m.chat, url, m, {
            packname: config.sticker.packname,
            author: config.sticker.author
        })
        m.react('✅')
    } catch (error) {
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

export default mergePlugins(
    'sticker',
    _animebrat,
    _brat,
    _bratcewek,
    _bratextra,
    _bratgreen,
    _bratgura,
    _bratlocal,
    _bratvid,
    _bratvid2,
)
