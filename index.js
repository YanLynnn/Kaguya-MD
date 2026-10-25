/**

* Kaguya Multi Device — WhatsApp & Tele Bot
* 
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
* 
* Official Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
* 
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */


import './config.js'

import chalk from 'chalk'
import qrcodeTerminal from 'qrcode-terminal'
import { Boom } from '@hapi/boom'
import os from 'os'
import readline from 'readline'
import fs from 'fs'
import path from 'path'

import {
    useMultiFileAuthState,
    DisconnectReason
} from '@whiskeysockets/baileys'

import { initDatabase } from './lib/core-system.js'
import { cuteContent } from './lib/core-data.js'
import { startCoupleReminder, primaryPrefix } from './lib/plugin-engine.js'
import { followNewsletters } from './lib/core-system.js'
import { initLidOwners, sleep, formatWib } from './lib/core-system.js'
import { startPremiumReminder, startReminders, startSewaWatcher, onCall } from './lib/core-data.js'
import { createSocket, serialize, onGroupParticipants, richToText } from './lib/wa.js'
import { startTelegram } from './lib/telegram.js'
import { applyConfigChanges } from './lib/core-file.js'
import { invalidateMeta } from './lib/wa.js'
import { startOptimizer, startConnectionWatchdog, createFloodGuard, backoffDelay, rememberMessage, opt, createSendQueue } from './lib/core-system.js'


