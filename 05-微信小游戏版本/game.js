/**
 * WeChat Mini Game Entry Point (微信小游戏入口脚本)
 * Starlight Patisserie: Hoshi Kissa 3.0 Plan B
 */
'use strict';

const UI = require('./src/ui_draw');
UI.initGameFont('assets/fonts/kissa_round.ttf');

const { createApp } = require('./src/game_app');

createApp();
