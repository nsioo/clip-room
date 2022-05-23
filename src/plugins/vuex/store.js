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
    // 状态 - 导出  
    exportStatus: {
      youtube: false,
      done: false,
      show: false,
      progress: 0,
      output: [],
      error: '',
      command: null,
    },
    export: {
      filters: [],
      showDialog: false,
      fps: '',
      interpolate: false,
      bitrate: '',
      customResolution: false,
      width: 2560,
      height: 1440,
      outputPath: '',
    },
    windowWidth: window.innerWidth,
    projectFilePath: '',
    snackbars: [],
    timeline: [],
    videosContainer: null,
    videoFiles: [],
    showContextMenu: false,
    activeFragment: null,
    loading: {
      videoImport: false, // 视频导入加载
      projectImport: false, // 项目导入加载
    },
    configTimeline: {
      minFragmentWidth: 90,
      widthPerSecond: +(localStorage.getItem('widthPerSecond') ?? 3.5),
    },
    player: {
      widthPercent: +(localStorage.getItem('playerWidth') ?? 0.5),
      progress: 0,
      volume: +(localStorage.getItem('playerVolume') ?? 1),
      playing: false,
      fullscreen: false,
    },
  },
  mutations: {
    removeExportFilter: (state, filter) =>
      state.export.filters.splice(state.export.filters.indexOf(filter), 1),
    addExportFilter: (state, filter) => state.export.filters.push(filter),
    exportFilters: (state, filters) => (state.export.filters = filters),
    exportOutputPath: (state, outputPath) => (state.export.outputPath = outputPath),
    customHeight: (state, height) => (state.export.height = height),
    customWidth: (state, width) => (state.export.width = width),
    showExportDialog: (state, value) => (state.export.showDialog = value),

    statusCommand: (state, command) => (state.exportStatus.command = command),
    statusDone: (state, value) => (state.exportStatus.done = value),
    statusProgress: (state, value) => (state.exportStatus.progress = value),
    addStatusOutput: (state, value) => state.exportStatus.output.push(value),
    statusOutput: (state, value) => (state.exportStatus.output = value),
    statusError: (state, value) => (state.exportStatus.error = value),
    showExportStatus: (state, value) => (state.exportStatus.show = value),

    timeline: (state, fragments) => (state.timeline = fragments),
    projectFilePath: (state, p) => {
      state.projectFilePath = p;
    },
    fullscreen: (state, value) => (state.player.fullscreen = value),
    showContextMenu: (state, value) => (state.showContextMenu = value),
    windowWidth: (state, value) => (state.windowWidth = value),
    importVideoLoading: (state, value) => (state.loading.videoImport = value),
    importProjectLoading: (state, value) => (state.loading.projectImport = value),
    videosContainer: (state, container) => {
      state.videosContainer = container;
      state.videoFiles.forEach((v) => {
        v.container = container;
        v._elCache = null;
      });
    },
    addSnackObject: (state, snack) => state.snackbars.push(snack),
    removeSnack: (state, snack) => state.snackbars.splice(state.snackbars.indexOf(snack), 1),
    moveFragment: (state, { fragment, newIndex }) => {
      let index = state.timeline.indexOf(fragment);
      if (index === -1) return;
      state.timeline.splice(index, 1);
      state.timeline.splice(newIndex, 0, fragment);
    },
    removeFromTimeline: (state, removedFragment) => {
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
    addToTimeline: (state, { fragment, index }) => {
      if (!state.videoFiles.includes(fragment.video)) {
        fragment.video.container = state.videosContainer;
        state.videoFiles.push(fragment.video);
      }
      if (index === undefined) state.timeline.push(fragment);
      else state.timeline.splice(index, 0, fragment);
      if (state.activeFragment === null) state.activeFragment = fragment;
    },
    activeFragment: (state, fragment) => {
      state.activeFragment = fragment;
    },
    videoFiles: (state, videoFiles) => (state.videoFiles = videoFiles),
    progress: (state, progress) => (state.player.progress = progress),
    playing: (state, playing) => (state.player.playing = playing),
    playerWidth: (state, percent) =>
      (state.player.widthPercent = localStorage.playerWidth = Utils.clamp(percent, 0.1, 0.9)),
    playerVolume: (state, volume) =>
      (state.player.volume = localStorage.playerVolume = Utils.clamp(volume)),
    widthPerSecond: (state, pixels) =>
      (state.configTimeline.widthPerSecond = localStorage.widthPerSecond = pixels),
  },
  getters: {
    isAudio: (state) =>
      ['mp3', 'wav', 'ogg'].includes(state.activeFragment.video.probe.format.format_name),
    // isUploading: (state) => state.youtube.upload && !state.youtube.done,
    isExporting: (state) => state.exportStatus.command !== null,
    exportProgress: (state, getters) => {
      let time = state.exportStatus.progress.timemark;
      if (typeof time !== 'string') return 0;
      let [h, m, s] = time.split(':').map((n) => +n);
      let seconds = s + m * 60 + h * 3600;
      return Utils.clamp(seconds / getters.fullDuration);
    },
    projectFileName: (state) => path.basename(state.projectFilePath),
    scale: (state) => {
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
    themeColors() {
      return Vuetify.framework.theme.themes[Vuetify.framework.theme.isDark ? 'dark' : 'light'];
    },
    timelineVideos: (state) => {
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
      },
    fragmentAtProgress: (state, getters) => (progress) => {
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
    fullDuration: (state) => {
      let d = state.timeline.reduce((a, b) => a + b.adjustedDuration, 0);
      return isNaN(d) ? 0 : d;
    },
    toHms: () => (seconds) => {
      if (isNaN(seconds)) return `00:00.00`;
      let hms = new Date(seconds * 1000).toISOString().substr(11, 11);
      if (hms.startsWith('00')) return hms.substr(3);
      return hms;
    },
    computedProgress: (state, getters) => getters.fragmentAtProgress(state.player.progress),
    canMoveLeft: (state) => state.timeline.indexOf(state.activeFragment) > 0,
    canMoveRight: (state) =>
      state.timeline.indexOf(state.activeFragment) < state.timeline.length - 1,
    canSkipFrameLeft: (state) => state.player.progress > 0,
    canSkipFrameRight: (state) => state.player.progress < 1,

    canCutAt: (state, getters) => (progress) => {
      let v = getters.fragmentAtProgress(progress)?.fragmentProgress;
      return v > 0 && v < 1;
    },
    canCut: (state, getters) =>
      getters.computedProgress?.fragmentProgress > 0 &&
      getters.computedProgress?.fragmentProgress < 1,
  },
  actions: {
    async initialize({ dispatch }) {
      await dispatch('initializeFfmpeg');
      await dispatch('initializeAuth');
    },
    undo({ commit, dispatch }) {
      commit('hasUnsavedAction', true);
      commit('undoCommand');
      dispatch('printUndoStack');
    },
    redo({ commit, dispatch }) {
      commit('hasUnsavedAction', true);
      commit('redoCommand');
      dispatch('printUndoStack');
    },
    setVolume({ state, dispatch }, { fragment = state.activeFragment, volume }) {
      dispatch('executeCommand', new SetVolume(fragment, volume));
    },
    setPlaybackRate({ state, dispatch }, { fragment = state.activeFragment, playbackRate }) {
      dispatch('executeCommand', new SetPlaybackRate(fragment, playbackRate));
    },
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
    duplicate({ state, getters, dispatch }, { fragment = state.activeFragment }) {
      dispatch('executeCommand', new DuplicateFragment(fragment));
    },
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
    shiftFragment({ state, dispatch }, { fragment = state.activeFragment, shift = 1 }) {
      let newIndex = state.timeline.indexOf(fragment) + shift;
      if (newIndex < 0 || newIndex >= state.timeline.length) return;
      dispatch('executeCommand', new MoveFragment(fragment, newIndex));
    },
    removeFragment({ state, dispatch }, fragment = state.activeFragment) {
      dispatch('executeCommand', new DeleteFragment(fragment));
    },
    // Func 1.1：导入视频主逻辑
    async importVideo({ dispatch }, path) {
      try {
        let videoFile = await dispatch('loadMetadata', path); // 1.1.1 获取视频信息
        let fragment = new VideoFragment(videoFile);
        dispatch('executeCommand', new AddFragment(fragment));
      } catch (e) {
        console.log(e);
        dispatch('addSnack', { text: '导入视频失败, 请重试' });
      }
    },
    async seek({ state, commit, getters }, progress) {
      let { fragment, videoProgress } = getters.fragmentAtProgress(progress);
      state.timeline.filter((f) => f !== fragment).forEach((f) => f.reset());
      fragment.video.element.currentTime = videoProgress * fragment.video.duration;
      commit('activeFragment', fragment);
      if (state.player.playing && fragment.video.element.paused) fragment.video.element.play();
    },
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
    async play({ state, commit }) {
      if (state.player.progress === 1) {
        commit('activeFragment', state.timeline[0]);
        state.activeFragment.reset();
      }
      await state.activeFragment.video.element.play();
    },
    pause({ state }) {
      state.activeFragment.video.element.pause();
    },
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