// ═══════════════ Banner RGB + ASCII random ═══════════════
const yangBacaHomo = [`
⠄⠄⠄⢰⣧⣼⣯⠄⣸⣠⣶⣶⣦⣾⠄⠄⠄⠄⡀⠄⢀⣿⣿⠄⠄⠄⢸⡇⠄⠄
⠄⠄⠄⣾⣿⠿⠿⠶⠿⢿⣿⣿⣿⣿⣦⣤⣄⢀⡅⢠⣾⣛⡉⠄⠄⠄⠸⢀⣿⠄
⠄⠄⢀⡋⣡⣴⣶⣶⡀⠄⠄⠙⢿⣿⣿⣿⣿⣿⣴⣿⣿⣿⢃⣤⣄⣀⣥⣿⣿⠄
⠄⠄⢸⣇⠻⣿⣿⣿⣧⣀⢀⣠⡌⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠿⠿⣿⣿⣿⠄
⠄⢀⢸⣿⣷⣤⣤⣤⣬⣙⣛⢿⣿⣿⣿⣿⣿⣿⡿⣿⣿⡍⠄⠄⢀⣤⣄⠉⠋⣰
⠄⣼⣖⣿⣿⣿⣿⣿⣿⣿⣿⣿⢿⣿⣿⣿⣿⣿⢇⣿⣿⡷⠶⠶⢿⣿⣿⠇⢀⣤
⠘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣽⣿⣿⣿⡇⣿⣿⣿⣿⣿⣿⣷⣶⣥⣴⣿⡗
⢀⠈⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡟⠄
⢸⣿⣦⣌⣛⣻⣿⣿⣧⠙⠛⠛⡭⠅⠒⠦⠭⣭⡻⣿⣿⣿⣿⣿⣿⣿⣿⡿⠃⠄
⠘⣿⣿⣿⣿⣿⣿⣿⣿⡆⠄⠄⠄⠄⠄⠄⠄⠄⠹⠈⢋⣽⣿⣿⣿⣿⣵⣾⠃⠄
⠄⠘⣿⣿⣿⣿⣿⣿⣿⣿⠄⣴⣿⣶⣄⠄⣴⣶⠄⢀⣾⣿⣿⣿⣿⣿⣿⠃⠄⠄
⠄⠄⠈⠻⣿⣿⣿⣿⣿⣿⡄⢻⣿⣿⣿⠄⣿⣿⡀⣾⣿⣿⣿⣿⣛⠛⠁⠄⠄⠄
⠄⠄⠄⠄⠈⠛⢿⣿⣿⣿⠁⠞⢿⣿⣿⡄⢿⣿⡇⣸⣿⣿⠿⠛⠁⠄⠄⠄⠄⠄
⠄⠄⠄⠄⠄⠄⠄⠉⠻⣿⣿⣾⣦⡙⠻⣷⣾⣿⠃⠿⠋⠁⠄⠄⠄⠄⠄⢀⣠⣴
⣿⣿⣿⣶⣶⣮⣥⣒⠲⢮⣝⡿⣿⣿⡆⣿⡿⠃⠄⠄⠄⠄⠄⠄⠄⣠⣴⣿⣿⣿
`, `
⣿⣿⣷⡁⢆⠈⠕⢕⢂⢕⢂⢕⢂⢔⢂⢕⢄⠂⣂⠂⠆⢂⢕⢂⢕⢂⢕⢂⢕⢂
⣿⣿⣿⡷⠊⡢⡹⣦⡑⢂⢕⢂⢕⢂⢕⢂⠕⠔⠌⠝⠛⠶⠶⢶⣦⣄⢂⢕⢂⢕
⣿⣿⠏⣠⣾⣦⡐⢌⢿⣷⣦⣅⡑⠕⠡⠐⢿⠿⣛⠟⠛⠛⠛⠛⠡⢷⡈⢂⢕⢂
⠟⣡⣾⣿⣿⣿⣿⣦⣑⠝⢿⣿⣿⣿⣿⣿⡵⢁⣤⣶⣶⣿⢿⢿⢿⡟⢻⣤⢑⢂
⣾⣿⣿⡿⢟⣛⣻⣿⣿⣿⣦⣬⣙⣻⣿⣿⣷⣿⣿⢟⢝⢕⢕⢕⢕⢽⣿⣿⣷⣔
⣿⣿⠵⠚⠉⢀⣀⣀⣈⣿⣿⣿⣿⣿⣿⣿⣿⣿⣗⢕⢕⢕⢕⢕⢕⣽⣿⣿⣿⣿
⢷⣂⣠⣴⣾⡿⡿⡻⡻⣿⣿⣴⣿⣿⣿⣿⣿⣿⣷⣵⣵⣵⣷⣿⣿⣿⣿⣿⣿⡿
⢌⠻⣿⡿⡫⡪⡪⡪⡪⣺⣿⣿⣿⣿⣿⠿⠿⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠃
⠣⡁⠹⡪⡪⡪⡪⣪⣾⣿⣿⣿⣿⠋⠐⢉⢍⢄⢌⠻⣿⣿⣿⣿⣿⣿⣿⣿⠏⠈
⡣⡘⢄⠙⣾⣾⣾⣿⣿⣿⣿⣿⣿⡀⢐⢕⢕⢕⢕⢕⡘⣿⣿⣿⣿⣿⣿⠏⠠⠈
⠌⢊⢂⢣⠹⣿⣿⣿⣿⣿⣿⣿⣿⣧⢐⢕⢕⢕⢕⢕⢅⣿⣿⣿⣿⡿⢋⢜⠠⠈
⠄⠁⠕⢝⡢⠈⠻⣿⣿⣿⣿⣿⣿⣿⣷⣕⣑⣑⣑⣵⣿⣿⣿⡿⢋⢔⢕⣿⠠⠈
⠨⡂⡀⢑⢕⡅⠂⠄⠉⠛⠻⠿⢿⣿⣿⣿⣿⣿⣿⣿⣿⡿⢋⢔⢕⢕⣿⣿⠠⠈
⠄⠪⣂⠁⢕⠆⠄⠂⠄⠁⡀⠂⡀⠄⢈⠉⢍⢛⢛⢛⢋⢔⢕⢕⢕⣽⣿⣿⠠⠈
`, `
⣿⡇⠘⡇⢀⣶⣶⠄⠈⣾⡟⢂⣿⣿⣿⣿⣿⣿⡿⢉⢾⢃⣿⣿⡟⣸⢸⣿⣿⣸
⣿⢸⣦⢧⢸⣿⣿⢱⠄⠄⣇⣼⣿⣿⣿⣿⣿⢟⣼⣿⡯⠸⣿⢳⢱⡏⣼⣿⢇⣿
⡏⣾⢽⣼⢸⣿⣿⡘⣆⢀⠛⣿⣿⣿⣿⡿⣫⣾⣿⣿⢇⣿⠂⢌⡾⡇⣿⡿⢸⣿
⢧⣿⠄⢹⢸⣿⣿⣷⣭⢸⡄⣿⣿⣿⢋⣵⣿⣿⡿⠟⡨⡡⠄⣾⣿⡆⣭⡇⣿⣿
⣼⡏⡀⠄⢀⢿⣿⣿⡟⣾⡇⣿⡿⣡⢁⣿⣿⣫⡶⢃⡵⣡⣿⣮⡻⡇⣿⢸⣮⢿
⣿⡇⣧⢠⠸⡎⡍⡭⢾⡏⣧⢋⢾⠏⣼⣿⣿⠿⣵⣾⣕⠿⣿⣿⣷⢡⠏⣾⣿⣿
⣿⠁⣿⠈⠄⠄⢃⢹⡀⠸⢸⢿⠸⢰⢻⢿⣟⢁⣀⠄⠄⠉⠒⢝⢿⠸⣴⣿⣿⣿
⡍⠇⣿⣷⢰⢰⢸⠄⡃⡆⠈⠈⡀⡌⠠⠸⠃⣿⣏⡳⢷⢄⡀⠄⠄⠰⣿⣿⣿⣿
⡇⠄⠸⣿⢸⣿⣶⡄⣇⠃⡇⡄⡇⠁⠃⠄⠈⢊⠻⠿⣿⣿⣿⣦⠄⠘⣿⣿⣿⣿
⡇⠄⠄⢻⣸⣿⣿⠏⡙⢸⣇⣡⢰⢀⠄⠄⠄⠈⡁⢱⢈⢿⣿⡿⡄⣰⣶⣿⣿⣿
⡇⠄⠄⠄⢻⣿⡿⢰⡇⠆⠲⠶⣝⠾⠸⢴⢠⠄⠇⢸⢸⠄⡶⡜⣽⣿⣿⣿⣿⢏
⠁⠄⠄⠄⠄⢿⡇⠧⢣⣸⣦⣄⣀⠁⠓⢸⣄⠸⢀⠄⡀⡀⡪⣽⣿⣿⢿⣿⢟⣬
⠄⠄⠄⠄⠄⠈⢧⠯⢸⣿⣿⣿⡿⠰⣷⠄⣿⣇⡿⠄⡀⠦⣰⣿⡿⣱⣿⡏⢾⣫
⠄⠄⠄⠄⠄⠄⠈⣌⢌⢿⣿⣿⠇⠼⢃⢠⢇⣻⣧⣿⡡⣸⣿⠿⢁⡟⢁⣳⣿⣿
⠄⠄⠄⠄⠄⠄⠄⠄⠳⢝⣒⣒⠰⣘⣴⡧⠿⣿⣛⡯⣱⡿⣫⢎⣪⣎⣿⣧⢻⠿
`, `
⣿⣯⣿⣟⣟⡼⣿⡼⡿⣷⣿⣿⣿⠽⡟⢋⣿⣿⠘⣼⣷⡟⠻⡿⣷⡼⣝⡿⡾⣿
⣿⣿⣿⣿⢁⣵⡇⡟⠀⣿⣿⣿⠇⠀⡇⣴⣿⣿⣧⣿⣿⡇⠀⢣⣿⣷⣀⡏⢻⣿
⣿⣿⠿⣿⣿⣿⠷⠁⠀⠛⠛⠋⠀⠂⠹⠿⠿⠿⠿⠿⠉⠁⠀⠘⠛⠛⠛⠃⢸⣯
⣿⡇⠀⣄⣀⣀⣈⣁⠈⠉⠃⠀⠀⠀⠀⠀⠀⠀⠀⠠⠎⠈⠀⣀⣁⣀⣀⡠⠈⠉
⣿⣯⣽⡿⢟⡿⠿⠛⠛⠿⣶⣄⠀⠀⠀⠀⠀⠀⠈⢠⣴⣾⠛⠛⠿⠻⠛⠿⣷⣶
⣿⣿⣿⠀⠀⠀⣿⡿⣶⣿⣫⠉⠀⠀⠀⠀⠀⠀⠀⠈⠰⣿⠿⠾⣿⡇⠀⠀⢺⣿
⣿⣿⠻⡀⠀⠀⠙⠏⠒⡻⠃⠀⠀⠀⠀⣀⠀⠀⠀⠀⠀⠐⡓⢚⠟⠁⠀⠀⡾⢫
⣿⣿⠀⠀⡀⠀⠀⡈⣉⡀⡠⣐⣅⣽⣺⣿⣯⡡⣴⣴⣔⣠⣀⣀⡀⢀⡀⡀⠀⣸
⣿⣿⣷⣿⣟⣿⡿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢻⢾⣷⣿
⣿⣿⣟⠫⡾⠟⠫⢾⠯⡻⢟⡽⢶⢿⣿⣿⡛⠕⠎⠻⠝⠪⢖⠝⠟⢫⠾⠜⢿⣿
⣿⣿⣿⠉⠀⠀⠀⠀⠈⠀⠀⠀⠀⣰⣋⣀⣈⣢⠀⠀⠀⠀⠀⠀⠀⠀⠀⣐⢸⣿
⣿⣿⣿⣆⠀⠀⠀⠀⠀⠀⠀⠀⢰⣿⣿⣿⣿⣿⣧⠀⠀⠀⠀⠀⠀⠀⠀⢀⣾⣿
⣿⣿⣿⣿⣦⡔⠀⠀⠀⠀⠀⠀⢻⣿⡿⣿⣿⢽⣿⠀⠀⠀⠀⠀⠀⠀⣠⣾⣿⣿
⣿⣿⣿⣿⣿⣿⣶⣤⣀⠀⠀⠀⠘⠛⢅⣙⣙⠿⠉⠀⠀⠀⢀⣠⣴⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣤⣄⣅⠀⠓⠀⠀⣀⣠⣴⣺⣿⣿⣿⣿⣿⣿⣿⣿
`, `
⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⣀⣠⣤⣶⣶⣶⣤⣄⣀⣀⠄⠄⠄⠄⠄
⠄⠄⠄⠄⠄⠄⠄⠄⣀⣤⣤⣶⣿⣿⣿⣿⣿⣿⣿⣟⢿⣿⣿⣿⣶⣤⡀⠄
⠄⠄⠄⠄⠄⠄⢀⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣜⠿⠿⣿⣿⣧⢓
⠄⠄⠄⠄⠄⡠⢛⣿⣿⣿⡟⣿⣿⣽⣋⠻⢻⣿⣿⣿⣿⡻⣧⡠⣭⣭⣿⡧
⠄⠄⠄⠄⠄⢠⣿⡟⣿⢻⠃⣻⣨⣻⠿⡀⣝⡿⣿⣿⣷⣜⣜⢿⣝⡿⡻⢔
⠄⠄⠄⠄⠄⢸⡟⣷⢿⢈⣚⣓⡡⣻⣿⣶⣬⣛⣓⣉⡻⢿⣎⠢⠻⣴⡾⠫
⠄⠄⠄⠄⠄⢸⠃⢹⡼⢸⣿⣿⣿⣦⣹⣿⣿⣿⠿⠿⠿⠷⣎⡼⠆⣿⠵⣫
⠄⠄⠄⠄⠄⠈⠄⠸⡟⡜⣩⡄⠄⣿⣿⣿⣿⣶⢀⢀⣿⣷⣿⣿⡐⡇⡄⣿
⠄⠄⠄⠄⠄⠄⠄⠄⠁⢶⢻⣧⣖⣿⣿⣿⣿⣿⣿⣿⣿⡏⣿⣇⡟⣇⣷⣿
⠄⠄⠄⠄⠄⠄⠄⠄⠄⢸⣆⣤⣽⣿⡿⠿⠿⣿⣿⣦⣴⡇⣿⢨⣾⣿⢹⢸
⠄⠄⠄⠄⠄⠄⠄⠄⠄⢸⣿⠊⡛⢿⣿⣿⣿⣿⡿⣫⢱⢺⡇⡏⣿⣿⣸⡼
⠄⠄⠄⠄⠄⠄⠄⠄⠄⢸⡿⠄⣿⣷⣾⡍⣭⣶⣿⣿⡌⣼⣹⢱⠹⣿⣇⣧
⠄⠄⠄⠄⠄⠄⠄⠄⠄⣼⠁⣤⣭⣭⡌⢁⣼⣿⣿⣿⢹⡇⣭⣤⣶⣤⡝⡼
⠄⣀⠤⡀⠄⠄⠄⠄⠄⡏⣈⡻⡿⠃⢀⣾⣿⣿⣿⡿⡼⠁⣿⣿⣿⡿⢷⢸
⢰⣷⡧⡢⠄⠄⠄⠄⠠⢠⡛⠿⠄⠠⠬⠿⣿⠭⠭⢱⣇⣀⣭⡅⠶⣾⣷⣶
⠈⢿⣿⣧⠄⠄⠄⠄⢀⡛⠿⠄⠄⠄⠄⢠⠃⠄⠄⡜⠄⠄⣤⢀⣶⣮⡍⣴
⠄⠈⣿⣿⡀⠄⠄⠄⢩⣝⠃⠄⠄⢀⡄⡎⠄⠄⠄⠇⠄⠄⠅⣴⣶⣶⠄⣶
`, `
⡏⠉⠉⠉⠉⠉⠉⠋⠉⠉⠉⠉⠉⠉⠋⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠙⠉⠉⠉⠹
⡇⢸⣿⡟⠛⢿⣷⠀⢸⣿⡟⠛⢿⣷⡄⢸⣿⡇⠀⢸⣿⡇⢸⣿⡇⠀⢸⣿⡇⠀
⡇⢸⣿⣧⣤⣾⠿⠀⢸⣿⣇⣀⣸⡿⠃⢸⣿⡇⠀⢸⣿⡇⢸⣿⣇⣀⣸⣿⡇⠀
⡇⢸⣿⡏⠉⢹⣿⡆⢸⣿⡟⠛⢻⣷⡄⢸⣿⡇⠀⢸⣿⡇⢸⣿⡏⠉⢹⣿⡇⠀
⡇⢸⣿⣧⣤⣼⡿⠃⢸⣿⡇⠀⢸⣿⡇⠸⣿⣧⣤⣼⡿⠁⢸⣿⡇⠀⢸⣿⡇⠀
⣇⣀⣀⣀⣀⣀⣀⣄⣀⣀⣀⣀⣀⣀⣀⣠⣀⡈⠉⣁⣀⣄⣀⣀⣀⣠⣀⣀⣀⣰
⣇⣿⠘⣿⣿⣿⡿⡿⣟⣟⢟⢟⢝⠵⡝⣿⡿⢂⣼⣿⣷⣌⠩⡫⡻⣝⠹⢿⣿⣷
⡆⣿⣆⠱⣝⡵⣝⢅⠙⣿⢕⢕⢕⢕⢝⣥⢒⠅⣿⣿⣿⡿⣳⣌⠪⡪⣡⢑⢝⣇
⡆⣿⣿⣦⠹⣳⣳⣕⢅⠈⢗⢕⢕⢕⢕⢕⢈⢆⠟⠋⠉⠁⠉⠉⠁⠈⠼⢐⢕⢽
⡗⢰⣶⣶⣦⣝⢝⢕⢕⠅⡆⢕⢕⢕⢕⢕⣴⠏⣠⡶⠛⡉⡉⡛⢶⣦⡀⠐⣕⢕
⡝⡄⢻⢟⣿⣿⣷⣕⣕⣅⣿⣔⣕⣵⣵⣿⣿⢠⣿⢠⣮⡈⣌⠨⠅⠹⣷⡀⢱⢕
⡝⡵⠟⠈⢀⣀⣀⡀⠉⢿⣿⣿⣿⣿⣿⣿⣿⣼⣿⢈⡋⠴⢿⡟⣡⡇⣿⡇⡀⢕
⡝⠁⣠⣾⠟⡉⡉⡉⠻⣦⣻⣿⣿⣿⣿⣿⣿⣿⣿⣧⠸⣿⣦⣥⣿⡇⡿⣰⢗⢄
⠁⢰⣿⡏⣴⣌⠈⣌⠡⠈⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣬⣉⣉⣁⣄⢖⢕⢕⢕
⡀⢻⣿⡇⢙⠁⠴⢿⡟⣡⡆⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣵⣵⣿
⡻⣄⣻⣿⣌⠘⢿⣷⣥⣿⠇⣿⣿⣿⣿⣿⣿⠛⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣷⢄⠻⣿⣟⠿⠦⠍⠉⣡⣾⣿⣿⣿⣿⣿⣿⢸⣿⣦⠙⣿⣿⣿⣿⣿⣿⣿⣿⠟
⡕⡑⣑⣈⣻⢗⢟⢞⢝⣻⣿⣿⣿⣿⣿⣿⣿⠸⣿⠿⠃⣿⣿⣿⣿⣿⣿⡿⠁⣠
⡝⡵⡈⢟⢕⢕⢕⢕⣵⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣶⣿⣿⣿⣿⣿⠿⠋⣀⣈⠙
⡝⡵⡕⡀⠑⠳⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠛⢉⡠⡲⡫⡪⡪⡣
`, `
⠄⣾⣿⡇⢸⣿⣿⣿⠄⠈⣿⣿⣿⣿⠈⣿⡇⢹⣿⣿⣿⡇⡇⢸⣿⣿⡇⣿⣿⣿
⢠⣿⣿⡇⢸⣿⣿⣿⡇⠄⢹⣿⣿⣿⡀⣿⣧⢸⣿⣿⣿⠁⡇⢸⣿⣿⠁⣿⣿⣿
⢸⣿⣿⡇⠸⣿⣿⣿⣿⡄⠈⢿⣿⣿⡇⢸⣿⡀⣿⣿⡿⠸⡇⣸⣿⣿⠄⣿⣿⣿
⢸⣿⡿⠷⠄⠿⠿⠿⠟⠓⠰⠘⠿⣿⣿⡈⣿⡇⢹⡟⠰⠦⠁⠈⠉⠋⠄⠻⢿⣿
⢨⡑⠶⡏⠛⠐⠋⠓⠲⠶⣭⣤⣴⣦⣭⣥⣮⣾⣬⣴⡮⠝⠒⠂⠂⠘⠉⠿⠖⣬
⠈⠉⠄⡀⠄⣀⣀⣀⣀⠈⢛⣿⣿⣿⣿⣿⣿⣿⣿⣟⠁⣀⣤⣤⣠⡀⠄⡀⠈⠁
⠄⠠⣾⡀⣾⣿⣧⣼⣿⡿⢠⣿⣿⣿⣿⣿⣿⣿⣿⣧⣼⣿⣧⣼⣿⣿⢀⣿⡇⠄
⡀⠄⠻⣷⡘⢿⣿⣿⡿⢣⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣜⢿⣿⣿⡿⢃⣾⠟⢁⠈
⢃⢻⣶⣬⣿⣶⣬⣥⣶⣿⣿⣿⣿⣿⣿⢿⣿⣿⣿⣿⣿⣷⣶⣶⣾⣿⣷⣾⣾⢣
⡄⠈⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡏⠘
⣿⡐⠘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⢠⢃
⣿⣷⡀⠈⠻⣿⣿⣿⣿⣿⣿⣿⣿⠿⠿⠿⠿⢿⣿⣿⣿⣿⣿⣿⣿⡿⠋⢀⠆⣼
⣿⣿⣷⡀⠄⠈⠛⢿⣿⣿⣿⣿⣷⣶⣶⣶⣶⣶⣿⣿⣿⣿⣿⠿⠋⠠⠂⢀⣾⣿
⣿⣿⣿⣧⠄⠄⢵⢠⣈⠛⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⢋⡁⢰⠏⠄⠄⣼⣿⣿
⢻⣿⣿⣿⡄⢢⠨⠄⣯⠄⠄⣌⣉⠛⠻⠟⠛⢋⣉⣤⠄⢸⡇⣨⣤⠄⢸⣿⣿⣿
`];

