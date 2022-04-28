import electron, { remote } from 'electron';
import path from 'path';
import ofs from 'fs';
import Directories from '@/js/Directories';

const fs = ofs.promises;
const currentWindow = remote.getCurrentWindow();

export default {
  state: {
    textPrompt: {
      show: false,
      title: '',
      subtitle: '',
      label: '',
      value: '',
      cancelText: '',
      confirmText: '',
      onConfirm: () => 0,
      onCancel: () => 0,
    },
    prompt: {
      show: false,
      title: '',
      subtitle: '',
      cancelText: '',
      confirmText: '',
      onConfirm: () => 0,
      onCancel: () => 0,
    },
  },
  mutations: {
    hideTextPrompt: (state) => (state.textPrompt.show = false),
    showTextPrompt: (
      state,
      {
        title = 'Input',
        subtitle = '',
        value = '',
        label = '',
        cancelText = 'Cancel',
        confirmText = 'Submit',
        onConfirm = () => 0,
        onCancel = () => 0,
      }
    ) => {
      state.textPrompt.show = true;
      state.textPrompt.title = title;
      state.textPrompt.subtitle = subtitle;
      state.textPrompt.value = value;
      state.textPrompt.label = label;
      state.textPrompt.cancelText = cancelText;
      state.textPrompt.confirmText = confirmText;
      state.textPrompt.onConfirm = onConfirm;
      state.textPrompt.onCancel = onCancel;
    },
    hidePrompt: (state) => (state.prompt.show = false),
    showPrompt: (
      state,
      {
        title = '确认执行此操作?',
        subtitle = '可能有未保存的更改',
        cancelText = '继续编辑',
        confirmText = '确认',
        onConfirm = () => 0,
        onCancel = () => 0,
      }
    ) => {
      state.prompt.show = true;
      state.prompt.title = title;
      state.prompt.subtitle = subtitle;
      state.prompt.cancelText = cancelText;
      state.prompt.confirmText = confirmText;
      state.prompt.onConfirm = onConfirm;
      state.prompt.onCancel = onCancel;
    },
  },
  getters: {
    appVersion: () => {
      return remote.app.getVersion();
    },
    systemProgress: (state, getters, rootState) => {
      let status = rootState.exportStatus;
      if (getters.isExporting && getters.exportProgress <= 0) {
        return [getters.exportProgress, { mode: 'indeterminate' }];
      } else if (getters.isExporting) {
        return [getters.exportProgress, { mode: 'normal' }];
      } else if (getters.isUploading) {
        return [rootState.youtube.progress.percent, { mode: 'error' }];
      } else if (status.error !== '') {
        return [1, { mode: 'paused' }];
      } else {
        return [-1, { mode: 'normal' }];
      }
    },
  },
  actions: {
    updateSystemProgress({ getters }) {
      currentWindow.setProgressBar(...getters.systemProgress);
    },
    async showTextPrompt(
      { commit, state },
      {
        title = 'Input',
        subtitle = '',
        value = '',
        label = '',
        cancelText = 'Cancel',
        confirmText = 'Confirm',
      }
    ) {
      return new Promise((resolve) => {
        commit('showTextPrompt', {
          title,
          subtitle,
          label,
          value,
          cancelText,
          confirmText,
          onConfirm: () => resolve({ confirmed: true, value: state.textPrompt.value }),
          onCancel: () => resolve({ confirmed: false, value: state.textPrompt.value }),
        });
      });
    },
    async showPrompt(
      { commit },
      {
        title = '确认执行此操作?',
        subtitle = '这将放弃所有未保存的更改',
        cancelText = '继续编辑',
        confirmText = '确认',
      }
    ) {
      return new Promise((resolve) => {
        commit('showPrompt', {
          title,
          subtitle,
          cancelText,
          confirmText,
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
    },
    previousPath({}, { key = '', defaultPath = Directories.videos }) {
      return localStorage.getItem('previousPath' + key) ?? defaultPath;
    },
    usePath({}, { key = '', usedPath }) {
      // localStorage['previousPath' + key] = path.dirname(usedPath);
      localStorage['previousPath' + key] = usedPath;
    },
    async promptVideoExport({ dispatch, commit }) {
      let formats = await dispatch('getFormats');

      let { canceled, filePath } = await remote.dialog.showSaveDialog(remote.getCurrentWindow(), {
        title: '导出视频',
        defaultPath: await dispatch('previousPath', { key: 'videoExport' }),
        buttonLabel: '导出视频',
        filters: formats,
      });

      if (!canceled) {
        commit('exportOutputPath', filePath);
        dispatch('usePath', { key: 'videoExport', usedPath: filePath });
      }
      return { canceled, filePath };
    },
    async exportVideoAs({ commit, dispatch, getters }) {
      if (!getters.hasProject) return;
      let { canceled, filePath } = await dispatch('promptVideoExport');
      if (!canceled) {
        commit('isYtUpload', false);
        commit('exportOutputPath', filePath);
        dispatch('exportVideo');
      }
      return canceled;
    },
    async promptVideoInput({ dispatch, commit }) {
      let { canceled, filePaths } = await remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
        title: 'Import video',
        defaultPath: await dispatch('previousPath', { key: 'video' }),
        filters: [
          { name: 'Videos', extensions: ['mp4', 'ogg', 'webm', 'mp3', 'wav'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile', 'multiSelections'],
      });
      if (!canceled) {
        dispatch('usePath', { key: 'video', usedPath: filePaths[0] });
        commit('importVideoLoading', true);
        await Promise.all(filePaths.map((f) => dispatch('importVideo', f)));
        commit('importVideoLoading', false);
      }
    },
    async importProjectByPath({ dispatch, commit }, filePath) {
      try {
        let data = await fs.readFile(filePath);
        commit('projectFilePath', filePath);
        dispatch('importProject', data);
      } catch (e) {
        dispatch('addSnack', { text: '无法打开项目' });
      }
    },
    async promptProjectInput({ dispatch }) {
      if (!(await dispatch('discardChangesPrompt'))) return;
      let { canceled, filePaths } = await remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
        title: 'Open project',
        defaultPath: await dispatch('previousPath', { key: 'project' }),
        filters: [{ name: 'Stream Clip Room Project', extensions: ['scrproject'] }],
        properties: ['openFile'],
      });
      if (!canceled) {
        dispatch('usePath', { key: 'project', usedPath: filePaths[0] });
        dispatch('importProjectByPath', filePaths[0]);
      }
    },
    async saveProjectToFile({ getters, dispatch, commit }, filePath) {
      if (!getters.hasProject) return;
      let project = JSON.stringify(getters.project);
      try {
        await fs.writeFile(filePath, project);
        commit('projectFilePath', filePath);
        commit('hasUnsavedAction', false);
        dispatch('addSnack', { text: '工程已保存!' }).then();
      } catch (e) {
        console.warn('save file err', e);
        dispatch('addSnack', { text: '无法保存工程' }).then();
      }
    },
    async saveProject({ rootState, dispatch }) {
      if (rootState.projectFilePath !== '') {
        await dispatch('saveProjectToFile', rootState.projectFilePath);
      } else {
        await dispatch('saveProjectAs');
      }
    },
    async saveProjectAs({ dispatch, getters }) {
      if (!getters.hasProject) return;
      let { canceled, filePath } = await remote.dialog.showSaveDialog(remote.getCurrentWindow(), {
        title: 'Save project as...',
        defaultPath: await dispatch('previousPath', { key: 'project' }),
        filters: [{ name: 'Stream Clip Room Project', extensions: ['scrproject'] }],
      });
      if (!canceled) {
        dispatch('usePath', { key: 'project', usedPath: filePath });
        await dispatch('saveProjectToFile', filePath);
      }
    },
    async clearDirectory({ dispatch }, directory) {
      try {
        let files = await fs.readdir(directory);
        await Promise.all(files.map((f) => fs.unlink(path.join(directory, f))));
      } catch (e) {}
    },
    async secureClose({ commit, rootState, dispatch }) {
      if (rootState.command.hasUnsavedAction) {
        currentWindow.focus();
        commit('showPrompt', {
          title: '你确定要关闭吗?',
          subtitle: '您可能有未保存的更改',
          confirmText: '关闭',
          onConfirm: () => dispatch('closeWindow'),
        });
      } else {
        dispatch('closeWindow');
      }
    },
    async openFile({}, filePath) {
      await electron.shell.openExternal(filePath);
    },
    async openFolder({}, filePath) {
      if (process.platform === 'win32') {
        require('child_process').exec('explorer /e,/select,"' + filePath + '"');
      } else {
        let folder = path.dirname(filePath);
        require('child_process').exec('start "" "' + folder + '"');
      }
    },
    async openDevTools({}) {
      currentWindow.openDevTools();
    },
    async exportLocalStorage() {
      await fs.writeFile(path.join(Directories.files, 'ls.json'), JSON.stringify(localStorage));
    },
    async closeWindow({ dispatch }) {
      await dispatch('exportLocalStorage');
      await dispatch('clearDirectory', Directories.temp);
      electron.ipcRenderer.send('quit');
    },
    minimizeWindow: async ({}) => {
      currentWindow.minimize();
    },
  },
};
