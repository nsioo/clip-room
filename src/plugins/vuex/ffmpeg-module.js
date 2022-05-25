import ffbinaries from 'ffbinaries';
import EventEmitter from 'events';
import ffmpeg from '../../js/promise-ffmpeg';
import Directories from '../../js/Directories';
import VideoFile from '../../js/VideoFile';
import Vue from 'vue';
import path from 'path';
import fs from 'fs';
import Utils from '@/js/Utils';

export default {
  state: {
    paths: false,
    downloadEvent: new EventEmitter(),
    downloading: false,
    ffmpegReady: false,
    videoFileCache: {},
    cache: {
      filters: null,
      formats: null,
    },
  },
  mutations: {
    formatsCache: (state, formatsCache) => (state.cache.formats = formatsCache),
    filtersCache: (state, filters) => (state.cache.filters = filters),
    videoFileCache: (state, { path, file }) => Vue.set(state.videoFileCache, path, file),
  },
  getters: {
    earliestStart: (state, getters, rootState) => (video) =>
      video.duration *
      Math.max(...rootState.timeline.filter((f) => f.video === video).map((f) => f.start)),
      // 合并
      complexFilter: (state, getters, rootState) => {
      let fragments = rootState.timeline;
      const parseFilter = (subFilters) => subFilters.map((sf) => `${sf[0]}=${sf[1]}`).join(',');
      let filter = [];
      for (let i = 0; i < fragments.length; i++) {
        let fragment = fragments[i];
        let videoIndex = rootState.videoFiles.indexOf(fragment.video);
        let earliestStart = getters.earliestStart(fragment.video);
        let start = fragment.start * fragment.video.duration - earliestStart;
        let end = fragment.end * fragment.video.duration - earliestStart;
        console.log({ earliestStart, start, end });
        filter.push({
          filter: parseFilter([
            ['trim', `start=${start}:end=${end}`],
            ['setpts', `${1 / fragment.playbackRate}*(PTS-STARTPTS)`],
          ]),
          inputs: `[${videoIndex}:v]`,
          outputs: 'v' + i,
        });

        if (!fragment.video.hasAudio) {
          let duration = (end - start) / fragment.playbackRate;
          console.log('DURATION', duration);
          filter.push({
            filter: 'aevalsrc',
            options: { exprs: '0', duration },
            outputs: 'a' + i,
          });
          continue;
        }
        // Audio filters:

        let tempoCommands = [];
        let playbackRate = fragment.playbackRate;
        let minTempo = 0.5;
        while (true) {
          if (playbackRate < minTempo) {
            tempoCommands.push(['atempo', `0.5`]);
            playbackRate *= 2;
          } else {
            tempoCommands.push(['atempo', `${playbackRate}`]);
            break;
          }
        }

        // ffmpeg fillter command params
        filter.push({
          filter: parseFilter([
            ['atrim', `start=${start}:end=${end}`],
            ['asetpts', `PTS-STARTPTS`],
            ...tempoCommands,
            ['volume', `${fragment.volume}`],
          ]),
          inputs: `[${videoIndex}:a]`,
          outputs: 'a' + i,
        });
      }

      // concat video command
      filter.push({
        filter: 'concat',
        options: `n=${fragments.length}:a=1`,
        inputs: fragments.flatMap((f, i) => ['v' + i, 'a' + i]),
        outputs: ['out', 'outa'],
      });

      if (rootState.export.customResolution) {
        filter.push({
          inputs: 'out',
          filter: 'scale',
          options: {
            w: rootState.export.width,
            h: rootState.export.height,
            flags: 'bicubic',
          },
          outputs: 'out',
        });
      }
        
      if (rootState.export.fps !== '' && rootState.export.interpolate) {
        filter.push({
          inputs: 'out',
          filter: 'minterpolate',
          options: {
            fps: `${rootState.export.fps}`,
          },
          outputs: 'out',
        });
      } else if (rootState.export.fps !== '')
        filter.push({
          inputs: 'out',
          filter: 'fps',
          options: `${rootState.export.fps}`,
          outputs: 'out',
        });

      let outputs = new Set(['out', 'outa']);
      rootState.export.filters.forEach((f) => {
        if (f.input === 'audio' && f.output === 'video') {
          filter.push({
            inputs: 'out',
            filter: 'nullsink',
          });
          outputs.delete('outa');
        } else if (f.input === 'video' && f.output === 'audio') {
          outputs.delete('out');
          filter.push({
            inputs: 'outa',
            filter: 'nullsink',
          });
        }
        filter.push({
          inputs: 'out' + (f.input === 'audio' ? 'a' : ''),
          filter: f.name,
          options: f.options,
          outputs: 'out' + (f.output === 'audio' ? 'a' : ''),
        });
      });

      return [filter, [...outputs]];
    },
  },
  actions: {
    // 初始化 ffmpeg
    async initializeFfmpeg({ dispatch, state }) {
      await dispatch('getPaths');
      VideoFile.ffmpegPath = state.paths.ffmpeg;
      ffmpeg.setFfmpegPath(state.paths.ffmpeg);
      ffmpeg.setFfprobePath(state.paths.ffprobe);
      console.log('已检测到 ffmpeg & ffprobe: ', { ffmpeg });
      setTimeout(() => {
        state.ffmpegReady = true;
        state.downloadEvent.emit('ffmpegReady');
        dispatch('getFilters');
      }, 800);
    },
    // 重置状态
    resetExportStatus({ commit }) {
      commit('statusDone', false);
      commit('statusProgress', 0);
      commit('statusOutput', []);
      commit('statusError', '');
    },
    // 核心函数 - 导出视频
    async exportVideo({ dispatch, rootState, getters, commit }) {
      if (getters.isExporting) {
        dispatch('addSnack', {
          text: '一个导出任务正在进行中，请稍后再试',
        });
        return false;
      }

      return new Promise((resolve, reject) => {
        // 重置导出状态
        dispatch('resetExportStatus');
        // 显示导出进度条
        commit('showExportStatus', true);

        // 实例化 ffmpeg 对象
        let command = ffmpeg();
        commit('statusCommand', command);

        for (let video of rootState.videoFiles) {
          command = command
            .input(Utils.fixPath(video.filePath))
            .seekInput(getters.earliestStart(video));
        }

        // 执行导出命令
        command = command
          .complexFilter(...getters.complexFilter)
          .on('start', (commandLine) => {
            console.log('执行 ffmepg 命令: ', commandLine);
            commit('addStatusOutput', commandLine);
          })
          .on('stderr', (line) => commit('addStatusOutput', line))
          .on('progress', (progress) => commit('statusProgress', progress))
          .on('error', (err, stdout, stderr) => {
            commit('statusCommand', null);
            commit('statusError', err);
            reject(err);
          })
          .on('end', (stdout, stderr) => {
            commit('statusDone', true);
            commit('statusCommand', null);
            resolve(true);
          });

        if (rootState.export.bitrate !== '')
          command = command.videoBitrate(Math.round(rootState.export.bitrate * 1000) + 'k');
        command.saveToFile(rootState.export.outputPath);
      });
    },
    // 获取音量
    async getLoudness({}, { filePath, loudness = {} }) {
      return new Promise((resolve, reject) => {
        let min = Infinity,
          max = -Infinity;
        loudness.dbMin = -45; // 最小音量（分贝）
        loudness.dbMax = 0; // 最大音量（分贝）
        loudness.absLoudness = 0.8; // 绝对音量（分贝）
        loudness.data = [];
        let filter = [ // 音量计算过滤器
          {
            filter: 'ebur128',
            inputs: '[0:a]',
            options: 'peak=true',
            outputs: 'out',
          },
        ];

        ffmpeg()
          .input(Utils.fixPath(filePath))
          .complexFilter(filter, 'out')
          .on('error', (err, stdout, stderr) => {
            console.warn(`Error processing audio wave for ${filePath}`);
          })
          .on('stderr', (line) => {
            line = line.trim();
            if (line.startsWith('LRA low:'))
              loudness.low = +line.split(' ').filter((n) => n !== '')[2];
            if (line.startsWith('LRA high:'))
              loudness.high = +line.split(' ').filter((n) => n !== '')[2];
            if (line.startsWith('I:'))
              loudness.integrated = +line.split(' ').filter((n) => n !== '')[1];
            if (!line.startsWith('[Parsed_ebur128')) return;
            let time = line.split('t:')[1]?.trim()?.split(' ')?.[0];
            let m = line.split('M:')[1]?.trim()?.split(' ')?.[0];
            let tpk = line.split('TPK:')[1]?.trim()?.split(' ')?.[0];
            if (time !== undefined && m !== undefined) {
              let db = +tpk;
              loudness.data.push({
                time: +time,
                volume: Math.exp(db),
                db: db,
              });
              if (db < min) min = db;
              if (db > max) max = db;
            }
          })
          .on('end', () => {
            let absMin = -45;
            let absMax = 0;
            loudness.absLoudness = (loudness.integrated - absMin) / (absMax - absMin);
            loudness.dbMin = min;
            loudness.dbMax = max;
            resolve(loudness);
          })
          .format('null')
          .saveToFile('-');
      });
    },

    async getFilters({ state, dispatch, commit }) {
      if (state.cache.filters === null) commit('filtersCache', await dispatch('_getFilters'));
      return state.cache.filters;
    },
    // 格式化过滤器
    async _getFilters({}) {
      return new Promise((resolve, reject) => {
        ffmpeg.getAvailableFilters((err, filters) => {
          if (err) return reject(err);
          filters = Object.entries(filters)
            .filter(([_, v]) => !v.multipleOutputs && !v.multipleInputs)
            .map(([k, v]) => ({ name: k, ...v }));
          resolve(filters);
        });
      });
    },
    async getFormats({ state, commit, dispatch }) {
      if (state.cache.formats === null) commit('formatsCache', await dispatch('_getFormats'));
      return state.cache.formats;
    },
    // 格式化缓存
    async _getFormats({}) {
      return new Promise((resolve, reject) => {
        ffmpeg.getAvailableFormats((err, result) => {
          if (err) return reject(err);
          let formats = [];
          for (let extension in result) {
            if (!result.hasOwnProperty(extension)) continue;
            let { description, canMux, canDemux } = result[extension];
            if (canMux && canDemux) formats.push({ extension, description });
          }

          let mp4 = formats.splice(
            formats.findIndex((f) => f.extension === 'mp4'),
            1
          );
          formats.unshift(mp4[0]);
          formats = formats.map((format) => ({
            name: format.description,
            extensions: [format.extension],
          }));

          resolve(formats);
        });
      });
    },
    // 等待 ffmpeg 初始化完成
    async waitForFfmpeg({ state }) {
      return new Promise((resolve) => {
        if (state.ffmpegReady) resolve();
        state.downloadEvent.once('ffmpegReady', resolve);
      });
    },
    // 获取截图
    getImageFromUrl({}, url) {
      return new Promise((resolve, reject) => {
        let image = new Image();
        image.src = url;
        image.onload = () => resolve(image);
        image.onerror = reject;
      });
    },
    // 合并截图
    async mergeScreenshots({ dispatch }, paths) {
      if (paths.length === 0) return null;
      let canvas = document.createElement('canvas');
      let context = canvas.getContext('2d');
      let images = await Promise.all(paths.map((p) => dispatch('getImageFromUrl', p)));
      canvas.width = images.reduce((a, b) => a + b.width, 0);
      canvas.height = images[0].height;
      let x = 0;
      for (let image of images) {
        context.drawImage(image, x, 0);
        x += image.width;
      }

      return new Promise((resolve) => {
        // HTMLCanvasElement.toBlob() 方法创造 Blob 对象，用以展示 canvas 上的图片；
        // 这个图片文件可以被缓存或保存到本地（由用户代理自行决定）
        canvas.toBlob((b) => resolve(URL.createObjectURL(b)), 'image/jpg');
      });
    },
    // Func 1.2：获取视频信息
    async loadMetadata({ state, commit, dispatch }, file) {
      if (!state.videoFileCache.hasOwnProperty(file)) {
        console.log(`Loading metadata for ${file}`);

        // Wait for getPaths to be done
        await dispatch('waitForFfmpeg'); // 等待ffmpeg准备好
        // Fixed：C:\Users\24216\AppData\Roaming\cliproom-files\ 目录下缺少 ffmpeg.exe/ffprobe.exe/ffplay.exe
        let result = await ffmpeg.ffprobe(file); 
        let duration = result.format.duration; // 视频时长

        // 1 screenshot per minute
        let ssCount = Math.ceil(duration / 60); // 截图数量
        let promises = [];
        for (let i = 0; i < ssCount; i++) {
          let timeStamp = (duration / ssCount) * i; // 截图时间戳
          // 截图任务入栈
          promises.push(ffmpeg.screenshot(file, Directories.temp, timeStamp)); 
        }
        // 执行截图任务
        let screenshots = { all: [], merged: '' };
        Promise.all(promises).then(async (ss) => {
          screenshots.all.push(...ss);
          screenshots.merged = await dispatch('mergeScreenshots', ss); // 合并截图
        });

        // 获取音频
        let loudness = {};
        // 实例化视频文件对象
        let videoFile = new VideoFile(result, screenshots, loudness);
        dispatch('getLoudness', {
          filePath: file,
          loudness,
        }).then();
        // 存入缓存
        commit('videoFileCache', { path: file, file: videoFile });
      }
      return state.videoFileCache[file];
    },
    // 获取视频文件路径
    async getPaths({ state }) {
      const downloadDirectory = Directories.files;
      return new Promise(async (resolve) => {
        if (state.paths) return resolve(state.paths);
        if (state.downloading) return state.downloadEvent.once('downloaded', resolve);

        state.downloading = true;
        ffbinaries.downloadBinaries(
          ['ffmpeg', 'ffprobe'],
          { destination: downloadDirectory },
          () => {
            state.paths = {
              ffmpeg: path.join(
                downloadDirectory,
                ffbinaries.getBinaryFilename('ffmpeg', ffbinaries.detectPlatform())
              ),
              ffprobe: path.join(
                downloadDirectory,
                ffbinaries.getBinaryFilename('ffprobe', ffbinaries.detectPlatform())
              ),
            };
            resolve(state.paths);
            state.downloadEvent.emit('downloaded');
            state.downloading = false;
          }
        );
      });
    },
    // 等待文件解锁
    async waitForFileUnlock({ dispatch }, { filePath, timeout = 10000 }) {
      let startTime = performance.now();
      while (true) {
        if (performance.now() > startTime + timeout) throw 'Timeout waiting for file to unlock';
        let isFileLocked = await dispatch('isFileLocked', filePath);
        console.log('is file locked?', isFileLocked);
        if (!isFileLocked) return true;
        await Utils.waitSleep(150);
      }
    },
    // 检查文件是否被锁定
    async isFileLocked({ dispatch }, filePath) {
      return new Promise((resolve, reject) => {
        fs.open(filePath, 'r+', (err, fd) => {
          if (err && err.code === 'EBUSY') {
            resolve(true);
          } else if (err && err.code === 'ENOENT') {
            reject('File does not exist');
          } else {
            fs.close(fd, (err) => {
              if (err) return reject(err);
              resolve(false);
            });
          }
        });
      });
    },
  },
};