// ───────── rainbow RGB ─────────
function rainbow(i) {
    const f = 0.1
    return [
        Math.round(Math.sin(f * i + 0) * 127 + 128),
        Math.round(Math.sin(f * i + (2 * Math.PI) / 3) * 127 + 128),
        Math.round(Math.sin(f * i + (4 * Math.PI) / 3) * 127 + 128)
    ]
}

// Warnai teks per karakter, warna bergeser per baris (efek diagonal lolcat)
function rainbowText(text, seed = Math.random() * 256, spread = 3) {
    return String(text)
        .split('\n')
        .map((line, y) => {
            let out = ''
            let x = 0
            for (const ch of line) {
                if (ch === ' ') { out += ch; x++; continue }
                const [r, g, b] = rainbow(seed + (x + y * 2) / spread * 3)
                out += `\x1b[38;2;${r};${g};${b}m${ch}`
                x++
            }
            return out + '\x1b[0m'
        })
        .join('\n')
}

// pilih banner ASCII acak
function randomAscii() {
    return yangBacaHomo[Math.floor(Math.random() * yangBacaHomo.length)]
}

// ───────── filter log berisik libsignal ─────────
// libsignal nge-dump seluruh SessionEntry (key/buffer) tiap sesi ditutup/dibuka, dan
// mencetak stack trace penuh tiap pesan gagal didekripsi (Bad MAC). Itu bukan error fatal
// (biasanya pesan lama / kunci sesi lawan bicara sudah berganti), tapi kalau dibiarkan
// console panel penuh dan CPU ikut naik. Dibuang di sini, diganti ringkasan 1 baris.
const NOISY_LOGS = [
    'Closing session',
    'Opening session',
    'Removing old closed session',
    'Migrating session',
    'Session already closed',
    'Session already open',
    'Closing open session in favor of incoming prekey bundle'
]
// pola log gagal-dekripsi (ditampilkan ringkas, tidak spam)
const DECRYPT_LOGS = [
    'Failed to decrypt message with any known session',
    'Session error:',
    'Bad MAC'
]
let decryptFailCount = 0
let decryptFailLastShown = 0
for (const level of ['log', 'info', 'warn', 'error']) {
    const original = console[level].bind(console)
    console[level] = (...args) => {
        const first = args[0]
        if (typeof first === 'string') {
            if (NOISY_LOGS.some(t => first.includes(t))) return
            if (DECRYPT_LOGS.some(t => first.includes(t))) {
                decryptFailCount++
                const now = Date.now()
                if (now - decryptFailLastShown > 60_000) {
                    decryptFailLastShown = now
                    original(`[ SESSION ] ${decryptFailCount}x pesan gagal didekripsi (Bad MAC), log detail disembunyikan. Kalau terus berulang: hentikan bot, hapus folder session, lalu pairing ulang.`)
                    decryptFailCount = 0
                }
                return
            }
        }
        original(...args)
    }
}

