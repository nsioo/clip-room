import path from 'path';
import Vue from 'vue';
import Vuex from 'vuex';
import Vuetify from '../vuetify';

import electron from './electron-module';
import ffmpeg from './ffmpeg-module';
import command from './command-module';
import auth from './auth-module';

import VideoFragment from '@/js/VideoFragment';
import SetStartPoint from '@/js/commands/SetStartPoint';
import SetEndPoint from '@/js/commands/SetEndPoint';
import SplitFragment from '@/js/commands/SplitFragment';
import AddFragment from '@/js/commands/AddFragment';
import DeleteFragment from '@/js/commands/DeleteFragment';
import MoveFragment from '@/js/commands/MoveFragment';
import SetPlaybackRate from '@/js/commands/SetPlaybackRate';
import SetVolume from '@/js/commands/SetVolume';
import Directories from '@/js/Directories';
import DuplicateFragment from '@/js/commands/DuplicateFragment';
import Utils from '@/js/Utils';

Directories.importLSFile();

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    exportStatus: {
      done: false, // 是否导出完成
      show: false, // 是否显示导出状态
      progress: 0, // 导出进度
      output: [], // 导出输出
      error: '', // 导出错误
      command: null, // 导出命令
    },
    export: { // 导出视频信息
      filters: [], // 导出过滤器
      showDialog: false, // 是否显示导出对话框
      fps: '', // 导出帧率
      interpolate: false, // 是否导出插值
      bitrate: '', // 导出码率
      customResolution: false, // 是否自定义分辨率
      width: 2560, // 分辨率宽
      height: 1440, // 分辨率高
      outputPath: '', // 导出输出路径
    },
    windowWidth: window.innerWidth, // 窗口宽度
    projectFilePath: '', // 项目文件路径
    snackbars: [], // 蛇形框
    timeline: [], // 时间轴
    videosContainer: null, // 视频容器
    videoFiles: [], // 视频文件列表
    showContextMenu: false, // 显示上下菜单
    activeFragment: null, // 当前选择片段
    loading: {
      videoImport: false, // 视频导入加载
      projectImport: false, // 项目导入加载
    },
    configTimeline: { // 时间轴配置
      minFragmentWidth: 90, // 最小片段宽度
      widthPerSecond: +(localStorage.getItem('widthPerSecond') ?? 3.5), // 每秒宽度
    },
    player: { // 底部播放器控件
      widthPercent: +(localStorage.getItem('playerWidth') ?? 0.5), // 宽度百分比
      progress: 0, // 进度
      volume: +(localStorage.getItem('playerVolume') ?? 1), // 音量
      playing: false, // 播放状态
      fullscreen: false, // 全屏
    },
  },
  mutations: {
    removeExportFilter: (state, filter) =>
      state.export.filters.splice(state.export.filters.indexOf(filter), 1), // 删除导出筛选器
    addExportFilter: (state, filter) => state.export.filters.push(filter), // 添加导出筛选器 
    exportFilters: (state, filters) => (state.export.filters = filters), // 导出筛选器
    exportOutputPath: (state, outputPath) => (state.export.outputPath = outputPath), // 输出路径
    customHeight: (state, height) => (state.export.height = height), // 自定义分辨率高
    customWidth: (state, width) => (state.export.width = width), // 自定义分辨率宽
    showExportDialog: (state, value) => (state.export.showDialog = value), // 显示导出对话框

    // 状态命令
    statusCommand: (state, command) => (state.exportStatus.command = command), // 导出状态命令
    statusDone: (state, value) => (state.exportStatus.done = value), // 导出状态完成
    statusProgress: (state, value) => (state.exportStatus.progress = value), // 导出状态进度
    addStatusOutput: (state, value) => state.exportStatus.output.push(value), // 导出状态输出
    statusOutput: (state, value) => (state.exportStatus.output = value),   // 导出状态输出
    statusError: (state, value) => (state.exportStatus.error = value), // 导出状态错误
    showExportStatus: (state, value) => (state.exportStatus.show = value), // 显示导出状态

    timeline: (state, fragments) => (state.timeline = fragments), // 时间轴
    projectFilePath: (state, p) => { // 项目文件路径
      state.projectFilePath = p;
    },
    fullscreen: (state, value) => (state.player.fullscreen = value), // 全屏
    showContextMenu: (state, value) => (state.showContextMenu = value), // 显示上下菜单
    windowWidth: (state, value) => (state.windowWidth = value), // 窗口宽度
    importVideoLoading: (state, value) => (state.loading.videoImport = value), // 视频导入加载
    importProjectLoading: (state, value) => (state.loading.projectImport = value), // 项目导入加载
    videosContainer: (state, container) => { // 视频容器
      state.videosContainer = container;
      state.videoFiles.forEach((v) => {
        v.container = container;
        v._elCache = null;
      });
    },
    addSnackObject: (state, snack) => state.snackbars.push(snack), // 添加蛇形框
    removeSnack: (state, snack) => state.snackbars.splice(state.snackbars.indexOf(snack), 1), // 删除蛇形框
    moveFragment: (state, { fragment, newIndex }) => { // 移动片段
      let index = state.timeline.indexOf(fragment);
      if (index === -1) return;
      state.timeline.splice(index, 1);
      state.timeline.splice(newIndex, 0, fragment);
    },
    removeFromTimeline: (state, removedFragment) => { // 从时间轴中移除片段
      let index = state.timeline.indexOf(removedFragment);
      if (index === -1) return;
      state.timeline.splice(index, 1);
      let keepVideo = false;
      for (let fragment of state.timeline) {
        if (fragment.video === removedFragment.video) {
          keepVideo = true;
          break;
        }
      }
      if (!keepVideo) {
        state.videoFiles.splice(state.videoFiles.indexOf(removedFragment.video), 1);
      }
      if (state.activeFragment === removedFragment) {
        if (state.timeline.length === 0) {
          state.activeFragment = null;
        } else {
          let newIndex = Math.min(state.timeline.length - 1, Math.max(0, index - 1));
          state.activeFragment = state.timeline[newIndex];
          state.activeFragment.reset();
        }
      }
    },
    addToTimeline: (state, { fragment, index }) => { // 在时间轴中添加片段
      if (!state.videoFiles.includes(fragment.video)) {
        fragment.video.container = state.videosContainer;
        state.videoFiles.push(fragment.video);
      }
      if (index === undefined) state.timeline.push(fragment);
      else state.timeline.splice(index, 0, fragment);
      if (state.activeFragment === null) state.activeFragment = fragment;
    },
    activeFragment: (state, fragment) => { // 当前选中片段
      state.activeFragment = fragment;
    },
    videoFiles: (state, videoFiles) => (state.videoFiles = videoFiles), // 视频文件
    progress: (state, progress) => (state.player.progress = progress), // 进度
    playing: (state, playing) => (state.player.playing = playing), // 播放中
    playerWidth: (state, percent) => 
      (state.player.widthPercent = localStorage.playerWidth = Utils.clamp(percent, 0.1, 0.9)), // 播放器宽度
    playerVolume: (state, volume) =>
      (state.player.volume = localStorage.playerVolume = Utils.clamp(volume)),  // 播放器音量
    widthPerSecond: (state, pixels) =>
      (state.configTimeline.widthPerSecond = localStorage.widthPerSecond = pixels), // 每秒宽度
  },
  getters: {
    isAudio: (state) => 
      ['mp3', 'wav', 'ogg'].includes(state.activeFragment.video.probe.format.format_name), // 是否音频
    isExporting: (state) => state.exportStatus.command !== null, // 是否正在导出
    exportProgress: (state, getters) => { // 获取导出进度
      let time = state.exportStatus.progress.timemark;
      if (typeof time !== 'string') return 0;
      let [h, m, s] = time.split(':').map((n) => +n);
      let seconds = s + m * 60 + h * 3600;
      return Utils.clamp(seconds / getters.fullDuration);
    },
    projectFileName: (state) => path.basename(state.projectFilePath), // 项目文件名
    scale: (state) => { // 缩放
      switch (true) {
        case state.windowWidth > 1100:
          return 4;
        case state.windowWidth > 900:
          return 3;
        case state.windowWidth > 700:
          return 2;
        case state.windowWidth > 400:
          return 1;
        default:
          return 0;
      }
    },
    themeColors() { // 主题颜色
      return Vuetify.framework.theme.themes[Vuetify.framework.theme.isDark ? 'dark' : 'light'];
    },
    timelineVideos: (state) => { // 时间轴视频
      let videos = new Set();
      for (let { video } of state.timeline) videos.add(video);
      return [...videos];
    },
    progressAtFragmentProgress: 
      (state, getters) =>
      ({ fragment, progress }) => {
        let timeBefore = state.timeline
          .slice(0, state.timeline.indexOf(fragment))
          .reduce((a, b) => a + b.adjustedDuration, 0);
        let fragmentPart = fragment.adjustedDuration / getters.fullDuration;
        return Utils.clamp(timeBefore / getters.fullDuration + fragmentPart * progress);
      }, // 获取片段进度
    fragmentAtProgress: (state, getters) => (progress) => { // 获取片段
      let fullDuration = getters.fullDuration;
      let beforeParts = 0;
      for (let fragment of state.timeline) {
        let fragmentPart = fragment.adjustedDuration / fullDuration;
        if (beforeParts + fragmentPart >= progress) {
          let fragmentProgress = (progress - beforeParts) / fragmentPart;
          let fragmentCut = fragment.end - fragment.start;
          return {
            fragment,
            videoProgress: Utils.clamp(fragment.start + fragmentProgress * fragmentCut),
            fragmentProgress: Utils.clamp(fragmentProgress),
          };
        }
        beforeParts += fragmentPart;
      }
      return null;
    },
    // 总播放时长 
    fullDuration: (state) => {
      let d = state.timeline.reduce((a, b) => a + b.adjustedDuration, 0);
      return isNaN(d) ? 0 : d;
    },
    // 时间格式化
    toHms: () => (seconds) => {
      if (isNaN(seconds)) return `00:00.00`;
      let hms = new Date(seconds * 1000).toISOString().substr(11, 11);
      if (hms.startsWith('00')) return hms.substr(3);
      return hms;
    },
    // 播放进度
    computedProgress: (state, getters) => getters.fragmentAtProgress(state.player.progress),
    // 可左移片段
    canMoveLeft: (state) => state.timeline.indexOf(state.activeFragment) > 0,
    // 可右移片段
    canMoveRight: (state) =>
      state.timeline.indexOf(state.activeFragment) < state.timeline.length - 1,
    // 可向左拉时间轴
    canSkipFrameLeft: (state) => state.player.progress > 0,
    // 可向右拉时间轴
    canSkipFrameRight: (state) => state.player.progress < 1,
    // 可剪切片段于某点
    canCutAt: (state, getters) => (progress) => {
      let v = getters.fragmentAtProgress(progress)?.fragmentProgress;
      return v > 0 && v < 1;
    },
    // 可剪切片段
    canCut: (state, getters) =>
      getters.computedProgress?.fragmentProgress > 0 &&
      getters.computedProgress?.fragmentProgress < 1,
  },
  actions: {
    // 初始化 ffmpeg
    async initialize({ dispatch }) {
      await dispatch('initializeFfmpeg');
      // await dispatch('initializeAuth');
    },
    // 回退
    undo({ commit, dispatch }) {
      commit('hasUnsavedAction', true);
      commit('undoCommand');
      dispatch('printUndoStack');
    },
    // 前进
    redo({ commit, dispatch }) {
      commit('hasUnsavedAction', true);
      commit('redoCommand');
      dispatch('printUndoStack');
    },
    // 设置音量
    setVolume({ state, dispatch }, { fragment = state.activeFragment, volume }) {
      dispatch('executeCommand', new SetVolume(fragment, volume));
    },
    // 设置播放速率
    setPlaybackRate({ state, dispatch }, { fragment = state.activeFragment, playbackRate }) {
      dispatch('executeCommand', new SetPlaybackRate(fragment, playbackRate));
    },
    // 设置片段开始点
    setStartPoint(
      { state, getters, dispatch },
      {
        fragment = state.activeFragment,
        start = getters.fragmentAtProgress(state.player.progress).videoProgress,
      }
    ) {
      if (!getters.canCutAt(start)) return;
      dispatch('executeCommand', new SetStartPoint(fragment, start));
    },
    // 设置片段结束点
    setEndPoint(
      { state, getters, dispatch },
      {
        fragment = state.activeFragment,
        end = getters.fragmentAtProgress(state.player.progress).videoProgress,
      }
    ) {
      if (!getters.canCutAt(end)) return;
      dispatch('executeCommand', new SetEndPoint(fragment, end));
    },
    // 分割片段
    split(
      { state, getters, dispatch },
      {
        fragment = state.activeFragment,
        split = getters.fragmentAtProgress(state.player.progress).videoProgress,
      }
    ) {
      if (!getters.canCutAt(split)) return;
      dispatch('executeCommand', new SplitFragment(fragment, split));
    },
    // 拷贝片段
    duplicate({ state, getters, dispatch }, { fragment = state.activeFragment }) {
      dispatch('executeCommand', new DuplicateFragment(fragment));
    },
    // 跳帧
    async skipFrames({ state, getters, commit }, n) {
      if (n > 0 && !getters.canSkipFrameRight) return;
      if (n < 0 && !getters.canSkipFrameLeft) return;
      let duration = n / state.activeFragment.video.fps;
      let currentTime = state.player.progress * getters.fullDuration;
      let newProgress = Utils.clamp((currentTime + duration) / getters.fullDuration);
      let { fragment, videoProgress } = getters.fragmentAtProgress(newProgress);
      commit('activeFragment', fragment);
      fragment.video.element.pause();
      fragment.video.element.currentTime = videoProgress * fragment.video.element.duration;
    },
    // 移动片段
    shiftFragment({ state, dispatch }, { fragment = state.activeFragment, shift = 1 }) {
      let newIndex = state.timeline.indexOf(fragment) + shift;
      if (newIndex < 0 || newIndex >= state.timeline.length) return;
      dispatch('executeCommand', new MoveFragment(fragment, newIndex));
    },
    // 删除片段
    removeFragment({ state, dispatch }, fragment = state.activeFragment) {
      dispatch('executeCommand', new DeleteFragment(fragment));
    },
    // Func 1.1：导入视频主逻辑
    async importVideo({ dispatch }, path) {
      try {
        let videoFile = await dispatch('loadMetadata', path); // 1.2 获取视频信息
        let fragment = new VideoFragment(videoFile); // 1.3 创建视频片段
        dispatch('executeCommand', new AddFragment(fragment)); // 1.4 添加视频片段
      } catch (e) {
        console.log(e);
        dispatch('addSnack', { text: '导入视频失败, 请重试' });
      }
    },
    // 寻找时间轴正在播放的片段
    async seek({ state, commit, getters }, progress) {
      let { fragment, videoProgress } = getters.fragmentAtProgress(progress);
      state.timeline.filter((f) => f !== fragment).forEach((f) => f.reset());
      fragment.video.element.currentTime = videoProgress * fragment.video.duration;
      commit('activeFragment', fragment);
      // 播放
      if (state.player.playing && fragment.video.element.paused) fragment.video.element.play();
    },
    // 播放下一片段
    async playNextFragment({ state, commit, dispatch }, play = false) {
      let currentIndex = state.timeline.indexOf(state.activeFragment);
      if (currentIndex >= state.timeline.length - 1) {
        state.activeFragment.video.element.pause();
        dispatch('skipFrames', 1);
        return;
      }
      let nextFragment = state.timeline[currentIndex + 1];
      let element = nextFragment.video.element;
      element.currentTime = nextFragment.start * nextFragment.video.duration;
      if (!state.activeFragment.video.element.paused || play) {
        element.play().then();
      }
      commit('activeFragment', nextFragment);
    },
    // 播放视频
    async play({ state, commit }) {
      if (state.player.progress === 1) {
        commit('activeFragment', state.timeline[0]);
        state.activeFragment.reset();
      }
      await state.activeFragment.video.element.play();
    },
    // 暂停
    pause({ state }) {
      state.activeFragment.video.element.pause();
    },
    // 添加
    addSnack: async ({ state, commit }, { text, timeout = 3000 }) => {
      let snack = { text, open: true, timeout };
      commit('addSnackObject', snack);
      return new Promise((resolve) => {
        setTimeout(() => {
          commit('removeSnack', snack);
          resolve();
        }, timeout + 500);
      });
    },
  },
  modules: { electron, ffmpeg, command, auth },
});