// ═══════════════ Boot helpers (logger, QR terminal, setup) ═══════════════
// ───────── logger ─────────
function showLoadingLogs() {
    return new Promise((resolve) => {
        console.log(
            chalk.yellow('[ STARTING ] ') +
            chalk.white.bold(`Welcome In Terminal ${global.namebot || 'Bot'}!`)
        )

        setTimeout(() => {
            const text = `${randomAscii()}

Welcome to ${global.namebot || 'Bot'} - Powered by Node.js
--------------------------------------------

Operating System Information:
Platform : ${os.platform()}
Release : ${os.release()}
Architecture : ${os.arch()}
Hostname : ${os.hostname()}
Total Memory : ${(os.totalmem() / 1024 / 1024).toFixed(2)} MB
Free Memory : ${(os.freemem() / 1024 / 1024).toFixed(2)} MB
Uptime : ${os.uptime().toFixed(0)} Seconds

═══════════════════════════════════════════════
L O A D I N G . . .
`
            console.log(rainbowText(text))
            resolve()
        }, 1000)
    })
}

// ───────── qrTerminal ─────────
const isTTY = Boolean(process.stdout.isTTY)
const LOADING_TEXT = 'Loading qr code, tunggu sebentar'
const DOT_FRAMES = ['.', '..', '...']
const FRAME_INTERVAL = 400

const info = (text) => chalk.cyanBright(`[ INFO ] ${text}`)

let loadingTimer = null
let renderedLines = 0

// mulai animasi "Loading qr code"
function startQrLoading() {
    stopQrLoading()

    if (!isTTY) {
        console.log(info(`${LOADING_TEXT}...`))
        return
    }

    let frame = 0
    const draw = () => {
        const dots = DOT_FRAMES[frame++ % DOT_FRAMES.length].padEnd(3)
        process.stdout.write(`\r\x1b[2K${info(LOADING_TEXT + dots)}`)
    }

    draw()
    loadingTimer = setInterval(draw, FRAME_INTERVAL)
}

// hentikan animasi loading QR
function stopQrLoading() {
    if (!loadingTimer) return
    clearInterval(loadingTimer)
    loadingTimer = null
    process.stdout.write('\r\x1b[2K')
}

// hapus QR lama dari terminal
function clearQr() {
    stopQrLoading()
    if (!isTTY || !renderedLines) {
        renderedLines = 0
        return
    }
    process.stdout.write(`\x1b[${renderedLines}A\x1b[0J`)
    renderedLines = 0
}

// tampilkan QR login di terminal
function showQr(qr) {
    clearQr()

    qrcodeTerminal.generate(qr, { small: true }, (code) => {
        const block = `${code.replace(/\n$/, '')}\n${info('Scan lewat WhatsApp > Perangkat tertaut. QR berganti otomatis tiap beberapa detik.')}`
        console.log(block)
        renderedLines = block.split('\n').length
    })
}

// ───────── setup ─────────
const cyan = (t) => chalk.cyanBright.bold(t)
const yellow = (t) => chalk.yellowBright(t)
const magenta = (t) => chalk.magentaBright(t)
const white = (t) => chalk.white(t)
const greenBold = (t) => chalk.greenBright.bold(t)

let rl = null

// buat/ambil prompt input terminal
function getPrompt() {
    if (!rl) rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false })
    return rl
}

// tanya sesuatu ke user lewat terminal
function ask(question) {
    console.log(yellow(question))
    return new Promise(resolve => getPrompt().question('➜ ', (answer) => resolve(answer.trim())))
}

// tutup prompt input terminal
function closePrompt() {
    if (rl) {
        rl.close()
        rl = null
    }
}

const onlyDigits = (input) => input.replace(/[^0-9]/g, '')

// rapikan nomor HP jadi format 62xxx
function normalizeNumber(num) {
    return onlyDigits(num).replace(/^0/, '62')
}

// cetak kotak teks di terminal
function box(lines) {
    console.log(magenta('┌──────────────────────────────────────────┐'))
    for (let line of lines) console.log(magenta('│ ') + line)
    console.log(magenta('└──────────────────────────────────────────┘'))
}

const validNumber = (value) => value.length >= 8
const validText = (value) => value.length > 0

// langkah setup awal: nama bot, nomor bot, nomor owner, dll
const SETUP_STEPS = [
    {
        id: 'owners',
        question: 'Nomor WhatsApp Owner (ex: 628xxx):',
        isMissing: () => !Array.isArray(global.owners) || global.owners.length === 0,
        normalize: normalizeNumber,
        valid: validNumber,
        assign: (value) => { global.owners = [value] },
        change: (value) => ({ op: 'value', key: 'owners', value: [value] })
    },
    {
        id: 'ownername',
        question: 'Nama Owner:',
        isMissing: () => !String(global.ownername || '').trim(),
        normalize: (value) => value.trim(),
        valid: validText,
        assign: (value) => { global.ownername = value },
        change: (value) => ({ op: 'value', key: 'ownername', value })
    },
    {
        id: 'nomorbot',
        question: 'Nomor WhatsApp Bot (ex: 628xxx):',
        isMissing: () => !String(global.nomorbot || '').trim(),
        normalize: normalizeNumber,
        valid: validNumber,
        assign: (value) => { global.nomorbot = value },
        change: (value) => ({ op: 'value', key: 'nomorbot', value })
    }
]

// ulangi pertanyaan sampai jawaban valid
async function askUntilValid(step) {
    while (true) {
        const value = step.normalize(await ask(step.question))
        if (step.valid(value)) return value
        console.log(chalk.red('[ ! ] Jawaban gak valid atau kosong, coba lagi.'))
    }
}

// kumpulkan data owner saat pertama dijalankan
async function collectOwnerConfig() {
    const pending = SETUP_STEPS.filter(step => step.isMissing())
    if (!pending.length) return

    box([
        cyan('Lengkapi data'),
        white('Mulai dari melengkapi informasi dasar')
    ])

    const answers = []

    for (const step of pending) {
        answers.push({ step, value: await askUntilValid(step) })
    }

    answers.forEach(({ step, value }) => step.assign(value))

    const changes = answers.map(({ step, value }) => step.change(value))
    applyConfigChanges(changes)

    console.log(greenBold('[ OK ] Data setup tersimpan ke config.js\n'))
}

// pilih cara login: pairing code atau scan QR
async function chooseLinkMethod() {
    box([
        cyan('Pilih Metode Menautkan Perangkat'),
        white('1. Scan QR Code'),
        white('2. Pairing Code')
    ])

    let choice = await ask('Pilih metode (ketik 1 atau 2):')

    if (choice.trim() === '2') {
        return { method: 'pairing', number: normalizeNumber(global.nomorbot) }
    }

    return { method: 'qr' }
}

// ═══════════════ Main ═══════════════
console.clear()

process.on('uncaughtException', console.error)
process.on('unhandledRejection', (reason) => {
    // jangan cetak objek Promise (isinya besar & tidak berguna), cukup alasannya
    console.log(chalk.red('[ UNHANDLED REJECTION ]'), reason?.message || reason)
})

initDatabase()
startOptimizer()
// selfmode selalu mengikuti global.public (diatur di config.js atau lewat command .public / .self)
Object.defineProperty(global, 'selfmode', { get: () => global.public !== true, configurable: true })

// ═══════════════ Pilih platform (WhatsApp / Telegram) ═══════════════
// Urutan prioritas: argumen CLI > env PLATFORM > global.platforms di config.js.
// Keduanya berdiri sendiri: boleh hanya WhatsApp, hanya Telegram, atau dua-duanya.
const tgToken = () => String(process.env.TELEGRAM_TOKEN || global.telegram?.token || '').trim()

// tentukan platform aktif (WhatsApp / Telegram / keduanya)
function resolvePlatforms() {
    const want = { wa: global.platforms?.whatsapp !== false, tg: global.platforms?.telegram !== false }
    const apply = (v) => {
        v = String(v || '').toLowerCase().replace(/^--/, '')
        if (['wa', 'whatsapp'].includes(v)) { want.wa = true; want.tg = false; return true }
        if (['tg', 'telegram'].includes(v)) { want.wa = false; want.tg = true; return true }
        if (['both', 'all'].includes(v)) { want.wa = true; want.tg = true; return true }
        return false
    }
    const fromCli = process.argv.slice(2).some(apply)
    if (!fromCli) apply(process.env.PLATFORM)

    if (want.tg && !tgToken()) {
        console.log(chalk.yellow('[ TELEGRAM ] Token kosong, Telegram dilewati. Isi global.telegram.token di config.js atau env TELEGRAM_TOKEN.'))
        want.tg = false
    }
    if (!want.wa && !want.tg) {
        console.log(chalk.red('[ ! ] Tidak ada platform yang aktif. Aktifkan WhatsApp atau isi token Telegram di config.js.'))
        process.exit(1)
    }
    return want
}

// hasil platform aktif
const PLATFORM = resolvePlatforms()

const blue = (t) => chalk.cyanBright(t)
const green = (t) => chalk.greenBright(t)
const red = (t) => chalk.red(t)

let linkMethod = null
let linkNumber = null

let notifiedOnce = false
// kirim pesan "bot tersambung" ke owner (sekali saja)
async function notifyConnected(sock) {
    // jangan kirim ulang tiap reconnect: pesan berulang ke nomor sendiri ikut menambah trafik
    if (notifiedOnce) return
    notifiedOnce = true
    try {
        const botJid = sock.decodeJid(sock.user?.id) || `${global.nomorbot}@s.whatsapp.net`
        const text =
            `[  !  ] *${global.namebot}* berhasil tersambung.\n\n` +
            `Waktu : ${formatWib(Date.now())}\n` +
            `Ketik .menu untuk melihat fitur.`

        await sock.sendMessage(botJid, { text })
    } catch (e) {
        console.log(red(`[ ERROR ] Gagal kirim pesan tersambung ke nomor bot: ${e.message}`))
    }
}

// banner + setup awal, dijalankan sekali walau WhatsApp & Telegram start bersamaan
let bootPromise = null
// jalankan startup sekali saja (anti dobel)
const boot = () => bootPromise ||= (async () => {
    await showLoadingLogs()
    // data setup (nomor owner/bot) hanya relevan untuk WhatsApp
    if (PLATFORM.wa) await collectOwnerConfig()
})()

// folder penyimpanan sesi WhatsApp
const SESSION_DIR = 'session'
let currentSock = null
let reconnectTimer = null

// status koneksi, dipantau watchdog supaya bot pulih sendiri kalau macet
const conn = { state: 'closed', since: Date.now(), attempts: 0, halted: false }
// ubah status koneksi
const setConn = (state) => { conn.state = state; conn.since = Date.now() }

// penjaga banjir pesan (anti flood)
const onFlood = createFloodGuard()
// ubah timestamp pesan jadi detik
const toSec = (t) => (typeof t === 'number' ? t : t?.toNumber ? t.toNumber() : Number(t) || 0)

// watchdog hanya untuk koneksi WhatsApp (kalau WhatsApp dimatikan, jangan menyalakannya lagi)
if (PLATFORM.wa) startConnectionWatchdog({
    getState: () => ({
        state: conn.state,
        since: conn.since,
        sock: currentSock,
        registered: !!currentSock?.authState?.creds?.registered,
        reconnectPending: !!reconnectTimer,
        halted: conn.halted
    }),
    onStuck: async () => {
        closeSocket(currentSock)
        currentSock = null
        setConn('closed')
        scheduleRestart(0)
    }
})

// tutup socket lama dengan aman
function closeSocket(sock) {
    if (!sock) return
    try { sock.ev.removeAllListeners('connection.update') } catch {}
    try { sock.ev.removeAllListeners('messages.upsert') } catch {}
    try { sock.ev.removeAllListeners('group-participants.update') } catch {}
    try { sock.ev.removeAllListeners('groups.update') } catch {}
    try { sock.ev.removeAllListeners('creds.update') } catch {}
    try { sock.end(undefined) } catch {}
}

// jadwalkan sambung ulang setelah jeda tertentu
function scheduleRestart(delay = 0) {
    if (reconnectTimer) return
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        startBot().catch(e => {
            console.log(red(`[ ERROR ] Gagal menyambung ulang: ${e.message}`))
            setConn('closed')
            scheduleRestart(backoffDelay(conn.attempts++))
        })
    }, delay)
}

// inti: buat socket, pasang event pesan/koneksi/grup, handle login & reconnect
async function startBot() {
    await boot()

    // pastikan socket lama benar-benar mati sebelum bikin yang baru
    closeSocket(currentSock)
    currentSock = null

    const { handler } = await import('./handler.js')
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
    setConn('connecting')
    let sock = await createSocket(state)
    currentSock = sock
    global.sock = sock // dipakai plugin yang jalan sendiri (mis. auto promosi)

    // catat id pesan yang dikirim bot supaya tidak diproses ulang sebagai perintah
    global.botSentIds = global.botSentIds || new Set()
    const track = (id) => {
        if (!id) return
        global.botSentIds.add(id)
        if (global.botSentIds.size > 1000) global.botSentIds.delete(global.botSentIds.values().next().value)
    }
    const rawSend = sock.sendMessage.bind(sock)
    const enqueue = createSendQueue()
    const selfJid = () => sock.decodeJid(sock.user?.id)
    sock.sendMessage = async (jid, content, options) => {
        cuteContent(content)
        // pesan ke diri sendiri, status, dan edit/hapus/reaksi ringan tidak perlu ditahan
        const light = jid === selfJid() || jid === 'status@broadcast' || !!(content && (content.edit || content.delete || content.react))
        const sent = await enqueue(jid, () => rawSend(jid, content, options), { skip: light })
        track(sent?.key?.id)
        rememberMessage(sent?.key?.id, sent?.message)
        return sent
    }
    const rawRelay = sock.relayMessage?.bind(sock)
    if (rawRelay) {
        sock.relayMessage = async (jid, message, opts = {}) => {
            track(opts?.messageId)
            rememberMessage(opts?.messageId, message)
            return rawRelay(jid, message, opts)
        }
    }

    let latestQr = null

    sock.ev.on('creds.update', saveCreds)

    // Semua pesan dalam batch diproses (dulu hanya messages[0]), paralel antar pesan,
    // dan backlog lama setelah bot offline dilewati supaya tidak terjadi badai balasan.
    sock.ev.on('messages.upsert', ({ messages, type }) => {
        if (type !== 'notify') return
        const maxAge = opt().maxMsgAgeSec
        const now = Math.floor(Date.now() / 1000)

        for (const raw of messages || []) {
            if (!raw?.key) continue
            const chat = raw.key.remoteJid || 'unknown'

            // story/status: diabaikan (auto lihat/react story dimatikan karena berisiko ban)
            if (chat === 'status@broadcast') continue

            const ts = toSec(raw.messageTimestamp)
            if (ts && maxAge && now - ts > maxAge) continue

            onFlood(chat, async () => {
                try {
                    await handler(sock, serialize(sock, raw))
                } catch (e) {
                    console.log(red(`[ ERROR ] messages.upsert: ${e.message}`))
                }
            })
        }
    })

    sock.ev.on('group-participants.update', (update) => {
        invalidateMeta(update?.id)
        onGroupParticipants(sock, update)
    })

    sock.ev.on('call', (calls) => { onCall(sock, calls).catch(() => {}) }) // anti-call (.anticall)

    sock.ev.on('groups.update', (updates) => {
        for (const u of updates || []) invalidateMeta(u?.id)
    })

    sock.ev.on('connection.update', async (update) => {
        // abaikan event dari socket lama
        if (sock !== currentSock) return

        const { connection, lastDisconnect, qr } = update

        if (qr && !sock.authState.creds.registered) {
            latestQr = qr
            if (linkMethod === 'qr') showQr(qr)
        }

        if (connection === 'close') {
            clearQr()
            setConn('closed')
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
            console.log(red(`[ KONEKSI ] Terputus (${reason})`))

            closeSocket(sock)
            currentSock = null

            if (reason === DisconnectReason.loggedOut) {
                // session sudah tidak valid -> hapus biar pairing ulang bersih
                console.log(red('[ LOGOUT ] Session logout/tidak valid, menghapus folder session...'))
                try { fs.rmSync(path.resolve(SESSION_DIR), { recursive: true, force: true }) } catch {}
                linkMethod = null
                scheduleRestart(2000)
            } else if (reason === DisconnectReason.forbidden || reason === 403) {
                // akun dibatasi/diblokir WhatsApp: reconnect berulang hanya memperburuk keadaan
                console.log(red('[ BANNED? ] WhatsApp menolak akun ini (403). Bot dihentikan agar tidak mencoba berulang.'))
                console.log(red('             Buka WhatsApp di HP: cek apakah ada pesan pembatasan / "Minta peninjauan", tunggu beberapa jam, lalu jalankan ulang.'))
                conn.halted = true
            } else if (reason === DisconnectReason.connectionReplaced) {
                // ada instance lain yang pakai session yang sama; jangan rebutan
                console.log(red('[ KONEKSI ] Session dipakai instance lain (440). Matikan instance lain lalu restart bot.'))
                conn.halted = true // jangan rebutan session; watchdog ikut berhenti
            } else {
                console.log(blue('[ RECONNECT ] Menyambungkan ulang...'))
                // 515 = restart wajib setelah pairing, langsung sambung tanpa jeda
                scheduleRestart(reason === DisconnectReason.restartRequired ? 0 : backoffDelay(conn.attempts++))
            }
        }

        if (connection === 'open') {
            clearQr()
            conn.attempts = 0
            conn.halted = false
            setConn('open')
            console.log(green('[ SUCCESS ] Bot berhasil terhubung'))
            await sleep(5000)
            if (sock !== currentSock) return
            await initLidOwners(sock)
            followNewsletters(sock).catch(() => {})
            startPremiumReminder(() => global.sock)
            startReminders(() => global.sock)
            startSewaWatcher(() => global.sock)
            startCoupleReminder(() => global.sock)
            await notifyConnected(sock)
        }
    })

    if (!sock.authState.creds.registered) {
        if (!linkMethod) {
            const link = await chooseLinkMethod()
            linkMethod = link.method
            linkNumber = link.number
        }

        if (linkMethod === 'pairing') {
            console.log(blue('[ INFO ] Mengirim permintaan pairing code...'))
            try {
                // tunggu websocket siap dulu supaya request pairing tidak gagal
                await sleep(3000)
                const code = await sock.requestPairingCode(linkNumber, global.paircode)
                console.log(green(`[ KODE PAIRING ] ${code}`))
            } catch (e) {
                console.log(red('[ ERROR ] Gagal mendapatkan pairing code'))
                console.log(red(e))
            }
        } else if (latestQr) {
            showQr(latestQr)
        } else {
            startQrLoading()
        }
    }

    closePrompt()
}

// ═══════════════ Telegram ═══════════════
let tgBot = null

// log khusus Telegram
const tgLog = (level, msg) => {
    const color = level === 'error' ? red : level === 'warn' ? chalk.yellow : level === 'ok' ? green : blue
    console.log(color(`[ TELEGRAM ] ${msg}`))
}

// kirim notifikasi Telegram tersambung ke owner
async function notifyTelegramConnected(sock) {
    const text = `[  !  ] ${global.namebot || 'Bot'} berhasil tersambung di Telegram.\n\nWaktu : ${formatWib(Date.now())}\nKetik /menu untuk melihat fitur.`
    for (const id of [].concat(global.telegram?.owners || []).filter(Boolean)) {
        // owner harus sudah pernah /start ke bot, kalau belum Telegram menolak (diabaikan)
        await sock.sendMessage(`${String(id).replace(/\D/g, '')}@telegram`, { text }).catch(() => null)
    }
}

// jalankan bot Telegram (lib/telegram.js) dan sambungkan ke handler
async function startTelegramPlatform() {
    try {
        await boot()
        const { handler } = await import('./handler.js')
        tgBot = await startTelegram({
            token: tgToken(),
            handler,
            schedule: onFlood,
            prefix: () => primaryPrefix(),
            helpers: { richToText },
            log: tgLog
        })
        global.tgSock = tgBot.sock
        // mode Telegram saja: plugin yang memakai global.sock (restart, lock, dst) ikut memakai sock Telegram
        if (!PLATFORM.wa) global.sock = tgBot.sock
        await notifyTelegramConnected(tgBot.sock)
    } catch (e) {
        tgLog('error', `Gagal menyambung: ${e.message}`)
        if (!PLATFORM.wa) process.exit(1) // tidak ada platform lain yang jalan
    }
}

// ═══════════════ Jalankan platform yang aktif ═══════════════
console.log(blue(`[ PLATFORM ] ${[PLATFORM.wa && 'WhatsApp', PLATFORM.tg && 'Telegram'].filter(Boolean).join(' + ')}`))
if (PLATFORM.wa) startBot()
if (PLATFORM.tg) startTelegramPlatform()
